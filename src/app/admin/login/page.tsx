import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { isAuthConfigured } from "@/lib/auth/config";
import { SignOut } from "@/components/admin/sign-out";

export const metadata = { title: "Вход" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") redirect("/admin");
  return (
    <main className="admin-login">
      <section className="admin-login-story">
        <Image
          src="/brand/logo-light.svg"
          width={220}
          height={47}
          alt="LumaClean"
          priority
        />
        <div>
          <span className="admin-eyebrow">Порядок начинается здесь</span>
          <h1>
            Забота о доме.
            <br />
            Точность в работе.
          </h1>
          <p>
            Внутреннее пространство LumaClean.
            <br />
            Для людей, которые держат всё на своих местах.
          </p>
        </div>
        <span className="admin-login-location">
          Белград, Сербия <span>01 / Рабочее пространство</span>
        </span>
      </section>
      <section className="admin-login-sheet" aria-labelledby="login-title">
        <div className="admin-login-inner">
          <span className="admin-eyebrow">Закрытый доступ</span>
          <h2 id="login-title">Добро пожаловать.</h2>
          <p>Войдите, чтобы продолжить работу.</p>
          {user?.role === "CLEANER" ? (
            <div className="admin-access-note">
              <p role="status">
                Кабинет клинера пока не открыт. Для рабочего пространства нужен
                доступ администратора.
              </p>
              <SignOut />
            </div>
          ) : null}
          <LoginForm available={isAuthConfigured()} />
          <div className="admin-login-note">
            Доступ предоставляется владельцем LumaClean.
            <br />
            Публичная регистрация закрыта.
          </div>
          <Link className="admin-text-link" href="/ru">
            На сайт LumaClean <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
