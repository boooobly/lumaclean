"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, MoreHorizontal, Plus } from "lucide-react";
import { prepareChatPhoto } from "@/components/site/chat-photos";
import { channelNames, handoffNames } from "@/lib/domain/messenger";
import { Drawer } from "./drawer";

export function MessengerControls({ id, control, identityVerified, readThrough, name, channel, handoff, children, context, orderSummary, shadow }: {
  id: string; control: string; identityVerified: boolean; readThrough?: string; name: string; channel: string; handoff?: string; children: ReactNode; context: ReactNode; orderSummary?: string; shadow?: { id: string; text: string };
}) {
  const router = useRouter(), [pending, start] = useTransition();
  const [text, setText] = useState(""), [error, setError] = useState(""), [technicalError, setTechnicalError] = useState(""), [clientId, setClientId] = useState(""), [verified, setVerified] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; requestId: string }[]>([]), [uploading, setUploading] = useState(false), [hiddenSuggestion, setHiddenSuggestion] = useState<string>();
  const [confirmClose, setConfirmClose] = useState(false), [keyboard, setKeyboard] = useState(false);
  const shell = useRef<HTMLElement>(null), textarea = useRef<HTMLTextAreaElement>(null), typing = useRef(0), replyAttempt = useRef<{ signature: string; id: string } | null>(null);
  const human = control === "HUMAN_CONTROL", closed = control === "CLOSED";
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const open = Boolean(viewport && window.innerHeight - viewport.height > 150);
      setKeyboard(open);
      if (shell.current && viewport) { shell.current.style.setProperty("--messenger-viewport", `${viewport.height}px`); shell.current.style.setProperty("--messenger-top", `${viewport.offsetTop}px`); }
    };
    update(); viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update);
    return () => { viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update); };
  }, []);
  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = "0px";
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 128)}px`;
  }, [text, human]);
  useEffect(() => {
    if (!human) return;
    const timer = setInterval(() => {
      if (Date.now() - typing.current < 7500) {

        void fetch("/api/admin/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "typing", id, active: Date.now() - typing.current < 4500 }) }).catch(() => {});
      }
    }, 3000);
    return () => { clearInterval(timer); void fetch("/api/admin/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "typing", id, active: false }) }).catch(() => {}); };
  }, [id, human]);
  useEffect(() => {
    if (human && readThrough) void fetch("/api/admin/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", id, messageId: readThrough }) }).catch(() => {});
  }, [id, human, readThrough]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible" && !pending && !uploading) router.refresh(); }, 15000);
    return () => clearInterval(timer);
  }, [router, pending, uploading]);
  async function command(payload: Record<string, unknown>) {
    setError(""); setTechnicalError("");
    try {
      const response = await fetch("/api/admin/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...payload }) });
      const value = await response.json();
      if (!response.ok) {
        const code = typeof value.error === "string" ? value.error : value.error?.message ?? "REQUEST_FAILED";
        setTechnicalError(code);
        setError(code === "TAKEOVER_REQUIRED" ? "Сначала заберите диалог. Ответ не отправлен." : "Действие не выполнено. Обновите диалог и повторите.");
        return false;
      }
      router.refresh(); return true;
    } catch { setError("Связь недоступна. Текст сохранён; повторите действие."); return false; }
  }
  async function send(value = text) {
    const signature = JSON.stringify([value, photos.map(photo => photo.id)]);
    if (replyAttempt.current?.signature !== signature) replyAttempt.current = { signature, id: crypto.randomUUID() };
    if (await command({ action: "reply", requestId: replyAttempt.current.id, text: value, attachmentIds: photos.map(photo => photo.id) })) {
      setText(""); setPhotos([]); typing.current = 0; replyAttempt.current = null;
    }
  }
  async function attach(files: FileList | null) {
    if (!files || photos.length + files.length > 4) { setError("Можно прикрепить до 4 фото."); return; }
    setUploading(true); setError("");
    try {
      for (const file of Array.from(files)) {
        const blob = await prepareChatPhoto(file), requestId = crypto.randomUUID();
        const response = await fetch("/api/admin/inbox/attachments", { method: "POST", headers: { "Content-Type": "image/jpeg", "X-Upload-Id": requestId, "X-Conversation-Id": id }, body: blob });
        if (!response.ok) throw Error();
        const photo = (await response.json()).attachment;
        setPhotos(value => [...value, { id: photo.id, requestId }]);
      }
    } catch { setError("Фото не загружено. Используйте JPEG, PNG или WebP до 8 МБ."); } finally { setUploading(false); }
  }
  return <section ref={shell} className={`messenger-thread ${keyboard ? "keyboard-open" : ""}`} aria-label="Текущий диалог">
    <header className="messenger-header"><Link href="/admin/messages" className="admin-icon-button messenger-back" aria-label="Все диалоги"><ArrowLeft size={21} /></Link><div className="messenger-heading"><h1>{name}</h1><small>{channelNames[channel] ?? channel} · {closed ? "Закрыт" : human ? "Вы отвечаете" : handoff ? "Handoff" : "AI отвечает"}</small></div>
      {!closed && <button type="button" className="messenger-takeover" disabled={pending} onClick={() => start(() => command({ action: human ? "resume" : "takeover" }).then(() => {}))}>{human ? "Вернуть AI" : "Забрать"}</button>}
      <Drawer title="Действия диалога" icon={<MoreHorizontal size={22} />}>
        <div className="messenger-menu"><button type="button" className="crm-button crm-button-secondary" onClick={() => router.refresh()}>Обновить</button><button type="button" className="crm-button crm-button-secondary" disabled={pending} onClick={() => start(() => command({ action: "read" }).then(() => {}))}>Отметить прочитанным</button>{closed && <button type="button" className="crm-button crm-button-secondary" disabled={pending} onClick={() => start(() => command({ action: "resume" }).then(() => {}))}>Открыть и вернуть AI</button>}
          <details><summary>Повторить обработку AI</summary><p className="crm-hint">Повторно запускает обработку диалога. Не повторяет отправку сообщения с неизвестным результатом доставки.</p><button type="button" className="crm-button crm-button-secondary" disabled={pending} onClick={() => start(() => command({ action: "retry" }).then(() => {}))}>Повторить обработку</button></details>
          {!identityVerified && human && <details><summary>Подтвердить существующего клиента</summary><p className="crm-hint">Нужна независимая проверка. Названные имя и телефон не подтверждают личность.</p><label>ID клиента из CRM<input aria-label="ID клиента из CRM" value={clientId} maxLength={80} onChange={event => setClientId(event.target.value)} /></label><label className="crm-checkbox"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} />Личность проверена по надёжному каналу</label><button type="button" className="crm-button" disabled={pending || !clientId || !verified} onClick={() => start(() => command({ action: "verifyIdentity", clientId, verificationConfirmed: true }).then(() => {}))}>Привязать клиента</button></details>}
          {!closed && <div className="messenger-danger"><button type="button" className="crm-button crm-button-secondary" onClick={() => setConfirmClose(true)}>Закрыть диалог</button>{confirmClose && <div role="group" aria-label="Подтверждение закрытия"><p>Закрыть диалог? Клиент не сможет продолжить переписку.</p><button type="button" className="crm-button" disabled={pending} onClick={() => start(async () => { if (await command({ action: "close" })) setConfirmClose(false); })}>Да, закрыть</button><button type="button" className="crm-button crm-button-secondary" onClick={() => setConfirmClose(false)}>Отмена</button></div>}</div>}
        </div>
      </Drawer>{context}
    </header>
    {handoff && !human && !closed && <aside className="messenger-handoff" role="status">Требуется ответ · {handoffNames[handoff] ?? "нужно уточнение оператора"}</aside>}
    {orderSummary && <button type="button" className="messenger-order-line" onClick={() => { const dialog = document.getElementById(`context-${id}`); if (dialog instanceof HTMLDialogElement) dialog.showModal(); }}>{orderSummary}</button>}
    {children}
    <div className="messenger-composer-area">
      {shadow && hiddenSuggestion !== shadow.id && !closed && <aside className="messenger-shadow"><strong>AI предлагает</strong><p>{shadow.text}</p><div><button type="button" disabled={pending || uploading} onClick={() => start(async () => { if (!human && !await command({ action: "takeover" })) return; await send(shadow.text); })}>{human ? "Отправить" : "Забрать и отправить"}</button><button type="button" onClick={() => { setText(shadow.text); setHiddenSuggestion(shadow.id); textarea.current?.focus(); }}>Изменить</button><button type="button" onClick={() => setHiddenSuggestion(shadow.id)}>Скрыть</button></div></aside>}
      {error && <div className="messenger-error" role="alert">{error}{technicalError && <details><summary>Технические детали</summary><code>{technicalError}</code></details>}</div>}
      {uploading && <p role="status" className="crm-hint">Загружаем фото…</p>}
      {photos.length > 0 && <div className="messenger-upload-list">{photos.map(photo => <div key={photo.id}><Image unoptimized src={`/api/chat/attachments/${photo.id}?thumb=1`} alt="Фото к ответу" width={56} height={56} /><button type="button" className="admin-icon-button" aria-label="Убрать фото из ответа" onClick={() => setPhotos(value => value.filter(item => item.id !== photo.id))}>×</button></div>)}</div>}
      {!closed ? <form className="messenger-composer" onSubmit={event => { event.preventDefault(); start(() => send()); }}><label className={`admin-icon-button messenger-upload ${!human ? "is-disabled" : ""}`} aria-label="Прикрепить фото"><Plus size={22} /><input type="file" aria-label="Прикрепить фото" multiple accept="image/jpeg,image/png,image/webp" disabled={!human || uploading || photos.length >= 4} onChange={event => { void attach(event.target.files); event.target.value = ""; }} /></label>
        <textarea ref={textarea} aria-label="Ответ клиенту" placeholder={human ? "Написать сообщение…" : "Заберите диалог, чтобы ответить…"} readOnly={!human} maxLength={3000} rows={1} value={text} onChange={event => { setText(event.target.value); typing.current = Date.now(); }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && human && !pending && !uploading && (text.trim() || photos.length)) { event.preventDefault(); start(() => send()); } }} />
        <button type="submit" className="messenger-send admin-icon-button" aria-label="Отправить сообщение" disabled={!human || pending || uploading || (!text.trim() && !photos.length)}><ArrowUp size={21} /></button></form> : <p className="messenger-closed">Диалог закрыт. Открыть его можно в меню действий.</p>}
    </div>
  </section>;
}
