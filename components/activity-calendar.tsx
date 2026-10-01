"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "cn";
import { useLang, type Lang, type TKey } from "@/lib/i18n";
import { taipeiToday } from "@/lib/format";
import type { Session } from "@/lib/types";

/** Dot grid geometry — small and fixed, never stretched to fill the card.
 *  A proper week grid now: 7 per row, Monday-first, day 1 sits under its
 *  real weekday (leading empty slots before it) — see `leadingEmptyDots()`.
 *  Fixed pixel column widths (not fractional), so the grid never depends on
 *  flex-wrap rounding, and the weekday header row below lines up with it
 *  exactly regardless of the two rows' different flex containers. Dot size
 *  kept at the original 10px (unchanged from the 14-per-row layout; tried
 *  larger at 14px first, sized back down on request). Gap widened to 10px
 *  (from the original 6px) on request, for more breathing room between
 *  dots now that there's only 7 per row instead of 14. */
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

/** At most this many months are visible without scrolling; older ones
 *  scroll above. Month rows aren't a fixed height (a 28-day Feb with a
 *  Monday-first 1st is 4 dot rows, a 31-day month starting on a Sunday is
 *  6), so "2 months" is measured from the actual rendered rows (see the
 *  layout effect below) rather than a single guessed CSS max-height — this
 *  constant is also the initial/SSR fallback before that measurement runs.
 *  Lowered from 3 to 2 when the grid went from 14-per-row to 7-per-row: a
 *  week-aligned month is now 4-6 dot rows instead of 2-3, so 3 months would
 *  make this card noticeably taller than the table it usually sits beside. */
const VISIBLE_MONTHS = 2;
const ROW_GAP_PX = 8; // matches the `space-y-2` gap between month rows
const MONTH_LIST_MAX_HEIGHT_FALLBACK = 190;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Days in a month; `month` is 0-based, matching `Date`'s own convention. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** How many empty slots precede day 1 in a Monday-first week grid.
 *  `new Date(year, month, 1).getDay()` reads the weekday off the *local*
 *  calendar date (Sun=0..Sat=6) since it's built from y/m/d components, not
 *  parsed from an ISO string — no UTC shift, matching how every other date
 *  in this file is handled. Shifted so Monday is 0 and Sunday is 6. */
