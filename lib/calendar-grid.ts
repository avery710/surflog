import type { Lang } from "./i18n";

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Weekday initials, Sunday first (the activity calendar's week starts on Sunday too). */
export const WEEKDAYS: Record<Lang, string[]> = {
  en: ["S", "M", "T", "W", "T", "F", "S"],
  "zh-TW": ["日", "一", "二", "三", "四", "五", "六"],
};

/**
 * One month as a fixed 6 × 7 grid (42 cells, so the picker never changes
 * height between months), Sunday first: `null` before the 1st and after the
 * last day, "YYYY-MM-DD" for each day. `month` is 0–11. Plain calendar
 * arithmetic, no time zone involved.
 */
export function monthCells(year: number, month: number): (string | null)[] {
  const lead = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const mm = String(month + 1).padStart(2, "0");
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
  while (cells.length < 42) cells.push(null);
  return cells;
}

/** The month `delta` months from `year`/`month` (0–11), rolling over years. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

/** "October 2026" / "2026年10月". */
export function monthTitle(year: number, month: number, lang: Lang): string {
  return lang === "zh-TW" ? `${year}年${month + 1}月` : `${MONTHS_EN[month]} ${year}`;
}
