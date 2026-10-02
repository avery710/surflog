"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "cn";
import { useLang, type Lang, type TKey } from "@/lib/i18n";
import { taipeiToday } from "@/lib/format";
import type { Session } from "@/lib/types";

/** Dot grid geometry — small and fixed, never stretched to fill the card.
 *  A proper week grid: 7 per row, Monday-first. Every row is now always a
 *  full Monday-Sunday week (2026-10-01: switched from month-rows, which
 *  needed leading blanks before day 1 to line day 1 up under its real
 *  weekday — a week-row never needs that, it always starts on Monday), so
 *  every row is exactly the same height — see VISIBLE_WEEKS below for why
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

/** Monday-first weekday header above the dot grid — one line, once, not
 *  repeated per month (a proper week grid reads faster with the columns
 *  labelled, and this only costs one row for the whole card). Keys, not
 *  literal letters, so zh-TW gets 一二三四五六日 instead of MTWTFSS. */
const WEEKDAY_KEYS: TKey[] = [
  "calendar.weekday.mon",
  "calendar.weekday.tue",
  "calendar.weekday.wed",
  "calendar.weekday.thu",
  "calendar.weekday.fri",
  "calendar.weekday.sat",
  "calendar.weekday.sun",
];

/** Exactly this many week-rows are visible at once, always — a fixed
 *  window with a fixed height (WEEK_LIST_HEIGHT_PX below), not a measured
 *  one (2026-10-01, on request — "only display last 4 weeks so we have
 *  fixed height and width"; replaces the earlier month-row design, where
 *  2-3 months of variable-height rows — a 28-day Feb starting Monday is 4
 *  dot rows, a 31-day month starting Sunday is 6 — were measured from the
 *  rendered DOM after mount). Every row is now always a full Monday-Sunday
 *  week (7 dots, no leading blanks) at a fixed DOT_PX height (the month
 *  label's font-size is pinned to match DOT_PX exactly — see the label
 *  span below; at a larger size it was the tallest child in its row and
 *  silently stretched every row past DOT_PX, which the fixed-height scroll
 *  area then clipped), so every row really is the same height and the
 *  list's total height is a plain constant. A brand-new user with less
 *  than VISIBLE_WEEKS of history still gets exactly this many rows, on
 *  request — see the `minStartMonday` floor below — so the card is never
 *  shorter than this. Older weeks beyond this window scroll into view one
 *  at a time via the ↑ arrow in the rail on the right; ↓ returns toward
 *  the current (bottom) week. */
const VISIBLE_WEEKS = 4;
const ROW_GAP_PX = 8; // matches the `space-y-2` gap between week rows
// 4 rows * 10px dots + 3 gaps * 8px = 64px — the list's fixed scroll height.
const WEEK_LIST_HEIGHT_PX = VISIBLE_WEEKS * DOT_PX + (VISIBLE_WEEKS - 1) * ROW_GAP_PX;

// The weekday header row above the list: one DOT_PX-tall leading-none label
// line (the font-size is pinned to DOT_PX for the same clipping reason as
// the week rows — see the WEEK_LIST_HEIGHT_PX comment above) plus the mb-2
// (8px) gap before the list starts.
const HEADER_ROW_HEIGHT_PX = DOT_PX + 8;
// The card's own py-5 (20px top + 20px bottom) padding and 1px top + bottom
// border-border.
const CARD_PADDING_Y_PX = 20 + 20;
const CARD_BORDER_Y_PX = 2;

/** Total rendered height of the calendar's card, border to border — fixed
 *  now that the list is always exactly VISIBLE_WEEKS rows (see above).
 *  Exported so other dashboard-panel cards can match it exactly (the goal
 *  card, 2026-10-01, on request — see its own comment) instead of a
 *  hand-typed duplicate number that would drift the next time this
 *  geometry changes. */
