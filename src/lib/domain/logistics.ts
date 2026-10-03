import { Temporal } from "@js-temporal/polyfill";
import {DEFAULT_FALLBACK_TRAVEL_MINUTES} from "./routing-policy";
import {
  SchedulingConflictService,
  plannedEnd,
  localDayStart,
  plainDate,
  BUSINESS_ZONE,
  type PlanningOrder,
  type PlanningCleaner,
} from "./scheduling-conflicts";
import {
  durationOf,
  releasedStatuses,
  type SchedulingIssue,
} from "./scheduling-types";
import {
  routeKey,
  routeSample,
  routeUsable,
  unavailable,
  ROUTING_CONFIG,
  SCORE_WEIGHTS,
  type GeoPoint,
  type RouteRequest,
  type RouteResult,
} from "./routing";
export type RoutingOrder = PlanningOrder & {
  point: GeoPoint | null;
  label: string;
  reference: string;
  updatedAt: string;
  addressId: string;
};
export type RoutingCleaner = PlanningCleaner & {
  home: GeoPoint | null;
  name: string;
  updatedAt: string;
};
export type RoutingSnapshot = {
  date: string;
  orders: RoutingOrder[];
  cleaners: RoutingCleaner[];
  defaultBuffer: number;
  version: string;
};
export type TravelLeg = {
  cleanerId: string;
  cleaner: string;
  previousId: string | null;
  orderId: string;
  origin: string;
  destination: string;
  request: RouteRequest;
  route: RouteResult;
  bufferMinutes: number;
  earliestArrival: string | null;
  recommendedDeparture: string | null;
  conflict: boolean;
};
export type RouteTable = Map<string, RouteResult>;
export const travelBuffer = (
  fallback: number,
  a: PlanningOrder,
  b: PlanningOrder,
) => Math.max(fallback, a.travelBufferMinutes, b.travelBufferMinutes);
export function activeOrders(orders: RoutingOrder[]) {
  return orders.filter(
    (o) => !releasedStatuses.includes(o.status) && o.scheduledStart,
  );
}
export function travelRequests(
  snapshot: RoutingSnapshot,
  orders = snapshot.orders,
  onlyCrew?: string[],
): Omit<
  TravelLeg,
  "route" | "earliestArrival" | "recommendedDeparture" | "conflict"
