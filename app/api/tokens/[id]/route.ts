import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { revokeApiToken } from "@/lib/token-auth";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/tokens/:id — revoke one of the caller's own tokens. 404 for
 *  anyone else's id, same as every other owner-scoped route. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await revokeApiToken(session.user.id, id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
