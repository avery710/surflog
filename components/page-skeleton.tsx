"use client";

import { cn } from "cn";
import { LogIcon } from "@/components/add-button";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";

/**
 * What a signed-in page shows while its server render is still on the way
 * (2026-10-21, page switches felt frozen): the blue header as it will look,
 * then grey placeholders in the page's own layout. Used by the routes'
 * loading.tsx files, which Next.js prefetches for every visible <Link>, so a
 * click changes the screen at once; and by app/page.tsx's own Suspense
 * fallback for the journal (a loading.tsx there would also cover the
 * signed-out landing and every route under "/").
 *
 * The header copies components/site-header.tsx and journal.tsx (same classes,
 * same 40 px "+" and avatar circles) so nothing moves when the real one
 * arrives; only the avatar fills in. No auto-hide: it is on screen briefly.
 *
 * Each body follows its page's real structure (same margins, same heights,
 * measured at 358 and 1100 px on 2026-10-21), so the page doesn't jump when it
 * arrives. Heights that depend on data (goal, spot table, rack, session
 * cards) are set to Avery's journal. The body fades in after 120 ms so a fast
 * load never flashes it, and the bars pulse; both only without
 * prefers-reduced-motion (`.skeleton-body`, `.skeleton-bar` in globals.css).
 * The real page then fades in (`.page-enter` on each page column).
 */
export type PageSkeletonVariant = "journal" | "spots" | "spot" | "aiApps" | "admin";

