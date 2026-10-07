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

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`oauth:token:${ip}`, 60, 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "temporarily_unavailable" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterS) } }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return fail("invalid_request");
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  const grantType = field("grant_type");
  const clientId = field("client_id");
  if (!clientId) return fail("invalid_request");

  let result: TokenResult;
  if (grantType === "authorization_code") {
    const code = field("code");
    const redirectUri = field("redirect_uri");
    const codeVerifier = field("code_verifier");
    if (!code || !redirectUri || !codeVerifier) return fail("invalid_request");
    result = await exchangeCode({ code, clientId, redirectUri, codeVerifier });
  } else if (grantType === "refresh_token") {
    const refreshToken = field("refresh_token");
    if (!refreshToken) return fail("invalid_request");
    result = await refreshGrant({ refreshToken, clientId });
  } else {
    return fail("unsupported_grant_type");
  }

  if (!result.ok) return fail(result.error);
  return Response.json(result.tokens, { headers: NO_STORE });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
