import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Roadmap, RoadmapSkill } from "@/lib/roadmap";

const { auth, store, db, RoadmapTableMissingError } = vi.hoisted(() => ({
  auth: vi.fn(),
  store: {
    getRoadmap: vi.fn(),
    insertSkills: vi.fn(),
    insertSteps: vi.fn(),
    updateSkill: vi.fn(),
    updateStep: vi.fn(),
    deleteSkills: vi.fn(),
    deleteStep: vi.fn(),
    setOrder: vi.fn(),
    upsertProfile: vi.fn(),
    clearWorking: vi.fn(),
  },
  db: { getGoal: vi.fn(), setGoal: vi.fn(), renameGoalPointsInSessions: vi.fn() },
  RoadmapTableMissingError: class extends Error {},
}));
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/roadmap-store", () => ({ ...store, RoadmapTableMissingError }));

import { GET } from "@/app/api/roadmap/route";
import { PUT as putProfile } from "@/app/api/roadmap/profile/route";
import { POST as postSkill } from "@/app/api/roadmap/skills/route";
import { DELETE as deleteSkill, PATCH as patchSkill } from "@/app/api/roadmap/skills/[id]/route";
import { PATCH as patchStep } from "@/app/api/roadmap/steps/[id]/route";
import { PUT as putOrder } from "@/app/api/roadmap/order/route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/roadmap", { method: "POST", body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const step = (id: string, skillId: string, extra = {}) => ({
  id,
  skillId,
  templateKey: null,
  text: `Step ${id}`,
  sortOrder: 0,
  doneAt: null,
  snoozeFrom: null,
  ...extra,
});
const skill = (id: string, extra: Partial<RoadmapSkill> = {}): RoadmapSkill => ({
  id,
  levelKey: "1",
  group: "ride",
  templateKey: null,
  name: `Skill ${id}`,
  working: false,
  sortOrder: 0,
  steps: [],
  ...extra,
});

let roadmap: Roadmap;
beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "owner-1" } });
  roadmap = {
    profile: { level: 1, track: null },
    skills: [
      skill("own", { steps: [step("own-step", "own")] }),
      skill("def", {
        templateKey: "l1.read",
        name: null,
        steps: [step("def-step", "def", { templateKey: "l1.read.peak", text: null })],
      }),
    ],
  };
  store.getRoadmap.mockImplementation(async () => roadmap);
  db.getGoal.mockResolvedValue(null);
});

describe("roadmap routes", () => {
  it("are 401 without a session and never touch the store", async () => {
    auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(store.getRoadmap).not.toHaveBeenCalled();
  });

  it("read only the caller's own roadmap", async () => {
    const res = await GET();
    expect(store.getRoadmap).toHaveBeenCalledWith("owner-1");
    expect((await res.json()).skills).toHaveLength(2);
  });

  it("answer 404 for an id that isn't the caller's", async () => {
    expect((await patchSkill(req({ working: true }), params("someone-elses"))).status).toBe(404);
    expect((await deleteSkill(req(null), params("someone-elses"))).status).toBe(404);
    expect(store.deleteSkills).not.toHaveBeenCalled();
  });

  it("refuse to rename a default block, allow the user's own", async () => {
    expect((await patchSkill(req({ name: "Mine now" }), params("def"))).status).toBe(400);
    expect((await patchStep(req({ text: "Mine now" }), params("def-step"))).status).toBe(400);
    expect((await patchSkill(req({ name: "  Left  take-off " }), params("own"))).status).toBe(200);
    expect(store.updateSkill).toHaveBeenCalledWith("owner-1", "own", { name: "Left take-off" });
  });

  it("carry a renamed own step's goal point and session ticks along", async () => {
    db.getGoal.mockResolvedValue("Step own-step\nOther");
    await patchStep(req({ text: "Fresh wording" }), params("own-step"));
    expect(db.setGoal).toHaveBeenCalledWith("owner-1", "Fresh wording\nOther");
    expect(db.renameGoalPointsInSessions).toHaveBeenCalledWith("owner-1", [{ from: "Step own-step", to: "Fresh wording" }]);
  });

  it("take a learned step off next session", async () => {
    db.getGoal.mockResolvedValue("Spot where the peak forms\nOther");
    await patchStep(req({ done: true }), params("def-step"));
    expect(db.setGoal).toHaveBeenCalledWith("owner-1", "Other");
  });

  it("cap 'working on' at 3 skills, current level only", async () => {
    roadmap.skills.push(...["a", "b", "c"].map((id) => skill(id, { working: true })));
    expect((await patchSkill(req({ working: true }), params("own"))).status).toBe(400);
    roadmap.skills = [skill("far", { levelKey: "2" })];
    expect((await patchSkill(req({ working: true }), params("far"))).status).toBe(400);
  });

  it("seed the starter blocks on the first level pick only", async () => {
    roadmap = { profile: null, skills: [] };
    await putProfile(req({ level: 0 }));
    expect(store.insertSkills).toHaveBeenCalledTimes(1);
    expect(store.upsertProfile).toHaveBeenCalledWith("owner-1", { level: 0, track: null });
    expect((await putProfile(req({ level: 7 }))).status).toBe(400);
  });

  it("reorder only within one shelf", async () => {
    roadmap.skills.push(skill("own2"));
    expect((await putOrder(req({ skills: ["own2", "own"] }))).status).toBe(200);
    expect(store.setOrder).toHaveBeenCalledWith("owner-1", "roadmap_skills", ["own2", "own"]);
    expect((await putOrder(req({ skills: ["own", "def"] }))).status).toBe(400);
  });

  it("put a removed block back for Undo, with new ids", async () => {
    const res = await postSkill(
      req({ restore: { levelKey: "1", name: "Back again", steps: [{ text: "One", doneAt: "2026-10-01T00:00:00Z" }] } }),
    );
    expect(res.status).toBe(200);
    const [, [restored]] = store.insertSkills.mock.calls[0];
    expect(restored).toMatchObject({ name: "Back again", templateKey: null });
    expect(restored.steps[0]).toMatchObject({ text: "One", doneAt: "2026-10-01T00:00:00.000Z" });
  });

  it("say 503 until the migration is applied", async () => {
    store.getRoadmap.mockRejectedValue(new RoadmapTableMissingError());
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
