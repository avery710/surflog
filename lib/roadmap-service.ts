/**
 * Every change to a user's roadmap (SURFLOG-38), shared by the routes under
 * app/api/roadmap/**. Like lib/session-service.ts: each function takes
 * `ownerId` and the raw, untrusted body, validates it here, checks
 * ownership itself (a foreign or unknown id is 404, never 403), and returns
 * a result instead of an HTTP response.
 *
 * Every success returns the whole roadmap plus the current goal, so the
 * client can replace its copy in one go (the roadmap is ~30 skills).
 *
 * Rules (Avery, 2026-10-28): default blocks (copied from the starter, with a
 * template key) can't be renamed; the four levels are fixed; at most
 * MAX_WORKING skills are "working on". Removing a block leaves any goal
 * point with its wording alone (it just stops being linked).
 */
import { randomUUID } from "node:crypto";
import { getGoal, renameGoalPointsInSessions, setGoal } from "@/lib/db";
import { applyGoalRenames, goalPoints, joinGoalPoints } from "@/lib/goal";
import { LEVELS, levelKeyOf, starterSkill, starterStep, type LevelN, type TrackId } from "@/lib/goal-roadmap";
import {
  cleanText,
  currentKey,
  goalPointFor,
  MAX_SKILL_NAME,
  MAX_SKILLS,
  MAX_STEP_TEXT,
  MAX_STEPS_PER_SKILL,
  MAX_WORKING,
  parseLevelKey,
  seedRows,
  shelfOf,
  starterRows,
  stepWordings,
  type Roadmap,
  type RoadmapPayload,
  type RoadmapSkill,
  type RoadmapStep,
} from "@/lib/roadmap";
import {
  clearWorking,
  deleteSkills,
  deleteStep,
  getRoadmap,
  insertSkills,
  insertSteps,
  RoadmapTableMissingError,
  setOrder,
  updateSkill,
  updateStep,
  upsertProfile,
  type SkillPatch,
  type StepPatch,
} from "@/lib/roadmap-store";

export type { RoadmapPayload };
export type RoadmapResult = { ok: true; data: RoadmapPayload } | { ok: false; status: 400 | 404 | 503; error: string };

const fail = (status: 400 | 404 | 503, error: string) => ({ ok: false as const, status, error });
const NOT_ON = "the roadmap isn't switched on yet — the 20261029000000 migration hasn't been applied";
const DEFAULT_NO_RENAME = "default blocks can't be renamed";

const body = (input: unknown) => (input && typeof input === "object" ? (input as Record<string, unknown>) : {});

/** Runs a change and answers with the fresh roadmap; a missing table is 503. */
async function run(
  ownerId: string,
  change: (roadmap: Roadmap) => Promise<RoadmapResult | void>,
): Promise<RoadmapResult> {
  try {
    const roadmap = await getRoadmap(ownerId);
    const early = await change(roadmap);
    if (early) return early;
    const [fresh, goal] = await Promise.all([getRoadmap(ownerId), getGoal(ownerId)]);
    return { ok: true, data: { ...fresh, goal } };
  } catch (e) {
    if (e instanceof RoadmapTableMissingError) return fail(503, NOT_ON);
    throw e;
  }
}

export function getRoadmapFor(ownerId: string): Promise<RoadmapResult> {
  return run(ownerId, async () => {});
}

const findSkill = (r: Roadmap, id: unknown) => (typeof id === "string" ? r.skills.find((s) => s.id === id) : undefined);
function findStep(r: Roadmap, id: unknown): { skill: RoadmapSkill; step: RoadmapStep } | undefined {
  if (typeof id !== "string") return undefined;
  for (const skill of r.skills) {
    const step = skill.steps.find((s) => s.id === id);
    if (step) return { skill, step };
  }
}
const nextOrder = (items: { sortOrder: number }[]) => items.reduce((m, x) => Math.max(m, x.sortOrder + 1), 0);

/** Pick (or change) your level and, on level 3, your track. The first pick seeds the starter blocks. */
export function setProfileFor(ownerId: string, input: unknown): Promise<RoadmapResult> {
  const b = body(input);
  const level = typeof b.level === "number" && LEVELS.some((l) => l.n === b.level) ? (b.level as LevelN) : null;
  if (level == null) return Promise.resolve(fail(400, "level must be 0, 1, 2 or 3"));
  const track = level === 3 && (b.track === "long" || b.track === "short") ? (b.track as TrackId) : null;
  return run(ownerId, async (r) => {
    if (!r.skills.length) await insertSkills(ownerId, seedRows(randomUUID));
    const before = currentKey(r.profile);
    await upsertProfile(ownerId, { level, track });
    if (before !== levelKeyOf(level, track)) await clearWorking(ownerId);
  });
}

