"use client";

import { useCallback, useSyncExternalStore } from "react";
import { fmtDate } from "@/lib/format";
import type { Lang } from "@/lib/i18n";

const noop = () => () => {};

/**
 * Formats a stored UTC instant ("2026-10-07T07:34:12Z") as a date and time in
 * the viewer's own timezone: "7 Oct 2026, 15:34" / "2026年10月7日 15:34".
 *
 * The server doesn't know that timezone, so the server render (and the first
 * client render, which must match it) shows the UTC date only; the time
 * appears right after hydration. useSyncExternalStore, not useEffect+setState
 * (see CLAUDE.md "Conventions").
 */
/** Pure part of the hook: `iso` in the runtime's own timezone. */
export function fmtLocalStamp(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = fmtDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, lang, false);
  return `${day}${lang === "zh-TW" ? " " : ", "}${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function useLocalStamp(lang: Lang): (iso: string) => string {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  return useCallback(
    (iso: string) => (hydrated ? fmtLocalStamp(iso, lang) : fmtDate(iso.slice(0, 10), lang, false)),
    [hydrated, lang]
  );
}
