/**
 * Spot edit suggestions — Supabase table `spot_edit_requests`
 * (supabase/migrations/20261008100000_create_spot_edit_requests.sql).
 * Any signed-in user can propose a change to an existing spot; the spot admin
 * approves (lib/spot-edit-approval.ts applies it) or declines. A user sees
 * only their own, without the requester snapshot; the snapshot (name, email)
 * is admin-only. Server-side only.
 *
 * Fails soft: until the migration is applied, reads for pages return empty
 * (`listPendingForPage` etc.) and writes throw `EditTableMissingError`, which
 * the routes turn into a clear 503.
 */
import { getSupabase } from "./supabase";
import { isMissingTable } from "./spot-store";
import { readChanges, type SpotChanges } from "./spot-edit";

const TABLE = "spot_edit_requests";
export const MIGRATION = "supabase/migrations/20261008100000_create_spot_edit_requests.sql";

export type EditStatus = "pending" | "approved" | "declined";

export interface EditRequestRow {
  id: string;
  spot_slug: string;
  requester_id: string;
  requester_name: string | null;
  requester_email: string | null;
  changes: unknown;
  base: unknown;
  note: string | null;
  status: EditStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

/** What a user gets back about their own suggestion. */
export interface OwnEditRequest {
  id: string;
  spotSlug: string;
  changes: SpotChanges;
  note: string | null;
  status: EditStatus;
  createdAt: string;
}

/** What the admin gets: the above plus who sent it and what the spot held. */
export interface AdminEditRequest extends OwnEditRequest {
  base: SpotChanges;
  requesterName: string | null;
  requesterEmail: string | null;
  decidedAt: string | null;
}

export class EditTableMissingError extends Error {
  constructor() {
    super(`The \`${TABLE}\` table doesn't exist yet — apply ${MIGRATION} first.`);
    this.name = "EditTableMissingError";
  }
}

export const toOwn = (r: EditRequestRow): OwnEditRequest => ({
  id: r.id,
  spotSlug: r.spot_slug,
  changes: readChanges(r.changes),
  note: r.note,
  status: r.status,
  createdAt: r.created_at,
});

export const toAdmin = (r: EditRequestRow): AdminEditRequest => ({
  ...toOwn(r),
  base: readChanges(r.base),
  requesterName: r.requester_name,
  requesterEmail: r.requester_email,
  decidedAt: r.decided_at,
});

function fail(e: { code?: string; message: string }): Error {
  return isMissingTable(e) ? new EditTableMissingError() : new Error(`Supabase: ${e.message}`);
}

/** The caller's own pending suggestions. */
export async function listOwnPending(requesterId: string, spotSlug?: string): Promise<EditRequestRow[]> {
  let q = getSupabase().from(TABLE).select("*").eq("requester_id", requesterId).eq("status", "pending");
  if (spotSlug) q = q.eq("spot_slug", spotSlug);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw fail(error);
  return (data ?? []) as EditRequestRow[];
}

/** Admin: every suggestion, pending first then newest. */
export async function listAllEditRequests(): Promise<EditRequestRow[]> {
  const { data, error } = await getSupabase().from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) throw fail(error);
  const rows = (data ?? []) as EditRequestRow[];
  return [...rows.filter((r) => r.status === "pending"), ...rows.filter((r) => r.status !== "pending")];
}

export async function getEditRequest(id: string): Promise<EditRequestRow | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw fail(error);
  return (data as EditRequestRow | null) ?? null;
}

export async function countPending(): Promise<number> {
  const { count, error } = await getSupabase()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw fail(error);
  return count ?? 0;
}

export type NewEditRequest = Pick<
  EditRequestRow,
  "spot_slug" | "requester_id" | "requester_name" | "requester_email" | "note"
> & { changes: SpotChanges; base: SpotChanges };

/** One pending suggestion per user per spot: a second one replaces the first
 *  (new changes, note and date). The partial unique index makes a racing
 *  double submit land in the update branch instead of creating two. */
export async function upsertPending(row: NewEditRequest): Promise<EditRequestRow> {
  const db = getSupabase();
  const update = async (): Promise<EditRequestRow | null> => {
    const { data, error } = await db
      .from(TABLE)
      .update({
        changes: row.changes,
        base: row.base,
        note: row.note,
        requester_name: row.requester_name,
        requester_email: row.requester_email,
        created_at: new Date().toISOString(),
      })
      .eq("requester_id", row.requester_id)
      .eq("spot_slug", row.spot_slug)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) throw fail(error);
    return (data as EditRequestRow | null) ?? null;
  };
  const replaced = await update();
  if (replaced) return replaced;
  const { data, error } = await db.from(TABLE).insert(row).select("*").single();
  if (error) {
    if (error.code === "23505") {
      const again = await update();
      if (again) return again;
    }
    throw fail(error);
  }
  return data as EditRequestRow;
}

/** Only flips a still-pending suggestion, so two admins (or a double click)
 *  can't decide it twice. null = it wasn't pending / doesn't exist. */
export async function decideEditRequest(
  id: string,
  status: "approved" | "declined",
  decidedBy: string
): Promise<EditRequestRow | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ status, decided_by: decidedBy, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw fail(error);
  return (data as EditRequestRow | null) ?? null;
}

/** Withdraw: deletes the caller's own pending suggestion. false = none. */
export async function withdrawPending(id: string, requesterId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("requester_id", requesterId)
    .eq("status", "pending")
    .select("id");
  if (error) throw fail(error);
  return (data?.length ?? 0) > 0;
}

/** For server-rendered pages: never lets a missing table (or any read
 *  failure) take the page down. Logs, returns the fallback. */
export async function softly<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (e) {
    if (e instanceof EditTableMissingError) console.info("[spot-edit] table missing — migration pending, showing none");
    else console.error("[spot-edit] read failed", e);
    return fallback;
  }
}

/** The number on the avatar menu's "Admin page" badge: pending new-spot
 *  requests plus pending edit suggestions. A missing edit table counts as 0. */
export async function pendingAdminWork(pendingSpotRequests: number): Promise<number> {
  return pendingSpotRequests + (await softly(countPending, 0));
}
