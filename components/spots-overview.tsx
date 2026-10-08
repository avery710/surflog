"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Search, X } from "lucide-react";
import { AddSpotDialog } from "@/components/add-spot-dialog";
import { RequestSpotDialog } from "@/components/request-spot-dialog";
import { SuggestSpotEditDialog } from "@/components/suggest-spot-edit-dialog";
import { Button } from "@/components/ui/button";
import { compassLabel } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import { browseGroups, facingPoints, nameMatches, searchSpots, searchTokens, tideBandKey } from "@/lib/spot-browse";
import { SpotCatalogProvider, type OwnRequest } from "@/lib/spot-catalog";
import type { OwnEditRequest } from "@/lib/spot-edit-requests";
import type { Spot } from "@/lib/spots";

const noop = () => {};

/** /spots — the log form's spot picker as a page: the whole shared catalogue,
 *  searched and grouped the same way (lib/spot-browse.ts), with one button to
 *  add a spot (admin) or request one (everyone else). Everyone else can also
 *  suggest an edit to any spot (reviewed on /admin); admins edit and delete
 *  on /admin directly. */
export function SpotsOverview({
  initialSpots,
  initialRequests,
  initialEdits,
  canManage,
}: {
  initialSpots: Spot[];
  initialRequests: OwnRequest[];
  /** The viewer's own pending edit suggestions. */
  initialEdits: OwnEditRequest[];
  canManage: boolean;
}) {
  const { lang, t } = useLang();
  const [spots, setSpots] = useState(initialSpots);
  const [requests, setRequests] = useState(initialRequests);
  // `text` is what the box shows, `query` what the list filters on; they
  // differ only mid-composition (注音/倉頡), as in the picker.
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [edits, setEdits] = useState(initialEdits);
  const [editing, setEditing] = useState<Spot | null>(null);
  const pendingEdit = useMemo(() => new Map(edits.filter((e) => e.status === "pending").map((e) => [e.spotSlug, e])), [edits]);

  const addSpot = useCallback(
    (s: Spot) => setSpots((prev) => (prev.some((x) => x.slug === s.slug) ? prev : [...prev, s])),
    []
  );
  const upsertRequest = useCallback(
    (r: OwnRequest) =>
      setRequests((prev) => (prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [r, ...prev])),
    []
  );

  const q = query.trim();
  const { groups, pending, shown } = useMemo(() => {
    const worldwide = spots.some((s) => !s.region);
    const matched = q ? searchSpots(spots, q, (region) => t(`region.${region}`)) : spots;
    const tokens = searchTokens(q);
    const waiting = requests.filter((r) => r.status === "pending");
    return {
      groups: browseGroups(matched, {
        regionTitle: (region) =>
          worldwide ? `${t("picker.taiwan")} · ${t(`region.${region}`)}` : t(`region.${region}`),
        elsewhere: t("picker.elsewhere"),
      }).filter((g) => g.list.length > 0),
      pending: q ? waiting.filter((r) => nameMatches(r.name, tokens)) : waiting,
      shown: matched.length,
    };
  }, [spots, requests, q, t]);

  return (
    <SpotCatalogProvider
      spots={spots}
      requests={requests}
      canManage={canManage}
      onAdd={addSpot}
      onReplace={noop}
      onRemove={noop}
      onRequestChanged={upsertRequest}
    >
      <div className={`${PAGE_COLUMN} min-w-0 flex-1 pb-18 pt-6`}>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("admin.back")}
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 className="text-2xl font-bold">{t("spots.title")}</h1>
          <Button className="rounded-full px-4" onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden />
            {canManage ? t("spot.addTitle") : t("request.title")}
          </Button>
        </div>
        <p className="mt-2 max-w-prose text-[13.5px] text-muted-foreground">{t("spots.intro")}</p>

        <div className="mt-5 flex h-11 items-center gap-2 rounded-full border border-input bg-card px-4 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            aria-label={t("picker.search")}
            placeholder={t("picker.search")}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!(e.nativeEvent as InputEvent).isComposing) setQuery(e.target.value);
            }}
            onCompositionEnd={(e) => setQuery(e.currentTarget.value)}
            // 16px on phones: anything smaller makes iOS zoom the page on focus
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setQuery("");
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-3.5" aria-hidden />
              <span className="sr-only">{t("picker.clear")}</span>
            </button>
          )}
        </div>

        <p aria-live="polite" className="mt-3 font-mono text-[12.5px] text-muted-foreground" data-testid="spot-count">
          {q ? t("spots.matchCount", { shown, count: spots.length }) : t("spots.count", { count: spots.length })}
        </p>

        {q && shown === 0 && pending.length === 0 && (
          <p className="mt-4 text-[13.5px] text-muted-foreground">{t("picker.noMatch", { query: q })}</p>
        )}

        {pending.length > 0 && (
          <section className="mt-6" data-group="pending">
            <GroupHeading title={t("picker.pending")} count={pending.length} />
            <ul className="mt-1.5 overflow-hidden rounded-[var(--r-tile)] border border-card-border bg-card">
              {pending.map((r) => (
                <li key={r.id} className="border-b border-card-border px-4 py-3 text-[14.5px] font-semibold break-words last:border-b-0">
                  {r.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {groups.map((g) => (
          <section key={g.key} className="mt-6" data-group={g.key}>
            <GroupHeading title={g.title} count={g.list.length} />
            <ul className="mt-1.5 overflow-hidden rounded-[var(--r-tile)] border border-card-border bg-card">
              {g.list.map((s) => (
                <SpotRow
                  key={s.slug}
                  spot={s}
                  lang={lang}
                  editPending={pendingEdit.has(s.slug)}
                  onSuggestEdit={canManage ? undefined : () => setEditing(s)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {canManage ? (
        <AddSpotDialog open={dialogOpen} onOpenChange={setDialogOpen} initialName={q} onCreated={noop} />
      ) : (
        <RequestSpotDialog open={dialogOpen} onOpenChange={setDialogOpen} initialName={q} />
      )}
      <SuggestSpotEditDialog
        spot={editing}
        pending={editing ? (pendingEdit.get(editing.slug) ?? null) : null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSent={(r) => setEdits((prev) => [r, ...prev.filter((e) => e.spotSlug !== r.spotSlug)])}
        onWithdrawn={(id) => setEdits((prev) => prev.filter((e) => e.id !== id))}
      />
    </SpotCatalogProvider>
  );
}

function GroupHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground">
      {title} <span className="font-mono">{count}</span>
    </h2>
  );
}

function SpotRow({
  spot,
  lang,
  editPending,
  onSuggestEdit,
}: {
  spot: Spot;
  lang: Lang;
  editPending: boolean;
  /** Absent for admins, who edit on /admin. */
  onSuggestEdit?: () => void;
}) {
  const { t } = useLang();
  const name = lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name;
  const other = spot.nameZh && spot.nameZh !== spot.name ? (lang === "zh-TW" ? spot.name : spot.nameZh) : null;
  const points = (list: string[]) => list.map((p) => compassLabel(p, lang) ?? p).join(lang === "zh-TW" ? "、" : ", ");
  const tideKey = spot.bestTide ? tideBandKey(spot.bestTide) : null;

  const facts: { label: string; value: string }[] = [];
  if (spot.facing) facts.push({ label: t("spots.faces"), value: points(facingPoints(spot.facing)) });
  if (spot.bestSwellDir?.length) facts.push({ label: t("spots.bestSwell"), value: points(spot.bestSwellDir) });
  if (spot.bestWindDir?.length) facts.push({ label: t("spots.bestWind"), value: points(spot.bestWindDir) });
  if (spot.bestTide) facts.push({ label: t("spots.bestTide"), value: tideKey ? t(tideKey) : spot.bestTide });

  return (
    <li className="border-b border-card-border px-4 py-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 text-[14.5px] font-semibold break-words">{name}</span>
          {other && <span className="min-w-0 text-[12.5px] text-muted-foreground break-words">{other}</span>}
          {editPending && (
            <span className="self-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {t("spotEdit.pendingBadge")}
            </span>
          )}
        </div>
        {onSuggestEdit && (
          <button
            type="button"
            onClick={onSuggestEdit}
            className="-my-1 flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Pencil className="size-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("spotEdit.button")}</span>
            <span className="sr-only">{` — ${name}`}</span>
          </button>
        )}
      </div>
      {facts.length > 0 && (
        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {facts.map((f) => (
            <div key={f.label} className="flex min-w-0 items-baseline gap-1.5">
              <dt className="shrink-0 text-[11.5px] font-semibold text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0 font-mono text-[12.5px] break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
