/**
 * Entry schema — see CLAUDE.md "Entry schema" for the canonical version and
 * why each field is shaped the way it is.
 *
 * Two additions beyond what's in the artifact today, both called out in
 * CLAUDE.md as things this repo should add:
 *
 * - `condOpenMeteo`: a PARALLEL block, not a replacement for `cond`. Capy
 *   wants to know which number came from where. `cond` stays the manually
 *   entered Swelleye headline reading (nothing here scrapes Swelleye — see
 *   "The automation problem"); `condOpenMeteo` is filled automatically,
 *   server-side, at save time.
 * - `rating`: "the fix is one field" — see CLAUDE.md "The unfalsifiability
 *   problem". Optional, 1-5, so spot-fit has something to eventually test
 *   against. Never required, never assumed present.
 */

/** A single tide turning point (high or low), used by both `condCwaTide`
 *  and `condOpenMeteo` — see CLAUDE.md "Entry schema". */
export interface TideEvent {
  type: "high" | "low";
  time: string; // "YYYY-MM-DDTHH:mm", Asia/Taipei local, no tz suffix
  heightM: number | null;
}

export interface Cond {
  swellHeightM: number | null;
  swellPeriodS: number | null;
  swellDir: string | null; // compass point, e.g. "ENE" — Swelleye gives arrows, not degrees
  windSpeedMs: number | null;
  windGustMs: number | null;
  windDir: string | null;
  tideM: number | null;
  tideNote: string | null;
  seaTempC: number | null;
  airTempC: number | null;
  sky: string | null;
  source: "swelleye" | "manual";
  filledAt: string;
}

/** Open-Meteo reading, auto-filled server-side at save time. See lib/openmeteo.ts. */
export interface CondOpenMeteo {
  swellHeightM: number | null;
  swellPeriodS: number | null;
  swellDirDeg: number | null;
  secondarySwellHeightM: number | null;
  secondarySwellPeriodS: number | null;
  secondarySwellDirDeg: number | null;
  windWaveHeightM: number | null;
  windWavePeriodS: number | null;
  combinedWaveHeightM: number | null;
  windSpeedMs: number | null;
  windGustMs: number | null;
  windDirDeg: number | null;
  seaTempC: number | null;
  airTempC: number | null;
  /** Optional: rows saved before 2026-09-22 were backfilled; see lib/openmeteo.ts. */
  seaLevelM?: number | null;
  seaLevelTrend?: "rising" | "falling" | null;
  /** Optional: turning points of hourly `sea_level_height_msl` within +/-14 h
   *  of the session, plus always the bracket (last at/before, first after)
   *  even if further out. Sorted by time, strictly alternating high/low.
   *  Rows saved before 2026-09-24 hold only the bracket pair. MSL-datum,
   *  offshore grid node — not comparable to condCwaTide's TWVD heights, only
   *  useful as a fallback when CWA can't cover the session. See lib/openmeteo.ts. */
  tideEvents?: TideEvent[];
  gridLat: number;
  gridLng: number;
  source: "open-meteo";
  fetchedAt: string;
}

/**
 * CWA (Taiwan Central Weather Administration) tide forecast, auto-filled
 * server-side at save time — see lib/cwa-tide.ts. Taiwan-only, keyed by
 * township rather than lat/lng (see lib/spots.ts `tideTownship`), so this
 * stays null for spots without a known township and for overseas sessions.
 * Kept as its own block for the same reason `condOpenMeteo` is separate from
 * `cond`: each source's numbers stay attributable to where they came from.
 */
export interface CondCwaTide {
  tideM: number | null; // nearest tide event's height, AboveTWVD, cm -> m
  tideType: "high" | "low" | null; // 滿潮 / 乾潮
  time: string | null; // ISO — when that nearest tide event happens
  stationTownship: string; // CWA's LocationName, e.g. "宜蘭縣頭城鎮"
  /** Optional: tide events within +/-14 h of the session, plus always the
   *  bracket (last event at/before it, first after it) even if further out.
   *  Sorted by time. Older rows hold only the bracket pair, or (before
   *  2026-09-24) just the single-event fields above.
   *  Same 7h forward-only cap as those fields — see lib/cwa-tide.ts. */
  events?: TideEvent[];
  source: "cwa";
  fetchedAt: string;
}

export interface Photo {
  id: string;
  type: string; // mime type; "video/*" renders as <video>
}

export interface Session {
  id: string;
  /** Google account's stable OIDC subject id (session.user.id from auth.ts).
   *  Every read/write is scoped to this — see CLAUDE.md "Multi-user". */
  ownerId: string;
  spot: string; // Swelleye slug, or "custom:Free text"
  when: string; // "YYYY-MM-DDTHH:mm", Asia/Taipei local, 2-hour grid
  notesHtml: string; // sanitized: ul/ol/li/b/i only
  notes: string; // plain-text mirror
  photos: Photo[];
  cond: Cond | null;
  condOpenMeteo: CondOpenMeteo | null;
  condCwaTide: CondCwaTide | null;
  /** 1-5, optional. See CLAUDE.md "The unfalsifiability problem". */
  rating: number | null;
  /** The owner's board this was surfed on (boards.id), or null. Optional so
   *  rows read before the boards migration still type-check. */
  boardId?: string | null;
  createdAt: string;
  example?: true;
}

export type Rocker = "low" | "medium" | "high";

/** A board in the owner's rack — table `boards`. Length is total inches, the
 *  one deliberate exception to metric (see CLAUDE.md "Conventions"); shown as
 *  ft'in via lib/boards.ts. */
export interface Board {
  id: string;
  ownerId: string;
  brand: string;
  lengthIn: number | null;
  volumeL: number | null;
  rocker: Rocker | null;
  note: string;
  /** photo_blobs id, served by /api/blob/:id (owner-checked); images only. */
  photoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewSession = Pick<Session, "spot" | "when"> &
  Partial<Pick<Session, "notesHtml" | "notes" | "rating">>;
