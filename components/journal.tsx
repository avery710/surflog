"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { LogForm } from "@/components/log-form";
import { ActivityCalendar } from "@/components/activity-calendar";
import { EntryCard } from "@/components/entry-card";
import { PatternsTable } from "@/components/patterns-table";
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
import type { Session } from "@/lib/types";

interface JournalUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function Journal({
  initialSessions,
  user,
}: {
  initialSessions: Session[];
  user: JournalUser;
}) {
  const { t } = useLang();
  const [sessions, setSessions] = useState(initialSessions);
  const [formOpen, setFormOpen] = useState(false);

  function handleCreated(s: Session) {
    upsert(s);
    setFormOpen(false);
  }

  function handleExport() {
    if (!sessions.length) {
      toast.info(t("toast.nothingToExport"));
      return;
    }
    downloadCsv(sessions);
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
        <PatternsTable sessions={sessions} />
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl" closeLabel={t("entry.close")}>
          <DialogHeader>
            <DialogTitle>{t("dialog.logSessionTitle")}</DialogTitle>
          </DialogHeader>
          <LogForm onCreated={handleCreated} />
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
              <EntryCard key={s.id} session={s} onUpdated={upsert} onDeleted={remove} />
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
