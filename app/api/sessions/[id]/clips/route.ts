import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClipFor, listClipsFor } from "@/lib/clip-service";
import { readClipCreate } from "@/lib/clips";

type Params = { params: Promise<{ id: string }> };

/** GET /api/sessions/:id/clips — the caller's clips on that session, by start. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await listClipsFor(session.user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ clips: result.data });
}

/** POST /api/sessions/:id/clips — a hand label. Does not run a model. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const input = readClipCreate(await req.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "invalid clip" }, { status: 400 });
  }
  const result = await createClipFor(session.user.id, id, input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ clip: result.data }, { status: 201 });
}
