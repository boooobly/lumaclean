"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LibreMap } from "maplibre-gl";
import { decodeRouteGeometry } from "@/lib/domain/route-geometry";
import type { GeoPoint } from "@/lib/domain/routing";
type MapPoint = { id: string; label: string; point: GeoPoint; kind: string };
export function RoutingMap({
  points,
  polyline,
  polylines,
  geometries,
  draggable = false,
  onMove,
}: {
  points: MapPoint[];
  polyline?: string;
  polylines?: string[];
  geometries?: { points: string; precision: number }[];
  draggable?: boolean;
  onMove?: (p: GeoPoint) => void;
}) {
  const node = useRef<HTMLDivElement>(null),
    [error, setError] = useState("");
  const serialized = JSON.stringify(points),
    geometry = JSON.stringify(
      geometries ??
        (polylines ?? (polyline ? [polyline] : [])).map((points) => ({
          points,
          precision: 5,
        })),
    );
  useEffect(() => {
    let cancelled = false,
      map: LibreMap | undefined;
    const timer = setTimeout(() => {
      if (!cancelled)
        setError(
          "Карта загружается медленно. Координаты можно подтвердить в полях ниже; расчёт дороги работает отдельно.",
        );
    }, 15000);
    void import("maplibre-gl")
      .then(
        ({ Map, Marker, LngLatBounds, NavigationControl, setWorkerUrl }) => {
          if (cancelled || !node.current) return;
          const locations: MapPoint[] = JSON.parse(serialized),
            lines: { points: string; precision: number }[] =
              JSON.parse(geometry);
          setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
          map = new Map({
            container: node.current,
            style: "https://tiles.openfreemap.org/styles/liberty",
            center: locations[0]
              ? [locations[0].point.longitude, locations[0].point.latitude]
              : [20.4612, 44.8125],
            zoom: locations.length === 1 ? 16 : 12,
            attributionControl: { compact: false },
          });
          map.addControl(new NavigationControl(), "top-right");
          map.on("error", () => {
            if (!cancelled)
              setError(
                "Карта временно недоступна. Адрес, координаты и расчёт дороги работают отдельно.",
              );
          });
          const bounds = new LngLatBounds();
          for (const p of locations) {
            const position: [number, number] = [
              p.point.longitude,
              p.point.latitude,
            ];
            bounds.extend(position);
            const element = document.createElement("span");
            element.className = "routing-map-pin";
            element.textContent =
              p.kind === "home" ? "С" : p.label.split(" · ")[0];
            element.title = p.label;
            const marker = new Marker({ element, draggable })
              .setLngLat(position)
              .addTo(map);
            if (draggable)
              marker.on("dragend", () => {
                const v = marker.getLngLat();
                onMove?.({ latitude: v.lat, longitude: v.lng });
              });
          }
          if (locations.length > 1)
            map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 });
          map.on("load", () => {
            clearTimeout(timer);
            if (cancelled || !map) return;
            for (let i = 0; i < lines.length; i++) {
              try {
                map.addSource("route-" + i, {
                  type: "geojson",
                  data: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "LineString",
                      coordinates: decodeRouteGeometry(
                        lines[i].points,
                        lines[i].precision,
                      ),
                    },
                  },
                });
                map.addLayer({
                  id: "route-" + i,
                  type: "line",
                  source: "route-" + i,
                  paint: { "line-color": "#267978", "line-width": 4 },
                });
              } catch {
                /* Geometry cannot block scheduling. */
              }
            }
          });
        },
      )
      .catch(() => {
        if (!cancelled)
          setError(
            "Карта временно недоступна. Используйте координаты в полях ниже.",
          );
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      map?.remove();
    };
  }, [serialized, geometry, draggable, onMove]);
  return (
    <>
      <div
        ref={node}
        className="routing-map"
        aria-label={
          draggable
            ? "Карта адреса: перетащите маркер или измените координаты в полях"
            : "Карта рабочего дня"
        }
      />
      {error && <p role="status">{error}</p>}
      <small>
        <a
          href="https://openfreemap.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenFreeMap
        </a>{" "}
        ·{" "}
        <a
          href="https://openmaptiles.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenMapTiles
        </a>{" "}
        · ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap contributors
        </a>
      </small>
    </>
  );
}
export function DayMap(props: {
  points: MapPoint[];
  polyline?: string;
  polylines?: string[];
  geometries?: { points: string; precision: number }[];
}) {
  return (
    <div className="routing-map-panel">
      <h3>География рабочего дня</h3>
      <RoutingMap {...props} />
      <ol>
        {props.points.map((p) => (
          <li key={p.id}>{p.label}</li>
        ))}
      </ol>
    </div>
  );
}
