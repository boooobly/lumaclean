import { createHash } from "node:crypto";
import sharp from "sharp";
import { put, get, del, list } from "@vercel/blob";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { Qualification } from './contracts';
import { AgentError } from "./contracts";
import { schedulingLock } from "@/lib/services/scheduling-commands";
export const attachmentSelect = {
  id: true,
  width: true,
  height: true,
  mimeType: true,
  byteSize: true,
  aiAnalysisStatus: true,
} as const;
/** Newest explicit customer facts win; photo pixels never qualify a price. */
export function photoFactsConfirmed(texts: string[], input: Qualification) {
  const area = texts.map(text => {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:м[²2]|m[²2]|квадрат|kvadrat|sq\.?\s*(?:m|meter))/iu);
    if (match) return Number(match[1].replace(',', '.'));
    return /^\d+(?:[.,]\d+)?$/.test(text.trim()) ? Number(text.trim().replace(',', '.')) : null;
  }).find(value => value !== null);
  const soil = texts.map(text =>
    /экстрем|extreme/iu.test(text) ? 'EXTREME' :
    /сильн(?:ая|ое|ые)|сильн.*загряз|heavy|jaka zaprljan|јака запрљан/iu.test(text) ? 'HEAVY' :
    /л[её]гк(?:ая|ое|ие)|л[её]гк.*загряз|light dirt|blaga zaprljan|блага запрљан/iu.test(text) ? 'LIGHT' :
    /обычн.*загряз|обычн(?:ая|ое|ые)|^обычно[.! ]*$|^normal[.! ]*$|normal (?:dirt|soil)|uobičajena|uobicajena|уобичајена/iu.test(text) ? 'NORMAL' : null
  ).find(Boolean);
  return area === input.area && soil === input.soilLevel;
}
export async function photoQualificationAllowed(tx:Prisma.TransactionClient,conversationId:string,input:Qualification){
 if(!await tx.chatAttachment.count({where:{conversationId,message:{author:'CLIENT'}}}))return true;
 const messages=await tx.message.findMany({where:{conversationId,author:'CLIENT'},orderBy:{sentAt:'desc'},take:50,select:{text:true}});
 return photoFactsConfirmed(messages.map(m=>m.text),input);
}
export interface ChatAttachmentStorage {
  write(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(keys: string[]): Promise<void>;
}
export class PrivateBlobStorage implements ChatAttachmentStorage {
  async write(key: string, bytes: Buffer) {
    await put(key, bytes, {
      access: "private",
      contentType: key.endsWith('.pdf') ? 'application/pdf' : "image/jpeg",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }
  async read(key: string) {
    const value = await get(key, { access: "private", useCache: false });
    if (!value || value.statusCode !== 200 || value.blob.size > 4 * 1024 * 1024)
      throw new AgentError("ATTACHMENT_UNAVAILABLE");
    return Buffer.from(await new Response(value.stream).arrayBuffer());
  }
  async remove(keys: string[]) {
    if (keys.length) await del(keys);
  }
}
export function imageMime(bytes: Buffer) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}
export async function sanitizeImage(bytes: Buffer, claimedMime: string) {
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw new AgentError("IMAGE_SIZE");
  if (!imageMime(bytes) || imageMime(bytes) !== claimedMime)
    throw new AgentError("IMAGE_FORMAT");
  try {
    const options = {
      limitInputPixels: 40_000_000,
      failOn: "warning" as const,
      animated: false,
    };
    const meta = await sharp(bytes, options).metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > 40_000_000 ||
      (meta.pages ?? 1) > 1
    )
      throw new AgentError("IMAGE_DIMENSIONS");
    // Default sharp output strips EXIF, GPS, ICC, comments and all other source metadata.
    const display = await sharp(bytes, options)
      .rotate()
      .resize({
        width: 2200,
        height: 2200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    const thumbnail = await sharp(display)
      .resize({
        width: 360,
        height: 360,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75 })
      .toBuffer();
    const result = await sharp(display).metadata();
    return {
      display,
      thumbnail,
      width: result.width!,
      height: result.height!,
      sha256: createHash("sha256").update(display).digest("hex"),
    };
  } catch (e) {
    if (e instanceof AgentError) throw e;
    throw new AgentError("IMAGE_DECODE");
  }
}
export function attachmentPrefix() {
  return `chat/${process.env.VERCEL_ENV === "production" ? "production" : (process.env.CHAT_STORAGE_NAMESPACE ?? "preview")}/`;
}
export async function uploadAttachment(
  db: PrismaClient,
  conversationId: string,
  requestId: string,
  bytes: Buffer,
  mime: string,
  uploader = "CLIENT",
  storage: ChatAttachmentStorage = new PrivateBlobStorage(),
) {
  const existing = await db.chatAttachment.findUnique({
    where: { conversationId_requestId: { conversationId, requestId } },
  });
  if (existing) {
    if(existing.uploader!==uploader)throw new AgentError("INVALID_ATTACHMENTS");
    return existing;
  }
  const c = await db.conversation.findUniqueOrThrow({
    where: { id: conversationId },
  });
  if (
    c.control === "CLOSED" ||
    (uploader === "ADMIN" && c.control !== "HUMAN_CONTROL")
  )
    throw new AgentError("CONVERSATION_CLOSED");
  if (
    (await db.chatAttachment.count({
      where: {
        conversationId,
        messageId: null,
        createdAt: { gt: new Date(Date.now() - 86400000) },
      },
    })) >= 12
  )
    throw new AgentError("ATTACHMENT_LIMIT");
  const image = await sanitizeImage(bytes, mime),
    base = `${attachmentPrefix()}${conversationId}/${requestId}`,
    storageKey = `${base}.jpg`,
    thumbnailKey = `${base}-thumb.jpg`;
  return db.$transaction(
    async (tx) => {
      await schedulingLock(tx, "conversation", conversationId);
      const duplicate = await tx.chatAttachment.findUnique({
        where: { conversationId_requestId: { conversationId, requestId } },
      });
      if (duplicate) {
        if (duplicate.uploader !== uploader)
          throw new AgentError("INVALID_ATTACHMENTS");
        return duplicate;
      }
      const current = await tx.conversation.findUniqueOrThrow({
        where: { id: conversationId },
      });
      if (
        current.control === "CLOSED" ||
        (uploader === "ADMIN" && current.control !== "HUMAN_CONTROL")
      )
        throw new AgentError("CONVERSATION_CLOSED");
      await storage.write(storageKey, image.display);
      await storage.write(thumbnailKey, image.thumbnail);
      return tx.chatAttachment.create({
        data: {
          conversationId,
          requestId,
          uploader,
          storageKey,
          thumbnailKey,
          mimeType: "image/jpeg",
          byteSize: image.display.length,
          width: image.width,
          height: image.height,
          sha256: image.sha256,
        },
      });
    },
    { timeout: 20000 },
  );
}
export async function cleanupAttachments(
  db: PrismaClient,
  storage: ChatAttachmentStorage = new PrivateBlobStorage(),
) {
  const before = new Date(Date.now() - 86400000),
    retention = new Date(
      Date.now() -
        Math.min(
          3650,
          Math.max(1, Number(process.env.CHAT_ATTACHMENT_RETENTION_DAYS) || 90),
        ) *
          86400000,
    );
  const rows = await db.chatAttachment.findMany({
    where: {
      OR: [
        { messageId: null, createdAt: { lt: before } },
        {
          conversation: {
            control: "CLOSED",
            closedAt: { lt: retention },
            orderId: null,
            leadId: null,
            clientId: null,
          },
        },
      ],
    },
    take: 100,
  });
  for (const row of rows)
    await db.$transaction(
      async (tx) => {
        await schedulingLock(tx, "conversation", row.conversationId);
        const current = await tx.chatAttachment.findUnique({
          where: { id: row.id },
          include: { conversation: true },
        });
        if (!current) return;
        const c = current.conversation,
          orphan = !current.messageId && current.createdAt < before,
          expired =
            c.control === "CLOSED" &&
            !!c.closedAt &&
            c.closedAt < retention &&
            !c.orderId &&
            !c.leadId &&
            !c.clientId;
        if (!orphan && !expired) return;
        await storage.remove([current.storageKey, current.thumbnailKey]);
        await tx.chatAttachment.delete({ where: { id: row.id } });
      },
      { timeout: 20000 },
    );
  // Failed writes may never get a metadata row. Restrict list and deletions to this environment's namespace.
  if (storage instanceof PrivateBlobStorage) {
    const blobs = await list({ prefix: attachmentPrefix(), limit: 1000 });
    const linked = await db.chatAttachment.findMany({
      where: {
        OR: [
          { storageKey: { in: blobs.blobs.map((b) => b.pathname) } },
          { thumbnailKey: { in: blobs.blobs.map((b) => b.pathname) } },
        ],
      },
      select: { storageKey: true, thumbnailKey: true },
    });
    const retained = new Set(
      linked.flatMap((r) => [r.storageKey, r.thumbnailKey]),
    );
    for (const blob of blobs.blobs) {
      if (blob.uploadedAt >= before) continue;
      if (!retained.has(blob.pathname)) await storage.remove([blob.pathname]);
    }
  }
  return rows.length;
}
export async function messageImages(
  db: PrismaClient,
  messageId: string,
  conversationId: string,
  storage: ChatAttachmentStorage = new PrivateBlobStorage(),
) {
  const rows = await db.chatAttachment.findMany({
    where: { messageId, conversationId, processingStatus: "READY", mimeType: 'image/jpeg' },
    take: 4,
  });
  const images = [];
  for (const row of rows) {
    try {
      const bytes = await storage.read(row.storageKey);
      images.push({
        mimeType: "image/jpeg" as const,
        data: bytes.toString("base64"),
      });
    } catch {
      await db.chatAttachment.update({
        where: { id: row.id },
        data: { aiAnalysisStatus: "UNAVAILABLE" },
      });
    }
  }
  return { images, count: rows.length };
}
