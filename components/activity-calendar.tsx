"use client";

import { cn } from "cn";
import { useLang } from "@/lib/i18n";
import { taipeiToday } from "@/lib/format";
import type { Session } from "@/lib/types";

const WEEKS = 20;

/** Sequential single-hue ramp off the teal accent, light -> dark by session
 *  count. Level 0 reuses --secondary (the existing "empty tile" token)
 *  rather than a 4th mixed step, so an empty calendar doesn't read as
 *  "very faint teal" — it reads as genuinely empty. */
const LEVEL_BG = [
  "var(--secondary)",
  "color-mix(in oklch, white, #0E7C86 35%)",
  "color-mix(in oklch, white, #0E7C86 65%)",
  "#0E7C86",
];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

export function ActivityCalendar({ sessions }: { sessions: Session[] }) {
  const { lang, t } = useLang();

  const counts = new Map<string, number>();
  for (const s of sessions) {
    const day = s.when?.slice(0, 10);
    if (!day) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const [ty, tm, td] = taipeiToday().split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() - today.getDay());
  const start = new Date(endSunday);
  start.setDate(endSunday.getDate() - (WEEKS - 1) * 7);

  const cols: Date[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      week.push(day);
    }
    cols.push(week);
  }

  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  cols.forEach((week, i) => {
    const m = week[0].getMonth();
    if (m !== lastMonth) {
      lastMonth = m;
      monthLabels.push({ col: i, label: week[0].toLocaleString(lang === "zh-TW" ? "zh-TW" : "en-US", { month: "short" }) });
    }
  });

  const CELL = 16; // dot size + gap, px — month labels line up against this stride

  return (
    <section className="min-w-[280px]">
      <div className="pl-1 font-sans text-[13px] font-bold text-muted-foreground">
        {t("section.activity")}
      </div>
      <div className="mt-2.5 overflow-x-auto rounded-[var(--r-card)] border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)] [scrollbar-width:none]">
        <div
          className="relative mb-1.5 h-3.5"
          style={{ width: WEEKS * CELL }}
        >
          {monthLabels.map(({ col, label }) => (
            <span
              key={col}
              className="absolute top-0 text-[10px] font-medium text-muted-foreground"
              style={{ left: col * CELL }}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {cols.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => {
                const key = isoDate(day);
                const count = counts.get(key) ?? 0;
                const isFuture = day > today;
                return (
                  <span
                    key={di}
                    title={
                      isFuture
                        ? undefined
                        : `${key} · ${t(count === 1 ? "calendar.session" : "calendar.sessions", { n: count })}`
                    }
                    className={cn("block size-3 rounded-full")}
                    style={{ backgroundColor: isFuture ? "transparent" : LEVEL_BG[level(count)] }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
