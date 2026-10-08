import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { disableShare, enableShare, getShareStatus, type ShareStatus } from "@/lib/session-share";
import { isShareLang, type ShareLang } from "@/lib/share-strings";

/**
 * Owner-only management of a session's public link. Cookie session only —
 * deliberately not reachable with an MCP bearer token (a leaked token must
 * not be able to publish a journal entry). A session that isn't the
 * caller's is a 404, same as every other session route.
 */
type Params = { params: Promise<{ id: string }> };

const body = (share: ShareStatus | null) => ({
  share: share ? { token: share.token, path: `/share/${share.token}`, createdAt: share.createdAt } : null,
});

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await getShareStatus(session.user.id, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(body(r.data), { headers: NO_STORE });
}

/** PUT — turn sharing on (idempotent: an existing link keeps its token).
 *  Takes no body: the page's language is the visitor's, never the owner's. */
export async function PUT(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const r = await enableShare(
    { id: session.user.id, name: session.user.name, image: session.user.image },
    id
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(body(r.data), { headers: NO_STORE });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await disableShare(session.user.id, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(body(null), { headers: NO_STORE });
}
