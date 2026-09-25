"use client";

import { useLang } from "@/lib/i18n";
import type { WindMode } from "@/lib/spot-fit";

/**
 * How the wind sat relative to this beach (offshore, cross-shore, onshore…),
 * from lib/spot-fit.ts. Describes the wind, doesn't score the session (see
 * CLAUDE.md "The unfalsifiability problem").
 */
export function WindShoreBadge({ mode }: { mode: WindMode }) {
  const { t } = useLang();
  return <span>{t(`wind.mode.${mode}`)}</span>;
}
