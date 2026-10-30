import { roadmapRoute } from "@/lib/roadmap-http";
import { getRoadmapFor } from "@/lib/roadmap-service";

/** GET /api/roadmap — the caller's roadmap and current goal (see lib/roadmap-service.ts). */
export function GET() {
  return roadmapRoute(null, (ownerId) => getRoadmapFor(ownerId));
}
