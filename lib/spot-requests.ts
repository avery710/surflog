/**
 * Spot requests — Supabase table `spot_requests`
 * (supabase/migrations/20261005000200_create_spot_requests_table.sql).
 * Any signed-in user can ask for a spot to be added; the admin approves
 * (creating the spot, see lib/spot-approval.ts) or declines. A user sees
 * only their own requests; the requester's display name/email snapshot is
 * for the admin's eyes only and is stripped from everything a non-admin gets.
 * Server-side only.
 */
import { getSupabase } from "./supabase";
import { isMissingTable } from "./spot-store";

const TABLE = "spot_requests";

export type SpotRequestStatus = "pending" | "approved" | "declined";

export interface SpotRequestRow {
  id: string;
  owner_id: string;
  requester_name: string | null;
  requester_email: string | null;
  name: string;
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  status: SpotRequestStatus;
  spot_slug: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** What the API returns. `requesterName`/`requesterEmail` only for the admin. */
export interface SpotRequest {
  id: string;
  name: string;
  locationText: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  status: SpotRequestStatus;
  spotSlug: string | null;
  createdAt: string;
  resolvedAt: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
}

export function rowToRequest(row: SpotRequestRow, asAdmin: boolean): SpotRequest {
  return {
    id: row.id,
    name: row.name,
    locationText: row.location_text,
    lat: row.lat,
    lng: row.lng,
    note: row.note,
    status: row.status,
    spotSlug: row.spot_slug,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    ...(asAdmin ? { requesterName: row.requester_name, requesterEmail: row.requester_email } : {}),
  };
}

const fail = (e: { code?: string; message: string }) =>
  new Error(
    isMissingTable(e)
      ? "The `spot_requests` table doesn't exist yet — apply supabase/migrations/20261005000200_create_spot_requests_table.sql first."
      : `Supabase: ${e.message}`
  );

/** A user's own requests, newest first. */
export async function listOwnRequests(ownerId: string): Promise<SpotRequestRow[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw fail(error);
  return (data ?? []) as SpotRequestRow[];
}

/** Admin: every request, pending first then newest. */
export async function listAllRequests(): Promise<SpotRequestRow[]> {
  const { data, error } = await getSupabase().from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) throw fail(error);
  const rows = (data ?? []) as SpotRequestRow[];
  return [...rows.filter((r) => r.status === "pending"), ...rows.filter((r) => r.status !== "pending")];
}

/** Unscoped lookup — callers check ownership / admin themselves. */
export async function getRequest(id: string): Promise<SpotRequestRow | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw fail(error);
  return (data as SpotRequestRow | null) ?? null;
}

export async function createRequest(row: Omit<SpotRequestRow, "status" | "spot_slug" | "created_at" | "resolved_at">): Promise<SpotRequestRow> {
  const { data, error } = await getSupabase().from(TABLE).insert(row).select("*").single();
  if (error) throw fail(error);
  return data as SpotRequestRow;
}

/** Only flips a still-pending request, so two admins (or a double click)
 *  can't resolve it twice. null = it wasn't pending / doesn't exist. */
export async function resolveRequest(
  id: string,
  status: "approved" | "declined",
  spotSlug: string | null
): Promise<SpotRequestRow | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ status, spot_slug: spotSlug, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw fail(error);
  return (data as SpotRequestRow | null) ?? null;
}
