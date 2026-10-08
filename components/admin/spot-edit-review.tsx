"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compassLabel, fmtDate } from "@/lib/format";
import { useLang, type Lang, type TKey } from "@/lib/i18n";
import { diffRows, staleKeys, type DiffField } from "@/lib/spot-edit";
import type { AdminEditRequest } from "@/lib/spot-edit-requests";
import type { LatLng } from "@/lib/spot-geo";
import type { Spot } from "@/lib/spots";

const FIELD_LABEL: Record<DiffField, TKey> = {
  name: "spot.name",
  nameZh: "spotEdit.nameZh",
  country: "spot.country",
  area: "spot.area",
  location: "spot.location",
  facing: "spots.faces",
  bestSwellDir: "spots.bestSwell",
  bestWindDir: "spots.bestWind",
  bestTide: "spots.bestTide",
};

function show(v: string | string[] | LatLng | null, lang: Lang, empty: string): string {
  if (v == null) return empty;
  if (Array.isArray(v)) return v.length ? v.map((p) => compassLabel(p, lang) ?? p).join(lang === "zh-TW" ? "、" : ", ") : empty;
  if (typeof v === "object") return `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`;
  return v || empty;
}

/** /admin — users' suggested edits to existing spots: what would change
 *  (spot as it is now → suggested), Apply or Decline. Applying goes through
 *  the same checks as editing a spot; a "nearby" warning asks to confirm. */
export function SpotEditReview({
  spots,
  initialEdits,
  onSpotChanged,
}: {
  spots: Spot[];
  initialEdits: AdminEditRequest[];
  onSpotChanged: (spot: Spot) => void;
}) {
  const { lang, t } = useLang();
  const [edits, setEdits] = useState(initialEdits);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = edits.filter((e) => e.status === "pending");
  const bySlug = new Map(spots.map((s) => [s.slug, s]));

  async function act(edit: AdminEditRequest, action: "approve" | "decline", confirmDistinct = false) {
    setBusy(edit.id);
    try {
      const res = await fetch(`/api/spot-edit-requests/${encodeURIComponent(edit.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, confirmDistinct }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409 && body?.code === "nearby" && !confirmDistinct) {
        if (window.confirm(t("spotEdit.confirmNearby"))) return act(edit, action, true);
        return;
      }
      if (!res.ok) throw new Error(body?.error ?? "failed");
      if (body?.spot) onSpotChanged(body.spot as Spot);
      setEdits((list) => list.map((e) => (e.id === edit.id ? { ...e, status: action === "approve" ? "approved" : "declined" } : e)));
      toast.success(t(action === "approve" ? "spotEdit.applied" : "spotEdit.declined"));
    } catch {
      toast.error(t(action === "approve" ? "admin.couldntApprove" : "admin.couldntDecline"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-9">
      <h2 className="text-base font-bold">
        {t("spotEdit.adminTitle")} <span className="font-mono text-muted-foreground">{pending.length}</span>
      </h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-muted-foreground">{t("spotEdit.adminNone")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {pending.map((edit) => {
            const spot = bySlug.get(edit.spotSlug);
            const rows = spot ? diffRows(spot, edit.changes) : [];
            const stale = spot ? staleKeys(spot, edit.base) : [];
            return (
              <li key={edit.id} className="rounded-[var(--r-tile)] border bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[14.5px] font-semibold">{spot ? (lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name) : edit.spotSlug}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {edit.requesterName ?? edit.requesterEmail ?? t("admin.unknownRequester")} · {fmtDate(edit.createdAt.slice(0, 10), lang, false)}
                  </span>
                </div>
                {spot ? (
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                    {rows.map((r) => (
                      <div key={r.field} className="contents">
                        <dt className="font-semibold text-muted-foreground">{t(FIELD_LABEL[r.field])}</dt>
                        <dd className="min-w-0 break-words">
                          <span className="text-muted-foreground line-through">{show(r.from, lang, "—")}</span>
                          {" → "}
                          <span className="font-semibold">{show(r.to, lang, t("spotEdit.cleared"))}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-[13px] text-muted-foreground">{t("spotEdit.spotGone")}</p>
                )}
                {stale.length > 0 && <p className="mt-2 text-[12.5px] text-muted-foreground">{t("spotEdit.stale")}</p>}
                {edit.note && <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-[13px] break-words">{edit.note}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="rounded-full px-4" disabled={busy === edit.id || !spot} onClick={() => void act(edit, "approve")}>
                    {t("spotEdit.apply")}
                  </Button>
                  <Button size="sm" variant="secondary" className="rounded-full px-4" disabled={busy === edit.id} onClick={() => void act(edit, "decline")}>
                    {t("admin.decline")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
