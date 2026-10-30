"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { pointSkills, type Roadmap } from "@/lib/roadmap";

/**
 * The user's roadmap for components deep in the journal (SURFLOG-38): the
 * goal card's points and the "Which goals did you achieve?" ticks in the log
 * form and edit panel show the roadmap skill a point belongs to. Outside a
 * provider (landing, dev pages) there's no roadmap and no captions.
 */
const RoadmapContext = createContext<Roadmap | null>(null);

export function RoadmapProvider({ roadmap, children }: { roadmap: Roadmap | null; children: ReactNode }) {
  return <RoadmapContext.Provider value={roadmap}>{children}</RoadmapContext.Provider>;
}

/** point wording → its skill's name in the viewer's language, or undefined. */
export function useGoalPointSkill(): (point: string) => string | undefined {
  const roadmap = useContext(RoadmapContext);
  const { lang } = useLang();
  const map = useMemo(() => pointSkills(roadmap, lang), [roadmap, lang]);
  return (point) => map.get(point.trim());
}
