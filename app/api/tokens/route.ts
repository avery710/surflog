import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listApiTokens } from "@/lib/token-auth";

// Cookie-session only (auth()), never bearer — a leaked token must not be able
// to list the others. There is no POST: tokens are issued only through OAuth
// sign-in (lib/oauth.ts); creating one by hand was removed 2026-10-07.

/** GET /api/tokens — the caller's own tokens (no secrets; those aren't stored). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ tokens: await listApiTokens(session.user.id) });
}
