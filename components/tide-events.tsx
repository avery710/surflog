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
 * Small print under the rising/falling headline: the next low and next high
 * after the session time — the next two stored turning points, whichever
 * comes first listed first ("low 14:44 · 0.4 m" / "high 20:26 · 1.2 m").
 * Events strictly alternate, so two events after the session time are
 * normally one low and one high; only as many as exist are shown (one line
 * if just one future event is stored, nothing if none are — e.g. a bracket
 * that only reaches back from the session, never forward). The tide curve
 * that used to sit here was removed 2026-10-01 (see CLAUDE.md) — this text
 * is now the Tide tile's only sub-content, for every event count. A future
 * event always sits on the session day or later, so only a +1d marker is
 * possible (never −1d).
 */
export function TideEventsSub({ events, sessionWhen }: { events: TideEvent[]; sessionWhen: string }) {
  const { t } = useLang();
  const sessionDay = sessionWhen.slice(0, 10);
  const shown = [...events]
    .filter((e) => e.time > sessionWhen)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 2);

  return (
    <span className="flex flex-col">
      {shown.map((e) => {
        const day = e.time.slice(0, 10);
        const shift = day === sessionDay ? "" : ` ${t("tide.nextDay")}`;
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