/**
 * Add a skill to a level: your own (`name`), a fresh copy of a starter block
 * (`templateKey`, the library), or a removed block put back (`restore`, for
 * Undo: wording, progress and order come back; ids are new).
 */
export function createSkillFor(ownerId: string, input: unknown): Promise<RoadmapResult> {
  const b = body(input);
  return run(ownerId, async (r) => {
    if (r.skills.length >= MAX_SKILLS) return fail(400, `a roadmap holds at most ${MAX_SKILLS} skills`);

    if (b.restore && typeof b.restore === "object") {
      const skill = parseRestore(b.restore);
      if (!skill) return fail(400, "invalid restore");
      await insertSkills(ownerId, [skill]);
      return;
    }

    const levelKey = parseLevelKey(b.levelKey);
    if (!levelKey) return fail(400, "invalid levelKey");
    if (b.templateKey !== undefined) {
      const starter = starterSkill(typeof b.templateKey === "string" ? b.templateKey : null);
      if (!starter) return fail(400, "unknown templateKey");
      const shelf = r.skills.filter((s) => shelfOf(s) === `${levelKey}|${starter.group}`);
      const id = randomUUID();
      await insertSkills(ownerId, [
        {
          id,
          levelKey,
          group: starter.group,
          templateKey: starter.id,
          name: null,
          working: false,
          sortOrder: nextOrder(shelf),
          steps: starter.steps.map((st, i) => ({
            id: randomUUID(),
            skillId: id,
            templateKey: st.id,
            text: null,
            sortOrder: i,
            doneAt: null,
            snoozeFrom: null,
          })),
        },
      ]);
      return;
    }

    const name = cleanText(b.name, MAX_SKILL_NAME);
    if (!name) return fail(400, `name must be 1–${MAX_SKILL_NAME} characters`);
    const shelf = r.skills.filter((s) => shelfOf(s) === `${levelKey}|yours`);
    await insertSkills(ownerId, [
      { id: randomUUID(), levelKey, group: "ride", templateKey: null, name, working: false, sortOrder: nextOrder(shelf), steps: [] },
    ]);
  });
}

function parseRestore(v: object): RoadmapSkill | null {
  const x = v as Record<string, unknown>;
  const levelKey = parseLevelKey(x.levelKey);
  const templateKey = typeof x.templateKey === "string" ? x.templateKey : null;
  const starter = starterSkill(templateKey);
  if (!levelKey || (templateKey && !starter)) return null;
  const name = starter ? null : cleanText(x.name, MAX_SKILL_NAME);
  if (!starter && !name) return null;
  const group = starter ? starter.group : "ride";
  const id = randomUUID();
  const rawSteps = Array.isArray(x.steps) ? x.steps.slice(0, MAX_STEPS_PER_SKILL) : [];
  const steps: RoadmapStep[] = [];
  for (const [i, s] of rawSteps.entries()) {
    const step = parseStep(s, id, i);
    if (!step) return null;
    steps.push(step);
  }
  return {
    id,
    levelKey,
    group,
    templateKey,
    name,
    working: false,
    sortOrder: typeof x.sortOrder === "number" ? Math.max(0, Math.floor(x.sortOrder)) : 0,
    steps,
  };
}

function parseStep(v: unknown, skillId: string, fallbackOrder: number): RoadmapStep | null {
  if (!v || typeof v !== "object") return null;
  const x = v as Record<string, unknown>;
  const templateKey = typeof x.templateKey === "string" ? x.templateKey : null;
  if (templateKey && !starterStep(templateKey)) return null;
  const text = templateKey ? null : cleanText(x.text, MAX_STEP_TEXT);
  if (!templateKey && !text) return null;
  const doneAt = typeof x.doneAt === "string" && !Number.isNaN(Date.parse(x.doneAt)) ? new Date(x.doneAt).toISOString() : null;
  const snoozeFrom = typeof x.snoozeFrom === "number" && x.snoozeFrom >= 0 ? Math.floor(x.snoozeFrom) : null;
  return {
    id: randomUUID(),
    skillId,
    templateKey,
    text,
    sortOrder: typeof x.sortOrder === "number" ? Math.max(0, Math.floor(x.sortOrder)) : fallbackOrder,
    doneAt,
    snoozeFrom,
  };
}