export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  const { t } = useLang();
  return (
    <>
      <header className="sticky top-0 z-30 bg-primary pt-[calc(env(safe-area-inset-top)_+_0.5rem)] pb-2">
        <div className={`${PAGE_COLUMN} flex flex-wrap items-center justify-between gap-4`}>
          <div className="py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/surflog-logo.png"
              alt="Surflog"
              width={1200}
              height={228}
              className="block h-6 w-auto brightness-0 invert"
            />
          </div>
          <div className="flex items-center gap-2.5" aria-hidden>
            <span className="ab">
              <LogIcon className="size-4" />
            </span>
            <span className="size-10 shrink-0 rounded-full bg-white/25" />
          </div>
        </div>
      </header>
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
 *  (#ededed on white), dark enough to read on a white card. */
function Bar({ className }: { className: string }) {
  return <div className={cn("skeleton-bar rounded-[var(--r-tile)] bg-foreground/[0.07]", className)} />;
}

/** A bar centred in a line box of the real text's height, so the next block
 *  starts where it will on the real page. */
function Line({ box = "h-5", className }: { box?: string; className: string }) {
  return (
    <div className={`flex items-center ${box}`}>
      <Bar className={className} />
    </div>
  );
}

/** An empty white card (the WhiteCard surface, without its height easing,
 *  which a placeholder never needs) with a heading bar and a few lines. */
function Card({ className = "", lines = 2 }: { className?: string; lines?: number }) {
  return (
    <div className={`overflow-hidden rounded-[var(--r-card)] bg-card shadow-soft px-5 py-4 ${className}`}>
      <Line className="h-3.5 w-24" />
      <div className="mt-3 flex flex-col gap-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} className={`h-3 ${i % 2 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/** The "← Back" link atop every sub page (a 24 px line box). */
const BackLink = () => <Line box="h-6" className="h-3.5 w-24" />;

/** One session card (components/entry-card.tsx): header, board chip, notes,
 *  five condition tiles (3 columns below sm, one row from sm). */
function SessionCard() {
  return (
    <div className="mt-2 rounded-[var(--r-card)] bg-card pb-3 shadow-soft sm:mt-3">
      <div className="flex h-[60px] items-start justify-between gap-3 px-4 pt-4 sm:h-16 sm:px-6">
        <div className="flex flex-col gap-2">
          <Bar className="h-4 w-28" />
          <Bar className="h-3 w-36" />
        </div>
        <Bar className="size-6 rounded-full" />
      </div>
      <div className="mx-4 flex h-9 items-center sm:mx-6">
        <Bar className="h-7 w-40 rounded-full" />
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-3 sm:px-6">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-2/3" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 px-4 sm:flex sm:px-6">
        {Array.from({ length: 5 }, (_, i) => (
          <Bar key={i} className="h-[84px] sm:flex-1" />
        ))}
      </div>
    </div>
  );
}

/** A spot row on /spots (components/spots-overview.tsx): name, reviews, facts. */
function SpotRow() {
  return (
    <div className="border-b border-card-border px-4 py-3 last:border-b-0">
      <div className="flex h-6 items-center gap-2">
        <Bar className="h-3.5 w-28" />
        <Bar className="h-3 w-10" />
      </div>
      <Line box="mt-1 h-[22px]" className="h-3 w-32" />
      <Line box="mt-1.5 h-[19px]" className="h-3 w-3/4" />
      {/* the facts wrap onto a second line on phones */}
      <Line box="mt-1 h-[19px] sm:hidden" className="h-3 w-1/2" />
    </div>
  );
}

const BODIES: Record<PageSkeletonVariant, React.ReactNode> = {
  // components/journal.tsx: goal + calendar (+ last session on phones), spot
  // table, board rack, then the Sessions title with its filter chips.
  journal: (
    <>
      <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:gap-3">
        <Card className="h-[180px] min-w-0 sm:h-[184px] sm:flex-1" lines={3} />
        <div className="flex gap-2 sm:shrink-0">
          <Card className="h-[136px] w-[194px] shrink-0 sm:h-[184px] sm:w-[234px]" lines={3} />
          <Card className="h-[136px] min-w-0 flex-1 px-3 sm:hidden" lines={2} />
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:mt-3 sm:gap-3">
        <Card className="h-[240px] sm:h-[117px]" lines={3} />
        <Card className="h-[244px] sm:h-[156px]" lines={3} />
      </div>
      <div className="mt-4 sm:mt-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <Line box="h-5 pl-1 lg:h-8" className="h-3.5 w-16" />
          <div className="mt-1.5 flex h-8 items-center gap-2.5 lg:mt-0">
            {Array.from({ length: 3 }, (_, i) => (
              <Bar key={i} className="size-7 rounded-full" />
            ))}
          </div>
        </div>
        <SessionCard />
        <SessionCard />
      </div>
    </>
  ),
  // components/spots-overview.tsx: back, title + "Add spot", intro, search,
  // count, then groups of spot rows.
  spots: (
    <>
      <BackLink />
      <div className="mt-3 flex items-center justify-between gap-4">
        <Line box="h-8" className="h-6 w-36" />
        <Bar className="h-8 w-28 rounded-full" />
      </div>
      <div className="mt-2 max-w-prose">
        <Line className="h-3 w-full" />
        <Line box="h-5 sm:hidden" className="h-3 w-1/2" />
      </div>
      <div className="mt-5 flex h-11 items-center gap-2 rounded-full border border-input bg-card px-4">
        <Bar className="size-4 rounded-full" />
        <Bar className="h-3 w-24" />
      </div>
      <Line box="mt-3 h-[19px]" className="h-3 w-16" />
      {[1, 4].map((rows, g) => (
        <div key={g} className="mt-6">
          <Line box="h-4" className="h-3 w-20" />
          <div className="mt-1.5 overflow-hidden rounded-[var(--r-tile)] bg-card shadow-soft">
            {Array.from({ length: rows }, (_, i) => (
              <SpotRow key={i} />
            ))}
          </div>
        </div>
      ))}
    </>
  ),
  // components/spot-detail.tsx: back, name + place, Pin and "Log a session
  // here" (below the name on phones), About + reviews, your sessions.
  spot: (
    <>
      <BackLink />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <Line box="h-8" className="h-6 w-40" />
          <Line box="mt-0.5 h-5" className="h-3 w-32" />
        </div>
        <div className="flex gap-2">
          <Bar className="h-10 w-[99px] rounded-full" />
          <Bar className="h-10 w-[173px] rounded-full" />
        </div>
      </div>
      <Card className="mt-6 h-[421px] sm:h-[303px]" lines={5} />
      <Card className="mt-4 h-[520px]" lines={4} />
    </>
  ),
  // components/api-tokens.tsx: back, title, intro, the bordered "connect an
  // AI app" box with its four tiles, then the connected list.
  aiApps: (
    <>
      <BackLink />
      <Line box="mt-3 h-8" className="h-6 w-32" />
      <div className="mt-2 max-w-prose">
        <Line className="h-3 w-full" />
        <Line className="h-3 w-5/6" />
        <Line box="h-5 sm:hidden" className="h-3 w-1/3" />
      </div>
      <div className="mt-5 rounded-[var(--r-card)] border bg-card p-4">
        <Line box="h-6" className="h-4 w-40" />
        <Line box="mt-1 h-5" className="h-3 w-56 max-w-full" />
        <div className="mt-3 flex flex-wrap gap-2">
          {["w-[88px]", "w-[100px]", "w-[89px]", "w-[65px]"].map((w) => (
            <Bar key={w} className={`h-8 rounded-lg ${w}`} />
          ))}
        </div>
      </div>
      <Line box="mt-7 h-6" className="h-4 w-20" />
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex h-[83px] items-center gap-3 rounded-[var(--r-tile)] border bg-card px-3.5 sm:h-[65px]"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Bar className="h-3.5 w-40 max-w-full" />
              <Bar className="h-3 w-56 max-w-full" />
            </div>
            <Bar className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </>
  ),
  // components/admin/spots-admin.tsx: back, title, requests, then the
  // catalogue with its add button, search and bordered lists.
  admin: (
    <>
      <BackLink />
      <Line box="mt-3 h-8" className="h-6 w-28" />
      <Line box="mt-7 h-6" className="h-4 w-36" />
      <Line box="mt-2 h-5" className="h-3 w-48" />
      <Line box="mt-4 h-5" className="h-3 w-40" />
      <div className="mt-9 flex h-8 items-center justify-between gap-3">
        <Bar className="h-4 w-16" />
        <Bar className="h-8 w-28 rounded-full" />
      </div>
      <div className="mt-3 h-8 rounded-lg border bg-card" />
      <Line box="mt-5 h-4" className="h-3 w-24" />
      <div className="mt-1.5 overflow-hidden rounded-[var(--r-tile)] border bg-card">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 border-b px-3.5 py-3 last:border-b-0">
            <Bar className="h-3.5 w-32" />
            <Bar className="h-3 w-48 max-w-full" />
          </div>
        ))}
      </div>
    </>
  ),
};
