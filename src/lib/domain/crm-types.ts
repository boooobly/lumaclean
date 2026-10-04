export const leadLabels = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  WAITING_CLIENT: "Ждём клиента",
  READY_TO_BOOK: "Готова к заказу",
  CONVERTED: "Заказ создан",
  LOST: "Закрыта без заказа",
} as const;
export const orderLabels = {
  DRAFT: "Черновик",
  CONFIRMED: "Подтверждён",
  SCHEDULED: "Запланирован",
  EN_ROUTE: "В пути",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
  NO_SHOW: "Клиент не явился",
} as const;
export const channelLabels = {
  WEBSITE: "Сайт",
  TELEGRAM: "Telegram",
  WHATSAPP: "WhatsApp",
  VIBER: "Viber",
  MANUAL: "Вручную",
  OTHER: "Другой",
} as const;
export const soilLabels = {
  LIGHT: "Лёгкое",
  NORMAL: "Обычное",
  HEAVY: "Сильное",
  EXTREME: "Очень сильное",
} as const;
export const serviceLabels = {
  regular: "Поддерживающая уборка",
  deep: "Генеральная уборка",
  move: "Въезд / выезд",
  airbnb: "Airbnb",
  office: "Уборка офиса",
} as const;
export const extraLabels = {
  standardWindow: "Стандартное окно",
  largeWindow: "Большое окно",
  balcony: "Балкон",
  fridge: "Холодильник",
  oven: "Духовка",
  cabinets: "Шкафы",
  ironing: "Глажка, часов",
  steam: "Паровая обработка",
  linen: "Смена белья",
  petHair: "Шерсть животных",
} as const;
export type LeadState = keyof typeof leadLabels;
export type OrderState = keyof typeof orderLabels;
export const leadTransitions: Record<LeadState, readonly LeadState[]> = {
  NEW: ["IN_PROGRESS", "WAITING_CLIENT", "READY_TO_BOOK", "LOST"],
  IN_PROGRESS: ["WAITING_CLIENT", "READY_TO_BOOK", "LOST"],
  WAITING_CLIENT: ["IN_PROGRESS", "READY_TO_BOOK", "LOST"],
  READY_TO_BOOK: ["IN_PROGRESS", "WAITING_CLIENT", "LOST"],
  CONVERTED: [],
  LOST: ["IN_PROGRESS"],
};
export const orderTransitions: Record<OrderState, readonly OrderState[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["EN_ROUTE", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  EN_ROUTE: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};
export class CrmError extends Error {
  constructor(
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}
