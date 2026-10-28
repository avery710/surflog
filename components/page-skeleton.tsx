"use client";

import { cn } from "cn";
import { LogIcon } from "@/components/add-button";
import { PillNeck } from "@/components/pill-neck";
import { TileGroup } from "@/components/tile-group";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";

/**
 * What a signed-in page shows while its server render is still on the way
 * (2026-10-21, page switches felt frozen): the blue header as it will look,
 * then grey placeholders. Used by the routes' loading.tsx files, which
 * Next.js prefetches for every visible <Link>, so a click changes the screen
 * at once; and by app/page.tsx's own Suspense fallback for the journal (a
 * loading.tsx there would also cover the signed-out landing and every route
 * under "/").
 *
 * Each page's skeleton follows its real layout and card style (shadow cards
 * on the journal and spot page, bordered boxes on /ai-apps and /admin), but
 * with one set of thin pill bars everywhere (14 px headings, 12 px lines) and
 * identical 24 px controls (Avery, 2026-10-21/23: "align the heights, or
 * ignore some details"). Pixel-matching was tried and looked busy, so the
 * page still jumps a little when it arrives. The header copies
 * components/site-header.tsx and journal.tsx (same classes, same 40 px "+"
 * and avatar circles) so it never moves; only the avatar fills in.
 *
 * The body fades in after 120 ms so a fast load never flashes it, and the bars
 * pulse; both only without prefers-reduced-motion (`.skeleton-body`,
 * `.skeleton-bar` in globals.css). The real page then fades in (`.page-enter`
 * on each page column).
 */
export type PageSkeletonVariant = "journal" | "spots" | "spot" | "aiApps" | "admin" | "roadmap";

/** Who is signed in, as far as the header's avatar needs. */
export type SkeletonUser = { name?: string | null; email?: string | null; image?: string | null };

/** The profile button as `UserMenu` draws it (same size, photo or initial), not
 *  clickable; without a user it is a plain translucent circle. */
function LoadingAvatar({ user }: { user?: SkeletonUser }) {
  if (!user) return <span className="size-10 shrink-0 rounded-full bg-black/10" />;
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-full rounded-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center rounded-full bg-badge text-[13px] font-bold text-badge-foreground">
          {initial}
        </span>
      )}
    </span>
  );
}

/** The blue header as it will look. */
export function LoadingHeader({ user }: { user?: SkeletonUser }) {
  return (
    <header className="sticky top-0 z-30 glass-bar pt-[calc(env(safe-area-inset-top)_+_0.5rem)] pb-2">
      <div className={PAGE_COLUMN}>
<div className="flex items-center justify-between gap-4 py-1.5">
        <div className="py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/surflog-logo.png"
            alt="Surflog"
            width={1200}
            height={228}
            className="block h-6 w-auto"
          />
        </div>
        <div className="flex items-center gap-2.5" aria-hidden>
          <span className="ab">
            <LogIcon className="size-4" />
          </span>
          <LoadingAvatar user={user} />
        </div>
      </div>
</div>
    </header>
  );
}

export function PageSkeleton({ variant, user }: { variant: PageSkeletonVariant; user?: SkeletonUser }) {
  const { t } = useLang();
  return (
    <>
      <LoadingHeader user={user} />
      <div
        className={`${PAGE_COLUMN} min-w-0 flex-1 pb-18 ${variant === "journal" ? "" : "pt-6"}`}
        role="status"
        aria-busy="true"
      >
        <span className="sr-only">{t("page.loading")}</span>
        <div aria-hidden className="skeleton-body">
          {BODIES[variant]}
        </div>
      </div>
    </>
  );
}

/** A grey bar standing in for a line of text or a control: black at 7%
 *  (#ededed on white), dark enough to read on a white card, with both ends
 *  fully rounded (Avery, 2026-10-23). */
function Bar({ className }: { className: string }) {
  return <div className={cn("skeleton-bar rounded-full bg-foreground/[0.07]", className)} />;
}

/** A line standing in for a heading (14 px) or text (12 px) is a <Bar>; this is
 *  a control (a button or tile): 24 px high, the real buttons' corners. */
function Ctl({ className = "w-20" }: { className?: string }) {
  return <Bar className={cn("h-6 shrink-0 rounded-lg", className)} />;
}

/** Heading + lines, stacked like the text inside a card. */
function Lines({ heading = "w-24", lines = ["w-full", "w-2/3"], className = "" }: { heading?: string; lines?: string[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <Bar className={cn("h-3.5", heading)} />
      {lines.map((w, i) => (
        <Bar key={i} className={cn("h-3", w)} />
      ))}
    </div>
  );
}

/** The white shadow card of the journal and the spot page (the WhiteCard
 *  surface, without its height easing). */
function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--r-card)] surface-card px-5 py-4", className)}>
      {children}
    </div>
  );
}

