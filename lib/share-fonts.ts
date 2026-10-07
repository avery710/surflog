/**
 * Fonts for the share images (next/og -> satori). Satori reads TTF/OTF/WOFF
 * but not WOFF2, and the app's own fonts come through next/font as WOFF2
 * files with hashed names, so they can't be reused here.
 *
 * Instead each font is fetched as a SUBSET from Google Fonts' CSS API with
 * `&text=<the characters actually drawn>`: Google answers with a TTF holding
 * only those glyphs (a few KB, even for Noto Sans TC, whose full file is
 * several MB), as long as the request carries an old User-Agent (a modern one
 * gets WOFF2). Nothing is bundled, so the deployment stays small, and it
 * works on Vercel (plain outbound HTTPS). Licences: Funnel Sans, IBM Plex
 * Mono and Noto Sans TC are all SIL OFL 1.1 — free to use and embed.
 *
 * Cost: the first render after a cold start needs 3-4 requests to
 * fonts.googleapis.com / fonts.gstatic.com (~100-300 ms); results are kept in
 * a per-instance in-memory cache keyed by family, weight and glyph set. If
 * Google is unreachable the render fails (503 from the routes) rather than
 * drawing tofu squares.
 */

export interface SatoriFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700 | 800;
  style: "normal";
}

// An old (non-WOFF2-capable) UA makes Google return `format('truetype')`.
const OLD_UA = "Mozilla/4.0";
const CACHE_MAX = 60;
const cache = new Map<string, Promise<ArrayBuffer | null>>();

/** Unique characters of `text`, sorted — a stable cache key and a short URL. */
export function uniqueChars(text: string): string {
  return Array.from(new Set(Array.from(text))).sort().join("");
}

async function fetchOnce(family: string, weight: number, chars: string): Promise<ArrayBuffer | null> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weight}&text=${encodeURIComponent(chars)}`,
    { headers: { "User-Agent": OLD_UA }, signal: AbortSignal.timeout(8000) }
  );
  if (!css.ok) return null;
  const src = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(await css.text())?.[1];
  if (!src) return null;
  const file = await fetch(src, { signal: AbortSignal.timeout(8000) });
  return file.ok ? await file.arrayBuffer() : null;
}

function loadSubset(family: string, weight: number, chars: string): Promise<ArrayBuffer | null> {
  const key = `${family}|${weight}|${chars}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    try {
      return (await fetchOnce(family, weight, chars)) ?? (await fetchOnce(family, weight, chars));
    } catch {
      return null;
    }
  })();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, p);
  // Don't keep a failure around: the next render should try again.
  void p.then((v) => {
    if (!v) cache.delete(key);
  });
  return p;
}

const SPECS: { family: string; name: string; weights: SatoriFont["weight"][] }[] = [
  { family: "Funnel Sans", name: "Funnel Sans", weights: [500, 700, 800] },
  { family: "IBM Plex Mono", name: "IBM Plex Mono", weights: [500] },
  { family: "Noto Sans TC", name: "Noto Sans TC", weights: [500, 700] },
];

/** Every font the images use, subset to the glyphs of `text`. Throws if the
 *  Latin faces can't be had; a missing Noto face only matters when `text`
 *  has non-ASCII characters. */
export async function loadShareFonts(text: string): Promise<SatoriFont[]> {
  const chars = uniqueChars(text);
  const hasWide = /[^\u0000-ɏ -⁯°·…−—–]/.test(chars);
  const jobs = SPECS.flatMap((s) =>
    s.family === "Noto Sans TC" && !hasWide
      ? []
      : s.weights.map(async (weight) => ({ s, weight, data: await loadSubset(s.family, weight, chars) }))
  );
  const loaded = await Promise.all(jobs);
  const fonts: SatoriFont[] = [];
  for (const { s, weight, data } of loaded) {
    if (data) fonts.push({ name: s.name, data, weight, style: "normal" });
    else if (s.family !== "IBM Plex Mono") throw new Error(`share fonts: could not load ${s.family} ${weight}`);
  }
  if (fonts.length === 0) throw new Error("share fonts: none loaded");
  return fonts;
}

/** Tests only. */
export function resetFontCache() {
  cache.clear();
}
