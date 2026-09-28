import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setGoal } from "@/lib/db";
import { MAX_GOAL } from "@/lib/goal";

/** PUT /api/goal — set (or, with empty text, clear) the caller's own
 *  "goal for next session". Always scoped to the caller. */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : null;
  if (text == null) return NextResponse.json({ error: "text is required" }, { status: 400 });
  if (text.length > MAX_GOAL) {
    return NextResponse.json({ error: `goal is limited to ${MAX_GOAL} characters` }, { status: 400 });
  }

  await setGoal(session.user.id, text);
  return NextResponse.json({ text: text || null });
}
