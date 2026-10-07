/**
 * The only unauthenticated paths of the share feature. proxy.ts lets exactly
 * these through; each handler does its own token check. Token charset is
 * base64url, 20-128 chars (real ones are 43), blob ids are 32 hex like
 * lib/blob.ts's. Anything else under /s/ or /api/share/ stays behind sign-in.
 */
const TOKEN = "[A-Za-z0-9_-]{20,128}";
const PAGE = new RegExp(`^/s/${TOKEN}$`);
const IMAGE = new RegExp(`^/s/${TOKEN}/card\\.png$`);
const MEDIA = new RegExp(`^/api/share/${TOKEN}/media/[0-9a-f]{32}$`);
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
