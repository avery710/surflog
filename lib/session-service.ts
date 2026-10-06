/**
 * Session create / update / delete, shared by the HTTP routes
 * (app/api/sessions/**) and anything else that acts for a signed-in owner
 * (the planned MCP endpoint). Every function takes `ownerId` explicitly and
 * does the ownership checks itself, so no caller can skip them.
 *
 * Functions take the raw, untrusted body (`unknown`) and validate it here, and
 * return a result instead of an HTTP response — callers map `status` to
 * their own transport. A foreign or unknown id is always "not found" (404,
 * never 403) so ids aren't confirmed to exist.
 *
 * Server-only: pulls in Supabase and the condition fetchers.
 */
import { getSession, updateSession, deleteSession, createSession, newSessionId } from "@/lib/db";
import { deleteBlob } from "@/lib/blob";
import { resolveSpot } from "@/lib/spot-store";
import { checkRequestSpot } from "@/lib/spot-access";
import { getConditions } from "@/lib/openmeteo";
import { getTide } from "@/lib/cwa-tide";
import { resolveOwnedBoardId } from "@/lib/board-access";
import { achievedGoalFields, parseGoalAchieved } from "@/lib/goal";
import { sanitizeNotesHtml, htmlToPlainText } from "@/lib/rich-text";
import type { Cond, CondCwaTide, CondOpenMeteo, Session } from "@/lib/types";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 404; error: string };

const fail = (status: 400 | 404, error: string) => ({ ok: false as const, status, error });

const WHEN_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const COND_KEYS: (keyof Cond)[] = [
  "swellHeightM",
  "swellPeriodS",
  "swellDir",
  "windSpeedMs",
  "windGustMs",
  "windDir",
  "tideM",
  "tideNote",
  "seaTempC",
  "airTempC",
  "sky",
];

/** Create a session. Auto-fills condOpenMeteo / condCwaTide when the spot has
 *  coordinates / a tide township (best-effort: a session still saves if a
 *  source is down). `cond` stays manual-only — nothing here scrapes Swelleye. */
export async function createSessionFor(ownerId: string, input: unknown): Promise<ServiceResult<Session>> {
  if (!input || typeof input !== "object") return fail(400, "invalid JSON body");
  const body = input as Record<string, unknown>;

  const spot = typeof body.spot === "string" ? body.spot.trim() : "";
  const when = typeof body.when === "string" ? body.when.trim() : "";
  if (!spot || !WHEN_RE.test(when)) {
    return fail(400, "spot and when (YYYY-MM-DDTHH:mm) are required");
  }

  const notesHtml = sanitizeNotesHtml(typeof body.notesHtml === "string" ? body.notesHtml : "");
  const notes = htmlToPlainText(notesHtml);

  // `req:<id>` spots are the caller's own pending requests only — else 404.
  if (!(await checkRequestSpot(spot, ownerId)).ok) return fail(404, "spot not found");

  // Only ever the caller's own board — a foreign/unknown id is a 404.
  const board = await resolveOwnedBoardId(body.boardId, ownerId);
  if (!board.ok) return fail(404, "board not found");

  // The goal points ticked as achieved — optional; see lib/goal.ts.
  const achieved = body.goalAchieved === undefined ? [] : parseGoalAchieved(body.goalAchieved);
  if (!achieved) return fail(400, "invalid goalAchieved");

  let condOpenMeteo: CondOpenMeteo | null = null;
  const spotInfo = await resolveSpot(spot);
  if (spotInfo?.lat != null && spotInfo.lng != null) {
    try {
      condOpenMeteo = await getConditions(spotInfo.lat, spotInfo.lng, when, spotInfo.timezone);
    } catch {
      // best-effort — a session should still save if Open-Meteo is down
      condOpenMeteo = null;
    }
  }

  let condCwaTide: CondCwaTide | null = null;
  if (spotInfo?.tideTownship) {
    try {
      condCwaTide = await getTide(spotInfo.tideTownship, when);
    } catch {
      // best-effort — a session should still save if CWA is down
      condCwaTide = null;
    }
  }

  const newSession: Session = {
    id: newSessionId(),
    ownerId,
    spot,
    when,
    notesHtml,
    notes,
    photos: [],
    cond: null,
    condOpenMeteo,
    condCwaTide,
    // omitted (not null) when unset, so the insert has no board_id column at all
    ...(board.boardId ? { boardId: board.boardId } : {}),
    // same: omitted when nothing was ticked, so no goal_* columns in the insert
    ...(achieved.length ? achievedGoalFields(achieved) : {}),
    createdAt: new Date().toISOString(),
  };

  return { ok: true, data: await createSession(newSession) };
}

