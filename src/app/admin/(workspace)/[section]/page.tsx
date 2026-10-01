import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { adminSections } from "@/lib/domain/admin-navigation";
import { getDatabase } from "@/lib/database/client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return {
    title:
      adminSections.find((item) => item.slug === section)?.label ||
      "Раздел не найден",
  };
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  await requireAdmin();
  const { section } = await params;
  const index = adminSections.findIndex((item) => item.slug === section);
  if (index < 0) notFound();
  const item = adminSections[index];
  const settings =
    section === "settings"
      ? await getDatabase().businessSettings.findUniqueOrThrow({
          where: { id: "default" },
        })
      : null;
  return (
    <>
      <header className="admin-page-header">
        <div className="admin-eyebrow">
          {String(index + 2).padStart(2, "0")} / {item.eyebrow}
        </div>
        <h1>{item.label}</h1>
        <p className="admin-intro">{item.title}</p>
      </header>
      {settings ? (
        <section className="admin-settings" aria-label="Текущие настройки">
          <h2>Основные правила</h2>
          <dl>
            <div>
              <dt>Часовой пояс</dt>
              <dd>{settings.timezone}</dd>
            </div>
            <div>
              <dt>Транспортный буфер</dt>
              <dd>{settings.defaultTravelBufferMinutes} минут</dd>
            </div>
            <div>
              <dt>Процент выплаты по умолчанию</dt>
              <dd>
                {settings.defaultCleanerPayoutPercent?.toString() ?? "Не задан"}
              </dd>
            </div>
            <div>
              <dt>Валюта</dt>
              <dd>{settings.currency}</dd>
            </div>
          </dl>
          <p>Редактирование правил появится на следующем этапе.</p>
        </section>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-table">
            <caption>{item.label} · структура будущего реестра</caption>
            <thead>
              <tr>
                {item.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={item.columns.length}>
                  <div className="admin-empty">
                    <span className="admin-empty-mark" aria-hidden="true">
                      └
                    </span>
                    <h2>Работа начнётся здесь</h2>
                    <p>{item.description}</p>
                    <span className="admin-status">Следующий этап</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="admin-footnote">
        LumaClean · {item.label}
        <span>Рабочее пространство развивается поэтапно</span>
      </div>
    </>
  );
}
