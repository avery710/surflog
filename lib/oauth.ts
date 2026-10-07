/**
 * OAuth 2.1 for the MCP endpoint (authorization-code + PKCE, public clients,
 * dynamic client registration) — what claude.ai's custom connectors, web and
 * mobile, speak. See supabase/migrations/20261007000000_add_oauth.sql.
 *
 * An access token is a normal `api_tokens` row (so lib/token-auth.ts needs no
 * second code path) that expires after an hour and carries a refresh token.
 * Refreshing rotates both in place: the old pair stops working at once.
 * Only SHA-256 hashes are stored, as for personal tokens.
 *
 * Server-only (Supabase service-role key, node:crypto).
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getSupabase } from "./supabase";
import { hashToken, PREFIX, redirectHosts, type TokenScope } from "./token-auth";

export const ACCESS_TOKEN_TTL_S = 60 * 60;
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const REFRESH_PREFIX = "sflr_";
const CODE_PREFIX = "sflc_";
// Gemini's custom apps register with more than five callbacks (all on
// oauth-redirect.googleusercontent.com); five refused it (2026-10-07).
const MAX_REDIRECT_URIS = 20;

export interface OAuthClient {
  clientId: string;
  name: string;
  redirectUris: string[];
}

/** A redirect URI a client may register: https, plain http only to loopback
 *  (native apps), or a custom app scheme. Never javascript:, data: and the
 *  like, and no fragment (RFC 6749 §3.1.2). */
export function isAllowedRedirectUri(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  return !["javascript:", "data:", "file:", "blob:", "vbscript:", "about:", "ws:", "wss:"].includes(u.protocol);
}

export type RegisterResult =
  | { ok: true; client: OAuthClient }
  | { ok: false; error: "invalid_redirect_uri" | "invalid_client_metadata"; description: string };

export async function registerClient(input: { name?: unknown; redirectUris?: unknown }): Promise<RegisterResult> {
  const uris = input.redirectUris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
    return { ok: false, error: "invalid_redirect_uri", description: `redirect_uris must list 1-${MAX_REDIRECT_URIS} URIs` };
  }
  if (!uris.every(isAllowedRedirectUri)) {
    return { ok: false, error: "invalid_redirect_uri", description: "a redirect URI is not allowed" };
  }
  // Control characters out, then a length cap: the name is shown on the consent page.
  const name = (typeof input.name === "string" ? input.name : "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
  const redirectUris = [...new Set(uris as string[])];

  const clientId = randomUUID();
  const { error } = await getSupabase()
    .from("oauth_clients")
    .insert({ client_id: clientId, client_name: name || "MCP client", redirect_uris: redirectUris });
  if (error) throw new Error(`Supabase registerClient: ${error.message}`);
  return { ok: true, client: { clientId, name: name || "MCP client", redirectUris } };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 100) return null;
  const { data, error } = await getSupabase()
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`Supabase getClient: ${error.message}`);
  if (!data) return null;
  return { clientId: data.client_id, name: data.client_name, redirectUris: data.redirect_uris as string[] };
}

/** Exact string match against what the client registered — no prefixes, no
 *  wildcards (the open-redirect / code-theft hole). */
export function redirectUriMatches(client: OAuthClient, uri: string): boolean {
  return client.redirectUris.includes(uri);
}

/** PKCE: base64url(SHA-256(verifier)) must equal the challenge sent with the
 *  authorization request. Only S256 is accepted. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

/** Called after the signed-in user approves. Returns the one-time code. */
export async function createAuthCode(input: {
  clientId: string;
  ownerId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: TokenScope;
}): Promise<string> {
  const code = CODE_PREFIX + randomBytes(32).toString("base64url");
  const { error } = await getSupabase()
    .from("oauth_codes")
    .insert({
      code_hash: hashToken(code),
      client_id: input.clientId,
      owner_id: input.ownerId,
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      scope: input.scope,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
  if (error) throw new Error(`Supabase createAuthCode: ${error.message}`);
  return code;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: TokenScope;
}

export type TokenResult = { ok: true; tokens: TokenResponse } | { ok: false; error: "invalid_grant" | "invalid_request" };

function newPair() {
  const access = PREFIX + randomBytes(32).toString("base64url");
  const refresh = REFRESH_PREFIX + randomBytes(32).toString("base64url");
  return { access, refresh };
}

function response(access: string, refresh: string, scope: TokenScope): TokenResponse {
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refresh, scope };
}

/** authorization_code grant. The code is burned first (atomic: only an unused,
 *  unexpired code updates), so a replay or a failed PKCE check can't be retried. */
export async function exchangeCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResult> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("oauth_codes")
    .update({ used_at: now })
    .eq("code_hash", hashToken(input.code))
    .is("used_at", null)
    .gt("expires_at", now)
    .select("*");
  if (error) throw new Error(`Supabase exchangeCode: ${error.message}`);
  const row = data?.[0];
  if (!row) return { ok: false, error: "invalid_grant" };

  if (row.client_id !== input.clientId || row.redirect_uri !== input.redirectUri) {
    return { ok: false, error: "invalid_grant" };
  }
  if (!pkceMatches(input.codeVerifier, row.code_challenge)) return { ok: false, error: "invalid_grant" };

  const client = await getClient(row.client_id);
  const { access, refresh } = newPair();
  const { error: insertError } = await supabase.from("api_tokens").insert({
    id: randomUUID(),
    owner_id: row.owner_id,
    name: client?.name ?? "MCP client",
    scope: row.scope,
    token_hash: hashToken(access),
    client_id: row.client_id,
    expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000).toISOString(),
    refresh_hash: hashToken(refresh),
    refresh_expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
  });
  if (insertError) throw new Error(`Supabase exchangeCode: ${insertError.message}`);
  return { ok: true, tokens: response(access, refresh, row.scope) };
}

