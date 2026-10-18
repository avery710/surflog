import type { Session } from "./types";

/**
 * What the dashboard needs from EVERY session (goal-point counts, activity
 * calendar, "What you've surfed", the log form's recent spot / last board):
 * no notes, photos or condition blocks. The homepage list itself is paged
 * by the database (`listSessionsPage`); this slim list is the only thing
 * loaded in full. See CLAUDE.md "Session list pagination".
 */
export type SessionStat = Pick<
  Session,
  "id" | "when" | "spot" | "boardId" | "goalText" | "goalMet" | "goalPointsMet" | "createdAt"
>;

export function toStat(s: Session): SessionStat {
  return {
    id: s.id,
    when: s.when,
    spot: s.spot,
    boardId: s.boardId ?? null,
    goalText: s.goalText ?? null,
    goalMet: s.goalMet ?? null,
    goalPointsMet: s.goalPointsMet ?? null,
    createdAt: s.createdAt,
  };
}

/**
 * The list order, in one place: newest session first, then most recently
 * logged, then id. The database sorts the same three columns the same way
 * (lib/db.ts), so a session's index in the stats list is its row number in
 * the paged query.
 */
export function compareSessions(
  a: Pick<Session, "when" | "createdAt" | "id">,
  b: Pick<Session, "when" | "createdAt" | "id">
): number {
  return (
    (b.when || "").localeCompare(a.when || "") ||
    (b.createdAt || "").localeCompare(a.createdAt || "") ||
    a.id.localeCompare(b.id)
  );
}

/** `stats` with `stat` added (or replaced, if its id is there), in list order. */
export function upsertStat(stats: SessionStat[], stat: SessionStat): SessionStat[] {
  return [...stats.filter((x) => x.id !== stat.id), stat].sort(compareSessions);
}

/**
 * `loaded` plus `incoming`, by id (an incoming row replaces the loaded one),
 * in list order. `loaded` is always the top of the list — rows 0..n-1 — so a
 * page fetched with `pageToFetch` extends it without gaps.
 */
export function mergePage<T extends Pick<Session, "id" | "when" | "createdAt">>(loaded: T[], incoming: T[]): T[] {
  const byId = new Map(loaded.map((s) => [s.id, s]));
  for (const s of incoming) byId.set(s.id, s);
  return [...byId.values()].sort(compareSessions);
}

/**
 * A just-created session joins the loaded rows only if it ranks inside them
 * (or right after them); one dated further down the list stays unloaded and
 * arrives with its page, so the loaded rows stay a gap-free top of the list.
 * `rank` is its index in the full list.
 */
export function addToLoaded<T extends Pick<Session, "id" | "when" | "createdAt">>(
  loaded: T[],
  created: T,
  rank: number
): T[] {
  return rank <= loaded.length ? mergePage(loaded, [created]) : loaded;
}
