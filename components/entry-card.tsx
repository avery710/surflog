"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Play, Share2, Trash2 } from "lucide-react";
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
import { ShareDialog } from "@/components/share-dialog";
import { MediaViewer } from "@/components/media-viewer";
import { cn } from "cn";
import { useSpotCatalog } from "@/lib/spot-catalog";
import { toCompass } from "@/lib/openmeteo";
import { computeSessionFit } from "@/lib/session-fit";
import { compassLabel, fmt1, fmtWhen } from "@/lib/format";
import { endOfSession } from "@/lib/time-slots";
import { useLang } from "@/lib/i18n";
import { TideChart } from "@/components/tide-chart";
import { TideEventsSub } from "@/components/tide-events";
import { pickTide } from "@/lib/tide-display";
import { DirectionArrow } from "@/components/direction-arrow";
import { WindStrength } from "@/components/wind-strength";
import { WindShoreBadge } from "@/components/wind-shore-badge";
import { GoalSection } from "@/components/goal";
import { TileGroup } from "@/components/tile-group";
import { TagLine } from "@/components/tag-line";
import { PillNeck } from "@/components/pill-neck";
import { sessionAchieved } from "@/lib/goal";
import { boardLabel, boardPhotoSrc } from "@/lib/boards";
import type { Board, Session } from "@/lib/types";

