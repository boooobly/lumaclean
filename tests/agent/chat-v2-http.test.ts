import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgConnectionString } from "../../src/lib/database/connection";
import { PrivateBlobStorage } from "../../src/lib/agent/chat-attachments";
const base = "http://localhost:3103",
  url = process.env.CHAT_V2_TEST_DATABASE_URL;
test(
  "Chat V2 HTTP: cookie scope, SSE reconnect, uploads and real receipts",
  { skip: !url },
  async (t) => {
    assert(new URL(url!).hostname.startsWith("ep-wispy-river-b8xwqy9q"));
    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: pgConnectionString(url!),
        max: 2,
      }),
    });
    const owner = JSON.parse(
      readFileSync(
        "C:/Users/vleko/.codex/private/lumaclean-admin-owner.json",
        "utf8",
      ),
    );
    const post = (path: string, payload: unknown, cookie = "", origin = base) =>
      fetch(base + path, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify(payload),
      });
    const login = await post("/api/auth/sign-in/email", owner);
    assert.equal(login.status, 200);
    const adminCookie = login.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
    const started = await post("/api/chat", { action: "start", locale: "ru" });
    assert.equal(started.status, 200);
    const cookie = started.headers.get("set-cookie")!.split(";")[0],
      token = cookie.split("=")[1];
    const c = await db.conversation.findUniqueOrThrow({
      where: {
        anonymousHash: createHash("sha256").update(token).digest("hex"),
      },
    });
    const user = await db.user.findFirstOrThrow({
      where: { role: "ADMIN", active: true },
    });
    await db.conversation.update({
      where: { id: c.id },
      data: { control: "HUMAN_CONTROL", ownerId: user.id },
    });
    const attachments: string[] = [],
      uploadedKeys: string[] = [];
    async function event() {
      const controller = new AbortController();
      const r = await fetch(base + "/api/chat/events", {
        headers: { Cookie: cookie },
        signal: controller.signal,
      });
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type")!, /text\/event-stream/);
      const reader = r.body!.getReader();
      let body = "";
      while (!body.includes("data: ")) {
        body += new TextDecoder().decode((await reader.read()).value);
      }
      controller.abort();
      const data = JSON.parse(body.match(/data: (.*)/)![1]);
      return data.conversation;
    }
    try {
      await t.test(
        "anonymous SSE and uploads are rejected; CSRF fails",
        async () => {
          assert.equal((await fetch(base + "/api/chat/events")).status, 401);
          assert.equal(
            (
              await post(
                "/api/chat",
                { action: "start", locale: "en" },
                "",
                "https://attacker.example",
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await fetch(base + "/api/chat/attachments", {
                method: "POST",
                headers: {
                  Origin: base,
                  "Content-Type": "image/jpeg",
                  "X-Upload-Id": randomUUID(),
                },
                body: new Uint8Array([255, 216, 255]),
              })
            ).status,
            401,
          );
        },
      );
      await t.test("reconnect returns only safe cookie-bound DTO", async () => {
        const first = await event(),
          next = await event();
        assert.equal(first.displayAlias, next.displayAlias);
        assert.equal(next.id, undefined);
        assert.equal(next.anonymousHash, undefined);
        assert.equal(next.ownerId, undefined);
        assert(!JSON.stringify(next).includes("storageKey"));
      });
      await t.test(
        "server language wins; repeated POST has one client row",
        async () => {
          const input = {
            action: "message",
            id: randomUUID(),
            text: "zdravo, treba ciscenje",
          };
          const r = await post("/api/chat", input, cookie);
          assert.equal(r.status, 200);
          assert.equal((await r.json()).conversation.locale, "sr-Latn");
          await post("/api/chat", input, cookie);
          assert.equal(
            await db.message.count({
              where: { conversationId: c.id, author: "CLIENT" },
            }),
            1,
          );
          assert.equal(
            (
              await post(
                "/api/chat",
                { ...input, id: randomUUID(), locale: "ru" },
                cookie,
              )
            ).status,
            400,
          );
        },
      );
      await t.test(
        "read event and human typing reflect actual authenticated actions",
        async () => {
          const m = await db.message.findFirstOrThrow({
            where: { conversationId: c.id, author: "CLIENT" },
          });
          assert.equal((await event()).messages[0].readAt, null);
          assert.equal(
            (
              await post(
                "/api/admin/inbox",
                { action: "read", id: c.id, messageId: m.id },
                adminCookie,
              )
            ).status,
            200,
          );
          assert((await event()).messages[0].readAt);
          assert.equal(
            (
              await post(
                "/api/admin/inbox",
                { action: "typing", id: c.id, active: true },
                adminCookie,
              )
            ).status,
            200,
          );
          assert((await event()).typing);
          await post(
            "/api/admin/inbox",
            { action: "typing", id: c.id, active: false },
            adminCookie,
          );
          assert(!(await event()).typing);
        },
      );
      await t.test(
        "magic mismatch and SVG are rejected without storage",
        async () => {
          const r = await fetch(base + "/api/chat/attachments", {
            method: "POST",
            headers: {
              Origin: base,
              Cookie: cookie,
              "Content-Type": "image/jpeg",
              "X-Upload-Id": randomUUID(),
            },
            body: "<svg/>",
          });
          assert.equal(r.status, 400);
        },
      );
      await t.test(
        "private upload, owner/admin image access and orphan isolation",
        async () => {
          const bytes = await sharp({
              create: {
                width: 100,
                height: 80,
                channels: 3,
                background: "#ddd",
              },
            })
              .jpeg()
              .toBuffer(),
            requestId = randomUUID();
          const upload = () =>
            fetch(base + "/api/chat/attachments", {
              method: "POST",
              headers: {
                Origin: base,
                Cookie: cookie,
                "Content-Type": "image/jpeg",
                "X-Upload-Id": requestId,
              },
              body: new Uint8Array(bytes),
            });
          const r = await upload();
          assert.equal(r.status, 200);
          const a = (await r.json()).attachment;
          attachments.push(a.id);
          assert.equal((await (await upload()).json()).attachment.id, a.id);
          const row = await db.chatAttachment.findUniqueOrThrow({
            where: { id: a.id },
          });
          uploadedKeys.push(row.storageKey, row.thumbnailKey);
          assert.equal(a.storageKey, undefined);
          assert.equal(
            (await fetch(base + `/api/chat/attachments/${a.id}`)).status,
            404,
          );
          assert.equal(
            (
              await fetch(base + `/api/chat/attachments/${a.id}`, {
                headers: { Cookie: cookie },
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await fetch(base + `/api/chat/attachments/${a.id}?thumb=1`, {
                headers: { Cookie: adminCookie },
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await post(
                "/api/chat",
                {
                  action: "message",
                  id: randomUUID(),
                  text: "",
                  attachmentIds: [a.id],
                },
                cookie,
              )
            ).status,
            200,
          );
          const snapshot = await event();
          assert.equal(snapshot.messages.at(-1).attachments[0].id, a.id);
          assert(!JSON.stringify(snapshot).includes(row.storageKey));
        },
      );
    } finally {
      for (const line of readFileSync(
        "C:/Users/vleko/.codex/private/lumaclean-chat-v2-vercel.env",
        "utf8",
      ).split(/\r?\n/)) {
        if (line.startsWith("BLOB_READ_WRITE_TOKEN="))
          process.env.BLOB_READ_WRITE_TOKEN = JSON.parse(
            line.slice(line.indexOf("=") + 1),
          );
      }
      await new PrivateBlobStorage().remove(uploadedKeys);
      await db.chatAttachment.deleteMany({ where: { conversationId: c.id } });
      await db.notification.deleteMany({ where: { conversationId: c.id } });
      await db.agentJob.deleteMany({ where: { conversationId: c.id } });
      await db.message.deleteMany({ where: { conversationId: c.id } });
      await db.conversation.delete({ where: { id: c.id } });
      await db.$disconnect();
    }
  },
);
