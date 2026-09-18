"use client";

import { useState } from "react";
import { LogForm } from "@/components/log-form";
import { EntryCard } from "@/components/entry-card";
import { PatternsTable } from "@/components/patterns-table";
import { UserMenu } from "@/components/user-menu";
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
  const [sessions, setSessions] = useState(initialSessions);

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
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-sans text-[30px] font-extrabold tracking-[-0.025em] leading-tight">
            Surflog
          </h1>
          <span className="text-[13px] font-medium text-muted-foreground">Surf log · Taiwan</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-full bg-secondary px-3.5 py-1.5 font-sans text-[13px] font-semibold tabular-nums text-muted-foreground">
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
          </div>
          <UserMenu user={user} />
        </div>
      </header>

      <section>
        <div className="pl-1 font-sans text-[13px] font-bold text-muted-foreground">
          Log a session
        </div>
        <div className="mt-2.5">
          <LogForm sessions={sessions} onCreated={upsert} />
        </div>
      </section>

      <section className="mt-6.5">
        <div className="pl-1 font-sans text-[13px] font-bold text-muted-foreground">Sessions</div>
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

      <PatternsTable sessions={sessions} />
    </>
  );
}

function EmptyState() {
  return (
    <div className="mt-3.5 rounded-[var(--r-card)] border border-border bg-card p-8 shadow-[var(--shadow-card)]">
      <h3 className="text-xl font-bold tracking-[-0.02em]">Nothing logged yet</h3>
      <p className="mt-1.5 text-[15px] font-medium text-muted-foreground">
        Save a session above — spot, date, the 2-hour slot you were out. Conditions from
        Open-Meteo fill in automatically; add Swelleye&#39;s numbers by hand whenever you have
        them.
      </p>
    </div>
  );
}
