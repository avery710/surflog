"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "cn";
import { useLang, type Lang, type TKey } from "@/lib/i18n";
import { fmt1, taipeiToday } from "@/lib/format";
import { useSpotCatalog } from "@/lib/spot-catalog";
import type { Session } from "@/lib/types";

/** Dot grid geometry — small and fixed, never stretched to fill the card.
 *  A proper week grid: 7 per row, Sunday-first (2026-10-06, on request;
 *  was Monday-first since 2026-09-30). Every row is always a full
 *  Sunday-Saturday week (2026-10-01: switched from month-rows, which
 *  needed leading blanks before day 1 to line day 1 up under its real
 *  weekday — a week-row never needs that, it always starts on Sunday), so
 *  every row is exactly the same height — see MIN_VISIBLE_WEEKS below for why
 *  that matters. Fixed pixel column widths (not fractional), so the grid
 *  never depends on flex-wrap rounding, and the weekday header row below
 *  lines up with it exactly regardless of the two rows' different flex
 *  containers. Dot size kept at the original 10px (unchanged from the
 *  14-per-row layout; tried larger at 14px first, sized back down on
 *  request). Gap widened to 10px (from the original 6px) on request, for
 *  more breathing room between dots now that there's only 7 per row
 *  instead of 14. */
const DOT_PX = 10;
const GAP_PX = 10;
const DOTS_PER_ROW = 7;
const DOTS_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: `repeat(${DOTS_PER_ROW}, ${DOT_PX}px)`,
  gap: `${GAP_PX}px`,
};

/** Sunday-first weekday header above the dot grid — one line, once, not
 *  repeated per month (a proper week grid reads faster with the columns
 *  labelled, and this only costs one row for the whole card). Keys, not
 *  literal letters, so zh-TW gets 日一二三四五六 instead of SMTWTFS. */
const WEEKDAY_KEYS: TKey[] = [
  "calendar.weekday.sun",
  "calendar.weekday.mon",
  "calendar.weekday.tue",
  "calendar.weekday.wed",
  "calendar.weekday.thu",
  "calendar.weekday.fri",
  "calendar.weekday.sat",
];

/** Minimum number of week-rows visible at once (phones always show exactly
 *  this many: the list's min height below). From `sm` up the card is
 *  stretched to the goal card's height beside it (2026-10-08, on request)
 *  and shows as many MORE past weeks as fit that height — see
 *  `visibleRows` in the component — never more than the weeks that exist
 *  since the earliest session (a user with less history still gets 4 rows,
 *  see `minStartWeekStart`). Every row is a full Sunday-Saturday week at a
 *  fixed DOT_PX height (the month label's font-size is pinned to DOT_PX
 *  exactly — see the label span below; at a larger size it was the tallest
 *  child in its row and silently stretched every row past DOT_PX, which the
 *  scroll area then clipped), so the row pitch is a plain constant. The
 *  current week is always the bottom row; older weeks beyond the visible
 *  window scroll into view via the ↑ arrow in the rail on the right, ↓
 *  returns toward it. */
const MIN_VISIBLE_WEEKS = 4;
const ROW_GAP_PX = 8; // matches the `space-y-2` gap between week rows

