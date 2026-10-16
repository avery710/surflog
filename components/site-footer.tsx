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
 * #0018FF is 8.16:1. Nothing below the banner. Every width (option 2): wordmark with the
 * copyright under it on the left, the icon-only mail link on the right. (Privacy / Terms links are the
 * natural next items once those pages exist; none are linked now.)
 */
export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="mt-auto">
      <div aria-hidden className="h-10" />
      <div className="bg-primary pt-6 pb-[calc(env(safe-area-inset-bottom)_+_1.5rem)] text-primary-foreground">
        {/* Every width: two-column grid, wordmark over copyright on the left, mail circle on the right pinned to the wordmark row (-my-1.5 stops its 32px from stretching the 20px row). */}
        <div className={`${PAGE_COLUMN} grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-left`}>
          <Link href="/" aria-label={t("footer.homeLabel")} className="col-start-1 row-start-1 justify-self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
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
            className="inline-flex size-8 items-center justify-center rounded-full border-[1.5px] border-white/40 text-primary-foreground transition-colors hover:border-white/20 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none col-start-2 row-start-1 -my-1.5 justify-self-end self-center"
          >
            <Mail className="size-4 shrink-0" aria-hidden />
          </a>
          <p className="text-[12.5px] text-primary-foreground/70 col-start-1 row-start-2 leading-4">© {YEAR} Surflog</p>
        </div>
      </div>
    </footer>
  );
}
