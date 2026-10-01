import {InboxList} from "@/components/admin/inbox-list";
import {requireAdmin} from "@/lib/auth/session";
import {getDatabase} from "@/lib/database/client";
import {inboxData,inboxFilters} from "@/lib/agent/queries";
import {AgentModeControl} from "@/components/admin/inbox-controls";
import {CrmHeader} from "@/components/admin/crm-view";
export const metadata={title:"Сообщения"};
export default async function Messages({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  await requireAdmin();const params=await searchParams,filter=inboxFilters.includes(params.filter as typeof inboxFilters[number])?params.filter as typeof inboxFilters[number]:"ALL",data=await inboxData(getDatabase(),filter,params.before);
  return <><CrmHeader title="Сообщения" subtitle="Website и Telegram · единая история, передача человеку и контроль AI."/><AgentModeControl mode={data.mode} enabled={data.enabled}/><div className="inbox-channel-note"><span>Website · подключён</span><span>Telegram · {data.telegram?"customer bot настроен":"ожидает отдельный customer bot"}</span><span>Требуют ответа: {data.attention}</span></div><div className="inbox-panel-grid"><InboxList data={data} filter={filter}/><section className="crm-section inbox-start"><div className="admin-eyebrow">LumaClean / Inbox</div><h2>Каждый диалог — в своём контексте.</h2><p>Выберите разговор слева. Здесь появятся переписка, предложение AI и действия администратора.</p><p className="crm-hint">В SHADOW предложение остаётся внутри Inbox. Для ответа клиенту перехватите диалог.</p></section></div></>;
}
