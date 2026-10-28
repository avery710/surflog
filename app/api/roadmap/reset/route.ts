import { NextRequest } from "next/server";
import { roadmapRoute } from "@/lib/roadmap-http";
import { resetLevelFor } from "@/lib/roadmap-service";

/** POST /api/roadmap/reset — { levelKey }: that level goes back to its starter blocks. */
export function POST(req: NextRequest) {
  return roadmapRoute(req, resetLevelFor);
}
