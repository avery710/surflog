"use client";

import { useLang } from "@/lib/i18n";
import type { ShareVariant } from "@/lib/share-element";

/**
 * Landing section 05: the three sticker styles in one row, unlabelled, each
 * as a 9:16 story on a transparent background, shown as the share dialog
 * shows it with the photo background off: a dark checkerboard behind the
 * white stickers (on request 2026-10-09: no style names, no share-link box,
 * transparent rather than photo stand-ins "for now"). The stickers are files drawn by the real
 * renderer from this page's demo session (scripts/landing-share-images.ts;
 * re-run it when the share images change): the strip's cut-out text is a
 * pixel step after rasterising, which the DOM can't do.
 */
export function ShareShowcase() {
  const { lang, t } = useLang();
  return (
    // One row at every width: three columns from sm; below that the row
    // scrolls sideways (snapping per story) so each stays big enough to read,
    // inside its own overflow box so the page never gets wider.
    <ul className="-mx-4.5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4.5 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      {STICKERS.map((variant) => (
        <li
          key={variant}
          className="relative aspect-[9/16] w-[62%] shrink-0 snap-center overflow-hidden rounded-[var(--r-tile)] bg-[length:32px_32px] [background-image:conic-gradient(#2a2d32_25%,#33373c_0_50%,#2a2d32_0_75%,#33373c_0)] sm:w-auto"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/landing/share-${variant}-${lang.toLowerCase()}.webp`}
            alt={t("share.preview.alt")}
            width={540}
            height={960}
            loading="lazy"
            className="absolute inset-0 size-full"
          />
        </li>
      ))}
    </ul>
  );
}

const STICKERS: Exclude<ShareVariant, "og">[] = ["strip", "column", "card"];
