import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { extrasPrices, priceMatrix, serviceIds } from "../src/lib/pricing";

loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});
const names = {
  regular: "Поддерживающая уборка",
  deep: "Генеральная уборка",
  move: "Въезд / выезд",
  airbnb: "Airbnb",
  office: "Уборка офиса",
};
const extraNames = {
  standardWindow: "Стандартное окно",
  largeWindow: "Большое окно",
  balcony: "Балкон",
  fridge: "Холодильник",
  oven: "Духовка",
  cabinets: "Шкафы",
  ironing: "Глажка",
  steam: "Паровая обработка",
  linen: "Смена белья",
  petHair: "Шерсть животных",
};

async function seed() {
  await db.$transaction(async (tx) => {
    await tx.businessSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
    for (const code of serviceIds) {
      const service = await tx.service.upsert({
        where: { code },
        create: { code, name: names[code] },
        update: {},
      });
      for (let band = 0; band < 5; band++) {
        const id = `initial-price-${code}-${band}`;
        await tx.servicePriceBand.upsert({
          where: { id },
          update: {},
          create: {
            id,
            serviceId: service.id,
            minArea: [0, 40, 60, 80, 100][band],
            maxArea: [40, 60, 80, 100, null][band],
            fixedPrice: band < 4 ? priceMatrix[code][band] : null,
            pricePerSquare: band === 4 ? priceMatrix[code][band] : null,
            validFrom: new Date("2026-10-01T00:00:00Z"),
          },
        });
      }
    }
    for (const [code, unitPrice] of Object.entries(extrasPrices)) {
      await tx.serviceExtra.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: extraNames[code as keyof typeof extraNames],
          unit: ["standardWindow", "largeWindow", "cabinets"].includes(code)
            ? "item"
            : code === "ironing"
              ? "hour"
              : "service",
          unitPrice,
        },
      });
    }
  }, { maxWait: 10_000, timeout: 60_000 });
  console.log(
    "Business settings and service catalogue prepared. No clients, orders or duration formulas seeded.",
  );
}

seed()
  .catch(() => {
    console.error("Seed failed. Check database configuration and migrations.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
