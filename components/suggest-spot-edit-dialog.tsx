"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compassLabel } from "@/lib/format";
import { useLang, type TKey } from "@/lib/i18n";
import { draftFromSpot, diffDraft, MAX_NOTE, type SpotDraft } from "@/lib/spot-edit";
import type { OwnEditRequest } from "@/lib/spot-edit-requests";
import { COMPASS_16, parseLocation } from "@/lib/spot-geo";
import type { Spot } from "@/lib/spots";

/** Suggest a change to an existing spot (POST /api/spots/:slug/edit-requests).
 *  Any signed-in user; the admin reviews it on /admin. Only the fields that
 *  differ from the spot are sent (`diffDraft`). One pending suggestion per
 *  user per spot: sending again replaces it. */
export function SuggestSpotEditDialog({
  spot,
  pending,
  onOpenChange,
  onSent,
  onWithdrawn,
}: {
  /** The spot being edited; null = closed. */
  spot: Spot | null;
  /** The caller's own pending suggestion for this spot, if any. */
  pending: OwnEditRequest | null;
  onOpenChange: (open: boolean) => void;
  onSent: (request: OwnEditRequest) => void;
  onWithdrawn: (id: string) => void;
}) {
  const { lang, t } = useLang();
  const name = spot ? (lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name) : "";
  return (
    <Dialog open={!!spot} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" closeLabel={t("entry.close")}>
        <DialogHeader>
          <DialogTitle>{t("spotEdit.title", { name })}</DialogTitle>
          <DialogDescription>{t("spotEdit.intro")}</DialogDescription>
        </DialogHeader>
        {/* keyed by spot, so every open starts from that spot's values */}
        {spot && (
          <EditForm
            key={spot.slug}
            spot={spot}
            pending={pending}
            onDone={() => onOpenChange(false)}
            onSent={onSent}
            onWithdrawn={onWithdrawn}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const errorKey: Record<string, TKey> = {
  no_changes: "spotEdit.noChanges",
  bad_location: "spotEdit.badLocation",
  invalid: "spotEdit.invalid",
  rate_limited: "spotEdit.limit",
  limit: "spotEdit.limit",
  unavailable: "spotEdit.unavailable",
};

function EditForm({
  spot,
  pending,
  onDone,
  onSent,
  onWithdrawn,
}: {
  spot: Spot;
  pending: OwnEditRequest | null;
  onDone: () => void;
  onSent: (request: OwnEditRequest) => void;
  onWithdrawn: (id: string) => void;
}) {
  const { lang, t } = useLang();
  const [draft, setDraft] = useState<SpotDraft>(() => draftFromSpot(spot));
  const [note, setNote] = useState(pending?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof SpotDraft>(key: K, value: SpotDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };
  const changes = diffDraft(spot, draft, parseLocation);
  const changed = Object.keys(changes).length > 0;

  async function submit() {
    if (!changed) {
      setError(t("spotEdit.noChanges"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/spots/${encodeURIComponent(spot.slug)}/edit-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, note }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (body?.code === "duplicate" && body.existing?.name) setError(t("spotEdit.duplicate", { name: body.existing.name }));
        else setError(t(errorKey[body?.code] ?? "spotEdit.failed"));
        return;
      }
      onSent(body.request as OwnEditRequest);
      toast.success(t("spotEdit.sent"));
      onDone();
    } catch {
      setError(t("spotEdit.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/spot-edit-requests/${encodeURIComponent(pending.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onWithdrawn(pending.id);
      toast.success(t("spotEdit.withdrawn"));
      onDone();
    } catch {
      setError(t("spotEdit.failed"));
    } finally {
      setBusy(false);
    }
  }

  const coords = spot.lat != null && spot.lng != null ? `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}` : null;
  const field = (label: string, input: React.ReactNode) => (
    <label className="flex flex-col gap-1.5">
      <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{label}</span>
      {input}
    </label>
  );

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void submit();
      }}
    >
      {pending && (
        <div className="rounded-xl bg-secondary px-3.5 py-3 text-[13px] leading-relaxed">{t("spotEdit.pendingNote")}</div>
      )}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {field(t("spot.name"), <Input value={draft.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />)}
        {field(t("spotEdit.nameZh"), <Input value={draft.nameZh} maxLength={80} onChange={(e) => set("nameZh", e.target.value)} />)}
        {field(t("spot.country"), <Input value={draft.country} maxLength={80} onChange={(e) => set("country", e.target.value)} />)}
        {field(t("spot.area"), <Input value={draft.area} maxLength={80} onChange={(e) => set("area", e.target.value)} />)}
      </div>
      {field(
        t("spot.location"),
        <Input
          value={draft.location}
          placeholder={coords ? t("spot.locationKeep", { coords }) : t("spot.locationPlaceholder")}
          onChange={(e) => set("location", e.target.value)}
        />
      )}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {field(t("spots.faces"), <Input value={draft.facing} maxLength={12} placeholder="SE" onChange={(e) => set("facing", e.target.value)} />)}
        {field(t("spots.bestTide"), <Input value={draft.bestTide} maxLength={80} onChange={(e) => set("bestTide", e.target.value)} />)}
      </div>
      <CompassPicker label={t("spots.bestSwell")} value={draft.bestSwellDir} onChange={(v) => set("bestSwellDir", v)} lang={lang} />
      <CompassPicker label={t("spots.bestWind")} value={draft.bestWindDir} onChange={(v) => set("bestWindDir", v)} lang={lang} />
      {field(
        t("spotEdit.note"),
        <Textarea value={note} maxLength={MAX_NOTE} rows={2} placeholder={t("spotEdit.notePlaceholder")} onChange={(e) => setNote(e.target.value)} />
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-secondary px-3.5 py-3 text-[13px] leading-relaxed">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy || !changed} className="rounded-full px-6">
          {busy ? t("spotEdit.sending") : t("spotEdit.send")}
        </Button>
        {pending && (
          <Button type="button" variant="ghost" disabled={busy} className="rounded-full" onClick={() => void withdraw()}>
            {t("spotEdit.withdraw")}
          </Button>
        )}
      </div>
    </form>
  );
}

/** The 16 compass points as toggle chips, in compass order. */
function CompassPicker({ label, value, onChange, lang }: { label: string; value: string[]; onChange: (v: string[]) => void; lang: "en" | "zh-TW" }) {
  const on = new Set(value.map((v) => v.toUpperCase()));
  const toggle = (p: string) => onChange(COMPASS_16.filter((c) => (c === p ? !on.has(c) : on.has(c))));
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 pl-0.5 text-xs font-semibold text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {COMPASS_16.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={on.has(p)}
            onClick={() => toggle(p)}
            className={cn(
              "h-8 min-w-11 rounded-full px-2.5 font-mono text-[12.5px] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              on.has(p) ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
            )}
          >
            {compassLabel(p, lang) ?? p}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
