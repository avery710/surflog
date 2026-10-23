/**
 * The one column every signed-in page uses, for the blue header's inner row
 * and for the page content alike, so the wordmark, the "+"/avatar and the
 * content edges sit at the same x on every page (journal, /ai-apps, /admin).
 * 880 px max, 14 px gutter below sm (640), 18 px from sm. Change the width here only.
 * (A full class string, not a number, so Tailwind sees it in source.)
 */
export const PAGE_COLUMN = "mx-auto w-full max-w-[880px] px-3.5 sm:px-4.5";

/**
 * The blue header is a pill the width of the content column (2026-10-24, by
 * request: "shorten the header width to match the content, both ends fully
 * rounded"). The sticky <header> itself only carries the page-white strip
 * (so scrolled content and the notch don't show through) and the safe-area
 * inset; the pill sits inside a PAGE_COLUMN, so its edges are the cards' edges.
 * Every header (journal, sub pages, skeleton, landing, public share) uses
 * these two strings — change the look here only.
 */
export const HEADER_BAR = "sticky top-0 z-30 bg-panel pt-[calc(env(safe-area-inset-top)_+_0.5rem)] pb-2";
export const HEADER_PILL =
  "flex items-center justify-between gap-2 rounded-full bg-primary py-1.5 pr-2 pl-4 sm:gap-4 sm:pl-5";
