/**
 * Which parts of a session a share image includes (the four switches in the
 * share dialog; the spot is always shown, so it has none). Pure, so the dialog, the image routes and the builder agree.
 * Wire format: `parts=datetime,waves,board,log`; absent = all.
 */
export const SHARE_PARTS = ["datetime", "waves", "board", "log"] as const;
export type SharePart = (typeof SHARE_PARTS)[number];
export type ShareParts = Record<SharePart, boolean>;

export const ALL_PARTS: ShareParts = { datetime: true, waves: true, board: true, log: true };

export function parseShareParts(q: string | null | undefined): ShareParts {
  if (q == null) return { ...ALL_PARTS };
  const on = new Set(q.split(",").map((s) => s.trim()));
  return {
    // the short-lived merged "details" value switches both on
    datetime: on.has("datetime") || on.has("details"),
    waves: on.has("waves") || on.has("details"),
    board: on.has("board"),
    log: on.has("log"),
  };
}

export function serializeShareParts(p: ShareParts): string {
  return SHARE_PARTS.filter((k) => p[k]).join(",");
}

export const noParts = (p: ShareParts) => !SHARE_PARTS.some((k) => p[k]);
