import { NextRequest, NextResponse } from "next/server";
import { HEALTH_CHECK_URLS } from "@/lib/health";

type Env = keyof typeof HEALTH_CHECK_URLS;

/** GET /api/cron/keep-awake — Vercel Cron, daily (vercel.json).
 *
 *  Free-tier Supabase projects pause after 7 days without activity. This
 *  calls each environment's /api/health (production and staging), and each
 *  one reads its own database. Vercel runs cron jobs on Production
 *  deployments only (staging is a Preview deployment), so this lives on
 *  production and reaches staging over HTTP.
 *
 *  Vercel sends `Authorization: Bearer $CRON_SECRET` (env var, Production).
 *  Without CRON_SECRET set, or with the wrong one, → 401: nobody else can
 *  trigger it. If Vercel Authentication is on for Preview, the project's
 *  "Protection Bypass for Automation" secret (exposed to deployments as
 *  VERCEL_AUTOMATION_BYPASS_SECRET) is sent so the staging call gets through.
 *
 *  200 { production: true, staging: true }
 *  502 the same shape with a false (both are always tried; failures logged) */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const envs = Object.keys(HEALTH_CHECK_URLS) as Env[];
  const results = await Promise.all(envs.map((env) => ping(env)));
  const body = Object.fromEntries(envs.map((env, i) => [env, results[i]])) as Record<Env, boolean>;
  return NextResponse.json(body, {
    status: results.every(Boolean) ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}

async function ping(env: Env): Promise<boolean> {
  const headers: Record<string, string> = {};
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;
  try {
    const res = await fetch(HEALTH_CHECK_URLS[env], {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) console.error(`[keep-awake] ${env} health check answered ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error(`[keep-awake] ${env} unreachable:`, err instanceof Error ? err.message : err);
    return false;
  }
}
