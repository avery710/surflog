import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { publicSharePath } from "@/lib/share-paths";
import { clientIp, limitShareRequest } from "@/lib/share-limits";

/**
 * Everything requires sign-in except the auth routes themselves and the
 * sign-in page. Page requests get redirected to /signin (with a callback
 * back to where they were headed); API requests get a plain 401 — a
 * redirect would just hand the caller an HTML sign-in page instead of JSON.
 *
 * Named `proxy` (not `middleware`) — Next.js 16 renamed the convention;
 * see node_modules/next/dist/docs/.../proxy.md.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthRoute = pathname.startsWith("/api/auth") || pathname === "/signin";
  if (isAuthRoute) return;
  // "/" is the landing page when signed out (app/page.tsx picks landing vs
  // journal itself) — only the exact root, nothing under it.
  if (pathname === "/") return;
  // The landing page's own pictures (public/landing/): one flat folder of
  // JPEGs, nothing else under it.
  if (/^\/landing\/[a-z0-9-]+\.jpg$/.test(pathname)) return;

  // The MCP endpoint authenticates with a personal access token (bearer),
  // not the cookie session — app/api/mcp/route.ts does that check itself
  // and 401s without a valid token. Exactly this path, nothing under it.
  if (pathname === "/api/mcp") return;

  // OAuth for MCP connectors (lib/oauth.ts): the metadata documents and the
  // two endpoints a connector calls before any user is involved. Each is its
  // own credential check (registration is rate limited, the token endpoint
  // wants a code or refresh token). /oauth/authorize is NOT here — it needs
  // the cookie session, which is the whole point of the consent page.
  if (
    pathname.startsWith("/.well-known/oauth-") ||
    pathname === "/api/oauth/register" ||
    pathname === "/api/oauth/token"
  ) {
    return;
  }

  // Public share links: exactly /s/<token>, /s/<token>/card.png and
  // /api/share/<token>/media/<id> (lib/share-paths.ts). Each handler does its
  // own token check; here only the per-IP request limit is applied.
  const shareKind = publicSharePath(pathname);
  if (shareKind) {
    const limited = limitShareRequest(clientIp(req.headers), shareKind);
    if (!limited.ok) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterS), "Cache-Control": "no-store" },
      });
    }
    return;
  }

  // /dev is the local-only component showcase (synthetic data, no
  // Supabase/API calls) — see CLAUDE.md "Project agents" (storybook) and
  // app/dev/layout.tsx, which 404s it outright in production. Letting it
  // through here too only applies outside production, and only to this one
  // path prefix; every other route's auth is untouched.
  const isDevRoute = pathname === "/dev" || pathname.startsWith("/dev/");
  if (isDevRoute && process.env.NODE_ENV !== "production") return;
  if (isDevRoute && process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/signin", req.nextUrl.origin);
    // Keep the query: /oauth/authorize is meaningless without its parameters.
    signInUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  // surflog-logo.png is public/ — the sign-in and landing pages show it before sign-in.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|surflog-logo.png).*)"],
};
