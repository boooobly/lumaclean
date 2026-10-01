"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { serviceLabels } from "@/lib/domain/crm-types";
import { expenseLabels } from "@/lib/domain/finance";
import type { LegacyPreview } from "@/lib/domain/legacy-import";
type Preview = LegacyPreview & { batchId: string };
export function ImportWorkspace({ initial }: { initial?: Preview }) {
  const id = useId(),
    router = useRouter(),
    [preview, setPreview] = useState(initial),
    [selected, setSelected] = useState<string[]>(
      initial?.rows
        .filter((r) => !r.errors.length && !r.duplicate)
        .map((r) => r.sourceKey) ?? [],
    ),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [result, setResult] = useState<{
      clients: number;
      orders: number;
      expenses: number;
      addresses: number;
      investments: number;
      skipped: number;
      warnings: string[];
    }>(),
    [ack, setAck] = useState(false);
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.currentTarget);
    setPending(true);
    setMessage("");
    setResult(undefined);
    try {
      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        body: f,
      });
      const body = await res.json();
      if (!body.ok) {
        setMessage(body.error);
        return;
      }
      setPreview(body.data);
      setSelected(
        body.data.rows
          .filter(
            (r: { errors: string[]; duplicate?: boolean }) =>
              !r.errors.length && !r.duplicate,
          )
          .map((r: { sourceKey: string }) => r.sourceKey),
      );
      setAck(false);
      router.replace("/admin/settings/import?batch=" + body.data.batchId);
    } catch {
      setMessage("Не удалось прочитать файл. Повторите загрузку.");
    } finally {
      setPending(false);
    }
  }
  async function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !preview || !ack) return;
    const f = new FormData(e.currentTarget),
      resolutions = [];
    for (const r of preview.rows.filter((r) =>
      selected.includes(r.sourceKey),
    )) {
      const patch: Record<string, unknown> = { sourceKey: r.sourceKey };
      for (const key of [
        "date",
        "service",
        "category",
        "contact",
        "address",
        "area",
      ]) {
        const v = String(f.get(r.sourceKey + ":" + key) ?? "").trim();
        if (v) patch[key] = key === "area" ? Number(v) : v;
      }
      if (f.get(r.sourceKey + ":identity") === "on")
        patch.confirmIdentity = true;
      if (Object.keys(patch).length > 1) resolutions.push(patch);
    }
    setPending(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: preview.batchId,
          selected,
          resolutions,
          acknowledgeWarnings: true,
          reason: String(f.get("reason") ?? ""),
        }),
      });
      const body = await res.json();
      if (!body.ok) {
        setMessage(body.error);
        return;
      }
      setResult(body.data);
      setSelected([]);
      setAck(false);
      setPreview({
        ...preview,
        rows: preview.rows.map((r) =>
          selected.includes(r.sourceKey) ? { ...r, duplicate: true } : r,
        ),
      });
      router.refresh();
    } catch {
      setMessage(
        "Связь прервалась. Загрузите workbook повторно: source keys защищают от дублей.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <section className="crm-section">
        <h2>Workbook LumaClean</h2>
        <p>
          Импортируются фактические строки «Заказы», «Расходы», «Вложения».
          «Дашборд» и «Настройки» не создают финансовых операций. Исходный файл
          остаётся неизменным.
        </p>
        <form onSubmit={upload} className="finance-upload">
          <label className="crm-field" htmlFor={id + "-file"}>
            Excel workbook
            <input
              id={id + "-file"}
              type="file"
              name="file"
              accept=".xlsx"
              required
              disabled={pending}
            />
          </label>
          <button className="crm-button" disabled={pending}>
            {pending ? "Обработка…" : "Показать preview"}
          </button>
        </form>
        <p className="crm-hint">
          .xlsx до 2 МБ. Preview доступен владельцу 24 часа. Повторная загрузка
          обновляет проверку совпадений с CRM.
        </p>
      </section>
      {message && (
        <p className="crm-field-error" role="alert">
          {message}
        </p>
      )}
      {preview && (
        <section className="crm-section">
          <h2>Предварительный просмотр</h2>
          <div className="finance-metrics">
            {[
              ["Заказы", preview.summary.orders],
              ["Расходы", preview.summary.expenses],
              ["Вложения", preview.summary.investments],
              ["Группы клиентов", preview.summary.clients],
              ["Текстовые адреса", preview.summary.addresses],
              [
                "Без блокирующих ошибок",
                preview.rows.filter((r) => !r.errors.length && !r.duplicate)
                  .length,
              ],
            ].map(([label, v]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <p>
            Объединения по сильным контактам:{" "}
            {preview.summary.merges.length
              ? preview.summary.merges
                  .map((m) => `${m.name}: строки ${m.rows.join(", ")}`)
                  .join("; ")
              : "не найдены"}
            . Похожее имя само по себе не объединяет клиентов.
          </p>
          <p className="crm-hint">
            Исторические адреса будут неактивны до подтверждения. Расчётные
            выплаты и резерв сохраняются в legacy snapshot и не считаются
            подтверждёнными выплатами. Показатели прибыли после импорта требуют
            их проверки.
          </p>
          <form onSubmit={apply}>
            <fieldset className="crm-form-fields" disabled={pending}>
              <div className="import-rows">
                {preview.rows.map((r) => (
                  <details
                    key={r.sourceKey}
                    className="import-row"
                    open={r.errors.length > 0}
                  >
                    <summary>
                      <span>
                        {r.kind === "order"
                          ? "Заказ"
                          : r.kind === "expense"
                            ? "Расход"
                            : "Вложение"}{" "}
                        · строка {r.row} · ID {r.legacyId}
                      </span>
                      <span>
                        {r.date ?? "Дата требует решения"} · {r.amount ?? "—"}{" "}
                        RSD ·{" "}
                        {r.duplicate
                          ? "Уже импортировано"
                          : r.errors.length
                            ? "Требует решения"
                            : "Можно выбрать"}
                      </span>
                    </summary>
                    <label className="crm-check">
                      <input
                        type="checkbox"
                        checked={selected.includes(r.sourceKey)}
                        disabled={r.duplicate}
                        onChange={(e) => {
                          setSelected(
                            e.target.checked
                              ? [...selected, r.sourceKey]
                              : selected.filter((k) => k !== r.sourceKey),
                          );
                          setAck(false);
                        }}
                      />
                      Применить эту строку
                    </label>
                    {r.kind === "order" && (
                      <p>
                        <strong>{r.name}</strong> ·{" "}
                        {r.phone || r.telegram || "без сильного контакта"}
                        <br />
                        {r.service
                          ? serviceLabels[
                              r.service as keyof typeof serviceLabels
                            ]
                          : "Неизвестная услуга"}{" "}
                        · {r.area} м²
                        <br />
                        {r.address ??
                          "Historical/manual unresolved: " + r.district}
                        {r.clientId && (
                          <>
                            <br />
                            Совпадение с существующей карточкой CRM
                          </>
                        )}
                      </p>
                    )}
                    <p>{r.description}</p>
                    {r.errors.length > 0 && (
                      <ul className="crm-field-error">
                        {r.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    )}
                    {r.warnings.length > 0 && (
                      <ul className="crm-hint">
                        {r.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                    <details>
                      <summary>Явные исправления для этой строки</summary>
                      <div className="crm-fields-grid">
                        <label className="crm-field">
                          Исправленная дата
                          <input type="date" name={r.sourceKey + ":date"} />
                        </label>
                        {r.kind === "order" && (
                          <>
                            <label className="crm-field">
                              Соответствие услуги
                              <select name={r.sourceKey + ":service"}>
                                <option value="">Сохранить исходное</option>
                                {Object.entries(serviceLabels).map(
                                  ([key, label]) => (
                                    <option value={key} key={key}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label className="crm-field">
                              Исправленный контакт · имя, @username или телефон
                              <input
                                name={r.sourceKey + ":contact"}
                                maxLength={200}
                              />
                            </label>
                            <label className="crm-field">
                              Исправленная площадь
                              <input
                                name={r.sourceKey + ":area"}
                                type="number"
                                min={1}
                                max={10000}
                                step={0.01}
                              />
                            </label>
                            <label className="crm-field">
                              Подтверждённый текст адреса
                              <input
                                name={r.sourceKey + ":address"}
                                maxLength={500}
                              />
                            </label>
                            <label className="crm-check">
                              <input
                                name={r.sourceKey + ":identity"}
                                type="checkbox"
                              />
                              Я проверил, кому принадлежит контакт. Если нужен
                              merge, указываю его правильный сильный контакт
                              выше.
                            </label>
                          </>
                        )}
                        {r.kind === "expense" && (
                          <label className="crm-field">
                            Категория
                            <select name={r.sourceKey + ":category"}>
                              <option value="">Сохранить исходное</option>
                              {Object.entries(expenseLabels).map(
                                ([key, label]) => (
                                  <option value={key} key={key}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        )}
                      </div>
                    </details>
                    <details>
                      <summary>Исходные значения и форматы ячеек</summary>
                      <div className="admin-table-shell">
                        <table className="crm-ledger">
                          <thead>
                            <tr>
                              <th>Колонка</th>
                              <th>Значение</th>
                              <th>Формат / вычислено</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.raw.map((c, i) => (
                              <tr key={i}>
                                <td>{i + 1}</td>
                                <td>
                                  {c.value === null
                                    ? "—"
                                    : typeof c.value === "object"
                                      ? JSON.stringify(c.value)
                                      : String(c.value)}
                                </td>
                                <td>
                                  {c.format || "General"}
                                  {c.formula ? " · cached formula result" : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </details>
                ))}
              </div>
              <label className="crm-check">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                Проверил выбранные строки, объединения и предупреждения.
                Подтверждаю запись этих данных.
              </label>
              <label className="crm-field" htmlFor={id + "-reason"}>
                Комментарий к apply и ручным решениям
                <textarea
                  id={id + "-reason"}
                  name="reason"
                  minLength={5}
                  maxLength={1000}
                  required
                />
              </label>
            </fieldset>
            <button
              className="crm-button"
              disabled={pending || !ack || !selected.length}
            >
              Применить выбранные строки ({selected.length})
            </button>
          </form>
          {result && (
            <div role="status" className="crm-success">
              <h3>Импорт завершён</h3>
              <p>
                Клиентов: {result.clients}; заказов: {result.orders}; адресов:{" "}
                {result.addresses}; расходов: {result.expenses}; вложений:{" "}
                {result.investments}; пропущено: {result.skipped};
                предупреждений: {result.warnings.length}.
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
