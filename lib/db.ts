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
import { applyGoalRenames, type GoalRename } from "./goal";
import { getSupabase } from "./supabase";
import { NO_BOARD, type SessionFilter } from "./session-filter";
import { toStat, type SessionStat } from "./session-stats";
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
  rating?: number | null; // column kept; the rating feature was removed 2026-09-29, never read
  board_id?: string | null; // added by 20260925000000_create_boards_table.sql
  goal_text?: string | null; // added by 20260928000000_create_goals.sql
  goal_met?: boolean | null;
  goal_points_met?: boolean[] | null; // added by 20260929000000_add_goal_points_met.sql
  duration_min?: number | null; // added by 20261021000000_add_session_duration.sql
  tags?: string[] | null; // added by 20261023000000_add_session_tags.sql
  created_at: string;
  example: boolean | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    ownerId: row.owner_id,
    spot: row.spot,
    when: row.session_when,
    ...(row.duration_min != null ? { durationMin: row.duration_min } : {}),
    ...(row.tags?.length ? { tags: row.tags } : {}),
    notesHtml: row.notes_html,
    notes: row.notes,
    photos: row.photos ?? [],
    cond: row.cond ?? null,
    condOpenMeteo: row.cond_open_meteo ?? null,
    condCwaTide: row.cond_cwa_tide ?? null,
    boardId: row.board_id ?? null,
    goalText: row.goal_text ?? null,
    goalMet: row.goal_met ?? null,
    goalPointsMet: row.goal_points_met ?? null,
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
  // not set when null, so an insert without a duration never names the column
  if (session.durationMin != null) row.duration_min = session.durationMin;
  // an insert without tags never names the column (the service omits an empty list)
  if (session.tags !== undefined) row.tags = session.tags;
  if (session.notesHtml !== undefined) row.notes_html = session.notesHtml;
  if (session.notes !== undefined) row.notes = session.notes;
  if (session.photos !== undefined) row.photos = session.photos;
  if (session.cond !== undefined) row.cond = session.cond;
  if (session.condOpenMeteo !== undefined) row.cond_open_meteo = session.condOpenMeteo;
  if (session.condCwaTide !== undefined) row.cond_cwa_tide = session.condCwaTide;
  if (session.boardId !== undefined) row.board_id = session.boardId;
  if (session.goalText !== undefined) row.goal_text = session.goalText;
  if (session.goalMet !== undefined) row.goal_met = session.goalMet;
  if (session.goalPointsMet !== undefined) row.goal_points_met = session.goalPointsMet;
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
    .order("session_when", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  const rows = assertNoError(result) as SessionRow[];
  return rows.map(rowToSession);
}

/** An owner's sessions at one spot, newest first (the spot page's history).
 *  `*` rather than a column list: `duration_min` is missing until its
 *  migration is applied, and naming it would fail the query. */
