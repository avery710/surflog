import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listSessions, createSession, newSessionId } from "@/lib/db";
import { spotBySlug } from "@/lib/spots";
import { getConditions } from "@/lib/openmeteo";
import { getTide } from "@/lib/cwa-tide";
import { sanitizeNotesHtml, htmlToPlainText } from "@/lib/rich-text";
import type { CondCwaTide, CondOpenMeteo, Session } from "@/lib/types";

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
 *  (see CLAUDE.md "The automation problem"). Swelleye's headline reading
 *  (`cond`) stays manual — nothing here scrapes it. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const spot = typeof body.spot === "string" ? body.spot.trim() : "";
  const when = typeof body.when === "string" ? body.when.trim() : "";
  if (!spot || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) {
    return NextResponse.json(
      { error: "spot and when (YYYY-MM-DDTHH:mm) are required" },
      { status: 400 }
    );
  }

  const notesHtml = sanitizeNotesHtml(typeof body.notesHtml === "string" ? body.notesHtml : "");
  const notes = htmlToPlainText(notesHtml);
  const rating =
    typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
      ? Math.round(body.rating)
      : null;

  let condOpenMeteo: CondOpenMeteo | null = null;
  const spotInfo = spotBySlug(spot);
  if (spotInfo?.lat != null && spotInfo.lng != null) {
    try {
      condOpenMeteo = await getConditions(spotInfo.lat, spotInfo.lng, when);
    } catch {
      // best-effort — a session should still save if Open-Meteo is down
      condOpenMeteo = null;
    }
  }

  let condCwaTide: CondCwaTide | null = null;
  if (spotInfo?.tideTownship) {
    try {
      condCwaTide = await getTide(spotInfo.tideTownship, when);
    } catch {
      // best-effort — a session should still save if CWA is down
      condCwaTide = null;
    }
  }

  const newSession: Session = {
    id: newSessionId(),
    ownerId: session.user.id,
    spot,
    when,
    notesHtml,
    notes,
    photos: [],
    cond: null,
    condOpenMeteo,
    condCwaTide,
    rating,
    createdAt: new Date().toISOString(),
  };

  const saved = await createSession(newSession);
  return NextResponse.json({ session: saved }, { status: 201 });
}
