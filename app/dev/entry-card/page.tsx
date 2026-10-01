"use client";

import { useState } from "react";
import { EntryCard } from "@/components/entry-card";
import { LangSwitch } from "@/app/dev/lang-switch";
import {
  fakeBoard,
  fakeCond,
  fakeCondCwaTide,
  fakeCondOpenMeteo,
  fakeSession,
  fakeTideEvent,
  logAction,
} from "@/app/dev/fixtures";
import type { Board, Session, TideEvent } from "@/lib/types";

/**
 * components/entry-card.tsx (EntryCard) in every case its branches produce —
 * see CLAUDE.md "Entry schema" and "Status" (2026-09-24/25/28 card changes)
 * for which fields it shows vs. only stores. Synthetic sessions only, built
 * from ../fixtures.ts. Not linked from the real app; 404s in production
 * (app/dev/layout.tsx).
 *
 * EntryCard's onUpdated/onDeleted are no-ops here (console.log) — clicking
 * "Edit" still opens the real EditPanel (EntryCard renders it internally;
 * this page doesn't intercept that), and Save/Delete/upload inside it will
 * hit the real /api/* routes and fail (401 outside a signed-in session, or a
 * network error) since there's nothing to actually persist to. That's a
 * known limit of previewing this component live, not a bug in this page.
 */

const onUpdated = logAction("entry-card/onUpdated") as (s: Session) => void;
const onDeleted = logAction("entry-card/onDeleted") as (id: string) => void;

// A mixed-tide day (~17h low→high gap), used by a couple of tide cases below
// — see CLAUDE.md "CWA tide forecast" on why the gap can run this long.
const MIXED_TIDE_GAP: TideEvent[] = [
  fakeTideEvent({ type: "low", time: "2026-10-04T07:10", heightM: 0.2 }),
  fakeTideEvent({ type: "high", time: "2026-10-05T00:34", heightM: 1.3 }),
];

const LONG_ZH_NOTES =
  "<p>今天佳樂水浪況意外地不錯，早上退潮的時候浪型很乾淨，胸肩高，偶爾有頭高的浪進來。風是離岸風，浪面很漂亮，幾乎沒有雜浪。</p>" +
  "<ul><li>早上七點到九點是最好的時段，浪比較有形狀</li>" +
  "<li>中午之後風開始轉側風，浪面變得比較亂</li>" +
  "<li>人不多，大概只有五六個人在排隊，等浪的時間不長</li>" +
  "<li>下次想試試看用短板，今天用的板子划水有點吃力，追浪常常慢半拍，感覺換一支划水速度快一點的板子應該會更好，特別是在浪比較快的時候</li></ul>" +
  "<p>整體來說是近期最滿意的一次 session，水溫也剛剛好，沒有穿防寒衣，泡了快三個小時都不會冷。下次想再約同樣的潮汐時段。</p>";

interface CaseDef {
  id: string;
  title: string;
  caption: string;
  session: Session;
  boards?: Board[];
}

const board1 = fakeBoard({ id: "dev-board-1", brand: "Pyzel Ghost", lengthIn: 74, volumeL: 29.5, rocker: "medium" });

