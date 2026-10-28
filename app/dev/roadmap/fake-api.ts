import { goalPoints, joinGoalPoints } from "@/lib/goal";
import { isLevelKey, starterSkill, type LevelKey } from "@/lib/goal-roadmap";
import {
  goalPointFor,
  seedRows,
  shelfOf,
  starterRows,
  stepWordings,
  type RoadmapPayload,
  type RoadmapSkill,
  type RoadmapStep,
} from "@/lib/roadmap";

/**
 * Dev only (/dev/roadmap): an in-memory stand-in for app/api/roadmap/** and
 * PUT /api/goal, installed over window.fetch, so the real components run
 * without a database or a sign-in. Mirrors lib/roadmap-service.ts loosely
 * (the real rules are tested in tests/roadmap-routes.test.ts); nothing here
 * is saved.
 */

let seq = 0;
const id = () => `dev-${++seq}`;

export function fixture(kind: "midway" | "first"): RoadmapPayload {
  // same ids on the server render and in the browser (no hydration mismatch)
  seq = 0;
  if (kind === "first") return { profile: null, skills: [], goal: "Don't look at my feet" };
  const skills = seedRows(id);
  const find = (key: string) => skills.find((s) => s.templateKey === key)!;
  find("l1.read").working = true;
  find("l1.chase").working = true;
  for (const st of find("l1.out").steps) st.doneAt = "2026-10-20T00:00:00Z";
  find("l1.read").steps.push({ id: id(), skillId: find("l1.read").id, templateKey: null, text: "Count the waves in a set", sortOrder: 9, doneAt: null, snoozeFrom: null });
  const own = { id: id(), levelKey: "1" as LevelKey, group: "ride" as const, templateKey: null, name: "Fix my left-hand take-off", working: false, sortOrder: 0, steps: [] as RoadmapStep[] };
  own.steps = ["Look over my left shoulder early", "Front foot lands on the left side"].map((text, i) => ({ id: id(), skillId: own.id, templateKey: null, text, sortOrder: i, doneAt: null, snoozeFrom: null }));
  skills.push(own);
  return {
    profile: { level: 1, track: null },
    skills,
    goal: ["Spot where the peak forms", "Paddle early and hard", "Don't look at my feet"].join("\n"),
  };
}

/** Sessions for the counts: "Spot where the peak forms" ticked 3 times (so the
 *  goal card asks "Learned it?"), "Paddle early and hard" once. */
export const FIXTURE_SESSIONS = [
  ["Spot where the peak forms", "Paddle early and hard"],
  ["Spot where the peak forms"],
  ["看出浪峰會在哪裡立起來"],
  ["Don't look at my feet"],
].map((points) => ({ goalText: points.join("\n"), goalMet: true, goalPointsMet: points.map(() => true) }));

