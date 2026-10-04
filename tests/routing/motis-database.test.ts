import test from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { pgConnectionString } from "../../src/lib/database/connection";
import { RoutingService } from "../../src/lib/services/route-cache";
import { MotisRoutingProvider } from "../../src/lib/infrastructure/motis-routing";
const url = process.env.ADMIN_TEST_DATABASE_URL;
test(
  "real Railway routing persists and reuses RouteCalculation; transaction leaves no fixture",
  { skip: !url || !process.env.LUMACLEAN_ROUTING_TOKEN },
  async () => {
    if (
      new URL(url!).hostname !==
      "ep-lively-mountain-b8x8hoxw-pooler.c-14.us-east-1.aws.neon.tech"
    )
      throw Error("ISOLATED_VERIFICATION_BRANCH_REQUIRED");
    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: pgConnectionString(url!),
        max: 2,
      }),
    });
    const rollback = Error("ROLLBACK_VERIFICATION");
    try {
      const before = await db.routeCalculation.count();
      let calls = 0;
      await assert.rejects(
        db.$transaction(
          async (tx) => {
            const http: typeof fetch = async (url, init) => {
              if (String(url).endsWith("/matrix")) calls++;
              return fetch(url, init);
            };
            const service = new RoutingService(
              tx,
              new MotisRoutingProvider(
                process.env.LUMACLEAN_ROUTING_URL,
                process.env.LUMACLEAN_ROUTING_TOKEN,
                http,
              ),
            );
            const r = {
              origin: { latitude: 44.8125, longitude: 20.4612 },
              destination: { latitude: 44.815, longitude: 20.46 },
              mode: "TRANSIT" as const,
              at: new Date(Date.now() + 3 * 86400000).toISOString(),
            };
            const first = await service.getTravelTime(r),
              second = await service.getTravelTime(r);
            assert.equal(first.quality, "WALKING");
            assert.equal(second.quality, first.quality);
            assert.equal(second.durationSeconds, first.durationSeconds);
            assert.equal(calls, 1);
            assert.equal(await tx.routeCalculation.count(), before + 1);
            throw rollback;
          },
          { timeout: 30000 },
        ),
        (e) => e === rollback,
      );
      assert.equal(await db.routeCalculation.count(), before);
    } finally {
      await db.$disconnect();
    }
  },
);
