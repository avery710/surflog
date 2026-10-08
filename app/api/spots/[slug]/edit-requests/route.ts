import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { cleanNote, normalizeChanges, sameChanges } from "@/lib/spot-edit";
import {
  EditTableMissingError,
  listOwnPending,
  toOwn,
  upsertPending,
} from "@/lib/spot-edit-requests";
import { findDuplicates, locationFromInput } from "@/lib/spot-create";
import { notifySpotEdit } from "@/lib/spot-request-notify";
import { listSpots, resolveSpot } from "@/lib/spot-store";

type Params = { params: Promise<{ slug: string }> };

/** Suggestions per user per hour, and pending ones at once across all spots. */
const SUBMITS = { limit: 10, windowMs: 60 * 60_000 };
const MAX_PENDING_PER_USER = 30;

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function tableMissing() {
  return NextResponse.json(
    { error: "spot edit suggestions aren't switched on yet", code: "unavailable" },
    { status: 503 }
  );
}

/**
 * GET /api/spots/:slug/edit-requests — the caller's OWN pending suggestion
 * for this spot (never anyone else's). 200 { requests: OwnEditRequest[] }
 * (zero or one). 503 { code: "unavailable" } until the table exists.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const rows = await listOwnPending(userId, decode((await params).slug));
    return NextResponse.json({ requests: rows.map(toOwn) });
  } catch (e) {
    if (e instanceof EditTableMissingError) return tableMissing();
    console.error("[api/spots/:slug/edit-requests] GET failed", e);
    return NextResponse.json({ error: "couldn't load your suggestion" }, { status: 500 });
  }
}

/**
 * POST /api/spots/:slug/edit-requests — suggest a change to an existing spot.
 * Any signed-in user.
 * Body: { changes: { name?, nameZh?, country?, area?, facing?, bestTide?,
 *                    bestSwellDir?, bestWindDir?, location? }, note? (≤500) }
 * Only the fields that differ from the spot are kept ("" / [] clears one).
 * One pending suggestion per user per spot: a new one replaces the old;
 * an identical resend is a no-op.
 * 201 { request } (new/replaced) · 200 { request, unchanged: true }
 * 400 { code: "invalid" | "bad_location" | "no_changes" } · 404 unknown spot
 * 409 { code: "duplicate", existing } · 429 (rate limit / too many pending)
 * 503 { code: "unavailable" } until the table exists.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = rateLimit(`spot-edit:${userId}`, SUBMITS.limit, SUBMITS.windowMs);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "too many suggestions, try again later", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterS) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body", code: "invalid" }, { status: 400 });
  }
  const note = cleanNote((body as { note?: unknown }).note);
  if (note === "invalid") {
    return NextResponse.json({ error: "note must be text up to 500 characters", code: "invalid" }, { status: 400 });
  }

  try {
    const slug = decode((await params).slug);
    const spot = await resolveSpot(slug);
    if (!spot) return NextResponse.json({ error: "not found" }, { status: 404 });

    const result = await normalizeChanges(spot, (body as { changes?: unknown }).changes, locationFromInput);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    const { changes, base } = result;

    // Early feedback only; approving checks again against the catalogue as it is then.
    const merged = {
      name: changes.name ?? spot.name,
      area: changes.area ?? spot.area,
      point: { lat: changes.lat ?? spot.lat ?? 0, lng: changes.lng ?? spot.lng ?? 0 },
    };
    if (changes.name != null || changes.area != null || changes.lat != null) {
      const { duplicate } = findDuplicates(await listSpots(), merged.point, merged.name, merged.area, spot.slug);
      if (duplicate) {
        return NextResponse.json(
          { error: "that would duplicate another spot", code: "duplicate", existing: { slug: duplicate.slug, name: duplicate.name } },
          { status: 409 }
        );
      }
    }

    const mine = await listOwnPending(userId);
    const existing = mine.find((r) => r.spot_slug === spot.slug);
    if (existing && sameChanges(toOwn(existing).changes, changes) && (existing.note ?? null) === note) {
      return NextResponse.json({ request: toOwn(existing), unchanged: true });
    }
    if (!existing && mine.length >= MAX_PENDING_PER_USER) {
      return NextResponse.json({ error: "too many pending suggestions", code: "limit" }, { status: 429 });
    }

    const row = await upsertPending({
      spot_slug: spot.slug,
      requester_id: userId,
      requester_name: session.user?.name ?? null,
      requester_email: session.user?.email ?? null,
      note,
      changes,
      base,
    });
    // best-effort, like new spot requests
    try {
      notifySpotEdit({ id: row.id, spotSlug: spot.slug, fields: Object.keys(changes) });
    } catch (e) {
      console.error("[spot-edit] notify failed", e);
    }
    return NextResponse.json({ request: toOwn(row) }, { status: 201 });
  } catch (e) {
    if (e instanceof EditTableMissingError) return tableMissing();
    console.error("[api/spots/:slug/edit-requests] POST failed", e);
    return NextResponse.json({ error: "couldn't save the suggestion" }, { status: 500 });
  }
}
