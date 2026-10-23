import { describe, expect, it } from "vitest";
import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  STARTER_TAG_GROUPS,
  canonicalTag,
  DEFAULT_QUICK_TAGS,
  QUICK_TAG_COUNT,
  customTagsOf,
  normalizeTags,
  quickTags,
  starterOf,
  tagCounts,
  tagLabel,
} from "@/lib/tags";

describe("starters", () => {
  it("are stored by English key and shown in the viewer's language", () => {
    expect(tagLabel("Glassy", "en")).toBe("Glassy");
    expect(tagLabel("Glassy", "zh-TW")).toBe("鏡面海");
    expect(tagLabel("glassy", "zh-TW")).toBe("鏡面海");
  });
  it("leave the user's own tags as typed", () => {
    expect(tagLabel("With Ming", "zh-TW")).toBe("With Ming");
    expect(starterOf("With Ming")).toBeUndefined();
  });
  it("have no repeated key or wording", () => {
    const all = STARTER_TAG_GROUPS.flatMap((g) => g.tags);
    expect(new Set(all.map((t) => t.key.toLowerCase())).size).toBe(all.length);
    expect(new Set(all.map((t) => t.zh)).size).toBe(all.length);
  });
  it("fit the length limit", () => {
    for (const t of STARTER_TAG_GROUPS.flatMap((g) => g.tags)) expect([...t.key].length).toBeLessThanOrEqual(MAX_TAG_LENGTH);
  });
});

describe("canonicalTag", () => {
  it("turns a starter's English or zh-TW wording into its key", () => {
    expect(canonicalTag(" PEELing ")).toBe("Peeling");
    expect(canonicalTag("很順")).toBe("Peeling");
  });
  it("snaps to the spelling of a tag the user already has", () => {
    expect(canonicalTag("with ming", ["With Ming"])).toBe("With Ming");
    expect(canonicalTag("with ming")).toBe("with ming");
  });
  it("cleans whitespace and control characters", () => {
    expect(canonicalTag("  a \n\t b ")).toBe("a b");
    expect(canonicalTag("   ")).toBe("");
  });
});

describe("normalizeTags", () => {
  it("accepts nothing as an empty list", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags([])).toEqual([]);
  });
  it("puts starters first in catalogue order, then own tags as given, without repeats", () => {
    expect(normalizeTags(["Zed", "Solo", "Glassy", "zed", "Alpha"])).toEqual(["Glassy", "Zed", "Solo", "Alpha"]);
  });
  it("drops blanks", () => {
    expect(normalizeTags(["", "  ", "Empty break"])).toEqual(["Empty break"]);
  });
  it("refuses what isn't a list of short strings", () => {
    expect(normalizeTags("Glassy")).toBeNull();
    expect(normalizeTags([1])).toBeNull();
    expect(normalizeTags(["x".repeat(MAX_TAG_LENGTH + 1)])).toBeNull();
    expect(normalizeTags(Array.from({ length: 51 }, (_, i) => `t${i}`))).toBeNull();
  });
  it("counts a Chinese character as one", () => {
    expect(normalizeTags(["字".repeat(MAX_TAG_LENGTH)])).toHaveLength(1);
    expect(normalizeTags(["字".repeat(MAX_TAG_LENGTH + 1)])).toBeNull();
  });
  it("allows MAX_TAGS and no more", () => {
    const some = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
    expect(normalizeTags(some)).toHaveLength(MAX_TAGS);
    expect(normalizeTags([...some, "one more"])).toBeNull();
  });
});

describe("the user's own tags", () => {
  const sessions = [
    { tags: ["Glassy", "With Ming", "Nanwan crew"] },
    { tags: ["With Ming"] },
    { tags: ["with ming", "Solo"] },
    {},
  ];
  it("list most used first, ignoring starters and case", () => {
    expect(customTagsOf(sessions)).toEqual([
      { tag: "With Ming", count: 3 },
      { tag: "Nanwan crew", count: 1 },
      { tag: "Solo", count: 1 },
    ]);
  });
  it("count every tag by its stored spelling", () => {
    const counts = tagCounts(sessions);
    expect(counts.get("Glassy")).toBe(1);
    expect(counts.get("With Ming")).toBe(2);
  });
});

describe("quickTags (what the picker shows before 'All tags')", () => {
  it("starts from the defaults for someone with no history", () => {
    expect(quickTags([], new Map())).toEqual(DEFAULT_QUICK_TAGS.slice(0, QUICK_TAG_COUNT));
  });
  it("puts the most used first, then tops up from the defaults", () => {
    const counts = new Map([["With Ming", 9], ["Solo", 4], ["Barrel", 4], ["Glassy", 1]]);
    // ties go to the catalogue order (Barrel before Solo)
    expect(quickTags([], counts)).toEqual(["With Ming", "Barrel", "Solo", "Glassy", "Clean", "Choppy"]);
  });
  it("never hides a picked tag, and doesn't repeat it", () => {
    const counts = new Map([["Glassy", 5], ["Solo", 3]]);
    const out = quickTags(["Overhead", "glassy"], counts);
    expect(out.slice(0, 2)).toEqual(["Overhead", "glassy"]);
    expect(out.filter((t) => t.toLowerCase() === "glassy")).toHaveLength(1);
    expect(out).toHaveLength(2 + QUICK_TAG_COUNT);
  });
  it("ignores tags with no sessions left", () => {
    expect(quickTags([], new Map([["Zed", 0]]))).not.toContain("Zed");
  });
});
