"use client";
import { furnitureTypes, type UpholsteryRequest } from "@/lib/upholstery";
import { upholsteryUi } from "@/lib/upholstery-content";
import type { Locale } from "@/i18n/routing";
export type Furniture = UpholsteryRequest["items"][number];
export const newFurniture = (): Furniture => ({
  type: "SOFA3",
  quantity: 1,
  soil: "NORMAL",
  fabric: "UNKNOWN",
  material: "",
  size: "standard",
  notes: "",
});
export function FurnitureFields({
  locale,
  items,
  onChange,
}: {
  locale: Locale;
  items: Furniture[];
  onChange: (v: Furniture[]) => void;
}) {
  const c = upholsteryUi[locale];
  const change = (index: number, key: string, value: unknown) =>
    onChange(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  return (
    <div className="upholstery-items">
      {items.map((item, i) => (
        <fieldset key={i} className="upholstery-item">
          <legend>
            {c.item} {i + 1}
          </legend>
          <div className="upholstery-fields">
            {items.some((x) => x.type === "SPOT") &&
              items.some((x) => x.type !== "SPOT") && (
                <label>
                  {locale === "ru"
                    ? "Метка отдельного предмета"
                    : locale === "sr"
                      ? "Oznaka zasebnog komada"
                      : "Separate item label"}
                  <input
                    value={item.objectRef ?? ""}
                    maxLength={100}
                    onChange={(e) => change(i, "objectRef", e.target.value)}
                  />
                </label>
              )}
            <label>
              {c.item}
              <select
                value={item.type}
                onChange={(e) => change(i, "type", e.target.value)}
              >
                {furnitureTypes.map((t) => (
                  <option key={t} value={t}>
                    {c.types[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.quantity}
              <input
                type="number"
                min={1}
                max={30}
                value={item.quantity}
                onChange={(e) => change(i, "quantity", Number(e.target.value))}
              />
            </label>
            {item.type === "CORNER" && (
              <label>
                {c.seats}
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={item.seats ?? 3}
                  onChange={(e) => change(i, "seats", Number(e.target.value))}
                />
              </label>
            )}
            <label>
              {c.soil}
              <select
                value={item.soil}
                onChange={(e) => change(i, "soil", e.target.value)}
              >
                {Object.entries(c.soils).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.fabric}
              <select
                value={item.fabric}
                onChange={(e) => change(i, "fabric", e.target.value)}
              >
                {Object.entries(c.fabrics).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.material}
              <input
                value={item.material}
                maxLength={160}
                onChange={(e) => change(i, "material", e.target.value)}
              />
            </label>
            <label>
              {c.size}
              <input
                value={item.size}
                maxLength={100}
                onChange={(e) => change(i, "size", e.target.value)}
              />
            </label>
            <label>
              {c.notes}
              <input
                value={item.notes}
                maxLength={500}
                onChange={(e) => change(i, "notes", e.target.value)}
              />
            </label>
          </div>
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              {c.remove}
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        disabled={items.length >= 20}
        onClick={() => onChange([...items, newFurniture()])}
      >
        {c.add}
      </button>
    </div>
  );
}
