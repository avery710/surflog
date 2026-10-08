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

// Two real stock models with their makers' published sizes. The pictures are
// files in public/landing/ (let through by proxy.ts); their sources and
// licences are in BOARD_PHOTO_CREDITS, which the page must keep showing —
// the Haydenshapes photo is CC BY-SA and needs its credit.
export const DEMO_BOARDS: Board[] = [
  fakeBoard({ id: "demo-board-3", brand: "Goofy Plank", note: "Zero flex. Maximum wipeout.", lengthIn: 84, volumeL: 55, rocker: "low", isFavorite: true, sortOrder: 0, photoUrl: "/landing/goofy-lightning-plank.jpg" }),
  fakeBoard({ id: "demo-board-1", brand: "Stitch Barrel", note: "Blue alien energy. Pure joy.", lengthIn: 66, volumeL: 32, rocker: "low", isFavorite: false, sortOrder: 1, photoUrl: "/landing/stitch-barrel.jpg" }),
];

export const BOARD_PHOTO_CREDITS: { label: string; href: string }[] = [];

// Spot + days-ago for the history behind the calendar and spots table.
const HISTORY: [string, number][] = [
  ["jialeshui", 2], ["jialeshui", 4], ["jialeshui", 8],
  ["jialeshui", 15], ["jialeshui", 19],
  ["jialeshui", 22], ["jialeshui", 26], ["jialeshui", 30],
  ["jialeshui", 37],
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
    boardId: "demo-board-3",
    goalText: copy.goal,
    goalPointsMet: [true, false, true],
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
      // A believable mix: the first point gets ticked most often.
      goalPointsMet: [i % 3 !== 1, i % 4 === 0, i % 2 === 0],
    });
  });

  return { hero, all: [hero, ...rest] };
}
