/**
 * The thin stem that joins two grey shapes (2026-10-06, hang-tag reference).
 * One piece shared by the board chip (photo circle -> name pill) and the
 * session card's goal chain, so they can't drift apart: 11px stem, radius-3
 * concave fillets, flat `fill-secondary`, no filter. The caller positions it
 * (absolute) and renders it BEFORE the shapes' content, so it never paints
 * over a photo or text; its ends are chords inside the shapes, no seams.
 *
 * horizontal (8.6 x 30): joins a 30px circle to a 28px pill 3.5px to its
 *   right, fillets tangent-solved to the circle and the pill's semicircular
 *   end. viewBox starts at x=28 of a chip.
 *
 * vertical (18 x 11.4): joins a shape above to a pill below across a 7px row
 *   gap (above's bottom at y=0, pill's top at y=7; viewBox y -2.2..9.2, x
 *   6..24), stem x 9.5..20.5 centred on x=15 (a 30px circle's centre; the
 *   pill's end is centred on 14). Left fillets are tangent to the stem and to
 *   the real curves: the circle's bottom arc (r15, centre (15,-15)) or a
 *   pill's bottom-left corner arc (r14, centre (14,-14)) above, the pill's
 *   top-left corner arc (r14, centre (14,21)) below. Right sides meet the
 *   pill's flat edges. `top="circle"` vs `"pill"` is the shape above; the
 *   corner arcs are identical for tall (wrapped) and one-line pills.
 */
export function PillNeck({
  direction = "horizontal",
  top = "pill",
  className,
}: {
  direction?: "horizontal" | "vertical";
  /** Vertical only: what sits above, the tick's 30px circle or a pill. */
  top?: "circle" | "pill";
  className?: string;
}) {
  if (direction === "vertical") {
    return (
      <svg
        aria-hidden
        viewBox="6 -2.2 18 11.4"
        className={`pointer-events-none h-[11.4px] w-[18px] fill-secondary ${className ?? ""}`}
      >
        <path
          d={
            top === "circle"
              ? "M7.92 -1.77A3 3 0 0 1 9.5 0.87L9.5 5.74A3 3 0 0 1 7.82 8.43L7.82 9.2L23.5 9.2L23.5 7A3 3 0 0 1 20.5 4L20.5 0.87A3 3 0 0 1 22.08 -1.77L22.08 -2.2L7.92 -2.2Z"
              : "M7.82 -1.43A3 3 0 0 1 9.5 1.26L9.5 5.74A3 3 0 0 1 7.82 8.43L7.82 9.2L23.5 9.2L23.5 7A3 3 0 0 1 20.5 4L20.5 3A3 3 0 0 1 23.5 0L23.5 -2.2L7.82 -2.2Z"
          }
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="28 0 8.6 30" className={`pointer-events-none h-[30px] w-[8.6px] fill-secondary ${className ?? ""}`}>
      <path d="M28.23 7.92A3 3 0 0 0 30.87 9.5L32.8 9.5A3 3 0 0 0 35.4 8L35.4 22A3 3 0 0 0 32.8 20.5L30.87 20.5A3 3 0 0 0 28.23 22.08Z" />
    </svg>
  );
}

/**
 * Flat-to-flat variant, for two tiles whose facing edges are straight (the
 * session card's condition tiles, 2026-10-06): same 11px stem and radius-3
 * concave fillets as the chip/goal necks, each fillet tangent to the stem and
 * to the tile's edge. Returns an SVG path in the caller's own pixel space.
 * Horizontal: `edge` is the left tile's right edge x, `gap` the distance to
 * the right tile, `c` the stem's centre y. Vertical: the same, transposed
 * (`edge` = upper tile's bottom y, `c` = stem's centre x). Each end runs 1px
 * into its tile so no hairline can show. Needs gap >= 6 (two fillets).
 */
export function flatNeckPath(direction: "horizontal" | "vertical", edge: number, gap: number, c: number): string {
  const a = edge;
  const b = edge + gap;
  const R = 3; // fillet radius
  const H = 5.5; // half the stem
  const o = H + R; // where the fillet meets the tile edge
  const p = (u: number, v: number) => (direction === "horizontal" ? `${u} ${v}` : `${v} ${u}`);
  return [
    `M${p(a - 1, c - o)}`,
    `L${p(a, c - o)}`,
    `A${R} ${R} 0 0 0 ${p(a + R, c - H)}`,
    `L${p(b - R, c - H)}`,
    `A${R} ${R} 0 0 0 ${p(b, c - o)}`,
    `L${p(b + 1, c - o)}`,
    `L${p(b + 1, c + o)}`,
    `L${p(b, c + o)}`,
    `A${R} ${R} 0 0 0 ${p(b - R, c + H)}`,
    `L${p(a + R, c + H)}`,
    `A${R} ${R} 0 0 0 ${p(a, c + o)}`,
    `L${p(a - 1, c + o)}Z`,
  ].join("");
}
