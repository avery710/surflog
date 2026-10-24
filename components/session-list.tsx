"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { EntryCard } from "@/components/entry-card";
import { SessionCardSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import type { FeedStatus } from "@/lib/use-session-feed";
import type { Board, Session } from "@/lib/types";

/**
 * The session cards, loaded as you scroll: a sentinel after the last card
 * asks for the next 10 (`onLoadMore`, see lib/use-session-feed.ts) when it
 * comes within 400 px of the viewport. The observer is set up again after
 * every load, and a fresh `observe()` always reports the sentinel's current
 * state, so if the cards still don't fill the screen the next page follows
 * until they do. A failed load stops the auto-loading and shows Try again.
 * While nothing is loaded yet (a filter was just applied) the first page
 * shows as skeleton cards (at most 3, and no more than the match count; the
 * same ones the page loading uses, fading in
 * after 120 ms so a cached list never flashes them); the spinner is only for
 * loading the pages after the first (2026-10-23, by request).
 */
export function SessionList({
  sessions,
  boards,
  goal,
  hasMore,
  total,
  status,
  onLoadMore,
  onUpdated,
  onDeleted,
}: {
  sessions: Session[];
  boards: Board[];
  /** The owner's current goal — passed down to each card's edit panel. */
  goal: string | null;
  hasMore: boolean;
  /** How many sessions match in all (from the slim list): caps the skeleton cards. */
  total: number;
  status: FeedStatus;
  onLoadMore: () => void;
  onUpdated: (s: Session) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLang();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingFirstPage = status === "loading" && sessions.length === 0;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || status !== "idle") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          onLoadMore();
        }
      },
      { rootMargin: "0px 0px 400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, status, onLoadMore]);

  return (
    <>
      {sessions.map((s) => (
        <EntryCard key={s.id} session={s} boards={boards} goal={goal} onUpdated={onUpdated} onDeleted={onDeleted} />
      ))}
      {loadingFirstPage && (
        <div role="status" aria-busy="true" className="skeleton-body">
          <span className="sr-only">{t("list.loading")}</span>
          <div aria-hidden>
            {Array.from({ length: Math.min(3, Math.max(total, 1)) }, (_, i) => (
              <SessionCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}
      {hasMore && (
        <div ref={sentinelRef} className="flex min-h-10 items-center justify-center py-4" aria-live="polite">
          {status === "loading" && !loadingFirstPage && <Loader2 className="size-5 animate-spin text-[var(--on-page)]" aria-label={t("list.loading")} />}
          {status === "failed" && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <p className="text-[14px] font-medium text-[var(--on-page)]">{t("list.loadFailed")}</p>
              <Button variant="secondary" onClick={onLoadMore}>
                {t("list.retry")}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
