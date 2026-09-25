"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-browser default spot for the log form — a convenience, like the
 * language setting, so it lives in localStorage, not Supabase. Keyed by the
 * signed-in user's ownerId so two people sharing a browser don't mix.
 * Read via useSyncExternalStore (server snapshot = no default), same pattern
 * as lib/i18n.tsx.
 */
const listeners = new Set<() => void>();

function storageKey(ownerId: string | undefined) {
  return ownerId ? `surflog:defaultSpot:${ownerId}` : "surflog:defaultSpot";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in sync too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private window / blocked storage
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function useDefaultSpot(ownerId: string | undefined) {
  const key = storageKey(ownerId);
  const value = useSyncExternalStore(subscribe, () => read(key), getServerSnapshot);

  const setDefault = useCallback(
    (spot: string | null) => {
      try {
        if (spot) localStorage.setItem(key, spot);
        else localStorage.removeItem(key);
      } catch {
        // per-viewer convenience only — fine if it doesn't persist
      }
      listeners.forEach((fn) => fn());
    },
    [key]
  );

  return [value, setDefault] as const;
}
