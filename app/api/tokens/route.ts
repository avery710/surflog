import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createApiToken, listApiTokens, parseTokenScope } from "@/lib/token-auth";

// Token management is cookie-session only (auth()), never bearer — a leaked
// token must not be able to mint or list tokens.

/** GET /api/tokens — the caller's own tokens (no secrets; those aren't stored). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ tokens: await listApiTokens(session.user.id) });
}

/** POST /api/tokens — { name, scope: "read" | "write" }. The response carries
 *  the plain `token` exactly once. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const scope = parseTokenScope(body?.scope);
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "name is required (60 characters max)" }, { status: 400 });
  }
  if (!scope) return NextResponse.json({ error: "scope must be read or write" }, { status: 400 });

  const result = await createApiToken(session.user.id, name, scope);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ token: result.token, record: result.record }, { status: 201 });
}
