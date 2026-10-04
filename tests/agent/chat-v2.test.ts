import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { detectLocale, conversationPolicy } from "../../src/lib/agent/policy";
import {
  displayAliases,
  chooseAlias,
  quickReplies,
} from "../../src/lib/agent/chat-presentation";
import { publicInboundSchema, AgentError } from "../../src/lib/agent/contracts";
import {
  sanitizeImage,
  photoFactsConfirmed,
  photoQualificationAllowed,
  uploadAttachment,
  cleanupAttachments,
  type ChatAttachmentStorage,
} from "../../src/lib/agent/chat-attachments";
import {
  acceptMessage,
  publicConversation,
  runInboxCommand,
  startWebsiteConversation,
  scopedConversation,
} from "../../src/lib/agent/inbox";
import {
  claimJob,
  drainAgentJobs,
  runClaimedJob,
} from "../../src/lib/agent/runner";
import {
  normalizeCompletion,
  OpenRouterProvider,
  PoyoProvider,
  type AIProvider,
} from "../../src/lib/agent/providers";
import { pgConnectionString } from "../../src/lib/database/connection";

test("language follows meaningful text; ambiguous replies preserve all four locales", () => {
  for (const locale of ["ru", "sr-Latn", "sr-Cyrl", "en"])
    for (const text of ["OK", "Да", "Da", "Yes", "👍"])
      assert.equal(detectLocale(text, locale), locale);
  for (const text of [
    "zdravo",
    "cao",
    "moze",
    "hvala",
    "treba",
    "stan",
    "ciscenje",
    "koliko",
    "kada",
    "sutra",
    "danas",
    "dobro",
    "vazi",
  ])
    assert.equal(detectLocale(text, "ru"), "sr-Latn");
  assert.equal(detectLocale("Здраво, треба чишћење стана", "en"), "sr-Cyrl");
  assert.equal(detectLocale("Нужна уборка квартиры", "sr-Latn"), "ru");
  assert.equal(detectLocale("Hello, I need cleaning", "ru"), "en");
});
test("client cannot override locale or manufacture direct booking intent", () => {
  assert(
    publicInboundSchema.safeParse({
      action: "message",
      id: randomUUID(),
      text: "Hello",
    }).success,
  );
  assert(
    !publicInboundSchema.safeParse({
      action: "message",
      id: randomUUID(),
      text: "Hello",
      locale: "ru",
    }).success,
  );
  assert(
    !publicInboundSchema.safeParse({
      action: "message",
      id: randomUUID(),
      text: "",
      tool: "createOrder",
    }).success,
  );
});
test("alias pool never creates users and avoids the three recent names", () => {
  for (let i = 0; i < 30; i++) {
    const alias = chooseAlias(["Anna", "Sofia", "Mila"]);
    assert(displayAliases.includes(alias));
    assert(!["Anna", "Sofia", "Mila"].includes(alias));
  }
});
test("continuation policy addresses the supplied repeated acknowledgment", () => {
  assert(
    conversationPolicy("ru", {}, null).includes(
      "never repeat an already answered greeting",
    ),
  );
});
test("chips are allowlisted, state-bound and use only real slot tokens", () => {
  assert.deepEqual(
    quickReplies(
      "Загрязнения обычные или сильные?",
      {},
      "ru",
      "AI_CONTROL",
    ).map((q) => q.key),
    ["SOIL_NORMAL", "SOIL_HEAVY"],
  );
  assert.equal(
    quickReplies("Загрязнения обычные или сильные?", {}, "ru", "HUMAN_CONTROL")
      .length,
    0,
  );
  assert.equal(
    quickReplies("Выберите время?", {}, "ru", "AI_CONTROL").length,
    0,
  );
  const token = randomUUID();
  assert.equal(
    quickReplies(
      "Выберите время?",
      { slots: [{ token, start: new Date().toISOString(), duration: 150 }] },
      "ru",
      "AI_CONTROL",
    )[0].key,
    `SLOT:${token}`,
  );
});
test("image magic, size, decoded bounds and EXIF stripping", async () => {
  const jpeg = await sharp({
    create: { width: 120, height: 80, channels: 3, background: "#eee" },
  })
    .jpeg()
    .withExif({
      IFD0: {
        Copyright: "synthetic",
        ImageDescription: "GPS must not persist",
      },
    })
    .toBuffer();
  const result = await sanitizeImage(jpeg, "image/jpeg"),
    meta = await sharp(result.display).metadata();
  assert(!meta.exif);
  assert.equal(result.width, 120);
  assert.equal(result.height, 80);
  await assert.rejects(sanitizeImage(jpeg, "image/png"), /IMAGE_FORMAT/);
  await assert.rejects(
    sanitizeImage(Buffer.from("<svg/>"), "image/svg+xml"),
    /IMAGE_FORMAT/,
  );
  await assert.rejects(
    sanitizeImage(Buffer.alloc(8 * 1024 * 1024 + 1), "image/jpeg"),
    /IMAGE_SIZE/,
  );
});
test("vision serialization stays in providers and preserves native tool outputs", async () => {
  for (const Provider of [OpenRouterProvider, PoyoProvider]) {
    let wire: Record<string, unknown> = {};
    const p = new Provider("luna", "synthetic", async (_url, init) => {
      wire = JSON.parse(String(init?.body));
      return Response.json(
        Provider === PoyoProvider
          ? {
              status: "completed",
              output: [
                {
                  type: "function_call",
                  call_id: "native",
                  name: "getBusinessInfo",
                  arguments: "{}",
                },
              ],
            }
          : {
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        id: "native",
                        function: { name: "getBusinessInfo", arguments: "{}" },
                      },
                    ],
                  },
                },
              ],
            },
      );
    });
    const reply = await p.complete([
      {
        role: "user",
        content: "Photo",
        images: [{ mimeType: "image/jpeg", data: "synthetic-base64" }],
      },
      { role: "tool", toolCallId: "previous", content: "{}" },
    ]);
    assert.equal(reply.toolCalls[0].name, "getBusinessInfo");
    const serial = JSON.stringify(wire);
    assert(serial.includes("data:image/jpeg;base64,synthetic-base64"));
    assert(!serial.includes("storageKey"));
    assert(
      serial.includes(
        Provider === PoyoProvider ? "function_call_output" : "tool_call_id",
      ),
    );
  }
});

