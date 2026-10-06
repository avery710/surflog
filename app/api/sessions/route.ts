import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSessions } from "@/lib/db";
import { createSessionFor } from "@/lib/session-service";

export async function GET() {
  // middleware already rejects unauthenticated requests, but route handlers
  // never trust that alone — get the real session here too.
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sessions = await listSessions(session.user.id);
  return NextResponse.json({ sessions });
}

/** POST /api/sessions — create a session. Auto-fills condOpenMeteo server-side
 *  when the spot has known coordinates; that's the whole point of this repo
 *  (see CLAUDE.md "The automation problem"). The logic lives in
 *  lib/session-service.ts, shared with other callers. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = await createSessionFor(session.user.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ session: result.data }, { status: 201 });
}
