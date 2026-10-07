import { CORS_HEADERS, originOf } from "@/lib/oauth";

/**
 * RFC 9728 protected-resource metadata: tells an MCP client which
 * authorization server guards /api/mcp. Served at the root and at the
 * path-suffixed form (`…/oauth-protected-resource/api/mcp`) some clients try.
 * proxy.ts lets /.well-known through without sign-in.
 */
export async function GET(req: Request) {
  const origin = originOf(req);
  return Response.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      scopes_supported: ["read", "write"],
      bearer_methods_supported: ["header"],
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
