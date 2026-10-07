import type { TKey } from "./i18n";
import type { Region, Spot } from "./spots";

/**
 * Search and grouping of the spot catalogue, shared by the log form's picker
 * (components/spot-picker.tsx) and the /spots page, so both match and order
 * spots the same way. Pure: labels come in from the caller.
 */

export const REGIONS: Region[] = ["Northeast", "North", "East", "South", "West"];
/** Areas outside Taiwan that lead the Browse list, in this order (Avery's
 *  call); every other area follows alphabetically by "country · area". */
export const AREA_PRIORITY = ["Siargao", "Bali"];

/** Case, accents and apostrophes don't matter: "waiao" finds Wai'ao. */
export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "");
}

export function searchTokens(query: string): string[] {
  return fold(query.trim()).split(/\s+/).filter(Boolean);
}

/** Every token appears somewhere in `text` (a requested spot's typed name). */
export function nameMatches(text: string, tokens: readonly string[]): boolean {
  const hay = fold(text);
  return tokens.every((tok) => hay.includes(tok));
}

/** Spots matching every token in name, Chinese name, slug, area, country or
 *  (Taiwan) region; names that start with the query come first, otherwise
 *  catalogue order. `regionLabel` is the region in the viewer's language. */
export function searchSpots(
  spots: readonly Spot[],
  query: string,
  regionLabel: (region: Region) => string
): Spot[] {
  const tokens = searchTokens(query);
  const first = tokens[0] ?? "";
  return spots
    .map((s) => {
      const name = fold(`${s.name} ${s.nameZh ?? ""}`);
      const hay = fold(
        [
          s.name,
          s.nameZh,
          s.slug,
          s.area,
          s.country,
          // search aliases, never shown: Taiwan spots carry no country field
          ...(s.region ? [s.region, regionLabel(s.region), "Taiwan 台灣 臺灣"] : []),
        ]
          .filter(Boolean)
          .join(" ")
      );
      const tight = hay.replace(/\s+/g, ""); // "cloud9" finds "Cloud 9"
      const match = tokens.every((tok) => hay.includes(tok) || tight.includes(tok));
      return match ? { s, starts: name.split(" ").some((w) => w.startsWith(first)) } : null;
    })
    .filter((h) => h != null)
    .sort((a, b) => Number(b.starts) - Number(a.starts))
    .map((h) => h.s);
}

export interface SpotGroup {
  key: string;
  title: string;
  list: Spot[];
}

/** Browse order: Taiwan by region, then every other "country · area" with
 *  AREA_PRIORITY first and the rest alphabetical. Empty groups are kept (the
 *  caller drops them), so the Taiwan regions always come back in order. */
export function browseGroups(
  spots: readonly Spot[],
  labels: { regionTitle: (region: Region) => string; elsewhere: string }
): SpotGroup[] {
  const groups: SpotGroup[] = REGIONS.map((region) => ({
    key: `tw-${region}`,
    title: labels.regionTitle(region),
    list: spots.filter((s) => s.region === region),
  }));
  const abroad = new Map<string, Spot[]>();
  for (const s of spots) {
    if (s.region) continue;
    const title = [s.country, s.area].filter(Boolean).join(" · ") || labels.elsewhere;
    abroad.set(title, [...(abroad.get(title) ?? []), s]);
  }
  const rank = (title: string) => {
    const i = AREA_PRIORITY.indexOf(abroad.get(title)![0].area);
    return i === -1 ? AREA_PRIORITY.length : i;
  };
  for (const title of [...abroad.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
    groups.push({ key: `w-${title}`, title, list: abroad.get(title)! });
  }
  return groups;
}

const TIDE_BAND_KEYS: Record<string, TKey> = {
  "all tides": "spots.tide.all",
  "low to mid": "spots.tide.lowMid",
  mid: "spots.tide.mid",
  "mid to high": "spots.tide.midHigh",
  "mid to low": "spots.tide.midLow",
};

/** The i18n key for a spot's `bestTide` when it is one of the known bands;
 *  null for anything else (free text set by SQL), which is shown as stored. */
export function tideBandKey(bestTide: string): TKey | null {
  return TIDE_BAND_KEYS[bestTide.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
}

/** `facing` can hold two points ("E / SE"); each is translated on its own. */
export function facingPoints(facing: string): string[] {
  return facing
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
}
