/**
 * Pure helpers for the shared spot catalogue — safe on both server and
 * client (the add-spot dialog previews the parsed pin with the same code the
 * API uses to validate it).
 */

export const COMPASS_16 = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

export interface LatLng {
  lat: number;
  lng: number;
}

/** True for a usable point: in range, finite, and not the (0, 0) "null island"
 *  that a failed geocode or an empty field tends to produce. */
export function validLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";

/**
 * Coordinates out of whatever the user pasted: "9.81, 126.16", a Google Maps
 * URL (`!3d<lat>!4d<lng>` is the dropped pin and wins over `@lat,lng`, which
 * is only the map's centre), or a `?q=` / `ll=` / `query=` parameter.
 * Returns null when nothing usable is in there — never guesses. Short links
 * (maps.app.goo.gl) hold no coordinates; the server expands those first.
 */
export function parseLocation(input: string): LatLng | null {
  const text = input.trim();
  if (!text) return null;

  const tries: RegExp[] = [
    new RegExp(`!3d${NUM}!4d${NUM}`),
    new RegExp(`@${NUM},${NUM}`),
    new RegExp(`[?&](?:q|ll|query|center|destination)=${NUM}(?:,|%2C)\\s*${NUM}`, "i"),
    new RegExp(`^\\s*${NUM}\\s*[,;\\s]\\s*${NUM}\\s*$`),
  ];
  for (const re of tries) {
    const m = re.exec(text);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (validLatLng(lat, lng)) return { lat, lng };
  }
  return null;
}

/** 5 decimals ≈ 1 m — plenty, and keeps pasted 15-digit pins tidy. */
export const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** For comparing names: case, accents, spaces, apostrophes and common
 *  "beach"/"pantai" suffixes don't make two spots different. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´"]/g, "")
    .replace(/\b(beach|pantai|surf spot|surf break)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** URL-safe ASCII stem for a slug; non-Latin names fall back to "spot". */
export function slugStem(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s || "spot";
}