const CASES: CaseDef[] = [
  {
    id: "full",
    title: "Full data — Jialeshui",
    caption: "Open-Meteo + CWA tide with events, secondary swell, both temps. The typical case.",
    session: fakeSession({
      notesHtml: "<p>Clean peaky waves, offshore in the morning. Chest to head high sets.</p>",
      notes: "Clean peaky waves, offshore in the morning. Chest to head high sets.",
    }),
  },
  {
    id: "no-period",
    title: "No swell period",
    caption:
      "swellPeriodS null → the Period tile is omitted; Swell and Wind each take col-span-2 on phone (filling the 3-col row); from sm up (a single flex row across the whole card, 2026-10-01) they're just equal flex-1 tiles like the rest.",
    session: fakeSession({ condOpenMeteo: fakeCondOpenMeteo({ swellPeriodS: null }) }),
  },
  {
    id: "no-temp",
    title: "No sea or air temp",
    caption:
      "seaTempC and airTempC both null → no water-temp tile at all; Tide takes col-span-3 on phone. From sm up it's a wider flex-[1.6] tile for its mini curve (restored small, 2026-10-01 — see CLAUDE.md) while the others are flex-1.",
    session: fakeSession({ condOpenMeteo: fakeCondOpenMeteo({ seaTempC: null, airTempC: null }) }),
  },
  {
    id: "air-temp-only",
    title: "Air temp only, no sea temp",
    caption:
      "seaTempC null but airTempC present → hasTemp is still true (tile shows), but the big figure reads — with only the small-print air reading filled in.",
    session: fakeSession({ condOpenMeteo: fakeCondOpenMeteo({ seaTempC: null, airTempC: 28.6 }) }),
  },
  {
    id: "no-cwa-past",
    title: "No CWA (past date)",
    caption:
      "condCwaTide null (CWA is forward-only ~32 days, never covers a past session) → falls back to Open-Meteo's tideEvents, label plain “Tide” not “Tide (CWA)”.",
    session: fakeSession({
      when: "2026-08-10T09:00",
      condCwaTide: null,
      condOpenMeteo: fakeCondOpenMeteo({
        tideEvents: [
          fakeTideEvent({ type: "low", time: "2026-08-10T03:40", heightM: 0.25 }),
          fakeTideEvent({ type: "high", time: "2026-08-10T09:55", heightM: 1.1 }),
          fakeTideEvent({ type: "low", time: "2026-08-10T16:05", heightM: 0.3 }),
          fakeTideEvent({ type: "high", time: "2026-08-10T22:10", heightM: 1.05 }),
        ],
      }),
    }),
  },
  {
    id: "cwa-legacy-single",
    title: "CWA, single legacy event (no `events`)",
    caption:
      "condCwaTide.events has exactly one item, after the 16:00 session (rows saved before the 2026-09-24 widening only ever stored the nearest event, or only one side of the bracket existed) → TideEventsSub shows just that one line.",
    session: fakeSession({
      condCwaTide: fakeCondCwaTide({
        tideM: 1.2,
        tideType: "high",
        time: "2026-09-25T20:05",
        events: [fakeTideEvent({ type: "high", time: "2026-09-25T20:05", heightM: 1.2 })],
      }),
    }),
  },
  {
    id: "no-tide",
    title: "No tide at all",
    caption:
      "Neither condCwaTide.events nor condOpenMeteo.tideEvents has anything (and no seaLevelTrend) → tideSource is null, so the whole Tide tile is omitted (not shown empty).",
    session: fakeSession({
      condCwaTide: null,
      condOpenMeteo: fakeCondOpenMeteo({ tideEvents: [], seaLevelM: null, seaLevelTrend: null }),
    }),
  },
  {
    id: "early-morning-clip",
    title: "Early-morning session, no upcoming event stored",
    caption:
      "05:00 session, both stored events (20:26 the day before, 02:10 that morning) are already in the past → TideEventsSub has nothing after the session time to show; the tile still shows its rising/falling headline from tideTrend(), just no small print.",
    session: fakeSession({
      when: "2026-09-26T05:00",
      condCwaTide: fakeCondCwaTide({
        tideM: 1.15,
        tideType: "high",
        time: "2026-09-26T02:10",
        events: [
          fakeTideEvent({ type: "low", time: "2026-09-25T20:26", heightM: 0.3 }),
          fakeTideEvent({ type: "high", time: "2026-09-26T02:10", heightM: 1.15 }),
        ],
      }),
    }),
  },
  {
    id: "mixed-tide-gap",
    title: "Mixed tide, ~17h gap, session mid-gap",
    caption:
      "屏東縣滿州鄉-style mixed tide: low 07:10 → high next day 00:34 (17h24m apart). Session sits at 16:00, roughly mid-gap — the low is already past, so only the next event (high, +1d) shows in the small print.",
    session: fakeSession({
      when: "2026-10-04T16:00",
      condCwaTide: fakeCondCwaTide({
        tideM: 0.2,
        tideType: "low",
        time: "2026-10-04T07:10",
        events: MIXED_TIDE_GAP,
      }),
      condOpenMeteo: fakeCondOpenMeteo({ tideEvents: MIXED_TIDE_GAP }),
    }),
  },
  {
    id: "manual-only",
    title: "No condOpenMeteo, manual Swelleye cond",
    caption:
      "condOpenMeteo null → the whole Open-Meteo tile grid (including Tide) is skipped entirely, even though condCwaTide has data. The manual cond row shows instead (only shown when Open-Meteo has nothing).",
    session: fakeSession({
      spot: "jialeshui",
      condOpenMeteo: null,
      condCwaTide: null,
      cond: fakeCond(),
    }),
  },
  {
    id: "manual-minimal",
    title: "Manual cond, minimal fields",
    caption:
      "No condOpenMeteo; manual cond has only swellHeightM/windSpeedMs — no period, no directions, no gust. Exercises the “undefined sub” branches on both manual tiles.",
    session: fakeSession({
      condOpenMeteo: null,
      condCwaTide: null,
      cond: fakeCond({
        swellPeriodS: null,
        swellDir: null,
        windDir: null,
        windGustMs: null,
        tideM: null,
        tideNote: null,
      }),
    }),
  },
  {
    id: "no-conditions",
    title: "No conditions at all",
    caption:
      "condOpenMeteo, condCwaTide and cond all null (e.g. a spot with no known coordinates, nothing typed in yet) → the “no coordinates yet, type them in” prompt with its Edit button.",
    session: fakeSession({
      spot: "custom:Unmapped spot",
      condOpenMeteo: null,
      condCwaTide: null,
      cond: null,
    }),
  },
  {
    id: "no-facing",
    title: "Spot without `facing` (Taitung)",
    caption:
      "spot.facing is undefined (Taitung's Swelleye infographic is all N/A) → computeSessionFit returns null, so hasShore is false: the wind tile shows speed/direction but no shore word (offshore/onshore/etc).",
    session: fakeSession({ spot: "taitung" }),
  },
  {
    id: "overseas",
    title: "Custom / overseas spot",
    caption:
      "spot = “custom:Siargao - Cloud 9” — not in lib/spots.ts, so spotLabel() falls back to the free text and spot-fit/CWA are both unavailable (no facing, no township). Open-Meteo still covers it (global grid).",
    session: fakeSession({
      spot: "custom:Siargao - Cloud 9",
      condCwaTide: null,
      condOpenMeteo: fakeCondOpenMeteo({
        gridLat: 9.858,
        gridLng: 126.166,
        swellHeightM: 0.56,
        swellPeriodS: 7.1,
        swellDirDeg: 69,
      }),
    }),
  },
  {
    id: "wind-calm",
    title: "Wind: calm",
    caption: "0.8 m/s, no gust — the lowest Beaufort band (calm), green dot.",
    session: fakeSession({ condOpenMeteo: fakeCondOpenMeteo({ windSpeedMs: 0.8, windGustMs: null }) }),
  },
  {
    id: "wind-gusty",
    title: "Wind: gusty",
    caption:
      "speed 6 m/s, gust 14 m/s — midpoint (gust > speed) is 10 m/s, so the strength label rates a band stronger (“fresh”) than the raw 6 m/s figure alone would suggest.",
    session: fakeSession({ condOpenMeteo: fakeCondOpenMeteo({ windSpeedMs: 6, windGustMs: 14 }) }),
  },
  {
    id: "wind-gale",
    title: "Wind: gale",
    caption: "18.5 m/s — past the top Beaufort band (gale), dark red dot.",
    session: fakeSession({ condOpenMeteo: fakeCondOpenMeteo({ windSpeedMs: 18.5, windGustMs: 22 }) }),
  },
  {
    id: "with-board",
    title: "With board",
    caption: "session.boardId matches a board in the `boards` prop → the board chip renders, with a photo id.",
    session: fakeSession({ boardId: board1.id }),
    boards: [board1, fakeBoard({ id: "dev-board-2", brand: "Firewire Dominator", lengthIn: 70, volumeL: 32, rocker: "low" })],
  },
  {
    id: "without-board",
    title: "Without a board",
    caption: "boardId null (or not in the rack) — no board chip.",
    session: fakeSession({ boardId: null }),
    boards: [board1],
  },
  {
    id: "goal-met",
    title: "Goal chip — met",
    caption: "Two-point goal, joined with “\\n” — shown compact with “ · ”, met badge.",
    session: fakeSession({ goalText: "Pop up faster\nLook where I want to go", goalMet: true }),
  },
  {
    id: "goal-not-met",
    title: "Goal chip — not yet",
    caption: "Same goal, not met this time.",
    session: fakeSession({ goalText: "Pop up faster\nLook where I want to go", goalMet: false }),
  },
  {
    id: "goal-unchecked",
    title: "Goal chip — not assessed",
    caption: "goalMet null — a goal was set when logged, but never checked off.",
    session: fakeSession({ goalText: "Pop up faster\nLook where I want to go", goalMet: null }),
  },
  {
    id: "long-notes",
    title: "Long Chinese notes, with a list",
    caption: "notesHtml with <ul><li> bullets — CJK line-wrapping and rich text at length.",
    session: fakeSession({ notesHtml: LONG_ZH_NOTES, notes: "long note" }),
  },
  {
    id: "empty-notes",
    title: "Empty notes",
    caption: "notesHtml \"\" — the whole notes block is omitted (falsy check), not rendered blank.",
    session: fakeSession({ notesHtml: "", notes: "" }),
  },
  {
    id: "photos-caveat",
    title: "Photos (not renderable here)",
    caption:
      "photos: [] on purpose — real photo tiles load from /api/blob/:id, which is owner-checked and would 401 for synthetic ids without weakening auth (not done, see CLAUDE.md “Hard rule”). Can't preview populated photo tiles without either a real signed-in session or bypassing that check, which this page won't do.",
    session: fakeSession({ photos: [] }),
  },
  {
    id: "example-badge",
    title: "Example badge",
    caption: "session.example: true — the seeded-demo-row pill, shown beside/instead of the manual-source badge.",
    session: fakeSession({ example: true }),
  },
];

