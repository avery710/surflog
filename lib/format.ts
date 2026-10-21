import { TAIWAN_SPOTS_FIXTURE } from "./spot-fixtures";
import type { Spot } from "./spots";
import type { Lang } from "./i18n";
import { SLOT_MINUTES, endOfSession } from "./time-slots";

/** Label for a spot slug in a place with no catalogue context (CSV export,
 *  the landing page): looks in `spots`, which defaults to the demo fixture.
 *  React code should use `useSpotCatalog().label` — it also knows spot
 *  requests (`req:<id>`). Legacy "custom:" free text shows as typed. */
export function spotLabel(slug: string, lang: Lang = "en", spots: readonly Spot[] = TAIWAN_SPOTS_FIXTURE): string {
  if (!slug) return "Unknown spot";
  if (slug.startsWith("custom:")) return slug.slice(7);
  const spot = spots.find((s) => s.slug === slug);
  if (!spot) return slug;
  return lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];

/** `when` is "YYYY-MM-DDTHH:mm", local at the spot, no timezone suffix. */
export function fmtWhen(when: string, lang: Lang = "en", durationMin?: number | null): string {
  if (!when) return "";
  return `${fmtDate(when.slice(0, 10), lang)} · ${fmtTime(when, durationMin)}`;
}

/** "16:00", or "16:00–18:30" when the session has a duration. */
export function fmtTime(when: string, durationMin?: number | null): string {
  const end = endOfSession(when, durationMin);
  return end ? `${when.slice(11, 16)}–${end.slice(11, 16)}` : when.slice(11, 16);
}

/** 90 → "1 h 30 min" / "1 小時 30 分"; 30 → "30 min" / "30 分鐘". */
export function fmtDuration(min: number, lang: Lang = "en"): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (lang === "zh-TW") return h ? `${h} 小時${m ? ` ${m} 分` : ""}` : `${m} 分鐘`;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** "YYYY-MM-DD" → "Fri 25 Sep 2026" / "2026年9月25日（週五）"; without the
 *  weekday when `weekday` is false. */
export function fmtDate(date: string, lang: Lang = "en", weekday = true): string {
  if (!date) return "";
  const [y, m, day] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, day).getDay();
  if (lang === "zh-TW") return `${y}年${m}月${day}日${weekday ? `（週${DAYS_ZH[dow]}）` : ""}`;
  return `${weekday ? `${DAYS[dow]} ` : ""}${day} ${MONTHS[m - 1]} ${y}`;
}

/** "YYYY-MM-DD" → "25 Sep" / "9月25日": the date without its year. */
export function fmtMonthDay(date: string, lang: Lang = "en"): string {
  if (!date) return "";
  const [, m, day] = date.split("-").map(Number);
  return lang === "zh-TW" ? `${m}月${day}日` : `${day} ${MONTHS[m - 1]}`;
}

// CWA's own convention for the 16 compass points.
const COMPASS_ZH: Record<string, string> = {
  N: "北", NNE: "北北東", NE: "東北", ENE: "東北東",
  E: "東", ESE: "東南東", SE: "東南", SSE: "南南東",
  S: "南", SSW: "南南西", SW: "西南", WSW: "西南西",
  W: "西", WNW: "西北西", NW: "西北", NNW: "北北西",
};

/** Translates a compass abbreviation ("ENE"); free text passes through unchanged. */
export function compassLabel(dir: string | null | undefined, lang: Lang = "en"): string | null {
  if (!dir) return null;
  if (lang !== "zh-TW") return dir;
  return COMPASS_ZH[dir.trim().toUpperCase()] ?? dir;
}

/** "YYYY-MM-DD" for today in an IANA zone, independent of the server/browser's own tz. */
export function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Nearest half-hour slot, "HH:mm", for the current time in an IANA zone
 *  (a tie rounds up, and the day's last slot is 23:30). */
export function nearestSlotInZone(timeZone: string, now: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const minutes = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  const slot = Math.min(24 * 60 - SLOT_MINUTES, Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES);
  return `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`;
}

/** The latest `when` ("YYYY-MM-DDTHH:mm", local at the spot) a session may be
 *  logged for: now plus 15 minutes. Slots are on a half-hour grid and the
 *  form rounds to the nearest one, so at 15:20 the 15:30 slot is "now";
 *  anything beyond that hasn't happened yet and has no observed conditions.
 *  Compare as strings: `when <= latestLoggableWhen(tz)`. */
export function latestLoggableWhen(timeZone: string, now: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(now.getTime() + (SLOT_MINUTES / 2) * 60_000))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** "YYYY-MM-DD" for today in Asia/Taipei — the Taiwan breaks' zone, and the
 *  journal-wide "today" (activity calendar, dev fixtures). */
export const taipeiToday = (): string => todayInZone("Asia/Taipei");

/** Nearest half-hour slot now in Asia/Taipei. */
export const taipeiNearestSlot = (): string => nearestSlotInZone("Asia/Taipei");

/** Format a reading to 1 decimal place for display, e.g. 0.52 -> "0.5". */
export function fmt1(v: number | null | undefined): string | null {
  return v == null ? null : v.toFixed(1);
}

export function num(v: unknown, dp?: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return dp === undefined ? n : Number(n.toFixed(dp));
}
