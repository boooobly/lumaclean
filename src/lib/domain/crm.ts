import { parsePhoneNumberWithError } from "libphonenumber-js/max";
import { Temporal } from "@js-temporal/polyfill";

import {
  CrmError,
  leadTransitions,
  orderTransitions,
  type LeadState,
  type OrderState,
} from "./crm-types";
export * from "./crm-types";
export function normalizedPhone(input: string | null | undefined): string | null {
  const value = input?.trim() ?? "";
  // National numbers need an explicit Serbian trunk prefix. Bare foreign numbers remain unknown.
  if (
    !value.startsWith("+") &&
    !value.startsWith("00") &&
    !value.startsWith("0")
  )
    return null;
  try {
    const number = parsePhoneNumberWithError(
      value.startsWith("00") ? `+${value.slice(2)}` : value,
      { defaultCountry: "RS", extract: false },
    );
    return number.isValid() && !number.ext ? number.number : null;
  } catch {
    return null;
  }
}
export function localInstant(value: string): Date {
  try {
    const plain = Temporal.PlainDateTime.from(value);
    // Reject both missing and ambiguous wall times at DST changes instead of silently guessing.
    return new Date(
      plain.toZonedDateTime("Europe/Belgrade", { disambiguation: "reject" })
        .epochMilliseconds,
    );
  } catch {
    throw new CrmError(
      "VALIDATION",
      "Укажите корректное время Белграда. В час смены времени выберите другое время.",
      "scheduledStart",
    );
  }
}
export function localInput(value: Date | null): string {
  if (!value) return "";
  return Temporal.Instant.from(value.toISOString())
    .toZonedDateTimeISO("Europe/Belgrade")
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function assertTransition(
  kind: "Lead" | "Order",
  from: LeadState | OrderState,
  to: LeadState | OrderState,
) {
  const allowed =
    kind === "Lead"
      ? leadTransitions[from as LeadState]
      : orderTransitions[from as OrderState];
  if (!allowed.includes(to as never))
    throw new CrmError(
      "TRANSITION",
      "Этот переход статуса недоступен.",
      "status",
    );
}
