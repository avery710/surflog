import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { removeTagFor } from "@/lib/session-service";
import { MAX_TAG_LENGTH, canonicalTag, starterOf } from "@/lib/tags";

/** DELETE /api/tags?tag=… — strip one of the caller's own (custom) tags from
 *  every one of their sessions. Starters are the fixed list and can't be removed. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tag = canonicalTag(req.nextUrl.searchParams.get("tag") ?? "");
  if (!tag || [...tag].length > MAX_TAG_LENGTH || starterOf(tag)) {
    return NextResponse.json({ error: "not one of your own tags" }, { status: 400 });
  }
  const result = await removeTagFor(session.user.id, tag);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ updated: result.data });
}
