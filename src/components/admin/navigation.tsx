"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminSections } from "@/lib/domain/admin-navigation";

export function AdminNavigation() {
  const pathname = usePathname();
  const links = [{ slug: "", label: "Главная" }, ...adminSections];
  return (
    <nav className="admin-nav" aria-label="Разделы рабочего пространства">
      {links.map((item, index) => {
        const href = item.slug ? `/admin/${item.slug}` : "/admin";
        return (
          <Link
            key={href}
            href={href}
            onClick={(event) =>
              event.currentTarget.closest("details")?.removeAttribute("open")
            }
            aria-current={pathname === href ? "page" : undefined}
          >
            <span className="admin-nav-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.label}
            <span className="admin-nav-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