/** Rename (own skills only), toggle "working on", or move to another level. */
export function updateSkillFor(ownerId: string, id: string, input: unknown): Promise<RoadmapResult> {
  const b = body(input);
  return run(ownerId, async (r) => {
    const skill = findSkill(r, id);
    if (!skill) return fail(404, "not found");
    const patch: SkillPatch = {};

    if (b.name !== undefined) {
      if (skill.templateKey) return fail(400, DEFAULT_NO_RENAME);
      const name = cleanText(b.name, MAX_SKILL_NAME);
      if (!name) return fail(400, `name must be 1–${MAX_SKILL_NAME} characters`);
      patch.name = name;
    }

    if (b.levelKey !== undefined) {
      const levelKey = parseLevelKey(b.levelKey);
      if (!levelKey) return fail(400, "invalid levelKey");
      if (levelKey !== skill.levelKey) {
        patch.level_key = levelKey;
        patch.sort_order = nextOrder(r.skills.filter((s) => shelfOf(s) === shelfOf({ ...skill, levelKey })));
        if (levelKey !== currentKey(r.profile)) patch.working = false;
      }
    }

    if (b.working !== undefined) {
      if (typeof b.working !== "boolean") return fail(400, "working must be true or false");
      if (b.working && !skill.working) {
        if ((patch.level_key ?? skill.levelKey) !== currentKey(r.profile))
          return fail(400, "only skills on your current level can be worked on");
        if (r.skills.filter((s) => s.working).length >= MAX_WORKING)
          return fail(400, `you can work on ${MAX_WORKING} skills at once`);
      }
      patch.working = b.working;
    }

    if (Object.keys(patch).length) await updateSkill(ownerId, skill.id, patch);
  });
}

export function deleteSkillFor(ownerId: string, id: string): Promise<RoadmapResult> {
  return run(ownerId, async (r) => {
    const skill = findSkill(r, id);
    if (!skill) return fail(404, "not found");
    await deleteSkills(ownerId, [skill.id]);
  });
}

/** Add a step to a skill: your own (`text`), a copy of another step (`fromStepId`), or a removed one put back (`restore`). */
export function createStepFor(ownerId: string, skillId: string, input: unknown): Promise<RoadmapResult> {
  const b = body(input);
  return run(ownerId, async (r) => {
    const skill = findSkill(r, skillId);
    if (!skill) return fail(404, "not found");
    if (skill.steps.length >= MAX_STEPS_PER_SKILL) return fail(400, `a skill holds at most ${MAX_STEPS_PER_SKILL} steps`);
    const order = nextOrder(skill.steps);

    let step: RoadmapStep | null;
    if (b.restore !== undefined) {
      step = parseStep(b.restore, skill.id, order);
      if (!step) return fail(400, "invalid restore");
    } else if (b.fromStepId !== undefined) {
      const from = findStep(r, b.fromStepId);
      if (!from) return fail(404, "not found");
      step = { ...from.step, id: randomUUID(), skillId: skill.id, sortOrder: order, doneAt: null, snoozeFrom: null };
    } else {
      const text = cleanText(b.text, MAX_STEP_TEXT);
      if (!text) return fail(400, `text must be 1–${MAX_STEP_TEXT} characters`);
      step = { id: randomUUID(), skillId: skill.id, templateKey: null, text, sortOrder: order, doneAt: null, snoozeFrom: null };
    }
    await insertSteps(ownerId, [step]);
  });
}

/**
 * Rename (own steps only; a goal point with the old wording, and the
 * sessions that ticked it, follow), move to another skill, mark learned
 * (`done`; also takes it off next session) or answer "Not yet" (`snoozeFrom`).
 */
