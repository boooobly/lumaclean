import "maplibre-gl/dist/maplibre-gl.css";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { AdminNavigation } from "@/components/admin/navigation";
import { SignOut } from "@/components/admin/sign-out";
import { MobileBottomNav } from "@/components/admin/mobile-bottom-nav";
import { getDatabase } from "@/lib/database/client";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const unread = await getDatabase().conversation.aggregate({ where: { control: { not: "CLOSED" }, OR: [{ externalThreadId: null }, { NOT: { externalThreadId: { startsWith: "live-test:" } } }] }, _sum: { unreadCount: true } });
  return (
    <div className="admin-workspace">
      <a className="admin-skip" href="#admin-content">
        Перейти к содержимому
      </a>
      <aside className="admin-sidebar">
        <Link
          className="admin-logo"
          href="/admin"
          aria-label="LumaClean — главная"
        >
          <Image
            src="/brand/logo-light.svg"
            width={200}
            height={43}
            alt="LumaClean"
            priority
          />
        </Link>
        <p className="admin-sidebar-caption">Рабочее пространство</p>
        <div className="admin-desktop-nav">
          <AdminNavigation />
        </div>
        <div className="admin-account">
          <span className="admin-account-label">Владелец · Администратор</span>
          <strong>{user.name}</strong>
          <SignOut />
        </div>
      </aside>
      <main id="admin-content" className="admin-content" tabIndex={-1}>
        {children}
      </main>
      <MobileBottomNav unread={unread._sum.unreadCount ?? 0} />
    </div>
  );
}
