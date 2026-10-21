import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/health";

/** GET /api/health — unsigned (proxy.ts lets exactly this path through).
 *  Runs one tiny read against Supabase so the call counts as database
 *  activity: a free-tier project pauses after a week without any. Both
 *  environments' copies are called daily from production by
 *  app/api/cron/keep-awake/route.ts (Vercel Cron).
 *
 *  200 { ok: true }   503 { ok: false }
 *  Says nothing else, never the database error (logged server-side only). */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await pingDatabase();
    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    console.error("[health] database check failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
