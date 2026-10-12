import { CrmError } from "./crm-types";

export function assertRecordVersion(updatedAt: Date, expected?: string) {
  if (expected && updatedAt.toISOString() !== expected)
    throw new CrmError("STALE", "Запись изменилась. Обновите страницу и проверьте условия.");
}

export function calendarOrderVisible(status: string, showCancelled: boolean) {
  return showCancelled || !["CANCELLED", "NO_SHOW"].includes(status);
}
