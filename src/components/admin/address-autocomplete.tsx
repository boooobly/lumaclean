"use client";
import { useEffect, useId, useRef, useState } from "react";
import { routingRequest } from "./routing-workspace";
export function AddressAutocomplete({
  name = "fullAddress",
  proofName = "locationProof",
  label = "Полный адрес",
  value = "",
  confirmed = false,
  required = false,
}: {
  name?: string;
  proofName?: string;
  label?: string;
  value?: string | null;
  confirmed?: boolean;
  required?: boolean;
}) {
  const id = useId(),
    [text, setText] = useState(value ?? ""),
    [proof, setProof] = useState(""),
    [status, setStatus] = useState(
      confirmed
        ? "Адрес определён · маршрут рассчитывается отдельно"
        : "Маршрут не подтверждён",
    ),
    [rows, setRows] = useState<{ placeId: string; text: string }[]>([]),
    [search, setSearch] = useState(false),
    [revision, setRevision] = useState(0),
    [pending, setPending] = useState(false),
    [attributions, setAttributions] = useState<
      { provider: string; providerUri: string }[]
    >([]),
    token = useRef<string | null>(null),
    sequence = useRef(0);
  useEffect(() => {
    if (!search || text.trim().length < 3) return;
    const current = ++sequence.current;
    let cancelled = false;
    const timer = setTimeout(() => {
      token.current ??= crypto.randomUUID();
      void routingRequest<{ suggestions?: typeof rows; error?: string }>(
        "autocomplete",
        { query: text, sessionToken: token.current },
      )
        .then((data) => {
          if (cancelled || sequence.current !== current) return;
          setRows(data.suggestions ?? []);
          setStatus(
            data.error ??
              (data.suggestions?.length
                ? "Выберите правильный результат"
                : "Результатов нет. Уточните адрес."),
          );
        })
        .catch(() => {
          if (!cancelled && sequence.current === current)
            setStatus(
              "Поиск временно недоступен. Ручной адрес можно сохранить.",
            );
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [text, search, revision]);
  async function select(placeId: string) {
    setPending(true);
    try {
      const result = await routingRequest<{
        address?: string;
        proof?: string;
        error?: string;
        attributions?: typeof attributions;
      }>("place", { placeId, sessionToken: token.current });
      if (!result.proof || !result.address) throw new Error(result.error);
      setText(result.address);
      setProof(result.proof);
      setRows([]);
      setSearch(false);
      setStatus("Адрес определён · маршрут рассчитывается отдельно");
      setAttributions(result.attributions ?? []);
      token.current = null;
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Выбор адреса недоступен",
      );
    } finally {
      setPending(false);
    }
  }
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
        required={required}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setProof("");
          setRows([]);
          setAttributions([]);
          setStatus("Маршрут не подтверждён");
        }}
      />
      <input type="hidden" name={proofName} value={proof} />
      <button
        type="button"
        className="crm-button crm-button-secondary"
        disabled={pending || text.trim().length < 3}
        onClick={() => {
          setSearch(true);
          setRevision((v) => v + 1);
          setText((t) => t.trim());
          token.current ??= crypto.randomUUID();
        }}
      >
        Определить адрес
      </button>
      <p className="crm-hint" role="status">
        {status}
      </p>
      {search && text.trim().length >= 3 && (
        <p className="crm-hint">
          Поиск Google · Сербия, приоритет Белграда. Ручной адрес можно
          сохранить.
        </p>
      )}
      {rows.length > 0 && (
        <>
          <ul className="routing-predictions">
            {rows.map((r) => (
              <li key={r.placeId}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void select(r.placeId)}
                >
                  {r.text}
                </button>
              </li>
            ))}
          </ul>
          <span className="routing-attribution" translate="no">
            Google Maps
          </span>
        </>
      )}
      {attributions.map((a) => (
        <span key={a.provider} className="routing-attribution">
          {/^https:\/\//.test(a.providerUri) ? (
            <a href={a.providerUri} target="_blank" rel="noopener noreferrer">
              {a.provider}
            </a>
          ) : (
            a.provider
          )}
        </span>
      ))}
    </div>
  );
}
