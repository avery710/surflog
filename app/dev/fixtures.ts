/**
 * Shared synthetic data builders for app/dev showcase pages — see
 * CLAUDE.md "Project agents" (storybook) and app/dev/page.tsx.
 *
 * Typed against lib/types.ts so a schema change breaks the build instead of
 * silently drifting. SYNTHETIC ONLY: never import lib/db.ts, lib/openmeteo.ts
 * (the fetcher) or lib/cwa-tide.ts (the fetcher) here, never copy a real
 * session/board/id. It's fine to import lib/types.ts, lib/spots.ts and other
 * pure lib/ modules that don't touch Supabase or the network.
 */
import type {
  Board,
  Cond,
  CondCwaTide,
  CondOpenMeteo,
  Photo,
  Rocker,
  Session,
  TideEvent,
} from "@/lib/types";

let seq = 0;
/** Deterministic-enough ids for dev fixtures — not real database ids. */
function nextId(prefix: string): string {
  seq += 1;
  return `dev-${prefix}-${seq}`;
}

export function fakeTideEvent(overrides: Partial<TideEvent> = {}): TideEvent {
  return {
    type: "high",
    time: "2026-09-25T14:05",
    heightM: 1.2,
    ...overrides,
  };
}

/** A typical mixed-tide day at Jialeshui-ish latitudes: low, high, low, high
 *  roughly every 6 h, spanning the whole session day plus a bit either side
 *  (condCwaTide/condOpenMeteo store +/-14h around the session, always
 *  the bracket — see lib/tide-bracket.ts). */
export function tideDay(dateYmd: string, heights = [0.3, 1.25, 0.35, 1.15]): TideEvent[] {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const prevDay = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return [
    { type: "low", time: `${prevDay}T20:10`, heightM: heights[2] },
    { type: "high", time: `${dateYmd}T02:15`, heightM: heights[3] },
    { type: "low", time: `${dateYmd}T08:12`, heightM: heights[0] },
    { type: "high", time: `${dateYmd}T14:05`, heightM: heights[1] },
    { type: "low", time: `${dateYmd}T20:26`, heightM: heights[2] },
    { type: "high", time: `${nextDay}T02:30`, heightM: heights[3] },
  ];
}

export function fakeCondOpenMeteo(overrides: Partial<CondOpenMeteo> = {}): CondOpenMeteo {
  return {
    swellHeightM: 1.1,
    swellPeriodS: 8.2,
    swellDirDeg: 95,
    secondarySwellHeightM: 0.4,
    secondarySwellPeriodS: 5.1,
    secondarySwellDirDeg: 140,
    windWaveHeightM: 0.5,
    windWavePeriodS: 4.2,
    combinedWaveHeightM: 1.2,
    windSpeedMs: 4.2,
    windGustMs: 6.5,
    windDirDeg: 250,
    seaTempC: 27.4,
    airTempC: 29.1,
    seaLevelM: 0.6,
    seaLevelTrend: "falling",
    tideEvents: tideDay("2026-09-25"),
    gridLat: 21.958,
    gridLng: 120.875,
    source: "open-meteo",
    fetchedAt: "2026-09-25T06:00:00.000Z",
    ...overrides,
  };
}

export function fakeCondCwaTide(overrides: Partial<CondCwaTide> = {}): CondCwaTide {
  return {
    tideM: 1.2,
    tideType: "high",
    time: "2026-09-25T14:05",
    stationTownship: "屏東縣滿州鄉",
    events: tideDay("2026-09-25"),
    source: "cwa",
    fetchedAt: "2026-09-25T06:00:00.000Z",
    ...overrides,
  };
}

export function fakeCond(overrides: Partial<Cond> = {}): Cond {
  return {
    swellHeightM: 1.0,
    swellPeriodS: 7.0,
    swellDir: "E",
    windSpeedMs: 5,
    windGustMs: 8,
    windDir: "W",
    tideM: 1.1,
    tideNote: "近滿潮",
    seaTempC: 27,
    airTempC: 29,
    sky: "Partly cloudy",
    source: "swelleye",
    filledAt: "2026-09-25T06:00:00.000Z",
    ...overrides,
  };
}

export function fakePhoto(overrides: Partial<Photo> = {}): Photo {
  return { id: nextId("photo"), type: "image/jpeg", ...overrides };
}

export function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: nextId("session"),
    ownerId: "dev-owner",
    spot: "jialeshui",
    when: "2026-09-25T16:00",
    notesHtml: "<p>Fun peaky wave, offshore in the morning.</p>",
    notes: "Fun peaky wave, offshore in the morning.",
    photos: [],
    cond: null,
    condOpenMeteo: fakeCondOpenMeteo(),
    condCwaTide: fakeCondCwaTide(),
    boardId: null,
    goalText: null,
    goalMet: null,
    createdAt: "2026-09-25T16:05:00.000Z",
    ...overrides,
  };
}

export function fakeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: nextId("board"),
    ownerId: "dev-owner",
    brand: "Pyzel Ghost",
    lengthIn: 74, // 6'2"
    volumeL: 29.5,
    rocker: "medium" as Rocker,
    note: "",
    photoId: null,
    isDefault: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

/** No-op handlers for rendering interactive components live — see the
 *  storybook agent's "What makes a good showcase page". */
export function noop() {}
export function logAction(label: string) {
  return (...args: unknown[]) => {
    console.log(`[dev/${label}]`, ...args);
  };
}
