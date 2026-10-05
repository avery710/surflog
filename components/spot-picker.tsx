"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { Dialog as DialogPrimitive, Popover as PopoverPrimitive } from "radix-ui";
import { Check, ChevronDown, LocateFixed, Plus, Search, X } from "lucide-react";
import { AddSpotDialog } from "@/components/add-spot-dialog";
import { useLang, type Lang } from "@/lib/i18n";
import { requestSlug, useSpotCatalog } from "@/lib/spot-catalog";
import { distanceM, type LatLng } from "@/lib/spot-geo";
import type { Region, Spot } from "@/lib/spots";
import { useBrowserTimeZone } from "@/lib/use-browser-timezone";

/**
 * The spot field of the log form and the edit panel: a button that opens a
 * searchable list — a popover under the field from `sm` up, a full-screen
 * sheet on phones. Replaces the grouped <Select>, which stopped scaling once
 * the catalogue became worldwide (lib/spot-catalog.tsx).
 *
 * Focus stays in the search box the whole time (ARIA combobox + listbox,
 * `aria-activedescendant` for the highlighted row), so typing, arrows and
 * Enter all work without tabbing into the list.
 */

const REGIONS: Region[] = ["Northeast", "North", "East", "South", "West"];
/** Areas outside Taiwan that lead the Browse list, in this order (Avery's
 *  call); every other area follows alphabetically by "country · area". */
const AREA_PRIORITY = ["Siargao", "Bali"];
const RECENT_MAX = 4;
const NEARBY_MAX = 5;
/** "Near <your last spot>" only lists real neighbours; "near me" has no cap,
 *  since the nearest break to wherever you are is still the useful answer. */
const NEARBY_MAX_M = 80_000;

/** The owner's last few distinct spots, most recent first. */
export function recentSpotSlugs(sessions: readonly { spot: string; when: string }[]): string[] {
  const seen = new Set<string>();
  for (const s of [...sessions].sort((a, b) => b.when.localeCompare(a.when))) {
    if (s.spot) seen.add(s.spot);
  }
  return [...seen];
}

export interface PendingRequest {
  value: string;
  name: string;
}

/** The viewer's pending requests: the caller's list when it passes one, else
 *  the catalogue's own (`requests`, any status → the pending ones). */
export function usePendingRequests(given?: PendingRequest[]): PendingRequest[] {
  const { requests } = useSpotCatalog();
  return useMemo(
    () =>
      given ??
      requests.filter((r) => r.status === "pending").map((r) => ({ value: requestSlug(r.id), name: r.name })),
    [given, requests]
  );
}

type Geo =
  | { status: "idle" | "locating" | "denied" | "unavailable" }
  | ({ status: "located" } & LatLng);

type Row =
  | { kind: "spot"; index: number; spot: Spot; place: string | null; distance: number | null }
  /** The session's current value when it isn't in the catalogue (legacy "custom:" text). */
  | { kind: "current"; index: number; slug: string }
  /** One of the viewer's own requested spots, not approved yet. */
  | { kind: "pending"; index: number; slug: string; name: string }
  /** Admin only: opens AddSpotDialog with the query as the name. */
  | { kind: "add"; index: number }
  /** Everyone else, when the form wires a request channel: "can't find your spot?" */
  | { kind: "request"; index: number };

interface Section {
  key: string;
  title: string | null;
  rows: Row[];
}

/** Case, accents and apostrophes don't matter: "waiao" finds Wai'ao. */
function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "");
}

