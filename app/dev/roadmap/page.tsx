"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LangSwitch } from "@/app/dev/lang-switch";
import { GoalCard, GoalCheck } from "@/components/goal";
import { RoadmapProvider } from "@/components/roadmap-context";
import { goalOptions } from "@/lib/goal";
import { Roadmap } from "@/components/roadmap";
import { PAGE_COLUMN } from "@/lib/layout";
import type { RoadmapPayload } from "@/lib/roadmap";
import { FIXTURE_SESSIONS, fixture, installFakeApi } from "./fake-api";

/**
 * The real roadmap page (components/roadmap.tsx) and the goal card's roadmap
 * part (components/goal-roadmap-strip.tsx) on synthetic data, with an
 * in-memory fake of the API over window.fetch (./fake-api.ts). Both read the
 * same ["roadmap"] cache, so a change on one shows on the other. Nothing is
 * saved; a reload starts over. 404s in production (app/dev/layout.tsx).
 */
export default function DevRoadmapPage() {
  const [kind, setKind] = useState<"midway" | "first">("midway");
  const [start] = useState(() => fixture("midway"));
  const qc = useQueryClient();
  const [ticked, setTicked] = useState<string[]>([]);

  useEffect(() => {
    const data = fixture(kind);
    qc.setQueryData(["roadmap"], data);
    const uninstall = installFakeApi(data);
    return uninstall;
  }, [kind, qc]);

  const { data } = useQuery<RoadmapPayload>({
    queryKey: ["roadmap"],
    queryFn: () => fetch("/api/roadmap").then((r) => r.json()),
    initialData: start,
    staleTime: Infinity,
  });

  return (
    <div className="min-h-dvh pb-24">
      <div className={`${PAGE_COLUMN} pt-6`}>
        <h1 className="text-lg font-bold">Roadmap (dev)</h1>
        <p className="mt-1 max-w-[640px] text-[13px] text-muted-foreground">
          The real components on a fake API. Starts as a level-1 user mid-way, or as a first visit.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LangSwitch />
          {(["midway", "first"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground"
            >
              {k === "midway" ? "Level 1, mid-way" : "First visit"}
            </button>
          ))}
        </div>
        <RoadmapProvider roadmap={data}>
        <h2 className="mt-6 text-[13px] font-bold text-muted-foreground">Goal card</h2>
        <div className="mt-2 max-w-[520px]">
          <GoalCard
            goal={data.goal}
            sessions={FIXTURE_SESSIONS}
            roadmap={data}
            onRoadmap={(p) => qc.setQueryData(["roadmap"], p)}
            onSave={async (text) => {
              const res = await fetch("/api/goal", { method: "PUT", body: JSON.stringify({ text }) });
              if (!res.ok) return false;
              const json = await res.json();
              qc.setQueryData<RoadmapPayload>(["roadmap"], (prev) => (prev ? { ...prev, goal: json.text } : prev));
              return true;
            }}
          />
        </div>
        <h2 className="mt-6 text-[13px] font-bold text-muted-foreground">Log a session: goal ticks (also the edit panel)</h2>
        <div className="mt-2 max-w-[520px]">
          <GoalCheck options={goalOptions(data.goal)} value={ticked} onChange={setTicked} />
        </div>
        </RoadmapProvider>
        <h2 className="mt-8 text-[13px] font-bold text-muted-foreground">/roadmap</h2>
      </div>
      <Roadmap key={kind} initial={data} sessions={FIXTURE_SESSIONS} />
    </div>
  );
}
