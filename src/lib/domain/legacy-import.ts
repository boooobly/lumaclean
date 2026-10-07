import { createHash } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { normalizedPhone } from "./crm";
import { serviceLabels } from "./crm-types";
import type { Workbook, Cell } from "exceljs";
import { CrmError } from "./crm";
import { applyHistoricalProfile, type ImportProfile } from './historical-import-profile';
export type LegacyCell = { value: unknown; format: string; formula?: boolean };
export type LegacyRow = {
  kind: "order" | "expense" | "investment";
  row: number;
  sourceKey: string;
  rowHash: string;
  legacyId: string;
  date: string | null;
  name?: string;
  phone?: string | null;
  telegram?: string | null;
  viber?: string | null;
  clientKey?: string;
  clientAliases?: string[];
  confirmedAliasKey?: string;
  historicalServiceLabel?: string;
  service?: string | null;
  area?: number | null;
  address?: string | null;
  district?: string;
  amount: number | null;
  category?: string | null;
  description: string;
  paidBy?: string;
  returnedAmount?: number | null;
  status?: string | null;
  legacyFinance?: Record<string, unknown>;
  raw: LegacyCell[];
  errors: string[];
  warnings: string[];
  existingId?: string;
  clientId?: string;
  duplicate?: boolean;
};
export type LegacyPreview = {
  profile?: ImportProfile;
  baselineErrors?: string[];
  fileHash: string;
  rows: LegacyRow[];
  summary: {
    orders: number;
    expenses: number;
    investments: number;
    clients: number;
    merges: { name: string; rows: number[] }[];
    addresses: number;
    ready: number;
    blocked: number;
  };
  matchVersion?: string;
};
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function legacyCell(cell: Cell): LegacyCell {
  let value: unknown = cell.value;
  let formula = false;
  if (value instanceof Date) value = { date: value.toISOString() };
  else if (value && typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      formula = true;
      value = "result" in value ? value.result : null;
    } else if ("richText" in value)
      value = (value.richText as { text: string }[])
        .map((r) => r.text)
        .join("");
    else if ("text" in value) value = value.text;
    else value = null;
  }
  if (value instanceof Date) value = { date: value.toISOString() };
  return {
    value: value ?? null,
    format: cell.numFmt ?? "",
    ...(formula ? { formula: true } : {}),
  };
}
const text = (c: LegacyCell) =>
  typeof c.value === "string"
    ? c.value.trim()
    : typeof c.value === "number"
      ? String(c.value)
      : "";
