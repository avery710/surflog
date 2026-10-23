import type { SessionStat } from "./session-stats";
import { normalizeTags } from "./tags";

/**
 * The homepage's session filter: a spot, a board, tags, a date range. All
 * optional, all ANDed (the tags among themselves are "any of"). Applied by the database on `GET /api/sessions` (so the paging
 * and infinite scroll work on the filtered list) and, with `matchesFilter`,
 * on the slim all-sessions list for counts and for placing a new session.
 */
export interface SessionFilter {
  /** A `spots.slug` (or `req:<id>`). */
  spot?: string;
  /** A board id, or `NO_BOARD` for sessions logged without one. */
  board?: string;
  /** Stored tags (lib/tags.ts); a session passes if it has ANY of them. */
  tags?: string[];
  /** "YYYY-MM-DD", inclusive. */
  from?: string;
  /** "YYYY-MM-DD", inclusive. */
  to?: string;
}

/** `board=none`: sessions with no board. (Board ids are UUIDs, so no clash.) */
export const NO_BOARD = "none";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BOARD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SPOT = 200;

/** A filter from query params; anything malformed is ignored, not an error. */
export function parseFilter(params: URLSearchParams): SessionFilter {
  const filter: SessionFilter = {};
  const spot = params.get("spot");
  if (spot && spot.length <= MAX_SPOT) filter.spot = spot;
  const board = params.get("board");
  if (board && BOARD_ID.test(board)) filter.board = board;
  // `tag` repeats once per tag (tags may contain commas); invalid lists are ignored
  const tags = normalizeTags(params.getAll("tag"));
  if (tags?.length) filter.tags = tags;
  const from = params.get("from");
  if (from && DAY.test(from)) filter.from = from;
  const to = params.get("to");
  if (to && DAY.test(to)) filter.to = to;
  return filter;
}

/** The query params for a filter (empty fields left out). */
export function filterToParams(filter: SessionFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.spot) params.set("spot", filter.spot);
  if (filter.board) params.set("board", filter.board);
  for (const tag of filter.tags ?? []) params.append("tag", tag);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  return params;
}

/** How many of the filter's fields are set (the tags count as one). */
export function activeFilterCount(filter: SessionFilter): number {
  return [filter.spot, filter.board, filter.tags?.length, filter.from, filter.to].filter(Boolean).length;
}

/** The same test the database applies, for rows already in memory. */
export function matchesFilter(s: Pick<SessionStat, "spot" | "boardId" | "when" | "tags">, filter: SessionFilter): boolean {
  if (filter.spot && s.spot !== filter.spot) return false;
  if (filter.tags?.length && !filter.tags.some((t) => s.tags?.includes(t))) return false;
  if (filter.board === NO_BOARD ? s.boardId : filter.board && s.boardId !== filter.board) return false;
  const day = (s.when || "").slice(0, 10);
  if (filter.from && day < filter.from) return false;
  if (filter.to && day > filter.to) return false;
  return true;
}

/** "YYYY-MM-DD" shifted by whole days (plain calendar arithmetic, no time zone involved). */
export function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type DatePresetId = "all" | "last3" | "lastWeek" | "last30" | "last90" | "year";

/**
 * The quick date ranges in the filter's Date chip, relative to `today`
 * ("YYYY-MM-DD"). Open-ended on purpose: "last 30 days" is just `from`, so a
 * session logged for today never falls outside it.
 */
export function datePresets(today: string): { id: DatePresetId; range: Pick<SessionFilter, "from" | "to"> }[] {
  return [
    { id: "all", range: {} },
    { id: "last3", range: { from: shiftDay(today, -3) } },
    { id: "lastWeek", range: { from: shiftDay(today, -7) } },
    { id: "last30", range: { from: shiftDay(today, -30) } },
    { id: "last90", range: { from: shiftDay(today, -90) } },
    { id: "year", range: { from: `${today.slice(0, 4)}-01-01` } },
  ];
}

/** Which preset the filter's date range is exactly, or "custom" for any other range. */
export function datePresetOf(filter: Pick<SessionFilter, "from" | "to">, today: string): DatePresetId | "custom" {
  const hit = datePresets(today).find(
    (p) => (p.range.from ?? "") === (filter.from ?? "") && (p.range.to ?? "") === (filter.to ?? "")
  );
  return hit?.id ?? "custom";
}
