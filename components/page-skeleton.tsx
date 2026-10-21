"use client";

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
 * Placeholders pulse only without prefers-reduced-motion.
 */
export type PageSkeletonVariant = "journal" | "spots" | "spot" | "settings";

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
        className={`${PAGE_COLUMN} min-h-dvh min-w-0 flex-1 pb-18 ${variant === "journal" ? "" : "pt-6"}`}
        role="status"
        aria-busy="true"
      >
        <span className="sr-only">{t("page.loading")}</span>
        <div aria-hidden>{BODIES[variant]}</div>
      </div>
    </>
  );
}

/** A grey bar standing in for a line of text or a control. */
function Bar({ className }: { className: string }) {
  return <div className={`rounded-[var(--r-tile)] bg-secondary motion-safe:animate-pulse ${className}`} />;
}

/** An empty white card (the WhiteCard surface) with a heading bar and a few lines. */
function Card({ className = "", lines = 2 }: { className?: string; lines?: number }) {
  return (
    <div className={`rounded-[var(--r-card)] bg-card shadow-soft px-5 py-4 ${className}`}>
      <Bar className="h-3.5 w-24" />
      <div className="mt-4 flex flex-col gap-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} className={`h-3 ${i % 2 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/** The h1 of a sub page. */
function Title({ className = "w-40" }: { className?: string }) {
  return <Bar className={`h-7 ${className}`} />;
}

const BODIES: Record<PageSkeletonVariant, React.ReactNode> = {
  // components/journal.tsx: goal + calendar, spot table, board rack, then sessions.
  journal: (
    <>
      <div className="mt-4 sm:mt-5 flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Card className="h-36 min-w-0 flex-1" lines={2} />
          <Card className="h-36 sm:w-[220px]" lines={3} />
        </div>
        <Card className="h-44" lines={4} />
        <Card className="h-36" lines={2} />
      </div>
      <div className="mt-4 sm:mt-5">
        <Bar className="ml-1 h-3.5 w-20" />
        <div className="mt-2 flex flex-col gap-2 sm:mt-3 sm:gap-3">
          <Card className="h-56" lines={4} />
          <Card className="h-56" lines={4} />
        </div>
      </div>
    </>
  ),
  // components/spots-overview.tsx: title, then groups of spot rows.
  spots: (
    <>
      <Title />
      {[4, 3].map((rows, g) => (
        <div key={g} className="mt-6">
          <Bar className="h-3 w-16" />
          <div className="mt-2 rounded-[var(--r-card)] bg-card shadow-soft">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <Bar className="h-3.5 w-1/3" />
                <Bar className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  ),
  // components/spot-detail.tsx: name and buttons, About + reviews, your sessions.
  spot: (
    <>
      <Title className="w-48" />
      <div className="mt-3 flex gap-2">
        <Bar className="h-8 w-20 rounded-full" />
        <Bar className="h-8 w-36 rounded-full" />
      </div>
      <Card className="mt-6" lines={4} />
      <Card className="mt-4" lines={3} />
    </>
  ),
  // /ai-apps and /admin: back link, title, a section or two.
  settings: (
    <>
      <Bar className="h-3.5 w-16" />
      <Title className="mt-3 w-44" />
      <Bar className="mt-7 h-4 w-32" />
      <Card className="mt-3" lines={3} />
      <Card className="mt-3" lines={2} />
    </>
  ),
};
