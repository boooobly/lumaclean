"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, SlidersHorizontal, MessageCircle, Globe, Send, Phone, AlertCircle } from "lucide-react";
import type { inboxData } from "@/lib/agent/queries";
import { channelNames, initials, matchesConversation } from "@/lib/domain/messenger";
import { Drawer } from "./drawer";

const filters = { ALL: "Все", UNREAD: "Непрочитанные", HANDOFF: "Нужен ответ", TRANSFERRED: "Handoff", HUMAN: "У оператора", UNREVIEWED: "SHADOW · не оценены", AI: "AI", CLOSED: "Закрытые", WEBSITE: "Сайт", TELEGRAM: "Telegram", WHATSAPP: "WhatsApp", VIBER: "Viber" };
const channelIcons = { WEBSITE: Globe, WHATSAPP: MessageCircle, TELEGRAM: Send, VIBER: Phone };
export function InboxList({ data, filter = "ALL", selected, compact = false }: { data: Awaited<ReturnType<typeof inboxData>>; filter?: string; selected?: string; compact?: boolean }) {
  const [search, setSearch] = useState(""), [searchOpen, setSearchOpen] = useState(false);
  const rows = data.rows.filter(row => matchesConversation(row, search));
  return <aside className={`inbox-sidebar ${compact ? "inbox-sidebar-compact" : ""}`} aria-label="Список диалогов">
    <div className="inbox-list-toolbar"><strong>Диалоги</strong><button className="admin-icon-button inbox-search-toggle" type="button" aria-label="Поиск диалогов" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)}><Search size={20} /></button>
      <Drawer title="Фильтры диалогов" icon={<SlidersHorizontal size={20} />}><nav className="admin-more-links">{Object.entries(filters).map(([key, label]) => <Link key={key} href={`/admin/messages?filter=${key}`} aria-current={filter === key ? "page" : undefined}>{label}</Link>)}</nav></Drawer>
    </div>
    <label className={`inbox-search ${searchOpen ? "is-open" : ""}`}><Search size={18} aria-hidden="true" /><input type="search" aria-label="Найти диалог" placeholder="Имя, телефон, сообщение…" value={search} onChange={event => setSearch(event.target.value)} /></label>
    <nav className="inbox-filters" aria-label="Быстрые фильтры">{Object.entries(filters).slice(0, 4).map(([key, label]) => <Link key={key} href={`/admin/messages?filter=${key}`} aria-current={filter === key ? "page" : undefined}>{label}</Link>)}</nav>
    <section className="inbox-list" aria-label="Диалоги">{rows.length ? rows.map(row => {
      const Icon = channelIcons[row.channel as keyof typeof channelIcons] ?? MessageCircle;
      return <Link prefetch={false} className={`inbox-list-row ${row.unread > 0 ? "has-unread" : ""}`} key={row.id} href={`/admin/messages/${row.id}`} aria-current={selected === row.id ? "page" : undefined}>
        <span className="inbox-avatar" aria-hidden="true">{initials(row.name)}</span>
        <span className="inbox-row-text"><strong>{row.name}</strong><span className="inbox-preview">{row.lastMessage}</span><span className="inbox-row-channel"><Icon size={12} />{channelNames[row.channel]}{row.needsAttention && <span className="inbox-needs-answer"> · Нужен ответ</span>}{row.failedDelivery && <span className="inbox-needs-answer"><AlertCircle size={12} /> Не доставлено</span>}</span></span>
        <span className="inbox-row-meta"><time dateTime={row.lastMessageAt}>{new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Belgrade", month: "short", day: "numeric" }).format(new Date(row.lastMessageAt))}<span>{new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit" }).format(new Date(row.lastMessageAt))}</span></time>{row.unread > 0 && <span className="inbox-unread" aria-label={`${row.unread} непрочитанных`}>{row.unread}</span>}</span>
      </Link>;
    }) : <div className="admin-empty"><h3>{search ? "Диалоги не найдены" : "Диалогов пока нет"}</h3></div>}</section>
    {data.next && <Link className="crm-button crm-button-secondary" href={`/admin/messages?filter=${filter}&before=${encodeURIComponent(data.next)}`}>Более ранние диалоги</Link>}
  </aside>;
}
