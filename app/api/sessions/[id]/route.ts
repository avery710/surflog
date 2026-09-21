import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSession, updateSession, deleteSession } from "@/lib/db";
import { deleteBlob } from "@/lib/blob";
import { spotBySlug } from "@/lib/spots";
import { getConditions } from "@/lib/openmeteo";
import { getTide } from "@/lib/cwa-tide";
import { sanitizeNotesHtml, htmlToPlainText } from "@/lib/rich-text";
import type { Cond, Session } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const COND_KEYS: (keyof Cond)[] = [
  "swellHeightM",
  "swellPeriodS",
  "swellDir",
  "windSpeedMs",
  "windGustMs",
  "windDir",
  "tideM",
  "tideNote",
  "seaTempC",
  "airTempC",
  "sky",
];

/** PATCH /api/sessions/:id — partial update. Re-fetches condOpenMeteo when
 *  spot or when actually changes (the offshore reading depends on both);
 *  pass `refreshConditions: true` to force a refetch without changing either
 *  (e.g. after Open-Meteo was briefly down at save time). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getSession(id);
  // 404 (not 403) when it belongs to someone else — don't confirm the id exists.
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<Session> = {};

  if (typeof body.spot === "string" && body.spot.trim()) patch.spot = body.spot.trim();
  if (typeof body.when === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.when)) {
    patch.when = body.when;
  }
  if (typeof body.notesHtml === "string") {
    const notesHtml = sanitizeNotesHtml(body.notesHtml);
    patch.notesHtml = notesHtml;
    patch.notes = htmlToPlainText(notesHtml);
  }
  if (body.rating === null) patch.rating = null;
  else if (typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5) {
    patch.rating = Math.round(body.rating);
  }

  if (body.cond === null) {
    patch.cond = null;
  } else if (body.cond && typeof body.cond === "object") {
    const c = body.cond as Record<string, unknown>;
    const next: Cond = {
      swellHeightM: null,
      swellPeriodS: null,
      swellDir: null,
      windSpeedMs: null,
      windGustMs: null,
      windDir: null,
      tideM: null,
      tideNote: null,
      seaTempC: null,
      airTempC: null,
      sky: null,
      source: existing.cond?.source ?? "manual",
      filledAt: new Date().toISOString(),
      ...existing.cond,
    };
    for (const k of COND_KEYS) {
      if (k in c) {
        const v = c[k];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next as any)[k] =
          v === "" || v === undefined ? null : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
      }
    }
    next.filledAt = new Date().toISOString();
    if (next.source !== "swelleye") next.source = "manual";
    patch.cond = next;
  }

  const spotChanged = patch.spot != null && patch.spot !== existing.spot;
  const whenChanged = patch.when != null && patch.when !== existing.when;
  if (spotChanged || whenChanged || body.refreshConditions === true) {
    const spot = spotBySlug(patch.spot ?? existing.spot);
    if (spot?.lat != null && spot.lng != null) {
      try {
        patch.condOpenMeteo = await getConditions(spot.lat, spot.lng, patch.when ?? existing.when);
      } catch {
        // leave condOpenMeteo as-is if the refetch fails
      }
    } else if (spotChanged) {
      patch.condOpenMeteo = null;
    }

    if (spot?.tideTownship) {
      try {
        patch.condCwaTide = await getTide(spot.tideTownship, patch.when ?? existing.when);
      } catch {
        // leave condCwaTide as-is if the refetch fails
      }
    } else if (spotChanged) {
      patch.condCwaTide = null;
    }
  }

  const saved = await updateSession(id, patch);
  return NextResponse.json({ session: saved });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getSession(id);
  if (!existing || existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await Promise.allSettled(existing.photos.map((p) => deleteBlob(p.id)));
  const ok = await deleteSession(id);
  return NextResponse.json({ ok });
}