test("photo qualification requires explicit customer area and dirt facts",()=>{
 const input={service:"regular",area:60,soilLevel:"NORMAL",extras:[],urgent:false} as const;
 assert.equal(photoFactsConfirmed(["Фото кухни"],{...input,extras:[]}),false);
 assert.equal(photoFactsConfirmed(["60 квадратов","обычные"],{...input,extras:[]}),true);
 assert.equal(photoFactsConfirmed(["160 м²","обычные"],{...input,extras:[]}),false);
 assert.equal(photoFactsConfirmed(["50 м²","60 м²","обычные"],{...input,extras:[]}),false);
 assert.equal(photoFactsConfirmed(["60 m2","Normal dirt"],{...input,extras:[]}),true);
 assert.equal(photoFactsConfirmed(["сильные","обычные","60 м²"],{...input,extras:[]}),false);
});

const url = process.env.CHAT_V2_TEST_DATABASE_URL;
test(
  "Chat V2 real database safety and concurrency",
  { skip: !url },
  async (t) => {
    assert(new URL(url!).hostname.startsWith("ep-wispy-river-b8xwqy9q"));
    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: pgConnectionString(url!),
        max: 4,
      }),
    });
    const created: string[] = [],
      namespace = "chat-v2-test:" + randomUUID();
    const baseline = await db.businessSettings.findUniqueOrThrow({
      where: { id: "default" },
    });
    const orders = await db.order.count(),
      users = await db.user.count();
    const owner = await db.user.findFirstOrThrow({
      where: { role: "ADMIN", active: true },
    });
    const mock: AIProvider = {
      name: "synthetic",
      model: "gpt-6-luna",
      complete: async () =>
        normalizeCompletion(
          "synthetic",
          "gpt-6-luna",
          "chat",
          {
            choices: [
              { message: { content: "Загрязнения обычные или сильные?" } },
            ],
          },
          1,
          { input: 0.1, output: 0.5 },
        ),
    };
    const storage: ChatAttachmentStorage = {
      write: async () => {},
      read: async () => Buffer.alloc(0),
      remove: async () => {},
    };
    async function conversation() {
      const c = await db.conversation.create({
        data: {
          channel: "WEBSITE",
          externalThreadId: namespace + ":" + created.length,
          displayAlias: chooseAlias(),
          locale: "ru",
        },
      });
      created.push(c.id);
      return c;
    }
    async function inbound(text = "Здравствуйте") {
      const c = await conversation(),
        id = randomUUID();
      const result = await acceptMessage(db, c, { id, text });
      return { c, id, messageId: result.messageId };
    }
    try {
      await db.businessSettings.update({
        where: { id: "default" },
        data: {
          aiAgentMode: "AUTO",
          aiChannelModes: {
            WEBSITE: "AUTO",
            TELEGRAM: "OFF",
            WHATSAPP: "OFF",
            VIBER: "OFF",
          },
        },
      });
      await t.test("session auth is scoped and alias persists", async () => {
        const a = await startWebsiteConversation(db, "en", namespace);
        created.push(a.conversation.id);
        const first = await scopedConversation(db, a.token);
        assert.equal(first?.id, a.conversation.id);
        assert.equal(await scopedConversation(db, "0".repeat(64)), null);
        assert.equal(
          (await publicConversation(db, a.conversation)).displayAlias,
          first?.displayAlias,
        );
        assert.equal(await db.user.count(), users);
      });
      await t.test(
        "concurrent POST and network retry with same UUID store exactly one source",
        async () => {
          const c = await conversation(),
            id = randomUUID();
          const results = await Promise.all([
            acceptMessage(db, c, { id, text: "Hello" }),
            acceptMessage(db, c, { id, text: "Hello" }),
          ]);
          assert.equal(new Set(results.map((r) => r.messageId)).size, 1);
          assert.equal(
            await db.message.count({
              where: { conversationId: c.id, author: "CLIENT" },
            }),
            1,
          );
          assert.equal(
            await db.agentJob.count({ where: { conversationId: c.id } }),
            1,
          );
          assert.equal(
            (await db.conversation.findUniqueOrThrow({ where: { id: c.id } }))
              .locale,
            "en",
          );
        },
      );
      await t.test(
        "READ and typing derive from live RUNNING job, not pending timer",
        async () => {
          const { c, messageId } = await inbound();
          assert(!(await publicConversation(db, c)).typing);
          assert.equal(
            (await db.message.findUniqueOrThrow({ where: { id: messageId } }))
              .readAt,
            null,
          );
          const claim = await claimJob(db, c.id);
          assert(claim);
          assert((await publicConversation(db, c)).typing);
          assert(
            (await db.message.findUniqueOrThrow({ where: { id: messageId } }))
              .readAt,
          );
          await runClaimedJob(db, claim, [mock, mock]);
          assert(!(await publicConversation(db, c)).typing);
        },
      );
      await t.test(
        "parallel drains and concurrent public reads create one final response",
        async () => {
          const { c, messageId } = await inbound();
          await Promise.all([
            drainAgentJobs(db, c.id, [mock, mock]),
            drainAgentJobs(db, c.id, [mock, mock]),
            ...Array.from({ length: 4 }, () => publicConversation(db, c)),
          ]);
          assert.equal(
            await db.message.count({
              where: { responseToMessageId: messageId },
            }),
            1,
          );
        },
      );
      await t.test(
        "expired lease, repeated claim and new revision do not rerun completed source",
        async () => {
          const { c, messageId } = await inbound(),
            old = await claimJob(db, c.id);
          assert(old);
          await db.agentJob.update({
            where: { id: old.job.id },
            data: { leaseUntil: new Date(0) },
          });
          const fresh = await claimJob(db, c.id);
          assert(fresh);
          await Promise.all([
            runClaimedJob(db, old, [mock, mock]),
            runClaimedJob(db, fresh, [mock, mock]),
          ]);
          assert.equal(
            await db.message.count({
              where: { responseToMessageId: messageId },
            }),
            1,
          );
          await db.agentJob.update({
            where: { id: old.job.id },
            data: { status: "PENDING" },
          });
          await db.conversation.update({
            where: { id: c.id },
            data: { revision: { increment: 1 } },
          });
          assert.equal(await claimJob(db, c.id), null);
          assert.equal(
            await db.message.count({
              where: { responseToMessageId: messageId },
            }),
            1,
          );
        },
      );
      await t.test(
        "database rejects duplicate and cross-conversation response sources",
        async () => {
          const { c, messageId } = await inbound();
          await drainAgentJobs(db, c.id, [mock, mock]);
          await assert.rejects(
            db.message.create({
              data: {
                conversationId: c.id,
                author: "AI",
                text: "Duplicate",
                responseToMessageId: messageId,
              },
            }),
          );
          const other = await conversation();
          await assert.rejects(
            db.message.create({
              data: {
                conversationId: other.id,
                author: "AI",
                text: "Foreign",
                responseToMessageId: messageId,
              },
            }),
          );
        },
      );
      await t.test(
        "primary timeout then fallback stores one final response",
        async () => {
          const { c, messageId } = await inbound();
          const failed: AIProvider = {
            name: "poyo",
            model: "gpt-6-luna",
            complete: async () => {
              throw new AgentError("PROVIDER_TIMEOUT_OR_NETWORK");
            },
          };
          await drainAgentJobs(db, c.id, [failed, mock]);
          assert.equal(
            await db.message.count({
              where: { responseToMessageId: messageId },
            }),
            1,
          );
          assert.equal(
            await db.aIInvocation.count({
              where: { conversationId: c.id, success: false },
            }),
            1,
          );
        },
      );
      await t.test(
        "human typing expires, read receipt uses viewed cutoff, alias remains stable",
        async () => {
          const { c, messageId } = await inbound();
          await runInboxCommand(db, owner.id, { action: "takeover", id: c.id });
          await runInboxCommand(db, owner.id, {
            action: "typing",
            id: c.id,
            active: true,
          });
          assert((await publicConversation(db, c)).typing);
          await db.conversation.update({
            where: { id: c.id },
            data: { operatorTypingUntil: new Date(0) },
          });
          assert(!(await publicConversation(db, c)).typing);
          await runInboxCommand(db, owner.id, {
            action: "read",
            id: c.id,
            messageId,
          });
          assert(
            (await db.message.findUniqueOrThrow({ where: { id: messageId } }))
              .readAt,
          );
          const audit = await db.auditLog.count({
            where: { action: "INBOX_TYPING" },
          });
          assert.equal(audit, 0);
          await runInboxCommand(db, owner.id, {
            action: "reply",
            id: c.id,
            requestId: randomUUID(),
            text: "На связи",
          });
          assert.equal(
            (await publicConversation(db, c)).displayAlias,
            c.displayAlias,
          );
        },
      );
      await t.test(
        "quick reply stale revision, foreign source and repeated tap are safe",
        async () => {
          const { c } = await inbound();
          await drainAgentJobs(db, c.id, [mock, mock]);
          const snapshot = await publicConversation(db, c);
          assert(snapshot.quickReplies);
          const q = {
              key: "SOIL_NORMAL",
              messageId: snapshot.quickReplies.messageId,
              revision: snapshot.revision,
            },
            id = randomUUID();
          const first = await acceptMessage(db, c, {
            id,
            text: "ignored",
            quickReply: q,
          });
          await acceptMessage(db, c, { id, text: "ignored", quickReply: q });
          assert.equal(
            await db.message.count({ where: { id: first.messageId } }),
            1,
          );
          await assert.rejects(
            acceptMessage(db, c, {
              id: randomUUID(),
              text: "ignored",
              quickReply: q,
            }),
            /STALE_QUICK_REPLY/,
          );
        },
      );
      await t.test(
        "attachments are private metadata, scoped, idempotent and orphan cleanup only",
        async () => {
          const c = await conversation(),
            other = await conversation(),
            jpeg = await sharp({
              create: {
                width: 32,
                height: 24,
                channels: 3,
                background: "#eee",
              },
            })
              .jpeg()
              .toBuffer(),
            requestId = randomUUID();
          const a = await uploadAttachment(
            db,
            c.id,
            requestId,
            jpeg,
            "image/jpeg",
            "CLIENT",
            storage,
          );
          assert.equal(
            (
              await uploadAttachment(
                db,
                c.id,
                requestId,
                jpeg,
                "image/jpeg",
                "CLIENT",
                storage,
              )
            ).id,
            a.id,
          );
          await assert.rejects(
            acceptMessage(db, other, {
              id: randomUUID(),
              text: "",
              attachmentIds: [a.id],
            }),
            /INVALID_ATTACHMENTS/,
          );
          await acceptMessage(db, c, {
            id: randomUUID(),
            text: "",
            attachmentIds: [a.id],
          });
          const qualification={service:"regular",area:60,soilLevel:"NORMAL",extras:[],urgent:false} as const;
          assert.equal(await db.$transaction(tx=>photoQualificationAllowed(tx,c.id,{...qualification,extras:[]})),false);
          await acceptMessage(db,c,{id:randomUUID(),text:"60 квадратов, обычные загрязнения"});
          assert.equal(await db.$transaction(tx=>photoQualificationAllowed(tx,c.id,{...qualification,extras:[]})),true);
          const safe = JSON.stringify(await publicConversation(db, c));
          assert(!safe.includes(a.storageKey));
          assert(!safe.includes(a.sha256));
          const orphan = await uploadAttachment(
            db,
            other.id,
            randomUUID(),
            jpeg,
            "image/jpeg",
            "CLIENT",
            storage,
          );
          await db.chatAttachment.update({
            where: { id: orphan.id },
            data: { createdAt: new Date(Date.now() - 2 * 86400000) },
          });
          await cleanupAttachments(db, storage);
          assert.equal(
            await db.chatAttachment.findUnique({ where: { id: orphan.id } }),
            null,
          );
          assert(await db.chatAttachment.findUnique({ where: { id: a.id } }));
        },
      );
      await t.test("slot quick replies reject expired tokens and select without booking",async()=>{
        const c=await conversation(),start=new Date(Date.now()+86400000),token=randomUUID();
        await db.agentSlot.create({data:{id:token,conversationId:c.id,fingerprint:"synthetic",scheduleVersion:"synthetic",start,durationMinutes:180,requiredCleaners:2,cleanerIds:[],routingSnapshot:{},expiresAt:new Date(Date.now()-1000)}});
        await db.conversation.update({where:{id:c.id},data:{state:{slots:[{token,start:start.toISOString(),duration:180}]}}});
        const ai=await db.message.create({data:{conversationId:c.id,author:"AI",text:"Выберите время?"}});
        const input={id:randomUUID(),text:"",quickReply:{key:`SLOT:${token}`,messageId:ai.id,revision:0}};
        await assert.rejects(acceptMessage(db,c,input),/STALE_SLOT/);
        await db.agentSlot.update({where:{id:token},data:{expiresAt:new Date(Date.now()+60000)}});
        await acceptMessage(db,c,input);
        const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});
        assert.equal((current.state as {selectedSlotToken?:string}).selectedSlotToken,token);
        assert.equal(current.orderId,null);assert(!(current.state as {pending?:unknown}).pending);
      });
      await t.test("partial storage failure retries the same upload without duplicate metadata",async()=>{
        const c=await conversation(),requestId=randomUUID();
        const jpeg=await sharp({create:{width:8,height:8,channels:3,background:"white"}}).jpeg().toBuffer();
        let writes=0;const flaky={...storage,write:async()=>{if(++writes===2)throw Error("synthetic storage failure");}};
        await assert.rejects(uploadAttachment(db,c.id,requestId,jpeg,"image/jpeg","CLIENT",flaky));
        assert.equal(await db.chatAttachment.count({where:{conversationId:c.id}}),0);
        const result=await uploadAttachment(db,c.id,requestId,jpeg,"image/jpeg","CLIENT",flaky);
        assert(result.id);assert.equal(await db.chatAttachment.count({where:{conversationId:c.id}}),1);
      });
      await t.test("vision fallback stays selected for subsequent tool steps",async()=>{
        const {c}=await inbound("Фото"),claim=await claimJob(db,c.id);assert(claim);
        let primaryCalls=0,fallbackCalls=0;
        const primary={...mock,name:"primary",complete:async()=>{primaryCalls++;throw new AgentError("PROVIDER_TIMEOUT");}};
        const fallback={...mock,name:"fallback",complete:async()=>{
          fallbackCalls++;
          return normalizeCompletion("fallback","gpt-6-luna","chat",{choices:[{message:fallbackCalls===1?{content:"",tool_calls:[{id:"facts",type:"function",function:{name:"getBusinessInfo",arguments:"{}"}}]}:{content:"Какую уборку вы хотите?"}}]},1,{input:0.1,output:0.5});
        }};
        await runClaimedJob(db,claim,[primary,fallback],async()=>({images:[{mimeType:"image/jpeg",data:"synthetic"}],count:1}));
        assert.equal(primaryCalls,1);assert.equal(fallbackCalls,2);
        assert.equal(await db.message.count({where:{conversationId:c.id,author:"AI"}}),1);
      });
      await t.test(
        "both vision providers unavailable strip images and require a description",
        async () => {
          const { c } = await inbound("Фото"),
            claim = await claimJob(db, c.id);
          assert(claim);
          let failed = 0;
          const blind: AIProvider = {
            ...mock,
            complete: async (messages) => {
              if (messages.some((m) => m.images?.length)) {
                failed++;
                throw new AgentError("PROVIDER_HTTP_400");
              }
              assert(
                messages[0].content.includes(
                  "Never describe or claim to have seen any image",
                ),
              );
              return normalizeCompletion(
                "synthetic",
                "gpt-6-luna",
                "chat",
                {
                  choices: [
                    {
                      message: {
                        content:
                          "Не удалось просмотреть фото. Опишите, пожалуйста, поверхности.",
                      },
                    },
                  ],
                },
                1,
                { input: 0.1, output: 0.5 },
              );
            },
          };
          await runClaimedJob(db, claim, [blind, blind], async () => ({
            images: [{ mimeType: "image/jpeg", data: "synthetic" }],
            count: 1,
          }));
          assert.equal(failed, 2);
          assert.equal(
            await db.message.count({
              where: { conversationId: c.id, author: "AI" },
            }),
            1,
          );
          assert.equal(
            await db.agentToolTrace.count({
              where: { conversationId: c.id, tool: "createOrder" },
            }),
            0,
          );
        },
      );
      await t.test(
        "OFF does not process photos and SHADOW cannot send or mutate CRM",
        async () => {
          await db.businessSettings.update({
            where: { id: "default" },
            data: { aiAgentMode: "OFF" },
          });
          const off = await inbound("Фото");
          assert.equal(await claimJob(db, off.c.id), null);
          assert.equal(
            (
              await db.message.findUniqueOrThrow({
                where: { id: off.messageId },
              })
            ).readAt,
            null,
          );
          await db.businessSettings.update({
            where: { id: "default" },
            data: { aiAgentMode: "SHADOW" },
          });
          const shadow = await inbound("Фото"),
            claim = await claimJob(db, shadow.c.id);
          assert(claim);
          await runClaimedJob(db, claim, [mock, mock], async () => ({
            images: [{ mimeType: "image/jpeg", data: "synthetic" }],
            count: 1,
          }));
          assert.equal(
            await db.message.count({
              where: { conversationId: shadow.c.id, author: "AI" },
            }),
            0,
          );
          assert.equal(
            await db.shadowSuggestion.count({
              where: { conversationId: shadow.c.id },
            }),
            1,
          );
          assert.equal(
            (
              await db.conversation.findUniqueOrThrow({
                where: { id: shadow.c.id },
              })
            ).leadId,
            null,
          );
          await db.businessSettings.update({
            where: { id: "default" },
            data: { aiAgentMode: "AUTO" },
          });
        },
      );
      await t.test(
        "AUTO kill switch between model completion and persistence prevents response",
        async () => {
          const { c } = await inbound();
          const change: AIProvider = {
            ...mock,
            complete: async () => {
              await db.businessSettings.update({
                where: { id: "default" },
                data: { aiAgentMode: "SHADOW" },
              });
              return mock.complete([]);
            },
          };
          await drainAgentJobs(db, c.id, [change, mock]);
          assert.equal(
            await db.message.count({
              where: { conversationId: c.id, author: "AI" },
            }),
            0,
          );
          await db.businessSettings.update({
            where: { id: "default" },
            data: { aiAgentMode: "AUTO" },
          });
        },
      );
      assert.equal(await db.order.count(), orders);
    } finally {
      await db.businessSettings.update({
        where: { id: "default" },
        data: {
          aiAgentMode: baseline.aiAgentMode,
          aiChannelModes: baseline.aiChannelModes ?? {},
        },
      });
      await db.agentSlot.deleteMany({where:{conversationId:{in:created}}});
      await db.chatAttachment.deleteMany({
        where: { conversationId: { in: created } },
      });
      await db.notification.deleteMany({
        where: { conversationId: { in: created } },
      });
      await db.humanHandoff.deleteMany({
        where: { conversationId: { in: created } },
      });
      await db.agentToolTrace.deleteMany({
        where: { conversationId: { in: created } },
      });
      await db.aIInvocation.deleteMany({
        where: { conversationId: { in: created } },
      });
      await db.shadowSuggestion.deleteMany({
        where: { conversationId: { in: created } },
      });
      await db.agentJob.deleteMany({
        where: { conversationId: { in: created } },
      });
      await db.message.deleteMany({
        where: { conversationId: { in: created }, author: "AI" },
      });
      await db.message.deleteMany({
        where: { conversationId: { in: created } },
      });
      await db.rateLimit.deleteMany({where:{OR:created.flatMap(id=>["message","daily","upload","events"].map(scope=>({key:{startsWith:`agent:${scope}:${id}:`}})))}});
      await db.conversation.deleteMany({ where: { id: { in: created } } });
      await db.$disconnect();
    }
  },
);
