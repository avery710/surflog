/**
 * Line breaking for text drawn into the share images. Satori would wrap
 * text itself, but we need the line COUNT before rendering (the sticker's
 * height depends on it) and a hard cap with an ellipsis, so wrapping is done
 * here, by an estimated glyph width. Estimates, not font metrics: CJK is one
 * em per glyph, Latin letters about 0.56 em. A line that comes out a little
 * wide or narrow is harmless — the renderer lays each line out on its own
 * row with `white-space: nowrap`.
 *
 * Works on code points (Array.from), never UTF-16 halves, so an emoji or a
 * rare CJK extension character is never cut in two.
 */

const NO_LINE_START = new Set(Array.from("，。、．！？：；）」』】》〉,.!?:;)]}%"));
const NO_LINE_END = new Set(Array.from("（「『【《〈([{"));

export function glyphWidthEm(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp === 0x20) return 0.3;
  if (cp < 0x80) {
    if (/[ilI.,:;'|!]/.test(ch)) return 0.3;
    if (/[mwMW@]/.test(ch)) return 0.85;
    if (/[A-Z]/.test(ch)) return 0.66;
    return 0.56;
  }
  // CJK, kana, hangul, fullwidth forms, emoji and anything else wide
  return 1;
}

export function textWidthEm(text: string): number {
  let w = 0;
  for (const ch of text) w += glyphWidthEm(ch);
  return w;
}

export interface WrappedText {
  lines: string[];
  /** True when text was cut off (the last line then ends in "…"). */
  truncated: boolean;
}

/** Wrap `text` (paragraphs separated by "\n") to `maxWidthPx` at `fontPx`,
 *  keeping at most `maxLines` lines. Blank lines are dropped: notes are a
 *  few sentences, and on a small image a paragraph gap is wasted height. */
export function wrapText(text: string, maxWidthPx: number, fontPx: number, maxLines: number): WrappedText {
  const maxEm = maxWidthPx / fontPx;
  const all: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const p = para.trim();
    if (!p) continue;
    all.push(...wrapParagraph(p, maxEm));
  }
  if (all.length <= maxLines) return { lines: all, truncated: false };
  const lines = all.slice(0, maxLines);
  lines[maxLines - 1] = withEllipsis(lines[maxLines - 1], maxEm);
  return { lines, truncated: true };
}

function wrapParagraph(p: string, maxEm: number): string[] {
  const chars = Array.from(p);
  const out: string[] = [];
  let line = "";
  let lineEm = 0;
  let lastSpace = -1; // index in `line` (code points) of the last space, for Latin word breaks

  const push = (s: string) => out.push(s.replace(/\s+$/, ""));

  for (const ch of chars) {
    const w = glyphWidthEm(ch);
    if (lineEm + w > maxEm && line) {
      // Closing punctuation may hang past the edge rather than start a line.
      if (NO_LINE_START.has(ch)) {
        line += ch;
        lineEm += w;
        continue;
      }
      const lineChars = Array.from(line);
      const tail = lineChars.slice(lastSpace + 1);
      // Break at the last space only to move a whole Latin word down; in
      // CJK text a space (e.g. after a "- " bullet) is not a word boundary.
      const latinTail = tail.length > 0 && tail.every((x) => (x.codePointAt(0) ?? 0) < 0x80 && x !== " ");
      if (ch !== " " && lastSpace > 1 && latinTail && (ch.codePointAt(0) ?? 0) < 0x80) {
        // break at the last space: the tail word moves down
        push(lineChars.slice(0, lastSpace).join(""));
        line = lineChars.slice(lastSpace + 1).join("");
      } else if (NO_LINE_END.has(lineChars[lineChars.length - 1])) {
        const last = lineChars.pop() as string;
        push(lineChars.join(""));
        line = last;
      } else {
        push(line);
        line = "";
      }
      lineEm = textWidthEm(line);
      lastSpace = -1;
      if (ch === " ") continue;
    }
    if (ch === " ") lastSpace = Array.from(line).length;
    line += ch;
    lineEm += w;
  }
  if (line.trim()) push(line);
  return out;
}

function withEllipsis(line: string, maxEm: number): string {
  const chars = Array.from(line.replace(/[\s，。、,.;；:：]+$/, ""));
  while (chars.length && textWidthEm(chars.join("")) + 1 > maxEm) chars.pop();
  return `${chars.join("")}…`;
}

/** Tiles split into rows of at most `rowSize`, as even as possible
 *  (5 -> 3+2, 4 -> 2+2): no orphan tile stretched across a whole row. */
export function tileRows<T>(tiles: T[], rowSize: number): T[][] {
  if (tiles.length === 0) return [];
  const rows = Math.ceil(tiles.length / rowSize);
  const base = Math.floor(tiles.length / rows);
  let extra = tiles.length % rows;
  const out: T[][] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const n = base + (extra-- > 0 ? 1 : 0);
    out.push(tiles.slice(i, i + n));
    i += n;
  }
  return out;
}
