"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
export { MessengerControls as InboxControls } from "./messenger-controls";
export function AgentModeControl({
  mode,
  enabled,
  canActivate = false,
  blockers = [],
}: {
  mode: string;
  enabled: boolean;
  canActivate?: boolean;
  blockers?: string[];
}) {
  const router = useRouter(),
    [value, setValue] = useState(mode),
    [confirm, setConfirm] = useState(false),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  return (
    <form
      className="inbox-mode"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError("");
          try {
            const r = await fetch("/api/admin/inbox", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "mode",
                mode: value,
                ...(confirm ? { confirmAuto: true } : {}),
              }),
            });
            if (!r.ok) {
              setError(
                "Режим не изменён. Проверьте настройки и подтверждение AUTO.",
              );
              return;
            }
            router.refresh();
          } catch {
            setError("Связь временно недоступна");
          }
        });
      }}
    >
      <EmergencyAIControls />
      {mode !== "AUTO" && value !== "AUTO" && enabled && canActivate && (
        <button
          type="button"
          className="crm-button"
          disabled={pending}
          onClick={() => {
            setValue("AUTO");
            setConfirm(false);
          }}
        >
          Включить ограниченный AUTO
        </button>
      )}
      <div>
        <label htmlFor="ai-mode">AI-ответы включены</label>
        <p className="crm-hint">
          {enabled
            ? "Серверный переключатель включён"
            : "Серверный AI_AGENT_ENABLED выключен"}{" "}
          · Текущий режим: {mode}
        </p>
      </div>
      <select
        id="ai-mode"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setConfirm(false);
        }}
      >
        <option value="OFF">OFF · только владелец</option>
        <option value="SHADOW">SHADOW · предложения владельцу</option>
        <option value="AUTO">AUTO · ответы и стандартная запись</option>
      </select>
      {value === "AUTO" && (
        <label className="crm-checkbox">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          Я проверил диалоги, правила длительности и маршруты; разрешаю AUTO
        </label>
      )}
      <button
        className="crm-button secondary"
        disabled={
          pending ||
          (value === "AUTO" && (!confirm || !enabled || !canActivate))
        }
      >
        {value === "AUTO" ? "Включить ограниченный AUTO" : "Сохранить режим"}
      </button>
      {value === "AUTO" && !canActivate && (
        <p role="status">
          AUTO заблокирован:{" "}
          {blockers.length
            ? blockers.join("; ")
            : "Откройте Запуск AI в Settings для проверок."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function EmergencyAIControls() {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [error, setError] = useState("");
  return (
    <div className="inbox-action-row">
      {["SHADOW", "OFF"].map((mode) => (
        <button
          type="button"
          key={mode}
          className="crm-button secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              try {
                const r = await fetch("/api/admin/inbox", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "mode", mode }),
                });
                if (!r.ok) throw Error();
                router.refresh();
              } catch {
                setError("Не удалось отключить AUTO. Повторите действие.");
              }
            })
          }
        >
          {mode === "OFF" ? "Отключить AI → OFF" : "Остановить AUTO → SHADOW"}
        </button>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

