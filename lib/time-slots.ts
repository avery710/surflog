// The time picker's grid: every half hour, 00:00 … 23:30. Open-Meteo is hourly
// (a :30 time takes the nearest hour, see getConditions) and the tide
// bracket works to the minute, so finer than this would promise more than
// the data has. It was 2-hourly (Swelleye's table) until 2026-10-20.
export const SLOT_MINUTES = 30;
export const TIME_SLOTS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => {
  const m = i * SLOT_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

/** How long a session can be: every half hour to 4 h, then hourly to 8 h. */
export const DURATIONS_MIN = [30, 60, 90, 120, 150, 180, 210, 240, 300, 360, 420, 480];
export const isDuration = (v: unknown): v is number => typeof v === "number" && DURATIONS_MIN.includes(v);

/** Minutes since midnight of a "YYYY-MM-DDTHH:mm". */
export const minutesOfDay = (when: string) => parseInt(when.slice(11, 13), 10) * 60 + parseInt(when.slice(14, 16), 10);

/** The "YYYY-MM-DDTHH:mm" a session ends at, or null when it has no duration or
 *  would run past midnight (a session stays on its own day). */
export function endOfSession(when: string, durationMin: number | null | undefined): string | null {
  if (!durationMin) return null;
  const end = minutesOfDay(when) + durationMin;
  if (end >= 24 * 60) return null;
  return `${when.slice(0, 10)}T${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}
