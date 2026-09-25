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
 * account's stable subject id — see auth.ts).
 */
import { getSupabase } from "./supabase";
import type { Board, Session } from "./types";

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
  cond_cwa_tide: Session["condCwaTide"];
  rating: number | null;
  board_id?: string | null; // added by 20260925000000_create_boards_table.sql
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
    condCwaTide: row.cond_cwa_tide ?? null,
    rating: row.rating,
    boardId: row.board_id ?? null,
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
  if (session.condCwaTide !== undefined) row.cond_cwa_tide = session.condCwaTide;
  if (session.rating !== undefined) row.rating = session.rating;
  if (session.boardId !== undefined) row.board_id = session.boardId;
  if (session.createdAt !== undefined) row.created_at = session.createdAt;
  if (session.example !== undefined) row.example = session.example ?? null;
  return row;
}

function assertNoError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
  return result.data;
}

export async function listSessions(ownerId: string): Promise<Session[]> {
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

const SPOT_NOTES = "spot_notes";

/** The owner's spot descriptions, keyed by spot slug. */
export async function listSpotNotes(ownerId: string): Promise<Record<string, string>> {
  const result = await getSupabase()
    .from(SPOT_NOTES)
    .select("spot, description")
    .eq("owner_id", ownerId);
  const rows = assertNoError(result) as { spot: string; description: string }[];
  return Object.fromEntries(rows.map((r) => [r.spot, r.description]));
}

/** Upserts the owner's description for a spot; an empty string deletes it. */
export async function setSpotNote(ownerId: string, spot: string, description: string): Promise<void> {
  const table = getSupabase().from(SPOT_NOTES);
  const result = description
    ? await table.upsert(
        { owner_id: ownerId, spot, description, updated_at: new Date().toISOString() },
        { onConflict: "owner_id,spot" }
      )
    : await table.delete().eq("owner_id", ownerId).eq("spot", spot);
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
}

const BOARDS = "boards";

/** DB row shape — see supabase/migrations/*_create_boards_table.sql. */
interface BoardRow {
  id: string;
  owner_id: string;
  brand: string;
  length_in: number | string | null; // numeric: PostgREST may hand back either
  volume_l: number | string | null;
  rocker: Board["rocker"];
  note: string;
  photo_id: string | null;
  created_at: string;
  updated_at: string;
}

const numOrNull = (v: number | string | null): number | null =>
  v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;

function rowToBoard(row: BoardRow): Board {
  return {
    id: row.id,
    ownerId: row.owner_id,
    brand: row.brand ?? "",
    lengthIn: numOrNull(row.length_in),
    volumeL: numOrNull(row.volume_l),
    rocker: row.rocker ?? null,
    note: row.note ?? "",
    photoId: row.photo_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function boardToRow(board: Partial<Board>): Partial<BoardRow> {
  const row: Partial<BoardRow> = {};
  if (board.id !== undefined) row.id = board.id;
  if (board.ownerId !== undefined) row.owner_id = board.ownerId;
  if (board.brand !== undefined) row.brand = board.brand;
  if (board.lengthIn !== undefined) row.length_in = board.lengthIn;
  if (board.volumeL !== undefined) row.volume_l = board.volumeL;
  if (board.rocker !== undefined) row.rocker = board.rocker;
  if (board.note !== undefined) row.note = board.note;
  if (board.photoId !== undefined) row.photo_id = board.photoId;
  if (board.createdAt !== undefined) row.created_at = board.createdAt;
  if (board.updatedAt !== undefined) row.updated_at = board.updatedAt;
  return row;
}

/** The owner's boards, oldest first (the order they were added to the rack). */
export async function listBoards(ownerId: string): Promise<Board[]> {
  const result = await getSupabase()
    .from(BOARDS)
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  const rows = assertNoError(result) as BoardRow[];
  return rows.map(rowToBoard);
}

/** Unscoped lookup — callers (API routes) must check `.ownerId` themselves. */
export async function getBoard(id: string): Promise<Board | null> {
  const result = await getSupabase().from(BOARDS).select("*").eq("id", id).maybeSingle();
  const row = assertNoError(result) as BoardRow | null;
  return row ? rowToBoard(row) : null;
}

export async function createBoard(board: Board): Promise<Board> {
  const result = await getSupabase().from(BOARDS).insert(boardToRow(board)).select().single();
  return rowToBoard(assertNoError(result) as BoardRow);
}

export async function updateBoard(id: string, patch: Partial<Board>): Promise<Board | null> {
  const result = await getSupabase()
    .from(BOARDS)
    .update(boardToRow({ ...patch, updatedAt: new Date().toISOString() }))
    .eq("id", id)
    .select()
    .maybeSingle();
  const row = assertNoError(result) as BoardRow | null;
  return row ? rowToBoard(row) : null;
}

/** sessions.board_id is `on delete set null`, so sessions survive this. */
export async function deleteBoard(id: string): Promise<boolean> {
  const result = await getSupabase().from(BOARDS).delete().eq("id", id).select("id");
  const rows = assertNoError(result) as { id: string }[];
  return rows.length > 0;
}

export function newSessionId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  ).slice(0, 20);
}
