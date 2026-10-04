"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepareChatPhoto } from "@/components/site/chat-photos";
export function InboxControls({
  id,
  control,
  identityVerified,
  readThrough,
}: {
  id: string;
  control: string;
  identityVerified: boolean;
  readThrough?: string;
}) {
  const router = useRouter(),
    [pending, startTransition] = useTransition(),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [clientId, setClientId] = useState(""),
    [verified, setVerified] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; requestId: string }[]>([]),
    [uploading, setUploading] = useState(false);
  const typing = useRef(0),
    lastHeartbeat = useRef(0);
  useEffect(() => {
    if (control !== "HUMAN_CONTROL") return;
    const beat = () => {
      const active = Date.now() - typing.current < 4500;
      lastHeartbeat.current = Date.now();
      void fetch("/api/admin/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "typing", id, active }),
      }).catch(() => {});
    };
    const timer = setInterval(() => {
      if (Date.now() - typing.current < 7500) beat();
    }, 3000);
    return () => {
      clearInterval(timer);
      void fetch("/api/admin/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "typing", id, active: false }),
      }).catch(() => {});
    };
  }, [id, control]);
  useEffect(() => {
    if (control !== "HUMAN_CONTROL" || !readThrough) return;
    void fetch("/api/admin/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id, messageId: readThrough }),
    }).catch(() => {});
  }, [id, control, readThrough]);
  async function attach(files: FileList | null) {
    if (!files || photos.length + files.length > 4) {
      setError("До 4 фото");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const blob = await prepareChatPhoto(file),
          requestId = crypto.randomUUID();
        const r = await fetch("/api/admin/inbox/attachments", {
          method: "POST",
          headers: {
            "Content-Type": "image/jpeg",
            "X-Upload-Id": requestId,
            "X-Conversation-Id": id,
          },
          body: blob,
        });
        if (!r.ok) throw Error();
        const attachmentId = (await r.json()).attachment.id;
        setPhotos((p) => [...p, {id: attachmentId, requestId}]);
      }
    } catch {
      setError("Не удалось загрузить фото. JPEG, PNG или WebP, до 8 МБ.");
    } finally {
      setUploading(false);
    }
  }
  const replyAttempt = useRef<{ signature: string; id: string } | null>(null);
  async function command(payload: Record<string, unknown>) {
    setError("");
    try {
      const r = await fetch("/api/admin/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        b = await r.json();
      if (!r.ok) {
        setError(b.error ?? "Не удалось выполнить действие");
        return;
      }
      if (payload.action === "reply") {
        setText("");
        setPhotos([]);
        typing.current = 0;
        replyAttempt.current = null;
      }
      router.refresh();
    } catch {
      setError("Связь временно недоступна");
    }
  }
  return (
    <div className="inbox-controls">
      <div className="inbox-action-row">
        {control !== "HUMAN_CONTROL" && control !== "CLOSED" ? (
          <button
            className="crm-button"
            disabled={pending}
            onClick={() =>
              startTransition(() => command({ action: "takeover", id }))
            }
          >
            Перехватить диалог
          </button>
        ) : (
          <button
            className="crm-button"
            disabled={pending}
            onClick={() =>
              startTransition(() => command({ action: "resume", id }))
            }
          >
            Вернуть AI
          </button>
        )}
        {control !== "CLOSED" && (
          <button
            className="crm-button secondary"
            disabled={pending}
            onClick={() =>
              startTransition(() => command({ action: "close", id }))
            }
          >
            Закрыть
          </button>
        )}
        <button
          className="crm-button secondary"
          disabled={pending}
          onClick={() =>
            startTransition(() => command({ action: "retry", id }))
          }
        >
          Повторить обработку
        </button>
        <button
          className="crm-button secondary"
          disabled={pending}
          onClick={() => startTransition(() => command({ action: "read", id }))}
        >
          Прочитано
        </button>
        <button
          className="crm-button secondary"
          onClick={() => router.refresh()}
        >
          Обновить
        </button>
      </div>
      {control === "HUMAN_CONTROL" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() =>
              command({
                action: "reply",
                id,
                requestId: (replyAttempt.current?.signature === JSON.stringify([text,photos.map(p=>p.id)])
                  ? replyAttempt.current
                  : (replyAttempt.current = { signature:JSON.stringify([text,photos.map(p=>p.id)]), id: crypto.randomUUID() })
                ).id,
                text,
                attachmentIds: photos.map((p) => p.id),
              }),
            );
          }}
        >
          <label>
            Ответ клиенту
            <textarea
              aria-label="Ответ клиенту"
              maxLength={3000}
              rows={4}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                typing.current = Date.now();
                if (typing.current - lastHeartbeat.current > 3000) {
                  lastHeartbeat.current = typing.current;
                  void fetch("/api/admin/inbox", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "typing",
                      id,
                      active: true,
                    }),
                  }).catch(() => {});
                }
              }}
            />
          </label>
          <label>
            Прикрепить фото
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || photos.length >= 4}
              onChange={(e) => void attach(e.target.files)}
            />
          </label>
          {photos.map((p) => (
            <div key={p.id}>
              <img
                src={`/api/chat/attachments/${p.id}?thumb=1`}
                alt="Фото к ответу"
                width={64}
                height={64}
              />
              <button
                type="button"
                onClick={() =>
                  setPhotos((ps) => ps.filter((x) => x.id !== p.id))
                }
              >
                Удалить
              </button>
            </div>
          ))}
          <button
            className="crm-button"
            disabled={pending || uploading || (!text.trim() && !photos.length)}
          >
            Отправить ответ
          </button>
        </form>
      )}
      {!identityVerified && control === "HUMAN_CONTROL" && (
        <details>
          <summary>Подтвердить существующего клиента</summary>
          <p className="crm-hint">
            Используйте после независимой проверки клиента. Имя или названный
            телефон сами по себе не подтверждают личность.
          </p>
          <label>
            ID клиента из CRM
            <input
              aria-label="ID клиента из CRM"
              value={clientId}
              maxLength={80}
              onChange={(e) => setClientId(e.target.value)}
            />
          </label>
          <label className="crm-checkbox">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            Личность проверена по надёжному каналу
          </label>
          <button
            className="crm-button secondary"
            disabled={pending || !clientId || !verified}
            onClick={() =>
              startTransition(() =>
                command({
                  action: "verifyIdentity",
                  id,
                  clientId,
                  verificationConfirmed: true,
                }),
              )
            }
          >
            Привязать клиента
          </button>
        </details>
      )}
      {error && (
        <p role="alert" className="crm-error">
          {error}
        </p>
      )}
    </div>
  );
}
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
