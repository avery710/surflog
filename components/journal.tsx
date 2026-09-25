"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { LogForm } from "@/components/log-form";
import { ActivityCalendar } from "@/components/activity-calendar";
import { EntryCard } from "@/components/entry-card";
import { PatternsTable } from "@/components/patterns-table";
import { BoardRack } from "@/components/board-rack";
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
  user,
}: {
  initialSessions: Session[];
  initialSpotNotes: Record<string, string>;
  initialBoards: Board[];
  user: JournalUser;
}) {
  const { t } = useLang();
  const [sessions, setSessions] = useState(initialSessions);
  const [spotNotes, setSpotNotes] = useState(initialSpotNotes);
  const [boards, setBoards] = useState(initialBoards);
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
      <header className="flex flex-wrap items-center justify-between gap-4 py-7.5 pb-5">
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

      <div className="mt-6.5 flex flex-wrap items-start gap-4">
        <ActivityCalendar sessions={sessions} />
        <PatternsTable sessions={sessions} spotNotes={spotNotes} onSaveSpotNote={saveSpotNote} />
      </div>

      <BoardRack boards={boards} onSaved={upsertBoard} onDeleted={removeBoard} />

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
