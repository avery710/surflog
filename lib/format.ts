import { SPOTS } from "./spots";

export function spotLabel(slug: string): string {
  if (!slug) return "Unknown spot";
  if (slug.startsWith("custom:")) return slug.slice(7);
  return SPOTS.find((s) => s.slug === slug)?.name ?? slug;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `when` is "YYYY-MM-DDTHH:mm", Asia/Taipei local, no timezone suffix. */
export function fmtWhen(when: string): string {
  if (!when) return "";
  const d = when.slice(0, 10);
  const t = when.slice(11, 16);
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  return `${DAYS[dt.getDay()]} ${day} ${MONTHS[m - 1]} ${y} · ${t}`;
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

export function num(v: unknown, dp?: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return dp === undefined ? n : Number(n.toFixed(dp));
}
