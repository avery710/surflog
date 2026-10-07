/**
 * The one column every signed-in page uses, for the blue header's inner row
 * and for the page content alike, so the wordmark, the "+"/avatar and the
 * content edges sit at the same x on every page (journal, /ai-apps, /admin).
 * 880 px max, 18 px gutter below that. Change the width here only.
 * (A full class string, not a number, so Tailwind sees it in source.)
 */
export const PAGE_COLUMN = "mx-auto w-full max-w-[880px] px-4.5";
