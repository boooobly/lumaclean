import type { OrderUpholstery } from "@/generated/prisma/client";
import { upholsteryRequestSchema } from "@/lib/upholstery";
import { upholsteryUi } from "@/lib/upholstery-content";
import { money } from "./crm-view";
import Link from 'next/link';
import type {Prisma} from '@/generated/prisma/client';
export function UpholsteryLeadDetail({snapshot}:{snapshot:Prisma.JsonValue}){const s=snapshot as {input:unknown;quote:{total:number;lines:{amount:number}[]};convertedOrderId?:string},request=upholsteryRequestSchema.parse(s.input),u=upholsteryUi.ru;return <section><h3>{request.mode==='STANDALONE'?'Отдельная химчистка':'Химчистка вместе с уборкой'}</h3><p>Предварительная оценка: {money(s.quote.total)}. Материал, окончательная цена, длительность и аппарат требуют согласования.</p><details><summary>Мебель и состояние</summary><ul className="crm-simple-list">{request.items.map((item,i)=><li key={i}>{u.types[item.type]} × {item.quantity} · {u.soils[item.soil]}<span>{money(s.quote.lines[i]?.amount)}</span><small>{u.fabrics[item.fabric]} · {item.material} · {item.size} · {item.notes}</small></li>)}</ul></details>{s.convertedOrderId&&<Link className="admin-text-link" href={`/admin/orders/${s.convertedOrderId}`}>Открыть связанный заказ →</Link>}</section>;}
export function UpholsteryDetail({ detail }: { detail: OrderUpholstery }) {
  const input = upholsteryRequestSchema.parse(detail.input),
    u = upholsteryUi.ru,
    quote = detail.quote as {
      version?: number;
      lines?: { amount: number; unitPrice: number; units: number }[];
      minimumAdjustment?: number;
      surcharge?: number;
      cleaningBaseline?: number;
      agreedTotal?: number;
    };
  return (
    <section className="crm-section">
      <h2>
        {input.mode === "ADDON"
          ? "Химчистка как дополнение"
          : "Самостоятельная химчистка"}
      </h2>
      <p>
        <strong>Взять экстрактор Kärcher.</strong> ·{" "}
        {detail.reviewStatus === "APPROVED"
          ? "Условия согласованы"
          : detail.reviewStatus === "REJECTED"
            ? "Обработка отклонена"
            : "Pending review · запись требует проверки"}
      </p>
      <ul className="crm-simple-list">
        {input.items.map((item, index) => (
          <li key={index}>
            {u.types[item.type]} × {item.quantity}
            {item.seats ? ` · ${item.seats} мест` : ""} · {u.soils[item.soil]}
            <span>{money(quote.lines?.[index]?.amount)}</span>
          </li>
        ))}
      </ul>
      <details>
        <summary>Калькуляция, материал и план работы</summary>
        {input.items.map((item, index) => (
          <p key={index}>
            {u.types[item.type]}: {item.size} · {u.fabrics[item.fabric]} ·{" "}
            {item.material || "Материал не указан"} · {item.notes}
          </p>
        ))}
        <p>
          Прайс v{quote.version} · Основная уборка:{" "}
          {money(quote.cleaningBaseline)} · Доплата до минимума:{" "}
          {money(quote.minimumAdjustment)} · Срочность: {money(quote.surcharge)}{" "}
          · Согласовано: {money(quote.agreedTotal)}
        </p>
        <p>
          Подготовка: {detail.preparationMinutes ?? "не подтверждена"} мин ·
          Работа: {detail.plannedMinutes ?? "не подтверждена"} мин · Очистка:{" "}
          {detail.cleanupMinutes ?? "не подтверждена"} мин · Перевозка:{" "}
          {detail.transferMinutes ?? "не подтверждена"} мин
        </p>
        <p>
          Аппарат: {detail.equipmentUnit ?? "не назначен"} · Ответственный:{" "}
          {detail.equipmentCleanerId ?? "не назначен"}
        </p>
        <p>{detail.logisticsNote}</p>
        <p>{detail.reviewNote}</p>
        <p>
          Проба ткани на месте:{" "}
          {detail.patchTestConfirmed
            ? "подтверждена"
            : "требуется перед обработкой"}
        </p>
        {Array.isArray(detail.photos) &&
          detail.photos.map(
            (photo, index) =>
              typeof photo === "string" && (
                <p key={index}>
                  <a href={photo} target="_blank" rel="noreferrer">
                    Фото {index + 1}
                  </a>
                </p>
              ),
          )}
      </details>
    </section>
  );
}
