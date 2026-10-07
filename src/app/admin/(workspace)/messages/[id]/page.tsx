import Link from "next/link";
import { Fragment } from "react";
import { Info } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { conversationData, inboxData } from "@/lib/agent/queries";
import { InboxList } from "@/components/admin/inbox-list";
import { InboxControls } from "@/components/admin/inbox-controls";
import { MessengerHistory } from "@/components/admin/messenger-history";
import { MessengerBubble } from "@/components/admin/messenger-bubble";
import { ShadowEvaluation } from "@/components/admin/ai-launch";
import { Drawer } from "@/components/admin/drawer";
import { date, money } from "@/components/admin/crm-view";
import { channelNames, daySeparator, groupedMessages, messageDay } from "@/lib/domain/messenger";
export const metadata = { title: "Диалог" };
export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ before?: string }> }) {
  await requireAdmin();
  const { id } = await params, { before } = await searchParams;
  const [data, list] = await Promise.all([conversationData(getDatabase(), id, before), inboxData(getDatabase())]);
  if (!data) notFound();
  const messages = data.messages.filter(message => message.customerVisible && message.deliveryStatus !== "CANCELLED");
  const handoff = data.handoffs.find(item => !item.resolved)?.reason;
  const context = <Drawer id={`context-${id}`} title="Клиент и заказ" icon={<Info size={21} />}>
    <section className="messenger-context"><h3>{data.name}</h3>{data.phone && <a href={`tel:${data.phone}`}>{data.phone}</a>}<p>{channelNames[data.channel]}</p>
      {data.client && <Link href={`/admin/clients/${data.client.id}`}>Карточка клиента и предыдущие заказы →</Link>}
      {data.order && <div className="messenger-order-context"><h3>{(data.order.historicalServiceLabel ?? data.order.service?.name ?? "Услуга не указана")}</h3><p>{date(data.order.scheduledStart)}</p><strong>{money(data.order.finalPrice, data.order.currency)}</strong><p>{data.order.address.fullAddress}</p><Link href={`/admin/orders/${data.order.id}`}>{data.order.reference} →</Link></div>}
      {data.lead && <details><summary>Заявка</summary><Link href={`/admin/leads/${data.lead.id}`}>Открыть заявку →</Link></details>}
      {data.handoffs.length > 0 && <details><summary>История передачи человеку</summary>{data.handoffs.map((item, index) => <p key={index}>{item.reason} · {item.resolved ? "решено" : "требует ответа"} · {date(new Date(item.date))}</p>)}</details>}
      <details><summary>Технические детали</summary><p>ID диалога: <code>{id}</code></p><p>{data.identityVerified ? "Личность подтверждена" : "Личность не подтверждена"} · {data.locale} · {data.stage} · {data.mode}</p>
        <details><summary>Доставка и вложения</summary>{data.messages.map(message => <div key={message.id}><p>{date(new Date(message.sentAt))} · {message.author} · {message.deliveryStatus}</p><p>ID: {message.id} · Provider ID: {message.providerId ?? "нет"}</p><p>Получено: {message.receivedAt ?? "нет"} · Отправлено: {message.providerSentAt ?? "нет"} · Обновлено: {message.deliveryUpdatedAt ?? "нет"}</p>{message.deliveredAt && <p>Доставлено: {message.deliveredAt}</p>}{message.readAt && <p>Прочитано: {message.readAt}</p>}{message.deliveryError && <code>{message.deliveryError}</code>}{message.replyTo && <p>Ответ на: {message.replyTo}</p>}{message.rejectedAttachments.map((item, index) => <p key={index}>{item.kind}: {item.status}</p>)}</div>)}</details>
        <details><summary>Системные события</summary>{data.messages.filter(message => message.author === "SYSTEM").map(message => <p key={message.id}>{message.text} · {message.deliveryStatus}</p>)}</details>
        <details><summary>Обработка и tools</summary>{data.jobs.map(job => <p key={job.id}>{job.status} · попыток {job.attempts} · {job.error ?? ""}</p>)}{data.traces.map(trace => <p key={trace.id}>{trace.tool} · {trace.outcome} · {trace.latency} ms {trace.shadow ? "SHADOW" : ""}</p>)}</details>
        <details><summary>Вызовы моделей</summary>{data.invocations.map(call => <p key={call.id}>{call.provider} / {call.model} · {call.input} → {call.output} tokens · {call.latency} ms · {call.cost ? `≈ $${call.cost}` : "Стоимость неизвестна"} · {call.success ? "OK" : call.error}</p>)}</details>
        {data.shadow && <details><summary>SHADOW: план и оценка</summary><ul>{data.shadow.plan.map((item, index) => <li key={index}>{item.tool} · {item.outcome}</li>)}</ul>{data.suggestion && <ShadowEvaluation id={id} suggestionId={data.suggestion.id} verdict={data.suggestion.verdict} savedReason={data.suggestion.reason} />}</details>}
      </details>
    </section>
  </Drawer>;
  return <div className="messenger-workspace messenger-conversation"><InboxList data={list} selected={id} compact /><InboxControls key={id} id={id} control={data.control} identityVerified={data.identityVerified} readThrough={data.messages.findLast(message => message.author === "CLIENT")?.id} name={data.name} channel={data.channel} handoff={handoff} context={context} orderSummary={data.order ? `${(data.order.historicalServiceLabel ?? data.order.service?.name ?? "Услуга не указана")} · ${date(data.order.scheduledStart)} · ${money(data.order.finalPrice,data.order.currency)} →` : undefined} shadow={data.shadow && data.suggestion?.verdict !== "REJECTED" ? { id: data.suggestion?.id ?? data.shadow.at, text: data.shadow.text } : undefined}>
    <MessengerHistory key={before ?? "latest"} latest={messages.at(-1)?.id} latestHref={`/admin/messages/${id}`} older={Boolean(before)}>{data.before && <Link className="messenger-older" href={`/admin/messages/${id}?before=${encodeURIComponent(data.before)}`}>Более ранние сообщения</Link>}{before && <Link className="messenger-older" href={`/admin/messages/${id}`}>Вернуться к последним сообщениям</Link>}{messages.length ? messages.map((message, index) => <Fragment key={message.id}>{(!messages[index - 1] || messageDay(messages[index - 1].sentAt) !== messageDay(message.sentAt)) && <div className="messenger-date">{daySeparator(message.sentAt)}</div>}<MessengerBubble message={message} grouped={groupedMessages(messages[index - 1], message)} alias={data.displayAlias} /></Fragment>) : <p className="messenger-empty">Сообщений пока нет</p>}</MessengerHistory>
  </InboxControls></div>;
}
