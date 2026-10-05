/**
 * Spot types and pure helpers. The catalogue itself lives in the `spots`
 * table (lib/spot-store.ts on the server, lib/spot-catalog.tsx on the
 * client); lib/spot-fixtures.ts holds a static demo/fallback copy.
 */
export type Region = "North" | "Northeast" | "East" | "South" | "West";

/** One break, wherever it lives — a row of the `spots` table. */
export interface Spot {
  slug: string;
  name: string;
  /** Chinese name (Swelleye's zh-TW page title for the Taiwan spots); the
   *  label falls back to `name` when absent. */
  nameZh?: string;
  /** Taiwan spots only (grouping in the picker); elsewhere `country`+`area`. */
  region?: Region;
  country: string;
  /** e.g. "Siargao", "Bali"; for Taiwan spots the region name. */
  area: string;
  lat: number | null;
  lng: number | null;
  /** IANA zone of the spot ("Asia/Taipei", "Asia/Manila"). `when` on a
   *  session is local time in this zone; Open-Meteo is asked for it. */
  timezone: string;
  /** Spot Infographic fields (Swelleye, Taiwan spots) — the break-specific
   *  information Open-Meteo cannot provide. `facing` alone is enough for
   *  the wind tile's shore word. */
  facing?: string;
  bestSwellDir?: string[];
  bestWindDir?: string[];
  bestTide?: string;
  /** CWA's LocationName, e.g. "宜蘭縣頭城鎮" — Taiwan only; enables the CWA tide. */
  tideTownship?: string;
}

export const COUNTRY_TAIWAN = "Taiwan";

/** Sessions logged against a not-yet-approved spot request store
 *  `req:<requestId>` as their `spot` (legacy free text is `custom:…`). */
export const REQUEST_SLUG_PREFIX = "req:";
export const requestSlug = (requestId: string) => `${REQUEST_SLUG_PREFIX}${requestId}`;
export const isRequestSlug = (slug: string) => slug.startsWith(REQUEST_SLUG_PREFIX);
