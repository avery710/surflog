"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { AddSpotDialog } from "@/components/add-spot-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import { SpotCatalogProvider } from "@/lib/spot-catalog";
import { normalizeName } from "@/lib/spot-geo";
import type { Spot } from "@/lib/spots";
import type { SpotRequest } from "@/lib/spot-requests";

const noop = () => {};

type DialogState = { kind: "add" } | { kind: "edit"; spot: Spot } | { kind: "approve"; request: SpotRequest } | null;

/** /admin — spot requests (approve by creating the spot, or decline) and the
 *  whole catalogue (add, edit, delete). Every write goes through the
 *  admin-only API routes; this page only renders for an admin. */
export function SpotsAdmin({
  initialSpots,
  initialRequests,
  children,
}: {
  initialSpots: Spot[];
  initialRequests: SpotRequest[];
  /** Further admin sections, rendered under the catalogue. */
  children?: React.ReactNode;
}) {
  const { lang, t } = useLang();
  const [spots, setSpots] = useState(initialSpots);
  const [requests, setRequests] = useState(initialRequests);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [query, setQuery] = useState("");
  const [declining, setDeclining] = useState<string | null>(null);

  const addSpot = useCallback((spot: Spot) => setSpots((list) => [...list, spot]), []);
  const replaceSpot = useCallback(
    (spot: Spot) => setSpots((list) => list.map((s) => (s.slug === spot.slug ? spot : s))),
    []
  );
  const removeSpot = useCallback((slug: string) => setSpots((list) => list.filter((s) => s.slug !== slug)), []);

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  const groups = useMemo(() => {
    const q = normalizeName(query);
    const shown = q
      ? spots.filter((s) =>
          [s.name, s.nameZh, s.slug, s.area, s.country].some((v) => v && normalizeName(v).includes(q))
        )
      : spots;
    const byPlace = new Map<string, Spot[]>();
    for (const s of shown) {
      const key = `${s.country} · ${s.area}`;
      byPlace.set(key, [...(byPlace.get(key) ?? []), s]);
    }
    return [...byPlace.entries()]
      .map(([place, list]) => [place, [...list].sort((a, b) => a.name.localeCompare(b.name))] as const)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [spots, query]);

  async function decline(request: SpotRequest) {
    setDeclining(request.id);
    try {
      const res = await fetch(`/api/spot-requests/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      if (!res.ok) throw new Error();
      setRequests((list) => list.map((r) => (r.id === request.id ? { ...r, status: "declined" } : r)));
      toast.success(t("admin.declined"));
    } catch {
      toast.error(t("admin.couldntDecline"));
    } finally {
      setDeclining(null);
    }
  }

  // AddSpotDialog reports the spot a request became: the new one, or an
  // existing one the admin chose instead (then the request still needs linking).
  async function onSpotSaved(spot: Spot) {
    if (dialog?.kind !== "approve") return;
    const request = dialog.request;
    if (!spots.some((s) => s.slug === spot.slug)) {
      setRequests((list) =>
        list.map((r) => (r.id === request.id ? { ...r, status: "approved", spotSlug: spot.slug } : r))
      );
      return;
    }
    try {
      const res = await fetch(`/api/spot-requests/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", spotSlug: spot.slug }),
      });
      if (!res.ok) throw new Error();
      setRequests((list) =>
        list.map((r) => (r.id === request.id ? { ...r, status: "approved", spotSlug: spot.slug } : r))
      );
      toast.success(t("admin.approved"));
    } catch {
      toast.error(t("admin.couldntApprove"));
    }
  }

  const spotName = (s: Spot) => (lang === "zh-TW" ? (s.nameZh ?? s.name) : s.name);

  return (
    <SpotCatalogProvider
      spots={spots}
      requests={[]}
      canManage
      onAdd={addSpot}
      onReplace={replaceSpot}
      onRemove={removeSpot}
      onRequestChanged={noop}
    >
      <div className={`${PAGE_COLUMN} min-w-0 flex-1 pb-18 pt-6`}>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("admin.back")}
        </Link>
        <h1 className="mt-3 text-2xl font-bold">{t("admin.title")}</h1>

        <section className="mt-7">
          <h2 className="text-base font-bold">
            {t("admin.requests")} <span className="font-mono text-muted-foreground">{pending.length}</span>
          </h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-muted-foreground">{t("admin.noRequests")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="rounded-[var(--r-tile)] border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-bold break-words">{r.name}</div>
                      <div className="mt-0.5 text-[12.5px] text-muted-foreground break-words">
                        {[r.requesterName, r.requesterEmail].filter(Boolean).join(" · ") || t("admin.unknownRequester")}
                        {" · "}
                        {fmtDate(r.createdAt.slice(0, 10), lang, false)}
                      </div>
                      {(r.locationText || r.lat != null) && (
                        <div className="mt-2 font-mono text-[12.5px] break-all">
                          {r.locationText ?? `${r.lat}, ${r.lng}`}
                        </div>
                      )}
                      {r.note && <p className="mt-2 text-[13.5px] whitespace-pre-wrap break-words">{r.note}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button className="rounded-full px-4" onClick={() => setDialog({ kind: "approve", request: r })}>
                        {t("admin.approve")}
                      </Button>
                      <Button
                        variant="secondary"
                        className="rounded-full px-4"
                        disabled={declining === r.id}
                        onClick={() => decline(r)}
                      >
                        {t("admin.decline")}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {resolved.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[13px] font-semibold text-muted-foreground">
                {t("admin.resolved", { count: resolved.length })}
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-[13px]">
                {resolved.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                    <span className="font-semibold text-foreground">{r.name}</span>
                    <span>{r.status === "approved" ? t("admin.statusApproved") : t("admin.statusDeclined")}</span>
                    {r.spotSlug && <span className="font-mono">{r.spotSlug}</span>}
                    <span>{r.requesterName ?? r.requesterEmail}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="mt-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold">
              {t("admin.spots")} <span className="font-mono text-muted-foreground">{spots.length}</span>
            </h2>
            <Button className="rounded-full px-4" onClick={() => setDialog({ kind: "add" })}>
              <Plus aria-hidden />
              {t("admin.addSpot")}
            </Button>
          </div>
          <Input
            className="mt-3"
            value={query}
            placeholder={t("admin.search")}
            aria-label={t("admin.search")}
            onChange={(e) => setQuery(e.target.value)}
          />
          {groups.length === 0 && <p className="mt-3 text-[13.5px] text-muted-foreground">{t("admin.noSpots")}</p>}
          {groups.map(([place, list]) => (
            <div key={place} className="mt-5">
              <h3 className="text-xs font-semibold text-muted-foreground">
                {place} <span className="font-mono">{list.length}</span>
              </h3>
              <ul className="mt-1.5 overflow-hidden rounded-[var(--r-tile)] border bg-card">
                {list.map((s) => (
                  <li key={s.slug} className="flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">
                        {spotName(s)}
                        {s.nameZh && lang !== "zh-TW" && (
                          <span className="ml-2 font-medium text-muted-foreground">{s.nameZh}</span>
                        )}
                      </div>
                      <div className="truncate font-mono text-[11.5px] text-muted-foreground">
                        {s.lat?.toFixed(5)}, {s.lng?.toFixed(5)} · {s.timezone}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0 rounded-full"
                      aria-label={t("spot.edit", { name: spotName(s) })}
                      onClick={() => setDialog({ kind: "edit", spot: s })}
                    >
                      {t("admin.edit")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        {children}
      </div>

      <AddSpotDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        editing={dialog?.kind === "edit" ? dialog.spot : undefined}
        request={dialog?.kind === "approve" ? dialog.request : undefined}
        onCreated={onSpotSaved}
      />
    </SpotCatalogProvider>
  );
}
