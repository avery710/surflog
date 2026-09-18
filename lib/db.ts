/**
 * Storage for sessions — Supabase Postgres (table `sessions`, schema in
 * supabase/migrations/). Replaces the old data/sessions.json file (removed
 * 2026-09-18); every call site elsewhere in the app is unchanged, since the
 * exported functions here kept their exact same signatures.
 *
 * Always goes through lib/supabase.ts's service-role client, server-side
 * only (API routes / server components) — never import this from a client
 * component. RLS is enabled on the table with no policies, so this key is
 * what makes any access possible at all; ownership scoping happens in this
 * file and in the API routes that call it, not in Postgres.
 *
 * Multi-user (2026-09-18): every session is scoped by `ownerId` (a Google
 * account's stable subject id — see auth.ts). The 3 real sessions that
 * predate login all carry the placeholder owner "legacy" — see
 * `claimLegacySessions` below for how those get adopted by whoever actually
 * owns them (Capy) without handing them to whichever friend happens to sign
 * in first.
 */
import { getSupabase } from "./supabase";
import type { Session } from "./types";

const LEGACY_OWNER = "legacy";
const TABLE = "sessions";

/** DB row shape — see supabase/migrations/*_create_sessions_table.sql. */
interface SessionRow {
  id: string;
  owner_id: string;
  spot: string;
  session_when: string;
  notes_html: string;
  notes: string;
  photos: Session["photos"];
  cond: Session["cond"];
  cond_open_meteo: Session["condOpenMeteo"];
  rating: number | null;
  created_at: string;
  example: boolean | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    ownerId: row.owner_id,
    spot: row.spot,
    when: row.session_when,
    notesHtml: row.notes_html,
    notes: row.notes,
    photos: row.photos ?? [],
    cond: row.cond ?? null,
    condOpenMeteo: row.cond_open_meteo ?? null,
    rating: row.rating,
    createdAt: row.created_at,
    ...(row.example ? { example: true as const } : {}),
  };
}

/** Only the columns present in `session` get set — used for both insert and
 *  partial update, so callers never have to know the DB's column names. */
function sessionToRow(session: Partial<Session>): Partial<SessionRow> {
  const row: Partial<SessionRow> = {};
  if (session.id !== undefined) row.id = session.id;
  if (session.ownerId !== undefined) row.owner_id = session.ownerId;
  if (session.spot !== undefined) row.spot = session.spot;
  if (session.when !== undefined) row.session_when = session.when;
  if (session.notesHtml !== undefined) row.notes_html = session.notesHtml;
  if (session.notes !== undefined) row.notes = session.notes;
  if (session.photos !== undefined) row.photos = session.photos;
  if (session.cond !== undefined) row.cond = session.cond;
  if (session.condOpenMeteo !== undefined) row.cond_open_meteo = session.condOpenMeteo;
  if (session.rating !== undefined) row.rating = session.rating;
  if (session.createdAt !== undefined) row.created_at = session.createdAt;
  if (session.example !== undefined) row.example = session.example ?? null;
  return row;
}

function assertNoError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
  return result.data;
}

/**
 * One-time adoption of the pre-login journal entries. Gated on the signed-in
 * user's email matching LEGACY_OWNER_EMAIL (set in .env — see README), so
 * ownership only ever transfers to whoever the deployment's owner actually
 * is, never to whichever friend happens to sign in first. Once claimed, the
 * env var stops mattering — the rows just belong to that account now.
 */
async function claimLegacySessions(ownerId: string, email: string | null | undefined): Promise<void> {
  const legacyOwnerEmail = process.env.LEGACY_OWNER_EMAIL;
  if (!legacyOwnerEmail || !email || email.toLowerCase() !== legacyOwnerEmail.toLowerCase()) return;

  const result = await getSupabase()
    .from(TABLE)
    .update({ owner_id: ownerId })
    .eq("owner_id", LEGACY_OWNER);
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
}

export async function listSessions(ownerId: string, email?: string | null): Promise<Session[]> {
  await claimLegacySessions(ownerId, email);

  const result = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .order("session_when", { ascending: false });
  const rows = assertNoError(result) as SessionRow[];
  return rows.map(rowToSession);
}

/** Unscoped lookup — callers (API routes) must check `.ownerId` themselves. */
export async function getSession(id: string): Promise<Session | null> {
  const result = await getSupabase().from(TABLE).select("*").eq("id", id).maybeSingle();
  const row = assertNoError(result) as SessionRow | null;
  return row ? rowToSession(row) : null;
}

export async function createSession(session: Session): Promise<Session> {
  const result = await getSupabase()
    .from(TABLE)
    .insert(sessionToRow(session))
    .select()
    .single();
  return rowToSession(assertNoError(result) as SessionRow);
}

export async function updateSession(
  id: string,
  patch: Partial<Session>
): Promise<Session | null> {
  const result = await getSupabase()
    .from(TABLE)
    .update(sessionToRow(patch))
    .eq("id", id)
    .select()
    .maybeSingle();
  const row = assertNoError(result) as SessionRow | null;
  return row ? rowToSession(row) : null;
}

export async function deleteSession(id: string): Promise<boolean> {
  const result = await getSupabase().from(TABLE).delete().eq("id", id).select("id");
  const rows = assertNoError(result) as { id: string }[];
  return rows.length > 0;
}

export function newSessionId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  ).slice(0, 20);
}