export function excelDate(
  c: LegacyCell,
  date1904 = false,
  now = new Date(),
): string | null {
  let value: string;
  if (c.value && typeof c.value === "object" && "date" in c.value)
    value = String(c.value.date).slice(0, 10);
  else if (typeof c.value === "number") {
    if (
      !/[dy]/i.test(c.format) ||
      !Number.isFinite(c.value) ||
      (!date1904 && Math.floor(c.value) === 60)
    )
      return null;
    const origin = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    value = new Date(origin + Math.floor(c.value) * 86400000)
      .toISOString()
      .slice(0, 10);
  } else {
    const s = text(c),
      match = s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
    value = match ? `${match[3]}-${match[2]}-${match[1]}` : s;
  }
  try {
    const d = Temporal.PlainDate.from(value);
    if (
      d.year < 2020 ||
      d.year > now.getUTCFullYear() + 1 ||
      value > new Date(now.getTime() + 86400000).toISOString().slice(0, 10)
    )
      return null;
    return d.toString();
  } catch {
    return null;
  }
}
export function excelHours(c: LegacyCell, date1904 = false): number | null {
  if (c.value === null || c.value === "") return null;
  // Date-formatted mistakes are never interpreted as hours.
  if (c.value && typeof c.value === "object") {
    if (
      !("date" in c.value) ||
      !/[hs]/i.test(c.format) ||
      /[dy]/i.test(c.format)
    )
      return null;
    const origin = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    const hours = (new Date(String(c.value.date)).getTime() - origin) / 3600000;
    return Number.isFinite(hours) && hours >= 0 && hours <= 24
      ? Math.round(hours * 10000) / 10000
      : null;
  }
  if (typeof c.value === "number") {
    if (/[dy]/i.test(c.format)) return null;
    const h = /h|\[h\]|s/i.test(c.format) ? c.value * 24 : c.value;
    return Number.isFinite(h) && h >= 0 && h <= 24
      ? Math.round(h * 10000) / 10000
      : null;
  }
  const s = text(c),
    m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const h = Number(m[1]) + Number(m[2]) / 60 + Number(m[3] ?? 0) / 3600;
    return Number(m[2]) < 60 && Number(m[3] ?? 0) < 60 && h <= 24 ? h : null;
  }
  if (/^\d+(?:[.,]\d+)?$/.test(s)) {
    const h = Number(s.replace(",", "."));
    return h <= 24 ? h : null;
  }
  return null;
}
export function legacyContact(s: string) {
  const handles = [...s.matchAll(/@([a-zA-Z0-9_]{5,32})/g)].map((m) =>
    m[1].toLowerCase(),
  );
  const phones = [...s.matchAll(/(?:\+|00)\d[\d\s()-]{6,25}\d/g)].map((m) =>
    normalizedPhone(m[0].trim()),
  );
  const name = s
    .replace(/@[a-zA-Z0-9_]+/g, "")
    .replace(/(?:\+|00)\d[\d\s()-]{6,25}\d/g, "")
    .replace(/\b(?:вайбер|viber|телеграм|telegram|телефон|тел)\b/gi, "")
    .replace(/вайбер|телеграм/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    name,
    phone: phones.length === 1 ? phones[0] : null,
    telegram: handles.length === 1 ? "@" + handles[0] : null,
    viber: /вайбер|viber/i.test(s) && phones.length === 1 ? phones[0] : null,
    ambiguous:
      handles.length > 1 ||
      phones.length > 1 ||
      phones.some((p) => !p) ||
      !name,
  };
}
function money(c: LegacyCell) {
  const value = c.value;
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10000000
  )
    return Math.round(value * 100) / 100;
  if (typeof value === "string" && /^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
    return Number(value.replace(",", "."));
  return null;
}
const categoryMap: Record<string, string> = {
  транспорт: "TRANSPORT",
  такси: "TAXI",
  "химия и расходники": "CHEMICALS",
  химия: "CHEMICALS",
  инвентарь: "EQUIPMENT",
  реклама: "MARKETING",
  "сайт и сервисы": "SOFTWARE",
  прочее: "OTHER",
};
// A shared phone OR Telegram joins a component. Conflicting strong identities block
// the entire component; neither row order nor a bridge row may silently choose one.
export function groupLegacyContacts(rows: LegacyRow[]) {
  const orders = rows.filter((r) => r.kind === "order");
  const parent = orders.map((_, i) => i);
  const root = (i: number): number =>
    parent[i] === i ? i : (parent[i] = root(parent[i]));
  const seen = new Map<string, number>();
  orders.forEach((r, i) => {
    for (const key of [
      r.phone ? "phone:" + r.phone : null,
      r.telegram ? "tg:" + r.telegram.slice(1) : null,
      r.confirmedAliasKey,
    ]) {
      if (!key) continue;
      const prior = seen.get(key);
      if (prior !== undefined) parent[root(i)] = root(prior);
      else seen.set(key, i);
    }
  });
  const groups = new Map<number, LegacyRow[]>();
  orders.forEach((r, i) =>
    groups.set(root(i), [...(groups.get(root(i)) ?? []), r]),
  );
  for (const group of groups.values()) {
    const phones = [
      ...new Set(group.flatMap((r) => (r.phone ? [r.phone] : []))),
    ];
    const handles = [
      ...new Set(group.flatMap((r) => (r.telegram ? [r.telegram] : []))),
    ];
    const aliasesConfirmed = group.every(r=>r.confirmedAliasKey && r.confirmedAliasKey===group[0].confirmedAliasKey && handles.every(h=>r.clientAliases?.includes(h)));
    const conflict = phones.length > 1 || (handles.length > 1 && !aliasesConfirmed);
    const key = aliasesConfirmed ? group[0].confirmedAliasKey! : phones[0]
      ? "phone:" + phones[0]
      : handles[0]
        ? "tg:" + handles[0].slice(1)
        : "row:" + group[0].sourceKey;
    for (const r of group) {
      r.errors = r.errors.filter(
        (e) => !e.startsWith("Повторный сильный контакт"),
      );
      if (conflict)
        r.errors.push(
          "Повторный сильный контакт имеет противоречивые данные. Исправьте источник перед apply.",
        );
      r.clientKey = key;
      if (!conflict) {
        r.phone ??= phones[0] ?? null;
        r.telegram ??= handles[0] ?? null;
        r.viber ??= group.find((x) => x.viber)?.viber ?? null;
      }
    }
  }
}
export function parseLegacyWorkbook(book: Workbook, profile: ImportProfile = 'generic'): LegacyPreview {
  const rows: LegacyRow[] = [];
  const specifications = [
    {
      name: "Заказы",
      kind: "order",
      columns: 18,
      headers: {
        1: "Дата",
        2: "ID заказа",
        3: "Клиент",
        4: "Услуга",
        7: "Доход, RSD",
        12: "Часы Владислава",
        13: "Часы партнёра",
      },
    },
    {
      name: "Расходы",
      kind: "expense",
      columns: 9,
      headers: { 1: "Дата", 2: "ID расхода", 4: "Категория", 7: "Сумма, RSD" },
    },
    {
      name: "Вложения",
      kind: "investment",
      columns: 8,
      headers: {
        1: "Дата",
        2: "Кто вложил",
        5: "Вложено, RSD",
        6: "Возвращено, RSD",
      },
    },
  ] as const;
  for (const spec of specifications) {
    const sheet = book.getWorksheet(spec.name);
    if (!sheet)
      throw new CrmError("VALIDATION", `Не найден лист «${spec.name}».`);
    const header = Array.from(
      { length: Math.min(20, sheet.rowCount) },
      (_, i) => i + 1,
    ).find((n) =>
      Object.entries(spec.headers).every(
        ([col, title]) => sheet.getCell(n, Number(col)).text.trim() === title,
      ),
    );
    if (!header)
      throw new CrmError(
        "VALIDATION",
        `Структура листа «${spec.name}» не соответствует LumaClean workbook.`,
      );
    if (sheet.rowCount > 5000)
      throw new CrmError("VALIDATION", "Слишком много строк в workbook.");
    for (let n = header + 1; n <= sheet.rowCount; n++) {
      const raw = Array.from({ length: spec.columns }, (_, i) =>
        legacyCell(sheet.getCell(n, i + 1)),
      );
      const sourceColumns =
        spec.kind === "order"
          ? [0, 1, 2, 3, 4, 5, 6, 11, 12, 15, 16, 17]
          : spec.kind === "expense"
            ? [0, 1, 2, 3, 4, 5, 6, 7, 8]
            : [0, 1, 2, 3, 4, 5, 7];
      if (
        sourceColumns.every((i) => raw[i].value === null || raw[i].value === "")
      )
        continue;
      const legacyId =
        spec.kind === "investment"
          ? digest(sourceColumns.map((i) => raw[i].value)).slice(0, 24)
          : text(raw[1]);
      const r: LegacyRow = {
        kind: spec.kind,
        row: n,
        legacyId,
        sourceKey: `lumaclean-legacy-v1:${spec.kind}:${legacyId || "row-" + n}`,
        rowHash: digest(raw),
        raw,
        date: excelDate(raw[0], book.properties.date1904),
        amount: money(
          raw[spec.kind === "order" || spec.kind === "expense" ? 6 : 4],
        ),
        description: "",
        errors: [],
        warnings: [],
      };
      if (!r.date)
        r.errors.push("Подозрительная или отсутствующая дата; исправьте явно.");
      if (r.amount === null)
        r.errors.push("Не удалось надёжно прочитать сумму.");
      if (!legacyId)
        r.errors.push(
          "Отсутствует legacy ID; требуется ручное исправление источника.",
        );
      if (spec.kind === "order") {
        const contact = legacyContact(text(raw[2]));
        Object.assign(r, contact);
        delete (r as LegacyRow & { ambiguous?: boolean }).ambiguous;
        if (contact.ambiguous)
          r.errors.push("Контакт неоднозначен; проверьте имя и контакт.");
        r.clientKey = r.phone
          ? "phone:" + r.phone
          : r.telegram
            ? "tg:" + r.telegram.slice(1)
            : "row:" + r.sourceKey;
        if (!r.phone && !r.telegram)
          r.warnings.push(
            "Нет сильного идентификатора клиента; объединение по имени выключено.",
          );
        r.service =
          Object.entries(serviceLabels).find(
            ([, name]) => name === text(raw[3]),
          )?.[0] ?? null;
        if (!r.service)
          r.errors.push(
            "Услуга отсутствует в текущем каталоге; выберите соответствие.",
          );
        r.area = money(raw[4]);
        if (!r.area || r.area > 10000)
          r.errors.push("Площадь должна быть от 1 до 10 000 м².");
        const statuses: Record<string, string> = {
          Выполнен: "COMPLETED",
          Отменён: "CANCELLED",
          "Новая заявка": "DRAFT",
        };
        r.status = statuses[text(raw[15])] ?? null;
        if (!r.status)
          r.errors.push(
            "Исторический статус требует решения; активный заказ не импортируется в расписание автоматически.",
          );
        r.description = typeof raw[17].value==='string' ? raw[17].value : '';
        r.district = text(raw[5]);
        const address = r.description
          .match(/(?:^|[.!]\s*|\s{2,})Адрес\s+([^\n]+)$/i)?.[1]
          ?.trim();
        r.address =
          address && /\d/.test(address) && address.length >= 10
            ? address
            : null;
        if (!r.address)
          r.warnings.push(
            "Точный адрес не подтверждён; будет неактивный historical/manual unresolved адрес без координат.",
          );
        else
          r.warnings.push(
            "Адрес из комментария: проверьте текст; координаты не создаются.",
          );
        const hours = [
          excelHours(raw[11], book.properties.date1904),
          excelHours(raw[12], book.properties.date1904),
        ];
        if ([11, 12].some((i, j) => raw[i].value !== null && hours[j] === null))
          r.warnings.push(
            "Часы имеют формат даты или неоднозначное значение. Они не используются для actual duration и правил.",
          );
        r.legacyFinance = {
          sourceRevenue: r.amount,
          sourceDirectExpenses: money(raw[7]),
          sourceReservePercent: raw[8].value,
          sourceReserveAmount: money(raw[9]),
          sourceLaborFund: money(raw[10]),
          sourceVladislavHoursRaw: raw[11],
          sourcePartnerHoursRaw: raw[12],
          sourceVladislavPayout: money(raw[13]),
          sourcePartnerPayout: money(raw[14]),
          sourceComment: raw[17].value,
          sourceDateRaw: raw[0],
          sourceIdentityRaw: raw[2].value,
          sourceServiceLabel: raw[3].value,
          sourceRow: n,
          directExpenses: money(raw[7]),
          reservePercent: raw[8].value,
          reserveAmount: money(raw[9]),
          payrollFund: money(raw[10]),
          hoursVladislav: hours[0],
          hoursPartner: hours[1],
          calculatedPayoutVladislav: money(raw[13]),
          calculatedPayoutPartner: money(raw[14]),
          paymentReceived: text(raw[16]),
          status: "UNREVIEWED",
        };
        r.warnings.push(
          "Старые расчётные выплаты и резерв сохранены как legacy snapshot. Это не подтверждение фактических выплат; новые начисления не создаются.",
        );
      } else if (spec.kind === "expense") {
        r.category = categoryMap[text(raw[3]).toLowerCase()] ?? null;
        if (!r.category)
          r.errors.push("Категория расхода отсутствует или неизвестна.");
        r.description = text(raw[4]);
        if (!r.description) r.errors.push("Нет описания расхода.");
        r.paidBy = text(raw[5]);
        r.legacyFinance = {
          orderLegacyId: text(raw[2]),
          paidBy: r.paidBy,
          reimbursed: text(raw[7]),
          sourceComment: raw[8].value,
          sourceDescription: raw[4].value,
          sourceRow: n,
        };
      } else {
        r.paidBy = text(raw[1]);
        r.description = [text(raw[2]), text(raw[7])]
          .filter(Boolean)
          .join(" · ");
        r.returnedAmount = money(raw[5]) ?? (raw[5].value === null ? 0 : null);
        if (
          !r.paidBy ||
          !r.description ||
          r.returnedAmount === null ||
          (r.amount !== null && r.returnedAmount > r.amount)
        )
          r.errors.push(
            "Проверьте автора, назначение и возвращённую сумму вложения.",
          );
      }
      if (rows.some((x) => x.sourceKey === r.sourceKey)) {
        r.errors.push("Legacy ID повторяется в файле.");
        rows
          .find((x) => x.sourceKey === r.sourceKey)!
          .errors.push("Legacy ID повторяется в файле.");
      }
      rows.push(r);
      if (rows.length > 500)
        throw new CrmError(
          "VALIDATION",
          "За один импорт допускается до 500 операций.",
        );
    }
  }
  for (const r of rows.filter((r) => r.kind === "order")) {
    const linked = rows.filter(
      (e) =>
        e.kind === "expense" &&
        String(e.legacyFinance?.orderLegacyId ?? "") === r.legacyId,
    );
    const listed = linked.reduce((sum, e) => sum + (e.amount ?? 0), 0),
      old = r.legacyFinance?.directExpenses;
    if (typeof old === "number" && Math.abs(old - listed) > 0.01)
      r.warnings.push(
        `Прямые расходы в строке (${old} RSD) отличаются от связанных строк «Расходы» (${listed} RSD). Импортируются только операции листа «Расходы»; суммы из заказа не дублируются.`,
      );
  }
  for (const r of rows.filter((r) => r.kind === "expense")) {
    const legacyId = String(r.legacyFinance?.orderLegacyId ?? ""),
      o = rows.find((o) => o.kind === "order" && o.legacyId === legacyId);
    if (legacyId && !o)
      r.warnings.push(
        "Связанный legacy заказ отсутствует в файле. Apply потребует уже импортированный заказ или включённую строку заказа.",
      );
    if (
      o?.date &&
      r.date &&
      Math.abs(new Date(o.date).getTime() - new Date(r.date).getTime()) >
        7 * 86400000
    )
      r.warnings.push(
        "Дата расхода отличается от даты связанного заказа более чем на неделю. Проверьте legacy ID; автоматическое перепривязывание выключено.",
      );
  }
  const baselineErrors = profile==='lumaclean-2026' ? applyHistoricalProfile(rows) : [];
  groupLegacyContacts(rows);
  const named = new Map<string, string>();
  for (const r of rows.filter((r) => r.kind === "order")) {
    const name = r.name?.toLowerCase() ?? "",
      prior = named.get(name);
    if (prior && prior !== r.clientKey)
      r.errors.push(
        "Одинаковое имя с другим контактом; подтвердите личность клиента явно.",
      );
    else named.set(name, r.clientKey!);
  }
  const orders = rows.filter((r) => r.kind === "order"),
    groups = new Map<string, LegacyRow[]>();
  for (const r of orders)
    groups.set(r.clientKey!, [...(groups.get(r.clientKey!) ?? []), r]);
  return {
    fileHash: digest(rows.map((r) => [r.sourceKey, r.rowHash])),
    profile,
    baselineErrors,
    rows,
    summary: {
      orders: orders.length,
      expenses: rows.filter((r) => r.kind === "expense").length,
      investments: rows.filter((r) => r.kind === "investment").length,
      clients: groups.size,
      merges: [...groups.values()]
        .filter((g) => g.length > 1)
        .map((g) => ({ name: g[0].name!, rows: g.map((r) => r.row) })),
      addresses: new Set(
        orders
          .filter((r) => r.address)
          .map((r) => r.clientKey + ":" + r.address),
      ).size,
      ready: rows.filter((r) => !r.errors.length).length,
      blocked: rows.filter((r) => r.errors.length).length,
    },
  };
}
// Read the central directory before any decompression. Reject ZIP64 and oversized expansions.
export function validateXlsxZip(bytes: Buffer) {
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 22)
    throw new CrmError("VALIDATION", "Размер .xlsx должен быть до 2 МБ.");
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new CrmError("VALIDATION", "Неверный .xlsx ZIP.");
  const count = bytes.readUInt16LE(eocd + 10),
    offset = bytes.readUInt32LE(eocd + 16);
  if (count > 1000 || count === 65535 || offset >= eocd)
    throw new CrmError("VALIDATION", "Неподдерживаемый workbook.");
  let at = offset,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > eocd || bytes.readUInt32LE(at) !== 0x02014b50)
      throw new CrmError("VALIDATION", "Неверная структура ZIP.");
    const size = bytes.readUInt32LE(at + 24),
      length = bytes.readUInt16LE(at + 28);
    total += size;
    const name = bytes.subarray(at + 46, at + 46 + length).toString("utf8");
    if (
      total > 20 * 1024 * 1024 ||
      size === 0xffffffff ||
      /vbaProject|externalLinks|\.\.\/|^\//i.test(name)
    )
      throw new CrmError(
        "VALIDATION",
        "Workbook содержит недопустимое содержимое или слишком большой объём.",
      );
    at +=
      46 + length + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
}
