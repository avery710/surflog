import { CORS_HEADERS, registerClient } from "@/lib/oauth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * RFC 7591 dynamic client registration — how claude.ai introduces itself.
 * Open by design (no sign-in: the connector registers before the user does
 * anything), so it is rate limited per caller IP and stores nothing but a
 * name and redirect URIs. A client can't do anything until a signed-in user
 * approves it on the consent page.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`oauth:register:${ip}`, 20, 60 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "temporarily_unavailable", error_description: "too many registrations" },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(limit.retryAfterS) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400, headers: CORS_HEADERS });
  }
  const result = await registerClient({ name: body.client_name, redirectUris: body.redirect_uris });
  if (!result.ok) {
    return Response.json({ error: result.error, error_description: result.description }, { status: 400, headers: CORS_HEADERS });
  }
  return Response.json(
    {
      client_id: result.client.clientId,
      client_name: result.client.name,
      redirect_uris: result.client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
