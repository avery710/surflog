import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteClipFor, updateClipFor } from "@/lib/clip-service";
import { readClipPatch } from "@/lib/clips";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/clips/:id — trim, skill, reaction, confirm. A skill change
 *  marks the clip as tagged by the surfer. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const patch = readClipPatch(await req.json().catch(() => null));
  if (!patch) return NextResponse.json({ error: "invalid clip" }, { status: 400 });
  const result = await updateClipFor(session.user.id, id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ clip: result.data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await deleteClipFor(session.user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
