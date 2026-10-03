import type { DatasetStatus } from "@/lib/infrastructure/motis-routing";
import { BrowserMapsDiagnostic } from "./live-readiness-controls";
import type {busMapsUsage} from "@/lib/services/busmaps-store";
export function LogisticsStatus({ status: s,busmaps,routingStatus }: { status: DatasetStatus;busmaps:Awaited<ReturnType<typeof busMapsUsage>>;routingStatus:string }) {
  const ratio = (v?: number) =>
    v === undefined ? "нет данных" : `${(v * 100).toFixed(1)}%`;
  return (
    <section className="crm-section" id="logistics">
      <h2>Logistics</h2>
      <p>Routing: <strong>{routingStatus}</strong>. Google, BusLogic RT и одобрение BusMaps не являются обязательными условиями. Непроверенный transit использует резерв 80 минут.</p>
      <dl className="crm-facts">
        <div><dt>BusMaps</dt><dd>{busmaps.status}{busmaps.status==="PENDING_APPROVAL"?" · ожидает одобрения, API-запросы выключены":""}</dd></div>
        <div><dt>BusMaps за месяц</dt><dd>{busmaps.requests} / {busmaps.limit} запросов · cache {busmaps.cacheHits} · ошибки {busmaps.errors} · LIVE {busmaps.liveLegs} · fallback {busmaps.fallbackLegs}</dd></div>
        <div>
          <dt>MOTIS</dt>
          <dd>
            {s.engine.healthy
              ? `Работает · ${s.engine.version ?? ""}`
              : "Недоступен: резерв 80 минут при подтверждённых координатах"}
          </dd>
        </div>
        <div>
          <dt>OSM</dt>
          <dd>{s.osm?.version ?? "Нет подготовленного набора"}</dd>
        </div>
        {s.static.datasets.map((d) => (
          <div key={d.name}>
            <dt>{d.name}</dt>
            <dd>
              Версия {d.version} · {d.ageDays} дней · календарь до{" "}
              {d.validUntil} · {d.valid ? "структура проверена" : "невалиден"}
            </dd>
          </div>
        ))}
        <div>
          <dt>Static информация</dt>
          <dd>
            {s.static.valid
              ? "Готов"
              : "Проверьте календарь и наборы данных; hard feasibility использует резерв"}
          </dd>
        </div>
        <div>
          <dt>GTFS-RT · необязательный монитор</dt>
          <dd>
            {s.realtime.status} ·{" "}
            {s.realtime.freshnessSeconds == null
              ? "свежесть неизвестна"
              : `${Math.round(s.realtime.freshnessSeconds)} сек`}{" "}
            · условия использования{" "}
            {s.realtime.licenseConfirmed ? "подтверждены" : "не подтверждены"}
          </dd>
        </div>
        <div>
          <dt>RT/static ID</dt>
          <dd>
            Trip {ratio(s.realtime.tripMatchRatio)} · route{" "}
            {ratio(s.realtime.routeMatchRatio)} · stop{" "}
            {ratio(s.realtime.stopMatchRatio)} · пригодно{" "}
            {s.realtime.percentageUsable === undefined
              ? "нет данных"
              : s.realtime.percentageUsable.toFixed(1) + "%"}
          </dd>
        </div>
        <div>
          <dt>RT entities</dt>
          <dd>
            {s.realtime.entitiesReceived ?? "—"} · TripUpdates{" "}
            {s.realtime.tripUpdates ?? "—"} · VehiclePositions{" "}
            {s.realtime.vehiclePositions ?? "—"}
          </dd>
        </div>
        <div>
          <dt>Пороги LIVE</dt>
          <dd>
            RT ≤ {s.thresholds?.maxAgeSeconds ?? 120} сек · ID ≥{" "}
            {ratio(s.thresholds?.minMatchRatio ?? 0.8)} · GTFS ≤{" "}
            {s.thresholds?.maxStaticAgeDays ?? 365} дней
          </dd>
        </div>
        <div>
          <dt>Дорога</dt>
          <dd>
            {s.routingReadiness ?? "FALLBACK_80"} · пешие маршруты работают
            независимо от RT
          </dd>
        </div>
        <div>
          <dt>Обновление</dt>
          <dd>
            {s.update?.busy
              ? "Подготовка нового набора; работает предыдущий"
              : s.update?.lastError
                ? "Новая версия отклонена; предыдущая сохранена"
                : "Ежедневная проверка GTFS; OSM раз в 7 дней"}
          </dd>
        </div>
        <div>
          <dt>Карта</dt>
          <dd>MapLibre / OpenFreeMap · необязательна</dd>
        </div>
      </dl>
      <p>
        Первый выезд: только дорога. Между уборками: дорога + отдельный буфер 30
        минут. Непроверенный транспорт: 80 минут + буфер.
      </p>
      <BrowserMapsDiagnostic />
    </section>
  );
}
