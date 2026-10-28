import { NextRequest } from "next/server";
import { roadmapRoute } from "@/lib/roadmap-http";
import { createSkillFor } from "@/lib/roadmap-service";

/** POST /api/roadmap/skills — { levelKey, name } (your own), { levelKey, templateKey } (from the library) or { restore } (Undo). */
export function POST(req: NextRequest) {
  return roadmapRoute(req, createSkillFor);
}
