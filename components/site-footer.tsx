"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";

/** Address shown in the footer. Not translated. */
export const SUPPORT_EMAIL = "support@surflog.tw";

/** Evaluated once per module load, on the server and again in the browser, so
 *  the two only differ if the server process straddles New Year. */
const YEAR = new Date().getFullYear();

/**
 * Footer on every page (root layout): a full-width solid blue banner like the
 * header (2026-10-16, on request), white text, content in PAGE_COLUMN so its
 * edges line up with the header and the page. `mt-auto` pins it to the bottom
 * of a short page; the 40px transparent spacer inside the footer keeps a gap
 * above the banner without a margin that would fight `mt-auto`. White on
 * #0018FF is 8.16:1. Nothing below the banner. Phone: centred stack. From sm (option B): wordmark with the
 * copyright under it on the left, the icon-only mail link on the right. (Privacy / Terms links are the
 * natural next items once those pages exist; none are linked now.)
 */
export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="mt-auto">
      <div aria-hidden className="h-10" />
      <div className="bg-primary pt-6 pb-[calc(env(safe-area-inset-bottom)_+_1.5rem)] text-primary-foreground sm:pt-5 sm:pb-[calc(env(safe-area-inset-bottom)_+_1.25rem)]">
        {/* Phone: centred stack (wordmark, mail, copyright). From sm: a two-column grid, wordmark over copyright on the left, mail spanning both rows on the right, so the DOM order stays the phone's reading order. */}
        <div className={`${PAGE_COLUMN} flex flex-col items-center gap-0.5 text-center sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-x-4 sm:gap-y-1.5 sm:text-left`}>
          <Link href="/" aria-label={t("footer.homeLabel")} className="mb-2 justify-self-start rounded-sm sm:col-start-1 sm:row-start-1 sm:mb-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {/* Same markup as the headers (white via brightness-0 invert). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/surflog-logo.png"
              alt=""
              width={1200}
              height={228}
              className="block h-5 w-auto brightness-0 invert"
            />
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            aria-label={t("footer.emailLabel", { email: SUPPORT_EMAIL })}
            className="inline-flex size-10 items-center justify-center rounded-full border-[1.5px] border-white/40 text-primary-foreground transition-colors hover:border-white/20 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none sm:col-start-2 sm:row-span-2 sm:row-start-1"
          >
            <Mail className="size-5 shrink-0" aria-hidden />
          </a>
          <p className="text-[12.5px] text-primary-foreground/70 sm:col-start-1 sm:row-start-2">© {YEAR} Surflog</p>
        </div>
      </div>
    </footer>
  );
}
