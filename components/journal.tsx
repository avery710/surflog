"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SearchX } from "lucide-react";
import { toast } from "sonner";
import { LogForm } from "@/components/log-form";
import { ActivityCalendar } from "@/components/activity-calendar";
import { SessionList } from "@/components/session-list";
import { SessionFilterBar } from "@/components/session-filter";
import type { SessionStat } from "@/lib/session-stats";
import { useSessionFeed } from "@/lib/use-session-feed";
import { PatternsTable } from "@/components/patterns-table";
import { BoardRack } from "@/components/board-rack";
import { GoalCard } from "@/components/goal";
import { AiAppCard } from "@/components/ai-app-card";
import { UserMenu } from "@/components/user-menu";
import { AddButton } from "@/components/add-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GoalRename } from "@/lib/goal";
import { RequestSpotDialog } from "@/components/request-spot-dialog";
import { SpotCatalogProvider, type OwnRequest } from "@/lib/spot-catalog";
import type { Spot } from "@/lib/spots";
import { useAutoHideHeader } from "@/lib/use-auto-hide-header";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import type { Board, Session } from "@/lib/types";

interface JournalUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function Journal({
  initialStats,
  initialLoaded,
  initialLatest,
  initialSpotNotes,
  initialBoards,
  initialGoal,
  initialSpots = [],
  initialRequests = [],
  canManageSpots = false,
  pendingSpotRequests = 0,
  showAiAppCard = false,
  user,
  openLogForm = false,
  logSpot,
}: {
  /** Every session, slim: all the dashboard (goal, calendar, spot table) needs. */
  initialStats: SessionStat[];
  /** The first page of full sessions (10, newest first) straight from the database; more load on scroll. */
  initialLoaded: Session[];
  /** The most recent session in full, for the calendar's phone panel. */
  initialLatest: Session | null;
  initialSpotNotes: Record<string, string>;
  initialBoards: Board[];
  initialGoal: string | null;
  /** The whole spot catalogue (the `spots` table). */
  initialSpots?: Spot[];
  /** The viewer's own spot requests. */
  initialRequests?: OwnRequest[];
  /** The viewer is a spot admin (SPOT_ADMIN_EMAILS) — may add/edit/delete spots. */
  canManageSpots?: boolean;
  /** Admin only: how many spot requests are waiting (badge on the menu link). */
  pendingSpotRequests?: number;
  /** No AI app connected yet: show the card linking to /ai-apps beside the calendar. */
  showAiAppCard?: boolean;
  user: JournalUser;
  /** Arrived via the "+" on a sub page (`/?log=1`): start with the log form open. */
  openLogForm?: boolean;
  /** With `openLogForm` (from a spot's page: `/?log=1&spot=<slug>`): the spot the form starts on. */
  logSpot?: string;
}) {
  const { t } = useLang();
  // `stats`: every session, slim, for the dashboard. `loaded`: the cards,
  // 10 at a time as the list scrolls (lib/use-session-feed.ts).
  const feed = useSessionFeed({ initialStats, initialLoaded, initialLatest });
  const { stats } = feed;

  // While the list reloads (a new filter empties it) the page must keep its
  // length: a shorter page makes the browser pull a scrolled-down view up to
  // the new bottom, which brings the footer on screen. So the list box keeps
  // its last settled height until the load finishes (2026-10-17, on request).
  const listBox = useRef<HTMLDivElement>(null);
  const [heldHeight, setHeldHeight] = useState(0);
  useLayoutEffect(() => {
    const h = listBox.current?.offsetHeight ?? 0;
    if (feed.status !== "loading" && h !== heldHeight) setHeldHeight(h);
  }, [feed.status, feed.loaded, heldHeight]);
  const [spotNotes, setSpotNotes] = useState(initialSpotNotes);
  const [boards, setBoards] = useState(initialBoards);
  const [goal, setGoal] = useState(initialGoal);
  const [spots, setSpots] = useState(initialSpots);
  const [requests, setRequests] = useState(initialRequests);
  // "Request a spot" dialog (any user); `name` pre-fills it from the picker's search text.
  const [requestDialog, setRequestDialog] = useState<{ name: string } | null>(null);
  const openRequestDialog = useCallback((name: string) => setRequestDialog({ name }), []);
  const [formOpen, setFormOpen] = useState(openLogForm);
  // Drop the ?log=1 that opened it, so a reload or the back button doesn't
  // pop the form open again. No state involved, just the address bar.
  useEffect(() => {
    if (openLogForm) window.history.replaceState(null, "", "/");
  }, [openLogForm]);
  // True while the log form is saving/uploading — see the Dialog below.
  const [formBusy, setFormBusy] = useState(false);
  // The log-session dialog opens from a plain button, not a Radix
  // DialogTrigger inside the header, so the hook can't see it on its own
  // (see use-auto-hide-header.ts's own comment) — forceVisible covers it.
  const headerRef = useAutoHideHeader<HTMLElement>({ forceVisible: formOpen });

  const addSpot = useCallback(
    (s: Spot) => setSpots((prev) => (prev.some((x) => x.slug === s.slug) ? prev : [...prev, s])),
    []
  );
  const replaceSpot = useCallback(
    (s: Spot) => setSpots((prev) => prev.map((x) => (x.slug === s.slug ? s : x))),
    []
  );
  const upsertRequest = useCallback(
    (r: OwnRequest) =>
      setRequests((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [r, ...prev])),
    []
  );
  const removeSpot = useCallback(
    (slug: string) => setSpots((prev) => prev.filter((x) => x.slug !== slug)),
    []
  );

  function upsertBoard(b: Board) {
    setBoards((prev) =>
      prev.some((x) => x.id === b.id) ? prev.map((x) => (x.id === b.id ? b : x)) : [...prev, b]
    );
  }

  /** The DB nulls sessions.board_id on delete (FK on delete set null);
   *  mirror that locally so no card points at a board that's gone. */
  function removeBoard(id: string) {
    setBoards((prev) => prev.filter((b) => b.id !== id));
    feed.boardRemoved(id);
  }

  /** Resolves true if saved, so the table knows whether to leave edit mode. */
  async function saveSpotNote(spot: string, description: string): Promise<boolean> {
    try {
      const res = await fetch("/api/spot-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spot, description }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSaveDescription"));
      setSpotNotes((prev) => {
        const next = { ...prev };
        if (body.description) next[spot] = body.description;
        else delete next[spot];
        return next;
      });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntSaveDescription"));
      return false;
    }
  }

  /** Resolves true if saved, so the card knows whether to leave edit mode. */
  async function saveGoal(text: string, renames: GoalRename[]): Promise<boolean> {
    try {
      const res = await fetch("/api/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, renames }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSaveGoal"));
      setGoal(body.text ?? null);
      const renamed = new Map<string, string>(
        (body.sessions ?? []).map((s: { id: string; goalText: string }) => [s.id, s.goalText])
      );
      if (renamed.size) {
        feed.goalsRenamed(renamed);
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntSaveGoal"));
      return false;
    }
  }

  function handleCreated(s: Session) {
    feed.created(s);
    setFormOpen(false);
  }

  return (
    <SpotCatalogProvider
      spots={spots}
      requests={requests}
      canManage={canManageSpots}
      onAdd={addSpot}
      onReplace={replaceSpot}
      onRemove={removeSpot}
      onRequestChanged={upsertRequest}
      onRequestSpot={openRequestDialog}
    >
      <RequestSpotDialog
        open={requestDialog !== null}
        onOpenChange={(open) => !open && setRequestDialog(null)}
        initialName={requestDialog?.name}
      />
      {/* Flat, full-bleed bar — solid blue (2026-10-02, on request:
          "make the whole header bg color blue (same as the dashboard bg
          color); remove the black underline border"), replacing the
          white bar + <HeaderUnderline> bottom edge that lived here
          before (see CLAUDE.md "Style references" for that one and the
          floating glass pill before it). Reads `bg-primary` directly, not
          the dashboard panel's own token: for a few minutes the same
          session it *was* that token (back when the panel was also a
          solid blue fill of --primary), but the panel moved to a light
          grey shortly after ("change the dashboard panel's background to
          light grey") — the header stayed the blue it was asked for, so
          it now points straight at --primary instead of following the
          panel's token wherever that goes next. Rendered outside the
          page's `max-w-[880px]` column (app/page.tsx no longer wraps
          <Journal> in that div; it's now applied to the sibling <div>
          below instead), so the blue spans the full viewport width
          regardless of the content column. `sticky top-0` with no
          margin, flush to the very top; `pt-[...]`/`pb-2` carry the
          safe-area inset + padding so the blue still reaches y=0 on a
          notched phone, only the content inside is pushed down past the
          notch. auto-hide-header (lib/use-auto-hide-header.ts) still
          drives the Medium-style hide-on-scroll-down/show-on-scroll-up
          slide — unrelated to the colour, see that file's own comment.
          The logo/buttons are in a `max-w-[880px]` inner column — same
          `mx-auto`/`max-w`/`px-4.5` as the content wrapper below, so the
          logo's left edge and the avatar's right edge line up exactly
          with the dashboard panel/cards under them. The underline's own
          `relative` anchor point is gone with it — nothing else needs
          it. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-30 bg-primary pt-[calc(env(safe-area-inset-top)_+_0.5rem)] pb-2 auto-hide-header"
      >
        <div className={`${PAGE_COLUMN} flex flex-wrap items-center justify-between gap-4`}>
          <h1 className="py-1">
            {/* White wordmark on the blue bar (2026-10-08, new logo file and
                `brightness-0 invert` requested again — supersedes the
                black-on-purpose note this comment used to have). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/surflog-logo.png"
              alt="Surflog"
              width={1200}
              height={228}
              className="block h-6 w-auto brightness-0 invert"
            />
          </h1>
          <div className="flex items-center gap-2.5">
            {/* White circle + blue glyph with the rising-wave hover (components/add-button.tsx, 2026-10-16).
                History of the white-on-blue look: the dark-grey bg-badge treatment vanished against #0018ff, so
                the button is white; the focus ring is white for the same reason; and the old Button's default
                hover:bg-primary/80 turned the white circle blue on real hover, which is why this no longer uses it. */}
            <AddButton label={t("action.logSession")} onClick={() => setFormOpen(true)} />
            <UserMenu user={user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
          </div>
        </div>
      </header>

      {/* The page's content column — previously app/page.tsx's own
          wrapper around the whole <Journal>; moved in here 2026-10-02 so
          the header above (now a sibling, not a child) can be full width
          while everything else stays capped at max-w-[880px]. */}
      {/* min-w-0: this is now a flex child of <body> (RootLayout's `flex
          flex-col`) sitting beside the header above, not nested inside
          it any more — a flex item's default min-width is `auto` (its
          content's own intrinsic width), so without this the patterns
          table's `min-w-[420px]` (itself correctly scrollable within its
          own card) was pushing this *whole column* wider than the
          viewport instead of staying capped at it, a real horizontal-
          scroll regression caught via `document.documentElement.scrollWidth`
          at 375px while verifying the header restyle, not by eye. */}
      {/* The footer starting below the first screen is now the root
          layout's job (every page, 2026-10-21); this column just fills it. */}
      <div className={`${PAGE_COLUMN} page-enter min-w-0 flex-1 pb-18`}>
        {/* The dashboard: goal + activity calendar, spot table, board rack.
            2026-10-08, on request: no grey `--panel` wrapper any more (it
            had been a tinted, padded group since 2026-09-29), so each
            section's white card runs the full column width, the same edges
            as the session cards below. Spacing between sections is this
            wrapper's gap-3 (12px, tightened 2026-10-16); mt-5 keeps the break under the blue header. */}
        <div className="mt-4 sm:mt-5 flex flex-col gap-2 sm:gap-3">
          {/* Row 1, sm: up: goal (flexible width) beside the calendar
              (content-sized — see ActivityCalendar's own comment for
              the arithmetic). The calendar used to get a fixed 344px column
              only from `lg`, with the table beside it — but the calendar's
              actual content (a 7-dot week grid + month label + scroll rail)
              is only ~200px wide, so between `sm` and `lg` it sat in its own
              full-width card with a lot of blank white space (reported on a
              ~800px tablet). Pairing it with the goal card instead — short
              text, so it fits beside a narrow fixed column at any width —
              uses that space instead of wasting it, and needs no fixed-width
              table on the other side. sm:items-stretch (2026-10-08, on
              request): the goal card is as tall as its points need, never
              capped or scrolled, and the calendar stretches to match it,
              showing more past weeks to fill the height (see
              activity-calendar.tsx). Below `sm` both stack full-width, goal
              above calendar (their natural DOM order), with no height cap on
              either. */}
          {showAiAppCard ? (
            // With the AI app card (2026-10-09, on request: beside the
            // calendar, in one row even on phones): the calendar hugs its
            // content and the card takes the rest of that row. Below `lg`
            // the goal gets its own row above them, since three columns
            // would squeeze it; from `lg` all three share one row, the
            // calendar stretched to the goal's height as without the card.
            // flex-wrap only matters on the narrowest phones (320px), where
            // the card drops under the calendar rather than widening the page;
            // the gap is 12px below `sm` to leave the card a little more room.
            <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-stretch">
              <div className="flex min-w-0 flex-col lg:flex-1">
                <GoalCard goal={goal} sessions={stats} onSave={saveGoal} />
              </div>
              <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 lg:flex-nowrap">
                <ActivityCalendar sessions={stats} latest={feed.latest} fit />
                <AiAppCard />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <GoalCard goal={goal} sessions={stats} onSave={saveGoal} />
              </div>
              <ActivityCalendar sessions={stats} latest={feed.latest} />
            </div>
          )}

          {/* Row 2: the spot table, now full width on every breakpoint since
              it no longer shares a row with the calendar. */}
          <PatternsTable sessions={stats} spotNotes={spotNotes} onSaveSpotNote={saveSpotNote} />

          {/* Row 3: board rack, full width. */}
          <BoardRack boards={boards} onSaved={upsertBoard} onDeleted={removeBoard} onRackChanged={setBoards} />
        </div>

        {/* Not closable (Escape, outside click, ×) while the form is saving:
            closing unmounts it mid-upload, and its picked files with it.
            handleCreated closes it when the save is done. */}
        <Dialog
          open={formOpen}
          onOpenChange={(open) => {
            if (!formBusy) setFormOpen(open);
          }}
        >
          <DialogContent className="max-w-xl" closeLabel={t("entry.close")}>
            <DialogHeader>
              <DialogTitle>{t("dialog.logSessionTitle")}</DialogTitle>
            </DialogHeader>
            <LogForm
              onCreated={handleCreated}
              onBusyChange={setFormBusy}
              ownerId={user.id}
              recentSpot={stats[0]?.spot}
              presetSpot={logSpot}
              onRequestSpot={openRequestDialog}
              boards={boards}
              sessions={stats}
              goal={goal}
            />
          </DialogContent>
        </Dialog>

        <section className="mt-4 sm:mt-5">
          {stats.length === 0 ? (
            <div className="pl-1 font-sans text-[13px] font-bold text-muted-foreground">{t("section.sessions")}</div>
          ) : (
            <SessionFilterBar
              filter={feed.filter}
              onChange={feed.setFilter}
              stats={stats}
              boards={boards}
              matching={feed.total}
            />
          )}
          <div ref={listBox} style={feed.status === "loading" ? { minHeight: heldHeight } : undefined}>
            {stats.length === 0 ? (
              <EmptyState />
            ) : feed.total === 0 ? (
              <NoMatches />
            ) : (
              <SessionList
                sessions={feed.loaded}
                boards={boards}
                goal={goal}
                hasMore={feed.hasMore}
                status={feed.status}
                onLoadMore={feed.loadMore}
                onUpdated={feed.updated}
                onDeleted={feed.removed}
              />
            )}
          </div>
        </section>
      </div>
    </SpotCatalogProvider>
  );
}

export { LogIcon } from "@/components/add-button";

function NoMatches() {
  const { t } = useLang();
  return <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
      <SearchX className="size-4 shrink-0" aria-hidden />
      <p className="font-sans text-[13px] leading-5 font-bold">{t("filter.noMatchTitle")}</p>
    </div>;
}

function EmptyState() {
  const { t } = useLang();
  return (
    <div className="mt-3 pl-1 sm:mt-4">
      <h3 className="text-[15px] leading-snug font-bold">{t("empty.title")}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t("empty.body")}</p>
    </div>
  );
}
