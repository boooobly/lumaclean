"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { GeoPoint } from "@/lib/domain/routing";
import { routingRequest } from "./routing-workspace";
import { RoutingMap } from "./routing-map";
type Suggestion = { placeId: string; text: string };
export function AddressAutocomplete({
  name = "fullAddress",
  proofName = "locationProof",
  label = "Адрес",
  value = "",
  confirmed = false,
  required = false,
  initialPoint,
}: {
  name?: string;
  proofName?: string;
  label?: string;
  value?: string | null;
  confirmed?: boolean;
  required?: boolean;
  initialPoint?: GeoPoint | null;
}) {
  const id = useId(),
    [text, setText] = useState(value ?? ""),
    [proof, setProof] = useState(""),
    [textOnly, setTextOnly] = useState(false),
    [status, setStatus] = useState(
      confirmed
        ? "Координаты подтверждены; дорога рассчитывается отдельно"
        : "Координаты не подтверждены. Адрес можно сохранить как введено.",
    ),
    [rows, setRows] = useState<Suggestion[]>([]),
    [search, setSearch] = useState(false),
    [revision, setRevision] = useState(0),
    [pending, setPending] = useState(false),
    [pin, setPin] = useState<GeoPoint | null>(initialPoint ?? null),
    [reviewed, setReviewed] = useState(false),
    [latitude, setLatitude] = useState(String(initialPoint?.latitude ?? "")),
    [longitude, setLongitude] = useState(String(initialPoint?.longitude ?? ""));
  const token = useRef<string | null>(null),
    sequence = useRef(0);
  const move = useCallback((p: GeoPoint) => {
    setPin(p);
    setLatitude(String(p.latitude));
    setLongitude(String(p.longitude));
    setProof("");
    setTextOnly(false);
    setReviewed(false);
    setStatus("Проверьте новый маркер и подтвердите координаты");
  }, []);
  useEffect(() => {
    if (!search || text.trim().length < 3 || text.length > 200) return;
    const current = ++sequence.current;
    let cancelled = false;
    const timer = setTimeout(() => {
      token.current ??= crypto.randomUUID();
      void routingRequest<{ suggestions?: Suggestion[]; error?: string }>(
        "autocomplete",
        { query: text, sessionToken: token.current },
      )
        .then((data) => {
          if (cancelled || sequence.current !== current) return;
          setRows(data.suggestions ?? []);
          setStatus(
            data.error ??
              (data.suggestions?.length
                ? "Выберите правильный адрес"
                : "Не нашли точное совпадение"),
          );
        })
        .catch(() => {
          if (!cancelled && sequence.current === current)
            setStatus(
              "Поиск недоступен. Укажите и подтвердите координаты вручную.",
            );
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, search, revision]);
  async function select(row: Suggestion) {
    setPending(true);
    setSearch(false);
    sequence.current++;
    try {
      const result = await routingRequest<{
        address?: string;
        latitude?: number;
        longitude?: number;
        error?: string;
      }>("place", {
        placeId: row.placeId,
        query: text,
        sessionToken: token.current,
      });
      if (
        !result.address ||
        result.latitude === undefined ||
        result.longitude === undefined
      )
        throw Error(result.error ?? "Выберите адрес заново");
      setRows([]);
      move({ latitude: result.latitude, longitude: result.longitude });
      token.current = null;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Адрес недоступен");
    } finally {
      setPending(false);
    }
  }
  async function confirm() {
    setPending(true);
    try {
      const result = await routingRequest<{ address: string; proof: string }>(
        "confirm-location",
        {
          address: text.trim(),
          latitude: Number(latitude),
          longitude: Number(longitude),
          userConfirmed: true,
        },
      );
      setText(result.address);
      setProof(result.proof);
      setTextOnly(false);
      setStatus(
        "Координаты подтверждены пользователем; дорога рассчитывается отдельно",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Не удалось подтвердить");
    } finally {
      setPending(false);
    }
  }
  const valid =
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Number(latitude) >= 44.2 &&
    Number(latitude) <= 45.2 &&
    Number(longitude) >= 19.9 &&
    Number(longitude) <= 21;
  return (
    <div className="crm-field routing-address">
      <label htmlFor={id}>
        {label}
        {required && " *"}
      </label>
      <input
        id={id}
        name={name}
        value={text}
        maxLength={500}
        disabled={pending}
        required={required}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setProof("");
          setTextOnly(false);
          setRows([]);
          setReviewed(false);
          setStatus("Адрес изменён: подтвердите координаты заново");
        }}
      />
      <input type="hidden" name={proofName} value={proof} />
      {name === "fullAddress" && <input type="hidden" name="addressTextOnly" value={String(textOnly)} />}
      <div className="inbox-action-row">
        <button
          type="button"
          className="crm-button crm-button-secondary"
          disabled={pending || text.trim().length < 3 || text.length > 200}
          onClick={() => {
            setSearch(true);
            setRevision((v) => v + 1);
            token.current ??= crypto.randomUUID();
          }}
        >
          Найти адрес
        </button>
        <button
          type="button"
          className="crm-button crm-button-secondary"
          disabled={pending}
          onClick={() => move(pin ?? { latitude: 44.8125, longitude: 20.4612 })}
        >
          Указать точку на карте
        </button>
        {name === "fullAddress" && <button type="button" className="crm-button crm-button-secondary" disabled={pending || text.trim().length < 5} onClick={() => {sequence.current++; setSearch(false); setRows([]); setProof(""); setPin(null); setTextOnly(true); setStatus("Адрес будет сохранён как введено. Координаты не подтверждены.");}}>Сохранить адрес как введено</button>}
      </div>
      <p className="crm-hint" role="status">
        {status}
      </p>
      {rows.length > 0 && (
        <ul className="routing-predictions">
          {rows.map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                disabled={pending}
                onClick={() => void select(r)}
              >
                {r.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pin && (
        <>
          <RoutingMap
            points={[
              { id: "address", label: "Адрес", point: pin, kind: "address" },
            ]}
            draggable={!pending}
            onMove={move}
          />
          <div className="crm-form-grid">
            <label>
              Широта
              <input
                type="number"
                step="any"
                disabled={pending}
                value={latitude}
                onChange={(e) => {
                  setLatitude(e.target.value);
                  setReviewed(false);
                  setProof("");
                }}
              />
            </label>
            <label>
              Долгота
              <input
                type="number"
                step="any"
                disabled={pending}
                value={longitude}
                onChange={(e) => {
                  setLongitude(e.target.value);
                  setReviewed(false);
                  setProof("");
                }}
              />
            </label>
          </div>
          <button
            type="button"
            className="crm-button secondary"
            disabled={pending || !valid}
            onClick={() =>
              move({ latitude: Number(latitude), longitude: Number(longitude) })
            }
          >
            Показать эти координаты
          </button>
          <label className="crm-checkbox">
            <input
              type="checkbox"
              disabled={pending}
              checked={reviewed}
              onChange={(e) => {
                setReviewed(e.target.checked);
                if (!e.target.checked) setProof("");
              }}
            />
            Я проверил адрес и координаты и подтверждаю точку.
          </label>
          <button
            type="button"
            className="crm-button"
            disabled={pending || !reviewed || !valid || text.trim().length < 5}
            onClick={() => void confirm()}
          >
            Подтвердить координаты
          </button>
        </>
      )}
      <p className="crm-hint">
        Ручной адрес можно сохранить. Автоматическая запись требует
        подтверждённых координат; отказ карты её не блокирует.
      </p>
    </div>
  );
}
