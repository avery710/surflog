"use client";

import { LangSwitch } from "@/app/dev/lang-switch";
import { TideTile, VARIANTS, type TideCase } from "@/app/dev/tide-display/variants";
import type { TideEvent } from "@/lib/types";

/**
 * Six candidate displays for the session card's Tide tile (the area under the
 * "Rising / Falling" headline), each in the same six synthetic cases at three
 * tile widths. Dev only: nothing here is wired into components/entry-card.tsx or
 * components/tide-chart.tsx. Not linked from the real app; 404s in production
 * (app/dev/layout.tsx).
 *
 * Widths are fixed pixel boxes, so a tile's own width is what is being tested
 * (the page's viewport only decides whether a row scrolls sideways inside its
 * box). 140 px is a narrow phone tile, 220 px a typical phone tile, 360 px a
 * tile on desktop.
 */

const ev = (type: TideEvent["type"], time: string, heightM: number | null): TideEvent => ({ type, time, heightM });

// One synthetic semi-diurnal day (Taiwan-ish, ~6 h between turning points).
// Each case keeps only what the app would store: turning points within +/-14 h
// of the session plus the bracketing pair.
const H0255 = ev("high", "2026-10-21T02:55", 1.2);
const L0905 = ev("low", "2026-10-21T09:05", 0.1);
const H1520 = ev("high", "2026-10-21T15:20", 1.3);
const L2135 = ev("low", "2026-10-21T21:35", 0.2);
const H0350 = ev("high", "2026-10-22T03:50", 1.1);
const L1005 = ev("low", "2026-10-22T10:05", 0.2);

const strip = (e: TideEvent): TideEvent => ({ ...e, heightM: null });

const CASES: TideCase[] = [
  { id: "rising", label: "Rising, 12:00", when: "2026-10-21T12:00", events: [H0255, L0905, H1520, L2135] },
  { id: "falling", label: "Falling, 17:30", when: "2026-10-21T17:30", events: [L0905, H1520, L2135, H0350] },
  { id: "duration", label: "Rising, 11:00 for 2 h", when: "2026-10-21T11:00", durationMin: 120, events: [H0255, L0905, H1520, L2135] },
  { id: "nextday", label: "Next turn is tomorrow, 23:30", when: "2026-10-21T23:30", events: [H1520, L2135, H0350, L1005] },
  { id: "single", label: "One turning point, 12:00", when: "2026-10-21T12:00", events: [H1520] },
  { id: "noheights", label: "No heights, 12:00", when: "2026-10-21T12:00", events: [H0255, L0905, H1520, L2135].map(strip) },
];

const WIDTHS = [140, 220, 360];

const NOTES: Record<string, { what: string; tradeoff: string }> = {
  staff: {
    what: "A vertical gauge: water up to the session's level, a line across it, the low and high either side timed beside their ticks.",
    tradeoff: "Reads fastest as a level, but a vertical staff makes the tile taller (60 px vs 28 px).",
  },
  band: {
    what: "The day as one strip, darker where the tide was coming in, lighter where it went out; turning points lettered above, the session a marker.",
    tradeoff: "Shows the whole day at a glance; the tide's shape (how high) is gone.",
  },
  countdown: {
    what: "No graphic: the time to the next turning point and since the last, from the session's start.",
    tradeoff: "Most precise and smallest, but nothing to look at, and you do the arithmetic to place it in the day.",
  },
  bars: {
    what: "One bar per hour of the day, as tall as the water level, the hours you were out dark.",
    tradeoff: "Easy to see how long you were out, but bars add a texture the curve did not have and half hours get rounded.",
  },
  table: {
    what: "A printed-tide-table read: the turning points either side of the session as rows, the session slotted between them on a rail.",
    tradeoff: "Exact times and familiar, but four text rows are the tallest and it has no shape at all.",
  },
  stage: {
    what: "Low / Mid / High segments with the session's stage lit, the words the spot pages use for a break's best tide.",
    tradeoff: "Matches how surfers talk about it and ties into spots, but it is coarse: three steps, no times.",
  },
};

export default function TideDisplayPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-3.5 py-8 sm:px-4.5">
      <h1 className="font-sans text-2xl font-extrabold">Tide tile display ideas</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Six ways to fill the Tide tile under “Rising / Falling”, dev only (not in the real card). Same six cases and
        the same synthetic data in each; each row shows the tile at 140, 220 and 360 px wide. A row scrolls sideways
        inside its own box on a narrow screen.
      </p>
      <div className="mt-3">
        <LangSwitch />
      </div>
      <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {VARIANTS.map((v) => (
          <a key={v.id} href={`#${v.id}`} className="font-semibold text-primary underline underline-offset-2">
            {v.title}
          </a>
        ))}
      </nav>

      <div className="mt-6 flex flex-col gap-4">
        {VARIANTS.map((v) => (
          <section key={v.id} id={v.id} className="min-w-0 scroll-mt-4 rounded-[var(--r-card)] bg-card p-4 shadow-soft">
            <h2 className="text-[16px] font-bold">{v.title}</h2>
            <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">{NOTES[v.id].what}</p>
            <p className="max-w-prose text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">Trade-off.</span> {NOTES[v.id].tradeoff}
            </p>
            <div className="mt-3 overflow-x-auto">
              <div className="flex w-max flex-col gap-2.5 pb-1">
                <div className="flex items-end gap-3 font-mono text-[11px] text-muted-foreground">
                  <span className="w-[92px] shrink-0" />
                  {WIDTHS.map((w) => (
                    <span key={w} className="shrink-0" style={{ width: w }}>
                      {w} px
                    </span>
                  ))}
                </div>
                {CASES.map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <span className="w-[92px] shrink-0 pt-1 text-[11.5px] font-medium leading-snug text-muted-foreground">
                      {c.label}
                    </span>
                    {WIDTHS.map((w) => (
                      <TideTile key={w} variant={v} tideCase={c} width={w} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
