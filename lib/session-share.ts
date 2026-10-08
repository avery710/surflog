/**
 * Public share links for single sessions. Server-only (Supabase).
 *
 * Two halves with different trust:
 *
 * - OWNER side (`getShareStatus`, `enableShare`, `disableShare`): called from
 *   cookie-session routes only, with the caller's owner id; a session that
 *   isn't theirs is "not found" (404, never 403), same rule as
 *   lib/session-service.ts. Never reachable with a bearer token.
 * - PUBLIC side (`loadPublicShare`, `sharedMediaMeta`): called with nothing
 *   but a token. What it returns is a WHITELIST type, `PublicShare`, built
 *   field by field — never the Session row or a spread of it — so ownerId,
 *   the Google sub, email, goal fields, spot notes and the raw condition
 *   blobs cannot reach a visitor even by a later edit that adds a column.
 *   An unknown token and a turned-off one are the same `null`.
 */
import { boardPhotoDataUri } from "./share-board-photo";
import { coverPhotoDataUri } from "./share-cover-photo";
import { randomBytes } from "node:crypto";
import { getBoard, getSession } from "@/lib/db";
import { blobMeta } from "@/lib/blob";
import { resolveSpot } from "@/lib/spot-store";
import { getRequest } from "@/lib/spot-requests";
import { isRequestSlug, REQUEST_SLUG_PREFIX } from "@/lib/spots";
import { getSupabase } from "@/lib/supabase";
import { buildShareCard, type ShareCardData } from "@/lib/share-card-data";
import { isTokenShape } from "@/lib/share-paths";
import { cleanImage, cleanName, toPublicShare, type PublicShare } from "@/lib/share-public";
import { isShareLang, type ShareLang } from "@/lib/share-strings";
import type { ServiceResult } from "@/lib/session-service";
import type { Session } from "@/lib/types";

const TABLE = "session_shares";

interface ShareRow {
  token: string;
  session_id: string;
  owner_id: string;
  lang: string | null;
  owner_name: string | null;
  owner_image: string | null;
  created_at: string;
}

export interface ShareStatus {
  token: string;
  createdAt: string;
}

const toStatus = (row: ShareRow): ShareStatus => ({
  token: row.token,
  createdAt: row.created_at,
});

/** 32 random bytes as base64url — 256 bits, 43 characters. */
export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

const notFound = { ok: false as const, status: 404 as const, error: "not found" };

async function ownedSession(ownerId: string, sessionId: string): Promise<Session | null> {
  const s = await getSession(sessionId);
  return s && s.ownerId === ownerId ? s : null;
}

async function rowForSession(sessionId: string): Promise<ShareRow | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("session_id", sessionId).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data as ShareRow | null) ?? null;
}

/** Is this session shared right now? `data` is null when it isn't. */
export async function getShareStatus(ownerId: string, sessionId: string): Promise<ServiceResult<ShareStatus | null>> {
  if (!(await ownedSession(ownerId, sessionId))) return notFound;
  const row = await rowForSession(sessionId);
  return { ok: true, data: row ? toStatus(row) : null };
}

export interface ShareOwner {
  id: string;
  name?: string | null;
  image?: string | null;
}

/**
 * Turn sharing on. Idempotent: an already-shared session keeps its token
 * (so a link already sent stays valid) and only takes a fresh name/avatar
 * snapshot. The page's language is always the visitor's (Accept-Language);
 * `session_shares.lang` is no longer written or read.
 */
export async function enableShare(
  owner: ShareOwner,
  sessionId: string
): Promise<ServiceResult<ShareStatus>> {
  if (!(await ownedSession(owner.id, sessionId))) return notFound;
  const snapshot = { owner_name: cleanName(owner.name), owner_image: cleanImage(owner.image) };
  const sb = getSupabase();

  const existing = await rowForSession(sessionId);
  if (existing) {
    const { data, error } = await sb.from(TABLE).update(snapshot).eq("token", existing.token).select("*").single();
    if (error) throw new Error(`Supabase: ${error.message}`);
    return { ok: true, data: toStatus(data as ShareRow) };
  }

  const { data, error } = await sb
    .from(TABLE)
    .insert({ token: newShareToken(), session_id: sessionId, owner_id: owner.id, ...snapshot })
    .select("*")
    .single();
  if (error) {
    // Two taps at once: the other insert won the unique(session_id) race.
    if (error.code === "23505") {
      const winner = await rowForSession(sessionId);
      if (winner) return { ok: true, data: toStatus(winner) };
    }
    throw new Error(`Supabase: ${error.message}`);
  }
  return { ok: true, data: toStatus(data as ShareRow) };
}

