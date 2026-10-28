import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGoal, listBoards, listSessionStats } from "@/lib/db";
import { listSpots } from "@/lib/spot-store";
import { listOwnRequests } from "@/lib/spot-requests";

/** GET /api/log-context — everything the log-session form reads, for pages
 *  other than the journal (components/global-log-dialog.tsx). Own data only. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [stats, boards, goal, spots, requestRows] = await Promise.all([
    listSessionStats(userId),
    listBoards(userId),
    getGoal(userId),
    listSpots(),
    listOwnRequests(userId),
  ]);
  const requests = requestRows.map((r) => ({ id: r.id, name: r.name, status: r.status, spotSlug: r.spot_slug }));
  return NextResponse.json({ stats, boards, goal, spots, requests });
}
