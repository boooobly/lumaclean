import {appliancePrices} from './appliance-catalog';
export const serviceIds = ["regular", "deep", "move", "airbnb", "office"] as const;
export type ServiceId = (typeof serviceIds)[number];
export type AreaServiceId = ServiceId;
export type ItemServiceId = 'upholstery';
export type CatalogueServiceId = AreaServiceId | ItemServiceId;

// Shared by the homepage price list and every service's price table.
export const priceAreaLabels: Record<"ru" | "sr" | "en", [string, string, string, string, string]> = {
  ru: ["До 39 м²", "40–59 м²", "60–79 м²", "80–99 м²", "От 100 м²"],
  sr: ["Do 39 m²", "40–59 m²", "60–79 m²", "80–99 m²", "Od 100 m²"],
  en: ["Up to 39 m²", "40–59 m²", "60–79 m²", "80–99 m²", "100 m² and up"],
};

export const priceMatrix: Record<ServiceId, [number, number, number, number, number]> = {
  regular: [4900, 6000, 8200, 9800, 98],
  deep: [9900, 11400, 14200, 17000, 180],
  move: [10700, 12800, 15600, 18400, 180],
  airbnb: [4900, 5800, 7400, 9000, 90],
  office: [4900, 5800, 7400, 9000, 90],
};

export const extrasPrices = {
  standardWindow: 700,
  largeWindow: 1000,
  balcony: 1200,
  ...appliancePrices,
  cabinets: 500,
  ironing: 900,
  steam: 2800,
  linen: 750,
  petHair: 900,
} as const;

export function basePrice(service: ServiceId, area: number) {
  const row = priceMatrix[service];
  if (area < 40) return row[0];
  if (area < 60) return row[1];
  if (area < 80) return row[2];
  if (area < 100) return row[3];
  return roundEstimate(area * row[4]);
}

export function formatRsd(value: number, locale = "sr") {
  return `${new Intl.NumberFormat(locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : "sr-Latn-RS").format(value)} RSD`;
}

// One source for public calculation and CRM snapshots.
export function calculatePrice(service: ServiceId, area: number, extras: {code: keyof typeof extrasPrices; quantity: number}[], urgent: boolean) {
  // Keep the area amount unrounded until all work and the service surcharge are included.
  const base = area >= 100 ? area * priceMatrix[service][4] : basePrice(service, area);
  const lines = extras.filter(e => e.quantity > 0).map(e => ({...e, unitPrice: extrasPrices[e.code]}));
  const subtotal = base + lines.reduce((sum,e) => sum + e.quantity * e.unitPrice, 0);
  const surcharge = urgentSurcharge(subtotal, urgent);
  const total = roundEstimate(subtotal + surcharge);
  const roundingAdjustment = Math.round((total - subtotal - surcharge) * 100) / 100;
  return {base, extras:lines, surcharge, roundingAdjustment, total};
}
// Approved RULE-GENERAL-008: round only the final estimate up to 100 RSD.
export function roundEstimate(amount:number,minimum=4000){return Math.ceil(Math.max(minimum,Math.round(amount*100)/100)/100)*100;}
export function urgentSurcharge(subtotal:number,urgent:boolean){return urgent?Math.round(subtotal*20)/100:0;}
