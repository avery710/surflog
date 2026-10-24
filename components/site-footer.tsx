"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WaterFill, useWaterSpring } from "@/components/add-button";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import { SOCIAL_LINKS, SUPPORT_EMAIL, type SocialLink } from "@/lib/site-links";

/** Evaluated once per module load, on the server and again in the browser, so
 *  the two only differ if the server process straddles New Year. */
const YEAR = new Date().getFullYear();

/** One 32px circle link (44px touch area via the invisible ::before) with the
 *  header "+" button's water hover: the clip span holds the water so the link
 *  itself doesn't clip its touch area. A transparent circle with a thin black outline and icon (2026-10-24, on request). */
const ICONS = { mail: Mail } as const;
function CircleLink({ link, label }: { link: SocialLink; label: string }) {
  const { ref, handlers } = useWaterSpring(false, 32);
  const Icon = ICONS[link.key];
  return (
    <a
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={link.href}
      aria-label={label}
      className="wv relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-white text-white transition-colors hover:text-black before:absolute before:-inset-1.5 before:content-['']"
      {...handlers}
    >
      <span className="wv-clip" aria-hidden>
        <WaterFill fill="#e5e5e5" />
      </span>
      <span className="ic">
        <Icon className="size-4" aria-hidden />
      </span>
    </a>
  );
}

/**
 * Footer on every page (root layout): the original layout (2026-10-16 option B:
 * a centred stack of wordmark, round mail link and faded copyright), now with no
 * banner, a full-width hairline on top, straight on the page (2026-10-24, on request). `mt-auto`
 * pins it to the bottom of a short page; the 40px spacer keeps a gap without a
 * margin fighting `mt-auto`. No band: transparent, no divider, white content at 70%
 * since 2026-10-24, on request. No Privacy / Terms links until those pages exist.
 */
export function SiteFooter() {
  const { t } = useLang();
  const pathname = usePathname();
  // Dev-only showcase (and its width iframes) is a component preview; the
  // footer under every card is noise there. /dev is 404 in production.
  if (pathname?.startsWith("/dev/session-card") || pathname?.startsWith("/dev/footer-options")) return null;
  return (
    <footer className="mt-auto">
      <div aria-hidden className="h-10" />
      <div className="pt-10 pb-[calc(env(safe-area-inset-bottom)_+_2.5rem)]">
        <div className={`${PAGE_COLUMN} flex flex-col items-center gap-4 text-center opacity-70`}>
          <Link href="/" aria-label={t("footer.homeLabel")} className="rounded-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/surflog-logo.png" alt="" width={1200} height={228} className="block h-5 w-auto brightness-0 invert" />
          </Link>
          <nav aria-label={t("footer.navLabel")} className="flex flex-wrap justify-center gap-2">
            {SOCIAL_LINKS.filter((l) => l.href).map((l) => (
              <CircleLink key={l.key} link={l} label={t(l.labelKey, { email: SUPPORT_EMAIL })} />
            ))}
          </nav>
          <p className="text-[12.5px] leading-4 text-white">© {YEAR} Surflog</p>
        </div>
      </div>
    </footer>
  );
}
