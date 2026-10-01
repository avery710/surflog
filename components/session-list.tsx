"use client";

import { useEffect, useRef, useState } from "react";
import { EntryCard } from "@/components/entry-card";
import type { Board, Session } from "@/lib/types";

/** Cards rendered up front, and how many more each reveal adds. */
const PAGE = 5;

/**
 * The session list, lazy-rendered: the full `sessions` array is still
 * loaded (the dashboard's stats need all of it) — only the cards are
 * revealed PAGE at a time, as a sentinel after the last card nears the
 * viewport.
 */
export function SessionList({
  sessions,
  boards,
  onUpdated,
  onDeleted,
}: {
  sessions: Session[];
  boards: Board[];
  onUpdated: (s: Session) => void;
  onDeleted: (id: string) => void;
}) {
  const [shown, setShown] = useState(PAGE);
  // A newly logged session grows the list by one; grow `shown` with it so
  // the new card appears without the bottom card disappearing. Adjusted
  // during render (React's "storing info from previous renders" pattern),
  // not in an effect. A delete leaves `shown` alone, so the next card
  // below simply moves up into view.
  const [prevLength, setPrevLength] = useState(sessions.length);
  if (sessions.length !== prevLength) {
    if (sessions.length > prevLength) setShown((n) => n + (sessions.length - prevLength));
    setPrevLength(sessions.length);
  }

  const visible = sessions.slice(0, shown);
  const hasMore = shown < sessions.length;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Re-observed after every reveal: a fresh observe() always reports the
  // sentinel's current state, so if it's still on screen (the cards didn't
  // fill the viewport) the next batch is revealed too, until it isn't.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setShown((n) => n + PAGE);
        }
      },
      { rootMargin: "0px 0px 400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, hasMore]);

  return (
    <>
      {visible.map((s) => (
        <EntryCard key={s.id} session={s} boards={boards} onUpdated={onUpdated} onDeleted={onDeleted} />
      ))}
      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
    </>
  );
}
