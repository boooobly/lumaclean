import {
  routingProvider,
  motisSelected,
} from "@/lib/infrastructure/routing-provider";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CrmError } from "@/lib/domain/crm";
import { routingTelemetry } from "@/lib/infrastructure/google-routing";
export function adminAddressSearchQueries(input: string) {
  const original = input.normalize("NFC").trim();
  const latin = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return [...new Set([original, latin.replace(/đ/gi, m => m === "Đ" ? "Dj" : "dj"), latin.replace(/đ/gi, m => m === "Đ" ? "D" : "d")])];
}
const location = z
  .object({
    address: z.string().min(5).max(500),
    placeId: z.string().min(1).max(300),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    expires: z.number(),
  })
  .strict();
export function signLocation(value: z.infer<typeof location>) {
  const content = Buffer.from(JSON.stringify(location.parse(value))).toString(
    "base64url",
  );
  return (
    content +
    "." +
    createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
      .update("location:" + content)
      .digest("base64url")
  );
}
export function verifyLocation(proof: string) {
  try {
    const [content, sig] = proof.split("."),
      expected = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
        .update("location:" + content)
        .digest(),
      given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(expected, given))
      throw new Error();
    const parsed = location.parse(
      JSON.parse(Buffer.from(content, "base64url").toString()),
    );
    if (parsed.expires < Date.now()) throw new Error();
    return parsed;
  } catch {
    throw new CrmError("VALIDATION", "Повторно подтвердите координаты адреса.");
  }
}
export function normalizeAddress<
  T extends { fullAddress: string; locationProof?: string | null; textOnly?: boolean },
>(input: T, previous?: { fullAddress: string }) {
  const { locationProof, textOnly, ...data } = input;
  if (textOnly) return {...data, latitude: null, longitude: null, placeId: null, coordinatesConfirmed: false, coordinatesSource: "MANUAL_TEXT"};
  if (locationProof) {
    const place = verifyLocation(locationProof);
    if (place.address !== input.fullAddress)
      throw new CrmError(
        "VALIDATION",
        "Адрес изменился. Выберите результат заново.",
      );
    return {
      ...data,
      coordinatesConfirmed: true,
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.placeId,
      coordinatesSource: place.placeId.startsWith("user-confirmed:") ? "MANUAL_ADMIN_MAP" : "PROVIDER",
    };
  }
  return previous?.fullAddress === input.fullAddress
    ? data
    : {
        ...data,
        latitude: null,
        longitude: null,
        placeId: null,
        coordinatesConfirmed: false,
        coordinatesSource: "MANUAL_TEXT",
      };
}
export function normalizeHome<
  T extends { homeAddress?: string | null; homeLocationProof?: string | null },
>(input: T, previous?: { homeAddress: string | null }) {
  const { homeLocationProof, ...data } = input;
  if (homeLocationProof) {
    const place = verifyLocation(homeLocationProof);
    if (place.address !== input.homeAddress)
      throw new CrmError(
        "VALIDATION",
        "Стартовый адрес изменился. Выберите результат заново.",
      );
    return {
      ...data,
      homeCoordinatesConfirmed: true,
      homeLatitude: place.latitude,
      homeLongitude: place.longitude,
      homePlaceId: place.placeId,
    };
  }
  return previous?.homeAddress === input.homeAddress
    ? data
    : {
        ...data,
        homeLatitude: null,
        homeLongitude: null,
        homePlaceId: null,
        homeCoordinatesConfirmed: false,
      };
}
export async function placesRequest(
  kind: "autocomplete" | "place",
  input: { query?: string; placeId?: string; sessionToken: string },
) {
  if (motisSelected()) {
    try {
      const provider = routingProvider();
      let matches: Awaited<ReturnType<NonNullable<typeof provider.searchAddress>>> = [];
      for (const query of adminAddressSearchQueries(input.query ?? "")) {
        matches = (await provider.searchAddress?.(query)) ?? [];
        if (matches.length) break;
      }
      if (kind === "autocomplete")
        return {
          available: true,
          suggestions: matches.map((m) => ({
            placeId: m.id,
            text: m.displayAddress,
          })),
        };
      const chosen = matches.find((m) => m.id === input.placeId);
      if (!chosen)
        return {
          available: false,
          error: "Уточните адрес и выберите результат заново.",
          suggestions: [],
        };
      const selected = location.parse({
        address: chosen.displayAddress,
        placeId: chosen.id,
        latitude: chosen.latitude,
        longitude: chosen.longitude,
        expires: Date.now() + 86400000,
      });
      return {
        available: true,
        address: selected.address,
        latitude: selected.latitude,
        longitude: selected.longitude,
        proof: signLocation(selected),
        attributions: [
          {
            provider: "OpenStreetMap contributors",
            providerUri: "https://www.openstreetmap.org/copyright",
          },
        ],
      };
    } catch {
      return {
        available: false,
        error:
          "Поиск временно недоступен. Можно указать и подтвердить координаты вручную.",
        suggestions: [],
      };
    }
  }
  if (process.env.LUMACLEAN_GOOGLE_ROUTING_ENABLED !== "true")
    return {
      available: false,
      error: "Поиск адресов не настроен.",
      suggestions: [],
    };
  if (kind === "place" && !/^[A-Za-z0-9_-]+$/.test(input.placeId ?? ""))
    return {
      available: false,
      error: "Некорректный идентификатор адреса.",
      suggestions: [],
    };
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key)
    return {
      available: false,
      error:
        "Google Places не настроен. Можно сохранить ручной адрес; маршрут не подтверждён.",
      suggestions: [],
    };
  try {
    routingTelemetry("places_requests");
    const response = await fetch(
      kind === "autocomplete"
        ? "https://places.googleapis.com/v1/places:autocomplete"
        : "https://places.googleapis.com/v1/places/" +
            input.placeId +
            "?sessionToken=" +
            input.sessionToken +
            "&languageCode=ru",
      {
        method: kind === "autocomplete" ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            kind === "autocomplete"
              ? "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text"
              : "id,formattedAddress,location,attributions",
        },
        ...(kind === "autocomplete"
          ? {
              body: JSON.stringify({
                input: input.query,
                sessionToken: input.sessionToken,
                includedRegionCodes: ["rs"],
                locationBias: {
                  circle: {
                    center: { latitude: 44.8125, longitude: 20.4612 },
                    radius: 40000,
                  },
                },
                languageCode: "ru",
              }),
            }
          : {}),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (kind === "autocomplete")
      return {
        available: true,
        suggestions: (data.suggestions ?? [])
          .slice(0, 5)
          .map(
            (v: {
              placePrediction?: { placeId: string; text: { text: string } };
            }) => ({
              placeId: v.placePrediction?.placeId,
              text: v.placePrediction?.text.text,
            }),
          )
          .filter((v: { placeId?: string }) => v.placeId),
      };
    const selected = location.parse({
      address: data.formattedAddress,
      placeId: data.id,
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
      expires: Date.now() + 86400000,
    });
    return {
      available: true,
      address: selected.address,
      latitude: selected.latitude,
      longitude: selected.longitude,
      proof: signLocation(selected),
      attributions: data.attributions ?? [],
    };
  } catch {
    routingTelemetry("errors");
    return {
      available: false,
      error: "Google Places временно недоступен. Ручной адрес можно сохранить.",
      suggestions: [],
    };
  }
}
