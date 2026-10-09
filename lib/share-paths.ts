/**
 * The only unauthenticated paths of the share feature. proxy.ts lets exactly
 * these through; each handler does its own token check. Token charset is
 * base64url, 20-128 chars (real ones are 43), blob ids are 32 hex like
 * lib/blob.ts's (or the older base36 ones). Anything else under /share/ or /api/share/ stays behind sign-in.
 */
const TOKEN = "[A-Za-z0-9_-]{20,128}";
const PAGE = new RegExp(`^/share/${TOKEN}$`);
const IMAGE = new RegExp(`^/share/${TOKEN}/card\\.png$`);
// Blob ids: 32 hex since 2026-10-05 (lib/blob.ts); uploads before that were
// Date.now() + Math.random() in base36, ~16 lowercase letters and digits.
// Only a shape filter: the handler serves a blob only if it is the shared
// session's own (or its board's) and the owner's.
const BLOB_ID = "[0-9a-z]{8,40}";
const MEDIA = new RegExp(`^/api/share/${TOKEN}/media/${BLOB_ID}$`);
const TOKEN_ONLY = new RegExp(`^${TOKEN}$`);

export type PublicSharePath = "page" | "image" | "media";

export function publicSharePath(pathname: string): PublicSharePath | null {
  if (PAGE.test(pathname)) return "page";
  if (IMAGE.test(pathname)) return "image";
  if (MEDIA.test(pathname)) return "media";
  return null;
}

/** A well-formed token, checked before any database lookup. */
export function isTokenShape(token: string): boolean {
  return TOKEN_ONLY.test(token);
}
