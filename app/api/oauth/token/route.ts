import { CORS_HEADERS, exchangeCode, refreshGrant, type TokenResult } from "@/lib/oauth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * OAuth token endpoint: authorization_code (+ PKCE) and refresh_token, for
 * public clients. No sign-in here — the code or refresh token is the
 * credential. See lib/oauth.ts.
 */
const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store", Pragma: "no-cache" };

function fail(error: string, status = 400) {
  return Response.json({ error }, { status, headers: NO_STORE });
}

function basicUser(header: string | null): string {
  const m = /^Basic\s+(\S+)$/i.exec(header?.trim() ?? "");
  if (!m) return "";
  try {
    return decodeURIComponent(Buffer.from(m[1], "base64").toString("utf8").split(":")[0] ?? "");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`oauth:token:${ip}`, 60, 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "temporarily_unavailable" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterS) } }
    );
  }

  // Form-encoded per the spec; a JSON body is tolerated because some clients
  // send one.
  const contentType = req.headers.get("content-type") ?? "";
  const params = new Map<string, string>();
  if (contentType.includes("json")) {
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object") {
      for (const [k, v] of Object.entries(body)) if (typeof v === "string") params.set(k, v);
    }
  } else {
    const form = await req.formData().catch(() => null);
    form?.forEach((v, k) => {
      if (typeof v === "string") params.set(k, v);
    });
  }
  const field = (k: string) => params.get(k) ?? "";
  const basicId = basicUser(req.headers.get("authorization"));
  // Never the values (they are credentials) — only which ones arrived, so a
  // client that fails here can be diagnosed from the log.
  const refuse = (error: string) => {
    console.warn("[oauth] token refused", {
      error,
      grantType: field("grant_type") || null,
      contentType,
      sent: [...params.keys()].sort(),
      clientIdFrom: field("client_id") ? "body" : basicId ? "basic" : "none",
    });
    return fail(error);
  };

  const grantType = field("grant_type");
  // Clients are public (no secret), so the id normally comes in the form. A
  // client that asked to register with a secret-based method (Gemini does) may
  // still send HTTP Basic: take the id from there and ignore the password.
  const clientId = field("client_id") || basicId;
  if (!clientId) return refuse("invalid_request");

  let result: TokenResult;
  if (grantType === "authorization_code") {
    const code = field("code");
    const redirectUri = field("redirect_uri");
    const codeVerifier = field("code_verifier");
    if (!code || !codeVerifier) return refuse("invalid_request");
    result = await exchangeCode({ code, clientId, redirectUri: redirectUri || undefined, codeVerifier });
  } else if (grantType === "refresh_token") {
    const refreshToken = field("refresh_token");
    if (!refreshToken) return refuse("invalid_request");
    result = await refreshGrant({ refreshToken, clientId });
  } else {
    return refuse("unsupported_grant_type");
  }

  if (!result.ok) return refuse(result.error);
  return Response.json(result.tokens, { headers: NO_STORE });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
