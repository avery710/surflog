"use client";

import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { pageToFetch } from "@/lib/pagination";
import { filterToParams, matchesFilter, type SessionFilter } from "@/lib/session-filter";
import { addToLoaded, mergePage, toStat, upsertStat, type SessionStat } from "@/lib/session-stats";
import type { Session } from "@/lib/types";

export type FeedStatus = "idle" | "loading" | "failed";

/**
 * How long a list you have switched away from is kept (its `gcTime`).
 * Switching back to a filter within this time shows its cards at once, with no
 * request, and scrolling carries on from where it stopped. Past it, the list is
 * dropped and loaded fresh. Any create, edit or delete made here drops every
 * kept list at once, so this only covers changes made somewhere else (another
 * tab or device, an AI app over MCP).
 */
export const FILTER_CACHE_MS = 60_000;

type Pages = InfiniteData<Session[], number>;

const LISTS = ["sessions", "list"] as const;
const listKey = (filter: SessionFilter) => [...LISTS, filterToParams(filter).toString()] as const;

/** The loaded rows, top of the list first. Pages may overlap (`pageToFetch`
 *  re-asks for a page a delete shifted); `mergePage` drops the repeats. */
function flatten(pages: Session[][]): Session[] {
  return pages.reduce<Session[]>((rows, page) => mergePage(rows, page), []);
}

async function fetchSessions(params: URLSearchParams, signal: AbortSignal): Promise<Session[]> {
  const res = await fetch(`/api/sessions?${params}`, { cache: "no-store", signal });
  const body = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body?.sessions)) throw new Error("load failed");
  return body.sessions as Session[];
}

/** A fresh start for this page: the server's first 10 as the unfiltered list,
 *  and no list kept from an earlier visit (they may predate the server data). */
function seedLists(client: QueryClient, initialLoaded: Session[]) {
  client.removeQueries({ queryKey: LISTS });
  client.setQueryData<Pages>(listKey({}), { pages: [initialLoaded], pageParams: [1] });
}

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
 * `loaded` is a TanStack infinite query, one per filter (key
 * `["sessions", "list", <filter params>]`). With a `filter` set, "the list"
 * means the filtered list: the API filters in the database, `matches` (the
 * slim list, filtered in memory) gives the count, and a filter with no cached
 * list loads its page 1 by itself. The dashboard's `stats` are never filtered.
 *
 * Lists you switch away from are kept for `FILTER_CACHE_MS` (60 s), so going
 * back to a filter is instant (`staleTime: Infinity`: the list on screen is
 * never refreshed by itself).
 *
 * The mutators keep both lists in step after a create, edit or delete: they
 * cancel a page fetch in flight (its rows belong to a list that no longer
 * exists; the sentinel asks again), rewrite the cached list as one page, and
 * drop every kept list.
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
  const client = useQueryClient();
  // once per mount, before the first query reads the cache
  useState(() => seedLists(client, initialLoaded));
  const [stats, setStats] = useState(initialStats);
  // The newest session in full, for the calendar's phone panel (the cards
  // are only a prefix; the newest is nearly always in it, but not by rule).
  const [latest, setLatest] = useState(initialLatest);
  const [filter, setFilter] = useState<SessionFilter>({});

  // the slim rows that pass the filter: how long the (filtered) list is
  const matches = useMemo(() => stats.filter((s) => matchesFilter(s, filter)), [stats, filter]);
  const total = matches.length;

  const list = useInfiniteQuery({
    queryKey: listKey(filter),
    queryFn: ({ pageParam, signal }) => {
      const params = filterToParams(filter);
      params.set("page", String(pageParam));
      return fetchSessions(params, signal);
    },
    initialPageParam: 1,
    getNextPageParam: (_last, pages) => pageToFetch(flatten(pages).length),
    enabled: total > 0,
    staleTime: Infinity,
    gcTime: FILTER_CACHE_MS,
  });
  const pages = list.data?.pages;
  const loaded = useMemo(() => (pages ? flatten(pages) : []), [pages]);
  const hasMore = loaded.length < total;
  const status: FeedStatus = list.isFetching ? "loading" : list.isError ? "failed" : "idle";

  const { isFetching, fetchNextPage } = list;
  const loadMore = useCallback(() => {
    if (!isFetching) void fetchNextPage();
  }, [isFetching, fetchNextPage]);

  // The newest session changed without us holding it (the newest was deleted:
  // the next one is it): fetch it. Created/edited ones are set directly below.
  const latestId = stats[0]?.id ?? null;
  const fetchedLatest = useQuery({
    queryKey: ["sessions", "latest", latestId],
    queryFn: async ({ signal }) => (await fetchSessions(new URLSearchParams({ page: "1", pageSize: "1" }), signal))[0] ?? null,
    enabled: latestId !== null && latest?.id !== latestId,
    staleTime: Infinity,
  }).data;
  const currentLatest =
    latestId === null ? null : latest?.id === latestId ? latest : fetchedLatest?.id === latestId ? fetchedLatest : undefined;

  /** Rewrite the list on screen (as one page) and drop the kept ones. */
  function editLoaded(change: (rows: Session[]) => Session[]) {
    const key = listKey(filter);
    // synchronous: the fetch's rows are thrown away and its state rolled back
    void client.cancelQueries({ queryKey: key });
    client.setQueryData<Pages>(key, (d) => d && { pages: [change(flatten(d.pages))], pageParams: [1] });
    client.removeQueries({ queryKey: LISTS, type: "inactive" });
  }

  function created(s: Session) {
    const next = upsertStat(stats, toStat(s));
    setStats(next);
    // placed by its rank in the filtered list; not at all if it doesn't pass the filter
    const rank = next.filter((x) => matchesFilter(x, filter)).findIndex((x) => x.id === s.id);
    editLoaded((rows) => (rank >= 0 ? addToLoaded(rows, s, rank) : rows));
    if (next[0].id === s.id) setLatest(s);
  }

  /** An edit. Date and time are fixed after creation, so nothing moves; one
   *  edited out of the filter (another spot or board) leaves the list. */
  function updated(s: Session) {
    setStats((prev) => upsertStat(prev, toStat(s)));
    const keep = matchesFilter(s, filter);
    editLoaded((rows) => (keep ? rows.map((x) => (x.id === s.id ? s : x)) : rows.filter((x) => x.id !== s.id)));
    if (currentLatest?.id === s.id) setLatest(s);
  }

  function removed(id: string) {
    setStats((prev) => prev.filter((s) => s.id !== id));
    editLoaded((rows) => rows.filter((s) => s.id !== id));
  }

  /** A board was deleted: the DB nulls `board_id` on its sessions; mirror it. */
  function boardRemoved(boardId: string) {
    const clear = <T extends { boardId?: string | null }>(s: T): T => (s.boardId === boardId ? { ...s, boardId: null } : s);
    setStats((prev) => prev.map(clear));
    editLoaded((rows) => rows.map(clear));
    if (currentLatest) setLatest(clear(currentLatest));
  }

  /** The goal was reworded: past sessions got the new wording (id → text). */
  function goalsRenamed(renamed: Map<string, string>) {
    const rename = <T extends { id: string }>(s: T): T => (renamed.has(s.id) ? { ...s, goalText: renamed.get(s.id)! } : s);
    setStats((prev) => prev.map(rename));
    editLoaded((rows) => rows.map(rename));
    if (currentLatest) setLatest(rename(currentLatest));
  }

  return {
    stats,
    loaded,
    /** null: no sessions; undefined: not fetched yet. */
    latest: currentLatest,
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
