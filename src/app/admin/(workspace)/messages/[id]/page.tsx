import Link from "next/link";
import { InboxList } from "@/components/admin/inbox-list";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { conversationData, inboxData } from "@/lib/agent/queries";
import { ShadowEvaluation } from "@/components/admin/ai-launch";
import { InboxControls } from "@/components/admin/inbox-controls";
import { CrmHeader } from "@/components/admin/crm-view";
import { ChatPhotos } from "@/components/site/chat-photos";
export const metadata = { title: "Диалог" };
export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  await requireAdmin();
  const { id } = await params,
    { before } = await searchParams,
    [data, listData] = await Promise.all([
      conversationData(getDatabase(), id, before),
      inboxData(getDatabase()),
    ]);
  if (!data) notFound();
  return (
    <>
      <Link className="admin-text-link" href="/admin/messages">
        ← Все диалоги
      </Link>
      <CrmHeader
        title={data.name}
        subtitle={`${data.channel} · ${data.locale} · ${data.control === "AI_CONTROL" ? "AI" : data.control === "CLOSED" ? "Закрыт" : "Человек"} · ${data.stage}`}
      />
      <div className="inbox-detail-grid">
        <InboxList data={listData} selected={id} compact />
        <section className="crm-section inbox-thread">
          <div className="inbox-links">
            {data.client && (
              <Link href={`/admin/clients/${data.client.id}`}>Клиент →</Link>
            )}
            {data.lead && (
              <Link href={`/admin/leads/${data.lead.id}`}>
                Заявка · {data.lead.status} →
              </Link>
            )}
            {data.order && (
              <Link href={`/admin/orders/${data.order.id}`}>
                {data.order.reference} · {data.order.status} →
              </Link>
            )}
          </div>
          {data.before && (
            <Link
              href={`/admin/messages/${id}?before=${encodeURIComponent(data.before)}`}
            >
              Более ранние сообщения →
            </Link>
          )}
          <div className="inbox-history">
            {data.messages.filter(m=>m.author!=='SYSTEM').map((m) => (
              <article
                key={m.id}
                className={`inbox-message inbox-message-${m.author.toLowerCase()}`}
              >
                <div>
                  <strong>
                    {m.author === "CLIENT"
                      ? "Клиент"
                      : m.author === "ADMIN" || m.author === "AI"
                        ? `${data.displayAlias} · LumaClean`
                        : "Система"}
                  </strong>
                  <time>
                    {new Intl.DateTimeFormat("ru-RU", {
                      timeZone: "Europe/Belgrade",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(m.sentAt))}
                  </time>
                </div>
                <p>{m.text}</p>
                {m.attachments.length > 0 && (
                  <><ChatPhotos photos={m.attachments.filter(a=>a.mimeType.startsWith('image/'))} label="Фото" />{m.attachments.filter(a=>!a.mimeType.startsWith('image/')).map(a=><a key={a.id} href={`/api/chat/attachments/${a.id}`} target="_blank" rel="noopener noreferrer">Документ · {Math.ceil(a.byteSize/1024)} КБ</a>)}</>
                )}
                {data.channel!=='WEBSITE'&&<details><summary>Доставка и вложения</summary><p>Provider ID: {m.providerId??'нет'} · Получено: {m.receivedAt??'нет'} · Отправлено: {m.providerSentAt??'нет'} · Статус обновлён: {m.deliveryUpdatedAt??'нет'}</p>{m.replyTo&&<p>Ответ на сообщение: {m.replyTo}</p>}{m.deliveredAt&&<p>Доставлено: {m.deliveredAt}</p>}{m.readAt&&m.author!=='CLIENT'&&<p>Прочитано: {m.readAt}</p>}{m.rejectedAttachments.map((a,i)=><p key={i}>Вложение {a.kind}: {a.status}</p>)}</details>}
                {(data.channel!=='WEBSITE'||m.deliveryStatus !== "DELIVERED") && (
                  <small>
                    Доставка: {m.deliveryStatus} {m.deliveryError ?? ""}
                  </small>
                )}
              </article>
            ))}
          </div>
          <details><summary>Системные сообщения</summary>{data.messages.filter(m=>m.author==='SYSTEM').map(m=><p key={m.id}>{m.text} · {m.deliveryStatus}</p>)}</details>
          {data.shadow && (
            <aside className="inbox-shadow">
              <div className="admin-eyebrow">
                SHADOW · клиенту не отправлено
              </div>
              <h2>AI предложил</h2>
              <p>{data.shadow.text}</p>
              <ul>
                {data.shadow.plan.map((p, i) => (
                  <li key={i}>
                    {p.tool} · {p.outcome}
                  </li>
                ))}
              </ul>
              {data.suggestion && (
                <ShadowEvaluation
                  id={id}
                  suggestionId={data.suggestion.id}
                  verdict={data.suggestion.verdict}
                  savedReason={data.suggestion.reason}
                />
              )}
            </aside>
          )}
          <InboxControls
            id={id}
            control={data.control}
            identityVerified={data.identityVerified}
            readThrough={
              data.messages.findLast((m) => m.author === "CLIENT")?.id
            }
          />
        </section>
        <aside className="crm-section inbox-context">
          <h2>Контекст</h2>
          <p>{data.phone ?? "Контакт ещё уточняется"}</p>
          <p className="crm-hint">
            {data.identityVerified
              ? "Клиент подтверждён"
              : "Личность не подтверждена"}
          </p>
          <h3>Передача человеку</h3>
          {data.handoffs.length ? (
            data.handoffs.map((h, i) => (
              <p key={i}>
                {h.reason} · {h.resolved ? "решено" : "требует ответа"}
              </p>
            ))
          ) : (
            <p className="crm-hint">Передач пока нет</p>
          )}
          <details>
            <summary>Обработка и tools</summary>
            {data.jobs.map((j) => (
              <p key={j.id}>
                {j.status} · попыток {j.attempts} {j.error ?? ""}
              </p>
            ))}
            {data.traces.map((t) => (
              <p key={t.id}>
                {t.tool} · {t.outcome} · {t.latency} ms{" "}
                {t.shadow ? "SHADOW" : ""}
              </p>
            ))}
          </details>
          <details>
            <summary>Вызовы моделей</summary>
            {data.invocations.map((i) => (
              <p key={i.id}>
                {i.provider} / {i.model}
                <br />
                {i.input} → {i.output} tokens · {i.latency} ms
                <br />
                {i.cost ? `≈ $${i.cost}` : "Стоимость неизвестна"} ·{" "}
                {i.success ? "OK" : i.error}
              </p>
            ))}
          </details>
        </aside>
      </div>
    </>
  );
}
