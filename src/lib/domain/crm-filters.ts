import type { Prisma } from "@/generated/prisma/client";
import {
  leadLabels,
  orderLabels,
  channelLabels,
  normalizedPhone,
  localInstant,
} from "./crm";
import { serviceIds } from "@/lib/pricing";
import { Temporal } from "@js-temporal/polyfill";
export type Query = Record<string, string | string[] | undefined>;
export const scalar = (query: Query, key: string) =>
  typeof query[key] === "string" ? query[key].slice(0, 100) : "";
export function listOptions(query: Query) {
  const raw = Number(scalar(query, "page"));
  return {
    page: Number.isInteger(raw) && raw > 0 ? Math.min(raw, 100000) : 1,
    size: 20,
    q: scalar(query, "q").trim(),
    sort:
      scalar(query, "sort") === "oldest" ? ("asc" as const) : ("desc" as const),
  };
}
const contains = (value: string) => ({
  contains: value,
  mode: "insensitive" as const,
});
export function leadWhere(query: Query): Prisma.LeadWhereInput {
  const { q } = listOptions(query),
    status = scalar(query, "status"),
    channel = scalar(query, "channel"),
    service = scalar(query, "service"),
    clientId = scalar(query, "clientId");
  return {
    ...(Object.hasOwn(leadLabels, status)
      ? { status: status as keyof typeof leadLabels }
      : {}),
    ...(Object.hasOwn(channelLabels, channel)
      ? { channel: channel as keyof typeof channelLabels }
      : {}),
    ...((serviceIds as readonly string[]).includes(service)
      ? { service: { code: service } }
      : {}),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { name: contains(q) },
            { phone: contains(q) },
            { reference: contains(q) },
            ...(normalizedPhone(q)
              ? [{ normalizedPhone: normalizedPhone(q)! }]
              : []),
          ],
        }
      : {}),
  };
}
export function clientWhere(query: Query): Prisma.ClientWhereInput {
  const { q } = listOptions(query),
    channel = scalar(query, "channel"),
    orders = scalar(query, "orders");
  return {
    ...(Object.hasOwn(channelLabels, channel)
      ? { preferredChannel: channel as keyof typeof channelLabels }
      : {}),
    ...(orders === "yes"
      ? { orders: { some: {} } }
      : orders === "no"
        ? { orders: { none: {} } }
        : {}),
    ...(q
      ? {
          OR: [
            { name: contains(q) },
            { phone: contains(q) },
            { telegram: contains(q) },
            { whatsapp: contains(q) },
            { viber: contains(q) },
            ...(normalizedPhone(q)
              ? [{ normalizedPhone: normalizedPhone(q)! }]
              : []),
          ],
        }
      : {}),
  };
}
export function orderWhere(query: Query): Prisma.OrderWhereInput {
  const { q } = listOptions(query),
    status = scalar(query, "status"),
    service = scalar(query, "service"),
    clientId = scalar(query, "clientId");
  const dates: Prisma.OrderWhereInput[] = [];
  for (const [key, op] of [
    ["from", "gte"],
    ["to", "lt"],
  ] as const) {
    const value = scalar(query, key);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try {
        const day = Temporal.PlainDate.from(value);
        const boundary = localInstant(
          `${key === "to" ? day.add({ days: 1 }) : day}T00:00`,
        );
        dates.push({
          OR: [
            { scheduledStart: { [op]: boundary } },
            { scheduleMode: "FLEXIBLE", windowFrom: { [op]: boundary } },
          ],
        });
      } catch {
        /* Invalid date filter has no database effect. */
      }
    }
  }
  return {
    ...(Object.hasOwn(orderLabels, status)
      ? { status: status as keyof typeof orderLabels }
      : {}),
    ...((serviceIds as readonly string[]).includes(service)
      ? { service: { code: service } }
      : {}),
    ...(clientId ? { clientId } : {}),
    ...(dates.length ? { AND: dates } : {}),
    ...(q
      ? {
          OR: [
            { reference: contains(q) },
            { id: contains(q) },
            { client: { name: contains(q) } },
            { client: { phone: contains(q) } },
            { address: { fullAddress: contains(q) } },
          ],
        }
      : {}),
  };
}
