import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_CUTOFF,
  MAX_CLIP_MS,
  MIN_CLIP_MS,
  clipAround,
  clipNeedsSkillPick,
  clipsBySkill,
  readClipCreate,
  readClipPatch,
  validClipBounds,
  type Clip,
} from "@/lib/clips";
import { draftWhen, nearestSpot } from "@/lib/session-draft";
import { resumableUploadEndpoint } from "@/lib/blob";
import { creationInstant, locationFromRaw, parseIso6709, parseLooseDate, videoMime } from "@/lib/video-meta";

const MEDIA = "a".repeat(32);

function clip(over: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    ownerId: "owner",
    sessionId: "s1",
    mediaId: MEDIA,
    startMs: 0,
    endMs: 4000,
    skill: "trim",
    taggedBy: "user",
    model: null,
    confidence: null,
    confirmed: false,
    reaction: null,
    createdAt: "2026-09-26T00:00:00.000Z",
    ...over,
  };
}

describe("parseIso6709", () => {
  it("reads an Apple location, altitude included", () => {
    expect(parseIso6709("+22.00580+120.84590+012.345/")).toEqual({ lat: 22.0058, lng: 120.8459 });
    expect(parseIso6709("+37.33233141-122.03121860+001.000/")).toEqual({
      lat: 37.33233141,
      lng: -122.0312186,
    });
  });
  it("rejects null island and out-of-range numbers", () => {
    expect(parseIso6709("+00.0000+000.0000/")).toBeNull();
    expect(parseIso6709("+99.0+010.0/")).toBeNull();
    expect(parseIso6709("no location")).toBeNull();
  });
});

describe("creation time and gps", () => {
  it("parses an offset without a colon", () => {
    expect(parseLooseDate("2026-09-26T08:14:00+0800")?.toISOString()).toBe("2026-09-26T00:14:00.000Z");
  });
  it("prefers the Apple capture time over the container clock", () => {
    const instant = creationInstant({
      creationTime: new Date("2020-01-01T00:00:00Z"),
      raw: { "com.apple.quicktime.creationdate": "2026-09-26T08:14:00+0800" },
    });
    expect(instant?.toISOString()).toBe("2026-09-26T00:14:00.000Z");
  });
  it("falls back to creationTime", () => {
    const created = new Date("2026-09-26T00:14:00Z");
    expect(creationInstant({ creationTime: created })).toEqual(created);
    expect(creationInstant({})).toBeNull();
  });
  it("reads gps from the quicktime tag or a xyz atom", () => {
    expect(locationFromRaw({ "com.apple.quicktime.location.ISO6709": "+22.0058+120.8459/" })).toEqual({
      lat: 22.0058,
      lng: 120.8459,
    });
    const bytes = new TextEncoder().encode("+08.5000+126.1000/");
    expect(locationFromRaw({ "©xyz": bytes })?.lng).toBeCloseTo(126.1);
  });
});

describe("videoMime", () => {
  it("keeps a video type and fills a blank mov", () => {
    expect(videoMime({ type: "video/mp4", name: "a.mp4" })).toBe("video/mp4");
    expect(videoMime({ type: "", name: "IMG_5420.MOV" })).toBe("video/quicktime");
    expect(videoMime({ type: "image/jpeg", name: "a.jpg" })).toBeNull();
  });
});

describe("nearestSpot", () => {
  const spots = [
    { slug: "jialeshui", lat: 21.9877, lng: 120.846, timezone: "Asia/Taipei" },
    { slug: "waiao", lat: 24.86, lng: 121.84, timezone: "Asia/Taipei" },
    { slug: "nowhere", lat: null, lng: null, timezone: "Asia/Taipei" },
  ];
  it("picks the closest break inside 30 km", () => {
    const hit = nearestSpot(spots, { lat: 21.99, lng: 120.85 });
    expect(hit?.slug).toBe("jialeshui");
    expect(hit!.distanceM).toBeLessThan(1000);
  });
  it("leaves a far point for a manual pick", () => {
    expect(nearestSpot(spots, { lat: 35.6, lng: 139.7 })).toBeNull();
    expect(nearestSpot(spots, { lat: 0, lng: 0 })).toBeNull();
  });
});