export function EntryCard({
  session,
  boards = [],
  goal = null,
  onUpdated,
  onDeleted,
  readOnly = false,
  mediaBase = "/api/blob",
  byline,
  plain = false,
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
  /** Where photos/videos load from. The public share page passes its
   *  token-scoped `/api/share/<token>/media`; `/api/blob` is owner-only. */
  mediaBase?: string;
  /** A line under the spot name and date (the share page's "Surfed by …"). */
  byline?: React.ReactNode;
  /** No border, background or inner side padding — the share page, where the
   *  card is the whole page body rather than one card in a list. */
  plain?: boolean;
}) {
  const { lang, t } = useLang();
  const [editing, setEditing] = useState(false);
  // The edit panel is much taller than the card, so closing it shrinks the
  // page under the reader and the browser's scroll anchoring lands on a
  // neighbour. After the card is back, bring it into view if it isn't.
  const articleRef = useRef<HTMLElement>(null);
  const wasEditing = useRef(false);
  useLayoutEffect(() => {
    const was = wasEditing.current;
    wasEditing.current = editing;
    const el = articleRef.current;
    if (!was || editing || !el) return;
    const top = el.getBoundingClientRect().top;
    // clear of the sticky header (96 px) and not pushed off the bottom
    if (top < 96 || top > window.innerHeight - 120) {
      window.scrollTo({ top: window.scrollY + top - 96, behavior: "instant" });
    }
  }, [editing]);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Which photo/video is open full-screen (index into session.photos), or null.
  // The cell that opened the viewer, so focus can go back to it on close.
  const openerRef = useRef<HTMLElement | null>(null);
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
  const hasTemp = om?.seaTempC != null || om?.airTempC != null;
  const board = session.boardId ? boards.find((b) => b.id === session.boardId) : undefined;
  const achieved = sessionAchieved(session);
  const manual = session.cond;
  const hasShore = !!fit && !fit.missing.includes("windDirDeg") && !fit.missing.includes("spot.facing");
  // CWA's tide forecast wins whenever it covers the session (accurate to
  // ~10 min against real references; Open-Meteo's offshore grid node runs
  // 20-65 min off — see CLAUDE.md "CWA tide forecast", 2026-09-28). The
  // choice and the rising/falling headline live in lib/tide-display.ts so
  // the share images and public page read the same thing.
  const { source: tideSource, events: tideEvents, trend: tideTrendValue } = pickTide(session);
  const trendHeadline = (trend: "rising" | "falling" | null) =>
    trend ? <Figure value={<span className="capitalize">{t(trend === "rising" ? "tide.rising" : "tide.falling")}</span>} /> : null;

  const cardClass = plain
    ? // every section's px-4 sm:px-6 (and the header's top padding) dropped from the outside
      "overflow-hidden [&>*]:px-0! [&>*:first-child]:pt-0!"
    : "mt-2 sm:mt-3 overflow-hidden rounded-[var(--r-card)] surface-card";

  if (editing) {
    return (
      <article ref={articleRef} className={cardClass}>
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

  const sideBySide = !!om && (session.photos.length === 1 || session.photos.length === 2);
  const tileGroupClass = sideBySide
    ? "grid grid-cols-3 gap-2 sm:min-w-0 sm:flex-[3]"
    : "grid grid-cols-3 gap-2 sm:flex sm:flex-nowrap sm:items-stretch sm:overflow-x-auto [scrollbar-width:none] px-4 sm:px-6 pt-3 pb-1.5";
  const mosaic = (fill: boolean) => (
    <MediaMosaic
      photos={session.photos}
      mediaBase={mediaBase}
      alt={t("entry.photoAlt", { when: fmtWhen(session.when, lang, session.durationMin) })}
      label={(i, isVideo) =>
        t(isVideo ? "entry.viewVideo" : "entry.viewPhoto", { n: i + 1, total: session.photos.length })
      }
      moreLabel={(n) => t("entry.moreMedia", { n })}
      onOpen={(i, el) => {
        openerRef.current = el;
        setViewing(i);
      }}
      fill={fill}
    />
  );
  const omTiles = om ? (
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
        <TileGroup className={tileGroupClass}>
          {om && (
            <>
              <ConditionTile
                label={t("tile.swellOpenMeteo")}
                className={`${om.swellPeriodS == null ? "col-span-2" : ""} sm:flex-1 sm:basis-0 sm:shrink`}
                value={<Figure value={fmt1(om.swellHeightMedianM ?? om.swellHeightM)} unit="m" />}
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
                      <TideChart events={tideEvents} sessionWhen={session.when} sessionEnd={endOfSession(session.when, session.durationMin)} />
                    ) : (
                      <TideEventsSub events={tideEvents} sessionWhen={session.when} />
                    )
                  }
                />
              )}
            </>
          )}
        </TileGroup>
  ) : null;

  return (
    <article ref={articleRef} className={cardClass}>
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
      <div className="flex items-start gap-2 px-4 sm:px-6 pt-3 sm:pt-4 pb-2">
        <div className="flex min-h-10 min-w-0 flex-1 flex-wrap content-center items-baseline gap-x-3 gap-y-1.5">
          <span className="min-w-0 text-[21px] font-bold tracking-[-0.02em] leading-tight break-words">
            {catalog.label(session.spot, lang)}
          </span>
          <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
            {fmtWhen(session.when, lang, session.durationMin)}
          </span>
          {byline && <div className="basis-full">{byline}</div>}
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
            <DropdownMenuItem onSelect={() => setShareOpen(true)}>
              <Share2 />
              {t("entry.share")}
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

      {!readOnly && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          sessionId={session.id}
          fileStem={session.when.slice(0, 10)}
          available={{
            datetime: true,
            waves: !!(session.condOpenMeteo || session.cond || session.condCwaTide),
            board: !!board,
            log: !!(session.notes?.trim() || session.notesHtml?.replace(/<[^>]*>|&nbsp;/g, "").trim()),
          }}
          hasPhoto={session.photos.some((p) => p.type.startsWith("image/"))}
        />
      )}

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
                when: fmtWhen(session.when, lang, session.durationMin),
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

      {/* Order (2026-10-16, on request): header / board chip + goal pills (one
          row if they fit) / notes / condition tiles / media. leading-9 makes the chip's line
          36px, 8px taller than the 28px pill, which sits 4px down
          (BoardChip's mt-1), so the chip needs no top padding under the
          header; GoalSection brings its own mt-1.5/mb-0.5. The notes get pt-2
          after a chip or goals, pt-1 straight after the header; the tiles
          bring their own pt-3. */}
      {(board || achieved.length > 0) && (
        // Chip and goals share one row when they fit, else the goals (as a
        // whole group, never split) drop under the chip. Pure CSS: a flex-wrap
        // row wraps an item as a whole when its max-content width doesn't fit
        // beside the previous one; a wrapped goals group then shrinks to the
        // row and wraps its own pills. Gap 8px across, ~8px down (the chip's
        // 36px line already leaves 4px under its pill). No stem joins the two.
        <div className="mx-4 sm:mx-6 mb-0.5 flex flex-wrap items-start gap-x-2 gap-y-0.5">
          {board && (
            <div className="max-w-full min-w-0 text-[13.5px] leading-9 break-words">
              <BoardChip board={board} />
            </div>
          )}
          <GoalSection achieved={achieved} inline />
        </div>
      )}

      {session.notesHtml && (
        <div
          className={`notes-html px-4 sm:px-6 ${board || achieved.length > 0 ? "pt-2" : "pt-1"} pb-0 font-sans text-[15px] leading-[1.6] text-foreground`}
          dangerouslySetInnerHTML={{ __html: session.notesHtml }}
        />
      )}

      {session.tags?.length ? (
        // one quiet line under the notes (design chosen 2026-10-23, /dev/tags)
        <div className={`px-4 sm:px-6 ${session.notesHtml || board || achieved.length > 0 ? "pt-2" : "pt-1"}`}>
          <TagLine tags={session.tags} lang={lang} label={t("entry.tags")} />
        </div>
      ) : null}

      {sideBySide ? (
        // One or two media items next to the tiles (sm and up): the tiles keep the
        // phone's 3-column arrangement in ~60% of the row, the media fills the
        // rest at the tile block's height, cover-cropped. Stacked on phones.
        <div className="flex flex-col gap-2 px-4 sm:px-6 pt-3 pb-1.5 sm:flex-row sm:items-stretch">
          {omTiles}
          <div className={`relative w-full max-h-[260px] sm:aspect-auto sm:min-w-0 sm:flex-[2] ${session.photos.length === 2 ? "aspect-[2/1]" : "aspect-video"}`}>{mosaic(true)}</div>
        </div>
      ) : (
        omTiles
      )}

      {/* Open-Meteo wins where both exist: the typed Swelleye swell/wind
          duplicates its tiles, so it's stored but not shown (and only
          shown when Open-Meteo has nothing for the session). */}
      {manual && om ? null : manual ? (
        <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:auto-cols-[minmax(0,1fr)] md:grid-cols-none lg:flex lg:overflow-x-auto [scrollbar-width:none] px-4 sm:px-6 pt-3 pb-1.5">
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
        <div className="mx-4 sm:mx-6 mb-2 mt-0.5 flex flex-wrap items-center gap-3 rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4.5 py-4">
          <p className="min-w-[180px] flex-1 text-[14.5px] font-medium text-foreground">
            {t("entry.noCoords")}
          </p>
          <Button size="sm" className="rounded-full" onClick={() => setEditing(true)}>
            {t("entry.typeThemIn")}
          </Button>
        </div>
      ) : null}

      {/* Media mosaic under the conditions (2026-10-16, Strava-style: the
          tiles are the "map", the photos a grid directly beneath at the same
          width, 4px gaps, no backgrounds). 1: one 16:9; 2: halves; 3: three
          squares; 4: 2x2; 5+: one big cell and a 2x2 on the right, the fifth
          cell dimmed with "+N" when there are more. Same on every width. */}
      {session.photos.length > 0 && (
        <>
          {!sideBySide && <div className="px-4 sm:px-6 pt-1.5 pb-1.5">{mosaic(false)}</div>}
          <MediaViewer
            photos={session.photos}
            index={viewing}
            onIndexChange={setViewing}
            mediaBase={mediaBase}
            returnFocusRef={openerRef}
            alt={t("entry.photoAlt", { when: fmtWhen(session.when, lang, session.durationMin) })}
          />
        </>
      )}

      {session.example || (manual && !om) ? (
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 pt-1.5 pb-4">
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
      {/* leading-5, not leading-none: truncate clips overflow, and a 13.5px line box cut off the g and y descenders */}
      <span className="relative min-w-0 truncate text-[13.5px] font-medium leading-5 tracking-[-0.01em]">{name}</span>
    </>
  );
  const photoSrc = boardPhotoSrc(board);
  if (!photoSrc) {
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
          src={photoSrc}
          alt={t("board.photoAlt", { name })}
          loading="lazy"
          className="relative size-[22px] rounded-full object-cover"
        />
      </span>
      <span className="ml-[3.5px] flex h-7 min-w-0 items-center rounded-full bg-secondary pr-3.5 pl-3">{label}</span>
    </span>
  );
}

