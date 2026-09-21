"use client";

import { spotLabel } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { Session } from "@/lib/types";

export function PatternsTable({ sessions }: { sessions: Session[] }) {
  const { lang, t } = useLang();
  if (sessions.length < 2) return null;

  const bySpot = new Map<string, number>();
  for (const s of sessions) {
    bySpot.set(s.spot, (bySpot.get(s.spot) ?? 0) + 1);
  }

  const rows = [...bySpot.entries()]
    .map(([slug, n]) => ({ slug, n }))
    .sort((a, b) => b.n - a.n);

  return (
    <section className="min-w-[320px] flex-1">
      <div className="pl-1 font-sans text-[13px] font-bold text-muted-foreground">
        {t("patterns.title")}
      </div>
      <div className="mt-2.5 overflow-x-auto rounded-[var(--r-card)] border border-border bg-card p-2 shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[220px] border-separate [border-spacing:0_4px]">
          <thead>
            <tr>
              {[t("form.spot"), t("patterns.sessions")].map((h) => (
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
                  {spotLabel(r.slug, lang)}
                </td>
                <td className="rounded-r-[var(--r-tile)] bg-secondary px-4 py-2.5 font-mono text-[13.5px] tabular-nums">
                  {r.n}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
