"use client";

import { useRef, useState } from "react";
import { spotLabel } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { Session } from "@/lib/types";

const MAX_DESCRIPTION = 500;

export function PatternsTable({
  sessions,
  spotNotes,
  onSaveSpotNote,
}: {
  sessions: Session[];
  spotNotes: Record<string, string>;
  onSaveSpotNote: (spot: string, description: string) => Promise<boolean>;
}) {
  const { lang, t } = useLang();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // Esc unmounts the input, which can still fire a blur — don't save then.
  const cancelled = useRef(false);

  if (sessions.length < 2) return null;

  const bySpot = new Map<string, number>();
  for (const s of sessions) {
    bySpot.set(s.spot, (bySpot.get(s.spot) ?? 0) + 1);
  }

  const rows = [...bySpot.entries()]
    .map(([slug, n]) => ({ slug, n }))
    .sort((a, b) => b.n - a.n);

  function startEdit(slug: string) {
    cancelled.current = false;
    setDraft(spotNotes[slug] ?? "");
    setEditing(slug);
  }

  async function commit(slug: string) {
    if (cancelled.current || saving) return;
    const next = draft.trim();
    if (next === (spotNotes[slug] ?? "")) {
      setEditing(null);
      return;
    }
    setSaving(true);
    const ok = await onSaveSpotNote(slug, next);
    setSaving(false);
    if (ok) setEditing(null);
  }

  return (
    <section className="min-w-[320px] flex-1">
      <div className="pl-1 font-sans text-[13px] font-bold text-muted-foreground">
        {t("patterns.title")}
      </div>
      <div className="mt-2.5 overflow-x-auto rounded-[var(--r-card)] border border-border bg-card p-2 shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[420px] border-separate [border-spacing:0_4px]">
          <thead>
            <tr>
              {[t("form.spot"), t("patterns.sessions"), t("patterns.description")].map((h) => (
                <th
                  key={h}
                  className="px-4 pb-0.5 pt-2.5 text-left text-xs font-semibold text-[var(--faint)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const label = spotLabel(r.slug, lang);
              const note = spotNotes[r.slug];
              return (
                <tr key={r.slug}>
                  <td className="rounded-l-[var(--r-tile)] bg-secondary px-4 py-2.5 align-top font-sans text-[15px] font-bold tracking-[-0.015em] whitespace-nowrap">
                    {label}
                  </td>
                  <td className="bg-secondary px-4 py-2.5 align-top font-mono text-[13.5px] tabular-nums">
                    {r.n}
                  </td>
                  <td className="w-full rounded-r-[var(--r-tile)] bg-secondary px-2 py-1.5 align-top">
                    {editing === r.slug ? (
                      <input
                        autoFocus
                        value={draft}
                        maxLength={MAX_DESCRIPTION}
                        disabled={saving}
                        placeholder={t("patterns.descriptionPlaceholder")}
                        aria-label={t("patterns.editDescription", { spot: label })}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit(r.slug)}
                        onKeyDown={(e) => {
                          // Enter confirms an IME candidate (注音/倉頡) — only save on a real Enter
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            void commit(r.slug);
                          } else if (e.key === "Escape") {
                            cancelled.current = true;
                            setEditing(null);
                          }
                        }}
                        className="w-full rounded-[10px] border border-ring bg-background px-2 py-1 text-[14px] outline-none ring-4 ring-ring/15 disabled:opacity-60"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(r.slug)}
                        aria-label={t("patterns.editDescription", { spot: label })}
                        className={
                          note
                            ? "w-full rounded-[10px] px-2 py-1 text-left text-[14px] leading-snug whitespace-pre-wrap break-words hover:bg-background"
                            : "rounded-[10px] px-2 py-1 text-left text-[13px] font-medium text-[var(--faint)] hover:bg-background hover:text-muted-foreground"
                        }
                      >
                        {note || t("patterns.addDescription")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
