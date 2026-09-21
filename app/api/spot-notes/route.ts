import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setSpotNote } from "@/lib/db";

const MAX_DESCRIPTION = 500;

/** PUT /api/spot-notes — set (or, with an empty description, clear) the
 *  caller's own description for one spot. Always scoped to the caller. */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const spot = typeof body?.spot === "string" ? body.spot.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;

  if (!spot || spot.length > 200 || description == null) {
    return NextResponse.json({ error: "spot and description are required" }, { status: 400 });
  }
  if (description.length > MAX_DESCRIPTION) {
    return NextResponse.json(
      { error: `description is limited to ${MAX_DESCRIPTION} characters` },
      { status: 400 }
    );
  }

  await setSpotNote(session.user.id, spot, description);
  return NextResponse.json({ spot, description });
}