>[] {
  const legs: ReturnType<typeof travelRequests> = [];
  for (const cleaner of snapshot.cleaners.filter(
    (c) => !onlyCrew || onlyCrew.includes(c.id),
  )) {
    const timeline = activeOrders(orders)
      .filter((o) => o.cleanerIds.includes(cleaner.id))
      .sort(
        (a, b) =>
          a.scheduledStart!.getTime() - b.scheduledStart!.getTime() ||
          a.id.localeCompare(b.id),
      );
    let previous: RoutingOrder | null = null;
    for (const order of timeline) {
      if (order.status === "COMPLETED") {
        previous = order;
        continue;
      }
      if (plainDate(order.scheduledStart!).toString() !== snapshot.date) {
        previous = order;
        continue;
      }
      const sameDay =
        previous &&
        plainDate(previous.scheduledStart!).toString() === snapshot.date;
      const before = sameDay ? previous : null;
      const departure = before ? plannedEnd(before) : null;
      const request: RouteRequest = {
        origin: before ? (departure ? before.point : null) : cleaner.home,
        destination: order.point,
        mode: "TRANSIT",
        timing: before ? "departure" : "arrival",
        at:
          before && departure
            ? new Date(
                departure.getTime() + before.cleaningReserveMinutes * 60000,
              ).toISOString()
            : order.scheduledStart!.toISOString(),
      };
      legs.push({
        cleanerId: cleaner.id,
        cleaner: cleaner.name,
        previousId: before?.id ?? null,
        orderId: order.id,
        origin: before?.label ?? "Стартовая точка · " + cleaner.name,
        destination: order.label,
        request,
        bufferMinutes: before
          ? travelBuffer(snapshot.defaultBuffer, before, order)
          : 0,
      });
      previous = order;
    }
  }
  return legs;
}
export function assessTravel(
  snapshot: RoutingSnapshot,
  table: RouteTable,
  orders = snapshot.orders,
  onlyCrew?: string[],
): TravelLeg[] {
  return travelRequests(snapshot, orders, onlyCrew).map((leg) => {
    const raw = table.get(routeKey(leg.request));
    const route = raw?.quality === "STATIC_CANDIDATE"
      ? {...raw,quality:"FALLBACK_80" as const,durationSeconds:DEFAULT_FALLBACK_TRAVEL_MINUTES*60,reason:"STATIC_NOT_HARD_PROOF"}
      : raw ?? unavailable(leg.request);
    const actual =
      route.status === "VERIFIED" && !routeUsable(route)
        ? { ...route, status: "STALE" as const }
        : route;
    const order = orders.find((o) => o.id === leg.orderId)!;
    const sample = new Date(route.source!=="Google"?leg.request.at:routeSample(leg.request)).getTime(),
      verified = routeUsable(actual);
    const earliest = verified
      ? leg.previousId
        ? sample + actual.durationSeconds! * 1000 + leg.bufferMinutes * 60000
        : sample
      : null;
    const exit = verified
      ? leg.previousId
        ? sample
        : sample - actual.durationSeconds! * 1000
      : null;
    return {
      ...leg,
      route: actual,
      earliestArrival:
        earliest === null ? null : new Date(earliest).toISOString(),
      recommendedDeparture: exit === null ? null : new Date(exit).toISOString(),
      conflict:
        verified &&
        (earliest! > order.scheduledStart!.getTime() ||
          (!leg.previousId && exit! < localDayStart(snapshot.date).getTime())),
    };
  });
}
export function routeIssues(legs: TravelLeg[]): SchedulingIssue[] {
  return legs.flatMap((leg) => {
    const code = leg.conflict
      ? leg.previousId
        ? "TRAVEL_TIME_CONFLICT"
        : "START_LOCATION_CONFLICT"
      : routeUsable(leg.route)
        ? ""
        : leg.route.status === "PROVIDER_ERROR" ||
            leg.route.status === "NO_ROUTE"
          ? "ROUTE_PROVIDER_ERROR"
          : "ROUTE_UNVERIFIED";
    if (!code) return [];
    const message = leg.conflict
      ? `${leg.cleaner}: не успевает — безопасное прибытие ${leg.earliestArrival}.`
      : `${leg.cleaner}: ${leg.route.status === "STALE" ? "маршрут устарел" : code === "ROUTE_PROVIDER_ERROR" ? "Расчёт дороги недоступен / маршрут не найден" : "маршрут не проверен — подтвердите координаты адреса"}.`;
    return [
      {
        key: [
          code,
          leg.cleanerId,
          leg.previousId ?? "home",
          leg.orderId,
          routeKey(leg.request),
          leg.bufferMinutes,
          leg.route.durationSeconds,
        ].join(":"),
        code,
        message,
        severity: leg.conflict ? ("ERROR" as const) : ("WARNING" as const),
        cleanerId: leg.cleanerId,
        orderId: leg.orderId,
      },
    ];
  });
}
function hardIssues(
  order: RoutingOrder,
  snapshot: RoutingSnapshot,
  orders: RoutingOrder[],
) {
  return SchedulingConflictService.check(
    order,
    snapshot.cleaners,
    orders,
    snapshot.defaultBuffer,
  ).filter((i) => i.code !== "OPERATING_GAP" && i.code !== "UNDERSTAFFED");
}
export function candidateStarts(
  order: RoutingOrder,
  snapshot: RoutingSnapshot,
): Date[] {
  if (
    order.scheduleMode === "FIXED" ||
    ["EN_ROUTE", "IN_PROGRESS", "COMPLETED"].includes(order.status)
  )
    return order.scheduledStart ? [order.scheduledStart] : [];
  const duration = durationOf(order);
  if (!duration || !order.windowFrom || !order.windowTo) return [];
  const day = Temporal.PlainDate.from(snapshot.date),
    from = Math.max(
      order.windowFrom.getTime(),
      localDayStart(snapshot.date).getTime(),
    ),
    to = Math.min(
      order.windowTo.getTime() - duration * 60000,
      localDayStart(day.add({ days: 1 }).toString()).getTime() -
        duration * 60000,
    );
  if (from > to) return [];
  const times = new Set<number>([from, to]);
  if (
    order.scheduledStart &&
    order.scheduledStart.getTime() >= from &&
    order.scheduledStart.getTime() <= to
  )
    times.add(order.scheduledStart.getTime());
  for (const other of snapshot.orders) {
    const end = plannedEnd(other);
    if (end)
      times.add(
        end.getTime() +
          (other.cleaningReserveMinutes +
            travelBuffer(snapshot.defaultBuffer, other, order)) *
            60000,
      );
    if (other.scheduledStart)
      times.add(
        other.scheduledStart.getTime() -
          (duration +
            order.cleaningReserveMinutes +
            travelBuffer(snapshot.defaultBuffer, order, other)) *
            60000,
      );
  }
  for (const cleaner of snapshot.cleaners)
    for (const row of cleaner.availability) {
      if (
        row.startMinute === null ||
        row.kind === "UNAVAILABLE" ||
        (row.date
          ? row.date.toISOString().slice(0, 10) !== snapshot.date
          : row.weekday !== day.dayOfWeek)
      )
        continue;
      times.add(
        day
          .toZonedDateTime({ timeZone: BUSINESS_ZONE, plainTime: "00:00" })
          .add({ minutes: row.startMinute }).epochMilliseconds,
      );
    }
  const step = 15 * 60000;
  for (let i = 0; i < ROUTING_CONFIG.candidates; i++)
    times.add(
      Math.ceil(
        (from + ((to - from) * i) / (ROUTING_CONFIG.candidates - 1)) / step,
      ) * step,
    );
  const valid = [...times]
    .filter((t) => t >= from && t <= to)
    .sort((a, b) => a - b);
  if (valid.length <= ROUTING_CONFIG.candidates)
    return valid.map((t) => new Date(t));
  return [
    ...new Set(
      Array.from(
        { length: ROUTING_CONFIG.candidates },
        (_, i) =>
          valid[
            Math.round(
              (i * (valid.length - 1)) / (ROUTING_CONFIG.candidates - 1),
            )
          ],
      ),
    ),
  ].map((t) => new Date(t));
}
export function boundedTeams(
  ids: string[],
  count: number,
  preferred: string[] = [],
  max = 64,
): string[][] {
  if (count < 1 || count > ids.length) return [];
  const result: string[][] = [],
    sorted = [...ids].sort();
  if (preferred.length === count && preferred.every((id) => ids.includes(id)))
    result.push([...preferred].sort());
  const walk = (index: number, chosen: string[]) => {
    if (result.length >= max) return;
    if (chosen.length === count) {
      if (!result.some((r) => r.join() === chosen.join())) result.push(chosen);
      return;
    }
    for (
      let i = index;
      i <= sorted.length - (count - chosen.length) && result.length < max;
      i++
    )
      walk(i + 1, [...chosen, sorted[i]]);
  };
  walk(0, []);
  return result;
}
export type Slot = {
  start: string;
  duration: number;
  cleanerIds: string[];
  cleaners: string[];
  travelMinutes: number;
  legs: TravelLeg[];
  score: number;
  warnings: string[];
};
export class AvailabilityService {
  static findAvailableSlots(
    order: RoutingOrder,
    snapshot: RoutingSnapshot,
    table: RouteTable,
    maximum = 12,
    budget?: { remaining: number },
  ): Slot[] {
    if (!order.point || ![...table.values()].some((r) => routeUsable(r)))
      return [];
    const options: Slot[] = [];
    for (const start of candidateStarts(order, snapshot)) {
      if (budget && budget.remaining <= 0) break;
      const eligible = snapshot.cleaners
        .filter(
          (c) =>
            c.active &&
            !hardIssues(
              { ...order, scheduledStart: start, cleanerIds: [c.id] },
              snapshot,
              snapshot.orders,
            ).length,
        )
        .map((c) => c.id);
      for (const ids of boundedTeams(
        eligible,
        order.requiredCleaners,
        order.cleanerIds,
      )) {
        if (budget && --budget.remaining < 0) break;
        const candidate = { ...order, scheduledStart: start, cleanerIds: ids },
          orders = [
            ...snapshot.orders.filter((o) => o.id !== order.id),
            candidate,
          ];
        if (hardIssues(candidate, snapshot, orders).length) continue;
        const legs = assessTravel(snapshot, table, orders, ids);
        if (legs.some((l) => !routeUsable(l.route) || l.conflict)) continue;
        const relevant = legs.filter(
          (l) => l.orderId === order.id || l.previousId === order.id,
        );
        const travel =
          relevant.reduce((n, l) => n + l.route.durationSeconds!, 0) / 60;
        options.push({
          start: start.toISOString(),
          duration: durationOf(order)!,
          cleanerIds: ids,
          cleaners: ids.map(
            (id) => snapshot.cleaners.find((c) => c.id === id)!.name,
          ),
          travelMinutes: Math.ceil(travel),
          legs: relevant,
          score: travel * SCORE_WEIGHTS.travel,
          warnings: [],
        });
      }
    }
    return options
      .sort(
        (a, b) =>
          a.score - b.score ||
          a.start.localeCompare(b.start) ||
          a.cleanerIds.join().localeCompare(b.cleanerIds.join()),
      )
      .slice(0, maximum);
  }
}
export function preparationRequests(
  snapshot: RoutingSnapshot,
  targets: RoutingOrder[],
): RouteRequest[] {
  const requests = new Map<string, RouteRequest>();
  const add = (request: RouteRequest) =>
    requests.set(routeKey(request), request);
  for (const leg of travelRequests(snapshot)) add(leg.request);
  const variants = [
    ...snapshot.orders.filter((o) => o.scheduledStart),
    ...targets.flatMap((o) =>
      candidateStarts(o, snapshot).map((start) => ({
        ...o,
        scheduledStart: start,
      })),
    ),
  ];
  for (const target of variants) {
    if (
      !target.scheduledStart ||
      plainDate(target.scheduledStart).toString() !== snapshot.date
    )
      continue;
    for (const cleaner of snapshot.cleaners.filter((c) => c.active))
      add({
        origin: cleaner.home,
        destination: target.point,
        mode: "TRANSIT",
        at: target.scheduledStart.toISOString(),
        timing: "arrival",
      });
    for (const before of variants) {
      if (requests.size >= 5000) return [...requests.values()];
      const end = plannedEnd(before);
      if (
        before.id === target.id ||
        !end ||
        end > target.scheduledStart ||
        plainDate(before.scheduledStart!).toString() !== snapshot.date
      )
        continue;
      add({
        origin: before.point,
        destination: target.point,
        mode: "TRANSIT",
        at: new Date(
          end.getTime() + before.cleaningReserveMinutes * 60000,
        ).toISOString(),
      });
    }
  }
  return [...requests.values()];
}
export type OptimizerResult = {
  orders: RoutingOrder[];
  unplaced: string[];
  travelMinutes: number;
  loads: { id: string; name: string; minutes: number }[];
  explanations: string[];
  bounded: boolean;
  feasible: boolean;
};
function planScore(
  snapshot: RoutingSnapshot,
  orders: RoutingOrder[],
  table: RouteTable,
) {
  const legs = assessTravel(snapshot, table, orders),
    travel = legs.reduce((n, l) => n + (l.route.durationSeconds ?? 0) / 60, 0);
  const loads = snapshot.cleaners.map((c) => ({
    id: c.id,
    name: c.name,
    minutes: orders
      .filter((o) => o.scheduledStart && o.cleanerIds.includes(c.id))
      .reduce((n, o) => n + (durationOf(o) ?? 0), 0),
  }));
  let idle = 0;
  for (const leg of legs)
    if (leg.previousId && leg.earliestArrival)
      idle += Math.max(
        0,
        (orders.find((o) => o.id === leg.orderId)!.scheduledStart!.getTime() -
          new Date(leg.earliestArrival).getTime()) /
          60000,
      );
  const imbalance =
    loads.reduce((n, l) => n + l.minutes * l.minutes, 0) /
    Math.max(1, loads.length * 60);
  const moved = orders.filter(
    (o) =>
      o.scheduledStart?.toISOString() !==
      snapshot.orders
        .find((old) => old.id === o.id)
        ?.scheduledStart?.toISOString(),
  ).length;
  const changed = orders.filter(
    (o) =>
      [...o.cleanerIds].sort().join() !==
      [...(snapshot.orders.find((old) => old.id === o.id)?.cleanerIds ?? [])]
        .sort()
        .join(),
  ).length;
  return {
    score:
      travel * SCORE_WEIGHTS.travel +
      idle * SCORE_WEIGHTS.idle +
      imbalance * SCORE_WEIGHTS.imbalance +
      moved * SCORE_WEIGHTS.movedFlexible +
      changed * SCORE_WEIGHTS.changedAssignment,
    travel,
    loads,
  };
}
export class ScheduleOptimizer {
  static propose(
    snapshot: RoutingSnapshot,
    table: RouteTable,
  ): OptimizerResult {
    const targets = snapshot.orders
      .filter(
        (o) =>
          (o.scheduledStart || o.windowFrom) &&
          plainDate(o.scheduledStart ?? o.windowFrom!).toString() ===
            snapshot.date &&
          ![
            "COMPLETED",
            "CANCELLED",
            "NO_SHOW",
            "EN_ROUTE",
            "IN_PROGRESS",
          ].includes(o.status),
      )
      .sort(
        (a, b) =>
          (a.scheduleMode === "FIXED" ? -1 : 1) -
            (b.scheduleMode === "FIXED" ? -1 : 1) || a.id.localeCompare(b.id),
      );
    let beam = [
        {
          orders: snapshot.orders.filter(
            (o) => !targets.some((t) => t.id === o.id),
          ),
          unplaced: [] as string[],
          score: 0,
        },
      ],
      nodes = 0,
      bounded = false;
    const budget = { remaining: ROUTING_CONFIG.maxNodes };
    for (const order of targets) {
      const next: typeof beam = [];
      for (const state of beam) {
        const current = { ...snapshot, orders: state.orders };
        const slots = AvailabilityService.findAvailableSlots(
          order,
          current,
          table,
          snapshot.orders.length > 12 ? 2 : 6,
          budget,
        );
        for (const slot of slots) {
          if (++nodes > ROUTING_CONFIG.maxNodes) {
            bounded = true;
            break;
          }
          const orders = [
            ...state.orders,
            {
              ...order,
              scheduledStart: new Date(slot.start),
              cleanerIds: slot.cleanerIds,
            },
          ];
          next.push({
            orders,
            unplaced: state.unplaced,
            score: planScore(snapshot, orders, table).score,
          });
        }
        next.push({
          orders: [...state.orders, order],
          unplaced: [...state.unplaced, order.id],
          score: state.score,
        });
      }
      beam = next
        .sort(
          (a, b) =>
            a.unplaced.length - b.unplaced.length ||
            a.score - b.score ||
            a.orders
              .map(
                (o) =>
                  o.id + o.scheduledStart?.toISOString() + o.cleanerIds.join(),
              )
              .join()
              .localeCompare(
                b.orders
                  .map(
                    (o) =>
                      o.id +
                      o.scheduledStart?.toISOString() +
                      o.cleanerIds.join(),
                  )
                  .join(),
              ),
        )
        .slice(0, snapshot.orders.length > 12 ? 1 : ROUTING_CONFIG.beamWidth);
      if (nodes >= ROUTING_CONFIG.maxNodes || budget.remaining <= 0)
        bounded = true;
    }
    const best = beam[0],
      stats = planScore(snapshot, best.orders, table),
      legs = assessTravel(snapshot, table, best.orders);
    const placed = activeOrders(best.orders).filter(
      (o) =>
        o.status !== "COMPLETED" &&
        plainDate(o.scheduledStart!).toString() === snapshot.date,
    );
    const feasible =
      placed.every(
        (o) =>
          o.cleanerIds.length >= o.requiredCleaners &&
          !hardIssues(o, snapshot, best.orders).length,
      ) && legs.every((l) => routeUsable(l.route) && !l.conflict);
    return {
      orders: best.orders,
      unplaced: best.unplaced,
      travelMinutes: Math.ceil(stats.travel),
      loads: stats.loads,
      bounded,
      feasible,
      explanations: [
        "Фиксированные договорённости сохранены. Проверены часы, команда, окна и оба соседних маршрута.",
        "Сначала минимизируется число неразмещённых заказов, затем дорога, простои, нагрузка и изменения договорённостей.",
        ...(bounded
          ? [
              "Достигнут предел поиска; показан лучший проверенный вариант, глобальный оптимум не гарантируется.",
            ]
          : []),
        ...(!feasible
          ? [
              "Подтверждённых маршрутов или исполнителей недостаточно. Применение недоступно.",
            ]
          : []),
      ],
    };
  }
}
