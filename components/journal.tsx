"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { LogForm } from "@/components/log-form";
import { ActivityCalendar } from "@/components/activity-calendar";
import { SessionList } from "@/components/session-list";
import { PatternsTable } from "@/components/patterns-table";
import { BoardRack } from "@/components/board-rack";
import { GoalCard } from "@/components/goal";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadCsv } from "@/lib/csv";
import type { GoalRename } from "@/lib/goal";
import { RequestSpotDialog } from "@/components/request-spot-dialog";
import { SpotCatalogProvider, type OwnRequest } from "@/lib/spot-catalog";
import { isRequestSlug, requestSlug, type Spot } from "@/lib/spots";
import { spotLabel } from "@/lib/format";
import { useAutoHideHeader } from "@/lib/use-auto-hide-header";
import { useLang } from "@/lib/i18n";
import type { Board, Session } from "@/lib/types";

interface JournalUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function Journal({
  initialSessions,
  initialSpotNotes,
  initialBoards,
  initialGoal,
  initialSpots = [],
  initialRequests = [],
  canManageSpots = false,
  pendingSpotRequests = 0,
  user,
}: {
  initialSessions: Session[];
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
  user: JournalUser;
}) {
  const { t } = useLang();
  const [sessions, setSessions] = useState(initialSessions);
  const [spotNotes, setSpotNotes] = useState(initialSpotNotes);
  const [boards, setBoards] = useState(initialBoards);
  const [goal, setGoal] = useState(initialGoal);
  const [spots, setSpots] = useState(initialSpots);
  const [requests, setRequests] = useState(initialRequests);
  // "Request a spot" dialog (any user); `name` pre-fills it from the picker's search text.
  const [requestDialog, setRequestDialog] = useState<{ name: string } | null>(null);
  const openRequestDialog = useCallback((name: string) => setRequestDialog({ name }), []);
  const [formOpen, setFormOpen] = useState(false);
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
    setSessions((prev) => prev.map((s) => (s.boardId === id ? { ...s, boardId: null } : s)));
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
        setSessions((prev) => prev.map((s) => (renamed.has(s.id) ? { ...s, goalText: renamed.get(s.id)! } : s)));
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntSaveGoal"));
      return false;
    }
  }

  function handleCreated(s: Session) {
    upsert(s);
    setFormOpen(false);
  }

  function handleExport() {
    if (!sessions.length) {
      toast.info(t("toast.nothingToExport"));
      return;
    }
    downloadCsv(sessions, boards, (slug) =>
      isRequestSlug(slug) ? (requests.find((r) => requestSlug(r.id) === slug)?.name ?? slug) : spotLabel(slug, "en", spots)
    );
  }

  function upsert(s: Session) {
    setSessions((prev) => {
      const next = prev.some((x) => x.id === s.id)
        ? prev.map((x) => (x.id === s.id ? s : x))
        : [s, ...prev];
      return [...next].sort((a, b) => (b.when || "").localeCompare(a.when || ""));
    });
  }

  function remove(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
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
        <div className="mx-auto flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 px-4.5">
          <h1 className="py-1">
            {/* Stays black even on the blue bar — asked for specifically
                (2026-10-02): the earlier `brightness-0 invert` (white
                wordmark) was tried and reverted the same session. Black
                on `#0018FF` is ~2.6:1, under the 4.5:1 small-text floor,
                but accepted here as a deliberate choice for the logotype,
                not an oversight — see CLAUDE.md's header note. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/surflog-logo.svg" alt="Surflog" width={2292} height={603} className="block h-9 w-auto" />
          </h1>
          <div className="flex items-center gap-2.5">
            <Button
              size="icon-lg"
              onClick={() => setFormOpen(true)}
              /* White fill + blue glyph (2026-10-02, replacing the dark-grey
                 bg-badge treatment from the white-header era): bg-badge's
                 #374151 on #0018ff is a shape with almost no contrast
                 against its own background, so on the solid-blue bar it
                 goes white instead — a plain white circle reads clearly as
                 a button on blue, and the blue "+" glyph ties it back to
                 the brand colour rather than introducing a third hue.
                 focus-visible:ring-ring/50 (also blue) is overridden to a
                 white ring, since the default would otherwise disappear
                 against the same blue background it needs to stand out
                 from. `hover:bg-card` is an explicit, not redundant,
                 override: `components/ui/button.tsx`'s default variant
                 carries its own `hover:bg-primary/80`, and `cn()`/`cva`
                 here only dedupes same-modifier Tailwind class *groups*
                 (e.g. two different `bg-*` utilities at the same
                 modifier) — `hover:bg-primary/80` and plain `bg-card`
                 aren't such a pair (one's unmodified, one's `hover:`), so
                 without a matching `hover:bg-*` of its own the default
                 survived and, on real hover, tinted the white circle blue
                 — against the header's own blue background this read as
                 the whole button vanishing, not dimming (caught live, not
                 by eye: cmux's synthetic `hover` doesn't trigger real
                 `:hover`, so a first check missed it — see CLAUDE.md
                 "Testing in the browser (cmux)"). `hover:brightness-95`
                 alone now does the "a little darker on hover" job. */
              className="size-10 rounded-full bg-card text-primary shadow-[var(--shadow-card)] hover:bg-card hover:brightness-95 focus-visible:ring-white"
              aria-label={t("action.logSession")}
              title={t("action.logSession")}
            >
              <LogIcon className="size-4" />
            </Button>
            <UserMenu user={user} onExportCsv={handleExport} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
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
      <div className="mx-auto w-full min-w-0 max-w-[880px] flex-1 px-4.5 pb-18">
        {/* One shared panel for the four "about your surfing" sections —
            goal, activity calendar, spot table, board rack — on request, so
            they read as one dashboard group rather than four separate
            floating cards. Went through two blue phases the same day (a
            pale wash of --primary, then — once the header above also went
            solid blue — a solid fill of that same blue), then moved to a
            light grey (`--panel`, token renamed from `--primary-soft` the
            same session — see globals.css's own comment on both the value
            and the rename) once the two solid-blue blocks stacked directly
            on top of each other read as one fused shape rather than two
            ("change the dashboard panel's background to light grey"); the
            header above kept the blue (reads `bg-primary` directly now,
            not this token). The panel itself has no border (removed
            2026-10-01, on request — the tint alone is enough separation)
            but each section keeps its own white bg-card surface (a
            light-grey border, no shadow — see globals.css, 2026-10-01) so
            it still reads as a distinct block sitting on the grey — the
            calendar in particular has to stay a white card per its own
            comment. Padding is tighter on phones (p-3) than sm+ (p-5), same
            ratio as the cards inside it. Spacing between sections is this
            wrapper's own gap-4, not each section's old mt-6.5. mt-8 (was
            mt-6.5, from the white-header era): kept even now the header
            above and this panel are different colours (blue vs grey) —
            still a clean break between two differently-coloured blocks,
            not a border; see the header's own comment for why this gap
            mattered more while both were the same blue. */}
        <div className="mt-8 flex flex-col gap-4 rounded-[var(--r-card)] bg-panel p-3 sm:p-5">
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
              table on the other side. sm:items-stretch (changed from
              items-start 2026-10-01, on request, now that the calendar is a
              fixed 4-week window with a constant height): the goal card
              matches that height in display mode and scrolls its points list
              past it (see goal.tsx's own comment); the calendar opts back out
              of the stretch itself (sm:self-start on its own card) so it's
              never the one that grows. Below `sm` both stack full-width, goal
              above calendar (their natural DOM order), with no height cap on
              either. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div className="min-w-0 flex-1">
              <GoalCard goal={goal} sessions={sessions} onSave={saveGoal} />
            </div>
            <ActivityCalendar sessions={sessions} />
          </div>

          {/* Row 2: the spot table, now full width on every breakpoint since
              it no longer shares a row with the calendar. */}
          <PatternsTable sessions={sessions} spotNotes={spotNotes} onSaveSpotNote={saveSpotNote} />

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
              recentSpot={sessions[0]?.spot}
              onRequestSpot={openRequestDialog}
              boards={boards}
              sessions={sessions}
              goal={goal}
            />
          </DialogContent>
        </Dialog>

        <section className="mt-6.5">
          <div className="pl-1 font-sans text-[13px] font-bold text-muted-foreground">
            {t("section.sessions")}
          </div>
          <div>
            {sessions.length === 0 ? (
              <EmptyState />
            ) : (
              <SessionList sessions={sessions} boards={boards} onUpdated={upsert} onDeleted={remove} />
            )}
          </div>
        </section>
      </div>
    </SpotCatalogProvider>
  );
}

/** The log-session button's "+" glyph — Avery's own icon
 * (surflog+button.png, 300x257, black on transparent, a chunky
 * square-ended plus), rebuilt as inline SVG rather than the PNG so it
 * stays crisp at any size and takes `currentColor` (the button's own
 * `text-primary`, no separate colour prop needed). Geometry measured
 * directly from the PNG's alpha channel: two rectangles, not a single
 * centred cross — the vertical bar is 80 wide, the horizontal 63 tall,
 * deliberately unequal (kept as drawn, not squared off to match). */
function LogIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 257" fill="currentColor" aria-hidden className={className}>
      <rect x="110" y="0" width="80" height="257" />
      <rect x="0" y="97" width="300" height="63" />
    </svg>
  );
}

function EmptyState() {
  const { t } = useLang();
  return (
    <div className="mt-3.5 rounded-[var(--r-card)] border border-card-border bg-card p-8">
      <h3 className="text-xl font-bold tracking-[-0.02em]">{t("empty.title")}</h3>
      <p className="mt-1.5 text-[15px] font-medium text-muted-foreground">{t("empty.body")}</p>
    </div>
  );
}
