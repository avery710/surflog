import { NextRequest } from "next/server";
import { roadmapRoute } from "@/lib/roadmap-http";
import { deleteSkillFor, updateSkillFor } from "@/lib/roadmap-service";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/roadmap/skills/:id — { name? (own skills only), working?, levelKey? (move) }. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return roadmapRoute(req, (ownerId, body) => updateSkillFor(ownerId, id, body));
}

/** DELETE /api/roadmap/skills/:id — the skill and its steps. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return roadmapRoute(null, (ownerId) => deleteSkillFor(ownerId, id));
}
