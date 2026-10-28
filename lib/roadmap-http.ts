import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import type { RoadmapResult } from "@/lib/roadmap-service";

/**
 * The shared shell of every app/api/roadmap/** route: cookie session only
 * (never a bearer token), the caller's own roadmap only, the service's
 * result mapped to HTTP. A body that isn't JSON reaches the service as null
 * and fails its validation.
 */
export async function roadmapRoute(
  req: NextRequest | null,
  act: (ownerId: string, body: unknown) => Promise<RoadmapResult>,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = req ? await req.json().catch(() => null) : null;
  const result = await act(session.user.id, body);
  return result.ok
    ? NextResponse.json(result.data)
    : NextResponse.json({ error: result.error }, { status: result.status });
}
