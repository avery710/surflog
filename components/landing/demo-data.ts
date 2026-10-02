/**
 * Synthetic sessions/boards for the signed-out landing page (app/page.tsx
 * → components/landing/landing.tsx). Built on app/dev/fixtures.ts's typed
 * builders, so a schema change breaks the build here too. SYNTHETIC ONLY —
 * no real session, board, photo or id; the page must never read lib/db.ts.
 *
 * Dates are relative to "today" in Asia/Taipei so the activity calendar
 * always looks lived-in. Demo notes and goal points are passed in already
 * translated (landing.tsx calls t()), since they read as UI copy here.
 */
import {
  fakeBoard,
  fakeCondCwaTide,
  fakeCondOpenMeteo,
  fakeSession,
  tideDay,
} from "@/app/dev/fixtures";
import type { Board, Session } from "@/lib/types";

/** "YYYY-MM-DD" n days before `ymd` (UTC arithmetic on a date-only value,
 *  so it can't shift across a timezone). */
function daysBefore(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

export const DEMO_BOARDS: Board[] = [
  fakeBoard({ id: "demo-board-1", brand: "Pyzel Ghost", lengthIn: 74, volumeL: 29.5, rocker: "medium", isFavorite: true, sortOrder: 0 }),
  fakeBoard({ id: "demo-board-2", brand: "Log", lengthIn: 110, volumeL: 68, rocker: "low", sortOrder: 1 }),
];

// Spot + days-ago for the history behind the calendar and spots table.
const HISTORY: [string, number][] = [
  ["jialeshui", 2], ["jialeshui", 4], ["nanwan", 5], ["jialeshui", 8],
  ["waiao", 11], ["waiao", 12], ["jialeshui", 15], ["double-lions", 19],
  ["jialeshui", 22], ["waiao", 26], ["jialeshui", 30], ["nanwan", 34],
  ["jialeshui", 37], ["waiao", 41],
];

export function demoSessions(
  today: string,
  copy: { notesHtml: string; notes: string; goal: string }
): { hero: Session; all: Session[] } {
  const heroDay = daysBefore(today, 1);
  const tide = tideDay(heroDay, [0.3, 1.25, 0.35, 1.15]);
  const hero = fakeSession({
    id: "demo-hero",
    spot: "jialeshui",
    when: `${heroDay}T06:00`,
    notesHtml: copy.notesHtml,
    notes: copy.notes,
    condOpenMeteo: fakeCondOpenMeteo({
      swellHeightM: 1.1,
      swellPeriodS: 8.2,
      swellDirDeg: 95,
      windSpeedMs: 3.1,
      windGustMs: 4.4,
      windDirDeg: 300,
      seaTempC: 27.4,
      airTempC: 26.8,
      tideEvents: tide,
    }),
    condCwaTide: fakeCondCwaTide({ events: tide, time: tide[2].time, tideType: "low", tideM: 0.3 }),
    boardId: "demo-board-1",
    goalText: copy.goal,
    goalPointsMet: [true, false],
    goalMet: false,
  });

  const rest = HISTORY.map(([spot, ago], i) => {
    const day = daysBefore(today, ago);
    return fakeSession({
      id: `demo-${i}`,
      spot,
      when: `${day}T${i % 3 === 0 ? "16:00" : "06:00"}`,
      condOpenMeteo: fakeCondOpenMeteo({ tideEvents: tideDay(day) }),
      condCwaTide: fakeCondCwaTide({ events: tideDay(day) }),
      goalText: copy.goal,
      // A believable mix: the first point gets ticked more often.
      goalPointsMet: [i % 3 !== 1, i % 4 === 0],
    });
  });

  return { hero, all: [hero, ...rest] };
}
