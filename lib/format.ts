import { SPOTS } from "./spots";
import type { Lang } from "./i18n";

export function spotLabel(slug: string, lang: Lang = "en"): string {
  if (!slug) return "Unknown spot";
  if (slug.startsWith("custom:")) return slug.slice(7);
  const spot = SPOTS.find((s) => s.slug === slug);
  if (!spot) return slug;
  return lang === "zh-TW" ? spot.nameZh : spot.name;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];

/** `when` is "YYYY-MM-DDTHH:mm", Asia/Taipei local, no timezone suffix. */
export function fmtWhen(when: string, lang: Lang = "en"): string {
  if (!when) return "";
  const d = when.slice(0, 10);
  const t = when.slice(11, 16);
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  if (lang === "zh-TW") return `${y}年${m}月${day}日（週${DAYS_ZH[dt.getDay()]}）· ${t}`;
  return `${DAYS[dt.getDay()]} ${day} ${MONTHS[m - 1]} ${y} · ${t}`;
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

/** "YYYY-MM-DD" for today in Asia/Taipei, independent of the server/browser's own tz. */
export function taipeiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Nearest 2-hour forecast slot, "HH:00", for the current time in Asia/Taipei. */
export function taipeiNearestSlot(): string {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const hour = parseInt(hourStr, 10) % 24;
  const slot = Math.min(22, Math.round(hour / 2) * 2);
  return `${String(slot).padStart(2, "0")}:00`;
}

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
