"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConditionTile, Figure } from "@/components/condition-tile";
import { EditPanel } from "@/components/edit-panel";
import { MediaViewer } from "@/components/media-viewer";
import { cn } from "cn";
import { useSpotCatalog } from "@/lib/spot-catalog";
import { toCompass } from "@/lib/openmeteo";
import { computeSessionFit } from "@/lib/session-fit";
import { compassLabel, fmt1, fmtWhen } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { TideChart } from "@/components/tide-chart";
import { TideEventsSub, tideTrend } from "@/components/tide-events";
import { DirectionArrow } from "@/components/direction-arrow";
import { WindStrength } from "@/components/wind-strength";
import { WindShoreBadge } from "@/components/wind-shore-badge";
import { GoalSection } from "@/components/goal";
import { TileGroup } from "@/components/tile-group";
import { PillNeck } from "@/components/pill-neck";
import { sessionAchieved } from "@/lib/goal";
import { boardLabel } from "@/lib/boards";
import type { Board, Session, TideEvent } from "@/lib/types";

export function EntryCard({
  session,
  boards = [],
  goal = null,
  onUpdated,
  onDeleted,
  readOnly = false,
}: {
  session: Session;
  /** The owner's current goal, for the edit panel's checkboxes. */
  goal?: string | null;
  /** The owner's rack — to show the session's board and to pick one on edit. */
  boards?: Board[];
  onUpdated: (s: Session) => void;
  onDeleted: (id: string) => void;
  /** No ⋯ menu (edit / upload / delete) — for the signed-out landing
   *  page's demo cards, which must never call the API. */
  readOnly?: boolean;
}) {
  const { lang, t } = useLang();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Which photo/video is open full-screen (index into session.photos), or null.
  const [viewing, setViewing] = useState<number | null>(null);

  const catalog = useSpotCatalog();
  const spot = catalog.bySlug(session.spot);
  const fit = computeSessionFit(spot, session);

  // Confirm dialog instead of window.confirm(): a native confirm() dialog
  // blocks the whole tab's render thread until dismissed — bad UX in
  // general, and it freezes browser automation tooling outright.
  async function performDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("toast.couldntDelete"));
      onDeleted(session.id);
      toast.success(t("toast.sessionDeleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntDelete"));
      setDeleting(false);
    }
  }

  const om = session.condOpenMeteo;
  const cwa = session.condCwaTide;
  const hasTemp = om?.seaTempC != null || om?.airTempC != null;
  const board = session.boardId ? boards.find((b) => b.id === session.boardId) : undefined;
  const achieved = sessionAchieved(session);
  const manual = session.cond;
  const hasShore = !!fit && !fit.missing.includes("windDirDeg") && !fit.missing.includes("spot.facing");
  // CWA's tide forecast wins whenever it covers the session (accurate to
  // ~10 min against real references; Open-Meteo's offshore grid node runs
  // 20-65 min off — see CLAUDE.md "CWA tide forecast", 2026-09-28). CWA is
  // forward-only (~32 days), so most past/overseas sessions still fall back
  // to Open-Meteo's tideEvents, same as before.
  const cwaEvents = cwa?.events ?? [];
  const omEvents = om?.tideEvents ?? [];
  const tideSource: "cwa" | "open-meteo" | null =
    cwaEvents.length > 0 ? "cwa" : omEvents.length > 0 ? "open-meteo" : null;
  const tideEvents = tideSource === "cwa" ? cwaEvents : omEvents;
  // Older CWA rows (pre-2026-09-24) only ever stored the single nearest
  // event, not `events` — build a one-item array so tideTrend() (which
  // already handles a lone event) can still read a direction off it.
  const cwaLegacyEvent: TideEvent[] =
    cwa?.time && cwa?.tideType ? [{ type: cwa.tideType, time: cwa.time.slice(0, 16), heightM: cwa.tideM }] : [];
  const tideTrendValue =
    tideTrend(tideEvents, session.when) ??
    tideTrend(cwaLegacyEvent, session.when) ??
    om?.seaLevelTrend ??
    null;
  const trendHeadline = (trend: "rising" | "falling" | null) =>
    trend ? <Figure value={<span className="capitalize">{t(trend === "rising" ? "tide.rising" : "tide.falling")}</span>} /> : null;

  const cardClass =
    "mt-3.5 overflow-hidden rounded-[var(--r-card)] border border-card-border bg-card";

  if (editing) {
    return (
      <article className={cardClass}>
        <EditPanel
          session={session}
          boards={boards}
          goal={goal}
          onSaved={(s) => {
            onUpdated(s);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </article>
    );
  }

  return (
    <article className={cardClass}>
      {/* Spot + date wrap inside their own group; the actions stay a fixed
          right-hand column, so on a phone the date drops under the spot
          name while ⋯ stays pinned top-right (with one flex-wrap row, ⋯
          was what wrapped, onto its own line). Vertical padding tightened
          2026-10-01 (smaller cards, notes as the focus — see below).
          The group is items-baseline (the date sits on the title's text
          baseline when they share a row) with min-h-10 = the ⋯ button's
          height and content-center: align-content centres the flex
          line(s) in that min height, so a one-line header sits on the same
          axis as ⋯ (items-baseline alone would pack the line to the top),
          and a wrapped header (date under the title, or a two-line title)
          just grows past 40px with nothing to centre. ⋯ stays items-start
          (pinned top-right) when the group grows taller. */}
      <div className="flex items-start gap-2 px-6 pt-4 pb-2">
        <div className="flex min-h-10 min-w-0 flex-1 flex-wrap content-center items-baseline gap-x-3 gap-y-1.5">
          <span className="min-w-0 text-[21px] font-bold tracking-[-0.02em] leading-tight break-words">
            {catalog.label(session.spot, lang)}
          </span>
          <span className="shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground">
            {fmtWhen(session.when, lang)}
          </span>
        </div>
        {!readOnly && (<>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground"
            aria-label={t("entry.actions")}
          >
            <MoreHorizontal className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil />
              {t("entry.edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setDeleteDialogOpen(true)}
              variant="destructive"
            >
              <Trash2 />
              {t("entry.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </>)}
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteDialogOpen(open);
        }}
      >
        <DialogContent closeLabel={t("entry.close")}>
          <DialogHeader>
            <DialogTitle>{t("entry.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("entry.deleteDescription", {
                spot: catalog.label(session.spot, lang),
                when: fmtWhen(session.when, lang),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              {t("edit.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={() => void performDelete()}
              disabled={deleting}
            >
              {deleting ? t("entry.deleting") : t("entry.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {om ? (
        // Tiles keep an 8px gap that the shared neck bridges (2026-10-06,
        // same stem as the board chip and goals): TileGroup draws one stem
        // between each pair of tiles that face each other across a gap.
        // Phones (<sm): a 3-col grid, swell/period/wind then temp+tide
        // (tide moved back after temp 2026-10-01, on request).
        // sm and up (tablet and desktop, 2026-10-01): one flex row that
        // fills the card's full width, not just desktop — a tablet-width
        // card used to sit at half-width in two grid rows, with no reason
        // the tiles couldn't share one row once they'd shrunk (see
        // condition-tile.tsx). Flex weights aren't quite equal: Wind needs
        // the most room (its two rows of text are the row's longest, and
        // wrap to 4 lines — stretching the whole row — if squeezed as
        // narrow as the others), Period the least (just a number), and the
        // tide tile gets a bigger share (flex-[1.6] + a min-width) so its
        // mini curve has room — see tide-chart.tsx. Stretched (not
        // items-start) so every tile in the row shares the row's tallest
        // height, content staying top-aligned inside — equal tile heights
        // at every breakpoint, including the phone grid rows (CSS Grid's
        // own default stretch already handled those). overflow-x-auto is
        // just a safety net if a very narrow sm width can't fit five tiles;
        // it shouldn't be needed at 768px and up.
        <TileGroup className="grid grid-cols-3 gap-2 sm:flex sm:flex-nowrap sm:items-stretch sm:overflow-x-auto [scrollbar-width:none] px-6 pb-1.5">
          {om && (
            <>
              <ConditionTile
                label={t("tile.swellOpenMeteo")}
                className={`${om.swellPeriodS == null ? "col-span-2" : ""} sm:flex-1 sm:basis-0 sm:shrink`}
                value={<Figure value={fmt1(om.swellHeightM)} unit="m" />}
                sub={<DirSub deg={om.swellDirDeg} compass={compassLabel(toCompass(om.swellDirDeg), lang)} />}
              />
              {om.swellPeriodS != null && (
                <ConditionTile
                  label={t("tile.period")}
                  className="sm:flex-[0.7] sm:basis-0 sm:shrink"
                  value={
                    <Figure value={fmt1(om.swellPeriodS)} unit="s" />
                  }
                />
              )}
              {/* Wind gets extra flex weight: its two rows (speed+strength,
                  then direction+shore word) are the row's longest text and
                  wrap to 4 lines — stretching the whole row taller — if
                  squeezed to the same width as Period's bare number. */}
              <ConditionTile
                label={t("tile.wind")}
                className={`${om.swellPeriodS == null ? "col-span-2" : ""} sm:flex-[1.3] sm:basis-0 sm:shrink`}
                value={
                  <span className="flex flex-col gap-0.5">
                    <span className="flex min-h-5 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-5">
                      <Figure value={fmt1(om.windSpeedMs)} unit="m/s" />
                      {om.windSpeedMs != null && (
                        <span className="font-sans text-[11px] font-medium leading-none tracking-normal text-muted-foreground">
                          <WindStrength speedMs={om.windSpeedMs} gustMs={om.windGustMs} />
                        </span>
                      )}
                    </span>
                    {(hasShore || om.windDirDeg != null) && (
                      <span className="flex min-h-4 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-4">
                        <DirSub deg={om.windDirDeg} compass={compassLabel(toCompass(om.windDirDeg), lang)} />
                        {hasShore && (
                          <span className="font-sans text-[11px] font-medium leading-none tracking-normal text-muted-foreground">
                            <WindShoreBadge mode={fit.windMode} />
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                }
              />
              {hasTemp && (
                <ConditionTile
                  label={t("tile.temp")}
                  className="sm:flex-1 sm:basis-0 sm:shrink"
                  value={<Figure value={fmt1(om.seaTempC)} unit="°C" />}
                  sub={om.airTempC != null ? t("tile.airTemp", { t: fmt1(om.airTempC) ?? "—" }) : undefined}
                />
              )}
              {/* CWA wins whenever it covers the session (see the comment
                  above `tideSource`); Open-Meteo's tideEvents is the
                  fallback for past/overseas sessions CWA can't reach. The
                  manual Swelleye tide stays stored but never shown here.
                  The mini curve needs at least two events to draw a shape;
                  a lone legacy CWA event falls back to the plain
                  next-low/next-high text. Ordered after the temp tile
                  (moved back 2026-10-01, on request), last in the row. */}
              {tideSource && (
                <ConditionTile
                  label={t("tile.tideOpenMeteo")}
                  className={`${hasTemp ? "col-span-2" : "col-span-3"} sm:flex-[1.6] sm:basis-0 sm:shrink sm:min-w-[110px]`}
                  value={trendHeadline(tideTrendValue)}
                  sub={
                    tideEvents.length >= 2 ? (
                      <TideChart events={tideEvents} sessionWhen={session.when} />
                    ) : (
                      <TideEventsSub events={tideEvents} sessionWhen={session.when} />
                    )
                  }
                />
              )}
            </>
          )}
        </TileGroup>
      ) : null}

      {/* Open-Meteo wins where both exist: the typed Swelleye swell/wind
          duplicates its tiles, so it's stored but not shown (and only
          shown when Open-Meteo has nothing for the session). */}
      {manual && om ? null : manual ? (
        <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:auto-cols-[minmax(0,1fr)] md:grid-cols-none lg:flex lg:overflow-x-auto [scrollbar-width:none] px-6 pt-0 pb-1.5">
          <ConditionTile
            label={t("tile.swellSwelleye")}
            value={fmt1(manual.swellHeightM)}
            unit="m"
            sub={
              manual.swellPeriodS != null || manual.swellDir
                ? manual.swellDir
                  ? t("cond.swellSub", {
                      p: fmt1(manual.swellPeriodS) ?? "—",
                      dir: compassLabel(manual.swellDir, lang) ?? "",
                    })
                  : t("cond.periodOnly", { p: fmt1(manual.swellPeriodS) ?? "—" })
                : undefined
            }
          />
          <ConditionTile
            label={t("tile.wind")}
            value={fmt1(manual.windSpeedMs)}
            unit="m/s"
            sub={
              manual.windDir || manual.windGustMs != null
                ? [
                    manual.windDir
                      ? t("cond.windFrom", { dir: compassLabel(manual.windDir, lang) ?? "" })
                      : null,
                    manual.windGustMs != null ? t("cond.gust", { g: fmt1(manual.windGustMs) ?? "" }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : undefined
            }
          />
        </div>
      ) : !om ? (
        <div className="mx-6 mb-2 mt-0.5 flex flex-wrap items-center gap-3 rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4.5 py-4">
          <p className="min-w-[180px] flex-1 text-[14.5px] font-medium text-foreground">
            {t("entry.noCoords")}
          </p>
          <Button size="sm" className="rounded-full" onClick={() => setEditing(true)}>
            {t("entry.typeThemIn")}
          </Button>
        </div>
      ) : null}

      {/* Board chip, then the achieved goals as a section of their own
          (2026-10-06, on request: board above goals; goals a full-width
          section, not a chip), then notes and media below the condition
          tiles. leading-9 makes the chip's line 36px, 8px taller than the
          28px pill, which sits 4px down (BoardChip's mt-1). */}
      {board && (
        <div className="px-6 pt-1.5 text-[13.5px] leading-9 break-words">
          <BoardChip board={board} />
        </div>
      )}

      <GoalSection achieved={achieved} />

      {session.notesHtml && (
        <div
          className="notes-html px-6 pt-3 pb-2.5 font-sans text-[15px] leading-[1.6] text-foreground"
          dangerouslySetInnerHTML={{ __html: session.notesHtml }}
        />
      )}

      {session.photos.length > 0 && (
        <div className="flex flex-wrap gap-2.5 px-6 pt-1.5 pb-1.5">
          {session.photos.map((p, i) => {
            const isVideo = p.type.startsWith("video/");
            return (
              // The whole thumbnail opens the full-screen viewer; adding and
              // removing media lives in the edit panel, so a tap here can
              // never delete anything.
              <button
                key={p.id}
                type="button"
                onClick={() => setViewing(i)}
                aria-label={t(isVideo ? "entry.viewVideo" : "entry.viewPhoto", {
                  n: i + 1,
                  total: session.photos.length,
                })}
                className={cn(
                  "relative h-24 cursor-zoom-in overflow-hidden rounded-[var(--r-tile)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isVideo ? "w-[150px]" : "w-24"
                )}
              >
                {isVideo ? (
                  <>
                    {/* #t=0.1 makes WebKit paint a first frame instead of a blank box */}
                    <video
                      src={`/api/blob/${p.id}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      className="pointer-events-none h-full w-full bg-black object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white">
                        <Play className="size-4 translate-x-px fill-current" aria-hidden />
                      </span>
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/blob/${p.id}`}
                    alt={t("entry.photoAlt", { when: fmtWhen(session.when, lang) })}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            );
          })}
          <MediaViewer
            photos={session.photos}
            index={viewing}
            onIndexChange={setViewing}
            alt={t("entry.photoAlt", { when: fmtWhen(session.when, lang) })}
          />
        </div>
      )}

      {session.example || (manual && !om) ? (
        <div className="flex flex-wrap items-center gap-2 px-6 pt-1.5 pb-4">
        {session.example && (
          <span className="rounded-full bg-[var(--warm-soft)] px-3.5 py-1 text-[11.5px] font-semibold text-warm">
            {t("entry.example")}
          </span>
        )}
        {manual && !om && (
          <span className="rounded-full bg-secondary px-3.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
            {manual.source === "swelleye" ? t("badge.swelleyeForecast") : t("badge.enteredByHand")}
          </span>
        )}
        </div>
      ) : (
        <div className="h-3" />
      )}
    </article>
  );
}

/**
 * Direction arrow and compass point, arrow sitting low on the baseline.
 * A block-level flex line with an explicit 16px height so the swell tile's
 * row and the wind tile's row are the same height in either language.
 */
function DirSub({ deg, compass }: { deg: number | null | undefined; compass: string | null | undefined }) {
  if (deg == null) return null;
  return (
    <span className="flex h-4 items-baseline gap-1 font-sans text-[11px] font-bold leading-4 text-data">
      <DirectionArrow deg={deg} className="relative top-[2px] size-3" strokeWidth={3.5} />
      {compass}
    </span>
  );
}

/** Which board the session was surfed on: the board photo in a circle on the
 *  left, its name in a pill on the right, joined by a thin stem (2026-10-06,
 *  hang-tag reference). Geometry (px): circle 30, pill 28 tall with a full
 *  semicircular left end, a 3.5px gap between them. The `Neck` SVG bridges
 *  the gap: an 11px-tall stem (~37% of the chip) with radius-3 concave
 *  fillets, each tangent to the stem and to its shape (solved from
 *  |c-f| = r+3); its ends sit as chords inside the circle and pill, so no
 *  seams. No photo: plain pill, as before. The name truncates (single line)
 *  rather than wrapping, so the chip stays 30px tall and can't push past a
 *  375px card. Inline-level, align-top + mt-[3px] to centre in the row's
 *  36px line, in its own row above the goals. */
function BoardChip({ board, className }: { board: Board; className?: string }) {
  const { t } = useLang();
  const name = boardLabel(board);
  const label = (
    <>
      {/* No visible "Board" / 衝浪板 label (removed on request) — the
          photo and name read as a board; screen readers still get it. */}
      <span className="sr-only">{t("entry.board")}</span>
      <span className="relative min-w-0 truncate text-[13.5px] font-bold leading-none tracking-[-0.01em]">{name}</span>
    </>
  );
  if (!board.photoId) {
    return (
      <span className={cn("mt-1 inline-flex h-7 max-w-full min-w-0 items-center rounded-full bg-secondary px-3 align-top", className)}>
        {label}
      </span>
    );
  }
  return (
    <span className={cn("relative mt-[3px] inline-flex h-[30px] max-w-full min-w-0 items-center align-top", className)}>
      {/* First in DOM on purpose: it is absolutely positioned, so it paints
          over any later non-positioned sibling and, at z-index auto, over
          earlier positioned ones. Being first, the `relative` photo and
          name (later, also positioned) always paint above it. */}
      <PillNeck className="absolute top-0 left-[28px]" />
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/blob/${board.photoId}`}
          alt={t("board.photoAlt", { name })}
          loading="lazy"
          className="relative size-[22px] rounded-full object-cover"
        />
      </span>
      <span className="ml-[3.5px] flex h-7 min-w-0 items-center rounded-full bg-secondary pr-3.5 pl-3">{label}</span>
    </span>
  );
}
