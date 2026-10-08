/**
 * Spot edit suggestions — the pure part (no database, no auth), shared by the
 * suggestion dialog, the API routes and the admin diff view.
 *
 * A suggestion stores only the fields that differ from the spot
 * (`SpotChanges`) plus `base`, what those fields held when it was made, so an
 * admin can tell the spot has moved on since. "" / [] means "clear it".
 * Name, country, area, facing, best swell/wind/tide and the pin may be
 * suggested; region and CWA township stay admin-only.
 */
import type { Spot } from "./spots";
import { distanceM, round5, validLatLng, type LatLng } from "./spot-geo";
import { validateFields } from "./spot-create";

export const MAX_NOTE = 500;
/** A pin closer than this to where the spot already is counts as unmoved. */
const SAME_PIN_M = 2;

export interface SpotChanges {
  name?: string;
  nameZh?: string;
  country?: string;
  area?: string;
  facing?: string;
  bestTide?: string;
  bestSwellDir?: string[];
  bestWindDir?: string[];
  lat?: number;
  lng?: number;
}

export type ChangeKey = keyof SpotChanges;

/** What the form sends: like SpotChanges but the pin is raw `location` text
 *  (coordinates or a Maps link) which the server parses. */
export type SpotChangesInput = Omit<SpotChanges, "lat" | "lng"> & { location?: string };

const TEXT_KEYS = ["name", "nameZh", "country", "area", "facing", "bestTide"] as const;
const LIST_KEYS = ["bestSwellDir", "bestWindDir"] as const;
const INPUT_KEYS: readonly string[] = [...TEXT_KEYS, ...LIST_KEYS, "location"];

/** Fields in display order for the diff views. `lat`/`lng` show as one "location". */
export const DIFF_ORDER = ["name", "nameZh", "country", "area", "location", "facing", "bestSwellDir", "bestWindDir", "bestTide"] as const;
export type DiffField = (typeof DIFF_ORDER)[number];

/** The spot's value for a key, normalised the way suggestions store it. */
export function currentValue(spot: Spot, key: ChangeKey): string | string[] | number | null {
  switch (key) {
    case "name": return spot.name;
    case "nameZh": return spot.nameZh ?? "";
    case "country": return spot.country ?? "";
    case "area": return spot.area ?? "";
    case "facing": return spot.facing ?? "";
    case "bestTide": return spot.bestTide ?? "";
    case "bestSwellDir": return spot.bestSwellDir ?? [];
    case "bestWindDir": return spot.bestWindDir ?? [];
    case "lat": return spot.lat;
    case "lng": return spot.lng;
  }
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The spot's values for exactly the keys in `changes` — the `base` snapshot. */
export function baseFor(spot: Spot, changes: SpotChanges): SpotChanges {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(changes) as ChangeKey[]) out[key] = currentValue(spot, key);
  return out as SpotChanges;
}

/** Keys of `changes` whose proposed value the spot already holds (no-ops). */
export function alreadyApplied(spot: Spot, changes: SpotChanges): ChangeKey[] {
  return (Object.keys(changes) as ChangeKey[]).filter((k) => sameValue(currentValue(spot, k), changes[k]));
}

/** Keys where the spot is no longer what it was when the suggestion was made. */
export function staleKeys(spot: Spot, base: SpotChanges): ChangeKey[] {
  return (Object.keys(base) as ChangeKey[]).filter((k) => !sameValue(currentValue(spot, k), base[k]));
}

/** Two suggestions propose exactly the same thing. */
export function sameChanges(a: SpotChanges, b: SpotChanges): boolean {
  const norm = (c: SpotChanges) => JSON.stringify(Object.entries(c).sort(([x], [y]) => (x < y ? -1 : 1)));
  return norm(a) === norm(b);
}

