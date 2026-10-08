/**
 * Spot reviews — the parts safe for the browser: shapes, input validation and
 * the per-spot summary. Database access is in lib/spot-reviews.ts.
 */

export const MAX_REVIEW_BODY = 1000;

/** What any signed-in user sees of a review. `mine` marks the viewer's own. */
export interface PublicReview {
  id: string;
  authorName: string | null;
  rating: number;
  body: string | null;
  updatedAt: string;
  mine: boolean;
}

/** Average and count per spot, for the /spots rows. */
export interface ReviewSummary {
  average: number;
  count: number;
}

/** Validates a review body from the client. */
export function readReviewInput(
  input: unknown
): { ok: true; rating: number; body: string | null } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "invalid JSON body" };
  const { rating, body } = input as { rating?: unknown; body?: unknown };
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "rating must be a whole number from 1 to 5" };
  }
  if (body != null && typeof body !== "string") return { ok: false, error: "body must be text" };
  // Strip control characters except newlines/tabs; collapse runs of blank lines.
  const text = (body ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if ([...text].length > MAX_REVIEW_BODY) return { ok: false, error: `body must be up to ${MAX_REVIEW_BODY} characters` };
  return { ok: true, rating, body: text || null };
}

/** Average (1 decimal) and count per spot slug. */
export function summarize(rows: { spot_slug: string; rating: number }[]): Record<string, ReviewSummary> {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const a = acc.get(r.spot_slug) ?? { sum: 0, count: 0 };
    a.sum += r.rating;
    a.count += 1;
    acc.set(r.spot_slug, a);
  }
  const out: Record<string, ReviewSummary> = {};
  for (const [slug, { sum, count }] of acc) out[slug] = { average: Math.round((sum / count) * 10) / 10, count };
  return out;
}
