/**
 * Bearer tokens for the MCP endpoint (table `api_tokens`) — how a non-browser
 * client proves who it acts for. The cookie-based Auth.js session is unusable
 * there.
 *
 * - Two ways to get one: OAuth sign-in from an app that supports it
 *   (lib/oauth.ts — the only route for claude.ai / mobile connectors), or a
 *   personal token made by hand on /agents, for anything that can't open a
 *   browser to press Allow (scripts, custom agents, API clients). Personal
 *   tokens were removed for a few hours on 2026-10-07 and put back the same
 *   day: OAuth alone left those clients with no way in.
 * - A personal token is returned once by `createApiToken()`.
 * - Only the SHA-256 of a token (`sfl_` + 32 random bytes) is stored.
 * - A token resolves to an owner and a scope; callers pass that owner to
 *   lib/session-service.ts, which does the per-row ownership checks.
 * - Managing tokens (create / list / revoke) is cookie-session only, never
 *   bearer: a leaked token must not be able to mint more tokens.
 *
 * Server-only (Supabase service-role key, node:crypto).
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getSupabase } from "./supabase";

const TABLE = "api_tokens";
export const PREFIX = "sfl_";
export const MAX_ACTIVE_TOKENS = 10;
/** Only touch `last_used_at` when it is older than this — not on every call. */
const LAST_USED_REFRESH_MS = 60_000;

export type TokenScope = "read" | "write";

interface TokenRow {
  id: string;
  owner_id: string;
  name: string;
  token_hash: string;
  scope: TokenScope;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  /** Set for OAuth grants (lib/oauth.ts); null for personal tokens. */
  client_id: string | null;
  /** OAuth access tokens expire; personal tokens never do. */
  expires_at: string | null;
  /** Joined in by listApiTokens only. */
  oauth_clients?: { redirect_uris: unknown } | null;
}

/** What the app shows and returns — never the hash. */
export interface ApiToken {
  id: string;
  name: string;
  scope: TokenScope;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  /** "app" = connected through OAuth sign-in; "personal" = a hand-made token
   *  from before those were removed. */
  kind: "app" | "personal";
  /** Where the app's sign-in was sent back to (`claude.ai`). The app's name is
   *  whatever it called itself; this is the part it can't make up. */
  host: string | null;
}

/** The distinct hosts of a client's registered redirect URIs — for a custom
 *  app scheme (no host) the scheme itself. */
export function redirectHosts(uris: unknown): string[] {
  if (!Array.isArray(uris)) return [];
  const hosts = uris.flatMap((u) => {
    try {
      const url = new URL(String(u));
      return [url.host || url.protocol];
    } catch {
      return [];
    }
  });
  return [...new Set(hosts)];
}

/** One short label for where an app's sign-in returns to. A single host is
 *  shown whole (`claude.ai`, `localhost:55490`). Several hosts under one
 *  domain collapse to that domain — Gemini registers three
 *  `oauth-redirect*.googleusercontent.com` hosts, which filled the row and
 *  pushed the access level out of sight. Naive "last two labels", which is
 *  enough for a label (it is never used for a security decision). */
export function hostLabel(uris: unknown): string | null {
  const hosts = redirectHosts(uris);
  if (hosts.length <= 1) return hosts[0] ?? null;
  const domains = [...new Set(hosts.map((h) => h.split(":")[0].split(".").slice(-2).join(".")))];
  return domains.join(", ");
}

function rowToToken(row: TokenRow): ApiToken {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    kind: row.client_id ? "app" : "personal",
    host: hostLabel(row.oauth_clients?.redirect_uris),
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseTokenScope(v: unknown): TokenScope | null {
  return v === "read" || v === "write" ? v : null;
}

export async function listApiTokens(ownerId: string): Promise<ApiToken[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*, oauth_clients(redirect_uris)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Supabase listApiTokens: ${error.message}`);
  return (data as TokenRow[]).map(rowToToken);
}

export type CreateTokenResult =
  | { ok: true; token: string; record: ApiToken }
  | { ok: false; error: string };

/** Mint a token. The plain value is in the result and nowhere else — it can't
 *  be shown again. Refuses past MAX_ACTIVE_TOKENS un-revoked tokens. */
export async function createApiToken(ownerId: string, name: string, scope: TokenScope): Promise<CreateTokenResult> {
  const supabase = getSupabase();

  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("client_id", null) // connector (OAuth) grants don't use up the personal-token allowance
    .is("revoked_at", null);
  if (countError) throw new Error(`Supabase createApiToken: ${countError.message}`);
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    return { ok: false, error: `You can have at most ${MAX_ACTIVE_TOKENS} active tokens — revoke one first` };
  }

  const token = PREFIX + randomBytes(32).toString("base64url");
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ id: randomUUID(), owner_id: ownerId, name, scope, token_hash: hashToken(token) })
    .select("*")
    .single();
  if (error) throw new Error(`Supabase createApiToken: ${error.message}`);
  return { ok: true, token, record: rowToToken(data as TokenRow) };
}

/** Revoke one of the caller's own tokens. False when it isn't theirs / doesn't
 *  exist (the route answers 404 either way). Revoking twice is fine. */
export async function revokeApiToken(ownerId: string, id: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(`Supabase revokeApiToken: ${error.message}`);
  if (data.length > 0) return true;

  // Nothing updated: either not theirs, or already revoked (still success).
  const { data: existing, error: lookupError } = await getSupabase()
    .from(TABLE)
    .select("id")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (lookupError) throw new Error(`Supabase revokeApiToken: ${lookupError.message}`);
  return existing != null;
}

export interface TokenAuth {
  ownerId: string;
  scope: TokenScope;
  tokenId: string;
}

/** Resolve an `Authorization` header (`Bearer sfl_…`) to its owner and scope,
 *  or null for anything missing, malformed, unknown or revoked. */
export async function authenticateBearer(authorization: string | null | undefined): Promise<TokenAuth | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? "");
  const token = match?.[1];
  if (!token || !token.startsWith(PREFIX)) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error(`Supabase authenticateBearer: ${error.message}`);
  if (!data) return null;
  const row = data as TokenRow;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return null;

  const last = row.last_used_at ? Date.parse(row.last_used_at) : 0;
  if (Date.now() - last > LAST_USED_REFRESH_MS) {
    // Best-effort bookkeeping — never fail a request over it.
    await supabase
      .from(TABLE)
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(undefined, () => undefined);
  }

  return { ownerId: row.owner_id, scope: row.scope, tokenId: row.id };
}
