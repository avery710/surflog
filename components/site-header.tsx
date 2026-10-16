"use client";

import Link from "next/link";
import { AddButton } from "@/components/add-button";
import { UserMenu } from "@/components/user-menu";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import { useAutoHideHeader } from "@/lib/use-auto-hide-header";

/**
 * The blue bar on sub pages (/ai-apps, /admin) — the journal's header: wordmark
 * linking home, the log-session "+" (a link to `/?log=1`, since the form's
 * dialog only exists on the journal) and the same avatar menu. Kept visually
 * identical to the header in components/journal.tsx (same classes, same
 * auto-hide); if that one changes, change this too.
 */
export function SiteHeader({
  user,
  canManageSpots = false,
  pendingSpotRequests = 0,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  canManageSpots?: boolean;
  pendingSpotRequests?: number;
}) {
  const { t } = useLang();
  const headerRef = useAutoHideHeader<HTMLElement>();

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 bg-primary pt-[calc(env(safe-area-inset-top)_+_0.5rem)] pb-2 auto-hide-header"
    >
      <div className={`${PAGE_COLUMN} flex flex-wrap items-center justify-between gap-4`}>
        <Link href="/" className="rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-white">
          {/* White on the blue bar, as in journal.tsx. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/surflog-logo.png"
            alt="Surflog"
            width={1200}
            height={228}
            className="block h-6 w-auto brightness-0 invert"
          />
        </Link>
        <div className="flex items-center gap-2.5">
          {/* Same white circle as the journal's "+". The log form only exists
              on the journal, so here it is a link that lands there with the
              form already open (app/page.tsx reads ?log=1). */}
          <AddButton href="/?log=1" label={t("action.logSession")} />
          <UserMenu user={user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
        </div>
      </div>
    </header>
  );
}
