import {
  type PrismaClient,
  type Prisma as PrismaTypes,
} from "@/generated/prisma/client";
import { Workbook } from "exceljs";
import { z } from "zod";
import {
  parseLegacyWorkbook,
  groupLegacyContacts,
  validateXlsxZip,
  digest,
  legacyContact,
  excelDate,
  type LegacyPreview,
  type LegacyRow,
} from "@/lib/domain/legacy-import";
import { CrmError, localInstant, normalizedPhone } from "@/lib/domain/crm";
import { serviceIds } from "@/lib/pricing";
import { expenseLabels } from "@/lib/domain/finance";
import { writeAudit } from "./audit";
import { entityId } from "@/lib/validation/crm";
import type { ImportProfile } from '@/lib/domain/historical-import-profile';
type Tx = PrismaTypes.TransactionClient;
const resolutionSchema = z
  .object({
    sourceKey: z.string().max(180),
    date: z.string().max(20).optional(),
    service: z.enum(serviceIds).optional(),
    category: z
      .enum(
        Object.keys(expenseLabels) as [
          keyof typeof expenseLabels,
          ...Array<keyof typeof expenseLabels>,
        ],
      )
      .optional(),
    contact: z.string().trim().min(1).max(200).optional(),
    area: z.number().min(1).max(10000).optional(),
    address: z.string().trim().min(5).max(500).optional(),
    confirmIdentity: z.boolean().optional(),
  })
  .strict();
