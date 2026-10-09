"use client";

import { useState } from "react";
import { GoalCard } from "@/components/goal";
import { ActivityCalendar } from "@/components/activity-calendar";
import { AiAppCard } from "@/components/ai-app-card";
import { PatternsTable } from "@/components/patterns-table";
import { BoardRack } from "@/components/board-rack";
import { LangSwitch } from "@/app/dev/lang-switch";
import { fakeBoard, fakeSession, logAction } from "@/app/dev/fixtures";
import { taipeiToday } from "@/lib/format";
import { joinGoalPoints, MAX_GOAL } from "@/lib/goal";
import type { Board, Session } from "@/lib/types";

/**
 * The grey-tinted dashboard panel above the session list — see
 * CLAUDE.md "Status" (2026-09-28 goal + calendar entries) and
 * components/journal.tsx's own comment on the wrapper below. Not linked
 * from the real app; 404s in production builds (app/dev/layout.tsx).
 *
 * journal.tsx fetches real data (sessions/boards/goal/spot notes) and
 * needs a signed-in owner, so it isn't rendered directly here. The panel
 * markup (the bg-panel wrapper + its grid) is replicated below —
 * see the "mirrors components/journal.tsx" comment on DashboardPanel — and
 * the four real child components (GoalCard, ActivityCalendar,
 * PatternsTable, BoardRack) are dropped in with synthetic props from
 * ../fixtures.ts instead.
 *
 * Interactivity:
 * - GoalCard's onSave and PatternsTable's onSaveSpotNote are no-op
 *   handlers here (console.log, resolve true so the inline editor closes)
 *   — in the real app journal.tsx does the fetch; this page never calls
 *   /api/goal or /api/spot-notes.
 * - BoardRack is different: it calls fetch itself for add/edit/delete and
 *   set-default (no callback prop for that, unlike the two above) — every
 *   one of those actions hits the real /api/boards/* routes and will fail
 *   here (401 outside a signed-in session), shown as an error toast. Known
 *   limit of previewing this component live, not a bug in this page — see
 *   the entry-card showcase for the same caveat on Edit/Delete/upload.
 */

const devSaveGoal = async (text: string): Promise<boolean> => {
  console.log("[dev/dashboard] saveGoal", text);
  return true;
};
const devSaveSpotNote = async (spot: string, description: string): Promise<boolean> => {
  console.log("[dev/dashboard] saveSpotNote", spot, description);
  return true;
};
const devOnBoardSaved = logAction("dashboard/board-saved") as (b: Board) => void;
const devOnBoardDeleted = logAction("dashboard/board-deleted") as (id: string) => void;
const devOnRackChanged = logAction("dashboard/rack-changed") as (boards: Board[]) => void;

