import { NextResponse } from "next/server";
import { auth } from "@/auth";

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

  // /dev is the local-only component showcase (synthetic data, no
  // Supabase/API calls) — see CLAUDE.md "Project agents" (storybook) and
  // app/dev/layout.tsx, which 404s it outright in production. Letting it
  // through here too only applies outside production, and only to this one
  // path prefix; every other route's auth is untouched.
  const isDevRoute = pathname === "/dev" || pathname.startsWith("/dev/");
  if (isDevRoute && process.env.NODE_ENV !== "production") return;

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  // surflog-logo.png is public/ — the sign-in page shows it before sign-in.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|surflog-logo.png).*)"],
};
