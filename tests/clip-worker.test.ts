import { describe, expect, it } from "vitest";
import {
  ModelOutputError,
  clipsFromRide,
  extractJson,
  parseRides,
  parseSkills,
} from "../worker/parse";
import { suggestClips, MAX_RIDES } from "../worker/pipeline";
import { textFromGenerateResponse } from "../worker/gemini";
import { createTagger, DEFAULT_GEMINI_MODEL, DOCUMENTED_GEMINI_MODELS } from "../worker/tagger";
import type { TranscodeRequest } from "../worker/ffmpeg";

const PASS1 = `
Here are the rides I found:
\`\`\`json
{ "rides": [
  { "startSec": 12.5, "endSec": 20 },
  { "start": "4", "end": "9.5" },
  { "startSec": 30, "endSec": 10 },
  { "startSec": -1, "endSec": 4 },
  "nope"
] }
\`\`\`
`;

const PASS2 = `{
  "segments": [
    { "skill": "Takeoff", "startSec": 0, "endSec": 1.8, "confidence": 0.91 },
    { "skill": "bottom turn", "startSec": "1.8", "endSec": 4, "confidence": "1.4" },
    { "skill": "epic", "startSec": 4, "endSec": 6, "confidence": 0.2 },
    { "skill": "trim", "startSec": 4, "endSec": 4, "confidence": 0.8 },
    { "skill": "not_a_ride", "startSec": 6, "endSec": 7 }
  ]
}`;

describe("model output", () => {
  it("reads rides out of a fenced JSON block and drops bad rows", () => {
    expect(parseRides(PASS1)).toEqual([
      { startSec: 12.5, endSec: 20 },
      { startSec: 4, endSec: 9.5 },
    ]);
  });

  it("reads skills, clamps confidence, and drops unknown or empty spans", () => {
    expect(parseSkills(PASS2)).toEqual([
      { skill: "takeoff", startSec: 0, endSec: 1.8, confidence: 0.91 },
      { skill: "bottom_turn", startSec: 1.8, endSec: 4, confidence: 1 },
      { skill: "not_a_ride", startSec: 6, endSec: 7, confidence: null },
    ]);
  });

  it("accepts a bare array and rejects prose with no JSON", () => {
    expect(parseRides('[{"startSec":1,"endSec":2}]')).toEqual([{ startSec: 1, endSec: 2 }]);
    expect(extractJson('note {"rides":[]}')).toEqual({ rides: [] });
    expect(() => parseRides("I see no rides.")).toThrow(ModelOutputError);
  });

  it("shifts ride-relative segments onto the full video", () => {
    const clips = clipsFromRide({ startSec: 10, endSec: 18 }, parseSkills(PASS2));
    expect(clips.map((c) => [c.skill, c.startMs, c.endMs, c.confidence])).toEqual([
      ["takeoff", 10000, 11800, 0.91],
      ["bottom_turn", 11800, 14000, 1],
      ["not_a_ride", 16000, 17000, null],
    ]);
  });

  it("keeps a whole ride as other when the model returns nothing usable", () => {
    expect(clipsFromRide({ startSec: 2, endSec: 5 }, [])).toEqual([
      { startMs: 2000, endMs: 5000, skill: "other", confidence: null },
    ]);
  });
});

describe("generateContent text", () => {
  it("joins the text parts", () => {
    expect(
      textFromGenerateResponse({
        candidates: [{ content: { parts: [{ text: '{"rides":' }, { text: "[]}" }] } }],
      })
    ).toBe('{"rides":[]}');
    expect(() => textFromGenerateResponse({})).toThrow(/no text/);
  });
});

describe("tagger config", () => {
  it("requires a key, defaults the model, and honours GEMINI_MODEL", () => {
    expect(() => createTagger({ TAGGER: "gemini" })).toThrow(/GEMINI_API_KEY/);
    expect(() => createTagger({ TAGGER: "other", GEMINI_API_KEY: "k" })).toThrow(/Unknown TAGGER/);
    expect(createTagger({ TAGGER: "gemini", GEMINI_API_KEY: "k" }).model).toBe(DEFAULT_GEMINI_MODEL);
    expect(createTagger({ TAGGER: "gemini", GEMINI_API_KEY: "k", GEMINI_MODEL: "  " }).model).toBe(DEFAULT_GEMINI_MODEL);
    expect(createTagger({ TAGGER: "gemini", GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-3.5-flash-lite" }).model).toBe(
      "gemini-3.5-flash-lite"
    );
    expect(createTagger({ TAGGER: "gemini", GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-4-hydrogen" }).model).toBe(
      "gemini-4-hydrogen"
    );
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.8-flash");
    expect(DOCUMENTED_GEMINI_MODELS).toEqual([
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
      "gemini-4-hydrogen",
    ]);
  });
});

describe("suggestClips", () => {
  it("runs 1 fps then 5 fps and keeps a low confidence", async () => {
    const calls: TranscodeRequest[] = [];
    const clips = await suggestClips({
      sourcePath: "session.mov",
      workDir: "/tmp/work",
      tagger: {
        model: "fake",
        async findRides() {
          return [{ startSec: 10, endSec: 18 }];
        },
        async labelRide() {
          return [
            { skill: "takeoff", startSec: 0, endSec: 2, confidence: 0.9 },
            { skill: "trim", startSec: 2, endSec: 6, confidence: 0.4 },
          ];
        },
      },
      transcode: async (req) => {
        calls.push(req);
      },
    });
    expect(calls.map((c) => c.fps)).toEqual([1, 5]);
    expect(calls[1]).toMatchObject({ input: "session.mov", startSec: 10, endSec: 18, width: 640 });
    expect(clips).toEqual([
      { startMs: 10000, endMs: 12000, skill: "takeoff", confidence: 0.9 },
      { startMs: 12000, endMs: 16000, skill: "trim", confidence: 0.4 },
    ]);
  });

  it("stops after MAX_RIDES", async () => {
    let cuts = 0;
    await suggestClips({
      sourcePath: "v.mp4",
      workDir: "/tmp/work",
      tagger: {
        model: "fake",
        async findRides() {
          return Array.from({ length: MAX_RIDES + 5 }, (_, i) => ({ startSec: i, endSec: i + 2 }));
        },
        async labelRide() {
          return [{ skill: "trim", startSec: 0, endSec: 1, confidence: 0.8 }];
        },
      },
      transcode: async (req) => {
        if (req.fps === 5) cuts++;
      },
    });
    expect(cuts).toBe(MAX_RIDES);
  });
});
