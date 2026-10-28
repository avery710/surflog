"use client";

import Link from "next/link";
import { AddButton } from "@/components/add-button";
import { GlobalLogDialog, openLogDialog } from "@/components/global-log-dialog";
import { UserMenu } from "@/components/user-menu";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import { useAutoHideHeader } from "@/lib/use-auto-hide-header";

/**
 * The blue bar on sub pages (/ai-apps, /admin) — the journal's header: wordmark
 * linking home, the log-session "+" (opens the log dialog in place) and the same avatar menu. Kept visually
 * identical to the header in components/journal.tsx (same classes, same
 * auto-hide); if that one changes, change this too.
 */
export function SiteHeader({
  user,
  canManageSpots = false,
  pendingSpotRequests = 0,
}: {
  user: { id?: string; name?: string | null; email?: string | null; image?: string | null };
  canManageSpots?: boolean;
  pendingSpotRequests?: number;
}) {
  const { t } = useLang();
  const headerRef = useAutoHideHeader<HTMLElement>();

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 glass-bar pt-[calc(env(safe-area-inset-top)_+_0.5rem)] pb-2 auto-hide-header"
    >
      <div className={PAGE_COLUMN}>
<div className="flex items-center justify-between gap-4 py-1.5">
        <Link href="/" className="rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-white">
          {/* White on the blue bar, as in journal.tsx. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/surflog-logo.png"
            alt="Surflog"
            width={1200}
            height={228}
            className="block h-6 w-auto"
          />
        </Link>
        <div className="flex items-center gap-2.5">
          {/* Same white circle as the journal's "+". Opens the log dialog over
              this page; only a saved session moves on to the journal. */}
          <AddButton label={t("action.logSession")} onClick={() => openLogDialog()} />
          <UserMenu user={user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
        </div>
      </div>
</div>
      <GlobalLogDialog ownerId={user.id} />
    </header>
  );
}
