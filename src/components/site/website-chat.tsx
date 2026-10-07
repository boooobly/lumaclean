"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  X,
  ArrowUp,
  Check,
  CheckCheck,
  Clock,
  Paperclip,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import type { AgentLocale, BookingRecap } from "@/lib/agent/contracts";
import { siteContent } from "@/lib/content";
import { formatRsd } from "@/lib/pricing";
import { ChatPhotos, prepareChatPhoto, type ChatPhoto } from "./chat-photos";
import "./website-chat.css";
type Message = {
  id: string;
  author: string;
  text: string;
  sentAt: string;
  readAt?: string | null;
  requestId?: string | null;
  attachments: ChatPhoto[];
};
type Quick = {
  messageId: string;
  replySetId: string;
  revision: number;
  choices: { key: string; label: string }[];
};
type Chat = {
  displayAlias: string;
  locale: AgentLocale;
  revision: number;
  typing: boolean;
  quickReplies: Quick | null;
  notifications?: { id: string; text: string }[];
  messages: Message[];
  control: string;
  pending: boolean;
  confirmation: { nonce: string; recap: BookingRecap } | null;
  booking: { reference: string; recap: BookingRecap } | null;
};
type DraftPhoto = {
  requestId: string;
  blob: Blob;
  preview: string;
  attachmentId?: string;
};
type Attempt = {
  id: string;
  text: string;
  photos: DraftPhoto[];
  status: "pending" | "failed";
  confirmationNonce?: string;
  quickReply?: { key: string; messageId: string; replySetId: string; revision: number };
};
const details = {
  ru: {
    typing: "печатает",
    sent: "Отправлено",
    read: "Прочитано",
    retry: "Не отправлено · Повторить",
    photo: "Фото",
    attach: "Прикрепить фото",
    newMessages: "Новые сообщения",
    remove: "Удалить фото",
    question: "Задать вопрос",
    handed: "передала диалог администратору",
    here: "на связи",
    photoError: "До 4 фото, каждое до 8 МБ. Используйте JPEG, PNG или WebP.",
    heic: "HEIC пока не поддерживается. Сохраните фото в JPEG.",
    offline: "Нет соединения. Сообщения сохранены для повторной отправки.",
  },
  "sr-Latn": {
    typing: "piše",
    sent: "Poslato",
    read: "Pročitano",
    retry: "Nije poslato · Pokušaj ponovo",
    photo: "Fotografija",
    attach: "Priloži fotografiju",
    newMessages: "Nove poruke",
    remove: "Ukloni fotografiju",
    question: "Postavi pitanje",
    handed: "je prosledila razgovor administratoru",
    here: "je na vezi",
    photoError: "Do 4 fotografije, do 8 MB svaka. JPEG, PNG ili WebP.",
    heic: "HEIC nije podržan. Sačuvajte fotografiju kao JPEG.",
    offline: "Nema veze. Poruke su sačuvane za ponovno slanje.",
  },
  "sr-Cyrl": {
    typing: "пише",
    sent: "Послато",
    read: "Прочитано",
    retry: "Није послато · Покушај поново",
    photo: "Фотографија",
    attach: "Приложи фотографију",
    newMessages: "Нове поруке",
    remove: "Уклони фотографију",
    question: "Постави питање",
    handed: "је проследила разговор администратору",
    here: "је на вези",
    photoError: "До 4 фотографије, до 8 МБ свака. JPEG, PNG или WebP.",
    heic: "HEIC није подржан. Сачувајте фотографију као JPEG.",
    offline: "Нема везе. Поруке су сачуване за поновно слање.",
  },
  en: {
    typing: "is typing",
    sent: "Sent",
    read: "Read",
    retry: "Not sent · Retry",
    photo: "Photo",
    attach: "Attach photos",
    newMessages: "New messages",
    remove: "Remove photo",
    question: "Ask a question",
    handed: "handed the conversation to our administrator",
    here: "is here",
    photoError: "Up to 4 photos, 8 MB each. Use JPEG, PNG or WebP.",
    heic: "HEIC is not supported yet. Please save the photo as JPEG.",
    offline: "Offline. Your messages are saved for retry.",
  },
};
const copy = {
  ru: {
    open: "Написать LumaClean",
    title: "Давайте обсудим уборку",
    intro:
      "Опишите, какая уборка нужна. Ответим здесь — регистрация не требуется.",
    placeholder: "Ваше сообщение…",
    send: "Отправить",
    close: "Закрыть чат",
    language: "Язык диалога",
    wait: "Сообщение передано. Ожидаем ответа.",
    human: "Администратор подключился",
    error: "Не удалось отправить. Повторите попытку.",
    rate: "Слишком много сообщений. Попробуйте через минуту.",
    confirm: "Подтвердить запись",
    confirmation: "Подтверждаю бронирование",
    booked: "Уборка подтверждена",
    recap: "Проверьте детали перед записью",
  },
  "sr-Latn": {
    open: "Pišite LumaClean",
    title: "Razgovarajmo o čišćenju",
    intro:
      "Opišite čišćenje koje vam treba. Odgovorićemo ovde — bez registracije.",
    placeholder: "Vaša poruka…",
    send: "Pošalji",
    close: "Zatvori razgovor",
    language: "Jezik razgovora",
    wait: "Poruka je prosleđena. Čekamo odgovor.",
    human: "Administrator je na vezi",
    error: "Slanje nije uspelo. Pokušajte ponovo.",
    rate: "Previše poruka. Pokušajte za minut.",
    confirm: "Potvrdi rezervaciju",
    confirmation: "Potvrđujem",
    booked: "Čišćenje je potvrđeno",
    recap: "Proverite detalje pre rezervacije",
  },
  "sr-Cyrl": {
    open: "Пишите LumaClean",
    title: "Разговарајмо о чишћењу",
    intro:
      "Опишите чишћење које вам треба. Одговорићемо овде — без регистрације.",
    placeholder: "Ваша порука…",
    send: "Пошаљи",
    close: "Затвори разговор",
    language: "Језик разговора",
    wait: "Порука је прослеђена. Чекамо одговор.",
    human: "Администратор је на вези",
    error: "Слање није успело. Покушајте поново.",
    rate: "Превише порука. Покушајте за минут.",
    confirm: "Потврди резервацију",
    confirmation: "Потврђујем",
    booked: "Чишћење је потврђено",
    recap: "Проверите детаље пре резервације",
  },
  en: {
    open: "Message LumaClean",
    title: "Let's talk about your cleaning",
    intro: "Tell us what you need. We'll reply here — no registration needed.",
    placeholder: "Your message…",
    send: "Send",
    close: "Close chat",
    language: "Conversation language",
    wait: "Message received. Waiting for a reply.",
    human: "Our administrator is here",
    error: "Message wasn't sent. Please try again.",
    rate: "Too many messages. Please try again in a minute.",
    confirm: "Confirm booking",
    confirmation: "I confirm the booking",
    booked: "Cleaning confirmed",
    recap: "Check the details before booking",
  },
};
function Recap({
  value,
  locale,
}: {
  value: BookingRecap;
  locale: AgentLocale;
}) {
  const lang = locale.startsWith("sr") ? "sr" : locale === "en" ? "en" : "ru",
    content = siteContent[lang];
  return (
    <dl className="website-chat-recap">
      <div>
        <dt>{content.calculator.service}</dt>
        <dd>
          {content.services.find((s) => s.id === value.service)?.name ??
            value.service}{" "}
          · {value.area} m²
        </dd>
      </div>
      <div>
        <dt>
          {new Intl.DateTimeFormat(
            locale === "sr-Cyrl"
              ? "sr-RS"
              : locale === "sr-Latn"
                ? "sr-Latn-RS"
                : locale,
            {
              timeZone: "Europe/Belgrade",
              weekday: "short",
              day: "numeric",
              month: "long",
            },
          ).format(new Date(value.start))}
        </dt>
        <dd>
          {new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Belgrade",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(value.start))}{" "}
          · Belgrade
        </dd>
      </div>
      <div>
        <dt>{value.address}</dt>
        <dd>{formatRsd(value.price, lang)}</dd>
      </div>
      <div>
        <dt>
          {locale === "ru"
            ? "Ориентировочная длительность"
            : locale === "en"
              ? "Estimated duration"
              : locale === "sr-Cyrl"
                ? "Оквирно трајање"
                : "Okvirno trajanje"}
        </dt>
        <dd>≈ {value.durationMinutes} min</dd>
      </div>
      {value.extras.length > 0 && (
        <div>
          <dt>{content.calculator.extras}</dt>
          <dd>
            {value.extras
              .map(
                (e) =>
                  `${content.calculator.labels[e.code] ?? e.code} × ${e.quantity}`,
              )
              .join(", ")}
          </dd>
        </div>
      )}
    </dl>
  );
}

export function WebsiteChat({ locale: pageLocale }: { locale: string }) {
  const [open, setOpen] = useState(false),
    [locale, setLocale] = useState<AgentLocale>(
      pageLocale === "sr" ? "sr-Latn" : pageLocale === "en" ? "en" : "ru",
    ),
    [chat, setChat] = useState<Chat | null>(null),
    [ready, setReady] = useState(false),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [photos, setPhotos] = useState<DraftPhoto[]>([]),
    [attempts, setAttempts] = useState<Attempt[]>([]),
    [unread, setUnread] = useState(0),
    [newMessages, setNewMessages] = useState(false),
    [online, setOnline] = useState(true);
  const panel = useRef<HTMLElement>(null),
    launcher = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    openRef = useRef(false),
    nearBottom = useRef(true),
    seen = useRef(new Set<string>()),
    initialized = useRef(false),
    snapshotSequence = useRef(0),
    startRequest = useRef<Promise<Chat> | null>(null),
    ownedUrls = useRef(new Set<string>()),
    sending = useRef(false),
    draftRef = useRef<DraftPhoto[]>([]);
  const words = copy[locale],
    d = details[locale],
    alias = chat?.displayAlias ?? "LumaClean";
  const bottom = useCallback(() => {
    const el = list.current;
    if (el)
      el.scrollTo({
        top: el.scrollHeight,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    nearBottom.current = true;
    setNewMessages(false);
  }, []);
  const snapshot = useCallback((value: Chat | null) => {
    if (value) {
      setLocale(value.locale);
      const incoming = value.messages.filter(
        (m) => m.author !== "CLIENT" && !seen.current.has(m.id),
      );
      if (initialized.current && incoming.length) {
        if (!openRef.current) setUnread((n) => n + incoming.length);
        if (!nearBottom.current) setNewMessages(true);
      }
      value.messages.forEach((m) => seen.current.add(m.id));
      initialized.current = true;
      setAttempts((previous) => {
        const accepted = previous.filter((a) =>
          value.messages.some((m) => m.requestId === a.id),
        );
        if (!accepted.length) return previous;
        accepted
          .flatMap((a) => a.photos)
          .forEach((p) => {
            URL.revokeObjectURL(p.preview);
            ownedUrls.current.delete(p.preview);
          });
        return previous.filter((a) => !accepted.some((x) => x.id === a.id));
      });
    }
    setChat((previous) => {
      if (previous && value && value.revision < previous.revision)
        return previous;
      return value;
    });
  }, []);
  const refresh = useCallback(async () => {
    const seq = ++snapshotSequence.current;
    const r = await fetch("/api/chat", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw Error();
    const b = await r.json();
    if (seq === snapshotSequence.current) snapshot(b.conversation);
  }, [snapshot]);
  useEffect(() => {
    const urls = ownedUrls.current;
    let active = true;
    void refresh()
      .catch(() => {
        if (active)
          setError(
            copy[
              pageLocale === "sr"
                ? "sr-Latn"
                : pageLocale === "en"
                  ? "en"
                  : "ru"
            ].error,
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    const connected = () => setOnline(navigator.onLine);
    connected();
    window.addEventListener("online", connected);
    window.addEventListener("offline", connected);
    return () => {
      active = false;
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", connected);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [refresh, pageLocale]);
  const hasConversation = !!chat;
  useEffect(() => {
    if (!hasConversation) return;
    let active = true,
      fallback: ReturnType<typeof setInterval> | undefined;
    const stream = new EventSource("/api/chat/events");
    const receive = (event: MessageEvent) => {
      if (!active) return;
      try {
        snapshot(JSON.parse(event.data).conversation);
        if (fallback) {
          clearInterval(fallback);
          fallback = undefined;
        }
      } catch {}
    };
    for (const name of [
      "message",
      "read",
      "typing",
      "control",
      "quickReplies",
      "booking",
      "confirmation",
      "handoff",
    ])
      stream.addEventListener(name, receive as EventListener);
    stream.onerror = () => {
      if (!fallback)
        fallback = setInterval(() => void refresh().catch(() => {}), 18000);
    };
    return () => {
      active = false;
      stream.close();
      if (fallback) clearInterval(fallback);
    };
  }, [hasConversation, snapshot, refresh]);
  useEffect(() => {
    openRef.current = open;
    if (open) {
      input.current?.focus();
      requestAnimationFrame(bottom);
    } else launcher.current?.focus();
  }, [open, bottom]);
  useEffect(() => {
    if (open && nearBottom.current) requestAnimationFrame(bottom);
  }, [open, chat?.messages.length, chat?.typing, attempts.length, bottom]);
  useEffect(() => {
    const el = input.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(112, Math.max(46, el.scrollHeight))}px`;
    }
  }, [text]);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const fit = () => {
      const el = panel.current;
      if (!el || !viewport) return;
      el.style.setProperty("--chat-viewport-height", `${viewport.height}px`);
      el.style.setProperty("--chat-viewport-top", `${viewport.offsetTop}px`);
    };
    fit();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    return () => {
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
    };
  }, [open]);
  async function ensureConversation() {
    if (chat) return chat;
    if (!startRequest.current)
      startRequest.current = (async () => {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", locale }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw Error();
        const b = await r.json();
        snapshot(b.conversation);
        return b.conversation as Chat;
      })();
    try {
      return await startRequest.current;
    } finally {
      startRequest.current = null;
    }
  }
  async function sendAttempt(attempt: Attempt) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    snapshotSequence.current++;
    setAttempts((a) =>
      a.map((m) => (m.id === attempt.id ? { ...m, status: "pending" } : m)),
    );
    try {
      await ensureConversation();
      const ids: string[] = [];
      for (const photo of attempt.photos) {
        if (!photo.attachmentId) {
          const r = await fetch("/api/chat/attachments", {
            method: "POST",
            headers: {
              "Content-Type": "image/jpeg",
              "X-Upload-Id": photo.requestId,
            },
            body: photo.blob,
            signal: AbortSignal.timeout(45000),
          });
          if (!r.ok) throw Error("UPLOAD");
          photo.attachmentId = (await r.json()).attachment.id;
        }
        ids.push(photo.attachmentId!);
      }
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          id: attempt.id,
          text: attempt.text,
          ...(ids.length ? { attachmentIds: ids } : {}),
          ...(attempt.confirmationNonce
            ? { confirmationNonce: attempt.confirmationNonce }
            : {}),
          ...(attempt.quickReply ? { quickReply: attempt.quickReply } : {}),
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) {
        if (r.status === 429) setError(words.rate);
        throw Error();
      }
      snapshotSequence.current++;
      snapshot((await r.json()).conversation);
      setAttempts((a) => a.filter((m) => m.id !== attempt.id));
      attempt.photos.forEach((p) => {
        URL.revokeObjectURL(p.preview);
        ownedUrls.current.delete(p.preview);
      });
      input.current?.focus();
    } catch {
      setAttempts((a) =>
        a.map((m) => (m.id === attempt.id ? { ...m, status: "failed" } : m)),
      );
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }
  function send(nonce?: string, key?: string) {
    const message = nonce
      ? words.confirmation
      : key
        ? (chat?.quickReplies?.choices.find((c) => c.key === key)?.label ?? "")
        : text.trim();
    if (busy || !ready || (!message && !photos.length)) return;
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      text: message,
      photos: key || nonce ? [] : photos,
      status: "pending",
      ...(nonce ? { confirmationNonce: nonce } : {}),
      ...(key && chat?.quickReplies
        ? {
            quickReply: {
              key,
              messageId: chat.quickReplies.messageId,
              replySetId: chat.quickReplies.replySetId,
              revision: chat.quickReplies.revision,
            },
          }
        : {}),
    };
    setAttempts((a) => [...a, attempt]);
    if (!key && !nonce) {
      setText("");
      setPhotos([]);
      draftRef.current = [];
    }
    void sendAttempt(attempt);
  }
  async function pick(files: FileList | null) {
    if (!files) return;
    setError("");
    if (draftRef.current.length + files.length > 4) {
      setError(d.photoError);
      return;
    }
    for (const file of Array.from(files)) {
      try {
        const blob = await prepareChatPhoto(file);
        if (draftRef.current.length >= 4) throw Error("IMAGE_LIMIT");
        const preview = URL.createObjectURL(blob);
        ownedUrls.current.add(preview);
        const photo = { requestId: crypto.randomUUID(), blob, preview };
        draftRef.current = [...draftRef.current, photo];
        setPhotos(draftRef.current);
      } catch (e) {
        setError(
          e instanceof Error && e.message === "HEIC_UNSUPPORTED"
            ? d.heic
            : d.photoError,
        );
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  function removePhoto(id: string) {
    const p = photos.find((p) => p.requestId === id);
    if (p) {
      URL.revokeObjectURL(p.preview);
      ownedUrls.current.delete(p.preview);
    }
    draftRef.current = photos.filter((p) => p.requestId !== id);
    setPhotos(draftRef.current);
  }
  const visibleAttempts = attempts.filter(
    (a) => !chat?.messages.some((m) => m.requestId === a.id),
  );
  return (
    <div className="website-chat">
      {open ? (
        <section
          ref={panel}
          className="website-chat-panel"
          role="dialog"
          aria-label={words.title}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Tab") {
              const nodes = panel.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),textarea,input",
              );
              if (!nodes?.length) return;
              const first = nodes[0],
                last = nodes[nodes.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <header>
            <div className="chat-avatar" aria-hidden="true">
              {alias.charAt(0)}
            </div>
            <div>
              <h2>
                {alias} {chat && <span>· LumaClean</span>}
              </h2>
              <p>
                {chat?.control === "HUMAN_CONTROL"
                  ? words.human
                  : locale==='ru'?'AI-администратор · Belgrade':locale==='en'?'AI assistant · Belgrade':locale==='sr-Cyrl'?'AI администратор · Београд':'AI administrator · Beograd'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={words.close}
            >
              <X size={20} />
            </button>
          </header>
          <div
            ref={list}
            className="website-chat-history"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            onScroll={() => {
              const el = list.current;
              if (el) {
                nearBottom.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                if (nearBottom.current) setNewMessages(false);
              }
            }}
          >
            <div className="website-chat-intro">
              <small>{chat ? `${alias} · LumaClean` : "LumaClean"}</small>
              <p>{words.intro}</p>
            </div>
            {chat?.messages.map((m, i) => {
              const previous = chat.messages[i - 1],
                group =
                  previous?.author === m.author &&
                  Date.parse(m.sentAt) - Date.parse(previous.sentAt) < 120000;
              return (
                <article
                  key={m.id}
                  className={`${m.author === "CLIENT" ? "website-chat-client" : "website-chat-team"}${group ? " chat-grouped" : ""}`}
                >
                  {m.author !== "CLIENT" && !group && (
                    <small>{alias} · LumaClean</small>
                  )}
                  {m.text && <p>{m.text}</p>}
                  {m.attachments?.length > 0 && (
                    <ChatPhotos photos={m.attachments} label={d.photo} locale={locale} />
                  )}
                  <footer>
                    <time dateTime={m.sentAt}>
                      {new Intl.DateTimeFormat("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(m.sentAt))}
                    </time>
                    {m.author === "CLIENT" && (
                      <span
                        role="img"
                        aria-label={m.readAt ? d.read : d.sent}
                        title={m.readAt ? d.read : d.sent}
                      >
                        {m.readAt ? (
                          <CheckCheck size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                      </span>
                    )}
                  </footer>
                  {chat.quickReplies?.messageId === m.id &&
                    !attempts.length && (
                      <div className="chat-quick-replies">
                        {chat.quickReplies.choices.map((q) => (
                          <button
                            type="button"
                            key={q.key}
                            disabled={busy}
                            onClick={() => send(undefined, q.key)}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    )}
                </article>
              );
            })}
            {visibleAttempts.map((a) => (
              <article key={a.id} className="website-chat-client chat-attempt">
                <p>{a.text}</p>
                {a.photos.length > 0 && (
                  <div className="chat-photo-grid">
                    {a.photos.map((p) => (
                      <img key={p.requestId} src={p.preview} alt={d.photo} />
                    ))}
                  </div>
                )}
                <footer>
                  {a.status === "failed" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void sendAttempt(a)}
                    >
                      <RotateCcw size={12} />
                      {d.retry}
                    </button>
                  ) : (
                    <span role="img" aria-label={locale === "en" ? "Sending" : locale === "sr-Latn" ? "Slanje" : locale === "sr-Cyrl" ? "Слање" : "Отправляется"}>
                      <Clock size={13} />
                    </span>
                  )}
                </footer>
              </article>
            ))}
            {chat?.control === "HUMAN_CONTROL" && (
              <p className="chat-control-event">
                {alias}{" "}
                {chat.messages.some((m) => m.author === "ADMIN")
                  ? d.here
                  : d.handed}
              </p>
            )}
            {chat?.notifications?.map((n) => (
              <article className="website-chat-team" key={n.id}>
                <p>{n.text}</p>
              </article>
            ))}
            {chat?.typing && (
              <div
                className="chat-typing"
                role="status"
                aria-label={`${alias} ${d.typing}`}
              >
                <span />
                <span />
                <span />
                <small>
                  {alias} {d.typing}
                </small>
              </div>
            )}
            {chat?.confirmation && (
              <div className="website-chat-confirmation">
                <h3>{words.recap}</h3>
                <Recap value={chat.confirmation.recap} locale={locale} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send(chat.confirmation!.nonce)}
                >
                  {words.confirm}
                  <Check size={16} />
                </button>
              </div>
            )}
            {chat?.booking && (
              <div className="website-chat-confirmation">
                <h3>
                  {words.booked} <Check size={17} />
                </h3>
                <small>{chat.booking.reference}</small>
                <Recap value={chat.booking.recap} locale={locale} />
                <button type="button" onClick={() => input.current?.focus()}>
                  {d.question}
                </button>
              </div>
            )}
          </div>
          {newMessages && (
            <button
              type="button"
              className="chat-new-messages"
              onClick={bottom}
            >
              {d.newMessages}
              <ArrowDown size={14} />
            </button>
          )}
          {(error || !online || (chat?.pending && !chat.typing)) && (
            <div className="website-chat-status" role="status">
              {!online ? d.offline : error || words.wait}
            </div>
          )}
          {photos.length > 0 && (
            <div className="chat-draft-photos">
              {photos.map((p) => (
                <div key={p.requestId}>
                  <img src={p.preview} alt={d.photo} />
                  <button
                    type="button"
                    aria-label={d.remove}
                    onClick={() => removePhoto(p.requestId)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              ref={fileInput}
              type="file"
              hidden
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={(e) => void pick(e.target.files)}
            />
            <button
              type="button"
              className="chat-attach"
              disabled={
                busy || photos.length >= 4 || chat?.control === "CLOSED"
              }
              aria-label={d.attach}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={20} />
            </button>
            <textarea
              ref={input}
              aria-label={words.placeholder}
              placeholder={words.placeholder}
              maxLength={1500}
              rows={1}
              value={text}
              disabled={chat?.control === "CLOSED" || !ready}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={
                busy ||
                !ready ||
                (!text.trim() && !photos.length) ||
                chat?.control === "CLOSED"
              }
              aria-label={words.send}
            >
              <ArrowUp size={19} />
            </button>
          </form>
        </section>
      ) : (
        <button
          ref={launcher}
          className="website-chat-launcher"
          type="button"
          aria-expanded={false}
          aria-label={words.open}
          onClick={() => {
            setUnread(0);
            openRef.current = true;
            setOpen(true);
          }}
        >
          <MessageCircle size={21} />
          <span className="chat-launcher-full">{words.open}</span>
          {unread > 0 && (
            <b aria-label={`${unread} ${locale === "en" ? "unread" : locale === "sr-Latn" ? "nepročitano" : locale === "sr-Cyrl" ? "непрочитано" : "непрочитанных"}`}>
              {unread > 99 ? "99+" : unread}
            </b>
          )}
        </button>
      )}
    </div>
  );
}
