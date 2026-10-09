/**
 * Spot reviews — Supabase table `spot_reviews`
 * (supabase/migrations/20261008200000_create_spot_reviews.sql).
 * Any signed-in user rates a spot 1-5 with an optional comment; one review per
 * user per spot. Unlike everything per-owner, reviews are read by every
 * signed-in user — but only as `PublicReview`: author display name, never the
 * owner id or email. Server-side only; the browser-safe parts are in
 * lib/spot-review.ts.
 *
 * Fails soft like spot-edit-requests: until the migration is applied, page
 * reads return empty and writes throw `ReviewTableMissingError` (→ 503).
 */
import { getSupabase } from "./supabase";
import { isMissingTable } from "./spot-store";
import { cleanImage } from "./share-public";
import { summarize, type PublicReview, type ReviewSummary } from "./spot-review";

export { MAX_REVIEW_BODY, readReviewInput, summarize, type PublicReview, type ReviewSummary } from "./spot-review";

const TABLE = "spot_reviews";
export const MIGRATION = "supabase/migrations/20261008200000_create_spot_reviews.sql";

export interface ReviewRow {
  id: string;
  spot_slug: string;
  owner_id: string;
  author_name: string | null;
  /** Absent until migration 20261009000000 is applied. */
  author_image?: string | null;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
}

export class ReviewTableMissingError extends Error {
  constructor() {
    super(`The \`${TABLE}\` table doesn't exist yet — apply ${MIGRATION} first.`);
    this.name = "ReviewTableMissingError";
  }
}

function fail(e: { code?: string; message: string }): Error {
  return isMissingTable(e) ? new ReviewTableMissingError() : new Error(`Supabase: ${e.message}`);
}

/** Built field by field so owner_id can never leak to another user. The
 *  viewer's own review shows their current avatar (`viewerImage`) even if it
 *  was saved before avatars were stored. */
export const toPublic = (r: ReviewRow, viewerId: string, viewerImage?: string | null): PublicReview => {
  const mine = r.owner_id === viewerId;
  return {
    id: r.id,
    authorName: r.author_name,
    authorImage: cleanImage(r.author_image) ?? (mine ? cleanImage(viewerImage) : null),
    rating: r.rating,
    body: r.body,
    updatedAt: r.updated_at,
    mine,
  };
};

/** Every review of one spot, newest first. */
export async function listSpotReviews(spotSlug: string): Promise<ReviewRow[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("spot_slug", spotSlug)
    .order("updated_at", { ascending: false });
  if (error) throw fail(error);
  return (data ?? []) as ReviewRow[];
}

/** Summaries for the whole catalogue (only slug + rating are read). */
export async function listReviewSummaries(): Promise<Record<string, ReviewSummary>> {
  const { data, error } = await getSupabase().from(TABLE).select("spot_slug, rating");
  if (error) throw fail(error);
  return summarize((data ?? []) as { spot_slug: string; rating: number }[]);
}

/** Creates or replaces the caller's review of a spot. */
export async function upsertReview(row: {
  spot_slug: string;
  owner_id: string;
  author_name: string | null;
  author_image: string | null;
  rating: number;
  body: string | null;
}): Promise<ReviewRow> {
  const write = (values: Record<string, unknown>) =>
    getSupabase()
      .from(TABLE)
      .upsert({ ...values, updated_at: new Date().toISOString() }, { onConflict: "owner_id,spot_slug" })
      .select("*")
      .single();
  let { data, error } = await write({ ...row, author_image: cleanImage(row.author_image) });
  // Before the author_image migration: save without the avatar rather than fail.
  if (error && /author_image/.test(error.message)) {
    const { author_image: _skip, ...rest } = row;
    void _skip;
    ({ data, error } = await write(rest));
  }
  if (error) throw fail(error);
  return data as ReviewRow;
}

/** Deletes one review of a spot. With `ownerId` only if it is theirs; without
 *  (admin) any. false = nothing matched. */
export async function deleteReview(id: string, spotSlug: string, ownerId?: string): Promise<boolean> {
  let q = getSupabase().from(TABLE).delete().eq("id", id).eq("spot_slug", spotSlug);
  if (ownerId) q = q.eq("owner_id", ownerId);
  const { data, error } = await q.select("id");
  if (error) throw fail(error);
  return (data?.length ?? 0) > 0;
}

/** For server-rendered pages: a missing table (or any read failure) shows no
 *  ratings instead of taking the page down. */
export async function summariesSoftly(): Promise<Record<string, ReviewSummary>> {
  try {
    return await listReviewSummaries();
  } catch (e) {
    if (e instanceof ReviewTableMissingError) console.info("[spot-review] table missing — migration pending, showing none");
    else console.error("[spot-review] summaries failed", e);
    return {};
  }
}
