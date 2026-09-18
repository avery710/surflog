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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
