import { InboxList } from "@/components/admin/inbox-list";
import { requireAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { inboxData, inboxFilters } from "@/lib/agent/queries";
import { AgentModeControl } from "@/components/admin/inbox-controls";
import { DisclosureSection } from "@/components/admin/disclosure";
export const metadata = { title: "Сообщения" };
export default async function Messages({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams, filter = inboxFilters.includes(params.filter as typeof inboxFilters[number]) ? params.filter as typeof inboxFilters[number] : "ALL", data = await inboxData(getDatabase(), filter, params.before);
  return <div className="messenger-index"><header className="messenger-index-header"><h1>Сообщения</h1><span>{data.attention > 0 ? `${data.attention} требуют ответа` : "Все диалоги обработаны"}</span></header><div className="messenger-workspace messenger-list-workspace"><InboxList data={data} filter={filter} /><section className="messenger-start"><h2>Выберите диалог</h2><p>Переписка и ответ клиенту — здесь.</p></section></div><DisclosureSection title={`Управление AI · ${data.mode}`}><AgentModeControl mode={data.mode} enabled={data.enabled} /></DisclosureSection></div>;
}
