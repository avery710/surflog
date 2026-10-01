"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { LogForm } from "@/components/log-form";
import { ActivityCalendar } from "@/components/activity-calendar";
import { EntryCard } from "@/components/entry-card";
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
  user,
}: {
  initialSessions: Session[];
  initialSpotNotes: Record<string, string>;
  initialBoards: Board[];
  initialGoal: string | null;
  user: JournalUser;
}) {
  const { t } = useLang();
  const [sessions, setSessions] = useState(initialSessions);
  const [spotNotes, setSpotNotes] = useState(initialSpotNotes);
  const [boards, setBoards] = useState(initialBoards);
  const [goal, setGoal] = useState(initialGoal);
  const [formOpen, setFormOpen] = useState(false);

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
  async function saveGoal(text: string): Promise<boolean> {
    try {
      const res = await fetch("/api/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSaveGoal"));
      setGoal(body.text ?? null);
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
    downloadCsv(sessions, boards);
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
    <>
      <header
        className="sticky top-[calc(env(safe-area-inset-top)_+_0.75rem)] z-30 mt-[calc(env(safe-area-inset-top)_+_0.75rem)] flex flex-wrap items-center justify-between gap-4 rounded-full glass-header px-5 py-2.5"
      >
        <h1 className="font-sans text-[30px] font-extrabold tracking-[-0.025em] leading-tight">
          Surflog
        </h1>
        <div className="flex items-center gap-2.5">
          <Button
            size="icon-lg"
            onClick={() => setFormOpen(true)}
            className="size-10 rounded-full shadow-[var(--shadow-card)]"
            aria-label={t("action.logSession")}
            title={t("action.logSession")}
          >
            <Plus className="size-5" />
          </Button>
          <UserMenu user={user} onExportCsv={handleExport} />
        </div>
      </header>

      {/* One shared panel for the four "about your surfing" sections —
          goal, activity calendar, spot table, board rack — on request, so
          they read as one dashboard group rather than four separate
          floating cards. Tinted with --primary-soft (a pale wash of the
          teal accent, see globals.css) rather than plain white so the
          group visually separates from the page background; each section
          keeps its own white bg-card surface (border + shadow) so it still
          reads as a distinct block sitting on the tint — the calendar in
          particular has to stay a white card per its own comment. Padding
          is tighter on phones (p-3) than sm+ (p-5), same ratio as the
          cards inside it. Spacing between sections is this wrapper's own
          gap-4, not each section's old mt-6.5. */}
      <div className="mt-6.5 flex flex-col gap-4 rounded-[var(--r-card)] border border-border bg-primary-soft p-3 sm:p-5">
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
            table on the other side. items-start, not items-stretch: the
            goal can run to several lines (multiple points), and stretching
            the calendar to match would just recreate the same blank-space
            problem inside its own card. Below `sm` both stack full-width,
            goal above calendar (their natural DOM order). */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl" closeLabel={t("entry.close")}>
          <DialogHeader>
            <DialogTitle>{t("dialog.logSessionTitle")}</DialogTitle>
          </DialogHeader>
          <LogForm
            onCreated={handleCreated}
            ownerId={user.id}
            recentSpot={sessions[0]?.spot}
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
            sessions.map((s) => (
              <EntryCard key={s.id} session={s} boards={boards} onUpdated={upsert} onDeleted={remove} />
            ))
          )}
        </div>
      </section>
    </>
  );
}

function EmptyState() {
  const { t } = useLang();
  return (
    <div className="mt-3.5 rounded-[var(--r-card)] border border-border bg-card p-8 shadow-[var(--shadow-card)]">
      <h3 className="text-xl font-bold tracking-[-0.02em]">{t("empty.title")}</h3>
      <p className="mt-1.5 text-[15px] font-medium text-muted-foreground">{t("empty.body")}</p>
    </div>
  );
}