function fmtDistance(m: number): string {
  const km = m / 1000;
  if (km < 1) return "<1 km";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

const hasPoint = (s: Spot): s is Spot & LatLng => s.lat != null && s.lng != null;

function subscribeDesktop(callback: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/** Tailwind's `sm`. Server snapshot is the phone layout, but nothing that
 *  depends on it renders until the picker is opened. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia("(min-width: 640px)").matches,
    () => false
  );
}

export function SpotPicker({
  id,
  value,
  onChange,
  recent = [],
  onRequestSpot,
  pendingRequests: givenPending,
  className,
}: {
  id?: string;
  value: string;
  onChange: (slug: string) => void;
  /** Slugs of the user's recent spots, most recent first — see recentSpotSlugs(). */
  recent?: string[];
  /** Ask for a missing spot; gets the current search text (may be empty).
   *  Defaults to the catalogue's `requestSpot`; the "can't find your spot?"
   *  row only renders when one of the two exists. */
  onRequestSpot?: (query: string) => void;
  /** The viewer's own spot requests still waiting for approval. They can be
   *  logged against already; `value` is the opaque string stored as the
   *  session's `spot`. Defaults to the catalogue's pending requests. */
  pendingRequests?: PendingRequest[];
  /** Extra classes for the trigger, e.g. `bg-background` in the edit panel. */
  className?: string;
}) {
  const { lang, t } = useLang();
  const catalog = useSpotCatalog();
  // Props win; otherwise the catalogue's own request plumbing (the journal
  // mounts the dialog once), so the edit panel needs nothing passed down.
  const pendingRequests = usePendingRequests(givenPending);
  const requestSpot = onRequestSpot ?? catalog.requestSpot;
  const isDesktop = useIsDesktop();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // Kept only in memory, for as long as this form is mounted: the position
  // sorts the list in the browser and is never sent or stored anywhere.
  const [geo, setGeo] = useState<Geo>({ status: "idle" });
  const [addName, setAddName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  // The add dialog takes focus when the picker hands over to it; without
  // this the closing picker would pull focus back to the trigger behind it.
  const handingOver = useRef(false);

  function select(slug: string) {
    onChange(slug);
    setOpen(false);
  }

  function startAdd(name: string) {
    handingOver.current = true;
    setAddName(name);
    setOpen(false);
    setAddOpen(true);
  }

  // Only ever called from the "Near me" button — never on open (no
  // permission prompt unless the user asks for it).
  function locate() {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "unavailable" });
      return;
    }
    setGeo({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ status: "located", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeo({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 }
    );
  }

  function onCloseAutoFocus(e: Event) {
    e.preventDefault();
    if (handingOver.current) handingOver.current = false;
    else triggerRef.current?.focus();
  }

  // An IME uses Escape to cancel its own candidate window.
  const onEscapeKeyDown = (e: KeyboardEvent) => {
    if (e.isComposing) e.preventDefault();
  };

  const body = (
    <PickerBody
      value={value}
      recent={recent}
      pending={pendingRequests}
      geo={geo}
      inputRef={inputRef}
      sheet={!isDesktop}
      onLocate={locate}
      onSelect={select}
      onAdd={catalog.canManage ? startAdd : undefined}
      onRequest={
        // an admin adds the spot themselves instead of asking for it
        requestSpot && !catalog.canManage
          ? (q) => {
              handingOver.current = true; // the request dialog takes focus
              setOpen(false);
              requestSpot(q);
            }
          : undefined
      }
    />
  );

  return (
    <>
      <PopoverPrimitive.Root open={open && isDesktop} onOpenChange={setOpen} modal>
        <PopoverPrimitive.Trigger asChild>
          <button
            ref={triggerRef}
            id={id}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              // same box as SelectTrigger, so it lines up with the time field
              "flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              className
            )}
          >
            <span className="truncate">
              {pendingRequests.find((p) => p.value === value)?.name ?? catalog.label(value, lang)}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            aria-label={t("picker.title")}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
            onCloseAutoFocus={onCloseAutoFocus}
            onEscapeKeyDown={onEscapeKeyDown}
            className="z-50 flex w-[max(var(--radix-popover-trigger-width),320px)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[var(--r-tile)] border border-card-border bg-popover text-popover-foreground shadow-[var(--shadow-card)] outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
            style={{ maxHeight: "min(420px, var(--radix-popover-content-available-height))" }}
          >
            {body}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      <DialogPrimitive.Root open={open && !isDesktop} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            aria-describedby={undefined}
            // Phones: land on the sheet itself, not the search box, so the
            // on-screen keyboard doesn't cover Recent/Nearby before it's needed.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement | null)?.focus();
            }}
            onCloseAutoFocus={onCloseAutoFocus}
            onEscapeKeyDown={onEscapeKeyDown}
            className="fixed inset-0 z-50 flex h-dvh flex-col bg-card outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 pt-3 pr-2.5 pb-1 pl-4">
              <DialogPrimitive.Title className="text-lg font-bold tracking-[-0.02em]">
                {t("picker.title")}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50">
                <X className="size-4.5" aria-hidden />
                <span className="sr-only">{t("entry.close")}</span>
              </DialogPrimitive.Close>
            </div>
            {body}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* the spot list is the admin's to maintain — nobody else gets this */}
      {catalog.canManage && (
        <AddSpotDialog
          open={addOpen}
          onOpenChange={(next) => {
            setAddOpen(next);
            // it has no trigger of its own to hand focus back to
            if (!next) setTimeout(() => triggerRef.current?.focus(), 0);
          }}
          initialName={addName}
          onCreated={(spot) => onChange(spot.slug)}
        />
      )}
    </>
  );
}

