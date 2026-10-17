import Link from "next/link";
import type { Locale } from "@/i18n/routing";
import { getUpholsteryCatalog } from "@/lib/services/upholstery-catalog";
import { upholsteryPath, upholsteryUi } from "@/lib/upholstery-content";
import { formatRsd } from "@/lib/pricing";
import "./upholstery.css";
export async function UpholsteryTeaser({
  locale,
  extra = false,
}: {
  locale: Locale;
  extra?: boolean;
}) {
  const { catalog } = await getUpholsteryCatalog(),
    u = upholsteryUi[locale];
  return (
    <Link className="upholstery-teaser" href={upholsteryPath(locale)}>
      <div>
        <strong>
          {extra
            ? locale === "ru"
              ? "Локальная обработка пятна при уборке"
              : locale === "sr"
                ? "Lokalno tretiranje mrlje uz čišćenje"
                : "Local stain treatment with cleaning"
            : u.name}{" "}
          — {u.from}{" "}
          {formatRsd(extra ? catalog.spot : catalog.sofa3Normal, locale)}
        </strong>
        <small>
          {u.minimum}: {formatRsd(catalog.minimumVisit, locale)} · Kärcher
        </small>
      </div>
      <span>{u.estimate} →</span>
    </Link>
  );
}