describe("draftWhen", () => {
  it("rounds to the half hour in the spot's zone", () => {
    // 08:14 in Taipei → 08:00; 08:15 ties upward to 08:30
    expect(draftWhen(new Date("2026-09-26T00:14:00Z"), "Asia/Taipei", new Date("2026-09-26T04:00:00Z"))).toBe(
      "2026-09-26T08:00"
    );
    expect(draftWhen(new Date("2026-09-26T00:15:00Z"), "Asia/Taipei", new Date("2026-09-26T04:00:00Z"))).toBe(
      "2026-09-26T08:30"
    );
  });
  it("will not suggest a time that hasn't happened", () => {
    // now is 10:00 in Taipei; a video stamped 11:00 clamps to the 10:00 slot
    expect(draftWhen(new Date("2026-09-26T03:00:00Z"), "Asia/Taipei", new Date("2026-09-26T02:00:00Z"))).toBe(
      "2026-09-26T10:00"
    );
  });
  it("rejects a bad instant or zone", () => {
    expect(draftWhen(new Date(NaN), "Asia/Taipei")).toBeNull();
    expect(draftWhen(new Date(), "Not/AZone")).toBeNull();
  });
});

describe("clip input", () => {
  it("accepts a hand clip", () => {
    expect(readClipCreate({ mediaId: MEDIA, startMs: 1000, endMs: 5000, skill: "takeoff" })).toEqual({
      mediaId: MEDIA,
      startMs: 1000,
      endMs: 5000,
      skill: "takeoff",
      reaction: null,
    });
  });
  it("refuses a bad skill, a short span, and a non-video id", () => {
    expect(readClipCreate({ mediaId: MEDIA, startMs: 0, endMs: 5000, skill: "epic" })).toBeNull();
    expect(readClipCreate({ mediaId: MEDIA, startMs: 0, endMs: MIN_CLIP_MS - 1, skill: "trim" })).toBeNull();
    expect(readClipCreate({ mediaId: "nope", startMs: 0, endMs: 5000, skill: "trim" })).toBeNull();
    expect(validClipBounds(0, MAX_CLIP_MS + 1)).toBe(false);
  });
  it("reads a partial update, including clearing a reaction", () => {
    expect(readClipPatch({ confirmed: true, reaction: "fell" })).toEqual({ confirmed: true, reaction: "fell" });
    expect(readClipPatch({ reaction: null })).toEqual({ reaction: null });
    expect(readClipPatch({})).toBeNull();
    expect(readClipPatch({ skill: "good" })).toBeNull();
    expect(readClipPatch({ startMs: 1.5 })).toBeNull();
  });
});

describe("unsure and grouping", () => {
  it("hides a low-confidence AI guess until it is confirmed", () => {
    expect(clipNeedsSkillPick(clip({ taggedBy: "ai", confidence: CONFIDENCE_CUTOFF - 0.01 }))).toBe(true);
    expect(clipNeedsSkillPick(clip({ taggedBy: "ai", confidence: null }))).toBe(true);
    expect(clipNeedsSkillPick(clip({ taggedBy: "ai", confidence: CONFIDENCE_CUTOFF }))).toBe(false);
    expect(clipNeedsSkillPick(clip({ taggedBy: "ai", confidence: 0.1, confirmed: true }))).toBe(false);
    expect(clipNeedsSkillPick(clip({ taggedBy: "user", confidence: null }))).toBe(false);
  });
  it("groups only confirmed clips, in skill order", () => {
    const groups = clipsBySkill([
      clip({ id: "a", skill: "trim", confirmed: true, startMs: 8000, endMs: 12000 }),
      clip({ id: "b", skill: "takeoff", confirmed: true, startMs: 1000, endMs: 3000 }),
      clip({ id: "c", skill: "trim", confirmed: false, startMs: 0, endMs: 2000 }),
      clip({ id: "d", skill: "not_a_ride", confirmed: true, startMs: 20000, endMs: 24000 }),
    ]);
    expect(groups.map((g) => g.skill)).toEqual(["takeoff", "trim", "not_a_ride"]);
    expect(groups[1].clips.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("clipAround", () => {
  it("starts at the playhead and pulls back at the end of the video", () => {
    expect(clipAround(1000, 60_000)).toEqual({ startMs: 1000, endMs: 9000 });
    expect(clipAround(58_000, 60_000)).toEqual({ startMs: 52_000, endMs: 60_000 });
    expect(clipAround(0, 100)).toBeNull();
  });
});

describe("resumable upload endpoint", () => {
  it("uses the storage hostname for a hosted project and keeps a local origin", () => {
    expect(resumableUploadEndpoint("https://abc.supabase.co")).toBe(
      "https://abc.storage.supabase.co/storage/v1/upload/resumable"
    );
    expect(resumableUploadEndpoint("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321/storage/v1/upload/resumable"
    );
  });
});
