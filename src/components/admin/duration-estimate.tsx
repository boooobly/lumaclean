"use client";
import { useEffect, useState } from "react";
import { financeMutation } from "./finance-forms";
import type { estimateDuration } from "@/lib/domain/duration";
export function DurationEstimate({
  service,
  area,
  soilLevel,
  requiredCleaners,
  extras,
  unchanged,
  stored,
}: {
  service: string;
  area: number;
  soilLevel: string;
  requiredCleaners: number;
  extras: { code: string; quantity: number }[];
  unchanged: boolean;
  stored: number | null;
}) {
  const [result, setResult] = useState<ReturnType<
      typeof estimateDuration
    > | null>(null),
    [error, setError] = useState("");
  const [resultKey, setResultKey] = useState("");
  const body = JSON.stringify({
    service,
    area,
    soilLevel,
    requiredCleaners,
    extras,
  });
  useEffect(() => {
    if (unchanged) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const r = await financeMutation("duration-estimate", JSON.parse(body));
        if (active) {
          setResult(r.ok ? r.data : null);
          setResultKey(body);
          setError(r.ok ? "" : r.error);
        }
      } catch {
        if (active) {
          setError("Оценка временно недоступна.");
          setResultKey(body);
          setResult(null);
        }
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [body, unchanged]);
  const estimate = unchanged
    ? stored
    : resultKey === body
      ? (result?.estimatedDurationMinutes ?? null)
      : null;
  return (
    <div className="finance-duration">
      <input
        type="hidden"
        name="estimatedPreviewMinutes"
        value={estimate ?? ""}
      />
      <strong>
        Расчёт системы:{" "}
        {estimate === null
          ? "правило не настроено"
          : `${Math.floor(estimate / 60)} ч ${estimate % 60} мин`}
      </strong>
      {!unchanged && resultKey === body && result && (
        <>
          <p>{result.explanation}</p>
          <small>
            Версия {result.version} · резерв {result.cleaningReserveMinutes} мин
          </small>
        </>
      )}
      {!unchanged && resultKey === body && error && <p role="alert">{error}</p>}
      <p className="crm-hint">
        Пустая ручная длительность использует оценку системы. Ручное значение
        сохраняется отдельно с причиной.
      </p>
    </div>
  );
}