export const importApplySchema = z
  .object({
    batchId: entityId,
    selected: z
      .array(z.string().max(180))
      .min(1)
      .max(500)
      .refine((v) => new Set(v).size === v.length),
    resolutions: z.array(resolutionSchema).max(500).default([]),
    acknowledgeWarnings: z.literal(true),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();
async function admin(tx: Tx, userId: string) {
  if (
    !(await tx.user.count({
      where: { id: userId, role: "ADMIN", active: true },
    }))
  )
    throw new CrmError("FORBIDDEN", "Недостаточно прав.");
}
async function match(tx: Tx, preview: LegacyPreview) {
  const clients = await tx.client.findMany({
    select: {
      id: true,
      name: true,
      normalizedPhone: true,
      phone: true,
      telegram: true,
      viber: true,
      legacyImportKey: true,
      updatedAt: true,
    },
    take: 5001,
    orderBy: { id: "asc" },
  });
  if (clients.length > 5000)
    throw new CrmError(
      "VALIDATION",
      "Слишком много клиентов для legacy импорта. Обратитесь к администратору.",
    );
  const records = await tx.importRecord.findMany({
    where: { sourceKey: { in: preview.rows.map((r) => r.sourceKey) } },
  });
  for (const r of preview.rows) {
    const existing = records.find((x) => x.sourceKey === r.sourceKey);
    r.duplicate = existing?.rowHash === r.rowHash;
    if (existing) {
      r.existingId = existing.entityId;
      if (!r.duplicate)
        r.errors.push(
          "SOURCE_CHANGED: эта legacy строка уже импортирована, но источник изменился. Автоматическая перезапись выключена.",
        );
    }
    if (r.kind !== "order") continue;
    delete r.clientId;
    const matches = clients.filter((c) =>
      Boolean(
        (r.phone && (c.normalizedPhone ?? normalizedPhone(c.phone)) === r.phone) ||
        (r.viber && c.viber===r.viber) ||
        (c.legacyImportKey && c.legacyImportKey===r.clientKey) ||
        (c.telegram && r.clientAliases?.some(a=>a.toLowerCase()===('@'+c.telegram!.replace(/^@/,'').toLowerCase()))) ||
        (r.telegram &&
          c.telegram?.trim().replace(/^@/, "").toLowerCase() ===
            r.telegram.replace(/^@/, "").toLowerCase()),
      ),
    );
    if (matches.length > 1)
      r.errors.push(
        "Несколько карточек совпали по сильному контакту. Сначала объедините/исправьте CRM вручную.",
      );
    if (matches.length === 1) {
      const c = matches[0];
      if (
        (r.phone && c.normalizedPhone && r.phone !== c.normalizedPhone) ||
        (r.telegram &&
          c.telegram &&
          !r.clientAliases?.includes('@'+c.telegram.replace(/^@/,'').toLowerCase()) &&
          r.telegram.toLowerCase() !==
            "@" + c.telegram.replace(/^@/, "").toLowerCase())
      )
        r.errors.push("Контакты существующего клиента противоречат строке.");
      else r.clientId = c.id;
    }
  }
  preview.matchVersion = digest(
    clients.map((c) => [c.id, c.updatedAt.toISOString()]),
  );
  preview.summary.ready = preview.rows.filter((r) => !r.errors.length).length;
  preview.summary.blocked = preview.rows.filter((r) => r.errors.length).length;
  return preview;
}
export async function previewLegacy(
  db: PrismaClient,
  userId: string,
  bytes: Buffer,
  fileName: string,
  profile: ImportProfile = 'generic',
) {
  validateXlsxZip(bytes);
  const book = new Workbook();
  try {
    await book.xlsx.load(
      bytes as unknown as Parameters<typeof book.xlsx.load>[0],
    );
  } catch {
    throw new CrmError(
      "VALIDATION",
      "Не удалось прочитать .xlsx. Сохраните обычный workbook без пароля.",
    );
  }
  const parsed = parseLegacyWorkbook(book, profile);
  for(const r of parsed.rows)r.legacyFinance={...r.legacyFinance,sourceWorkbook:fileName.slice(0,200)};
  return db.$transaction(
    async (tx) => {
      await admin(tx, userId);
      const preview = await match(tx, parsed);
      const batch = await tx.importBatch.upsert({
        where: { userId_fileHash: { userId, fileHash: parsed.fileHash } },
        create: {
          userId,
          fileHash: parsed.fileHash,
          fileName: fileName.slice(0, 200),
          preview: preview as unknown as PrismaTypes.InputJsonValue,
          expiresAt: new Date(Date.now() + 86400000),
        },
        update: {
          preview: preview as unknown as PrismaTypes.InputJsonValue,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      return { batchId: batch.id, ...preview };
    },
    { timeout: 30000 },
  );
}
export async function getImportPreview(
  db: PrismaClient,
  userId: string,
  batchId: string,
) {
  const batch = await db.importBatch.findFirst({
    where: { id: batchId, userId },
  });
  if (!batch) throw new CrmError("NOT_FOUND", "Preview не найден.");
  return {
    batchId: batch.id,
    ...(batch.preview as unknown as LegacyPreview),
    result: batch.result,
    expiresAt: batch.expiresAt.toISOString(),
  };
}
function resolved(
  row: LegacyRow,
  patch: z.infer<typeof resolutionSchema> | undefined,
): LegacyRow {
  const r = structuredClone(row);
  if (!patch) return r;
  if (patch.date) {
    r.date = excelDate({ value: patch.date, format: "" });
    r.errors = r.errors.filter((e) => !e.startsWith("Подозрительная"));
    if (!r.date) r.errors.push("Неверная исправленная дата.");
  }
  if (patch.service) {
    r.service = patch.service;
    r.errors = r.errors.filter((e) => !e.startsWith("Услуга отсутствует"));
  }
  if (patch.category) {
    r.category = patch.category;
    r.errors = r.errors.filter((e) => !e.startsWith("Категория расхода"));
  }
  if (patch.area) {
    r.area = patch.area;
    r.errors = r.errors.filter((e) => !e.startsWith("Площадь"));
  }
  if (patch.contact) {
    const c = legacyContact(patch.contact);
    if (c.ambiguous)
      throw new CrmError("VALIDATION", "Исправленный контакт неоднозначен.");
    Object.assign(r, {
      name: c.name,
      phone: c.phone,
      telegram: c.telegram,
      viber: c.viber,
    });
    r.clientKey = r.phone
      ? "phone:" + r.phone
      : r.telegram
        ? "tg:" + r.telegram.slice(1)
        : "row:" + r.sourceKey;
    r.errors = r.errors.filter((e) => !e.startsWith("Контакт неоднозначен"));
  }
  if (patch.confirmIdentity)
    r.errors = r.errors.filter((e) => !e.startsWith("Одинаковое имя"));
  if (patch.address) r.address = patch.address;
  return r;
}
export async function applyLegacy(
  db: PrismaClient,
  userId: string,
  payload: unknown,
) {
  const v = importApplySchema.parse(payload);
  return db.$transaction(
    async (tx) => {
      await admin(tx, userId);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('import:lumaclean-legacy-v1'))::text`;
      const batch = await tx.importBatch.findFirst({
        where: { id: v.batchId, userId },
      });
      if (!batch) throw new CrmError("NOT_FOUND", "Preview не найден.");
      if (batch.expiresAt < new Date())
        throw new CrmError(
          "STALE",
          "Preview истёк. Загрузите workbook повторно.",
        );
      const preview = batch.preview as unknown as LegacyPreview;
      if(preview.baselineErrors?.length)throw new CrmError('VALIDATION',preview.baselineErrors.join(' '));
      if(preview.profile==='lumaclean-2026' && (v.selected.length!==preview.rows.length || v.resolutions.length))throw new CrmError('VALIDATION','Подтверждённая историческая история применяется целиком, без изменения source snapshots.');
      if (
        v.selected.some((key) => !preview.rows.some((r) => r.sourceKey === key))
      )
        throw new CrmError("VALIDATION", "Строка отсутствует в preview.");
      if (
        v.resolutions.some((p) => !v.selected.includes(p.sourceKey)) ||
        new Set(v.resolutions.map((p) => p.sourceKey)).size !==
          v.resolutions.length
      )
        throw new CrmError(
          "VALIDATION",
          "Исправления должны относиться к выбранным строкам.",
        );
      const selected = preview.rows
        .filter((r) => v.selected.includes(r.sourceKey))
        .map((r) =>
          resolved(
            r,
            v.resolutions.find((p) => p.sourceKey === r.sourceKey),
          ),
        );
      groupLegacyContacts(selected);
      const latest = await match(tx, { ...preview, rows: selected });
      if (latest.matchVersion !== preview.matchVersion && !selected.every(r=>r.duplicate))
        throw new CrmError(
          "STALE",
          "CRM изменилась после preview. Загрузите файл повторно и проверьте объединения.",
        );
      if (selected.some((r) => r.errors.length && !r.duplicate))
        throw new CrmError(
          "VALIDATION",
          "Выбранные строки требуют решения. Исправьте их или исключите из apply.",
        );
      const result = {
        clients: 0,
        orders: 0,
        addresses: 0,
        expenses: 0,
        investments: 0,
        payouts: 0,
        existingClients: new Set(selected.filter(r=>r.clientId).map(r=>r.clientId)).size,
        skipped: 0,
        warnings: selected.flatMap((r) =>
          r.warnings.map((w) => `${r.kind} / строка ${r.row}: ${w}`),
        ),
      };
      const createdClients = new Map<string, string>(),
        addresses = new Map<string, string>();
      for (const r of [...selected].sort(
        (a, b) =>
          ({ order: 0, expense: 1, investment: 2 })[a.kind] -
          { order: 0, expense: 1, investment: 2 }[b.kind],
      )) {
        if (r.duplicate) {
          result.skipped++;
          continue;
        }
        let entityId: string, entityType: string;
        if (r.kind === "order") {
          let clientId = r.clientId ?? createdClients.get(r.clientKey!);
          if (!clientId) {
            const c = await tx.client.create({
              data: {
                name: r.name!,
                phone: r.phone ?? null,
                normalizedPhone: r.phone,
                telegram: r.clientAliases?.length ? null : r.telegram,
                legacyImportKey: r.clientKey,
                viber: r.viber,
                preferredChannel: r.viber
                  ? "VIBER"
                  : r.telegram
                    ? "TELEGRAM"
                    : r.phone
                      ? "OTHER"
                      : null,
                notes: r.clientAliases?.length ? 'Исторические Telegram identifiers: '+r.clientAliases.join(', ')+'. Актуальный handle не подтверждён.' : 'Контакт из истории; проверьте перед новым заказом.',
              },
            });
            clientId = c.id;
            createdClients.set(r.clientKey!, clientId);
            result.clients++;
            await writeAudit(
              tx,
              { type: "USER", userId },
              {
                action: "CLIENT_IMPORTED",
                entityType: "Client",
                entityId: clientId,
              },
            );
          }
          const fullAddress =
            r.address ??
            (r.district ? r.district+', Beograd' : 'Точный адрес не указан');
          const key = clientId + ":" + fullAddress;
          let addressId = addresses.get(key);
          if (!addressId) {
            const existing = await tx.clientAddress.findFirst({
              where: { clientId, fullAddress },
              select: { id: true },
            });
            addressId = existing?.id;
            if (!addressId) {
              addressId = (
                await tx.clientAddress.create({
                  data: {
                    clientId,
                    fullAddress,
                    active: false,
                    label: r.address ? 'Исторический адрес' : 'Точный адрес не указан',
                    coordinatesSource: 'HISTORICAL_UNCONFIRMED',
                    comment:
                      "Из истории. Текст адреса и местоположение требуют подтверждения.",
                  },
                })
              ).id;
              result.addresses++;
            }
            addresses.set(key, addressId);
          }
          const service = r.service ? await tx.service.findUniqueOrThrow({
            where: { code: r.service! },
          }) : null;
          if(!service && !r.historicalServiceLabel)throw new CrmError('VALIDATION','Не указана историческая услуга.');
          const order = await tx.order.create({
            data: {
              reference:
                "LEGACY-" + r.legacyId + "-" + digest(r.sourceKey).slice(0, 8),
              legacyId: r.legacyId,
              historical: true,
              soilLevel: null,
              clientId,
              addressId,
              serviceId: service?.id ?? null,
              historicalServiceLabel: r.historicalServiceLabel ?? null,
              historicalServiceDate: new Date(r.date!+'T00:00:00Z'),
              area: r.area!,
              status: r.status as "COMPLETED" | "CANCELLED" | "DRAFT",
              completedAt: null,
              basePrice: r.amount!,
              finalPrice: r.amount!,
              travelBufferMinutes: 0,
              requiredCleaners: 1,
              legacyFinance: r.legacyFinance as PrismaTypes.InputJsonValue,
              internalComment: r.description || null,
            },
          });
          entityId = order.id;
          entityType = "Order";
          result.orders++;
          if(preview.profile==='lumaclean-2026'){
            for(const [recipientName,field] of [['Владислав','sourceVladislavPayout'],['Партнёр','sourcePartnerPayout']] as const){
              const amount=r.legacyFinance?.[field];
              if(r.legacyId==='8' && field==='sourcePartnerPayout' && amount===null)continue;
              if(typeof amount!=='number')throw new CrmError('VALIDATION','Historical payout отсутствует.');
              if(amount===0)continue;
              const candidates=recipientName==='Владислав' ? await tx.cleaner.findMany({where:{name:recipientName},select:{id:true}}) : [];
              const sourceKey=r.sourceKey+':payout:'+field;
              const p=await tx.cleanerPayout.create({data:{orderId:order.id,cleanerId:candidates.length===1?candidates[0].id:null,historical:true,recipientName,sourceKey,amount,status:'PAID',legacyFinance:{sourceAmount:amount,sourceRow:r.row,sourceWorkbook:batch.fileName,sourceParticipant:recipientName},appliedPercent:null,basisAmount:null,paidAt:null}});
              await tx.importRecord.create({data:{sourceKey,rowHash:r.rowHash,batchId:batch.id,entityType:'CleanerPayout',entityId:p.id}});
              result.payouts++;
            }
          }
        } else if (r.kind === "expense") {
          const orderLegacyId = String(r.legacyFinance?.orderLegacyId ?? "");
          let orderId: string | null = null;
          if (orderLegacyId) {
            const record = await tx.importRecord.findUnique({
              where: {
                sourceKey: "lumaclean-legacy-v1:order:" + orderLegacyId,
              },
            });
            if (!record || record.entityType !== "Order")
              throw new CrmError(
                "VALIDATION",
                `Расход в строке ${r.row} связан с заказом ${orderLegacyId}. Выберите этот заказ в apply или импортируйте его сначала.`,
              );
            orderId = record.entityId;
          }
          const expense = await tx.expense.create({
            data: {
              category: r.category as keyof typeof expenseLabels,
              amount: r.amount!,
              orderId,
              occurredAt: localInstant(r.date! + "T00:00"),
              description: r.description,
              legacyFinance: r.legacyFinance as PrismaTypes.InputJsonValue,
            },
          });
          entityId = expense.id;
          entityType = "Expense";
          result.expenses++;
        } else {
          entityId = (
            await tx.investment.create({
              data: {
                occurredAt: localInstant(r.date! + "T00:00"),
                paidBy: r.paidBy!,
                description: r.description,
                amount: r.amount!,
                returnedAmount: r.returnedAmount!,
              },
            })
          ).id;
          entityType = "Investment";
          result.investments++;
        }
        await tx.importRecord.create({
          data: {
            sourceKey: r.sourceKey,
            rowHash: r.rowHash,
            batchId: batch.id,
            entityType,
            entityId,
          },
        });
        await writeAudit(
          tx,
          { type: "USER", userId },
          {
            action: entityType.toUpperCase() + "_IMPORTED",
            entityType,
            entityId,
          },
        );
      }
      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          appliedAt: new Date(),
          result: {
            ...result,
            resolutions: v.resolutions,
            reason: v.reason,
          } as PrismaTypes.InputJsonValue,
        },
      });
      await writeAudit(
        tx,
        { type: "USER", userId },
        {
          action: "IMPORT_BATCH_APPLIED",
          entityType: "ImportBatch",
          entityId: batch.id,
          changes: {
            changedFields: {
              before: null,
              after: [
                "clients",
                "orders",
                "addresses",
                "expenses",
                "investments",
              ],
            },
          },
        },
      );
      return result;
    },
    { maxWait: 10000, timeout: 60000 },
  );
}
