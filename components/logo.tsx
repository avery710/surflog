/**
 * Hand-built "SURFLOG" wordmark, in the spirit of the Taiwan tourism
 * wordmark Avery pointed to ("TAIWAN — WAVES OF WONDER": one continuous
 * heavy ribbon, wave-arch letterforms, rounded turns, flat cut ends) —
 * see CLAUDE.md "Style references". The letterforms below are original
 * geometry, not traced from that mark: every path was drawn from scratch
 * for this word, and the tagline text is Surflog's own copy in the app's
 * own UI font, not the source's tagline.
 *
 * Construction: one continuous stroke per letter (fill="none", thick
 * strokeWidth, butt caps, round joins) on a shared 0-100-tall baseline
 * grid, tight-set so the word reads as close to one undulating line as
 * legibility allows. S is drawn as two stacked bezier bowls (an actual
 * swell curve); U's bottom is one true semicircular arc (a deep trough);
 * O/G share one ellipse; the straight letters (R/F/L) lean on
 * `strokeLinejoin="round"` for their corners rather than hand-rounding
 * every vertex. `currentColor` throughout, so it takes the surrounding
 * text colour (black in the white header, white on a teal surface — see
 * /dev/logo for both).
 */

type LogoVariant = "bold" | "regular" | "tagline";

interface SurflogLogoProps {
  className?: string;
  /** Accessible name + <title>. Defaults to "Surflog". */
  title?: string;
  variant?: LogoVariant;
}

// Stroke weight per variant — same letter geometry, just thicker/thinner
// ribbon. "tagline" reuses the bold weight (it's the mark + caption).
const STROKE_WIDTH: Record<LogoVariant, number> = {
  bold: 22,
  regular: 15,
  tagline: 22,
};

/** The wordmark alone, as a self-contained <svg>. */
function Wordmark({ strokeWidth, titleText }: { strokeWidth: number; titleText: string }) {
  return (
    <svg
      viewBox="0 0 460 112"
      role="img"
      aria-label={titleText}
      className="block h-full w-auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{titleText}</title>
      <g
        transform="translate(14,6)"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeLinejoin="round"
      >
        {/* S — an ocean-swell curve: two stacked bowls, top opening left,
            bottom opening right. */}
        <path d="M38,18 C0,18 0,50 24,50 C48,50 48,82 10,82" />

        {/* U — a deep trough: straight sides into one true semicircular
            arc, rather than a square-bottomed U. */}
        <g transform="translate(74,0)">
          <path d="M0,14 L0,62 A16,16 0 0 0 32,62 L32,14" />
        </g>

        {/* R — stem, bowl, leg drawn as one unbroken stroke. */}
        <g transform="translate(132,0)">
          <path d="M0,86 L0,14 L22,14 L22,48 L0,48 L34,86" />
        </g>

        {/* F — stem + top arm as one stroke, the middle arm a second,
            landing flush on the stem. */}
        <g transform="translate(192,0)">
          <path d="M0,86 L0,14 L30,14 M0,48 L24,48" />
        </g>

        {/* L — stem + foot, one stroke. */}
        <g transform="translate(248,0)">
          <path d="M0,14 L0,86 L26,86" />
        </g>

        {/* O — shares the same ellipse as G. */}
        <g transform="translate(300,0)">
          <ellipse cx="24" cy="50" rx="24" ry="36" />
        </g>

        {/* G — same ellipse, opened on the right, with an inward bar (the
            wave motif carried into the one letter that needs a break in
            the ring, rather than a sharp notch). */}
        <g transform="translate(374,0)">
          <path d="M44.78,68 A24,36 0 1 1 46.55,37.7 M44.78,68 L22,68" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Surflog's wordmark. `variant="bold"` (default) is the mark alone at full
 * ribbon weight; `"regular"` is the same letterforms at a lighter weight;
 * `"tagline"` stacks the bold mark over a small caption in the app's UI
 * font (a fixed 11px, doesn't scale with the mark — meant for a large
 * display size, e.g. the sign-in card, not a shrunk header). Size the mark
 * by constraining height (e.g. `className="h-7"` for a header) — the SVG
 * has no intrinsic size and scales from its viewBox.
 */
export function SurflogLogo({ className, title = "Surflog", variant = "bold" }: SurflogLogoProps) {
  const strokeWidth = STROKE_WIDTH[variant];

  if (variant === "tagline") {
    return (
      <span className={"inline-flex flex-col items-start gap-1.5 " + (className ?? "")}>
        <Wordmark strokeWidth={strokeWidth} titleText={title} />
        <span className="font-sans text-[11px] font-semibold tracking-[0.32em] text-current opacity-70">
          SURF JOURNAL
        </span>
      </span>
    );
  }

  return (
    <span className={"inline-block " + (className ?? "")}>
      <Wordmark strokeWidth={strokeWidth} titleText={title} />
    </span>
  );
}