/** The diff view's rows: lat+lng collapse into one `location` row. */
export function diffRows(spot: Spot, changes: SpotChanges): { field: DiffField; from: string | string[] | LatLng | null; to: string | string[] | LatLng }[] {
  const rows: ReturnType<typeof diffRows> = [];
  for (const field of DIFF_ORDER) {
    if (field === "location") {
      if (changes.lat != null && changes.lng != null) {
        rows.push({
          field,
          from: spot.lat != null && spot.lng != null ? { lat: spot.lat, lng: spot.lng } : null,
          to: { lat: changes.lat, lng: changes.lng },
        });
      }
      continue;
    }
    if (field in changes) {
      rows.push({ field, from: currentValue(spot, field) as string | string[], to: changes[field] as string | string[] });
    }
  }
  return rows;
}

// ---- client side -----------------------------------------------------------

/** What the dialog's inputs hold. */
export interface SpotDraft {
  name: string;
  nameZh: string;
  country: string;
  area: string;
  facing: string;
  bestTide: string;
  bestSwellDir: string[];
  bestWindDir: string[];
  location: string;
}

export function draftFromSpot(spot: Spot): SpotDraft {
  return {
    name: spot.name,
    nameZh: spot.nameZh ?? "",
    country: spot.country ?? "",
    area: spot.area ?? "",
    facing: spot.facing ?? "",
    bestTide: spot.bestTide ?? "",
    bestSwellDir: spot.bestSwellDir ?? [],
    bestWindDir: spot.bestWindDir ?? [],
    location: "",
  };
}

const squash = (s: string) => s.trim().replace(/\s+/g, " ");

/** Only the fields the user actually changed, ready to send. `parsePin`
 *  resolves the location text on the client when it can (not for short links,
 *  which the server follows); a pin within 2 m of the current one is no change. */
export function diffDraft(spot: Spot, draft: SpotDraft, parsePin: (text: string) => LatLng | null): SpotChangesInput {
  const out: SpotChangesInput = {};
  for (const key of TEXT_KEYS) {
    const next = key === "facing" ? draft[key].trim().toUpperCase() : squash(draft[key]);
    if (next !== currentValue(spot, key)) out[key] = next;
  }
  for (const key of LIST_KEYS) {
    const next = draft[key].map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (!sameValue(next, currentValue(spot, key))) out[key] = next;
  }
  const loc = draft.location.trim();
  if (loc) {
    const pin = parsePin(loc);
    const moved =
      !pin || spot.lat == null || spot.lng == null || distanceM(pin, { lat: spot.lat, lng: spot.lng }) > SAME_PIN_M;
    if (moved) out.location = loc;
  }
  return out;
}

// ---- server side -----------------------------------------------------------

export type NormalizeResult =
  | { ok: true; changes: SpotChanges; base: SpotChanges }
  | { ok: false; code: "invalid" | "bad_location" | "no_changes"; error: string };

/**
 * Validates a submitted suggestion against the spot it is for, with the same
 * field rules as adding/editing a spot (validateFields), and reduces it to the
 * fields that really differ. Untrusted input: unknown keys are refused, text
 * is trimmed and collapsed, compass points upper-cased.
 */
