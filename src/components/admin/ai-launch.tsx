"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Check } from "@/lib/agent/readiness";
type Settings = {
  mode: string;
  channels: Record<string, string>;
  services: string[];
  maxMessages: number;
  maxModelCalls: number;
  maxToolSteps: number;
  maxConversationCost: number;
  dailyWarning: number;
};
export function AILaunch({
  checks,
  settings,
  checkedAt,
  sample,
  summary,
}: {
  summary: { ready: number; total: number };
  checks: Check[];
  settings: Settings;
  checkedAt: string | null;
  sample: { n: number; accepted: number; rejected: number };
}) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  async function command(payload: unknown) {
    setMessage("");
    try {
      const r = await fetch("/api/admin/ai-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        b = await r.json();
      setMessage(
        r.ok
          ? "Сохранено. Проверки обновлены."
          : (b.error ?? "Настройки не сохранены"),
      );
      if (r.ok) router.refresh();
    } catch {
      setMessage("Связь временно недоступна");
    }
  }
  return (
    <section className="crm-section">
      <h2>Website AI readiness</h2>
      <p>
        <b>
          {summary.ready} из {summary.total} обязательных систем готовы
        </b>
      </p>
      <p>
        <b>
          {checks.some((c) => c.status === "BLOCKS_AUTO")
            ? "AUTO пока не готов — устраните блокировки ниже."
            : "Технических блокировок нет. Просмотрите оценённые диалоги; окончательное включение — решение владельца."}
        </b>
      </p>
      <p>
        Production включается владельцем после устранения блокировок. AUTO —
        ограниченный запуск: стандартные заявки и переносы; сложные случаи
        передаются человеку.
      </p>
      <dl className="crm-facts">
        {checks.map((c) => (
          <div key={c.id}>
            <dt>{c.label}</dt>
            <dd>
              <b>
                {c.status === "READY"
                  ? "Готово"
                  : c.status === "WARNING"
                    ? "Предупреждение"
                    : "Блокирует AUTO"}
              </b>
              <br />
              {c.detail}
              {c.status !== "READY" && (
                <>
                  <br />
                  <Link href={c.href ?? "/admin/settings#logistics"}>
                    {c.action ?? "Настроить"} →
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="crm-hint">
        Оценка SHADOW: n={sample.n}, принято {sample.accepted}, исправлено{" "}
        {sample.rejected}.{" "}
        {sample.n < 5
          ? "Недостаточно данных для оценки качества."
          : "Процент не является гарантией качества."}{" "}
        Оценки служат операционной аналитике и не обучают модель.
      </p>
      <button
        className="crm-button secondary"
        disabled={pending}
        onClick={() => start(() => command({ action: "diagnostics" }))}
      >
        {pending ? "Проверяем…" : "Проверить AI и логистику"}
      </button>
      <p className="crm-hint">
        Проверка делает небольшие реальные API вызовы.{" "}
        {checkedAt
          ? `Последняя проверка: ${new Date(checkedAt).toLocaleString("ru-RU", { timeZone: "Europe/Belgrade" })}`
          : "Проверок ещё нет."}{" "}
        Ключи не отображаются.
      </p>
      <details>
        <summary>Каналы, услуги и лимиты</summary>
        <form
          className="crm-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(() =>
              command({
                action: "settings",
                channels: Object.fromEntries(
                  ["WEBSITE", "TELEGRAM", "WHATSAPP", "VIBER"].map((k) => [
                    k,
                    f.get(k),
                  ]),
                ),
                allowedServices: f.getAll("service"),
                canary: true,
                maxMessages: Number(f.get("maxMessages")),
                maxModelCalls: Number(f.get("maxModelCalls")),
                maxToolSteps: Number(f.get("maxToolSteps")),
                maxConversationCost: Number(f.get("maxConversationCost")),
                dailyWarning: Number(f.get("dailyWarning")),
                ...(f.get("confirmAuto") ? { confirmAuto: true } : {}),
              }),
            );
          }}
        >
          <fieldset disabled={pending}>
            <div className="crm-fields-grid">
              {["WEBSITE", "TELEGRAM", "WHATSAPP", "VIBER"].map((k) => (
                <label className="crm-field" key={k}>
                  {k}
                  <select
                    name={k}
                    defaultValue={settings.channels[k] ?? "OFF"}
                    disabled={k !== "WEBSITE"}
                  >
                    <option value="OFF">OFF</option>
                    {k === "WEBSITE" && (
                      <>
                        <option value="SHADOW">SHADOW</option>
                        <option value="AUTO">AUTO — ограниченный запуск</option>
                      </>
                    )}
                  </select>
                  {k !== "WEBSITE" && (
                    <input type="hidden" name={k} value="OFF" />
                  )}
                </label>
              ))}
            </div>
            <p>
              Глобальный режим: {settings.mode}. При SHADOW все включённые
              каналы работают в SHADOW, при OFF — отключены.
            </p>
            <p>
              Услуги AUTO (только площади и команды из активных Duration Rules):
            </p>
            {[
              ["regular", "Поддерживающая"],
              ["deep", "Генеральная"],
              ["move", "При переезде"],
              ["airbnb", "Airbnb"],
              ["office", "Офис"],
            ].map(([code, label]) => (
              <label className="crm-checkbox" key={code}>
                <input
                  type="checkbox"
                  name="service"
                  value={code}
                  defaultChecked={settings.services.includes(code)}
                />
                {label}
              </label>
            ))}
            <div className="crm-fields-grid">
              {[
                ["maxMessages", "Максимум сообщений", 10, 1000, 1],
                [
                  "maxModelCalls",
                  "Вызовы моделей на сообщение (включая fallback)",
                  1,
                  16,
                  1,
                ],
                ["maxToolSteps", "Итерации tools на сообщение", 1, 8, 1],
                [
                  "maxConversationCost",
                  "Максимальная стоимость диалога USD",
                  0.01,
                  10,
                  0.01,
                ],
                [
                  "dailyWarning",
                  "Предупреждение стоимости в сутки USD",
                  0.1,
                  100,
                  0.1,
                ],
              ].map(([key, label, min, max, step]) => (
                <label className="crm-field" key={String(key)}>
                  {label}
                  <input
                    required
                    name={String(key)}
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    defaultValue={settings[key as keyof Settings] as number}
                  />
                </label>
              ))}
            </div>
            {settings.mode === "AUTO" && (
              <label className="crm-checkbox">
                <input name="confirmAuto" type="checkbox" />
                Подтверждаю новое ограничение AUTO после проверки диалогов и
                readiness
              </label>
            )}
            <button className="crm-button" disabled={pending}>
              Сохранить настройки AI
            </button>
          </fieldset>
        </form>
      </details>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function ShadowEvaluation({
  id,
  suggestionId,
  verdict,
  savedReason,
}: {
  id: string;
  suggestionId: string;
  verdict: string | null;
  savedReason: string | null;
}) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [reason, setReason] = useState(savedReason ?? "MISUNDERSTOOD"),
    [error, setError] = useState("");
  function rate(value: string) {
    start(async () => {
      try {
        const r = await fetch("/api/admin/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "evaluate",
            id,
            suggestionId,
            verdict: value,
            ...(value === "REJECTED" ? { reason } : {}),
          }),
        });
        if (!r.ok) {
          setError("Оценка не сохранена");
          return;
        }
        router.refresh();
      } catch {
        setError("Связь недоступна");
      }
    });
  }
  return (
    <div>
      <p>
        Оценка:{" "}
        {verdict === "ACCEPTED"
          ? "Хороший ответ"
          : verdict === "REJECTED"
            ? "Нужно исправить"
            : "Ещё не оценён"}
      </p>
      <div className="inbox-action-row">
        <button
          className="crm-button secondary"
          disabled={pending}
          onClick={() => rate("ACCEPTED")}
        >
          Хороший ответ
        </button>
        <label>
          Причина исправления
          <select
            aria-label="Причина исправления"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {[
              ["MISUNDERSTOOD", "Неверно понял"],
              ["TONE", "Неправильный тон"],
              ["EXTRA_QUESTION", "Лишний вопрос"],
              ["TOOL", "Неверный tool"],
              ["PRICE", "Цена"],
              ["SCHEDULING", "Scheduling"],
              ["OTHER", "Другое"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          className="crm-button secondary"
          disabled={pending}
          onClick={() => rate("REJECTED")}
        >
          Нужно исправить
        </button>
      </div>
      <p className="crm-hint">
        Чтобы отправить собственный ответ, перехватите диалог ниже. Оценка сама
        по себе ничего не отправляет.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
