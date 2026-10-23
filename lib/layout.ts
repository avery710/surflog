/**
 * The one column every signed-in page uses, for the blue header's inner row
 * and for the page content alike, so the wordmark, the "+"/avatar and the
 * content edges sit at the same x on every page (journal, /ai-apps, /admin).
 * 880 px max, 14 px gutter below sm (640), 18 px from sm. Change the width here only.
 * (A full class string, not a number, so Tailwind sees it in source.)
 */
export const PAGE_COLUMN = "mx-auto w-full max-w-[880px] px-3.5 sm:px-4.5";
