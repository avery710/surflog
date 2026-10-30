/**
 * The goal roadmap's rows (SURFLOG-38): tables `roadmap_profile`,
 * `roadmap_skills`, `roadmap_steps`
 * (supabase/migrations/20261029000000_create_roadmap.sql). Every query is
 * scoped to `ownerId`. Server-side only; changes go through
 * lib/roadmap-service.ts.
 *
 * Fails soft like spot pins: until the migration is applied, reads through
 * roadmapSoftly() give null (the page says it isn't switched on yet, the
 * goal card leaves the roadmap out) and writes throw
 * RoadmapTableMissingError (→ 503).
 */
import { getSupabase } from "./supabase";
import { isMissingTable } from "./spot-store";
import type { LevelKey } from "./goal-roadmap";
import type { Roadmap, RoadmapProfile, RoadmapSkill, RoadmapStep } from "./roadmap";

export const MIGRATION = "supabase/migrations/20261029000000_create_roadmap.sql";

export class RoadmapTableMissingError extends Error {
  constructor() {
    super(`The roadmap tables don't exist yet — apply ${MIGRATION} first.`);
    this.name = "RoadmapTableMissingError";
  }
}

const fail = (e: { code?: string; message: string }) =>
  isMissingTable(e) ? new RoadmapTableMissingError() : new Error(`Supabase: ${e.message}`);

type SkillRow = {
  id: string;
  level_key: LevelKey;
  grp: RoadmapSkill["group"];
  template_key: string | null;
  name: string | null;
  working: boolean;
  sort_order: number;
};
type StepRow = {
  id: string;
  skill_id: string;
  template_key: string | null;
  text: string | null;
  sort_order: number;
  done_at: string | null;
  snooze_from: number | null;
};

const SKILL_COLS = "id, level_key, grp, template_key, name, working, sort_order";
const STEP_COLS = "id, skill_id, template_key, text, sort_order, done_at, snooze_from";

function toStep(r: StepRow): RoadmapStep {
  return {
    id: r.id,
    skillId: r.skill_id,
    templateKey: r.template_key,
    text: r.text,
    sortOrder: r.sort_order,
    doneAt: r.done_at,
    snoozeFrom: r.snooze_from,
  };
}

/** The owner's whole roadmap: three queries at once (~30 skills, ~80 steps). */
export async function getRoadmap(ownerId: string): Promise<Roadmap> {
  const db = getSupabase();
  const [profile, skills, steps] = await Promise.all([
    db.from("roadmap_profile").select("level, track").eq("owner_id", ownerId).maybeSingle(),
    db.from("roadmap_skills").select(SKILL_COLS).eq("owner_id", ownerId).order("sort_order").order("created_at"),
    db.from("roadmap_steps").select(STEP_COLS).eq("owner_id", ownerId).order("sort_order").order("created_at"),
  ]);
  for (const r of [profile, skills, steps]) if (r.error) throw fail(r.error);
  const bySkill = new Map<string, RoadmapStep[]>();
  for (const r of (steps.data ?? []) as StepRow[]) {
    const list = bySkill.get(r.skill_id) ?? [];
    list.push(toStep(r));
    bySkill.set(r.skill_id, list);
  }
  return {
    profile: (profile.data as RoadmapProfile | null) ?? null,
    skills: ((skills.data ?? []) as SkillRow[]).map((r) => ({
      id: r.id,
      levelKey: r.level_key,
      group: r.grp,
      templateKey: r.template_key,
      name: r.name,
      working: r.working,
      sortOrder: r.sort_order,
      steps: bySkill.get(r.id) ?? [],
    })),
  };
}

/** For pages: null when the tables are missing (migration pending) or the read fails. */
export async function roadmapSoftly(ownerId: string): Promise<Roadmap | null> {
  try {
    return await getRoadmap(ownerId);
  } catch (e) {
    if (e instanceof RoadmapTableMissingError) console.info("[roadmap] tables missing — migration pending");
    else console.error("[roadmap] read failed", e);
    return null;
  }
}

export async function upsertProfile(ownerId: string, profile: RoadmapProfile): Promise<void> {
  const { error } = await getSupabase()
    .from("roadmap_profile")
    .upsert({ owner_id: ownerId, level: profile.level, track: profile.track, updated_at: new Date().toISOString() });
  if (error) throw fail(error);
}

/** Inserts skills with their steps (ids already chosen by the caller). */
export async function insertSkills(ownerId: string, skills: RoadmapSkill[]): Promise<void> {
  if (!skills.length) return;
  const db = getSupabase();
  const s = await db.from("roadmap_skills").insert(
    skills.map((sk) => ({
      id: sk.id,
      owner_id: ownerId,
      level_key: sk.levelKey,
      grp: sk.group,
      template_key: sk.templateKey,
      name: sk.name,
      working: sk.working,
      sort_order: sk.sortOrder,
    })),
  );
  if (s.error) throw fail(s.error);
  await insertSteps(
    ownerId,
    skills.flatMap((sk) => sk.steps),
  );
}

export async function insertSteps(ownerId: string, steps: RoadmapStep[]): Promise<void> {
  if (!steps.length) return;
  const { error } = await getSupabase()
    .from("roadmap_steps")
    .insert(
      steps.map((st) => ({
        id: st.id,
        owner_id: ownerId,
        skill_id: st.skillId,
        template_key: st.templateKey,
        text: st.text,
        sort_order: st.sortOrder,
        done_at: st.doneAt,
        snooze_from: st.snoozeFrom,
      })),
    );
  if (error) throw fail(error);
}

export type SkillPatch = Partial<{ name: string; working: boolean; level_key: LevelKey; sort_order: number }>;
export type StepPatch = Partial<{
  text: string;
  skill_id: string;
  sort_order: number;
  done_at: string | null;
  snooze_from: number | null;
}>;

export async function updateSkill(ownerId: string, id: string, patch: SkillPatch): Promise<void> {
  const { error } = await getSupabase().from("roadmap_skills").update(patch).eq("owner_id", ownerId).eq("id", id);
  if (error) throw fail(error);
}

export async function updateStep(ownerId: string, id: string, patch: StepPatch): Promise<void> {
  const { error } = await getSupabase().from("roadmap_steps").update(patch).eq("owner_id", ownerId).eq("id", id);
  if (error) throw fail(error);
}

/** Clears "working on" from every skill of the owner (a new level starts fresh). */
export async function clearWorking(ownerId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("roadmap_skills")
    .update({ working: false })
    .eq("owner_id", ownerId)
    .eq("working", true);
  if (error) throw fail(error);
}

/** Deletes skills (their steps go with them, on delete cascade). */
export async function deleteSkills(ownerId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await getSupabase().from("roadmap_skills").delete().eq("owner_id", ownerId).in("id", ids);
  if (error) throw fail(error);
}

export async function deleteStep(ownerId: string, id: string): Promise<void> {
  const { error } = await getSupabase().from("roadmap_steps").delete().eq("owner_id", ownerId).eq("id", id);
  if (error) throw fail(error);
}

/** sort_order = position in `ids`. One update per row: a shelf is a handful of rows. */
export async function setOrder(ownerId: string, table: "roadmap_skills" | "roadmap_steps", ids: string[]): Promise<void> {
  const db = getSupabase();
  const results = await Promise.all(
    ids.map((id, i) => db.from(table).update({ sort_order: i }).eq("owner_id", ownerId).eq("id", id)),
  );
  for (const r of results) if (r.error) throw fail(r.error);
}
