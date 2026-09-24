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
export function tideTrend(events: TideEvent[], sessionWhen: string): "rising" | "falling" | null {
  const next = events.find((e) => e.time > sessionWhen);
  if (next) return next.type === "high" ? "rising" : "falling";
  const prev = events.findLast((e) => e.time <= sessionWhen);
  if (prev) return prev.type === "low" ? "rising" : "falling";
  return null;
}

/**
 * Small print under the rising/falling headline: only the tide the water is
 * heading for — the next high when rising, the next low when falling
 * ("high 20:26 · 1.2 m"). That's the next stored event after the session,
 * which is also what `tideTrend` reads the direction from. Renders nothing
 * when no event is after the session. An event on a different day gets a
 * +1d marker so a 01:00 high tomorrow isn't mistaken for one that day.
 */
export function TideEventsSub({ events, sessionWhen }: { events: TideEvent[]; sessionWhen: string }) {
  const { t } = useLang();
  const e = events.find((ev) => ev.time > sessionWhen);
  if (!e) return null;

  const sessionDay = sessionWhen.slice(0, 10);
  const day = e.time.slice(0, 10);
  const shift = day === sessionDay ? "" : ` ${day > sessionDay ? t("tide.nextDay") : t("tide.prevDay")}`;
  const h = fmt1(e.heightM);

  return (
    <span>
      {t(e.type === "high" ? "tide.high" : "tide.low")} {e.time.slice(11, 16)}
      {shift}
      {h != null ? ` · ${h} m` : ""}
    </span>
  );
}
