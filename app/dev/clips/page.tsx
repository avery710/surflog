"use client";

import { ClipReview } from "@/components/clip-review";
import type { Clip } from "@/lib/clips";
import type { Session } from "@/lib/types";

const MEDIA = "a".repeat(32);

const session: Session = {
  id: "dev-session",
  ownerId: "dev",
  spot: "jialeshui",
  when: "2026-09-26T08:00",
  durationMin: 90,
  notesHtml: "",
  notes: "",
  photos: [{ id: MEDIA, type: "video/mp4" }],
  cond: null,
  condOpenMeteo: null,
  condCwaTide: null,
  createdAt: "2026-09-26T00:00:00.000Z",
};

function clip(partial: Pick<Clip, "id" | "startMs" | "endMs" | "skill" | "taggedBy" | "confidence" | "confirmed"> & {
  reaction?: Clip["reaction"];
}): Clip {
  return {
    ownerId: "dev",
    sessionId: session.id,
    mediaId: MEDIA,
    model: partial.taggedBy === "ai" ? "gemini-2.5-flash" : null,
    reaction: partial.reaction ?? null,
    createdAt: "2026-09-26T01:00:00.000Z",
    ...partial,
  };
}

const clips: Clip[] = [
  clip({ id: "low", startMs: 12_000, endMs: 16_000, skill: "cutback", taggedBy: "ai", confidence: 0.31, confirmed: false }),
  clip({ id: "high", startMs: 40_000, endMs: 48_000, skill: "bottom_turn", taggedBy: "ai", confidence: 0.86, confirmed: false }),
  clip({ id: "done", startMs: 4_000, endMs: 9_000, skill: "takeoff", taggedBy: "user", confidence: null, confirmed: true, reaction: "nailed_it" }),
];

/** Synthetic review screen. No video file and no API — the timeline uses a fixed duration. */
export default function DevClipsPage() {
  return <ClipReview session={session} initialClips={clips} preview durationHintMs={90_000} />;
}
