export const serviceIds = ["regular", "deep", "move", "airbnb", "office"] as const;
export type ServiceId = (typeof serviceIds)[number];

export const priceMatrix: Record<ServiceId, [number, number, number, number, number]> = {
  regular: [4000, 4600, 5700, 7200, 85],
  deep: [9300, 10700, 12900, 14900, 180],
  move: [10200, 11700, 14300, 16400, 200],
  airbnb: [4000, 4500, 5500, 6900, 80],
  office: [4000, 4700, 5900, 7200, 75],
};

export const extrasPrices = {
  standardWindow: 900,
  largeWindow: 1200,
  balcony: 1100,
  fridge: 900,
  oven: 1100,
  cabinets: 900,
  ironing: 900,
  steam: 2800,
  linen: 750,
  petHair: 900,
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
