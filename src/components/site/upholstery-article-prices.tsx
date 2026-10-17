import type { Locale } from "@/i18n/routing";
import { getUpholsteryCatalog } from "@/lib/services/upholstery-catalog";
import { calculateUpholstery, upholsteryPublicPriceKeys, upholsteryPublicPrice } from "@/lib/upholstery";
import { upholsteryUi } from "@/lib/upholstery-content";
import { formatRsd } from "@/lib/pricing";
import { ArticleDataTable } from "./article-data-table";
export async function UpholsteryArticlePrices({ locale }: { locale: Locale }) {
  const { catalog, version } = await getUpholsteryCatalog(),
    u = upholsteryUi[locale];
  const rows = (
    [
      ["ADDON", "SPOT", "NORMAL"],
      ["ADDON", "SOFA3", "NORMAL"],
      ["STANDALONE", "SOFA3", "NORMAL"],
      ["STANDALONE", "SOFA3", "LIGHT"],
    ] as const
  ).map(([mode, type, soil]) => {
    const q = calculateUpholstery(
      {
        mode,
        items: [
          {
            type,
            soil,
            quantity: 1,
            fabric: "WET_COMPATIBLE",
            size: "standard",
            material: "",
            notes: "",
          },
        ],
        urgent: false,
        ...(mode === "ADDON"
          ? { cleaning: { service: "regular" as const, area: 55 } }
          : {}),
      },
      catalog,
      version,
    );
    return [
      `${mode === "ADDON" ? `${u.cleaning} 55 m² + ` : ""}${u.types[type]} · ${u.soils[soil]}`,
      formatRsd(q.cleaningBase, locale),
      formatRsd(q.itemsSubtotal, locale),
      formatRsd(q.minimumAdjustment, locale),
      formatRsd(q.total, locale),
    ];
  });
  return (
    <>
      <ArticleDataTable
        table={{
          caption: u.prices,
          headings: [u.item, "RSD"],
          rows: upholsteryPublicPriceKeys.map((k) => [
            k === "cornerSeat" ? u.cornerBaseLabel : u.catalogLabels[k],
            `${k !== "minimumVisit" ? `${u.from} ` : ""}${formatRsd(upholsteryPublicPrice(catalog, k), locale)}`,
          ]),
        }}
      />
      <ArticleDataTable
        table={{
          caption: u.total,
          headings: [
            u.item,
            u.cleaning,
            u.itemsTotal,
            u.minimumAdjustment,
            "RSD",
          ],
          rows,
        }}
      />
    </>
  );
}
