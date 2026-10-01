import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { renameGoalPointsInSessions, setGoal } from "@/lib/db";
import { MAX_GOAL, type GoalRename } from "@/lib/goal";

/** PUT /api/goal — set (or, with empty text, clear) the caller's own
 *  "goal for next session". Optional `renames` ({from, to}[]) rewords those
 *  points in the caller's past session snapshots too; added/removed points
 *  never touch past sessions. Always scoped to the caller. */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : null;
  if (text == null) return NextResponse.json({ error: "text is required" }, { status: 400 });
  if (text.length > MAX_GOAL) {
    return NextResponse.json({ error: `goal is limited to ${MAX_GOAL} characters` }, { status: 400 });
  }

  const rawRenames: unknown = body?.renames ?? [];
  const renames = Array.isArray(rawRenames)
    ? rawRenames.filter(
        (r): r is GoalRename =>
          typeof r?.from === "string" &&
          typeof r?.to === "string" &&
          r.from.length <= MAX_GOAL &&
          r.to.length <= MAX_GOAL
      )
    : null;
  if (!renames) return NextResponse.json({ error: "renames must be an array" }, { status: 400 });

  await setGoal(session.user.id, text);
  const sessions = await renameGoalPointsInSessions(session.user.id, renames);
  return NextResponse.json({ text: text || null, sessions });
}
