import { describe, expect, it } from "vitest";
import { readReviewInput, summarize } from "@/lib/spot-review";
import { toPublic, type ReviewRow } from "@/lib/spot-reviews";

describe("readReviewInput", () => {
  it("accepts a whole-star rating with an optional body", () => {
    expect(readReviewInput({ rating: 4 })).toEqual({ ok: true, rating: 4, body: null });
    expect(readReviewInput({ rating: 5, body: "  好浪\r\n\n\n\n人少  " })).toEqual({ ok: true, rating: 5, body: "好浪\n\n人少" });
  });
  it("refuses bad ratings and bodies", () => {
    for (const rating of [0, 6, 3.5, "4", null]) expect(readReviewInput({ rating }).ok).toBe(false);
    expect(readReviewInput(null).ok).toBe(false);
    expect(readReviewInput({ rating: 3, body: 7 }).ok).toBe(false);
    expect(readReviewInput({ rating: 3, body: "浪".repeat(1001) }).ok).toBe(false);
    expect(readReviewInput({ rating: 3, body: "浪".repeat(1000) }).ok).toBe(true);
  });
  it("strips control characters", () => {
    expect(readReviewInput({ rating: 2, body: "a\u0000b\u0007c" })).toEqual({ ok: true, rating: 2, body: "abc" });
  });
});

describe("summarize", () => {
  it("averages per spot to one decimal", () => {
    expect(
      summarize([
        { spot_slug: "waiao", rating: 5 },
        { spot_slug: "waiao", rating: 4 },
        { spot_slug: "waiao", rating: 4 },
        { spot_slug: "cloud-9", rating: 3 },
      ])
    ).toEqual({ waiao: { average: 4.3, count: 3 }, "cloud-9": { average: 3, count: 1 } });
    expect(summarize([])).toEqual({});
  });
});

describe("toPublic", () => {
  const row: ReviewRow = {
    id: "r1",
    spot_slug: "waiao",
    owner_id: "google-sub-123",
    author_name: "Capy",
    rating: 4,
    body: "fun",
    created_at: "2026-10-08T00:00:00Z",
    updated_at: "2026-10-08T01:00:00Z",
  };
  it("never carries the owner id, and marks the viewer's own", () => {
    const pub = toPublic(row, "someone-else");
    expect(Object.keys(pub).sort()).toEqual(["authorName", "body", "id", "mine", "rating", "updatedAt"]);
    expect(JSON.stringify(pub)).not.toContain("google-sub-123");
    expect(pub.mine).toBe(false);
    expect(toPublic(row, "google-sub-123").mine).toBe(true);
  });
});