function leadingEmptyDots(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/** Short month label for a row, e.g. "Sep" / "9月" — no year, this is a
 *  short history strip, not a date picker. */
function monthLabel(year: number, month: number, lang: Lang): string {
  const locale = lang === "zh-TW" ? "zh-TW" : "en-US";
  return new Date(year, month, 1).toLocaleString(locale, { month: "short" });
}

type MonthKey = { year: number; month: number }; // month is 0-based

/** Every month from `from` through `to` inclusive, oldest first. */
function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  let year = from.year;
  let month = from.month;
  while (year < to.year || (year === to.year && month <= to.month)) {
    months.push({ year, month });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return months;
}

/** Surfed = filled teal, past-no-surf = filled grey, future (strictly after
 *  today) = outlined ring only, no fill. Today gets whichever fill applies
 *  (teal if already surfed, grey otherwise) with no extra highlight — it is
 *  never the outlined future style, it just isn't called out further either.
 *  Binary — no session-count colour ramp. The no-surf fill and the future
 *  outline share the same grey: a light mix of `--faint` into white (25%
 *  faint) — progressively lightened on request from an initial 50/50 mix,
 *  which was itself lighter than plain `--faint` (too dark) but still
 *  darker than wanted; still visible unlike the original
 *  `--secondary`/`--border` (nearly invisible at dot size). Written as full
 *  literal class strings (not built from a shared JS constant) because
 *  Tailwind's build-time scanner needs the complete arbitrary-value class to
 *  appear as-is in the source. */
function dotClassName(isFuture: boolean, surfed: boolean): string {
  return cn(
    "block rounded-full",
    isFuture
      ? "border border-[color-mix(in_srgb,white,var(--faint)_25%)] bg-transparent"
      : surfed
        ? "bg-[#0E7C86]"
        : "bg-[color-mix(in_srgb,white,var(--faint)_25%)]"
  );
}

/** Duration of the custom month-to-month scroll animation, in ms — longer
 *  and eased, since the browser's native `scrollTo({ behavior: "smooth" })`
 *  runs a short, non-configurable animation that read as an abrupt jump
 *  between rows of very different heights (2 vs 3 dot-rows). */
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
  // and could shift the day.
  const todayStr = taipeiToday();
  const [ty, tm] = todayStr.split("-").map(Number);
  const today: MonthKey = { year: ty, month: tm - 1 };
  const earliest: MonthKey = earliestDay
    ? (([ey, em]) => ({ year: ey, month: em - 1 }))(earliestDay.split("-").map(Number))
    : today;

  // Only the months with history, oldest to current — no earlier sessions
  // means just the current month, with nothing to scroll to.
  const months = monthsBetween(earliest, today);
  const canScroll = months.length > VISIBLE_MONTHS;

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
  // months — moves exactly one month row at a time, snapping to its top,
  // rather than an arbitrary pixel nudge, since rows aren't a fixed height
  // (see VISIBLE_MONTHS above).
  function scrollByMonth(direction: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-month-row]"));
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

  // Cap the visible list to the last VISIBLE_MONTHS rows' actual rendered
  // height (measured, not guessed — month rows aren't a fixed height, see
  // VISIBLE_MONTHS above), then land on the current (bottom) month and set
  // the initial arrow disabled-state to match. Re-runs whenever the
  // displayed month range actually changes (a new earliest session pulled
  // in, or the calendar rolled into a new month) — not on every incidental
  // re-render, which would fight a user mid-scroll. This only writes DOM
  // style/scrollTop directly, no React state, so it doesn't trip
  // react-hooks/set-state-in-effect.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-month-row]"));
    const visible = rows.slice(-VISIBLE_MONTHS);
    if (visible.length > 0) {
      const height =
        visible.reduce((sum, row) => sum + row.offsetHeight, 0) + ROW_GAP_PX * (visible.length - 1);
      el.style.maxHeight = `${height}px`;
    }
    el.scrollTop = el.scrollHeight;
    updateArrowState();
  }, [months.length]);

  return (
    // Full width below `sm` (stacked above/below the goal card, one column,
    // no horizontal scroll risk); fixed content-width from `sm` up, once
    // journal.tsx's row puts it beside the goal card — sm:shrink-0 so the
    // goal's flex-1 never eats into it. 260px comfortably fits the actual
    // content: the w-8 (32px) month-label column + gap-2 (8px) + the 7×10px
    // dot grid with 10px gaps (130px) + gap-2 (8px) + the w-5 (20px)
    // up/down rail, all inside the card's own p-5 (20px) padding —
    // 32+8+130+8+20 = 198px content + 40px padding ≈ 238px minimum, +22px
    // slack. Deliberately much narrower than the old 344px (a leftover
    // from when this card had to share a row with the wider table instead)
    // — that left ~100px of blank white space on every screen size, which
    // is what prompted this pass. No h-full: it no longer needs to stretch
    // to match a sibling's height (journal.tsx pairs it with the goal card
    // using items-start, not items-stretch), so it just sizes to its own
    // content.
    <section className="w-full sm:w-[260px] sm:shrink-0">
      <div className="rounded-[var(--r-card)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        {/* Weekday header, once for the whole card (not per month) — sits
            outside the scrollable month list so it never scrolls away, and
            lines up with the dot columns below purely because both use the
            same fixed DOT_PX/GAP_PX grid, regardless of their separate flex
            containers' widths. */}
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
        <div className="flex items-stretch gap-2">
          <div
            ref={scrollRef}
            onScroll={updateArrowState}
            // Native scrollbar hidden — the up/down arrow rail to the right
            // (roughly the scrollbar's own former position) is the scroll
            // affordance instead, on request.
            className="min-w-0 flex-1 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ maxHeight: MONTH_LIST_MAX_HEIGHT_FALLBACK }}
          >
            {months.map(({ year, month }) => {
              const total = daysInMonth(year, month);
              const leading = leadingEmptyDots(year, month);
              const isCurrentMonth = year === ty && month === tm - 1;
              return (
                <div
                  key={`${year}-${pad2(month + 1)}`}
                  data-month-row
                  className="flex items-start gap-2"
                >
                  <span
                    className={cn(
                      "w-8 shrink-0 font-sans text-[11px] leading-none font-bold tracking-wide whitespace-nowrap uppercase",
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
                    {monthLabel(year, month, lang)}
                  </span>
                  <div className="grid" style={DOTS_GRID_STYLE}>
                    {/* Empty slots before day 1, so it sits under its real
                        weekday instead of always starting at column 1 —
                        invisible, not styled as a dot (no fill/border), and
                        out of the tab order/title tour since there's no date
                        behind them. */}
                    {Array.from({ length: leading }, (_, i) => (
                      <span
                        key={`empty-${i}`}
                        aria-hidden="true"
                        style={{ width: DOT_PX, height: DOT_PX }}
                      />
                    ))}
                    {Array.from({ length: total }, (_, i) => {
                      const dayNum = i + 1;
                      const key = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`;
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
          {canScroll && (
            // A narrow rail standing in for the hidden scrollbar's own
            // position — up arrow at the top of the track, down arrow at
            // the bottom, same as a classic scrollbar's end buttons, just
            // one month-row per click instead of a pixel nudge.
            <div className="flex w-5 shrink-0 flex-col items-center justify-between py-px">
              <button
                ref={upBtnRef}
                type="button"
                onClick={() => scrollByMonth(-1)}
                aria-label={t("calendar.showOlderMonths")}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                ref={downBtnRef}
                type="button"
                onClick={() => scrollByMonth(1)}
                aria-label={t("calendar.showNewerMonths")}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
