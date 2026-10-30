import { goalPoints, sessionAchieved } from "./goal";
import {
  bi,
  isLevelKey,
  levelKeyOf,
  SLOTS,
  starterSkill,
  starterSkills,
  starterStep,
  type Group,
  type LevelKey,
  type LevelN,
  type TrackId,
} from "./goal-roadmap";
import type { Lang } from "./i18n";

/**
 * A user's own roadmap (SURFLOG-38): pure helpers, shared by the server
 * (lib/roadmap-service.ts) and the client (components/roadmap.tsx, the goal
 * card). See CLAUDE.md "Roadmap".
 *
 * Blocks: each user starts with a copy of the starter roadmap
 * (lib/goal-roadmap.ts) and builds on it. A block copied from the starter
 * keeps its `templateKey`: it shows the catalogue's wording in the viewer's
 * language and can't be renamed. A block the user made has `templateKey`
 * null and its own `name` / `text`.
 *
 * Next session: the roadmap does NOT store which steps are on the list. The
 * existing "goal for next session" (`goals.text`, lib/goal.ts) is the list;
 * a step is on it when a goal point has the step's wording (either language
 * for a default step), and a step's progress is the number of sessions that
 * ticked that wording, exactly like the goal card's counts.
 */

export type RoadmapProfile = { level: LevelN; track: TrackId | null };
export type RoadmapStep = {
  id: string;
  skillId: string;
  templateKey: string | null;
  text: string | null;
  sortOrder: number;
  doneAt: string | null;
  /** Ticked-session count when "Not yet" was answered; asks again ASK_AFTER later. */
  snoozeFrom: number | null;
};
export type RoadmapSkill = {
  id: string;
  levelKey: LevelKey;
  group: Group;
  templateKey: string | null;
  name: string | null;
  working: boolean;
  sortOrder: number;
  steps: RoadmapStep[];
};
export type Roadmap = { profile: RoadmapProfile | null; skills: RoadmapSkill[] };
/** What every roadmap route answers: the roadmap plus the current goal (the next-session list). */
export type RoadmapPayload = Roadmap & { goal: string | null };

export const MAX_SKILL_NAME = 60;
export const MAX_STEP_TEXT = 80;
export const MAX_SKILLS = 200;
export const MAX_STEPS_PER_SKILL = 30;
export const MAX_WORKING = 3;
/** Ticked sessions before the goal card asks "Learned it?", and again after "Not yet". */
export const ASK_AFTER = 3;

type Ticked = Parameters<typeof sessionAchieved>[0];

export function skillLabel(sk: Pick<RoadmapSkill, "name" | "templateKey">, lang: Lang): string {
  const starter = starterSkill(sk.templateKey);
  return starter ? bi(starter.name, lang) : (sk.name ?? "");
}

export function stepLabel(st: Pick<RoadmapStep, "text" | "templateKey">, lang: Lang): string {
  const starter = starterStep(st.templateKey);
  return starter ? bi(starter.text, lang) : (st.text ?? "");
}

/** Every wording a goal point may use for this step. */
export function stepWordings(st: Pick<RoadmapStep, "text" | "templateKey">): string[] {
  const starter = starterStep(st.templateKey);
  const all = starter ? [starter.text.en, starter.text.zh] : [st.text ?? ""];
  return [...new Set(all.map((w) => w.trim()).filter(Boolean))];
}

export const isDefault = (b: { templateKey: string | null }) => b.templateKey != null;

/** Skills reorder within a shelf: one level, one group ("yours" for the user's own). */
export const shelfOf = (sk: Pick<RoadmapSkill, "levelKey" | "group" | "templateKey">) =>
  `${sk.levelKey}|${sk.templateKey ? sk.group : "yours"}`;

export const skillDone = (sk: RoadmapSkill) => sk.steps.length > 0 && sk.steps.every((st) => st.doneAt != null);

/** The slot the user is on now, or null (no level yet, or level 3 with no track). */
export function currentKey(profile: RoadmapProfile | null): LevelKey | null {
  return profile ? levelKeyOf(profile.level, profile.track) : null;
}