/** Turn sharing off: the row is deleted, so the link 404s at once. */
export async function disableShare(ownerId: string, sessionId: string): Promise<ServiceResult<true>> {
  if (!(await ownedSession(ownerId, sessionId))) return notFound;
  const { error } = await getSupabase().from(TABLE).delete().eq("session_id", sessionId).eq("owner_id", ownerId);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return { ok: true, data: true };
}

/** What the card needs beyond the session: spot (for the shore word and the
 *  name in `lang`) and the board's name. Shared by the owner's image route
 *  and the public side, so both draw the same card. */
export async function buildCardForSession(session: Session, lang: ShareLang): Promise<ShareCardData> {
  const spot = await resolveSpot(session.spot);
  let spotName: string;
  if (spot) spotName = lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name;
  else if (session.spot.startsWith("custom:")) spotName = session.spot.slice(7);
  else if (isRequestSlug(session.spot)) {
    spotName = (await getRequest(session.spot.slice(REQUEST_SLUG_PREFIX.length)))?.name ?? "";
  } else spotName = session.spot;

  // The board must be the session owner's own (the same check the routes do).
  const board = session.boardId ? await getBoard(session.boardId) : null;
  return buildShareCard({
    session,
    spot,
    spotName,
    board: board && board.ownerId === session.ownerId ? board : null,
    lang,
  });
}

/** Owner preview/download: the card for one of the caller's own sessions. */
export async function ownedShareCard(
  ownerId: string,
  sessionId: string,
  lang: ShareLang,
  opts: { boardPhoto?: boolean; coverPhoto?: boolean } = {}
): Promise<ServiceResult<ShareCardData>> {
  const session = await ownedSession(ownerId, sessionId);
  if (!session) return notFound;
  const data = await buildCardForSession(session, lang);
  // The owner's own images may carry the board photo; public ones never do.
  if (opts.boardPhoto && data.boardName) data.boardPhoto = await boardPhotoDataUri(session.ownerId, session.boardId);
  // The Story image's background: the session's first image, else blue.
  if (opts.coverPhoto) data.coverPhoto = await coverPhotoDataUri(session.ownerId, session.photos);
  return { ok: true, data };
}

// ---------------------------------------------------------------- public

export type { PublicShare };

async function rowByToken(token: string): Promise<ShareRow | null> {
  if (!isTokenShape(token)) return null;
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("token", token).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  return (data as ShareRow | null) ?? null;
}

/** The session behind a token, only while the share row and the owner agree. */
async function sharedSession(row: ShareRow): Promise<Session | null> {
  const s = await getSession(row.session_id);
  return s && s.ownerId === row.owner_id ? s : null;
}

/**
 * The public view for a token, or null (unknown, turned off, or the session
 * is gone). Language: the owner's choice if they made one, else
 * `fallbackLang` (the visitor's).
 */
export async function loadPublicShare(token: string, fallbackLang: ShareLang): Promise<PublicShare | null> {
  const row = await rowByToken(token);
  if (!row) return null;
  const session = await sharedSession(row);
  if (!session) return null;
  const [card, spot] = await Promise.all([buildCardForSession(session, fallbackLang), resolveSpot(session.spot)]);
  return toPublicShare(session, card, row, spot);
}

/** Card data for the public image route (same lookup rules as the page). */
export async function loadPublicCard(token: string, fallbackLang: ShareLang): Promise<ShareCardData | null> {
  const row = await rowByToken(token);
  if (!row) return null;
  const session = await sharedSession(row);
  if (!session) return null;
  return buildCardForSession(session, fallbackLang);
}

/** The mime type of `blobId` iff it is one of the shared session's own
 *  photos/videos and the owner's upload. Anything else — another session's
 *  blob, a board photo, a made-up id — is null. */
export async function sharedMediaMeta(token: string, blobId: string): Promise<{ mimeType: string } | null> {
  const row = await rowByToken(token);
  if (!row) return null;
  const session = await sharedSession(row);
  if (!session || !session.photos.some((p) => p.id === blobId)) return null;
  const meta = await blobMeta(blobId);
  if (!meta || meta.ownerId !== row.owner_id) return null;
  return { mimeType: meta.mimeType };
}