/** Search box + list. Mounted only while the picker is open, so the query
 *  and the highlighted row start fresh every time. */
function PickerBody({
  value,
  recent,
  pending,
  geo,
  inputRef,
  sheet,
  onLocate,
  onSelect,
  onAdd,
  onRequest,
}: {
  value: string;
  recent: string[];
  pending: PendingRequest[];
  geo: Geo;
  inputRef: React.RefObject<HTMLInputElement | null>;
  sheet: boolean;
  onLocate: () => void;
  onSelect: (slug: string) => void;
  onAdd?: (name: string) => void;
  onRequest?: (query: string) => void;
}) {
  const { lang, t } = useLang();
  const catalog = useSpotCatalog();
  const browserTz = useBrowserTimeZone();
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (index: number) => `${uid}-opt-${index}`;
  // `text` is what the box shows; `query` is what the list filters on. They
  // differ only mid-composition (注音/倉頡): half-typed ㄨㄞ would match
  // nothing and offer to add a spot called "ㄨㄞ".
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  // null = not moved yet: highlight the selected spot (or the first row).
  const [moved, setMoved] = useState<number | null>(null);

  const canAdd = onAdd != null;
  const canRequest = onRequest != null;

  const { sections, rows } = useMemo(() => {
    const { spots, bySlug } = catalog;
    const here: LatLng | null = geo.status === "located" ? { lat: geo.lat, lng: geo.lng } : null;
    const taiwan = t("picker.taiwan");
    // by the spot's own fields, wherever it's stored: `region` means Taiwan
    const worldwide = spots.some((s) => !s.region);

    const place = (s: Spot): string | null => {
      if (s.region) return worldwide ? `${taiwan} · ${t(`region.${s.region}`)}` : t(`region.${s.region}`);
      return [s.area, s.country].filter(Boolean).join(", ") || null;
    };

    let index = 0;
    const spotRow = (spot: Spot, showPlace: boolean, distance?: number): Row => ({
      kind: "spot",
      index: index++,
      spot,
      place: showPlace ? place(spot) : null,
      distance: distance ?? (here && hasPoint(spot) ? distanceM(here, spot) : null),
    });
    const out: Section[] = [];
    const push = (key: string, title: string | null, list: Row[]) => {
      if (list.length) out.push({ key, title, rows: list });
    };

    const q = query.trim();
    if (q) {
      const tokens = fold(q).split(/\s+/).filter(Boolean);
      const first = tokens[0] ?? "";
      const hits = spots
        .map((s) => {
          const name = fold(`${s.name} ${s.nameZh ?? ""}`);
          const hay = fold(
            [
              s.name,
              s.nameZh,
              s.slug,
              s.area,
              s.country,
              // search aliases, never shown: Taiwan spots carry no country field
              ...(s.region ? [s.region, t(`region.${s.region}`), "Taiwan 台灣 臺灣"] : []),
            ]
              .filter(Boolean)
              .join(" ")
          );
          const tight = hay.replace(/\s+/g, ""); // "cloud9" finds "Cloud 9"
          const match = tokens.every((tok) => hay.includes(tok) || tight.includes(tok));
          return match ? { s, starts: name.split(" ").some((w) => w.startsWith(first)) } : null;
        })
        .filter((h) => h != null)
        // names that start with the query before area/country matches
        .sort((a, b) => Number(b.starts) - Number(a.starts));
      const requested = pending.filter((p) => tokens.every((tok) => fold(p.name).includes(tok)));
      push(
        "pending",
        requested.length ? t("picker.pending") : null,
        requested.map((p) => ({ kind: "pending", index: index++, slug: p.value, name: p.name }))
      );
      push(
        "results",
        null,
        hits.map((h) => spotRow(h.s, true))
      );
      if (canAdd) out.push({ key: "add", title: null, rows: [{ kind: "add", index: index++ }] });
    } else {
      push(
        "pending",
        t("picker.pending"),
        pending.map((p) => ({ kind: "pending", index: index++, slug: p.value, name: p.name }))
      );
      if (value && !bySlug(value) && !pending.some((p) => p.value === value)) {
        push("current", t("picker.current"), [{ kind: "current", index: index++, slug: value }]);
      }

      const known = recent.map((slug) => bySlug(slug)).filter((s) => s != null);
      push(
        "recent",
        t("picker.recent"),
        known.slice(0, RECENT_MAX).map((s) => spotRow(s, true))
      );

      // Near me once located; until then near the last place they surfed.
      const anchor = here ? null : (known[0] ?? bySlug(value));
      const from = here ?? (anchor && hasPoint(anchor) ? anchor : null);
      if (from) {
        const near = spots
          .filter(hasPoint)
          .filter((s) => s.slug !== anchor?.slug)
          .map((s) => ({ s, d: distanceM(from, s) }))
          .filter((x) => here != null || x.d <= NEARBY_MAX_M)
          .sort((a, b) => a.d - b.d)
          .slice(0, NEARBY_MAX);
        push(
          "nearby",
          here ? t("picker.nearYou") : t("picker.nearby", { name: catalog.label(anchor!.slug, lang) }),
          near.map((x) => spotRow(x.s, true, x.d))
        );
      }

      // Browse: Taiwan by region, then every other country → area.
      const groups: { key: string; title: string; list: Spot[] }[] = REGIONS.map((region) => ({
        key: `tw-${region}`,
        title: place({ region } as Spot) ?? region,
        list: spots.filter((s) => s.region === region),
      }));
      const abroad = new Map<string, Spot[]>();
      for (const s of spots) {
        if (s.region) continue;
        const title = [s.country, s.area].filter(Boolean).join(" · ") || t("picker.elsewhere");
        abroad.set(title, [...(abroad.get(title) ?? []), s]);
      }
      const rank = (title: string) => {
        const i = AREA_PRIORITY.indexOf(abroad.get(title)![0].area);
        return i === -1 ? AREA_PRIORITY.length : i;
      };
      for (const title of [...abroad.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
        groups.push({ key: `w-${title}`, title, list: abroad.get(title)! });
      }
      // No history yet: lead with wherever the browser's clock says they are.
      if (known.length === 0 && browserTz) {
        const local = (g: { list: Spot[] }) => g.list.some((s) => s.timezone === browserTz);
        groups.sort((a, b) => Number(local(b)) - Number(local(a)));
      }
      for (const g of groups) {
        push(
          g.key,
          g.title,
          g.list.map((s) => spotRow(s, false))
        );
      }
    }
    // quiet last row, with or without a query
    if (canRequest) out.push({ key: "request", title: null, rows: [{ kind: "request", index: index++ }] });
    return { sections: out, rows: out.flatMap((s) => s.rows) };
  }, [catalog, geo, query, value, recent, pending, browserTz, lang, t, canAdd, canRequest]);

  const slugOf = (r: Row) =>
    r.kind === "spot" ? r.spot.slug : r.kind === "current" || r.kind === "pending" ? r.slug : null;
  const selectedIndex = rows.find((r) => slugOf(r) === value)?.index;
  const active = rows.length === 0 ? -1 : Math.min(moved ?? selectedIndex ?? 0, rows.length - 1);
  const noMatch = query.trim() !== "" && !rows.some((r) => r.kind === "spot");

  function commitQuery(next: string) {
    setQuery(next);
    setMoved(null);
  }

  function choose(row: Row | undefined) {
    if (!row) return;
    if (row.kind === "add") onAdd?.(query.trim());
    else if (row.kind === "request") onRequest?.(query.trim());
    else onSelect(row.kind === "spot" ? row.spot.slug : row.slug);
  }

  function move(step: number) {
    if (rows.length === 0) return;
    const next = (active + step + rows.length) % rows.length;
    setMoved(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Mid-composition these keys belong to the IME's candidate list (see
    // CLAUDE.md "Bugs already hit"); 229 covers browsers that don't set the flag.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && e.target === inputRef.current) {
      e.preventDefault();
      choose(rows[active]);
    }
  }

  const geoMessage =
    geo.status === "locating"
      ? t("picker.locating")
      : geo.status === "located"
        ? t("picker.located")
        : geo.status === "denied"
          ? t("picker.locationDenied")
          : geo.status === "unavailable"
            ? t("picker.locationUnavailable")
            : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <div className="flex shrink-0 items-center gap-2 border-b border-input px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-label={t("picker.search")}
          placeholder={t("picker.search")}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (!(e.nativeEvent as InputEvent).isComposing) commitQuery(e.target.value);
          }}
          onCompositionEnd={(e) => commitQuery(e.currentTarget.value)}
          // 16px on phones: anything smaller makes iOS zoom the page on focus
          className={cn(
            "min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm",
            sheet ? "h-12" : "h-10"
          )}
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              commitQuery("");
              inputRef.current?.focus();
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" aria-hidden />
            <span className="sr-only">{t("picker.clear")}</span>
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 px-3 pt-2.5 pb-1">
        <button
          type="button"
          onClick={onLocate}
          disabled={geo.status === "locating"}
          aria-pressed={geo.status === "located"}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
            geo.status === "located"
              ? "border-transparent bg-primary/10 text-primary"
              : "border-input text-foreground hover:bg-secondary"
          )}
        >
          <LocateFixed className="size-3.5" aria-hidden />
          {t("picker.nearMe")}
        </button>
        <span aria-live="polite" className="min-w-0 text-xs text-muted-foreground">
          {geoMessage}
        </span>
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label={t("picker.title")}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5"
      >
        {noMatch && (
          <p className="px-2.5 pt-3 pb-1 text-sm text-muted-foreground">
            {t("picker.noMatch", { query: query.trim() })}
          </p>
        )}
        {sections.map((section) => (
          <div key={section.key} role="group" aria-labelledby={section.title ? `${uid}-${section.key}` : undefined}>
            {section.title && (
              <div
                id={`${uid}-${section.key}`}
                className="px-2.5 pt-3 pb-1 text-xs font-semibold text-muted-foreground"
              >
                {section.title}
              </div>
            )}
            {section.rows.map((row) => (
              <Option
                key={row.index}
                id={optionId(row.index)}
                row={row}
                active={row.index === active}
                selected={slugOf(row) === value}
                sheet={sheet}
                label={
                  row.kind === "add"
                    ? t("picker.add", { query: query.trim() })
                    : row.kind === "request"
                      ? t("picker.request")
                      : row.kind === "pending"
                        ? row.name
                        : catalog.label(row.kind === "spot" ? row.spot.slug : row.slug, lang)
                }
                lang={lang}
                onHover={() => setMoved(row.index)}
                onChoose={() => choose(row)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Option({
  id,
  row,
  active,
  selected,
  sheet,
  label,
  lang,
  onHover,
  onChoose,
}: {
  id: string;
  row: Row;
  active: boolean;
  selected: boolean;
  sheet: boolean;
  label: string;
  lang: Lang;
  onHover: () => void;
  onChoose: () => void;
}) {
  // The other language's name, small, when the spot has both ("外澳 Wai'ao").
  const other =
    row.kind === "spot" && row.spot.nameZh && row.spot.nameZh !== row.spot.name
      ? lang === "zh-TW"
        ? row.spot.name
        : row.spot.nameZh
      : null;
  const add = row.kind === "add";
  const request = row.kind === "request";
  return (
    // Focus never leaves the search box (aria-activedescendant), so the row
    // itself takes no key events — the combobox handles them.
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-active={active || undefined}
      onPointerMove={active ? undefined : onHover}
      onClick={onChoose}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm select-none data-active:bg-secondary",
        sheet ? "min-h-11 py-2" : "min-h-9 py-1.5",
        add && "mt-1 font-semibold text-primary",
        request && "mt-1 text-muted-foreground"
      )}
    >
      {add && <Plus className="size-4 shrink-0" aria-hidden />}
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 truncate">{label}</span>
        {other && <span className="min-w-0 truncate text-xs text-muted-foreground">{other}</span>}
        {row.kind === "spot" && row.place && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">{row.place}</span>
        )}
      </span>
      {row.kind === "spot" && row.distance != null && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{fmtDistance(row.distance)}</span>
      )}
      {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
    </div>
  );
}