/** In how many sessions this step was ticked, by any of its wordings (a session counts once). */
export function stepTicks(st: Pick<RoadmapStep, "text" | "templateKey">, sessions: Ticked[]): number {
  const words = stepWordings(st);
  let n = 0;
  for (const s of sessions) {
    const achieved = sessionAchieved(s);
    if (words.some((w) => achieved.includes(w))) n++;
  }
  return n;
}

/** The goal point that puts this step on next session, if any. */
export function goalPointFor(st: Pick<RoadmapStep, "text" | "templateKey">, goal: string | null): string | null {
  const points = goalPoints(goal);
  return stepWordings(st).find((w) => points.includes(w)) ?? null;
}

/** Goal point wording → the name of the roadmap skill it belongs to, for
 *  captions under goal points (goal card, log form, edit panel). A wording
 *  used by steps of two skills names the first. */
export function pointSkills(roadmap: Roadmap | null, lang: Lang): Map<string, string> {
  const map = new Map<string, string>();
  for (const sk of roadmap?.skills ?? []) {
    for (const st of sk.steps) {
      for (const w of stepWordings(st)) if (!map.has(w)) map.set(w, skillLabel(sk, lang));
    }
  }
  return map;
}

export type StepRef = { skill: RoadmapSkill; step: RoadmapStep };

/** Steps on next session, not learned yet, ticked in enough sessions to ask "Learned it?". */
export function learnedPrompts(roadmap: Roadmap, goal: string | null, sessions: Ticked[]): (StepRef & { ticks: number })[] {
  const out: (StepRef & { ticks: number })[] = [];
  for (const skill of roadmap.skills) {
    for (const step of skill.steps) {
      if (step.doneAt || !goalPointFor(step, goal)) continue;
      const ticks = stepTicks(step, sessions);
      if (ticks >= Math.max(ASK_AFTER, (step.snoozeFrom ?? 0) + ASK_AFTER)) out.push({ skill, step, ticks });
    }
  }
  return out;
}

/** The next unlearned step of each skill being worked on that isn't on next session yet. */
export function suggestions(roadmap: Roadmap, goal: string | null): StepRef[] {
  return roadmap.skills
    .filter((sk) => sk.working)
    .flatMap((skill) => {
      const step = skill.steps.find((st) => !st.doneAt && !goalPointFor(st, goal));
      return step ? [{ skill, step }] : [];
    });
}

/** Skills in the user's current slot, and how many are learned. */
export function levelProgress(roadmap: Roadmap): { done: number; total: number } {
  const key = currentKey(roadmap.profile);
  const skills = roadmap.skills.filter((sk) => sk.levelKey === key);
  return { done: skills.filter(skillDone).length, total: skills.length };
}

/** A typed skill name or step: one line, spaces collapsed, 1..max characters; null if not. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return t && t.length <= max ? t : null;
}

export const parseLevelKey = (v: unknown): LevelKey | null => (isLevelKey(v) ? v : null);

/** Moves `activeId` to where `overId` is (drag and drop); unchanged if either is missing. */
export function reorderIds(ids: string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** The starter blocks of one slot as fresh rows (new ids, no progress). */
export function starterRows(key: LevelKey, newId: () => string, startOrder = 0): RoadmapSkill[] {
  const slot = SLOTS.find((s) => s.key === key);
  if (!slot) return [];
  return starterSkills(slot).map((sk, i) => {
    const id = newId();
    return {
      id,
      levelKey: key,
      group: sk.group,
      templateKey: sk.id,
      name: null,
      working: false,
      sortOrder: startOrder + i,
      steps: sk.steps.map((st, j) => ({
        id: newId(),
        skillId: id,
        templateKey: st.id,
        text: null,
        sortOrder: j,
        doneAt: null,
        snoozeFrom: null,
      })),
    };
  });
}

/** Every slot's starter blocks: what a user gets the first time they pick a level. */
export function seedRows(newId: () => string): RoadmapSkill[] {
  return SLOTS.flatMap((slot) => starterRows(slot.key, newId));
}