function DashboardPanel({
  goal,
  sessions,
  spotNotes,
  boards,
  aiCard = false,
}: {
  goal: string | null;
  sessions: Session[];
  spotNotes: Record<string, string>;
  boards: Board[];
  /** journal.tsx's showAiAppCard: no AI app connected yet. */
  aiCard?: boolean;
}) {
  return (
    // mirrors components/journal.tsx — keep in sync. There it's an inline
    // wrapper around GoalCard, { ActivityCalendar, PatternsTable } and
    // BoardRack, not its own exported component (journal.tsx owns the
    // fetched state and passes it straight through) — className copied
    // verbatim, including journal.tsx's own comment on why it's tinted
    // (--panel, a light grey — renamed from --primary-soft and moved off
    // blue 2026-10-02, once the header above took the solid blue instead;
    // no border since 2026-10-01) while each section keeps a white
    // bg-card surface.
    <div className="mt-6.5 flex flex-col gap-4">
      {/* Row 1, sm: up — goal (flexible) beside the calendar (content-sized,
          fit-content), sm:items-stretch (2026-10-01). See journal.tsx for
          why: the calendar's own content is only ~200px wide, so pairing it
          with the goal card uses the space a full-width calendar card used
          to waste between sm and lg; items-stretch (2026-10-08): the goal
          card fits its points, the calendar stretches to it and shows more
          weeks. */}
      {aiCard ? (
        // With the AI app card: see journal.tsx's comment on this branch.
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-col lg:flex-1">
            <GoalCard goal={goal} sessions={sessions} onSave={devSaveGoal} />
          </div>
          <div className="flex flex-wrap items-stretch gap-3 sm:gap-4 lg:flex-nowrap">
            <ActivityCalendar sessions={sessions} fit />
            <AiAppCard />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col">
            <GoalCard goal={goal} sessions={sessions} onSave={devSaveGoal} />
          </div>
          <ActivityCalendar sessions={sessions} />
        </div>
      )}

      <PatternsTable sessions={sessions} spotNotes={spotNotes} onSaveSpotNote={devSaveSpotNote} />

      <BoardRack
        boards={boards}
        onSaved={devOnBoardSaved}
        onDeleted={devOnBoardDeleted}
        onRackChanged={devOnRackChanged}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Fixture plumbing — date/session helpers local to this page (like
// app/dev/activity-preview/page.tsx's own pad2/daysInMonth), since none
// of it is generic enough to belong in ../fixtures.ts. Dates are built
// relative to taipeiToday() rather than hardcoded, so "this month" /
// "4 months of history" / "today" stay true whenever this page is
// actually opened, not just on the day it was written.
// ---------------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}
/** ymd minus n days, plain local calendar arithmetic. */
function minusDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

const todayYmd = taipeiToday();
const [ty, tmRaw, td] = todayYmd.split("-").map(Number);
const tm0 = tmRaw - 1; // 0-based month, matches Date's own convention

/** A minimal session for these dashboard components, which only ever read
 *  spot/when/boardId/goalText/goalMet — cond/condOpenMeteo/condCwaTide are
 *  irrelevant here (only entry-card.tsx renders those), so they're nulled
 *  out rather than left at fakeSession()'s full-data defaults. */
function dashSession(overrides: Partial<Session> & Pick<Session, "spot" | "when">): Session {
  return fakeSession({
    notesHtml: "",
    notes: "",
    cond: null,
    condOpenMeteo: null,
    condCwaTide: null,
    createdAt: overrides.when,
    ...overrides,
  });
}

/** Sparse sessions (every 6th day) across `monthsBack` months ending at the
 *  current month — enough history to make ActivityCalendar's older-weeks
 *  scroll rail appear (canScroll = weeks.length > VISIBLE_WEEKS(4), easily
 *  true past the current 4-week window) without every day being "surfed".
 *  Mirrors activity-preview/page.tsx's own sessionsSpanning(), extended
 *  with a spot/id so it can share dashSession. */
function sessionsSpanningMonths(monthsBack: number, spot: string, idPrefix: string): Session[] {
  const sessions: Session[] = [];
  for (let back = monthsBack - 1; back >= 0; back--) {
    let year = ty;
    let month0 = tm0 - back;
    while (month0 < 0) {
      month0 += 12;
      year -= 1;
    }
    const isCurrentMonth = back === 0;
    const lastDay = isCurrentMonth ? td : daysInMonth(year, month0);
    for (let day = 2; day <= lastDay; day += 6) {
      const when = `${year}-${pad2(month0 + 1)}-${pad2(day)}T08:00`;
      sessions.push(dashSession({ id: `dev-dash-${idPrefix}-${when}`, spot, when }));
    }
  }
  return sessions;
}

interface DashboardCase {
  id: string;
  group: string;
  title: string;
  caption: string;
  goal: string | null;
  sessions: Session[];
  boards: Board[];
  spotNotes: Record<string, string>;
}

// --- Overview ----------------------------------------------------------

const typicalGoal = "Pop up faster\nDrive off the bottom, not just glide with it";
const typicalSpots = ["jialeshui", "waiao", "double-lions"];
const typicalDaysAgo = [0, 3, 7, 10, 14, 18, 24, 30, 37, 44, 51, 58];
const typicalBoardA = fakeBoard({
  id: "dev-dash-typical-board-a",
  brand: "Pyzel Ghost",
  lengthIn: 74,
  volumeL: 29.5,
  rocker: "medium",
  isFavorite: true,
});
const typicalBoardB = fakeBoard({
  id: "dev-dash-typical-board-b",
  brand: "Channel Islands Neck Beard 2",
  lengthIn: 68,
  volumeL: 25,
  rocker: "low",
  isFavorite: false,
});
// 12 sessions, 3 spots, 2 months. The 6 most recent are logged against the
// current goal (3 met, 2 not yet, 1 unchecked -> assessed 5, met 3 -> "met
// 3 of 5"); the next 3 carry an older goal text (doesn't count toward the
// current one); the oldest 3 predate the goal feature (goalText null).
const typicalSessions: Session[] = typicalDaysAgo.map((daysAgo, i) => {
  const when = `${minusDays(todayYmd, daysAgo)}T${i % 2 === 0 ? "07:00" : "16:00"}`;
  const spot = typicalSpots[i % typicalSpots.length];
  const boardId = i % 3 === 0 ? typicalBoardA.id : i % 3 === 1 ? typicalBoardB.id : null;
  if (i < 6) {
    return dashSession({
      spot,
      when,
      boardId,
      goalText: typicalGoal,
      goalMet: i < 3 ? true : i < 5 ? false : null,
    });
  }
  if (i < 9) {
    return dashSession({ spot, when, boardId, goalText: "Read the peak before paddling", goalMet: null });
  }
  return dashSession({ spot, when, boardId, goalText: null, goalMet: null });
});
const typicalSpotNotes: Record<string, string> = {
  jialeshui: "近滿潮最乾淨，退潮容易踢到石頭，適合中高手",
  waiao: "假日很多人，平日早上人少浪也不錯",
};

// --- Goal card -----------------------------------------------------------

const goalSinglePoint = "Stay low through takeoff";
const goalSingleSessions: Session[] = [0, 5, 11].map((daysAgo, i) =>
  dashSession({
    spot: "jialeshui",
    when: `${minusDays(todayYmd, daysAgo)}T07:00`,
    goalText: goalSinglePoint,
    goalMet: i < 2, // 2 true, 1 false -> met 2 of 3
  })
);

const maxLenPointsRaw = [
  "Stay lower through the bottom turn so there's more drive on the way back up",
  "Look down the line before starting the top turn, not after",
  "Keep the back foot loaded through the whole cutback, not just at the start",
  "Paddle earlier for the second peak of a set instead of just the first wave",
];
// Joined and capped at MAX_GOAL (200, the goals table's check constraint) —
// see lib/goal.ts. Slicing may land mid-word on the last point; that's fine,
// the point here is exercising a near-limit string, not a clean edit.
const goalMaxLen = joinGoalPoints(maxLenPointsRaw).slice(0, MAX_GOAL);
const goalMaxLenSessions: Session[] = [0, 6].map((daysAgo, i) =>
  dashSession({
    spot: "waiao",
    when: `${minusDays(todayYmd, daysAgo)}T08:00`,
    goalText: goalMaxLen,
    goalMet: i === 0 ? true : null,
  })
);

const goalLongZh =
  "起乘的時候身體重心放低一點，不要一開始就站太直，不然容易被浪打掉\n" +
  "划水的時候手臂盡量伸直，划水路徑要貼近板身，不要划得太寬\n" +
  "看浪的時候提早轉頭找下一個方向，不要等浪快靠近才轉頭，會來不及調整站位";
const goalLongZhSessions: Session[] = [0, 4].map((daysAgo, i) =>
  dashSession({
    spot: "jialeshui",
    when: `${minusDays(todayYmd, daysAgo)}T07:00`,
    goalText: goalLongZh,
    goalMet: i === 0 ? false : null,
  })
);

// 7 points (6+), the last a long wrapping 繁體中文 sentence — tall enough
// on `sm+` to exceed the goal card's height cap (CALENDAR_CARD_HEIGHT_PX,
// see goal.tsx) so the points list actually scrolls and the bottom fade
// shows, added 2026-10-01 alongside that height-match change.
const goalManyPointsRaw = [
  "提早划水",
  "起乘時重心放低",
  "看浪優先，不要只顧划手",
  "後腳確實施力做轉彎",
  "Look down the line before the top turn",
  "划水路徑貼近板身，不要划太寬",
  "看浪的時候要提早轉頭找下一個方向，不要等浪快靠近才轉頭，等到真的靠近才轉頭常常會來不及調整站位，導致起乘的時間點抓不準",
];
const goalManyPoints = joinGoalPoints(goalManyPointsRaw).slice(0, MAX_GOAL);
const goalManyPointsSessions: Session[] = [0, 3, 10].map((daysAgo, i) =>
  dashSession({
    spot: "jialeshui",
    when: `${minusDays(todayYmd, daysAgo)}T07:00`,
    goalText: goalManyPoints,
    goalMet: i === 0 ? true : i === 1 ? false : null,
  })
);

const goalNotTried = "改用短一點的板子試試看起乘速度會不會比較快";
// Sessions exist, but none logged against *this* goal text — tried.length
// is 0, so GoalCard shows the point with no count after it at all (no
// "not tried yet" wording either — removed 2026-10-01, on request).
const goalNotTriedSessions: Session[] = [0, 9, 20].map((daysAgo) =>
  dashSession({
    spot: "waiao",
    when: `${minusDays(todayYmd, daysAgo)}T08:00`,
    goalText: daysAgo === 20 ? "Read the peak before paddling" : null,
    goalMet: null,
  })
);
const goalCaseBoards = [fakeBoard({ id: "dev-dash-goal-board", brand: "Pyzel Ghost", lengthIn: 74, volumeL: 29.5, rocker: "medium" })];

// --- Activity calendar ---------------------------------------------------

// Offsets kept strictly less than today's day-of-month (td) so every date
// lands in the current calendar month regardless of when this page is
// actually opened — 0 (today) is always safe; the others are proportional
// to td and de-duplicated, so on an early day-of-month this thins out
// gracefully instead of spilling into the previous month.
const calSingleMonthOffsets = Array.from(
  new Set([0, Math.max(1, Math.floor(td * 0.3)), Math.max(1, Math.floor(td * 0.6))])
).filter((o) => o < td || o === 0);
const calSingleMonthSessions: Session[] = calSingleMonthOffsets.map((daysAgo) =>
  dashSession({ spot: "jialeshui", when: `${minusDays(todayYmd, daysAgo)}T08:00` })
);

const calFourMonthsSessions = sessionsSpanningMonths(5, "waiao", "cal-multi");

const calTodaySessions: Session[] = [
  dashSession({ spot: "jialeshui", when: `${todayYmd}T07:00` }),
  ...calSingleMonthOffsets.filter((o) => o > 0).map((daysAgo) => dashSession({ spot: "jialeshui", when: `${minusDays(todayYmd, daysAgo)}T16:00` })),
];

// A safe past day within the current month (falls back to "yesterday" if
// today is very early in the month) with three sessions on it — dawn,
// mid-morning, and an afternoon return session.
const calSameDayOffset = Math.min(Math.max(1, td - 1), 5);
const calSameDayYmd = minusDays(todayYmd, calSameDayOffset);
const calSameDaySessions: Session[] = [
  dashSession({ spot: "jialeshui", when: `${calSameDayYmd}T06:00` }),
  dashSession({ spot: "jialeshui", when: `${calSameDayYmd}T09:00` }),
  dashSession({ spot: "waiao", when: `${calSameDayYmd}T16:00` }),
  dashSession({ spot: "jialeshui", when: `${minusDays(todayYmd, calSameDayOffset + 6)}T07:00` }),
];
const calCaseBoards = [fakeBoard({ id: "dev-dash-cal-board", brand: "Firewire Dominator", lengthIn: 70, volumeL: 32, rocker: "low" })];

// --- Spot table -----------------------------------------------------------

const tableSingleSpotSessions: Session[] = [0, 7].map((daysAgo) =>
  dashSession({ spot: "jialeshui", when: `${minusDays(todayYmd, daysAgo)}T07:00` })
);

const manySpots: { slug: string; count: number }[] = [
  { slug: "jialeshui", count: 4 },
  { slug: "waiao", count: 3 },
  { slug: "wushi-north", count: 2 }, // long Chinese name: 烏石港（北堤）
  { slug: "wuwei", count: 2 }, // 蘇澳 - 無尾港
  { slug: "environmental-park", count: 1 }, // 環保公園
  { slug: "double-lions", count: 1 },
  { slug: "daxi", count: 1 },
  { slug: "gongs", count: 1 }, // 鹽寮漁港
  { slug: "eight-immortals-cave", count: 1 }, // 八仙洞
  { slug: "custom:Siargao - Cloud 9", count: 1 }, // overseas, not in lib/spots.ts
  { slug: "custom:Unmapped spot", count: 1 }, // custom, no coordinates either
];
const manySpotsSessions: Session[] = (() => {
  const out: Session[] = [];
  let offset = 0;
  for (const { slug, count } of manySpots) {
    for (let i = 0; i < count; i++) {
      out.push(dashSession({ spot: slug, when: `${minusDays(todayYmd, offset)}T07:00` }));
      offset += 4;
    }
  }
  return out;
})();
const manySpotsNotes: Record<string, string> = {
  "wushi-north":
    "北堤這邊冬天浪比較大，外面有暗礁要小心，漲潮的時候比較安全，退潮的時候石頭會露出來，新手不建議退潮下水。" +
    "人潮通常集中在週末，平日早上人比較少，風向對的時候（東北風轉北風）浪況會特別乾淨，值得早起。",
  "custom:Siargao - Cloud 9": "World-class right point, best at mid tide, glassy at dawn before the wind picks up.",
  jialeshui: "近滿潮最乾淨",
};

// --- Board rack -----------------------------------------------------------

const boardOneSessions: Session[] = [0, 8].map((daysAgo) =>
  dashSession({ spot: "jialeshui", when: `${minusDays(todayYmd, daysAgo)}T07:00` })
);
const boardOne = [
  fakeBoard({ id: "dev-dash-board-one", brand: "Pyzel Ghost", lengthIn: 74, volumeL: 29.5, rocker: "medium", isFavorite: true }),
];

const manyBoards: Board[] = [
  fakeBoard({
    id: "dev-dash-board-1",
    brand: "Pyzel Ghost",
    lengthIn: 74,
    volumeL: 29.5,
    rocker: "medium",
    isFavorite: true,
    note: "Daily driver, good in most conditions.",
  }),
  fakeBoard({ id: "dev-dash-board-2", brand: "Firewire Dominator", lengthIn: 70, volumeL: 32, rocker: "low" }),
  fakeBoard({
    id: "dev-dash-board-3",
    brand: "Channel Islands Neck Beard 2",
    lengthIn: 68,
    volumeL: 25,
    rocker: "high",
    note: "Small-day board, goes in anything under waist high.",
  }),
  // Empty brand -> boardLabel() falls back to length only ("7'6\""); the
  // list item's own `{b.brand || name}` line exercises that fallback.
  fakeBoard({ id: "dev-dash-board-4", brand: "", lengthIn: 90, volumeL: null, rocker: null, note: "Borrowed longboard, no name on it." }),
  fakeBoard({ id: "dev-dash-board-5", brand: "JS Monsta Box", lengthIn: 71.5, volumeL: 27.8, rocker: "medium" }),
  fakeBoard({ id: "dev-dash-board-6", brand: "Album Twin", lengthIn: 65, volumeL: 24, rocker: "high" }),
  // No length, no rocker -> specs list is volume only, exercises the
  // `.filter(Boolean)` on the specs join.
  fakeBoard({ id: "dev-dash-board-7", brand: "Custom shape, no name", lengthIn: null, volumeL: 30, rocker: null }),
];
const manyBoardsSessions: Session[] = [0, 5, 11].map((daysAgo) =>
  dashSession({ spot: "jialeshui", when: `${minusDays(todayYmd, daysAgo)}T07:00`, boardId: daysAgo === 0 ? "dev-dash-board-1" : null })
);

const boardPhotoCaseBoards = [
  fakeBoard({ id: "dev-dash-board-photo", brand: "Pyzel Ghost", lengthIn: 74, volumeL: 29.5, rocker: "medium", photoId: null }),
];
const boardPhotoCaseSessions: Session[] = [0, 8].map((daysAgo) =>
  dashSession({ spot: "jialeshui", when: `${minusDays(todayYmd, daysAgo)}T07:00` })
);

const CASES: DashboardCase[] = [
  {
    id: "empty",
    group: "Overview",
    title: "Brand-new user — nothing yet",
    caption:
      "goal null, sessions [], spotNotes {}, boards [] — every empty state at once: GoalCard's “add a goal” prompt, ActivityCalendar showing just the current month with no surfed dots, PatternsTable rendering nothing at all (sessions.length < 2 returns null — the whole “What you've surfed” card is absent, not an empty table), and BoardRack's “no boards yet” prompt.",
    goal: null,
    sessions: [],
    boards: [],
    spotNotes: {},
  },
  {
    id: "typical",
    group: "Overview",
    title: "Typical — a few weeks in",
    caption:
      "2-point goal, met 3 of 5 (6 sessions carry it, one unchecked); 12 sessions over ~2 months at 3 spots (jialeshui/waiao/double-lions); 2 boards, one marked default, assigned to some sessions; spot notes on 2 of the 3 spots (double-lions has none, shows “add description”).",
    goal: typicalGoal,
    sessions: typicalSessions,
    boards: [typicalBoardA, typicalBoardB],
    spotNotes: typicalSpotNotes,
  },
  {
    id: "goal-single-point",
    group: "Goal card",
    title: "Single-point goal",
    caption: "One line, no bullet-list wrapping to speak of. 3 sessions logged against it, met 2 of 3.",
    goal: goalSinglePoint,
    sessions: goalSingleSessions,
    boards: goalCaseBoards,
    spotNotes: {},
  },
  {
    id: "goal-max-length",
    group: "Goal card",
    title: "Near max-length goal, several points",
    caption: `goal text at ${goalMaxLen.length} of ${MAX_GOAL} chars (the goals table's check constraint) across ${maxLenPointsRaw.length} points — tests the bulleted list's wrapping/line length at the edge.`,
    goal: goalMaxLen,
    sessions: goalMaxLenSessions,
    boards: goalCaseBoards,
    spotNotes: {},
  },
  {
    id: "goal-long-zh",
    group: "Goal card",
    title: "Long Chinese points",
    caption: "Three long 繁體中文 sentences, one per line — CJK wrapping in the bulleted list and the chip's compact join.",
    goal: goalLongZh,
    sessions: goalLongZhSessions,
    boards: goalCaseBoards,
    spotNotes: {},
  },
  {
    id: "goal-many-points",
    group: "Goal card",
    title: "7 points — scrolls past the calendar's height",
    caption:
      "6 short points plus one long wrapping 繁體中文 sentence — on sm+ this exceeds the goal card's height cap (matched to the activity calendar's fixed 4-week height), so the points list scrolls internally and the bottom fade hint appears; below sm there's no cap, so it's just a long list.",
    goal: goalManyPoints,
    sessions: goalManyPointsSessions,
    boards: goalCaseBoards,
    spotNotes: {},
  },
  {
    id: "goal-not-tried",
    group: "Goal card",
    title: "Goal set, no sessions against it yet",
    caption:
      "Sessions exist (at other spots, some with an older/different goal, some with none), but none carry *this* exact goal text — tried.length is 0, so the point shows with no count after it at all, not a “met 0 of 0”.",
    goal: goalNotTried,
    sessions: goalNotTriedSessions,
    boards: goalCaseBoards,
    spotNotes: {},
  },
  {
    id: "cal-single-month",
    group: "Activity calendar",
    title: "Calendar — within the current 4-week window",
    caption:
      "Every session falls within the last 4 weeks (computed relative to today, not hardcoded) → weeks.length ≤ VISIBLE_WEEKS(4), so the whole history fits with no scroll rail. Dates thin out gracefully if this is opened very early in a week/month.",
    goal: null,
    sessions: calSingleMonthSessions,
    boards: calCaseBoards,
    spotNotes: {},
  },
  {
    id: "cal-four-months",
    group: "Activity calendar",
    title: "Calendar — 4+ months of history",
    caption:
      "Sparse sessions spanning 5 months → weeks.length (~22) > VISIBLE_WEEKS(4), so the ↑/↓ scroll rail appears; the fixed-height list lands on the current (bottom) week by default — always visible without scrolling, see the week grid's own comment.",
    goal: null,
    sessions: calFourMonthsSessions,
    boards: calCaseBoards,
    spotNotes: {},
  },
  {
    id: "cal-today",
    group: "Activity calendar",
    title: "Calendar — a session logged today",
    caption: "Includes a session dated today — today's dot fills teal like any other surfed day, no separate “today” marker.",
    goal: null,
    sessions: calTodaySessions,
    boards: calCaseBoards,
    spotNotes: {},
  },
  {
    id: "cal-same-day",
    group: "Activity calendar",
    title: "Calendar — many sessions on the same day",
    caption:
      "Three sessions on one day (dawn, mid-morning, an afternoon return) — the dot is still binary (surfed/not), the count only shows in the title tooltip (“3 sessions”), no colour ramp.",
    goal: null,
    sessions: calSameDaySessions,
    boards: calCaseBoards,
    spotNotes: {},
  },
  {
    id: "table-single-spot",
    group: "Spot table",
    title: "Table — a single spot",
    caption: "2 sessions, both jialeshui — the minimum for the table to render at all (sessions.length >= 2), one row, n=2.",
    goal: null,
    sessions: tableSingleSpotSessions,
    boards: [],
    spotNotes: {},
  },
  {
    id: "table-many-spots",
    group: "Spot table",
    title: "Table — 11 spots, custom/overseas, long Chinese names + a long note",
    caption:
      "11 spots incl. two custom/free-text entries (an overseas break not in lib/spots.ts, and an unmapped custom spot), long Chinese names (烏石港（北堤）, 蘇澳 - 無尾港, 環保公園), and one long 繁體中文 spot note to check the description cell's wrapping.",
    goal: null,
    sessions: manySpotsSessions,
    boards: [],
    spotNotes: manySpotsNotes,
  },
  {
    id: "board-one",
    group: "Board rack",
    title: "Board rack — a single board",
    caption: "One board is implicitly the default — defaultBoardId() treats a lone board as default even without isDefault set explicitly here; the set-default toggle is disabled (“only board”).",
    goal: null,
    sessions: boardOneSessions,
    boards: boardOne,
    spotNotes: {},
  },
  {
    id: "board-many",
    group: "Board rack",
    title: "Board rack — 7 boards",
    caption:
      "One marked default; a brand-less board (falls back to its formatted length as the display name); a board with no length (specs show volume only) — exercises the optional-field branches in the spec line and the two-column grid at sm+.",
    goal: null,
    sessions: manyBoardsSessions,
    boards: manyBoards,
    spotNotes: {},
  },
  {
    id: "board-photo",
    group: "Board rack",
    title: "Board with a photo (not renderable here)",
    caption:
      "Deliberately kept photo-less (photoId: null): board photos load from /api/blob/:id, which is owner-checked and would 401 for a synthetic id without weakening auth (not done — see CLAUDE.md “Hard rule”). Without a photo the rack falls back to a plain rounded placeholder box in its place.",
    goal: null,
    sessions: boardPhotoCaseSessions,
    boards: boardPhotoCaseBoards,
    spotNotes: {},
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

export default function DashboardPreviewPage() {
  const [width, setWidth] = useState<WidthKey>("auto");
  const activeWidth = WIDTHS.find((w) => w.key === width) ?? WIDTHS[3];
  const typicalCase = CASES.find((c) => c.id === "typical")!;
  // Pure derivation (no mutation during render) of which cases start a new
  // group heading, by comparing each case's group to the previous one.
  const showGroupHeader = CASES.map((c, i) => i === 0 || CASES[i - 1].group !== c.group);

  return (
    <div className="mx-auto w-full max-w-[1260px] px-4.5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-extrabold">Dashboard panel (dev only)</h1>
          <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
            The grey-tinted panel above the session list in <code>components/journal.tsx</code>: GoalCard, Activity
            calendar, the “What you&apos;ve surfed” table, and the board rack — synthetic data from{" "}
            <code>app/dev/fixtures.ts</code>. See the top-of-file comment for which parts are no-op/logging and
            which hit the real API and will fail here.
          </p>
        </div>
        <LangSwitch />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4 py-3 text-[13px] text-foreground">
          <strong>Widths only emulate the component&apos;s own box.</strong> The goal/calendar pairing is a{" "}
          <code>sm:</code> flex breakpoint (real viewport media query, not this frame&apos;s width) — it switches to
          side by side once the actual browser window is 640px or wider, regardless of how narrow this frame is
          drawn. The 375px frame below will still show them paired unless the browser window itself is under 640px.
        </div>
        <div className="rounded-[var(--r-tile)] bg-secondary px-4 py-3 text-[13px] text-foreground">
          <strong>Editing here doesn&apos;t persist.</strong> GoalCard&apos;s and the spot table&apos;s inline edits
          call a no-op handler (logs to the console, then closes the editor as if it saved) — nothing is written
          anywhere. The board rack is different: add/edit/delete/set-default call the real{" "}
          <code>/api/boards/*</code> routes directly (no callback prop for that), and will error outside a
          signed-in session.
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-sans text-[15px] font-bold">Widths, side by side</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The “typical” case at all three reference widths (see the note above about the <code>lg:</code> split).
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {WIDTHS.filter((w) => w.px != null).map((w) => (
            <div key={w.key}>
              <div className="mb-1 font-mono text-xs text-muted-foreground">{w.label}</div>
              <Frame px={w.px}>
                <DashboardPanel
                  goal={typicalCase.goal}
                  sessions={typicalCase.sessions}
                  boards={typicalCase.boards}
                  spotNotes={typicalCase.spotNotes}
                />
              </Frame>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-sans text-[15px] font-bold">No AI app connected yet</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The “typical” case with the card linking to /ai-apps beside the calendar, at this window&apos;s real width
          (its layout switches on <code>sm:</code> and <code>lg:</code>, which frames can&apos;t emulate).
        </p>
        <div className="mt-3">
          <DashboardPanel
            goal={typicalCase.goal}
            sessions={typicalCase.sessions}
            boards={typicalCase.boards}
            spotNotes={typicalCase.spotNotes}
            aiCard
          />
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
          {CASES.map((c, i) => {
            return (
              <div key={c.id}>
                {showGroupHeader[i] && (
                  <h3 className="mb-3 border-b border-border pb-1 font-sans text-[13px] font-bold tracking-wide text-muted-foreground uppercase">
                    {c.group}
                  </h3>
                )}
                <div className="mb-1.5">
                  <span className="font-sans text-[14px] font-bold">{c.title}</span>
                  <p className="mt-0.5 max-w-[75ch] text-[12.5px] text-muted-foreground">{c.caption}</p>
                </div>
                <Frame px={activeWidth.px}>
                  <DashboardPanel goal={c.goal} sessions={c.sessions} boards={c.boards} spotNotes={c.spotNotes} />
                </Frame>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