const WIDTHS = [
  { key: "375", label: "375px (phone)", px: 375 },
  { key: "768", label: "768px (tablet)", px: 768 },
  { key: "1200", label: "1200px (desktop)", px: 1200 },
  { key: "auto", label: "Auto (~880px, real app width)", px: null },
] as const;
type WidthKey = (typeof WIDTHS)[number]["key"];

function Frame({ px, children }: { px: number | null; children: React.ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-dashed border-border bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.02)_10px,rgba(0,0,0,0.02)_20px)] p-2">
      <div style={{ width: px ?? 880, maxWidth: px == null ? "100%" : undefined }}>{children}</div>
    </div>
  );
}

export default function EntryCardPreviewPage() {
  const [width, setWidth] = useState<WidthKey>("auto");
  const activeWidth = WIDTHS.find((w) => w.key === width) ?? WIDTHS[3];

  return (
    <div className="mx-auto w-full max-w-[1260px] px-4.5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-extrabold">Entry card (dev only)</h1>
          <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
            components/entry-card.tsx in every case its branches produce — synthetic sessions from{" "}
            <code>app/dev/fixtures.ts</code>. Edit/Delete/upload inside each card hit the real API and will fail
            here (no real session to save to) — that&apos;s expected.
          </p>
        </div>
        <LangSwitch />
      </div>

      <div className="mt-4 rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4 py-3 text-[13px] text-foreground">
        <strong>Widths only emulate the component&apos;s own box.</strong> Tailwind <code>sm:</code>/<code>lg:</code>{" "}
        classes (entry-card.tsx&apos;s condition-tile row switches from a 3-col grid to one full-width flex row at{" "}
        <code>sm:</code>, 2026-10-01) are real viewport media queries — they respond to the browser window&apos;s
        width, not this frame&apos;s. To actually see the single-row layout, resize the real browser window past
        640px; the 768/1200px frames below will still show the sub-640 (phone) grid unless the browser itself is
        that wide.
      </div>

      <section className="mt-8">
        <h2 className="font-sans text-[15px] font-bold">Widths, side by side</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The same full-data case at all three reference widths (see the note above about <code>lg:</code>).
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {WIDTHS.filter((w) => w.px != null).map((w) => (
            <div key={w.key}>
              <div className="mb-1 font-mono text-xs text-muted-foreground">{w.label}</div>
              <Frame px={w.px}>
                <EntryCard session={CASES[0].session} boards={[]} onUpdated={onUpdated} onDeleted={onDeleted} />
              </Frame>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-sans text-[15px] font-bold">All cases</h2>
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {WIDTHS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setWidth(w.key)}
                className={
                  "rounded-full px-3 py-1 " +
                  (width === w.key ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-8">
          {CASES.map((c) => (
            <div key={c.id}>
              <div className="mb-1.5">
                <span className="font-sans text-[14px] font-bold">{c.title}</span>
                <p className="mt-0.5 max-w-[75ch] text-[12.5px] text-muted-foreground">{c.caption}</p>
              </div>
              <Frame px={activeWidth.px}>
                <EntryCard session={c.session} boards={c.boards ?? []} onUpdated={onUpdated} onDeleted={onDeleted} />
              </Frame>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
