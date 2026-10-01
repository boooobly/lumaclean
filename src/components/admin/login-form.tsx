"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginSchema } from "@/lib/validation/admin";

export function LoginForm({ available }: { available: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: String(form.get("email") || "")
        .trim()
        .toLowerCase(),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError("Укажите email и пароль длиной от 12 символов.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, rememberMe: false }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Слишком много попыток. Подождите минуту."
            : response.status >= 500
              ? "Вход временно недоступен. Повторите позже."
              : "Не удалось войти. Проверьте email и пароль.",
        );
        setPending(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Не удалось соединиться. Повторите попытку.");
      setPending(false);
    }
  }
  return (
    <form className="admin-login-form" onSubmit={submit}>
      <label htmlFor="admin-email">
        Email
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
          disabled={!available || pending}
        />
      </label>
      <label htmlFor="admin-password">
        Пароль
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={12}
          maxLength={128}
          required
          disabled={!available || pending}
        />
      </label>
      <p className="admin-form-message" role="alert" aria-live="polite">
        {error ||
          (!available
            ? "Вход будет доступен после подключения рабочего пространства."
            : "")}
      </p>
      <button
        className="admin-primary"
        type="submit"
        disabled={!available || pending}
      >
        {pending ? "Проверяем…" : "Войти в пространство"}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
