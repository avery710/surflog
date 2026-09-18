/**
 * Notes are rich text edited via contentEditable. CLAUDE.md's schema comment
 * says "ul/ol/li/b/i only" as the simplified contract, but the actual
 * reference implementation (reference/surf-journal.html) allow-lists a bit
 * more — p/br/div/u — because that's what a contentEditable toolbar with only
 * Bullets/Numbered/Bold/Italic buttons still emits for plain paragraphs
 * (browsers wrap each Enter-created line in its own <div> or insert <br>).
 * Matching that keeps notes round-tripping the way Capy already expects.
 *
 * Node-safe (no DOMParser) so it can run both in the browser and in the API
 * route that persists a session. `strong`/`em` fold into `b`/`i`. Every
 * attribute is stripped regardless of tag — that's what actually blocks
 * `onclick=`-style payloads riding along on an otherwise-allowed tag.
 */

const ALLOWED = new Set(["p", "br", "ul", "ol", "li", "b", "i", "u", "div"]);
const ALIAS: Record<string, string> = { strong: "b", em: "i" };
const VOID = new Set(["br"]);

const escapeText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sanitizeNotesHtml(html: string): string {
  if (!html) return "";
  let out = "";
  let i = 0;
  const tagRe = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    out += escapeText(html.slice(i, m.index));
    i = tagRe.lastIndex;

    const closing = m[0][1] === "/";
    let name = m[1].toLowerCase();
    name = ALIAS[name] ?? name;
    if (ALLOWED.has(name)) {
      if (VOID.has(name)) out += `<${name}>`;
      else out += closing ? `</${name}>` : `<${name}>`;
    }
    // disallowed tags are dropped (both open and close) but their inner
    // text keeps flowing through, since we just continue scanning.
  }
  out += escapeText(html.slice(i));
  return out;
}

/** Plain-text mirror of sanitized notesHtml, for CSV export and search. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return withBreaks
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Best-effort upgrade for plain text captured before notesHtml existed. */
export function plainTextToHtml(text: string): string {
  if (!text) return "";
  return escapeText(text).replace(/\n/g, "<br>");
}