/** Partial update. Re-fetches condOpenMeteo / condCwaTide when spot or when
 *  actually changes (the readings depend on both); `refreshConditions: true`
 *  forces a refetch without changing either. */
export async function updateSessionFor(
  ownerId: string,
  id: string,
  input: unknown
): Promise<ServiceResult<Session | null>> {
  const existing = await getSession(id);
  if (!existing || existing.ownerId !== ownerId) return fail(404, "not found");

  if (!input || typeof input !== "object") return fail(400, "invalid JSON body");
  const body = input as Record<string, unknown>;

  const patch: Partial<Session> = {};

  if (typeof body.spot === "string" && body.spot.trim()) patch.spot = body.spot.trim();
  if (typeof body.when === "string" && WHEN_RE.test(body.when)) patch.when = body.when;
  if (typeof body.notesHtml === "string") {
    const notesHtml = sanitizeNotesHtml(body.notesHtml);
    patch.notesHtml = notesHtml;
    patch.notes = htmlToPlainText(notesHtml);
  }

  // Moving a session onto a `req:<id>` spot: only the caller's own pending request.
  if (patch.spot && patch.spot !== existing.spot && !(await checkRequestSpot(patch.spot, ownerId)).ok) {
    return fail(404, "spot not found");
  }

  // The goal points ticked as achieved — the whole list, replacing what was
  // there (empty clears it). Any session can take them, whenever it was logged.
  if (body.goalAchieved !== undefined) {
    const achieved = parseGoalAchieved(body.goalAchieved);
    if (!achieved) return fail(400, "invalid goalAchieved");
    Object.assign(patch, achievedGoalFields(achieved));
  }

  // Only ever the caller's own board — a foreign/unknown id is a 404, and
  // nothing is written.
  const board = await resolveOwnedBoardId(body.boardId, ownerId);
  if (!board.ok) return fail(404, "board not found");
  if (board.boardId !== undefined) patch.boardId = board.boardId;

  if (body.cond === null) {
    patch.cond = null;
  } else if (body.cond && typeof body.cond === "object") {
    const c = body.cond as Record<string, unknown>;
    const next: Cond = {
      swellHeightM: null,
      swellPeriodS: null,
      swellDir: null,
      windSpeedMs: null,
      windGustMs: null,
      windDir: null,
      tideM: null,
      tideNote: null,
      seaTempC: null,
      airTempC: null,
      sky: null,
      source: existing.cond?.source ?? "manual",
      filledAt: new Date().toISOString(),
      ...existing.cond,
    };
    for (const k of COND_KEYS) {
      if (k in c) {
        const v = c[k];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next as any)[k] =
          v === "" || v === undefined ? null : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
      }
    }
    next.filledAt = new Date().toISOString();
    if (next.source !== "swelleye") next.source = "manual";
    patch.cond = next;
  }

  const spotChanged = patch.spot != null && patch.spot !== existing.spot;
  const whenChanged = patch.when != null && patch.when !== existing.when;
  if (spotChanged || whenChanged || body.refreshConditions === true) {
    const spot = await resolveSpot(patch.spot ?? existing.spot);
    if (spot?.lat != null && spot.lng != null) {
      try {
        patch.condOpenMeteo = await getConditions(spot.lat, spot.lng, patch.when ?? existing.when, spot.timezone);
      } catch {
        // leave condOpenMeteo as-is if the refetch fails
      }
    } else if (spotChanged) {
      patch.condOpenMeteo = null;
    }

    if (spot?.tideTownship) {
      try {
        patch.condCwaTide = await getTide(spot.tideTownship, patch.when ?? existing.when);
      } catch {
        // leave condCwaTide as-is if the refetch fails
      }
    } else if (spotChanged) {
      patch.condCwaTide = null;
    }
  }

  return { ok: true, data: await updateSession(id, patch) };
}

/** Delete a session and free its photo/video objects. */
export async function deleteSessionFor(ownerId: string, id: string): Promise<ServiceResult<boolean>> {
  const existing = await getSession(id);
  if (!existing || existing.ownerId !== ownerId) return fail(404, "not found");

  await Promise.allSettled(existing.photos.map((p) => deleteBlob(p.id)));
  return { ok: true, data: await deleteSession(id) };
}
