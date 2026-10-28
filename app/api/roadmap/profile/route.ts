import { NextRequest } from "next/server";
import { roadmapRoute } from "@/lib/roadmap-http";
import { setProfileFor } from "@/lib/roadmap-service";

/** PUT /api/roadmap/profile — { level: 0–3, track?: "long" | "short" }. The first pick seeds the starter blocks. */
export function PUT(req: NextRequest) {
  return roadmapRoute(req, setProfileFor);
}
