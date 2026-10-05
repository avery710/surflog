/**
 * Server-side checks for adding/editing a spot (admin routes, app/api/spots/**):
 * pasted-location parsing, the Open-Meteo timezone + sea-data lookup,
 * duplicate detection and slug allocation. Pure of auth and request
 * plumbing so the routes stay short.
 */
import type { Region, Spot } from "./spots";
import {
  COMPASS_16,
  distanceM,
  normalizeName,
  parseLocation,
  round5,
  slugStem,
  type LatLng,
} from "./spot-geo";
import type { SpotInput } from "./spot-store";

const MARINE = "https://marine-api.open-meteo.com/v1/marine";

/** Closer than this to an existing spot: refused outright. Siargao's Cloud 9,
 *  Quicksilver and Jacking Horse are 150–400 m apart, so this must stay
 *  well under that. */
export const DUPLICATE_RADIUS_M = 100;
/** Between DUPLICATE_RADIUS_M and this: the caller is told about the
 *  neighbours and must confirm (`confirmDistinct`) — a 1 km blanket refusal
 *  would block real, separate breaks that sit side by side. */
export const NEARBY_RADIUS_M = 1000;
/** Same normalised name this close (or in the same area) is the same spot. */
const SAME_NAME_RADIUS_M = 50_000;

const MAX_NAME = 80;
const MAX_PLACE = 60;

const REGIONS: readonly Region[] = ["North", "Northeast", "East", "South", "West"];

export type FieldsResult =
  | {
      ok: true;
      name: string;
      nameZh: string | null;
      region: Region | null;
      country: string;
      area: string;
      facing: string | null;
      bestSwellDir: string[] | null;
      bestWindDir: string[] | null;
      bestTide: string | null;
      tideTownship: string | null;
    }
  | { ok: false; error: string };

/** A list of compass points, as an array or a comma/space separated string. */
function compassList(v: unknown): string[] | null | "invalid" {
  if (v == null || v === "") return null;
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,]+/) : null;
  if (!items) return "invalid";
  const out = items.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
  if (out.some((x) => !(COMPASS_16 as readonly string[]).includes(x))) return "invalid";
  return out.length ? out : null;
}

/** Text fields only; the location is handled separately. Partial edits fill
 *  the missing fields from the existing row before calling this. */
export function validateFields(body: Record<string, unknown>): FieldsResult {
  const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
  const name = str(body.name);
  const nameZh = str(body.nameZh);
  const country = str(body.country);
  const area = str(body.area);
  const facing = typeof body.facing === "string" ? body.facing.trim().toUpperCase() : "";
  const region = str(body.region);
  const bestTide = str(body.bestTide);
  const tideTownship = str(body.tideTownship);
  const swell = compassList(body.bestSwellDir);
  const wind = compassList(body.bestWindDir);

  if (name.length < 2 || name.length > MAX_NAME) return { ok: false, error: "name must be 2–80 characters" };
  if (nameZh.length > MAX_NAME) return { ok: false, error: "Chinese name is too long" };
  if (!country || country.length > MAX_PLACE) return { ok: false, error: "country is required" };
  if (!area || area.length > MAX_PLACE) return { ok: false, error: "area is required" };
  if (facing && !(COMPASS_16 as readonly string[]).includes(facing)) {
    return { ok: false, error: "facing must be one of the 16 compass points" };
  }
  if (region && !(REGIONS as readonly string[]).includes(region)) {
    return { ok: false, error: "region must be North, Northeast, East, South or West" };
  }
  if (swell === "invalid" || wind === "invalid") {
    return { ok: false, error: "bestSwellDir / bestWindDir must be compass points" };
  }
  if (bestTide.length > 40 || tideTownship.length > 40) return { ok: false, error: "bestTide / tideTownship too long" };
  return {
    ok: true,
    name,
    nameZh: nameZh || null,
    region: (region as Region) || null,
    country,
    area,
    facing: facing || null,
    bestSwellDir: swell,
    bestWindDir: wind,
    bestTide: bestTide || null,
    tideTownship: tideTownship || null,
  };
}

/** Hosts whose short links we'll follow to find the pin. Exact hostnames
 *  only — this is a server-side fetch of a user-supplied URL. */
const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);
const MAPS_HOST = /^(?:www\.)?google\.[a-z.]+$/;

/** Coordinates from pasted text. Short Google links are expanded by following
 *  their redirects (max 4, only to Google hosts). null = nothing usable. */
export async function locationFromInput(input: string): Promise<LatLng | null> {
  const direct = parseLocation(input);
  if (direct) return direct;

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !SHORT_LINK_HOSTS.has(url.hostname)) return null;
  if (url.hostname === "goo.gl" && !url.pathname.startsWith("/maps")) return null;

  for (let hop = 0; hop < 4; hop++) {
    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(6000) });
    } catch {
      return null;
    }
    const next = res.headers.get("location");
    if (!next) return null;
    let target: URL;
    try {
      target = new URL(next, url);
    } catch {
      return null;
    }
    const parsed = parseLocation(target.toString());
    if (parsed) return parsed;
    const ok =
      target.protocol === "https:" &&
      (MAPS_HOST.test(target.hostname) || SHORT_LINK_HOSTS.has(target.hostname));
    if (!ok) return null;
    url = target;
  }
  return null;
}

export type GeoCheck =
  | { ok: true; timezone: string }
  | { ok: false; code: "no_sea_data" | "lookup_failed" };

