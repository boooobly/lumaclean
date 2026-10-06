import { DisclosureSection } from "./disclosure";
import { stateOf } from "@/lib/agent/tools";
import { channelNames, handoffNames } from "@/lib/domain/messenger";
import Link from "next/link";
import {getDatabase} from "@/lib/database/client";
export async function AIInboxSummary(){
  const db=getDatabase(),[count,rows]=await Promise.all([db.conversation.count({where:{needsAttention:true,control:{not:"CLOSED"}}}),db.conversation.findMany({where:{needsAttention:true,control:{not:"CLOSED"}},take:5,orderBy:{lastMessageAt:"desc"},include:{client:{select:{name:true}},order:{select:{reference:true}},handoffs:{where:{resolvedAt:null},take:1}}})]);
  const notifications=await db.notification.findMany({where:{audience:"ADMIN"},orderBy:{createdAt:"desc"},take:5});
  return <section className="crm-section"><div className="admin-section-heading"><h2>Сообщения · нужен ответ: {count}</h2><Link href="/admin/messages?filter=HANDOFF">Inbox →</Link></div>{rows.length?<ul className="crm-linked-list">{rows.map(c=><li key={c.id}><Link href={`/admin/messages/${c.id}`}>{c.client?.name??stateOf(c).name??stateOf(c).phone??"Новый диалог"}<small>{c.order?`AI-запись · ${c.order.reference}`:c.handoffs[0]?`Передача человеку · ${handoffNames[c.handoffs[0].reason]??"нужно уточнение"}`:c.shadowProposal?"AI предложил ответ · SHADOW":"Клиент ожидает ответа"} · {channelNames[c.channel]??c.channel}</small></Link></li>)}</ul>:<p className="crm-hint">Все диалоги обработаны.</p>}{notifications.length>0&&<DisclosureSection title="Уведомления"><ul className="crm-linked-list">{notifications.map(n=><li key={n.id}><Link href={n.orderId?`/admin/orders/${n.orderId}`:n.conversationId?`/admin/messages/${n.conversationId}`:"/admin/messages"}>{n.text}</Link></li>)}</ul></DisclosureSection>}</section>;
}

