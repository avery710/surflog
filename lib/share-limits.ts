/**
 * Per-IP limits for the public share routes (token guessing, media
 * scraping, image-render abuse). Built on lib/rate-limit.ts, so the same
 * caveat holds: in memory per server instance, a brake and not a quota.
 */
import { rateLimit, type RateLimitResult } from "./rate-limit";
import type { PublicSharePath } from "./share-paths";

export const SHARE_LIMITS: Record<PublicSharePath, { limit: number; windowMs: number }> = {
  page: { limit: 60, windowMs: 60_000 },
  // an image render is the expensive one (fonts + satori)
  image: { limit: 20, windowMs: 60_000 },
  media: { limit: 300, windowMs: 60_000 },
};

/** Lookups that found nothing (unknown or revoked token) — i.e. guessing. */
export const SHARE_MISSES = { limit: 20, windowMs: 60_000 };

/** The caller's address: Vercel puts the real client first in
 *  x-forwarded-for (it overwrites a client-sent value). "unknown" shares one
 *  bucket, which is the safe direction. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip")?.trim() || "unknown";
}

export function limitShareRequest(ip: string, kind: PublicSharePath): RateLimitResult {
  const { limit, windowMs } = SHARE_LIMITS[kind];
  return rateLimit(`share:${kind}:${ip}`, limit, windowMs);
}

export function limitShareMiss(ip: string): RateLimitResult {
  return rateLimit(`share:miss:${ip}`, SHARE_MISSES.limit, SHARE_MISSES.windowMs);
}
