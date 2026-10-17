import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { countSessions, listSessionsPage } from "@/lib/db";
import { parseFilter } from "@/lib/session-filter";
import { clampPage, MAX_PAGE_SIZE, PAGE_SIZE, parsePage } from "@/lib/pagination";
import { createSessionFor } from "@/lib/session-service";

/** GET /api/sessions?page=2[&pageSize=10][&spot=&board=&from=&to=] — one page of
 *  the caller's sessions, newest first, plus the total (of the filtered
 *  list). `page` is clamped into range; `pageSize` is capped (the homepage
 *  asks for 10, or 1 for the latest session). The filter fields are
 *  optional and ANDed (lib/session-filter.ts); bad values are ignored. */
export async function GET(req: NextRequest) {
  // middleware already rejects unauthenticated requests, but route handlers
  // never trust that alone — get the real session here too.
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const rawSize = params.get("pageSize");
  const pageSize = rawSize === null ? PAGE_SIZE : Math.min(parsePage(rawSize), MAX_PAGE_SIZE);
  const filter = parseFilter(params);
  const total = await countSessions(session.user.id, filter);
  const page = clampPage(parsePage(params.get("page")), total, pageSize);
  const sessions = total === 0 ? [] : await listSessionsPage(session.user.id, page, pageSize, filter);
  return NextResponse.json({ sessions, page, pageSize, total });
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
