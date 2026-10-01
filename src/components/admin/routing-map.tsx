"use client";
import { useEffect, useRef, useState } from "react";
type GoogleMap = {
  maps: {
    Map: new (node: HTMLElement, options: unknown) => unknown;
    marker: {
      AdvancedMarkerElement: new (options: unknown) => { map: unknown };
    };
    LatLngBounds: new () => { extend: (p: unknown) => void };
    Polyline: new (options: unknown) => { setMap: (map: null) => void };
    geometry: { encoding: { decodePath: (value: string) => unknown } };
  };
};
let loaded: Promise<GoogleMap> | null = null;
function loadMap(key: string): Promise<GoogleMap> {
  if (loaded) return loaded;
  loaded = new Promise((resolve, reject) => {
    const context = window as unknown as {
      google: GoogleMap;
      lumaRoutingMapReady?: () => void;
    };
    const timer = setTimeout(() => {
      loaded = null;
      delete context.lumaRoutingMapReady;
      reject(new Error("����� �������� ����������"));
    }, 10000);
    context.lumaRoutingMapReady = () => {
      clearTimeout(timer);
      resolve(context.google);
      delete context.lumaRoutingMapReady;
    };
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(key) +
      "&libraries=geometry,marker&loading=async&callback=lumaRoutingMapReady";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      delete context.lumaRoutingMapReady;
      loaded = null;
      reject(new Error("Карта временно недоступна"));
    };
    document.head.appendChild(script);
  });
  return loaded;
}
export function DayMap({
  points,
  polyline,
}: {
  points: {
    id: string;
    label: string;
    point: { latitude: number; longitude: number };
    kind: string;
  }[];
  polyline?: string;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY,
    ref = useRef<HTMLDivElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!key || !ref.current) return;
    let cancelled = false;
    const markers: { setMap: (map: null) => void }[] = [];
    const advanced: { map: unknown }[] = [];
    void loadMap(key)
      .then((g) => {
        if (cancelled || !ref.current) return;
        const map = new g.maps.Map(ref.current, {
          center: { lat: 44.8125, lng: 20.4612 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        }) as { fitBounds: (b: unknown) => void };
        const bounds = new g.maps.LatLngBounds();
        points.forEach((p) => {
          const position = { lat: p.point.latitude, lng: p.point.longitude };
          bounds.extend(position);
          const content = document.createElement("span");
          content.className = "routing-map-pin";
          content.textContent = p.kind === "home" ? "С" : p.label.split(" · ")[0];
          advanced.push(
            new g.maps.marker.AdvancedMarkerElement({
              map,
              position,
              title: p.label,
              content,
            }),
          );
        });
        if (points.length > 1) map.fitBounds(bounds);
        if (polyline)
          markers.push(
            new g.maps.Polyline({
              map,
              path: g.maps.geometry.encoding.decodePath(polyline),
              strokeColor: "#267978",
              strokeWeight: 3,
            }),
          );
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      markers.forEach((m) => m.setMap(null));
      advanced.forEach((m) => {
        m.map = null;
      });
    };
  }, [key, points, polyline]);
  return (
    <div className="routing-map-panel">
      <h3>География рабочего дня</h3>
      {!key ? (
        <p role="status">
          Карта недоступна: browser key Google Maps не настроен. Серверные
          маршруты работают независимо от карты.
        </p>
      ) : (
        <div
          ref={ref}
          className="routing-map"
          aria-label="Карта рабочего дня"
        />
      )}
      {error && <p role="alert">{error}</p>}
      <ol>
        {points.map((p) => (
          <li key={p.id}>{p.label}</li>
        ))}
      </ol>
    </div>
  );
}
