/**
 * Paging for the session list. The API (`GET /api/sessions?page=N`) is plain
 * page-number paging, 10 rows per page; the homepage loads page 1 on the
 * server and appends the next page as the reader scrolls (infinite scroll,
 * `lib/use-session-feed.ts`).
 */

/** Session cards per request. */
export const PAGE_SIZE = 10;

/** The most the API will return in one page, whatever `pageSize` asks for. */
export const MAX_PAGE_SIZE = 50;

/** `page` / `pageSize` query values: anything that isn't a positive whole number is 1. */
export function parsePage(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Keeps `page` inside 1..last, so `?page=99` answers with the last page. */
export function clampPage(page: number, total: number, pageSize = PAGE_SIZE): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

/**
 * Which page to ask for next, given how many rows are already loaded from
 * the top of the list. Not "last page + 1": a delete leaves 9 rows where a
 * page ended, and the next page by number would skip the row that moved up.
 * This page starts at or before the first unloaded row, so nothing is
 * skipped; rows it repeats are dropped by `mergePage`.
 */
export function pageToFetch(loaded: number, pageSize = PAGE_SIZE): number {
  return Math.floor(loaded / pageSize) + 1;
}
