import { NextRequest } from "next/server";
import { roadmapRoute } from "@/lib/roadmap-http";
import { createStepFor } from "@/lib/roadmap-service";

type Params = { params: Promise<{ id: string }> };

/** POST /api/roadmap/skills/:id/steps — { text } (your own), { fromStepId } (copy) or { restore } (Undo). */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return roadmapRoute(req, (ownerId, body) => createStepFor(ownerId, id, body));
}