export const CALENDAR_CARD_HEIGHT_PX = CARD_PADDING_Y_PX + CARD_BORDER_Y_PX + HEADER_ROW_HEIGHT_PX + WEEK_LIST_HEIGHT_PX;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The Monday that starts the week containing local date y/m/d (`month` is
 *  0-based, matching `Date`'s own convention). Built from y/m/d components
 *  via `new Date(year, month, day)`, never parsed from an ISO string — no
 *  UTC shift, matching how every other date in this file is handled.
 *  `getDay()` is Sun=0..Sat=6; shifted so Monday is 0, Sunday is 6. */
function mondayOf(year: number, month: number, day: number): Date {
  const d = new Date(year, month, day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
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

/** Every Monday-start week from `from` through `to` inclusive, oldest
 *  first. Both must already be Mondays (see `mondayOf` above) — this just
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

export function ActivityCalendar({ sessions }: { sessions: Session[] }) {
  const { lang, t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  const upBtnRef = useRef<HTMLButtonElement>(null);
  const downBtnRef = useRef<HTMLButtonElement>(null);
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
  // and could shift the day. mondayOf() below takes the already-split y/m/d
  // numbers, same rule.
  const todayStr = taipeiToday();
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const todayMonday = mondayOf(ty, tm - 1, td);
  const earliestMonday = earliestDay
    ? (([ey, em, ed]) => mondayOf(ey, em - 1, ed))(earliestDay.split("-").map(Number))
    : todayMonday;

  // Always at least VISIBLE_WEEKS rows, even for a brand-new user with no
  // (or very little) history — on request, so the card is always exactly
  // 4 rows tall, never shorter. Extra rows before the earliest session are
  // just real calendar weeks with no sessions in them (counts.get() already
  // defaults to 0), nothing special-cased. Older history beyond that floor
  // still pushes the start further back and makes the list scrollable.
  const minStartMonday = addDays(todayMonday, -7 * (VISIBLE_WEEKS - 1));
  const startMonday = earliestMonday.getTime() < minStartMonday.getTime() ? earliestMonday : minStartMonday;

  // Oldest to current. The last entry is always todayMonday (weeksBetween
  // steps in exact 7-day hops from one Monday to another, so it lands on
  // the upper bound exactly), i.e. the current week is always present and
  // always the bottom row — and the view below defaults to scrolled-to-
  // bottom, so the visible window always ends on the current week, never
  // on 4 older ones.
  const weeks = weeksBetween(startMonday, todayMonday);
  const canScroll = weeks.length > VISIBLE_WEEKS;

  // Enables/disables the up/down arrow buttons to match how far the list
  // can still scroll in each direction. Reads and writes the DOM directly
  // (button.disabled), not React state, since it runs both from the native
  // onScroll event below and from the layout effect on mount.
  function updateArrowState() {
    const el = scrollRef.current;
    if (!el) return;
    if (upBtnRef.current) upBtnRef.current.disabled = el.scrollTop <= 1;
    if (downBtnRef.current) {
      downBtnRef.current.disabled = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    }
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
  // week range actually grows (an older session pulling earliestMonday back
  // further, or the calendar rolling into a new week) — not on every
  // incidental re-render, which would fight a user mid-scroll. The list's
  // own height is a fixed constant now (WEEK_LIST_HEIGHT_PX, set directly
  // as inline style below) rather than measured, since every week row is
  // the same height — so this effect only sets scrollTop, no React state,
  // and doesn't trip react-hooks/set-state-in-effect.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    updateArrowState();
  }, [weeks.length]);

  return (
    // Full width below `sm`; from `sm` up, fit-content so the card hugs its
    // content whether or not the up/down rail renders (it only exists when
    // canScroll) — a fixed width left a blank rail-sized gap on the right.
    // The card's own right padding is a touch wider than its left/top/bottom
    // (pr-6/24px vs p-5/20px) on request, 2026-10-01 — deliberate breathing
    // room around the ↑/↓ buttons so they don't sit flush against the card's
    // rounded corner; the plain p-5 used everywhere else read as too tight
    // once the card stopped carrying any other slack (see the width-fix
    // immediately before this one). sm:self-start (2026-10-01, alongside the
    // goal card's height match above): journal.tsx's row became
    // sm:items-stretch so the goal card can be stretched to this card's
    // height, and self-start opts this card back out of that stretch — its
    // own height stays the fixed CALENDAR_CARD_HEIGHT_PX, never the taller
    // goal card's (e.g. while it's in edit mode).
    <section className="w-full sm:w-fit sm:shrink-0 sm:self-start">
      <div className="rounded-[var(--r-card)] border border-card-border bg-card py-5 pr-6 pl-5">
        {/* The weekday header and the scrollable week list share one flex-1
            column, with the ↑/↓ rail as a sibling of that whole column (not
            just of the list) — on request, so the rail spans the header's
            height too: the ↑ button lines up with the "M T W T F S S" row,
            the ↓ button with the last (current) week row, rather than only
            spanning the shorter scrollable list below the header. */}
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            {/* Weekday header, once for the whole card (not per week row) —
                sits outside the scrollable week list so it never scrolls
                away, and lines up with the dot columns below purely because
                both use the same fixed DOT_PX/GAP_PX grid, regardless of
                their separate flex containers' widths. */}
            <div className="mb-2 flex items-center gap-2">
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
            <div
              ref={scrollRef}
              onScroll={updateArrowState}
              // Native scrollbar hidden — the up/down arrow rail to the
              // right (roughly the scrollbar's own former position) is the
              // scroll affordance instead, on request. maxHeight is the
              // fixed WEEK_LIST_HEIGHT_PX constant (VISIBLE_WEEKS rows,
              // always the same height now that every row's own height is
              // pinned to DOT_PX below), not measured from the DOM.
              className="space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ maxHeight: WEEK_LIST_HEIGHT_PX }}
            >
              {weeks.map((monday, i) => {
                // Labelled by the row's *last* day (Sunday), not its first
                // (Monday) — on request, 2026-10-01: a week straddling a
                // month boundary (e.g. Mon 28 Sep - Sun 4 Oct) was always
                // labelled "SEP" (the Monday's month), so a new month never
                // got a label of its own until its first full Monday-start
                // week, which could be most of a week away. Sunday's month
                // is always the later/incoming one for any week containing
                // a 1st-of-month (whichever weekday the 1st falls on, the
                // Sunday of that week is on or after it), so the boundary
                // row now reads as the new month, same as a wall calendar
                // page-turn. Label only when it actually changes from the
                // row above (or it's the very first row) — a week-per-row
                // grid would otherwise repeat the same month name 4+ times
                // in a row, unlike the old one-row-per-month layout where
                // every row needed its own label.
                const sunday = addDays(monday, 6);
                const prevSunday = i > 0 ? addDays(weeks[i - 1], 6) : null;
                const showLabel =
                  i === 0 ||
                  prevSunday === null ||
                  prevSunday.getMonth() !== sunday.getMonth() ||
                  prevSunday.getFullYear() !== sunday.getFullYear();
                const isCurrentWeek = monday.getTime() === todayMonday.getTime();
                return (
                  <div key={dateKey(monday)} data-week-row className="flex items-center gap-2">
                    <span
                      className={cn(
                        // 10px, matching DOT_PX exactly (not the 11px tried
                        // first) — with leading-none that makes this span
                        // exactly as tall as a dot, so every row is a fixed
                        // DOT_PX tall and WEEK_LIST_HEIGHT_PX's row-count
                        // arithmetic holds exactly; at 11px the label (the
                        // tallest child) stretched every row 1px past the
                        // dots, which the fixed-height scroll area clipped.
                        "w-8 shrink-0 font-sans text-[10px] leading-none font-bold tracking-wide whitespace-nowrap uppercase",
                        // Matches the dot grey used in dotClassName() below
                        // (a light mix of --faint into white) rather than the
                        // theme's --muted-foreground, on request — note this
                        // is quite low contrast against the white card, since
                        // it's a tone meant for an unfilled dot, not for text.
                        isCurrentWeek
                          ? "text-foreground"
                          : "text-[color-mix(in_srgb,white,var(--faint)_25%)]"
                      )}
                    >
                      {showLabel ? monthLabel(sunday.getFullYear(), sunday.getMonth(), lang) : ""}
                    </span>
                    <div className="grid" style={DOTS_GRID_STYLE}>
                      {Array.from({ length: 7 }, (_, d) => {
                        const day = addDays(monday, d);
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
          <div className="relative w-5 shrink-0">
            {canScroll && (
              <>
                <button
                  ref={upBtnRef}
                  type="button"
                  onClick={() => scrollByWeek(-1)}
                  aria-label={t("calendar.showOlderWeeks")}
                  className="absolute top-[-5px] left-0 flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  ref={downBtnRef}
                  type="button"
                  onClick={() => scrollByWeek(1)}
                  aria-label={t("calendar.showNewerWeeks")}
                  className="absolute bottom-[-5px] left-0 flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
