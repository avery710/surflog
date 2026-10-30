"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Map as MapIcon, Plus } from "lucide-react";
import { cn } from "cn";
import { goalPoints, joinGoalPoints, MAX_GOAL, type GoalRename } from "@/lib/goal";
import { bi, LEVELS } from "@/lib/goal-roadmap";
import { useLang } from "@/lib/i18n";
import {
  learnedPrompts,
  levelProgress,
  skillLabel,
  stepLabel,
  suggestions,
  type Roadmap,
  type RoadmapPayload,
} from "@/lib/roadmap";
import type { SessionStat } from "@/lib/session-stats";

/**
 * The goal card's roadmap part (SURFLOG-38), under the goal's points: the
 * "Learned it?" prompt for a step ticked in enough sessions, "Next on your
 * roadmap" suggestions (tapping one adds its wording to the goal through the
 * card's own save), and a line to /roadmap with the current level's
 * progress. Renders nothing until the roadmap migration is applied.
 */
export function GoalRoadmapStrip({
  roadmap,
  goal,
  sessions,
  onSave,
  onRoadmap,
}: {
  roadmap: Roadmap;
  goal: string | null;
  sessions: Pick<SessionStat, "goalText" | "goalMet" | "goalPointsMet">[];
  onSave: (text: string, renames: GoalRename[]) => Promise<boolean>;
  /** A roadmap route's answer: the roadmap and the goal it left. */
  onRoadmap: (payload: RoadmapPayload) => void;
}) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false);
  const prompts = learnedPrompts(roadmap, goal, sessions);
  const next = suggestions(roadmap, goal);
  const level = roadmap.profile ? LEVELS.find((l) => l.n === roadmap.profile!.level) : undefined;
  const progress = levelProgress(roadmap);

  async function patchStep(id: string, body: object) {
    setBusy(true);
    try {
      const res = await fetch(`/api/roadmap/steps/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        toast.error(json?.error ?? t("roadmap.failed"));
        return false;
      }
      onRoadmap(json);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function addStep(text: string) {
    const joined = joinGoalPoints([...goalPoints(goal), text]);
    if (joined.length > MAX_GOAL) return void toast(t("roadmap.goalFull", { max: MAX_GOAL }));
    setBusy(true);
    await onSave(joined, []);
    setBusy(false);
  }

  return (
    <div className="mt-2">
      {prompts.map(({ step, ticks }) => {
        const text = stepLabel(step, lang);
        return (
          <div key={step.id} className="my-1.5 rounded-[var(--r-tile)] bg-secondary px-3 py-2.5">
            <p className="text-[13.5px] font-semibold">{t("roadmap.learnedAsk", { step: text, n: ticks })}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await patchStep(step.id, { done: true })) toast(t("roadmap.learnedToast", { step: text }));
                }}
                className="rounded-full bg-primary px-3 py-1 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {t("roadmap.learnedYes")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void patchStep(step.id, { snoozeFrom: ticks })}
                className="rounded-full surface-card px-3 py-1 text-[12.5px] font-semibold disabled:opacity-60"
              >
                {t("roadmap.notYet")}
              </button>
            </div>
          </div>
        );
      })}

      {next.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-muted-foreground">{t("roadmap.next")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {next.map(({ skill, step }) => (
              <button
                key={step.id}
                type="button"
                disabled={busy}
                onClick={() => void addStep(stepLabel(step, lang))}
                className="flex max-w-full items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-1 text-left text-[12.5px] font-medium text-primary hover:bg-secondary disabled:opacity-60"
              >
                <Plus className="size-3 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{stepLabel(step, lang)}</span>
                <span className="shrink-0 text-muted-foreground">· {skillLabel(skill, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/roadmap"
        aria-label={t("roadmap.open")}
        className="mt-3 flex w-full items-center gap-2 border-t border-border pt-2.5 text-left text-[12.5px] hover:opacity-80"
      >
        <MapIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {level ? (
          <>
            <span className="font-semibold">
              {t("roadmap.levelN", { n: level.n })} · {bi(level.name, lang)}
            </span>
            {progress.total > 0 && (
              <span className="flex gap-0.5" aria-hidden>
                {Array.from({ length: Math.min(progress.total, 12) }, (_, i) => (
                  <span
                    key={i}
                    className={cn("h-1.5 w-3 rounded-full", i < progress.done ? "bg-primary" : "bg-secondary")}
                  />
                ))}
              </span>
            )}
            <span className="tabular-nums text-muted-foreground">
              {progress.total > 0
                ? t("roadmap.skillsProgress", { done: progress.done, total: progress.total })
                : t("roadmap.pickBoard")}
            </span>
          </>
        ) : (
          <span className="font-semibold text-primary">{t("roadmap.findLevel")}</span>
        )}
        <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
