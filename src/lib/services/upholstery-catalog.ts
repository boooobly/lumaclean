import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { getDatabase } from "@/lib/database/client";
import { upholsteryCatalogSchema, upholsteryDefaults } from "@/lib/upholstery";
export const getUpholsteryCatalog = cache(
  async function getUpholsteryCatalog() {
    await connection();
    if (!process.env.DATABASE_URL) {
      if (process.env.VERCEL_ENV === "production")
        throw Error("Pricing database required");
      return { catalog: upholsteryDefaults, version: 1, extractorQuantity: 1 };
    }
    const settings = await getDatabase().upholsterySettings.findUniqueOrThrow({
      where: { id: "default" },
    });
    return {
      catalog: upholsteryCatalogSchema.parse(settings.catalog),
      version: settings.version,
      extractorQuantity: settings.extractorQuantity,
    };
  },
);