export async function normalizeChanges(
  spot: Spot,
  input: unknown,
  resolveLocation: (text: string) => Promise<LatLng | null>
): Promise<NormalizeResult> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "invalid", error: "changes must be an object" };
  }
  const raw = input as Record<string, unknown>;
  for (const k of Object.keys(raw)) {
    if (!INPUT_KEYS.includes(k)) return { ok: false, code: "invalid", error: `unknown field: ${k}` };
  }
  for (const k of [...TEXT_KEYS, "location"]) {
    if (k in raw && typeof raw[k] !== "string") return { ok: false, code: "invalid", error: `${k} must be text` };
  }
  for (const k of LIST_KEYS) {
    if (k in raw && !(Array.isArray(raw[k]) && (raw[k] as unknown[]).every((x) => typeof x === "string"))) {
      return { ok: false, code: "invalid", error: `${k} must be a list` };
    }
  }

  // Merge over the current values so validateFields sees a complete spot.
  const merged: Record<string, unknown> = {
    name: spot.name,
    nameZh: spot.nameZh ?? "",
    region: spot.region ?? "",
    country: spot.country,
    area: spot.area,
    facing: spot.facing ?? "",
    bestSwellDir: spot.bestSwellDir ?? null,
    bestWindDir: spot.bestWindDir ?? null,
    bestTide: spot.bestTide ?? "",
    tideTownship: spot.tideTownship ?? "",
  };
  for (const k of [...TEXT_KEYS, ...LIST_KEYS]) if (k in raw) merged[k] = raw[k];
  const fields = validateFields(merged);
  if (!fields.ok) return { ok: false, code: "invalid", error: fields.error };

  const normalized: Record<(typeof TEXT_KEYS)[number] | (typeof LIST_KEYS)[number], string | string[]> = {
    name: fields.name,
    nameZh: fields.nameZh ?? "",
    country: fields.country,
    area: fields.area,
    facing: fields.facing ?? "",
    bestTide: fields.bestTide ?? "",
    bestSwellDir: fields.bestSwellDir ?? [],
    bestWindDir: fields.bestWindDir ?? [],
  };
  const changes: SpotChanges = {};
  for (const k of [...TEXT_KEYS, ...LIST_KEYS]) {
    if (k in raw && !sameValue(normalized[k], currentValue(spot, k))) (changes as Record<string, unknown>)[k] = normalized[k];
  }

  if (typeof raw.location === "string" && raw.location.trim()) {
    const text = raw.location.trim();
    const pin = text.length <= 2000 ? await resolveLocation(text) : null;
    if (!pin || !validLatLng(pin.lat, pin.lng)) {
      return { ok: false, code: "bad_location", error: "couldn't find coordinates in that location" };
    }
    const moved =
      spot.lat == null || spot.lng == null || distanceM(pin, { lat: spot.lat, lng: spot.lng }) > SAME_PIN_M;
    if (moved) {
      changes.lat = round5(pin.lat);
      changes.lng = round5(pin.lng);
    }
  }

  if (Object.keys(changes).length === 0) {
    return { ok: false, code: "no_changes", error: "nothing differs from the spot as it is now" };
  }
  return { ok: true, changes, base: baseFor(spot, changes) };
}

/** Body for `validateFields` / the spot update: the spot's current values
 *  with `changes` laid over them (region and CWA township untouched). */
export function applyChanges(spot: Spot, changes: SpotChanges): Record<string, unknown> {
  return {
    name: changes.name ?? spot.name,
    nameZh: changes.nameZh ?? spot.nameZh ?? "",
    region: spot.region ?? "",
    country: changes.country ?? spot.country,
    area: changes.area ?? spot.area,
    facing: changes.facing ?? spot.facing ?? "",
    bestSwellDir: changes.bestSwellDir ?? spot.bestSwellDir ?? null,
    bestWindDir: changes.bestWindDir ?? spot.bestWindDir ?? null,
    bestTide: changes.bestTide ?? spot.bestTide ?? "",
    tideTownship: spot.tideTownship ?? "",
  };
}

/** The note column: trimmed, empty → null; null when too long (caller refuses). */
export function cleanNote(v: unknown): string | null | "invalid" {
  if (v == null) return null;
  if (typeof v !== "string") return "invalid";
  const t = v.trim();
  if (t.length > MAX_NOTE) return "invalid";
  return t || null;
}

/** Rows of a suggestion's `changes` jsonb from the database are untrusted
 *  too (hand-edited, older code): keep only known keys with the right types. */
export function readChanges(v: unknown): SpotChanges {
  const out: Record<string, unknown> = {};
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  for (const k of TEXT_KEYS) if (typeof o[k] === "string") out[k] = o[k];
  for (const k of LIST_KEYS) {
    if (Array.isArray(o[k]) && (o[k] as unknown[]).every((x) => typeof x === "string")) out[k] = o[k];
  }
  if (typeof o.lat === "number" && typeof o.lng === "number") {
    out.lat = o.lat;
    out.lng = o.lng;
  }
  return out as SpotChanges;
}
