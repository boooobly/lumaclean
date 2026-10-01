"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Unavailable");
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="admin-sign-out"
        type="button"
        onClick={signOut}
        disabled={pending}
      >
        {pending ? "Выходим…" : "Выйти"} <span aria-hidden="true">↗</span>
      </button>
      {failed && <p role="alert">Не удалось выйти. Повторите попытку.</p>}
    </>
  );
}
