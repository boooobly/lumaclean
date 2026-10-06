"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, ListChecks, MessageCircle, Menu } from "lucide-react";
import { Drawer } from "./drawer";
import { SignOut } from "./sign-out";

const primary = [
  { href: "/admin", label: "Главная", icon: House },
  { href: "/admin/messages", label: "Сообщения", icon: MessageCircle },
  { href: "/admin/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/admin/orders", label: "Заказы", icon: ListChecks },
];
const more = [["leads", "Лиды"], ["clients", "Клиенты"], ["cleaners", "Клинеры"], ["finances", "Финансы"], ["analytics", "Аналитика"], ["settings", "Настройки"]];

export function MobileBottomNav({ unread }: { unread: number }) {
  const path = usePathname();
  return <nav className="admin-bottom-nav" aria-label="Основная навигация">
    {primary.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={(href === "/admin" ? path === href : path.startsWith(href)) ? "page" : undefined}>
      <span className="admin-nav-icon"><Icon size={21} />{href.endsWith("messages") && unread > 0 && <span className="admin-nav-unread" aria-label={`${unread} непрочитанных`}>{unread > 99 ? "99+" : unread}</span>}</span><span>{label}</span>
    </Link>)}
    <Drawer title="Ещё" label="Другие разделы" className={more.some(([slug]) => path.startsWith(`/admin/${slug}`)) ? "admin-more-active" : ""} icon={<><Menu size={21} /><span>Ещё</span></>}>
      <nav className="admin-more-links" aria-label="Другие разделы">{more.map(([slug, label]) => <Link key={slug} href={`/admin/${slug}`} aria-current={path.startsWith(`/admin/${slug}`) ? "page" : undefined}>{label}<span aria-hidden="true">↗</span></Link>)}</nav><SignOut />
    </Drawer>
  </nav>;
}
