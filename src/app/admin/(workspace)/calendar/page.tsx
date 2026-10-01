import {
  getCalendarData,
  calendarQuery,
} from "@/lib/services/scheduling-queries";
import { CrmHeader } from "@/components/admin/crm-view";
import { SchedulingCalendar } from "@/components/admin/scheduling-calendar";
import { RoutingWorkspace } from "@/components/admin/routing-workspace";
import { scalar, type Query } from "@/lib/domain/crm-filters";
import { createHash } from "node:crypto";
export const metadata = { title: "Календарь" };
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams,
    input = {
      mode: scalar(query, "mode") || undefined,
      date: scalar(query, "date") || undefined,
      cleanerId: scalar(query, "cleanerId") || undefined,
    };
  const parsed = calendarQuery.safeParse(input),
    data = await getCalendarData(parsed.success ? parsed.data : {});
  return (
    <>
      <CrmHeader
        title="Календарь"
        subtitle="Расписание уборок и загрузка команды."
        action={{ href: "/admin/orders/new", label: "Создать заказ" }}
      />
      {!parsed.success && (
        <p role="alert">Некорректный фильтр. Показана текущая неделя.</p>
      )}
      <SchedulingCalendar
        key={createHash("sha256").update(JSON.stringify(data)).digest("hex")}
        initial={data}
      />
      <RoutingWorkspace
        key={data.date + data.cleanerId}
        date={data.date}
        cleanerId={data.cleanerId || undefined}
      />
    </>
  );
}
