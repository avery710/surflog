"use client";

import { useSyncExternalStore } from "react";

// The zone can't change while the page is open in any way worth tracking.
const subscribe = () => () => {};

function read(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * The browser's IANA zone ("Asia/Taipei"), or null on the server and when
 * the browser won't say. Needs no permission. useSyncExternalStore, not
 * useEffect+setState — same reasoning as lib/use-prefers-reduced-motion.ts:
 * the server snapshot is null, so hydration starts from "unknown" and the
 * client corrects itself right after.
 */
export function useBrowserTimeZone(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
