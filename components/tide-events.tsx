"use client";

import { fmt1 } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { TideEvent } from "@/lib/types";

/**
 * Whether the tide was rising or falling at the session, read off the
 * bracketing events: heading toward a high (or just past a low) means
 * rising. Works with a single event too — older CWA rows only stored the
 * nearest one. `time` and `sessionWhen` share the "YYYY-MM-DDTHH:mm"
 * format, so a string compare orders them.
 */
export function tideTrend(input: TideEvent[], sessionWhen: string): "rising" | "falling" | null {
  const events = [...input].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const next = events.find((e) => e.time > sessionWhen);
  if (next) return next.type === "high" ? "rising" : "falling";
  const prev = events.findLast((e) => e.time <= sessionWhen);
  if (prev) return prev.type === "low" ? "rising" : "falling";
  return null;
}

/**
 * Small print under the rising/falling headline: the low and high bracketing
 * the session — the last stored event at/before it and the first after it
 * ("low 14:44 · 0.4 m" / "high 20:26 · 1.2 m"). `events` may hold a whole
 * day of turning points (for the chart); only the bracket is printed. An
 * event on a different day gets a +1d / −1d marker so a 01:00 high tomorrow
 * isn't mistaken for one that day.
 */
export function TideEventsSub({ events, sessionWhen }: { events: TideEvent[]; sessionWhen: string }) {
  const { t } = useLang();
  const sessionDay = sessionWhen.slice(0, 10);
  const sorted = [...events].sort((a, b) => a.time.localeCompare(b.time));
  const next = sorted.find((e) => e.time > sessionWhen);
  const prev = sorted.findLast((e) => e.time <= sessionWhen);
  const shown = [prev, next].filter((e): e is TideEvent => e != null);

  return (
    <span className="flex flex-col">
      {shown.map((e) => {
        const day = e.time.slice(0, 10);
        const shift = day === sessionDay ? "" : ` ${day > sessionDay ? t("tide.nextDay") : t("tide.prevDay")}`;
        const h = fmt1(e.heightM);
        return (
          <span key={`${e.type}-${e.time}`}>
            {t(e.type === "high" ? "tide.high" : "tide.low")} {e.time.slice(11, 16)}
            {shift}
            {h != null ? ` · ${h} m` : ""}
          </span>
        );
      })}
    </span>
  );
}
