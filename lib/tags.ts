import type { Lang } from "./i18n";

/**
 * Session tags (SURFLOG-11): short labels on a session ("Glassy", "Chest-high",
 * "With Ming"). Pure and browser-safe: the log form, edit panel, card, filter
 * and MCP tools all go through here.
 *
 * Two kinds. **Starter** tags are the fixed list below; they are stored by
 * their English key and shown in the viewer's language, so a session tagged
 * "Glassy" reads 清澈 for a zh-TW viewer. **Custom** tags are whatever the user
 * typed and are stored and shown as typed. Both live in one `text[]` on the
 * session (`sessions.tags`). Nothing aggregates across users.
 *
 * Starters describe the session, never judge it (no "Epic" / "Bad": the 1-5
 * rating was removed on request). Wind and tide are not tags either: they come
 * from Open-Meteo and CWA. Board type isn't one: the board chip says it. The
 * zh-TW wording is Avery's pick (2026-10-23); the Size group's is unreviewed.
 */

export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;

/** "water" is shown as "Waves" / 浪況, "crowd" as "Crowd" / 擁擠度 and "session" as "Others" / 其他 (renamed 2026-10-23; the ids stay). */
export type TagGroupId = "water" | "size" | "crowd" | "session";

export interface StarterTag {
  /** What is stored. */
  key: string;
  /** Shown to zh-TW viewers. */
  zh: string;
}

export const STARTER_TAG_GROUPS: { id: TagGroupId; tags: StarterTag[] }[] = [
  {
    id: "water",
    tags: [
      { key: "Glassy", zh: "鏡面海" },
      { key: "Clean", zh: "浪型整齊" },
      { key: "Peeling", zh: "很順" },
      { key: "Barrel", zh: "管浪" },
      { key: "Choppy", zh: "浪面亂" },
      { key: "Closeouts", zh: "整排蓋" },
    ],
  },
  {
    id: "size",
    tags: [
      { key: "Ankle to waist", zh: "腳踝到腰" },
      { key: "Chest to shoulder", zh: "胸肩浪" },
      { key: "Head-high", zh: "一人高" },
      { key: "Overhead", zh: "過頭" },
      { key: "Double overhead+", zh: "兩人高及以上" },
    ],
  },
  {
    id: "crowd",
    tags: [
      { key: "Crowded", zh: "擁擠" },
      { key: "Quiet", zh: "人少" },
      { key: "Solo", zh: "包場" },
    ],
  },
  {
    id: "session",
    tags: [
      { key: "Dawn patrol", zh: "開燈" },
      { key: "Sunset", zh: "關燈" },
      { key: "Lesson", zh: "上課" },
      { key: "Surf trip", zh: "衝浪旅行" },
      { key: "With surf buddies", zh: "跟浪友" },
    ],
  },
];

const STARTERS: StarterTag[] = STARTER_TAG_GROUPS.flatMap((g) => g.tags);
const STARTER_BY_KEY = new Map(STARTERS.map((t, i) => [t.key.toLowerCase(), { tag: t, rank: i }]));
const STARTER_BY_ZH = new Map(STARTERS.map((t) => [t.zh, t]));

/** The starter a stored tag is (matched ignoring case), if it is one. */
export function starterOf(tag: string): StarterTag | undefined {
  return STARTER_BY_KEY.get(tag.toLowerCase())?.tag;
}

/** How a stored tag reads in `lang`: a starter in its language, a custom tag as typed. */
export function tagLabel(tag: string, lang: Lang): string {
  const starter = starterOf(tag);
  if (!starter) return tag;
  return lang === "zh-TW" ? starter.zh : starter.key;
}

/** Trim, collapse inner whitespace, drop control characters. */
function clean(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The value to store for something typed or picked: a starter (by its English
 * key or its zh-TW wording) becomes the starter's key; text matching one of
 * `known` ignoring case takes that tag's spelling; anything else stays as
 * typed (cleaned). Empty text gives "".
 */
export function canonicalTag(text: string, known: readonly string[] = []): string {
  const t = clean(text);
  if (!t) return "";
  const starter = STARTER_BY_KEY.get(t.toLowerCase())?.tag ?? STARTER_BY_ZH.get(t);
  if (starter) return starter.key;
  const lower = t.toLowerCase();
  return known.find((k) => k.toLowerCase() === lower) ?? t;
}

/**
 * Validate and tidy a list of tags from outside (request body, MCP input).
 * Returns the stored form (starters first in catalogue order, then custom tags
 * in the order given, no repeats ignoring case), or `null` when the input is
 * not an array of strings, a tag is longer than MAX_TAG_LENGTH, or there are
 * more than MAX_TAGS. Blank entries are dropped.
 */
export function normalizeTags(input: unknown): string[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > 50) return null;
  const seen = new Set<string>();
  const starters: { tag: string; rank: number }[] = [];
  const custom: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") return null;
    const tag = canonicalTag(raw);
    if (!tag) continue;
    if ([...tag].length > MAX_TAG_LENGTH) return null;
    const lower = tag.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    const starter = STARTER_BY_KEY.get(lower);
    if (starter) starters.push({ tag: starter.tag.key, rank: starter.rank });
    else custom.push(tag);
  }
  const out = [...starters.sort((a, b) => a.rank - b.rank).map((s) => s.tag), ...custom];
  return out.length > MAX_TAGS ? null : out;
}

/** What the picker offers before "All tags" is opened, for someone with no history yet. */
export const DEFAULT_QUICK_TAGS = ["Glassy", "Clean", "Choppy", "Closeouts", "Crowded", "Dawn patrol"];
export const QUICK_TAG_COUNT = 6;

/**
 * The tags the picker shows while collapsed: every tag already `selected`
 * (so nothing picked is ever hidden), then the `limit` most used by `counts`
 * (stored tag -> sessions carrying it; ties: starters in catalogue order,
 * then A-Z), topped up from DEFAULT_QUICK_TAGS when there is not enough
 * history. Compared ignoring case.
 */
export function quickTags(
  selected: readonly string[],
  counts: ReadonlyMap<string, number>,
  limit = QUICK_TAG_COUNT
): string[] {
  const out = [...selected];
  const has = (tag: string) => out.some((o) => o.toLowerCase() === tag.toLowerCase());
  const rank = (tag: string) => STARTER_BY_KEY.get(tag.toLowerCase())?.rank ?? Infinity;
  const used = [...counts.entries()]
    .filter(([tag, n]) => n > 0 && !has(tag))
    .sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
  let extras = 0;
  for (const [tag] of used) {
    if (extras >= limit) break;
    if (!has(tag)) {
      out.push(tag);
      extras += 1;
    }
  }
  for (const tag of DEFAULT_QUICK_TAGS) {
    if (extras >= limit) break;
    if (!has(tag)) {
      out.push(tag);
      extras += 1;
    }
  }
  return out;
}

/** The user's own (non-starter) tags across `sessions`, most used first, then A-Z. */
export function customTagsOf(sessions: readonly { tags?: readonly string[] | null }[]): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const s of sessions) {
    for (const tag of s.tags ?? []) {
      if (starterOf(tag)) continue;
      const hit = counts.get(tag.toLowerCase());
      if (hit) hit.count += 1;
      else counts.set(tag.toLowerCase(), { tag, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** How many of `sessions` carry each tag (any kind), keyed by the stored tag. */
export function tagCounts(sessions: readonly { tags?: readonly string[] | null }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sessions) for (const tag of s.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return counts;
}