export function updateStepFor(ownerId: string, id: string, input: unknown): Promise<RoadmapResult> {
  const b = body(input);
  return run(ownerId, async (r) => {
    const found = findStep(r, id);
    if (!found) return fail(404, "not found");
    const { step } = found;
    const patch: StepPatch = {};

    if (b.text !== undefined) {
      if (step.templateKey) return fail(400, DEFAULT_NO_RENAME);
      const text = cleanText(b.text, MAX_STEP_TEXT);
      if (!text) return fail(400, `text must be 1–${MAX_STEP_TEXT} characters`);
      patch.text = text;
    }

    if (b.skillId !== undefined && b.skillId !== found.skill.id) {
      const target = findSkill(r, b.skillId);
      if (!target) return fail(404, "not found");
      if (target.steps.length >= MAX_STEPS_PER_SKILL) return fail(400, `a skill holds at most ${MAX_STEPS_PER_SKILL} steps`);
      patch.skill_id = target.id;
      patch.sort_order = nextOrder(target.steps);
    }

    if (b.done !== undefined) {
      if (typeof b.done !== "boolean") return fail(400, "done must be true or false");
      patch.done_at = b.done ? new Date().toISOString() : null;
      if (b.done) patch.snooze_from = null;
    }

    if (b.snoozeFrom !== undefined) {
      if (typeof b.snoozeFrom !== "number" || b.snoozeFrom < 0) return fail(400, "invalid snoozeFrom");
      patch.snooze_from = Math.floor(b.snoozeFrom);
    }

    if (!Object.keys(patch).length) return;
    await updateStep(ownerId, step.id, patch);

    const goal = await getGoal(ownerId);
    const point = goalPointFor(step, goal);
    if (patch.text && point) {
      const renames = [{ from: point, to: patch.text }];
      const next = applyGoalRenames(goal ?? "", renames);
      if (next != null) await setGoal(ownerId, next);
      await renameGoalPointsInSessions(ownerId, renames);
    }
    if (b.done === true && point) {
      const words = stepWordings(step);
      await setGoal(ownerId, joinGoalPoints(goalPoints(goal).filter((p) => !words.includes(p))));
    }
  });
}

export function deleteStepFor(ownerId: string, id: string): Promise<RoadmapResult> {
  return run(ownerId, async (r) => {
    const found = findStep(r, id);
    if (!found) return fail(404, "not found");
    await deleteStep(ownerId, found.step.id);
  });
}

/** Drag-and-drop order: `{ skills: ids }` for one shelf, or `{ skillId, steps: ids }` for one skill. */
export function reorderFor(ownerId: string, input: unknown): Promise<RoadmapResult> {
  const b = body(input);
  const ids = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null);
  return run(ownerId, async (r) => {
    if (b.skills !== undefined) {
      const list = ids(b.skills);
      const skills = list?.map((id) => findSkill(r, id));
      if (!list || !skills?.length || skills.some((s) => !s)) return fail(404, "not found");
      const shelf = shelfOf(skills[0]!);
      if (skills.some((s) => shelfOf(s!) !== shelf) || new Set(list).size !== list.length)
        return fail(400, "skills must be one shelf");
      await setOrder(ownerId, "roadmap_skills", list);
      return;
    }
    const skill = findSkill(r, b.skillId);
    if (!skill) return fail(404, "not found");
    const list = ids(b.steps);
    const mine = new Set(skill.steps.map((s) => s.id));
    if (!list || list.length !== mine.size || !list.every((id) => mine.has(id))) return fail(400, "steps must be that skill's steps");
    await setOrder(ownerId, "roadmap_steps", list);
  });
}

/** Put one level back to its starter blocks; "learned" marks on starter steps carry over. */
export function resetLevelFor(ownerId: string, input: unknown): Promise<RoadmapResult> {
  const levelKey = parseLevelKey(body(input).levelKey);
  if (!levelKey) return Promise.resolve(fail(400, "invalid levelKey"));
  return run(ownerId, async (r) => {
    const gone = r.skills.filter((s) => s.levelKey === levelKey);
    const kept = new Map(gone.flatMap((s) => s.steps.filter((st) => st.templateKey).map((st) => [st.templateKey!, st] as const)));
    const fresh = starterRows(levelKey, randomUUID).map((sk) => ({
      ...sk,
      steps: sk.steps.map((st) => {
        const old = kept.get(st.templateKey!);
        return old ? { ...st, doneAt: old.doneAt, snoozeFrom: old.snoozeFrom } : st;
      }),
    }));
    await deleteSkills(
      ownerId,
      gone.map((s) => s.id),
    );
    await insertSkills(ownerId, fresh);
  });
}