/**
 * One Open-Meteo marine request with `timezone=auto` does both jobs: the
 * response carries the IANA zone for the coordinate, and swell / sea-level /
 * sea-temperature come back null for a point nowhere near the sea (Paris,
 * Frankfurt). That only catches deep-inland pins — a pin a few km from a
 * coast snaps to the nearest sea cell (an Ubud pin picked a node ~17 km
 * away), which is why the card always shows the grid node.
 */
export async function checkLocation(lat: number, lng: number): Promise<GeoCheck> {
  let body: {
    error?: boolean;
    timezone?: string;
    hourly?: Record<string, (number | null)[]>;
  };
  try {
    const res = await fetch(
      `${MARINE}?latitude=${lat}&longitude=${lng}&hourly=swell_wave_height,sea_level_height_msl,sea_surface_temperature&forecast_days=1&timezone=auto`,
      { signal: AbortSignal.timeout(8000) }
    );
    body = await res.json();
  } catch {
    return { ok: false, code: "lookup_failed" };
  }
  if (body.error || typeof body.timezone !== "string" || !body.hourly) {
    return { ok: false, code: "lookup_failed" };
  }
  const hasSea = ["swell_wave_height", "sea_level_height_msl", "sea_surface_temperature"].some((k) =>
    body.hourly?.[k]?.some((v) => v != null)
  );
  if (!hasSea) return { ok: false, code: "no_sea_data" };
  return { ok: true, timezone: body.timezone };
}

export interface DuplicateReport {
  /** Same place or same name nearby: don't create, offer this one. */
  duplicate: Spot | null;
  /** Close but plausibly distinct: create only if the caller confirms. */
  nearby: Spot[];
}

/** `all` = the whole catalogue; `ignoreSlug` skips the spot being edited. */
export function findDuplicates(
  all: readonly Spot[],
  point: LatLng,
  name: string,
  area: string,
  ignoreSlug?: string
): DuplicateReport {
  const wantName = normalizeName(name);
  const wantArea = normalizeName(area);
  let duplicate: Spot | null = null;
  const nearby: { spot: Spot; d: number }[] = [];

  for (const s of all) {
    if (s.slug === ignoreSlug || s.lat == null || s.lng == null) continue;
    const d = distanceM(point, { lat: s.lat, lng: s.lng });
    const sameName = normalizeName(s.name) === wantName || (s.nameZh != null && normalizeName(s.nameZh) === wantName);
    const sameArea = s.area != null && normalizeName(s.area) === wantArea;
    if (d <= DUPLICATE_RADIUS_M || (sameName && (sameArea || d <= SAME_NAME_RADIUS_M))) {
      if (!duplicate) duplicate = s;
    } else if (d <= NEARBY_RADIUS_M) {
      nearby.push({ spot: s, d });
    }
  }
  nearby.sort((a, b) => a.d - b.d);
  return { duplicate, nearby: nearby.map((n) => n.spot) };
}

/** First free slug among `taken`: the ASCII stem of the name, then `-2`, `-3`…
 *  Never contains ":", so it can't collide with `custom:` or `req:` values. */
export function allocateSlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugStem(name);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function toInput(
  fields: Extract<FieldsResult, { ok: true }>,
  point: LatLng,
  timezone: string
): SpotInput {
  const { ok: _ok, ...rest } = fields;
  void _ok;
  return { ...rest, lat: round5(point.lat), lng: round5(point.lng), timezone };
}

export interface GeocodeResult {
  country: string | null;
  /** Best single guess at the area: state, else region/county, else city/town. */
  area: string | null;
  /** Every plausible area name Nominatim returned, broadest first — offered as
   *  suggestions so the admin can pick "Bali" over "Badung" or "Pecatu". */
  areaOptions: string[];
}

/**
 * Country and area for a coordinate, via Nominatim reverse geocoding
 * (zoom=10, English names). Admin-only and one call per add, so well inside
 * Nominatim's 1 req/s policy; the User-Agent identifies the app as it
 * requires. Verified live 2026-10-05: Cloud 9 → country "Philippines",
 * state "Surigao del Norte" (Siargao itself isn't a state, hence the
 * editable field); Uluwatu → "Indonesia" / state "Bali". null on any failure
 * — detection is a convenience, never a blocker.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=10&addressdetails=1&accept-language=en`,
      {
        headers: { "User-Agent": "Surflog/0.1 (spot admin; https://github.com/avery710/surflog)" },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { address?: Record<string, string> };
    const a = body.address;
    if (!a) return null;
    const options = [a.state, a.region, a.county, a.city, a.town, a.municipality]
      .filter((v): v is string => !!v)
      .filter((v, i, all) => all.indexOf(v) === i);
    return {
      country: a.country ?? null,
      area: a.state ?? a.region ?? a.county ?? a.city ?? a.town ?? null,
      areaOptions: options,
    };
  } catch {
    return null;
  }
}

/** If an existing spot already sits within `radiusM`, reuse its country/area
 *  spelling, so "Siargao" doesn't fragment into variants. */
export function neighbourPlace(
  spots: readonly Spot[],
  point: LatLng,
  radiusM = 30_000
): { country: string; area: string } | null {
  let best: { d: number; country: string; area: string } | null = null;
  for (const s of spots) {
    if (s.lat == null || s.lng == null || !s.country || !s.area) continue;
    const d = distanceM(point, { lat: s.lat, lng: s.lng });
    if (d <= radiusM && (!best || d < best.d)) best = { d, country: s.country, area: s.area };
  }
  return best && { country: best.country, area: best.area };
}