/** Pixel height of a list showing `n` week rows. */
function weekListHeight(n: number): number {
  return n * DOT_PX + (n - 1) * ROW_GAP_PX;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The Sunday that starts the week containing local date y/m/d (`month` is
 *  0-based, matching `Date`'s own convention). Built from y/m/d components
 *  via `new Date(year, month, day)`, never parsed from an ISO string — no
 *  UTC shift, matching how every other date in this file is handled.
 *  `getDay()` is already Sun=0..Sat=6, so the Sunday on or before the date
 *  is just `getDay()` days back. */
function weekStartOf(year: number, month: number, day: number): Date {
  const d = new Date(year, month, day);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** A new Date `days` after `d` — plain local calendar arithmetic, lets
 *  `Date` itself handle month/year rollover. */
function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** "YYYY-MM-DD" for a local Date, matching the session `when` string
 *  format used everywhere else in this file. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Short month label for a row, e.g. "Sep" / "9月" — no year, this is a
 *  short history strip, not a date picker. */
function monthLabel(year: number, month: number, lang: Lang): string {
  const locale = lang === "zh-TW" ? "zh-TW" : "en-US";
  return new Date(year, month, 1).toLocaleString(locale, { month: "short" });
}

/** Every Sunday-start week from `from` through `to` inclusive, oldest
 *  first. Both must already be Sundays (see `weekStartOf` above) — this just
 *  steps by 7 days and lets `Date` normalize month/year rollover. */
function weeksBetween(from: Date, to: Date): Date[] {
  const weeks: Date[] = [];
  let cur = from;
  while (cur.getTime() <= to.getTime()) {
    weeks.push(cur);
    cur = addDays(cur, 7);
  }
  return weeks;
}

/** Surfed = filled vivid blue, past-no-surf = filled grey, future (strictly
 *  after today) = outlined ring only, no fill. Today gets whichever fill
 *  applies (blue if already surfed, grey otherwise) with no extra
 *  highlight — it is never the outlined future style, it just isn't called
 *  out further either. Binary — no session-count colour ramp. The no-surf
 *  fill and the future outline share the same grey: a light mix of
 *  `--faint` into white (25% faint) — progressively lightened on request
 *  from an initial 50/50 mix, which was itself lighter than plain `--faint`
 *  (too dark) but still darker than wanted; still visible unlike the
 *  original `--secondary`/`--border` (nearly invisible at dot size).
 *  Surfed uses `--primary-vivid` (currently the same raw value as
 *  `--primary` itself — see globals.css's 2026-10-02 note on why this
 *  particular blue needs no separate darkened shade) rather than being
 *  written as `--primary` directly, so a future accent whose raw hue
 *  isn't already accessible (like the one this replaced) only has to
 *  change `--primary-vivid` here, not this component. Written as full
 *  literal class strings (not built from a shared JS constant) because
 *  Tailwind's build-time scanner needs the complete arbitrary-value class
 *  to appear as-is in the source. */
function dotClassName(isFuture: boolean, surfed: boolean): string {
  return cn(
    "block rounded-full",
    isFuture
      ? "border border-[color-mix(in_srgb,white,var(--faint)_25%)] bg-transparent"
      : surfed
        ? "bg-primary-vivid"
        : "bg-[color-mix(in_srgb,white,var(--faint)_25%)]"
  );
}

/** Duration of the custom week-to-week scroll animation, in ms — longer and
 *  eased, since the browser's native `scrollTo({ behavior: "smooth" })` runs
 *  a short, non-configurable animation. Kept even now that every row is the
 *  same height (it used to also smooth over rows of different heights,
 *  2 vs 3 dot-rows, back when rows were months). */
const SCROLL_ANIMATION_MS = 380;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function ActivityCalendar({
  sessions,
  fit = false,
}: {
  sessions: Session[];
  /** Hug the content below `sm` too (default: full width there). */
  fit?: boolean;
}) {
  const { lang, t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  // The card: the ↑/↓ buttons exist twice (title row below `sm`, side rail
  // from `sm`), and updateArrowState() finds both pairs through it.
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);

  const counts = new Map<string, number>();
  let earliestDay: string | null = null;
  for (const s of sessions) {
    const day = s.when?.slice(0, 10);
    if (!day) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
    if (!earliestDay || day < earliestDay) earliestDay = day;
  }

  // Every date here comes from either taipeiToday() or a session's own
  // "YYYY-MM-DDTHH:mm" string, sliced and compared/split as plain text —
  // never parsed as an ISO string through Date, which would read it as UTC
  // and could shift the day. weekStartOf() below takes the already-split y/m/d
  // numbers, same rule.
  const todayStr = taipeiToday();
  // The most recent session (by its own local date and time), for the phone-only panel.
  const last = sessions.reduce<Session | null>((a, x) => (!a || x.when > a.when ? x : a), null);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const todayWeekStart = weekStartOf(ty, tm - 1, td);
  const earliestWeekStart = earliestDay
    ? (([ey, em, ed]) => weekStartOf(ey, em - 1, ed))(earliestDay.split("-").map(Number))
    : todayWeekStart;

  // Always at least MIN_VISIBLE_WEEKS rows, even for a brand-new user with no
  // (or very little) history — on request, so the card is always exactly
  // 4 rows tall, never shorter. Extra rows before the earliest session are
  // just real calendar weeks with no sessions in them (counts.get() already
  // defaults to 0), nothing special-cased. Older history beyond that floor
  // still pushes the start further back and makes the list scrollable.
  const minStartWeekStart = addDays(todayWeekStart, -7 * (MIN_VISIBLE_WEEKS - 1));
  const startWeekStart =
    earliestWeekStart.getTime() < minStartWeekStart.getTime() ? earliestWeekStart : minStartWeekStart;

  // Oldest to current. The last entry is always todayWeekStart (weeksBetween
  // steps in exact 7-day hops from one Sunday to another, so it lands on
  // the upper bound exactly), i.e. the current week is always present and
  // always the bottom row — and the view below defaults to scrolled-to-
  // bottom, so the visible window always ends on the current week, never
  // on 4 older ones.
  const weeks = weeksBetween(startWeekStart, todayWeekStart);
  // How many rows the list's box can hold (measured; from `sm` up the card
  // is stretched, on phones it is exactly MIN_VISIBLE_WEEKS), capped by the
  // weeks that exist.
  const [fitRows, setFitRows] = useState(MIN_VISIBLE_WEEKS);
  const visibleRows = Math.max(fitRows, MIN_VISIBLE_WEEKS);
  // When the box fits more rows than there are weeks, the surplus is padded
  // on top with empty (light-grey solid, like past no-surf days) placeholder weeks, so the card is always
  // full and the current week stays the bottom row. They predate the journal,
  // so they are not drawn as "no-surf" days. Total rows never exceed
  // visibleRows when padding, so there is nothing to scroll into.
  const padCount = Math.max(0, visibleRows - weeks.length);
  const canScroll = weeks.length > visibleRows;
  const boxRef = useRef<HTMLDivElement>(null);

  // Measures the list's box (an absolutely-filled flex-1 area, so the rows
  // inside it never feed back into its own size). State is set from the
  // observer callback, not the effect body.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const fit = Math.floor((el.clientHeight + ROW_GAP_PX) / (DOT_PX + ROW_GAP_PX));
      setFitRows(Math.max(MIN_VISIBLE_WEEKS, fit));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Enables/disables the up/down arrow buttons to match how far the list
  // can still scroll in each direction. Reads and writes the DOM directly
  // (button.disabled), not React state, since it runs both from the native
  // onScroll event below and from the layout effect on mount.
  function updateArrowState() {
    const el = scrollRef.current;
    if (!el) return;
    const atTop = el.scrollTop <= 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    cardRef.current?.querySelectorAll<HTMLButtonElement>("[data-scroll-week]").forEach((btn) => {
      btn.disabled = btn.dataset.scrollWeek === "older" ? atTop : atBottom;
    });
  }

  // A slower, eased scroll than the browser's native `behavior: "smooth"`
  // (see SCROLL_ANIMATION_MS above) — respects prefers-reduced-motion, and
  // cancels any animation still running from a rapid second click so the
  // two don't fight over scrollTop.
  function animateScrollTo(el: HTMLDivElement, targetTop: number) {
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    const start = el.scrollTop;
    const distance = targetTop - start;
    if (distance === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollTop = targetTop;
      return;
    }
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / SCROLL_ANIMATION_MS, 1);
      el.scrollTop = start + distance * easeInOutCubic(progress);
      scrollAnimationRef.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    scrollAnimationRef.current = requestAnimationFrame(step);
  }

  // Replaces the native scrollbar (hidden below) as the way to reach older
  // weeks — moves exactly one week row at a time, snapping to its top.
  function scrollByWeek(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-week-row]"));
    const target =
      direction < 0
        ? [...rows].reverse().find((row) => row.offsetTop < el.scrollTop - 1)
        : rows.find((row) => row.offsetTop > el.scrollTop + 1);
    animateScrollTo(el, target ? target.offsetTop : direction < 0 ? 0 : el.scrollHeight);
  }

  // Stop the animation loop if the component unmounts mid-scroll, rather
  // than leaving a requestAnimationFrame writing to a detached node.
  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current !== null) cancelAnimationFrame(scrollAnimationRef.current);
    };
  }, []);

  // Lands on the current (bottom) week on mount and whenever the displayed
  // week range actually grows (an older session pulling earliestWeekStart back
  // further, or the calendar rolling into a new week) — not on every
  // incidental re-render, which would fight a user mid-scroll. The list's
  // own height comes from visibleRows (weekListHeight(), set directly
  // as inline style below) rather than measured, since every week row is
  // the same height — so this effect only sets scrollTop, no React state,
  // and doesn't trip react-hooks/set-state-in-effect.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    updateArrowState();
  }, [weeks.length, visibleRows, padCount]);

  return (
    // Full width below `sm`; from `sm` up, fit-content so the card hugs its
    // content whether or not the up/down rail renders (it only exists when
    // canScroll) — a fixed width left a blank rail-sized gap on the right.
    // From `sm` the card's own right padding is a touch wider than its
    // left/top/bottom (pr-6/24px vs p-5/20px) on request, 2026-10-01 — deliberate breathing
    // room around the ↑/↓ buttons so they don't sit flush against the card's
    // rounded corner; the plain p-5 used everywhere else read as too tight
    // once the card stopped carrying any other slack (see the width-fix
    // immediately before this one). From `sm` the card is stretched to the
    // goal card's height (2026-10-08): the extra height shows more weeks.
    // `fit`: hug the content at every width, phones too (the journal's row
    // with the AI app card beside it).
    <section className={fit ? "flex w-fit shrink-0 flex-col" : "w-full sm:flex sm:w-fit sm:shrink-0 sm:flex-col"}>
      {/* Below `sm` (2026-10-09, on request) the ↑/↓ buttons sit at the end
          of the title row instead of in the side rail, which is hidden there,
          so the card is 32px narrower on phones (rail + its gap + the wider
          right padding the rail needed) and the AI app card beside it gets
          the room. */}
      <div
        ref={cardRef}
        className={cn(
          "flex rounded-[var(--r-card)] border border-card-border bg-card pt-3.5 pr-5 pb-5 pl-5 sm:pr-6",
          fit ? "flex-1" : "sm:flex-1"
        )}
      >
        {/* The calendar itself. Beside it, below `sm` and only when the card
            is full width (not `fit`), the most recent session fills what
            would otherwise be empty space (2026-10-09, on request). */}
        <div className="flex shrink-0 flex-col sm:flex-1">
          <div className="mb-3 flex h-5 shrink-0 items-center justify-between gap-2">
            {/* Same type style as the other dashboard-panel titles (goal card,
                patterns table, board rack). */}
            <h2 className="font-sans text-[13px] leading-5 font-bold text-muted-foreground">{t("calendar.title")}</h2>
            {canScroll && (
              <div className="flex shrink-0 items-center gap-0.5 sm:hidden">
                <WeekButton direction="older" label={t("calendar.showOlderWeeks")} onClick={() => scrollByWeek(-1)} />
                <WeekButton direction="newer" label={t("calendar.showNewerWeeks")} onClick={() => scrollByWeek(1)} />
              </div>
            )}
          </div>
          {/* The weekday header and the scrollable week list share one flex-1
              column, with the ↑/↓ rail as a sibling of that whole column (not
              just of the list) — on request, so the rail spans the header's
              height too: the ↑ button lines up with the "S M T W T F S" row,
              the ↓ button with the last (current) week row, rather than only
              spanning the shorter scrollable list below the header. */}
          <div className="flex flex-1 items-stretch gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Weekday header, once for the whole card (not per week row) —
                  sits outside the scrollable week list so it never scrolls
                  away, and lines up with the dot columns below purely because
                  both use the same fixed DOT_PX/GAP_PX grid, regardless of
                  their separate flex containers' widths. */}
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <span className="w-8 shrink-0" />
                <div className="grid" style={DOTS_GRID_STYLE}>
                  {WEEKDAY_KEYS.map((key) => (
                    <span
                      key={key}
                      className="text-center font-sans text-[10px] leading-none font-medium text-[var(--faint)]"
                      style={{ width: DOT_PX }}
                    >
                      {t(key)}
                    </span>
                  ))}
                </div>
              </div>
              <div ref={boxRef} className="relative flex-1" style={{ minHeight: weekListHeight(MIN_VISIBLE_WEEKS) }}>
              <div
                ref={scrollRef}
                onScroll={updateArrowState}
                // Native scrollbar hidden — the up/down arrow rail to the
                // right (roughly the scrollbar's own former position) is the
                // scroll affordance instead, on request. maxHeight is
                // weekListHeight(visibleRows): at least MIN_VISIBLE_WEEKS rows,
                // more when the stretched card has room. Pinned to the box's
                // bottom so the current week stays the bottom row.
                className="absolute inset-x-0 bottom-0 space-y-2 overflow-y-auto transition-[max-height] duration-200 ease-out motion-reduce:transition-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ maxHeight: weekListHeight(visibleRows) }}
              >
                {Array.from({ length: padCount }, (_, k) => {
                  const padStart = addDays(startWeekStart, -7 * (padCount - k));
                  return (
                    <div key={`pad-${dateKey(padStart)}`} aria-hidden className="flex items-center gap-2">
                      <span className="w-8 shrink-0" />
                      <div className="grid" style={DOTS_GRID_STYLE}>
                        {Array.from({ length: 7 }, (_, d) => (
                          <span
                            key={d}
                            className={dotClassName(false, false)}
                            style={{ width: DOT_PX, height: DOT_PX }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {weeks.map((weekStart, i) => {
                  // Labelled by the row's *last* day (Saturday), not its first
                  // (Sunday) — on request, 2026-10-01: a week straddling a
                  // month boundary (e.g. Sun 27 Sep - Sat 3 Oct) would
                  // otherwise be labelled "SEP" (the first day's month), so a
                  // new month never got a label of its own until its first
                  // full Sunday-start week, which could be most of a week
                  // away. The last day's month is always the later/incoming
                  // one for any week containing a 1st-of-month (whichever
                  // weekday the 1st falls on, the Saturday of that week is on
                  // or after it; a 1st that *is* a Sunday starts its own row,
                  // whose Saturday is in the same month), so the boundary
                  // row now reads as the new month, same as a wall calendar
                  // page-turn. Label only when it actually changes from the
                  // row above (or it's the very first row) — a week-per-row
                  // grid would otherwise repeat the same month name 4+ times
                  // in a row, unlike the old one-row-per-month layout where
                  // every row needed its own label.
                  const lastDay = addDays(weekStart, 6);
                  const prevLastDay = i > 0 ? addDays(weeks[i - 1], 6) : null;
                  const showLabel =
                    i === 0 ||
                    prevLastDay === null ||
                    prevLastDay.getMonth() !== lastDay.getMonth() ||
                    prevLastDay.getFullYear() !== lastDay.getFullYear();
                  // Black for the month we're in now, wherever its label sits
                  // (2026-10-06, on request). This used to test "is this the
                  // current week's row", but a month's label is only printed
                  // on its first row, so from the second week of a month on
                  // the current month's own label was grey.
                  const isCurrentMonth = lastDay.getFullYear() === ty && lastDay.getMonth() === tm - 1;
                  return (
                    <div key={dateKey(weekStart)} data-week-row className="flex items-center gap-2">
                      <span
                        className={cn(
                          // 10px, matching DOT_PX exactly (not the 11px tried
                          // first) — with leading-none that makes this span
                          // exactly as tall as a dot, so every row is a fixed
                          // DOT_PX tall and weekListHeight()'s row-count
                          // arithmetic holds exactly; at 11px the label (the
                          // tallest child) stretched every row 1px past the
                          // dots, which the fixed-height scroll area clipped.
                          "w-8 shrink-0 font-sans text-[10px] leading-none font-bold tracking-wide whitespace-nowrap uppercase",
                          // Matches the dot grey used in dotClassName() below
                          // (a light mix of --faint into white) rather than the
                          // theme's --muted-foreground, on request — note this
                          // is quite low contrast against the white card, since
                          // it's a tone meant for an unfilled dot, not for text.
                          isCurrentMonth
                            ? "text-foreground"
                            : "text-[color-mix(in_srgb,white,var(--faint)_25%)]"
                        )}
                      >
                        {showLabel ? monthLabel(lastDay.getFullYear(), lastDay.getMonth(), lang) : ""}
                      </span>
                      <div className="grid" style={DOTS_GRID_STYLE}>
                        {Array.from({ length: 7 }, (_, d) => {
                          const day = addDays(weekStart, d);
                          const key = dateKey(day);
                          const count = counts.get(key) ?? 0;
                          const isToday = key === todayStr;
                          // Today is never the outlined "future" style, even
                          // though it's the boundary case of `key > todayStr` —
                          // spelled out explicitly rather than relying on the
                          // strict `>` to exclude it.
                          const isFuture = !isToday && key > todayStr;
                          return (
                            <span
                              key={key}
                              title={
                                isFuture
                                  ? undefined
                                  : `${key} · ${t(count === 1 ? "calendar.session" : "calendar.sessions", { n: count })}`
                              }
                              className={dotClassName(isFuture, count > 0)}
                              style={{ width: DOT_PX, height: DOT_PX }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
            {/* A narrow rail standing in for the hidden scrollbar's own
                position, spanning the header + list column's full height
                (see the comment above). The two buttons are absolutely
                positioned, not flex-`justify-between` (edge-aligned) — a
                20px button (size-5, the standard hit target) is twice the
                height of the 10px (DOT_PX) header/week row it sits beside,
                so edge-aligning their tops/bottoms left the button, and the
                chevron centred inside it, visibly offset from the row it was
                meant to line up with. `top-[-5px]`/`bottom-[-5px]` instead
                centre each button (and so its chevron) exactly on the
                header's or the last row's own centre: half of the 10px
                mismatch (5px) overhangs above/below the rail's own box,
                comfortably inside the card's 20px padding, nothing clipped.
                Always rendered, even when !canScroll (nothing to scroll to
                yet) — on request, so the card's own width stays fixed as
                history accumulates, rather than widening by the rail's own
                width the first time a user crosses 4 weeks of sessions. */}
            <div className="relative hidden w-5 shrink-0 sm:block">
              {canScroll && (
                <>
                  <WeekButton
                    direction="older"
                    label={t("calendar.showOlderWeeks")}
                    onClick={() => scrollByWeek(-1)}
                    className="absolute top-[-5px] left-0"
                  />
                  <WeekButton
                    direction="newer"
                    label={t("calendar.showNewerWeeks")}
                    onClick={() => scrollByWeek(1)}
                    className="absolute bottom-[-5px] left-0"
                  />
                </>
              )}
            </div>
          </div>
        </div>
        {!fit && last && (
          <>
            <div aria-hidden className="mx-4 w-px shrink-0 bg-card-border sm:hidden" />
            <LastSession session={last} today={todayStr} />
          </>
        )}
      </div>
    </section>
  );
}

/** Whole days from `from` to `to`, both "YYYY-MM-DD" (UTC arithmetic on
 *  date-only values, so no timezone shift). */
function daysBetween(from: string, to: string): number {
  const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Phones only (hidden from `sm`): spot, how long ago, and the swell height
 *  and period of the most recent session, with the same source rule as the
 *  session card (Open-Meteo, else the typed-in numbers). */
function LastSession({ session, today }: { session: Session; today: string }) {
  const { lang, t } = useLang();
  const catalog = useSpotCatalog();
  const day = session.when.slice(0, 10);
  const ago = Math.max(0, daysBetween(day, today));
  const when =
    ago === 0 ? t("calendar.last.today") : ago === 1 ? t("calendar.last.yesterday") : t("calendar.last.daysAgo", { n: ago });
  const om = session.condOpenMeteo;
  const height = fmt1(om ? om.swellHeightM : session.cond?.swellHeightM);
  const period = fmt1(om ? om.swellPeriodS : session.cond?.swellPeriodS);
  return (
    <div className="flex min-w-0 flex-1 flex-col sm:hidden">
      <h3 className="mb-3 h-5 shrink-0 truncate font-sans text-[13px] leading-5 font-bold text-muted-foreground">
        {t("calendar.last.title")}
      </h3>
      <p className="text-[14px] leading-snug font-bold break-words">{catalog.label(session.spot, lang)}</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        {when} {session.when.slice(11, 16)}
      </p>
      {(height || period) && (
        <p className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 font-mono text-[16px] leading-none">
          {height && (
            <span>
              {height}
              <span className="ml-0.5 text-[11px] text-muted-foreground">m</span>
            </span>
          )}
          {period && (
            <span>
              {period}
              <span className="ml-0.5 text-[11px] text-muted-foreground">s</span>
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/** One ↑/↓ button. `data-scroll-week` is how updateArrowState() finds every
 *  copy (title row and side rail) to enable or disable it. */
function WeekButton({
  direction,
  label,
  onClick,
  className,
}: {
  direction: "older" | "newer";
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const Icon = direction === "older" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      data-scroll-week={direction}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30",
        className
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
