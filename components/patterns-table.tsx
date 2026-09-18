"use client";

import { toCompass } from "@/lib/openmeteo";
import { spotLabel } from "@/lib/format";
import type { Session } from "@/lib/types";

function median(arr: number[]): number | null {
  const a = [...arr].sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function mode<T>(arr: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestN = 0;
  for (const v of arr) {
    if (v == null) continue;
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

export function PatternsTable({ sessions }: { sessions: Session[] }) {
  // condOpenMeteo is the more consistently populated numeric source (auto-
  // filled at save time); cond (Swelleye) is manual and often sparser.
  const withCond = sessions.filter((s) => s.condOpenMeteo || s.cond);
  if (withCond.length < 2) return null;

  const bySpot = new Map<string, Session[]>();
  for (const s of withCond) {
    const list = bySpot.get(s.spot) ?? [];
    list.push(s);
    bySpot.set(s.spot, list);
  }

  const rows = [...bySpot.entries()]
    .map(([slug, list]) => {
      const heights = list
        .map((s) => s.condOpenMeteo?.swellHeightM ?? s.cond?.swellHeightM)
        .filter((v): v is number => v != null);
      const periods = list
        .map((s) => s.condOpenMeteo?.swellPeriodS ?? s.cond?.swellPeriodS)
        .filter((v): v is number => v != null);
      const swellDirs = list.map(
        (s) => (s.condOpenMeteo?.swellDirDeg != null ? toCompass(s.condOpenMeteo.swellDirDeg) : null) ?? s.cond?.swellDir ?? null
      );
      const windDirs = list.map(
        (s) => (s.condOpenMeteo?.windDirDeg != null ? toCompass(s.condOpenMeteo.windDirDeg) : null) ?? s.cond?.windDir ?? null
      );
      return {
        slug,
        n: list.length,
        h: median(heights),
        p: median(periods),
        sd: mode(swellDirs),
        wd: mode(windDirs),
      };
    })
    .sort((a, b) => b.n - a.n);

  return (
    <section className="mt-6.5">
      <div className="pl-1 font-sans text-[13px] font-bold text-muted-foreground">
        What you&#39;ve surfed
      </div>
      <div className="mt-2.5 overflow-x-auto rounded-[var(--r-card)] border border-border bg-card p-2 shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[480px] border-separate [border-spacing:0_4px]">
          <thead>
            <tr>
              {["Spot", "Sessions", "Swell", "Period", "Usual swell", "Usual wind"].map((h) => (
                <th
                  key={h}
                  className="px-4 pb-0.5 pt-2.5 text-left text-xs font-semibold text-[var(--faint)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <td className="rounded-l-[var(--r-tile)] bg-secondary px-4 py-2.5 font-sans text-[15px] font-bold tracking-[-0.015em]">
                  {spotLabel(r.slug)}
                </td>
                <td className="bg-secondary px-4 py-2.5 font-mono text-[13.5px] tabular-nums">
                  {r.n}
                </td>
                <td className="bg-secondary px-4 py-2.5 font-mono text-[13.5px] tabular-nums">
                  {r.h != null ? `${r.h.toFixed(1)} m` : "—"}
                </td>
                <td className="bg-secondary px-4 py-2.5 font-mono text-[13.5px] tabular-nums">
                  {r.p != null ? `${r.p.toFixed(1)} s` : "—"}
                </td>
                <td className="bg-secondary px-4 py-2.5 font-mono text-[13.5px] tabular-nums">
                  {r.sd ?? "—"}
                </td>
                <td className="rounded-r-[var(--r-tile)] bg-secondary px-4 py-2.5 font-mono text-[13.5px] tabular-nums">
                  {r.wd ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
