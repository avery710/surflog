import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteSessionFor, updateSessionFor } from "@/lib/session-service";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/sessions/:id — partial update. Re-fetches condOpenMeteo when
 *  spot or when actually changes; pass `refreshConditions: true` to force a
 *  refetch. Logic in lib/session-service.ts. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const result = await updateSessionFor(session.user.id, id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ session: result.data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await deleteSessionFor(session.user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: result.data });
}
