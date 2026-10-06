/**
 * A small in-memory fixed-window rate limit, used by the MCP endpoint so a
 * runaway agent loop can't hammer Supabase or the condition sources
 * (a create/update fetches Open-Meteo and CWA).
 *
 * In memory on purpose: no extra database round trip per call. The cost is
 * that the count lives per server instance — on Vercel a second warm instance
 * has its own counters, so the real ceiling can be a multiple of `limit`. It
 * stops a loop, it is not an exact quota. Keyed by owner (not token) so
 * making more tokens doesn't buy more calls.
 */
interface Window {
  start: number;
  count: number;
}

const windows = new Map<string, Window>();
const MAX_KEYS = 5000;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets — only meaningful when `ok` is false. */
  retryAfterS: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    if (windows.size >= MAX_KEYS) prune(now, windowMs);
    windows.set(key, { start: now, count: 1 });
    return { ok: true, retryAfterS: 0 };
  }
  if (w.count >= limit) {
    return { ok: false, retryAfterS: Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)) };
  }
  w.count++;
  return { ok: true, retryAfterS: 0 };
}

/** Drop finished windows; if that isn't enough, start over (bounded memory
 *  matters more than a perfectly kept count). */
function prune(now: number, windowMs: number) {
  for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
  if (windows.size >= MAX_KEYS) windows.clear();
}

/** Tests only. */
export function resetRateLimits() {
  windows.clear();
}

/** MCP limits, per owner. Requests cover every JSON-RPC call (initialize,
 *  tools/list, each tool call); writes are the tools that change data. */
export const MCP_REQUESTS = { limit: 120, windowMs: 60_000 };
export const MCP_WRITES = { limit: 60, windowMs: 10 * 60_000 };
