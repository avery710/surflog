import { CORS_HEADERS, originOf } from "@/lib/oauth";

/** RFC 8414 authorization-server metadata — see lib/oauth.ts. */
export async function GET(req: Request) {
  const origin = originOf(req);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["read", "write"],
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
