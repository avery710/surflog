/**
 * What Vercel Web Analytics is allowed to see of a page address (SURFLOG-33).
 * Counts and coarse location only: no query string or hash (sign-in
 * callbacks, OAuth parameters, filters) and no public-share token, which
 * is a bearer secret for that session's page. `/share/<token>` is recorded
 * as `/share/[token]`.
 */
const SHARE_TOKEN = /^(\/share\/)[A-Za-z0-9_-]{20,128}(?=\/|$)/;

export function scrubAnalyticsUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not an absolute address: drop what we can't parse rather than send it.
    return raw.split(/[?#]/)[0].replace(SHARE_TOKEN, "$1[token]");
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(SHARE_TOKEN, "$1[token]");
  return url.toString();
}
