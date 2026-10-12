"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { leadTransitions, orderTransitions, type LeadState, type OrderState } from "@/lib/domain/crm-types";

type Props = { id: string; updatedAt: string; onSaved?: () => void | Promise<void> } &
  ({ kind: "Order"; status: OrderState } | { kind: "Lead"; status: LeadState });

export function CloseRecordButton(props: Props) {
  const [open, setOpen] = useState(false);
  const available = props.kind === "Order"
    ? orderTransitions[props.status].includes("CANCELLED")
    : leadTransitions[props.status].includes("LOST");
  if (!available) return null;
  return <>
    <button type="button" className="crm-close-button" onClick={() => setOpen(true)}>
      {props.kind === "Order" ? "Отменить / убрать из календаря" : "Закрыть заявку"}
    </button>
    {open && <CloseRecordDialog {...props} onClose={() => setOpen(false)} />}
  </>;
}

function CloseRecordDialog({ onClose, ...props }: Props & { onClose: () => void }) {
  const router = useRouter(), dialog = useRef<HTMLDialogElement>(null), busy = useRef(false), id = useId();
  const [reason, setReason] = useState("Клиент отказался"), [pending, setPending] = useState(false), [error, setError] = useState("");
  const order = props.kind === "Order";
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || !reason.trim()) return;
    busy.current = true; setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/crm/${order ? "order-status" : "lead-status"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: props.id, status: order ? "CANCELLED" : "LOST", reason: reason.trim(), expectedUpdatedAt: props.updatedAt }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) { setError(result.error ?? "Изменение не сохранено"); return; }
      if (props.onSaved) await props.onSaved();
      router.refresh(); onClose();
    } catch { setError("Не удалось подтвердить сохранение. Обновите страницу перед повтором."); }
    finally { busy.current = false; setPending(false); }
  }
  return <dialog ref={dialog} className="schedule-dialog crm-close-dialog" aria-labelledby={id + "-title"}
    onCancel={event => { if (busy.current) event.preventDefault(); else onClose(); }}>
    <div className="schedule-dialog-heading"><h2 id={id + "-title"}>{order ? "Отменить уборку" : "Закрыть заявку"}</h2>
      <button type="button" disabled={pending} onClick={onClose} aria-label="Закрыть подтверждение">×</button></div>
    <p>{order ? "Уборка исчезнет из активного календаря и освободит время команды. Заказ, финансовые данные и причина отмены сохранятся в истории." : "Заявка получит статус «Закрыта без заказа». Контакты, комментарий и история сохранятся; заявку можно снова взять в работу."}</p>
    {order && <p className="crm-hint">Если клиент выбрал другой день, используйте «Перенести уборку»: новый заказ создавать не нужно. Отменяется только эта уборка; остальные уборки серии сохраняются.</p>}
    <form onSubmit={submit} aria-busy={pending}>
      <div className="crm-field"><label htmlFor={id + "-reason"}>Причина</label>
        <textarea id={id + "-reason"} required maxLength={1000} rows={3} value={reason} disabled={pending} onChange={event => setReason(event.target.value)} />
      </div>
      {error && <p className="crm-form-error" role="alert">{error}</p>}
      <div className="schedule-dialog-actions">
        <button className="crm-button" disabled={pending || !reason.trim()}>{pending ? "Сохраняем…" : order ? "Подтвердить отмену" : "Подтвердить закрытие"}</button>
        <button type="button" disabled={pending} onClick={onClose}>Оставить без изменений</button>
      </div>
    </form>
  </dialog>;
}
