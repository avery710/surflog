/**
 * The public view of a shared session — pure (no Supabase), so the /dev
 * showcase and the tests can build it from synthetic sessions.
 *
 * `PublicShare` is an explicit allow-list: `toPublicShare` copies field by
 * field and never spreads the Session, so ownerId, the Google sub, email,
 * goal fields, spot notes and the raw condition blobs cannot reach a
 * visitor even if a column is added to Session later. Add a field here only
 * if it is meant to be public.
 */
import { sanitizeNotesHtml } from "./rich-text";
import type { ShareCardData, ShareTile } from "./share-card-data";
import type { ShareLang } from "./share-strings";
import type { Session } from "./types";

export const cleanName = (n: string | null | undefined) => n?.trim().slice(0, 100) || null;
// Only an https avatar is ever stored (Google's are lh3.googleusercontent.com).
export const cleanImage = (u: string | null | undefined) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) && u.length <= 500 ? u : null);

/** Everything a visitor of /s/<token> may see. Explicit allow-list: add a
 *  field here only if it is meant to be public. */
export interface PublicShare {
  lang: ShareLang;
  spotName: string;
  whenLabel: string;
  tiles: ShareTile[];
  boardName: string | null;
  /** Sanitized rich text (re-sanitized on the way out). */
  notesHtml: string;
  notesText: string;
  /** Photo/video ids with mime type — fetched through the token-scoped
   *  /api/share/<token>/media/<id> route only. */
  media: { id: string; type: string }[];
  owner: { name: string | null; image: string | null };
}

/** Build the whitelist view. Pure (given the card), so a test can feed it a
 *  Session stuffed with private fields and check none comes out. */
export function toPublicShare(
  session: Session,
  card: ShareCardData,
  row: { owner_name: string | null; owner_image: string | null }
): PublicShare {
  return {
    lang: card.lang,
    spotName: card.spotName,
    whenLabel: card.whenLabel,
    tiles: card.tiles.map((t) => ({ key: t.key, label: t.label, value: t.value, unit: t.unit, lines: [...t.lines] })),
    boardName: card.boardName,
    notesHtml: sanitizeNotesHtml(session.notesHtml || ""),
    notesText: card.notes,
    media: session.photos.map((p) => ({ id: p.id, type: p.type })),
    owner: { name: cleanName(row.owner_name), image: cleanImage(row.owner_image) },
  };
}

