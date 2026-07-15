export const serviceIds = ["regular", "deep", "move", "airbnb", "office"] as const;
export type ServiceId = (typeof serviceIds)[number];

export const priceMatrix: Record<ServiceId, [number, number, number, number, number]> = {
  regular: [4100, 4900, 6000, 7600, 90],
  deep: [9800, 11300, 13700, 15700, 190],
  move: [10800, 12400, 15100, 17300, 210],
  airbnb: [4000, 4800, 5800, 7300, 85],
  office: [4000, 5000, 6200, 7600, 80],
};

export const extrasPrices = {
  standardWindow: 950,
  largeWindow: 1300,
  balcony: 1200,
  fridge: 1000,
  oven: 1200,
  cabinets: 1000,
  ironing: 1000,
  steam: 3000,
  linen: 800,
  petHair: 1000,
} as const;

export function basePrice(service: ServiceId, area: number) {
  const row = priceMatrix[service];
  if (area <= 40) return row[0];
  if (area <= 60) return row[1];
  if (area <= 80) return row[2];
  if (area <= 100) return row[3];
  return Math.max(4000, Math.round((area * row[4]) / 100) * 100);
}

export function formatRsd(value: number, locale = "sr") {
  return `${new Intl.NumberFormat(locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : "sr-Latn-RS").format(value)} RSD`;
}
