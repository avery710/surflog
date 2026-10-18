"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { EntryCard } from "@/components/entry-card";
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
 */
export function SessionList({
  sessions,
  boards,
  goal,
  hasMore,
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
  status: FeedStatus;
  onLoadMore: () => void;
  onUpdated: (s: Session) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLang();
  const sentinelRef = useRef<HTMLDivElement>(null);

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
      {hasMore && (
        <div ref={sentinelRef} className="flex min-h-10 items-center justify-center py-4" aria-live="polite">
          {status === "loading" && <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={t("list.loading")} />}
          {status === "failed" && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <p className="text-[14px] font-medium text-muted-foreground">{t("list.loadFailed")}</p>
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
