"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pageToFetch } from "@/lib/pagination";
import { takeFresh, type CacheEntry } from "@/lib/list-cache";
import { filterToParams, matchesFilter, type SessionFilter } from "@/lib/session-filter";
import { addToLoaded, mergePage, toStat, upsertStat, type SessionStat } from "@/lib/session-stats";
import type { Session } from "@/lib/types";

export type FeedStatus = "idle" | "loading" | "failed";

/**
 * The homepage's sessions, two ways at once:
 *
 * - `stats`: every session as a slim row (date, spot, board, goal ticks) —
 *   what the dashboard needs, loaded in full by the server page;
 * - `loaded`: full sessions for the cards, the top of the list only. The
 *   server renders the first 10; `loadMore` appends 10 more from
 *   `GET /api/sessions?page=N` each time the list's sentinel scrolls into
 *   view (infinite scroll). `loaded` is always rows 0..n-1 of the list, which
 *   is what lets `pageToFetch` and `mergePage` avoid gaps and repeats.
 *
 * With a `filter` set, "the list" means the filtered list: the API filters in
 * the database, `matches` (the slim list, filtered in memory) gives the count,
 * and changing the filter empties `loaded` so the sentinel loads page 1 of the
 * new list. The dashboard's `stats` are never filtered.
 *
 * Lists you switch away from are kept for `FILTER_CACHE_MS` (60 s, lib/
 * list-cache.ts), so going back to a filter is instant. The list on screen is
 * never refreshed by itself. Every mutator below clears the kept lists.
 *
 * The mutators keep both lists in step after a create, edit or delete, and
 * a fetch that was in flight during one is thrown away (`version`).
 */
export function useSessionFeed({
  initialStats,
  initialLoaded,
  initialLatest,
}: {
  initialStats: SessionStat[];
  initialLoaded: Session[];
  initialLatest: Session | null;
}) {
  const [stats, setStats] = useState(initialStats);
  const [loaded, setLoaded] = useState(initialLoaded);
  // The newest session in full, for the calendar's phone panel (the cards
  // are only a prefix; the newest is nearly always in it, but not by rule).
  const [latest, setLatest] = useState(initialLatest);
  const [filter, setFilterState] = useState<SessionFilter>({});
  const [status, setStatus] = useState<FeedStatus>("idle");
  const inFlight = useRef(false);
  const version = useRef(0);
  // Lists switched away from, by filter (`filterToParams` string), and when the
  // list on screen started loading. Only touched in handlers and effects.
  const kept = useRef(new Map<string, CacheEntry<Session[]>>());
  const loadedAt = useRef(0);
  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  // the slim rows that pass the filter: how long the (filtered) list is
  const matches = useMemo(() => stats.filter((s) => matchesFilter(s, filter)), [stats, filter]);
  const total = matches.length;
  const hasMore = loaded.length < total;

  /** Replace the filter. A list kept less than a minute ago comes back as it
   *  was; otherwise the list empties and loads from its top. */
  function setFilter(next: SessionFilter) {
    version.current++;
    const now = Date.now();
    if (loaded.length > 0) kept.current.set(filterToParams(filter).toString(), { value: loaded, at: loadedAt.current });
    const hit = takeFresh(kept.current, filterToParams(next).toString(), now);
    setFilterState(next);
    setLoaded(hit ? hit.value : []);
    loadedAt.current = hit ? hit.at : now;
    setStatus("idle");
  }

  const loadMore = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    const startedAt = version.current;
    let next: FeedStatus = "idle";
    try {
      const params = filterToParams(filter);
      params.set("page", String(pageToFetch(loaded.length)));
      const res = await fetch(`/api/sessions?${params}`, { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.sessions)) throw new Error("load failed");
      // a create or delete landed meanwhile: the rows are for a list that no
      // longer exists, so drop them and let the sentinel ask again
      if (startedAt === version.current) setLoaded((prev) => mergePage(prev, body.sessions as Session[]));
    } catch {
      if (startedAt === version.current) next = "failed";
    } finally {
      inFlight.current = false;
      setStatus(next);
    }
  }, [loaded.length, filter]);

  // The newest session changed without us holding it (the newest was deleted:
  // the next one is it): fetch it. Created/edited ones are set directly below.
  const latestId = stats[0]?.id ?? null;
  const latestIsCurrent = latestId === null || latest?.id === latestId;
  useEffect(() => {
    if (latestIsCurrent) return;
    let cancelled = false;
    fetch("/api/sessions?page=1&pageSize=1", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.sessions?.[0]) setLatest(body.sessions[0] as Session);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [latestIsCurrent, latestId]);

  function created(s: Session) {
    kept.current.clear();
    version.current++;
    const next = upsertStat(stats, toStat(s));
    setStats(next);
    // placed by its rank in the filtered list; not at all if it doesn't pass the filter
    if (matchesFilter(s, filter)) {
      const rank = next.filter((x) => matchesFilter(x, filter)).findIndex((x) => x.id === s.id);
      setLoaded((prev) => addToLoaded(prev, s, rank));
    }
    if (next[0].id === s.id) setLatest(s);
  }

  /** An edit. Date and time are fixed after creation, so nothing moves. */
  function updated(s: Session) {
    kept.current.clear();
    setStats((prev) => upsertStat(prev, toStat(s)));
    if (matchesFilter(s, filter)) {
      setLoaded((prev) => prev.map((x) => (x.id === s.id ? s : x)));
    } else {
      // edited out of the filter (another spot or board): leaves the list, and
      // a fetch in flight is stale — the rows after it moved up by one
      version.current++;
      setLoaded((prev) => prev.filter((x) => x.id !== s.id));
    }
    setLatest((prev) => (prev?.id === s.id ? s : prev));
  }

  function removed(id: string) {
    kept.current.clear();
    version.current++;
    setStats((prev) => prev.filter((s) => s.id !== id));
    setLoaded((prev) => prev.filter((s) => s.id !== id));
  }

  /** A board was deleted: the DB nulls `board_id` on its sessions; mirror it. */
  function boardRemoved(boardId: string) {
    kept.current.clear();
    const clear = <T extends { boardId?: string | null }>(s: T): T => (s.boardId === boardId ? { ...s, boardId: null } : s);
    setStats((prev) => prev.map(clear));
    setLoaded((prev) => prev.map(clear));
    setLatest((prev) => (prev ? clear(prev) : prev));
  }

  /** The goal was reworded: past sessions got the new wording (id → text). */
  function goalsRenamed(renamed: Map<string, string>) {
    kept.current.clear();
    const rename = <T extends { id: string }>(s: T): T => (renamed.has(s.id) ? { ...s, goalText: renamed.get(s.id)! } : s);
    setStats((prev) => prev.map(rename));
    setLoaded((prev) => prev.map(rename));
    setLatest((prev) => (prev ? rename(prev) : prev));
  }

  return {
    stats,
    loaded,
    /** null: no sessions; undefined: not fetched yet. */
    latest: latestId === null ? null : latestIsCurrent ? latest : undefined,
    hasMore,
    /** How many sessions pass the filter (all of them with none set). */
    total,
    filter,
    setFilter,
    status,
    loadMore,
    created,
    updated,
    removed,
    boardRemoved,
    goalsRenamed,
  };
}
