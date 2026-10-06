const zone = "Europe/Belgrade";
export const channelNames: Record<string, string> = { WEBSITE: "Сайт", WHATSAPP: "WhatsApp", TELEGRAM: "Telegram", VIBER: "Viber" };
export const handoffNames: Record<string, string> = { UNCERTAINTY: "нужно уточнение", OUT_OF_SCOPE: "нестандартная уборка", COMPLAINT: "жалоба", USER_REQUEST: "клиент попросил оператора", DELIVERY_FAILURE: "ошибка доставки" };
export const deliveryNames: Record<string, string> = { PENDING: "Отправляется", SENDING: "Отправляется", SENT: "Отправлено", DELIVERED: "Доставлено", READ: "Прочитано", FAILED: "Не доставлено", REJECTED: "Не доставлено", UNKNOWN: "Доставка не подтверждена", CANCELLED: "Отменено" };
export function messageDay(iso: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); }
export function daySeparator(iso: string, now = new Date()) {
  if (messageDay(iso) === messageDay(now.toISOString())) return "Сегодня";
  const today = messageDay(now.toISOString());
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (messageDay(iso) === messageDay(yesterday.toISOString())) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", { timeZone: zone, day: "numeric", month: "long", ...(messageDay(iso).slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) }).format(new Date(iso));
}
export function groupedMessages(a: { author: string; sentAt: string } | undefined, b: { author: string; sentAt: string }) {
  const gap = a ? new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime() : -1;
  return Boolean(a && a.author === b.author && messageDay(a.sentAt) === messageDay(b.sentAt) && gap >= 0 && gap < 5 * 60000);
}
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? "").join("").toUpperCase() || "?"; }
export function matchesConversation(row: { name: string; phone?: string | null; lastMessage: string; channel: string }, search: string) {
  return `${row.name} ${row.phone ?? ""} ${row.lastMessage} ${channelNames[row.channel] ?? row.channel}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
}