/** refresh_token grant: rotates the access and refresh token of the same grant. */
export async function refreshGrant(input: { refreshToken: string; clientId: string }): Promise<TokenResult> {
  if (!input.refreshToken.startsWith(REFRESH_PREFIX)) return { ok: false, error: "invalid_grant" };
  const { access, refresh } = newPair();
  const now = new Date().toISOString();
  // One conditional update: a revoked, expired, other-client or already-rotated
  // refresh token matches nothing.
  const { data, error } = await getSupabase()
    .from("api_tokens")
    .update({
      token_hash: hashToken(access),
      expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000).toISOString(),
      refresh_hash: hashToken(refresh),
      refresh_expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
    })
    .eq("refresh_hash", hashToken(input.refreshToken))
    .eq("client_id", input.clientId)
    .is("revoked_at", null)
    .gt("refresh_expires_at", now)
    .select("scope");
  if (error) throw new Error(`Supabase refreshGrant: ${error.message}`);
  const row = data?.[0];
  if (!row) return { ok: false, error: "invalid_grant" };
  return { ok: true, tokens: response(access, refresh, row.scope as TokenScope) };
}

/** Where this deployment is reachable, for the metadata documents. Behind
 *  Vercel's proxy the forwarded headers carry the public host. */
export function originOf(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};

export interface AuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  /** What the consent page preselects; the user can change it. */
  defaultScope: TokenScope;
}

/** Validate the query a client sent to /oauth/authorize (and again, from the
 *  hidden fields, when the consent form is submitted). Returns null for
 *  anything we shouldn't redirect back to — an unknown client or an
 *  unregistered redirect URI must show an error, never a redirect. */
export async function parseAuthorizeRequest(p: Record<string, string | undefined>): Promise<AuthorizeRequest | null> {
  if (p.response_type !== "code") return null;
  if (p.code_challenge_method !== "S256") return null;
  const challenge = p.code_challenge ?? "";
  if (!/^[A-Za-z0-9\-_]{43}$/.test(challenge)) return null;
  const client = await getClient(p.client_id ?? "");
  if (!client || !p.redirect_uri || !redirectUriMatches(client, p.redirect_uri)) return null;
  const asked = (p.scope ?? "").split(/\s+/).filter(Boolean);
  const defaultScope: TokenScope = asked.length > 0 && asked.every((s) => s === "read") ? "read" : "write";
  return { client, redirectUri: p.redirect_uri, codeChallenge: challenge, state: (p.state ?? "").slice(0, 500), defaultScope };
}

/** One line of the admin's "Connected services" table: an app (grouped by the
 *  name it registered with and where its sign-in returns to) and how many
 *  people currently have it connected. Counts only — never who. */
export interface ConnectedService {
  /** "personal" = hand-made tokens from before those were removed. */
  kind: "app" | "personal";
  name: string;
  host: string | null;
  users: number;
  connections: number;
  lastUsedAt: string | null;
}

/** Admin only (the caller checks). Active = not revoked; an app whose every
 *  grant was revoked, or that registered and was never approved, is left out. */
export async function listConnectedServices(): Promise<ConnectedService[]> {
  const { data, error } = await getSupabase()
    .from("api_tokens")
    .select("owner_id, last_used_at, client_id, oauth_clients(client_name, redirect_uris)")
    .is("revoked_at", null);
  if (error) throw new Error(`Supabase listConnectedServices: ${error.message}`);

  const groups = new Map<string, { svc: ConnectedService; owners: Set<string> }>();
  for (const row of data as unknown as {
    owner_id: string;
    last_used_at: string | null;
    client_id: string | null;
    oauth_clients: { client_name: string; redirect_uris: unknown } | null;
  }[]) {
    const app = row.client_id != null;
    const name = app ? (row.oauth_clients?.client_name ?? "MCP client") : "";
    const host = app ? redirectHosts(row.oauth_clients?.redirect_uris).join(", ") || null : null;
    // An app registers anew each time someone adds it, so group by what it
    // says it is and where it lives, not by client id.
    const key = app ? `app\u0000${name}\u0000${host}` : "personal";
    const g = groups.get(key) ?? {
      svc: { kind: app ? "app" : "personal", name, host, users: 0, connections: 0, lastUsedAt: null },
      owners: new Set<string>(),
    };
    g.owners.add(row.owner_id);
    g.svc.connections++;
    if (row.last_used_at && (!g.svc.lastUsedAt || row.last_used_at > g.svc.lastUsedAt)) g.svc.lastUsedAt = row.last_used_at;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g.svc, users: g.owners.size }))
    .sort((a, b) => (a.kind === b.kind ? b.users - a.users || a.name.localeCompare(b.name) : a.kind === "app" ? -1 : 1));
}
