import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny chainable stand-in for the Supabase query builder: every filter
// returns the builder, awaiting it yields whatever the test queued.
const result = vi.hoisted(() => ({ next: { data: null as unknown, error: null as unknown }, calls: [] as string[][] }));
vi.mock("@/lib/supabase", () => {
  const builder: Record<string, unknown> = {};
  for (const m of ["insert", "update", "select", "eq", "is", "gt", "maybeSingle", "single"]) {
    builder[m] = (...args: unknown[]) => {
      result.calls.push([m, ...args.map(String)]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result.next);
  return { getSupabase: () => ({ from: () => builder }) };
});

import {
  exchangeCode,
  isAllowedRedirectUri,
  originOf,
  parseAuthorizeRequest,
  pkceMatches,
  redirectUriMatches,
  refreshGrant,
} from "@/lib/oauth";

const verifier = "a".repeat(64);
const challenge = createHash("sha256").update(verifier).digest("base64url");

beforeEach(() => {
  result.calls = [];
  result.next = { data: null, error: null };
});

describe("isAllowedRedirectUri", () => {
  it.each(["https://claude.ai/api/mcp/auth_callback", "http://localhost:3000/cb", "http://127.0.0.1/cb", "myapp://callback"])(
    "allows %s",
    (u) => expect(isAllowedRedirectUri(u)).toBe(true)
  );
  it.each([
    "http://evil.example/cb",
    "javascript:alert(1)",
    "data:text/html,x",
    "https://claude.ai/cb#frag",
    "not a url",
    "",
    42,
    undefined,
  ])("refuses %j", (u) => expect(isAllowedRedirectUri(u)).toBe(false));
});

describe("pkceMatches", () => {
  it("accepts the right verifier only", () => {
    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches("b".repeat(64), challenge)).toBe(false);
  });
  it("refuses a verifier outside RFC 7636's length/charset", () => {
    expect(pkceMatches("short", createHash("sha256").update("short").digest("base64url"))).toBe(false);
  });
});

describe("redirectUriMatches", () => {
  const client = { clientId: "c", name: "n", redirectUris: ["https://a.example/cb"] };
  it("is an exact match, no prefixes", () => {
    expect(redirectUriMatches(client, "https://a.example/cb")).toBe(true);
    expect(redirectUriMatches(client, "https://a.example/cb/evil")).toBe(false);
    expect(redirectUriMatches(client, "https://a.example/cb?x=1")).toBe(false);
  });
});

describe("parseAuthorizeRequest", () => {
  const good = {
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: challenge,
    client_id: "c1",
    redirect_uri: "https://a.example/cb",
    state: "xyz",
  };
  const client = { client_id: "c1", client_name: "Claude", redirect_uris: ["https://a.example/cb"] };

  it("accepts a registered client and redirect, defaulting to write", async () => {
    result.next = { data: client, error: null };
    const req = await parseAuthorizeRequest(good);
    expect(req?.client.name).toBe("Claude");
    expect(req?.defaultScope).toBe("write");
  });
  it("preselects read only when only read was asked for", async () => {
    result.next = { data: client, error: null };
    expect((await parseAuthorizeRequest({ ...good, scope: "read" }))?.defaultScope).toBe("read");
  });
  it("refuses an unregistered redirect URI", async () => {
    result.next = { data: client, error: null };
    expect(await parseAuthorizeRequest({ ...good, redirect_uri: "https://evil.example/cb" })).toBeNull();
  });
  it("refuses an unknown client, plain PKCE and a missing challenge", async () => {
    result.next = { data: null, error: null };
    expect(await parseAuthorizeRequest(good)).toBeNull();
    result.next = { data: client, error: null };
    expect(await parseAuthorizeRequest({ ...good, code_challenge_method: "plain" })).toBeNull();
    expect(await parseAuthorizeRequest({ ...good, code_challenge: undefined })).toBeNull();
    expect(await parseAuthorizeRequest({ ...good, response_type: "token" })).toBeNull();
  });
});

describe("exchangeCode", () => {
  const input = { code: "sflc_x", clientId: "c1", redirectUri: "https://a.example/cb", codeVerifier: verifier };
  const row = { client_id: "c1", owner_id: "o1", redirect_uri: "https://a.example/cb", code_challenge: challenge, scope: "read" };

  it("rejects a code that is unknown, used or expired (nothing updated)", async () => {
    result.next = { data: [], error: null };
    expect(await exchangeCode(input)).toEqual({ ok: false, error: "invalid_grant" });
  });
  it("rejects a wrong verifier, client or redirect URI", async () => {
    result.next = { data: [row], error: null };
    expect(await exchangeCode({ ...input, codeVerifier: "b".repeat(64) })).toEqual({ ok: false, error: "invalid_grant" });
    expect(await exchangeCode({ ...input, clientId: "other" })).toEqual({ ok: false, error: "invalid_grant" });
    expect(await exchangeCode({ ...input, redirectUri: "https://a.example/other" })).toEqual({ ok: false, error: "invalid_grant" });
  });
  it("issues a pair with the granted scope", async () => {
    result.next = { data: [row], error: null };
    const out = await exchangeCode(input);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.tokens.access_token).toMatch(/^sfl_/);
      expect(out.tokens.refresh_token).toMatch(/^sflr_/);
      expect(out.tokens.scope).toBe("read");
      expect(out.tokens.expires_in).toBe(3600);
    }
  });
});