/** Strava-style photo/video mosaic; see the call site for the layouts. */
function MediaMosaic({
  photos,
  mediaBase,
  alt,
  label,
  moreLabel,
  onOpen,
  fill = false,
}: {
  photos: Session["photos"];
  mediaBase: string;
  alt: string;
  label: (i: number, isVideo: boolean) => string;
  moreLabel: (n: number) => string;
  onOpen: (i: number, el: HTMLElement) => void;
  /** One item beside the tiles: fill the parent's height instead of 16:9. */
  fill?: boolean;
}) {
  const n = photos.length;
  const cell = (i: number, className: string) => {
    const p = photos[i];
    const isVideo = p.type.startsWith("video/");
    const extra = i === 4 && n > 5 ? n - 5 : 0;
    return (
      <button
        key={p.id}
        type="button"
        onClick={(e) => onOpen(i, e.currentTarget)}
        aria-label={label(i, isVideo)}
        className={cn(
          "relative min-h-0 min-w-0 cursor-zoom-in overflow-hidden rounded-[var(--r-tile)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        {isVideo ? (
          <>
            {/* #t=0.1 makes WebKit paint a first frame instead of a blank box */}
            <video
              src={`${mediaBase}/${p.id}#t=0.1`}
              muted
              playsInline
              preload="metadata"
              className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover"
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
            src={`${mediaBase}/${p.id}`}
            alt={alt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {extra > 0 && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 font-mono text-lg font-medium text-white">
            {moreLabel(extra)}
          </span>
        )}
      </button>
    );
  };

  if (n === 1) return <div className={fill ? "absolute inset-0 grid grid-cols-1" : "grid aspect-video w-full max-h-[260px] grid-cols-1"}>{cell(0, "")}</div>;
  if (n === 2) return <div className={fill ? "absolute inset-0 grid grid-cols-2 gap-2" : "grid aspect-[2/1] w-full max-h-[260px] grid-cols-2 gap-2"}>{[0, 1].map((i) => cell(i, ""))}</div>;
  if (n === 3) return <div className="grid aspect-[3/1] w-full max-h-[260px] grid-cols-3 gap-2">{[0, 1, 2].map((i) => cell(i, ""))}</div>;
  if (n === 4)
    return <div className="grid aspect-[2/1] w-full max-h-[260px] grid-cols-2 grid-rows-2 gap-2">{[0, 1, 2, 3].map((i) => cell(i, ""))}</div>;
  return (
    <div className="grid aspect-[2/1] w-full max-h-[260px] grid-cols-2 gap-2">
      {cell(0, "")}
      <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-2">{[1, 2, 3, 4].map((i) => cell(i, ""))}</div>
    </div>
  );
}
