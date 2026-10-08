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
import type { Spot } from "./spots";
import type { Board, Session } from "./types";

export const cleanName = (n: string | null | undefined) => n?.trim().slice(0, 100) || null;
// Only an https avatar is ever stored (Google's are lh3.googleusercontent.com).
export const cleanImage = (u: string | null | undefined) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) && u.length <= 500 ? u : null);

/** Everything a visitor of /share/<token> may see. Explicit allow-list: add a
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
  /** What the session card (EntryCard, read-only) needs to draw this session
   *  exactly like the owner's journal does — a Session rebuilt from public
   *  fields only: no owner id, no session id, no goal ticks, board as a name
   *  with no photo (board photos stay private). */
  card: { session: Session; spot: Spot | null; board: Board | null };
}

export const SHARED_BOARD_ID = "shared-board";

/** The card's Session: copied field by field, never spread (see above). */
function cardSession(session: Session, notesHtml: string, hasBoard: boolean): Session {
  return {
    id: "shared",
    ownerId: "",
    spot: session.spot,
    when: session.when,
    notesHtml,
    notes: "",
    photos: session.photos.map((p) => ({ id: p.id, type: p.type })),
    // The readings the card draws; the bookkeeping fields it never shows (when
    // they were fetched, the model grid node, the tide station) are blanked.
    cond: session.cond ? { ...session.cond, filledAt: "" } : null,
    condOpenMeteo: session.condOpenMeteo ? { ...session.condOpenMeteo, gridLat: 0, gridLng: 0, fetchedAt: "" } : null,
    condCwaTide: session.condCwaTide ? { ...session.condCwaTide, stationTownship: "", fetchedAt: "" } : null,
    boardId: hasBoard ? SHARED_BOARD_ID : null,
    goalText: null,
    goalMet: null,
    goalPointsMet: null,
    createdAt: "",
  };
}

/** The board chip: the name only (as `brand`, so boardLabel() shows it unchanged). */
function cardBoard(name: string): Board {
  return {
    id: SHARED_BOARD_ID,
    ownerId: "",
    brand: name,
    lengthIn: null,
    volumeL: null,
    rocker: null,
    note: "",
    photoId: null,
    isFavorite: false,
    sortOrder: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** Build the whitelist view. Pure (given the card), so a test can feed it a
 *  Session stuffed with private fields and check none comes out. */
export function toPublicShare(
  session: Session,
  card: ShareCardData,
  row: { owner_name: string | null; owner_image: string | null },
  /** The session's catalogue spot (public data), for the card's spot name and shore word. */
  spot: Spot | null = null
): PublicShare {
  const notesHtml = sanitizeNotesHtml(session.notesHtml || "");
  return {
    lang: card.lang,
    spotName: card.spotName,
    whenLabel: card.whenLabel,
    tiles: card.tiles.map((t) => ({ key: t.key, label: t.label, value: t.value, unit: t.unit, lines: [...t.lines] })),
    boardName: card.boardName,
    notesHtml,
    notesText: card.notes,
    media: session.photos.map((p) => ({ id: p.id, type: p.type })),
    owner: { name: cleanName(row.owner_name), image: cleanImage(row.owner_image) },
    card: {
      session: cardSession(session, notesHtml, !!card.boardName),
      // A pending spot request has no catalogue row: a stand-in carrying the
      // name the share card already resolved, and nothing else.
      spot: spot ?? { slug: session.spot, name: card.spotName, country: "", area: "", lat: null, lng: null, timezone: "Asia/Taipei" },
      board: card.boardName ? cardBoard(card.boardName) : null,
    },
  };
}

