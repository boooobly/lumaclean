import { Check, CheckCheck, Clock, CircleAlert, FileText } from "lucide-react";
import { ChatPhotos } from "@/components/site/chat-photos";
import type { conversationData } from "@/lib/agent/queries";
import { deliveryNames } from "@/lib/domain/messenger";

type Message = NonNullable<Awaited<ReturnType<typeof conversationData>>>["messages"][number];
export function MessengerBubble({ message, grouped, alias }: { message: Message; grouped: boolean; alias: string }) {
  const outgoing = message.author !== "CLIENT", failed = ["FAILED", "REJECTED", "UNKNOWN"].includes(message.deliveryStatus);
  const Status = failed ? CircleAlert : message.deliveryStatus === "READ" || message.deliveryStatus === "DELIVERED" ? CheckCheck : message.deliveryStatus === "SENT" ? Check : Clock;
  return <article className={`messenger-message ${outgoing ? "is-outgoing" : "is-incoming"} ${grouped ? "is-grouped" : ""}`} aria-label={outgoing ? "Сообщение LumaClean" : "Сообщение клиента"}>
    {!grouped && <span className="messenger-author">{message.author === "CLIENT" ? "Клиент" : message.author === "ADMIN" ? "Вы" : message.author === "SYSTEM" ? "LumaClean" : `AI · ${alias}`}</span>}
    <div className="messenger-bubble">{message.text && message.text !== "[Вложение]" && <p>{message.text}</p>}
      {message.attachments.length > 0 && <><ChatPhotos photos={message.attachments.filter(item => item.mimeType.startsWith("image/"))} label="Фото" />{message.attachments.filter(item => !item.mimeType.startsWith("image/")).map(item => <a className="messenger-attachment" key={item.id} href={`/api/chat/attachments/${item.id}`} target="_blank" rel="noopener noreferrer"><FileText size={22} /><span>{item.mimeType === "application/pdf" ? "PDF-документ" : "Документ"}<small>{Math.ceil(item.byteSize / 1024)} КБ</small></span></a>)}</>}
      <footer><time dateTime={message.sentAt}>{new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit" }).format(new Date(message.sentAt))}</time>{outgoing && <span className={`messenger-delivery ${failed ? "is-failed" : ""}`} title={deliveryNames[message.deliveryStatus] ?? "Статус уточняется"} aria-label={deliveryNames[message.deliveryStatus] ?? "Статус уточняется"}><Status size={14} />{failed && deliveryNames[message.deliveryStatus]}</span>}</footer>
    </div>
  </article>;
}
