import { NextRequest } from "next/server";
import { roadmapRoute } from "@/lib/roadmap-http";
import { deleteStepFor, updateStepFor } from "@/lib/roadmap-service";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/roadmap/steps/:id — { text? (own steps only), skillId? (move), done?, snoozeFrom? }. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return roadmapRoute(req, (ownerId, body) => updateStepFor(ownerId, id, body));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return roadmapRoute(null, (ownerId) => deleteStepFor(ownerId, id));
}