/** A heading line with a control at the right (card or section header). */
function HeaderRow({ heading = "w-32", ctl, className = "" }: { heading?: string; ctl?: string; className?: string }) {
  return (
    <div className={cn("flex h-6 items-center justify-between gap-3", className)}>
      <Bar className={cn("h-3.5", heading)} />
      {ctl && <Ctl className={ctl} />}
    </div>
  );
}

/** The "← Back" link atop every sub page (a 24 px line box). */
const BackLink = () => (
  <div className="flex h-6 items-center">
    <Bar className="h-3.5 w-24" />
  </div>
);

/** Page title (heading bar, and optionally a sub line) with controls at the right. */
function TitleRow({ sub = true, ctls = [] }: { sub?: boolean; ctls?: string[] }) {
  return (
    <div className="mt-3 flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex flex-col gap-2.5">
        <Bar className="h-3.5 w-40" />
        {sub && <Bar className="h-3 w-64 max-w-full" />}
      </div>
      <div className="flex shrink-0 gap-2">
        {ctls.map((w, i) => (
          <Ctl key={i} className={w} />
        ))}
      </div>
    </div>
  );
}

/** A session card (components/entry-card.tsx), also shown by SessionList while
 *  a filter's first page loads: header, the board chip (photo
 *  circle + stem + name pill) and a goal pill, notes, then five condition
 *  tiles joined by stems. The chip and the tile group reuse the real PillNeck
 *  and TileGroup, so their shapes and stems are the real card's. They are
 *  `bg-secondary` like the real ones (which is also the neck's fill), with
 *  `--secondary` set to the bars' grey (#ededed, black at 7% on white) so
 *  chips, tiles and stems match the lines in the card (Avery, 2026-10-23);
 *  each group pulses as one piece. */
export function SessionCardSkeleton() {
  return (
    <Panel className="mt-2 px-4 sm:mt-3 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <Lines heading="w-28" lines={["w-36"]} />
        <Bar className="size-6" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="skeleton-bar [--secondary:#ededed] relative inline-flex h-[30px] items-center">
          <PillNeck className="absolute top-0 left-[28px]" />
          <span className="size-[30px] shrink-0 rounded-full bg-secondary" />
          <span className="ml-[3.5px] h-7 w-28 rounded-full bg-secondary" />
        </span>
        <span className="skeleton-bar h-7 w-24 rounded-full bg-secondary [--secondary:#ededed]" />
      </div>
      <Lines className="mt-4" heading="w-full" lines={["w-2/3"]} />
      <TileGroup className="skeleton-bar [--secondary:#ededed] mt-4 grid grid-cols-3 gap-2 sm:flex">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} data-tile className="relative h-14 rounded-[var(--r-tile)] bg-secondary sm:flex-1" />
        ))}
      </TileGroup>
    </Panel>
  );
}

/** A bordered list row (spots, admin): name and a line, a control at the right. */
function ListRow({ ctl = "w-14" }: { ctl?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-card-border px-4 py-3 last:border-b-0">
      <Lines className="min-w-0 flex-1" heading="w-32" lines={["w-56 max-w-full"]} />
      <Ctl className={ctl} />
    </div>
  );
}