describe("refreshGrant", () => {
  it("refuses anything that isn't a refresh token without a lookup", async () => {
    expect(await refreshGrant({ refreshToken: "sfl_access", clientId: "c1" })).toEqual({ ok: false, error: "invalid_grant" });
    expect(result.calls).toEqual([]);
  });
  it("refuses when no live grant matches (revoked, expired, other client, already rotated)", async () => {
    result.next = { data: [], error: null };
    expect(await refreshGrant({ refreshToken: "sflr_x", clientId: "c1" })).toEqual({ ok: false, error: "invalid_grant" });
  });
  it("rotates to a new pair", async () => {
    result.next = { data: [{ scope: "write" }], error: null };
    const out = await refreshGrant({ refreshToken: "sflr_x", clientId: "c1" });
    expect(out.ok && out.tokens.refresh_token).not.toBe("sflr_x");
    expect(out.ok && out.tokens.scope).toBe("write");
  });
});

describe("originOf", () => {
  it("prefers the forwarded host and protocol", () => {
    const req = new Request("http://localhost:3000/x", { headers: { "x-forwarded-host": "app.example", "x-forwarded-proto": "https" } });
    expect(originOf(req)).toBe("https://app.example");
    expect(originOf(new Request("http://localhost:3000/x"))).toBe("http://localhost:3000");
  });
});

describe("listConnectedServices", () => {
  it("groups by app name and host, counts distinct users, and never returns an owner", async () => {
    const claude = { client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] };
    result.next = {
      data: [
        { owner_id: "a", last_used_at: "2026-10-07T06:00:00Z", client_id: "c1", oauth_clients: claude },
        { owner_id: "a", last_used_at: "2026-10-07T08:00:00Z", client_id: "c2", oauth_clients: claude },
        { owner_id: "b", last_used_at: null, client_id: "c3", oauth_clients: claude },
        { owner_id: "b", last_used_at: null, client_id: "c4", oauth_clients: { client_name: "Claude", redirect_uris: ["https://evil.example/cb"] } },
        { owner_id: "a", last_used_at: null, client_id: null, oauth_clients: null },
      ],
      error: null,
    };
    const { listConnectedServices } = await import("@/lib/oauth");
    const out = await listConnectedServices();
    expect(out).toEqual([
      { kind: "app", name: "Claude", host: "claude.ai", users: 2, connections: 3, lastUsedAt: "2026-10-07T08:00:00Z" },
      { kind: "app", name: "Claude", host: "evil.example", users: 1, connections: 1, lastUsedAt: null },
      { kind: "personal", name: "", host: null, users: 1, connections: 1, lastUsedAt: null },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/owner/);
  });
});