export async function listSessionsAtSpot(ownerId: string, spot: string): Promise<Session[]> {
  const result = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .eq("spot", spot)
    .order("session_when", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  const rows = assertNoError(result) as SessionRow[];
  return rows.map(rowToSession);
}

/** One page of an owner's sessions (optionally filtered), newest first, in the
 *  same order as `compareSessions` (lib/session-stats.ts). `page` is 1-based;
 *  callers clamp it against `countSessions` for the same filter first (an
 *  out-of-range `range()` is an error). */
export async function listSessionsPage(
  ownerId: string,
  page: number,
  pageSize: number,
  filter: SessionFilter = {}
): Promise<Session[]> {
  const from = (page - 1) * pageSize;
  let query = getSupabase().from(TABLE).select("*").eq("owner_id", ownerId);
  // `session_when` is text ("YYYY-MM-DDTHH:mm"), so a bare day compares correctly:
  // "2026-09-01" sorts before every time on that day, "…T23:59" after them all.
  if (filter.spot) query = query.eq("spot", filter.spot);
  if (filter.board === NO_BOARD) query = query.is("board_id", null);
  else if (filter.board) query = query.eq("board_id", filter.board);
  if (filter.tags?.length) query = query.overlaps("tags", filter.tags);
  if (filter.from) query = query.gte("session_when", filter.from);
  if (filter.to) query = query.lte("session_when", `${filter.to}T23:59`);
  const result = await query
    .order("session_when", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  const rows = assertNoError(result) as SessionRow[];
  return rows.map(rowToSession);
}

/** How many sessions an owner has that match `filter` (no rows transferred). */
export async function countSessions(ownerId: string, filter: SessionFilter = {}): Promise<number> {
  let query = getSupabase().from(TABLE).select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
  if (filter.spot) query = query.eq("spot", filter.spot);
  if (filter.board === NO_BOARD) query = query.is("board_id", null);
  else if (filter.board) query = query.eq("board_id", filter.board);
  if (filter.tags?.length) query = query.overlaps("tags", filter.tags);
  if (filter.from) query = query.gte("session_when", filter.from);
  if (filter.to) query = query.lte("session_when", `${filter.to}T23:59`);
  const result = await query;
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
  return result.count ?? 0;
}

const STAT_COLUMNS = "id, spot, session_when, board_id, goal_text, goal_met, goal_points_met, created_at";

/** Every session as a slim row (see SessionStat), newest first. The one query
 *  that touches all of an owner's sessions; it leaves out notes, photos and
 *  the condition blocks, which are most of each row's weight. Reads `tags`
 *  too, but falls back to the columns without it when the tags migration
 *  (20261023000000) hasn't been applied to this database yet, so the
 *  dashboard still loads. */
export async function listSessionStats(ownerId: string): Promise<SessionStat[]> {
  const query = (columns: string) =>
    getSupabase()
      .from(TABLE)
      .select(columns)
      .eq("owner_id", ownerId)
      .order("session_when", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
  let result = await query(`${STAT_COLUMNS}, tags`);
  if (result.error && result.error.message.includes("tags")) result = await query(STAT_COLUMNS);
  const rows = assertNoError(result) as unknown as Pick<
    SessionRow,
    "id" | "spot" | "session_when" | "board_id" | "tags" | "goal_text" | "goal_met" | "goal_points_met" | "created_at"
  >[];
  return rows.map((row) =>
    toStat({
      id: row.id,
      spot: row.spot,
      when: row.session_when,
      boardId: row.board_id ?? null,
      ...(row.tags?.length ? { tags: row.tags } : {}),
      goalText: row.goal_text ?? null,
      goalMet: row.goal_met ?? null,
      goalPointsMet: row.goal_points_met ?? null,
      createdAt: row.created_at,
    } as Session)
  );
}

/** Every owner's sessions logged at one spot value. Only for spot-request
 *  approval (app/api/spots, app/api/spot-requests), which re-points sessions
 *  from `req:<id>` to the approved spot — never expose the result to users. */
export async function listSessionsBySpot(spot: string): Promise<Session[]> {
  const result = await getSupabase().from(TABLE).select("*").eq("spot", spot);
  return (assertNoError(result) as SessionRow[]).map(rowToSession);
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
/** Moves every owner's spot description from one spot value to another
 *  (request approval). A conflict with a note the owner already has at the
 *  target is swallowed: the old note simply stays where it was. */
export async function moveSpotNotes(from: string, to: string): Promise<void> {
  const { error } = await getSupabase().from(SPOT_NOTES).update({ spot: to }).eq("spot", from);
  if (error && error.code !== "23505") throw new Error(`Supabase: ${error.message}`);
}

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

const GOALS = "goals";

/** The owner's current "goal for next session", or null. */
/** Strips a tag (matched ignoring case) from every one of the owner's sessions.
 *  Returns how many sessions carried it. Sessions are updated one by one, each
 *  scoped to the owner, so a failure part-way leaves the rest for a retry. */
export async function removeTagEverywhere(ownerId: string, tag: string): Promise<number> {
  const result = await getSupabase().from(TABLE).select("id, tags").eq("owner_id", ownerId).not("tags", "is", null);
  const rows = assertNoError(result) as { id: string; tags: string[] }[];
  const lower = tag.toLowerCase();
  const hits = rows.filter((r) => r.tags.some((t) => t.toLowerCase() === lower));
  await Promise.all(
    hits.map(async (r) => {
      const update = await getSupabase()
        .from(TABLE)
        .update({ tags: r.tags.filter((t) => t.toLowerCase() !== lower) })
        .eq("id", r.id)
        .eq("owner_id", ownerId);
      assertNoError(update);
    })
  );
  return hits.length;
}

export async function getGoal(ownerId: string): Promise<string | null> {
  const result = await getSupabase().from(GOALS).select("text").eq("owner_id", ownerId).maybeSingle();
  const row = assertNoError(result) as { text: string } | null;
  return row?.text ?? null;
}

/** Upserts the owner's goal; an empty string deletes it. */
export async function setGoal(ownerId: string, text: string): Promise<void> {
  const table = getSupabase().from(GOALS);
  const result = text
    ? await table.upsert(
        { owner_id: ownerId, text, updated_at: new Date().toISOString() },
        { onConflict: "owner_id" }
      )
    : await table.delete().eq("owner_id", ownerId);
  if (result.error) throw new Error(`Supabase: ${result.error.message}`);
}

/** Carries reworded goal points into the owner's past session snapshots.
 *  Returns the sessions whose goal text changed. */
export async function renameGoalPointsInSessions(
  ownerId: string,
  renames: GoalRename[]
): Promise<{ id: string; goalText: string }[]> {
  if (!renames.length) return [];
  const result = await getSupabase()
    .from(TABLE)
    .select("id, goal_text")
    .eq("owner_id", ownerId)
    .not("goal_text", "is", null);
  const rows = assertNoError(result) as { id: string; goal_text: string }[];
  const changed = rows.flatMap((r) => {
    const next = applyGoalRenames(r.goal_text, renames);
    return next ? [{ id: r.id, goalText: next }] : [];
  });
  for (const c of changed) {
    const res = await getSupabase()
      .from(TABLE)
      .update({ goal_text: c.goalText })
      .eq("id", c.id)
      .eq("owner_id", ownerId);
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  }
  return changed;
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
  is_favorite?: boolean; // added by 20260930000000_add_board_favorite.sql
  sort_order: number | null; // added by 20260930100000_add_board_sort_order.sql
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
    isFavorite: row.is_favorite ?? false,
    sortOrder: row.sort_order ?? null,
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
  if (board.isFavorite !== undefined) row.is_favorite = board.isFavorite;
  if (board.sortOrder !== undefined) row.sort_order = board.sortOrder;
  if (board.createdAt !== undefined) row.created_at = board.createdAt;
  if (board.updatedAt !== undefined) row.updated_at = board.updatedAt;
  return row;
}

/** The owner's boards in rack order — sort_order (drag-and-drop, added
 *  2026-09-30), falling back to created_at for the rare null (a row from
 *  before the backfill, or a race with createBoard's own read-then-write).
 *  Favourites-first grouping is NOT done here — see sortBoards() in
 *  lib/boards.ts, which both the rack and the board picker call on top of
 *  this. */
export async function listBoards(ownerId: string): Promise<Board[]> {
  const result = await getSupabase()
    .from(BOARDS)
    .select("*")
    .eq("owner_id", ownerId)
    .order("sort_order", { ascending: true, nullsFirst: false })
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

/** Inserts at the end of the owner's rack, ignoring any sortOrder on
 *  `board` — a new board is never 常用 (see Board.isFavorite), so "end of
 *  the rack" and "end of its group" are the same thing: one more than the
 *  owner's current max. */
export async function createBoard(board: Board): Promise<Board> {
  const maxResult = await getSupabase()
    .from(BOARDS)
    .select("sort_order")
    .eq("owner_id", board.ownerId)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const maxRow = assertNoError(maxResult) as { sort_order: number | null } | null;
  const sortOrder = (maxRow?.sort_order ?? 0) + 1;

  const result = await getSupabase()
    .from(BOARDS)
    .insert(boardToRow({ ...board, sortOrder }))
    .select()
    .single();
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

/** Mark or unmark a board as 常用 / go-to. Any number per owner. One round
 *  trip: the owner_id filter is the ownership check — someone else's (or a
 *  missing) board matches no row and comes back null, which the route turns
 *  into a 404. Returns the updated board. */
export async function setBoardFavorite(ownerId: string, id: string, favorite: boolean): Promise<Board | null> {
  const result = await getSupabase()
    .from(BOARDS)
    .update({ is_favorite: favorite })
    .eq("id", id)
    .eq("owner_id", ownerId)
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

/** Drag-and-drop reorder (added 2026-09-30): writes each board's sort_order
 *  to its index in `ids`, the owner's full new rack order, then returns the
 *  freshly ordered rack. `ids` is a flat sequence spanning both 常用 and
 *  regular boards — see the sort_order comment on the Board type — so this
 *  doesn't need to know about favourites at all. The `owner_id` filter on
 *  every update is a second ownership check on top of the route's; a
 *  foreign id just updates zero rows instead of someone else's board.
 *  Callers must still have checked every id belongs to `ownerId` first, so
 *  a typo'd/missing id can't silently drop a board out of the rack. */
export async function reorderBoards(ownerId: string, ids: string[]): Promise<Board[]> {
  await Promise.all(
    ids.map(async (id, index) => {
      assertNoError(
        await getSupabase().from(BOARDS).update({ sort_order: index }).eq("id", id).eq("owner_id", ownerId)
      );
    })
  );
  return listBoards(ownerId);
}

export function newSessionId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  ).slice(0, 20);
}
