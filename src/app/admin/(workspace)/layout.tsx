import "maplibre-gl/dist/maplibre-gl.css";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { AdminNavigation } from "@/components/admin/navigation";
import { SignOut } from "@/components/admin/sign-out";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
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
        <details className="admin-mobile-nav">
          <summary>
            Разделы <span aria-hidden="true">＋</span>
          </summary>
          <AdminNavigation />
        </details>
        <div className="admin-account">
          <span className="admin-account-label">Владелец · Администратор</span>
          <strong>{user.name}</strong>
          <SignOut />
        </div>
      </aside>
      <main id="admin-content" className="admin-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
