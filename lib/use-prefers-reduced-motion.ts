"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/**
 * useSyncExternalStore, not useEffect+setState (see CLAUDE.md
 * "Conventions") — same shape as useLang()'s own storage read. Server
 * snapshot is `false` so hydration always starts from "animate", matching
 * the vast majority of visitors; a reduced-motion client corrects itself
 * on the first render after mount.
 *
 * Shared out of components/board-rack.tsx (2026-09-30, the reorder-drag
 * transition) 2026-10-02 when the header auto-hide slide needed the same
 * check — one implementation, not two copies drifting apart.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}
