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
 *  itself doesn't clip its touch area. */
const ICONS = { mail: Mail } as const;
function CircleLink({ link, label }: { link: SocialLink; label: string }) {
  const { ref, handlers } = useWaterSpring(false, 32);
  const Icon = ICONS[link.key];
  return (
    <a
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={link.href}
      aria-label={label}
      className="wv relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-white/40 text-primary-foreground before:absolute before:-inset-1.5 before:content-['']"
      {...handlers}
    >
      <span className="wv-clip" aria-hidden>
        <WaterFill fill="#fff" />
      </span>
      <span className="ic">
        <Icon className="size-4" aria-hidden />
      </span>
    </a>
  );
}

/**
 * Footer on every page (root layout): full-width solid blue banner (white on
 * #0018FF is 8.16:1), content in PAGE_COLUMN. Option B (2026-10-16): centred
 * stack of white wordmark, wrapping row of circle links (SOCIAL_LINKS in
 * lib/site-links.ts), faded copyright. `mt-auto` pins it to the bottom of a
 * short page; the 40px spacer keeps a gap without a margin fighting `mt-auto`.
 */
export function SiteFooter() {
  const { t } = useLang();
  const pathname = usePathname();
  // Dev-only showcase (and its width iframes) is a component preview; the
  // banner under every card is noise there. /dev is 404 in production.
  if (pathname?.startsWith("/dev/session-card") || pathname?.startsWith("/dev/footer-options")) return null;
  return (
    <footer className="mt-auto">
      <div aria-hidden className="h-10" />
      <div className="bg-primary pt-6 pb-[calc(env(safe-area-inset-bottom)_+_1.5rem)] text-primary-foreground">
        <div className={`${PAGE_COLUMN} flex flex-col items-center gap-4 text-center`}>
          <Link href="/" aria-label={t("footer.homeLabel")} className="rounded-sm">
            {/* Same markup as the headers (white via brightness-0 invert). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/surflog-logo.png" alt="" width={1200} height={228} className="block h-5 w-auto brightness-0 invert" />
          </Link>
          <nav aria-label={t("footer.navLabel")} className="flex flex-wrap justify-center gap-2">
            {SOCIAL_LINKS.filter((l) => l.href).map((l) => (
              <CircleLink key={l.key} link={l} label={t(l.labelKey, { email: SUPPORT_EMAIL })} />
            ))}
          </nav>
          <p className="text-[12.5px] leading-4 text-primary-foreground/70">© {YEAR} Surflog</p>
        </div>
      </div>
    </footer>
  );
}
