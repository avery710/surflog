"use client";

import { Mail } from "lucide-react";
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
 * #0018FF is 8.16:1. Nothing below the banner. Centred like a common site footer: the contact
 * line, then a smaller muted copyright line. (Privacy / Terms links are the
 * natural next items once those pages exist; none are linked now.)
 */
export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="mt-auto">
      <div aria-hidden className="h-10" />
      <div className="bg-primary pt-6 pb-[calc(env(safe-area-inset-bottom)_+_1.5rem)] text-primary-foreground">
        <div className={`${PAGE_COLUMN} flex flex-col items-center gap-0.5 text-center`}>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            aria-label={t("footer.emailLabel", { email: SUPPORT_EMAIL })}
            className="inline-flex max-w-full items-center justify-center gap-2 rounded-sm py-1.5 text-[14px] font-bold text-primary-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
          >
            <Mail className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-all">{SUPPORT_EMAIL}</span>
          </a>
          <p className="text-[12.5px] text-primary-foreground/70">© {YEAR} Surflog</p>
        </div>
      </div>
    </footer>
  );
}
