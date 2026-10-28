import { describe, expect, it } from "vitest";
import { LEVEL_KEYS, LEVELS, SLOTS, levelKeyOf, starterSkills } from "@/lib/goal-roadmap";
import {
  cleanText,
  currentKey,
  goalPointFor,
  learnedPrompts,
  levelProgress,
  pointSkills,
  reorderIds,
  seedRows,
  shelfOf,
  skillLabel,
  starterRows,
  stepLabel,
  stepTicks,
  stepWordings,
  suggestions,
  type Roadmap,
  type RoadmapSkill,
} from "@/lib/roadmap";

const counter = () => {
  let i = 0;
  return () => `id${++i}`;
};
const ticked = (...points: string[]) => ({ goalText: points.join("\n"), goalMet: true, goalPointsMet: points.map(() => true) });

describe("starter catalogue", () => {
  it("has levels 0–3, level 3 split into a longboard and a shortboard track", () => {
    expect(LEVELS.map((l) => l.n)).toEqual([0, 1, 2, 3]);
    expect(LEVEL_KEYS).toEqual(["0", "1", "2", "3:long", "3:short"]);
    expect(LEVELS[0].name).toEqual({ en: "First waves", zh: "新手村" });
  });

  it("uses every block key once, with wording in both languages", () => {
    const keys: string[] = [];
    for (const slot of SLOTS) {
      for (const sk of starterSkills(slot)) {
        keys.push(sk.id, ...sk.steps.map((s) => s.id));
        expect(sk.name.en && sk.name.zh).toBeTruthy();
        expect(sk.steps.length).toBeGreaterThan(0);
        for (const st of sk.steps) {
          expect(st.text.en && st.text.zh).toBeTruthy();
          expect(st.id.startsWith(`${sk.id}.`)).toBe(true);
        }
      }
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every slot a level test", () => {
    for (const slot of SLOTS) expect(slot.track?.test ?? slot.level.test).toBeTruthy();
  });

  it("maps a level and track to its slot", () => {
    expect(levelKeyOf(1, null)).toBe("1");
    expect(levelKeyOf(3, null)).toBeNull();
    expect(levelKeyOf(3, "short")).toBe("3:short");
  });
});

describe("seeding", () => {
  it("copies every starter block as the user's own rows, with no progress", () => {
    const rows = seedRows(counter());
    const starterCount = SLOTS.reduce((n, s) => n + starterSkills(s).length, 0);
    expect(rows).toHaveLength(starterCount);
    expect(new Set(rows.flatMap((r) => [r.id, ...r.steps.map((s) => s.id)])).size).toBe(
      rows.length + rows.reduce((n, r) => n + r.steps.length, 0),
    );
    for (const r of rows) {
      expect(r.templateKey).toBeTruthy();
      expect(r.working).toBe(false);
      expect(r.steps.every((s) => s.skillId === r.id && s.doneAt == null && s.templateKey)).toBe(true);
    }
  });

  it("can reset one slot, numbered after a given order", () => {
    const rows = starterRows("1", counter(), 5);
    expect(rows.every((r) => r.levelKey === "1")).toBe(true);
    expect(rows[0].sortOrder).toBe(5);
  });
});

const read = starterRows("1", counter()).find((s) => s.templateKey === "l1.read")!;
const peak = read.steps[0];

describe("labels and wordings", () => {
  it("shows a default block in the viewer's language, an own block as typed", () => {
    expect(skillLabel(read, "en")).toBe("Reading waves");
    expect(skillLabel(read, "zh-TW")).toBe("讀浪");
    expect(skillLabel({ templateKey: null, name: "My left take-off" }, "zh-TW")).toBe("My left take-off");
    expect(stepLabel(peak, "zh-TW")).toBe("看出浪峰會在哪裡立起來");
  });

  it("links a default step by either language, an own step by its text", () => {
    expect(stepWordings(peak)).toEqual(["Spot where the peak forms", "看出浪峰會在哪裡立起來"]);
    expect(goalPointFor(peak, "Paddle hard\n看出浪峰會在哪裡立起來")).toBe("看出浪峰會在哪裡立起來");
    expect(goalPointFor({ templateKey: null, text: "Count the set" }, "Count the set")).toBe("Count the set");
    expect(goalPointFor(peak, null)).toBeNull();
  });

  it("counts a session once even if it ticked both wordings", () => {
    const sessions = [
      ticked("Spot where the peak forms", "看出浪峰會在哪裡立起來"),
      ticked("看出浪峰會在哪裡立起來"),
      ticked("Something else"),
    ];
    expect(stepTicks(peak, sessions)).toBe(2);
  });
});

function roadmapWith(skills: RoadmapSkill[]): Roadmap {
  return { profile: { level: 1, track: null }, skills };
}

describe("learned prompt", () => {
  const goal = "Spot where the peak forms";
  const three = [ticked(goal), ticked(goal), ticked(goal)];

  it("asks after 3 ticked sessions, only while the step is on next session", () => {
    expect(learnedPrompts(roadmapWith([read]), goal, three.slice(0, 2))).toHaveLength(0);
    expect(learnedPrompts(roadmapWith([read]), goal, three)).toHaveLength(1);
    expect(learnedPrompts(roadmapWith([read]), "Other point", three)).toHaveLength(0);
  });

  it("asks again 3 sessions after Not yet, never once learned", () => {
    const snoozed = { ...read, steps: [{ ...peak, snoozeFrom: 3 }, ...read.steps.slice(1)] };
    expect(learnedPrompts(roadmapWith([snoozed]), goal, three)).toHaveLength(0);
    expect(learnedPrompts(roadmapWith([snoozed]), goal, [...three, ...three])).toHaveLength(1);
    const done = { ...read, steps: [{ ...peak, doneAt: "2026-10-28T00:00:00Z" }, ...read.steps.slice(1)] };
    expect(learnedPrompts(roadmapWith([done]), goal, three)).toHaveLength(0);
  });
});

describe("suggestions and progress", () => {
  it("suggests the next unlearned step of each skill being worked on that isn't on the list", () => {
    const working = { ...read, working: true };
    expect(suggestions(roadmapWith([working]), null)[0].step.id).toBe(peak.id);
    expect(suggestions(roadmapWith([working]), "Spot where the peak forms")[0].step.id).toBe(read.steps[1].id);
    expect(suggestions(roadmapWith([read]), null)).toHaveLength(0);
  });

  it("counts learned skills in the current slot only", () => {
    const learned = { ...read, steps: read.steps.map((s) => ({ ...s, doneAt: "x" })) };
    const elsewhere = { ...learned, id: "other", levelKey: "2" as const };
    expect(levelProgress(roadmapWith([learned, elsewhere, { ...read, id: "r2" }]))).toEqual({ done: 1, total: 2 });
    expect(currentKey({ level: 3, track: null })).toBeNull();
  });
});

describe("small helpers", () => {
  it("cleans typed names", () => {
    expect(cleanText("  Fix  my\nleft  ", 60)).toBe("Fix my left");
    expect(cleanText("", 60)).toBeNull();
    expect(cleanText("x".repeat(61), 60)).toBeNull();
    expect(cleanText(5, 60)).toBeNull();
  });

  it("reorders by drag", () => {
    expect(reorderIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(reorderIds(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(reorderIds(["a", "b"], "a", "zz")).toEqual(["a", "b"]);
  });

  it("puts own skills on their own shelf", () => {
    expect(shelfOf(read)).toBe("1|ride");
    expect(shelfOf({ ...read, templateKey: null })).toBe("1|yours");
  });
});

describe("goal point captions", () => {
  it("names the skill a goal point belongs to, in the viewer's language", () => {
    const own = { ...read, id: "own", templateKey: null, name: "My left take-off", steps: [{ ...peak, id: "s", templateKey: null, text: "Look left early" }] };
    const en = pointSkills(roadmapWith([read, own]), "en");
    expect(en.get("Spot where the peak forms")).toBe("Reading waves");
    expect(en.get("看出浪峰會在哪裡立起來")).toBe("Reading waves");
    expect(en.get("Look left early")).toBe("My left take-off");
    expect(pointSkills(roadmapWith([read]), "zh-TW").get("Spot where the peak forms")).toBe("讀浪");
    expect(pointSkills(null, "en").size).toBe(0);
  });
});
