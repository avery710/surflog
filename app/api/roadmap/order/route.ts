import { NextRequest } from "next/server";
import { roadmapRoute } from "@/lib/roadmap-http";
import { reorderFor } from "@/lib/roadmap-service";

/** PUT /api/roadmap/order — { skills: ids } for one shelf, or { skillId, steps: ids } for one skill. */
export function PUT(req: NextRequest) {
  return roadmapRoute(req, reorderFor);
}
