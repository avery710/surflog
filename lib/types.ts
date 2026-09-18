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
  gridLat: number;
  gridLng: number;
  source: "open-meteo";
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
  /** 1-5, optional. See CLAUDE.md "The unfalsifiability problem". */
  rating: number | null;
  createdAt: string;
  example?: true;
}

export type NewSession = Pick<Session, "spot" | "when"> &
  Partial<Pick<Session, "notesHtml" | "notes" | "rating">>;