const BODIES: Record<PageSkeletonVariant, React.ReactNode> = {
  // components/journal.tsx: goal | calendar (+ last session on phones), the
  // spot table, the board rack, then the Sessions title with its filter chips.
  journal: (
    <>
      <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
          <Panel className="sm:flex-1">
            <Lines heading="w-40" lines={["w-3/4", "w-1/2", "w-2/3"]} />
          </Panel>
          <div className="flex gap-2 sm:gap-3">
            <Panel className="w-[194px] shrink-0 sm:w-[234px]">
              <Lines heading="w-24" lines={["w-full", "w-full", "w-full"]} />
            </Panel>
            <Panel className="min-w-0 flex-1 px-3 sm:hidden">
              <Lines heading="w-16" lines={["w-full", "w-2/3"]} />
            </Panel>
          </div>
        </div>
        <Panel>
          <Bar className="h-3.5 w-40" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Bar className="h-3.5 w-28" />
                <Bar className="h-3 w-8" />
                <Bar className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <HeaderRow heading="w-28" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                <Bar className="size-12 rounded-lg bg-foreground/[0.07]" />
                <Lines heading="w-24" lines={["w-32"]} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-4 sm:mt-5">
        <div className="flex h-8 items-center justify-between gap-3">
          <Bar className="h-3.5 w-16" />
          <div className="flex gap-2.5">
            {Array.from({ length: 3 }, (_, i) => (
              <Bar key={i} className="size-7" />
            ))}
          </div>
        </div>
        <SessionCardSkeleton />
        <SessionCardSkeleton />
      </div>
    </>
  ),
  // components/spots-overview.tsx: back, title + "Add spot", intro, search,
  // count, then groups of spot rows in a shadow list.
  spots: (
    <>
      <BackLink />
      <TitleRow sub={false} ctls={["w-24"]} />
      <div className="mt-2 flex max-w-prose flex-col gap-2.5">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-1/2" />
      </div>
      <div className="mt-5 flex h-11 items-center gap-2 rounded-full border border-input surface-fill px-4">
        <Bar className="size-4" />
        <Bar className="h-3 w-24" />
      </div>
      <Bar className="mt-4 h-3 w-16" />
      {[1, 4].map((rows, g) => (
        <div key={g} className="mt-6">
          <Bar className="h-3.5 w-20" />
          <div className="mt-2 overflow-hidden rounded-[var(--r-tile)] surface-card">
            {Array.from({ length: rows }, (_, i) => (
              <ListRow key={i} ctl="size-6 w-6 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </>
  ),
  // components/spot-detail.tsx: back, name + place with Pin / "Log a session
  // here", the About card (facts, reviews), then your sessions here.
  spot: (
    <>
      <BackLink />
      <TitleRow ctls={["w-16", "w-32"]} />
      <Panel className="mt-6">
        <HeaderRow heading="w-16" ctl="w-24" />
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Lines key={i} heading="w-16" lines={["w-24"]} />
          ))}
        </div>
        <div className="mt-5 border-t border-card-border pt-4">
          <Bar className="h-3.5 w-20" />
          <div className="mt-3 flex flex-col gap-4">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Bar className="size-6" />
                <Lines className="flex-1" heading="w-28" lines={["w-2/3"]} />
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel className="mt-4">
        <Bar className="h-3.5 w-32" />
        <Lines className="mt-4" heading="w-20" lines={["w-full", "w-2/3"]} />
        <div className="mt-4 flex flex-col divide-y divide-card-border">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <Lines heading="w-28" lines={["w-48 max-w-full"]} />
              <Bar className="h-3 w-12" />
            </div>
          ))}
        </div>
      </Panel>
    </>
  ),
  // components/api-tokens.tsx: the bordered "connect an AI app" box with its
  // four tile buttons, then the connected apps as bordered rows.
  aiApps: (
    <>
      <BackLink />
      <div className="mt-3 flex h-8 items-center">
        <Bar className="h-3.5 w-32" />
      </div>
      <div className="mt-2 flex flex-col gap-2.5">
        <Bar className="h-3 w-full max-w-[520px]" />
        <Bar className="h-3 w-1/2" />
      </div>
      <div className="mt-5 rounded-[var(--r-card)] surface-card p-4">
        <Bar className="h-3.5 w-40" />
        <Bar className="mt-3 h-3 w-64 max-w-full" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Ctl key={i} />
          ))}
        </div>
      </div>
      <div className="mt-7 flex h-6 items-center">
        <Bar className="h-3.5 w-20" />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[var(--r-card)] surface-card px-3.5 py-3">
            <Lines className="min-w-0 flex-1" heading="w-40 max-w-full" lines={["w-56 max-w-full"]} />
            <Ctl className="w-14" />
          </div>
        ))}
      </div>
    </>
  ),
  // components/admin/spots-admin.tsx: back, title, the requests section, then
  // the catalogue with its add button, search field and bordered lists.
  // components/roadmap.tsx: the level list (a row on phones, a column from
  // sm), then the level's heading and its skill blocks.
  roadmap: (
    <>
      <BackLink />
      <TitleRow sub={false} />
      <div className="mt-4 sm:grid sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
        <div className="flex gap-1 sm:flex-col">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-1 items-center justify-center gap-2 py-2 sm:flex-none sm:justify-start sm:px-2.5">
              <Bar className="size-6" />
              <Bar className="hidden h-3 w-20 sm:block" />
            </div>
          ))}
        </div>
        <div className="mt-3 min-w-0 sm:mt-0">
          <Lines heading="w-40" lines={["w-64 max-w-full", "w-48"]} />
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Panel key={i} className="px-3 py-3">
                <HeaderRow heading="w-36" ctl="w-16" />
              </Panel>
            ))}
          </div>
        </div>
      </div>
    </>
  ),
  admin: (
    <>
      <BackLink />
      <div className="mt-3 flex h-8 items-center">
        <Bar className="h-3.5 w-28" />
      </div>
      <div className="mt-7 flex h-6 items-center">
        <Bar className="h-3.5 w-36" />
      </div>
      <Bar className="mt-3 h-3 w-48" />
      <Bar className="mt-4 h-3 w-40" />
      <HeaderRow heading="w-20" ctl="w-24" className="mt-9" />
      <div className="mt-3 flex h-8 items-center rounded-lg border surface-fill px-3">
        <Bar className="h-3 w-24" />
      </div>
      <Bar className="mt-5 h-3.5 w-24" />
      <div className="mt-2 overflow-hidden rounded-[var(--r-card)] surface-card">
        {Array.from({ length: 5 }, (_, i) => (
          <ListRow key={i} />
        ))}
      </div>
    </>
  ),
};