export function installFakeApi(start: RoadmapPayload, delayMs = 150): () => void {
  let db: RoadmapPayload = structuredClone(start);
  const real = window.fetch.bind(window);
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const err = (status: number, error: string) => new Response(JSON.stringify({ error }), { status });
  const skill = (sid: string) => db.skills.find((s) => s.id === sid);
  const step = (stid: string) => {
    for (const sk of db.skills) {
      const st = sk.steps.find((x) => x.id === stid);
      if (st) return { sk, st };
    }
  };
  const nextOrder = (xs: { sortOrder: number }[]) => xs.reduce((m, x) => Math.max(m, x.sortOrder + 1), 0);
  const restoreSteps = (raw: Partial<RoadmapStep>[], skillId: string) =>
    raw.map((x, i) => ({ id: id(), skillId, templateKey: x.templateKey ?? null, text: x.text ?? null, sortOrder: x.sortOrder ?? i, doneAt: x.doneAt ?? null, snoozeFrom: x.snoozeFrom ?? null }));

  function handle(path: string, method: string, b: Record<string, unknown>): Response {
    if (path === "/api/goal" && method === "PUT") {
      db = { ...db, goal: (b.text as string) || null };
      return ok({ text: db.goal });
    }
    if (path === "/api/roadmap" && method === "GET") return ok(db);
    if (path === "/api/roadmap/profile") {
      if (!db.skills.length) db.skills = seedRows(id);
      const track = b.level === 3 && (b.track === "long" || b.track === "short") ? b.track : null;
      const before = db.profile;
      db.profile = { level: b.level as 0, track };
      if (before?.level !== db.profile.level || before?.track !== track) db.skills = db.skills.map((s) => ({ ...s, working: false }));
      return ok(db);
    }
    if (path === "/api/roadmap/skills" && method === "POST") {
      if (b.restore) {
        const r = b.restore as RoadmapSkill;
        const nid = id();
        db.skills.push({ ...r, id: nid, working: false, steps: restoreSteps(r.steps, nid) });
      } else if (b.templateKey) {
        const starter = starterSkill(b.templateKey as string)!;
        const nid = id();
        db.skills.push({
          id: nid, levelKey: b.levelKey as LevelKey, group: starter.group, templateKey: starter.id, name: null, working: false,
          sortOrder: nextOrder(db.skills.filter((s) => shelfOf(s) === `${b.levelKey}|${starter.group}`)),
          steps: starter.steps.map((st, i) => ({ id: id(), skillId: nid, templateKey: st.id, text: null, sortOrder: i, doneAt: null, snoozeFrom: null })),
        });
      } else {
        db.skills.push({ id: id(), levelKey: b.levelKey as LevelKey, group: "ride", templateKey: null, name: b.name as string, working: false, sortOrder: 99, steps: [] });
      }
      return ok(db);
    }
    if (path === "/api/roadmap/order") {
      const order = (b.skills ?? b.steps) as string[];
      if (b.skills) db.skills = [...db.skills].sort((x, y) => (order.includes(x.id) && order.includes(y.id) ? order.indexOf(x.id) - order.indexOf(y.id) : 0));
      else {
        const sk = skill(b.skillId as string)!;
        sk.steps = order.map((sid) => sk.steps.find((s) => s.id === sid)!);
      }
      return ok(db);
    }
    if (path === "/api/roadmap/reset") {
      const key = b.levelKey as LevelKey;
      if (!isLevelKey(key)) return err(400, "invalid levelKey");
      db.skills = [...db.skills.filter((s) => s.levelKey !== key), ...starterRows(key, id)];
      return ok(db);
    }
    let m = path.match(/^\/api\/roadmap\/skills\/([^/]+)\/steps$/);
    if (m) {
      const sk = skill(m[1]);
      if (!sk) return err(404, "not found");
      if (b.restore) sk.steps.push(...restoreSteps([b.restore as RoadmapStep], sk.id));
      else if (b.fromStepId) {
        const from = step(b.fromStepId as string)!;
        sk.steps.push({ ...from.st, id: id(), skillId: sk.id, doneAt: null, snoozeFrom: null, sortOrder: nextOrder(sk.steps) });
      } else sk.steps.push({ id: id(), skillId: sk.id, templateKey: null, text: b.text as string, sortOrder: nextOrder(sk.steps), doneAt: null, snoozeFrom: null });
      return ok(db);
    }
    m = path.match(/^\/api\/roadmap\/skills\/([^/]+)$/);
    if (m) {
      const sk = skill(m[1]);
      if (!sk) return err(404, "not found");
      if (method === "DELETE") db.skills = db.skills.filter((s) => s !== sk);
      else {
        if (b.name !== undefined) {
          if (sk.templateKey) return err(400, "default blocks can't be renamed");
          sk.name = b.name as string;
        }
        if (b.levelKey !== undefined) sk.levelKey = b.levelKey as LevelKey;
        if (b.working !== undefined) {
          if (b.working && db.skills.filter((s) => s.working).length >= 3) return err(400, "you can work on 3 skills at once");
          sk.working = b.working as boolean;
        }
      }
      return ok(db);
    }
    m = path.match(/^\/api\/roadmap\/steps\/([^/]+)$/);
    if (m) {
      const found = step(m[1]);
      if (!found) return err(404, "not found");
      const { sk, st } = found;
      if (method === "DELETE") sk.steps = sk.steps.filter((x) => x !== st);
      else {
        if (b.text !== undefined) {
          if (st.templateKey) return err(400, "default blocks can't be renamed");
          const point = goalPointFor(st, db.goal);
          st.text = b.text as string;
          if (point) db.goal = joinGoalPoints(goalPoints(db.goal).map((p) => (p === point ? st.text! : p)));
        }
        if (b.skillId !== undefined) {
          sk.steps = sk.steps.filter((x) => x !== st);
          skill(b.skillId as string)!.steps.push({ ...st, skillId: b.skillId as string });
        }
        if (b.done !== undefined) {
          st.doneAt = b.done ? new Date().toISOString() : null;
          if (b.done) db.goal = joinGoalPoints(goalPoints(db.goal).filter((p) => !stepWordings(st).includes(p))) || null;
        }
        if (b.snoozeFrom !== undefined) st.snoozeFrom = b.snoozeFrom as number;
      }
      return ok(db);
    }
    return err(404, `fake api: no ${method} ${path}`);
  }

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, location.origin).pathname;
    if (!path.startsWith("/api/roadmap") && path !== "/api/goal") return real(input, init);
    await new Promise((r) => setTimeout(r, delayMs));
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    db = structuredClone(db);
    return handle(path, init?.method ?? "GET", body);
  };
  return () => {
    window.fetch = real;
  };
}
