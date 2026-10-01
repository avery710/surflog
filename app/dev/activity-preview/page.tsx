import { ActivityCalendar } from "@/components/activity-calendar";
import { taipeiToday } from "@/lib/format";
import type { Session } from "@/lib/types";
import { fakeSession as buildFakeSession } from "@/app/dev/fixtures";

/**
 * DEV-ONLY preview — not linked from anywhere in the app, no auth, no real
 * data (every session below is synthetic, built from ../fixtures). Visit
 * /dev/entry-card locally for a fuller card showcase, or here to compare the
 * Activity block with 1/2/3/4 months of history before deciding on sizing.
 * See CLAUDE.md "Project agents" (storybook) — this whole app/dev/ folder
 * 404s in production builds and requires no sign-in locally.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** A minimal, otherwise-empty session — ActivityCalendar only reads `when`. */
function fakeSession(when: string): Session {
  return buildFakeSession({
    id: when,
    spot: "custom:Preview",
    when,
    notesHtml: "",
    notes: "",
    cond: null,
    condOpenMeteo: null,
    condCwaTide: null,
    createdAt: when,
  });
}

/** Sessions on a scattered subset of days (every 3rd) across `monthsBack`
 *  months ending at the current month — enough to see both filled and empty
 *  dots in every row, without every day being "surfed", and (at 2+ months)
 *  enough weeks of history to exercise ActivityCalendar's fixed 4-week
 *  window and its ↑/↓ scroll rail. The current month only gets days up to
 *  today, since a real journal can't have future sessions. */
function sessionsSpanning(monthsBack: number): Session[] {
  const todayStr = taipeiToday();
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const sessions: Session[] = [];
  for (let back = monthsBack - 1; back >= 0; back--) {
    let year = ty;
    let month = tm - 1 - back; // 0-based
    while (month < 0) {
      month += 12;
      year -= 1;
    }
    const isCurrentMonth = back === 0;
    const lastDay = isCurrentMonth ? td : daysInMonth(year, month);
    for (let day = 2; day <= lastDay; day += 3) {
      sessions.push(fakeSession(`${year}-${pad2(month + 1)}-${pad2(day)}T08:00`));
    }
  }
  return sessions;
}

export default function ActivityPreviewPage() {
  const variants = [1, 2, 3, 4];
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 font-sans text-2xl font-extrabold">Activity block preview (dev only)</h1>
      <p className="mb-6 max-w-prose text-sm text-muted-foreground">
        Not part of the app — synthetic session data, side by side to compare 1 / 2 / 3 / 4 months
        of history. Dev-only: 404s in production, no sign-in required locally.
      </p>
      <div className="flex flex-wrap items-start gap-8">
        {variants.map((n) => (
          <div key={n}>
            <div className="mb-2 font-sans text-xs font-bold text-muted-foreground">
              {n} month{n === 1 ? "" : "s"} of history
            </div>
            <ActivityCalendar sessions={sessionsSpanning(n)} />
          </div>
        ))}
      </div>
    </div>
  );
}
