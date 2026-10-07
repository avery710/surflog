import { NextResponse } from "next/server";

/** The one response for an unknown token, a turned-off token, a foreign blob
 *  id — byte-for-byte the same, so nothing tells them apart. */
export function shareNotFound(): NextResponse {
  return NextResponse.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export function shareTooMany(retryAfterS: number): NextResponse {
  return NextResponse.json(
    { error: "too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfterS), "Cache-Control": "no-store" } }
  );
}
