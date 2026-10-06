"use client";

import { useLayoutEffect, useRef } from "react";
import { flatNeckPath } from "@/components/pill-neck";

/**
 * The session card's condition tiles, joined by the same thin stem as the
 * board chip and goal chain (2026-10-06, on request). The layout (a 3-column
 * grid on phones, one row from `sm`, with tiles spanning or missing) is
 * decided by the caller's classes, so the necks are derived from where the
 * tiles actually end up: after layout every pair of `[data-tile]` children
 * that face each other across the grid gap gets a stem, centred on the
 * overlap of the two facing edges (horizontal pairs: the shared vertical
 * middle; stacked pairs: the middle of the shared width). That gives one
 * neck between each side-by-side pair and, for a wide tile under two narrow
 * ones (Tide under Period + Wind), one under each. Only rendered tiles can
 * be neighbours, so no variant dangles.
 * The necks are SVG paths written straight into an overlay div (DOM, no React
 * state), re-drawn by a ResizeObserver and after fonts load. The overlay is
 * the first child and tiles are `relative`, so tile content paints above.
 */
export function TileGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const overlay = overlayRef.current;
    if (!root || !overlay) return;
    const draw = () => {
      const o = root.getBoundingClientRect();
      const tiles = Array.from(root.querySelectorAll<HTMLElement>(":scope > [data-tile]")).map((el) => {
        const r = el.getBoundingClientRect();
        return { l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top };
      });
      const MIN = 41; // shared edge needed so the stem sits on the straight part (2 x 12px corners + 17px)
      const paths: string[] = [];
      for (const a of tiles) {
        for (const b of tiles) {
          if (a === b) continue;
          const gapX = b.l - a.r;
          const overlapY = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          if (gapX >= 6 && gapX <= 12 && overlapY >= MIN) {
            paths.push(flatNeckPath("horizontal", a.r, gapX, (Math.max(a.t, b.t) + Math.min(a.b, b.b)) / 2));
          }
          const gapY = b.t - a.b;
          const overlapX = Math.min(a.r, b.r) - Math.max(a.l, b.l);
          if (gapY >= 6 && gapY <= 12 && overlapX >= MIN) {
            paths.push(flatNeckPath("vertical", a.b, gapY, (Math.max(a.l, b.l) + Math.min(a.r, b.r)) / 2));
          }
        }
      }
      overlay.innerHTML = paths.length
        ? `<svg width="${root.clientWidth}" height="${root.clientHeight}" class="fill-secondary">${paths
            .map((d) => `<path d="${d}"/>`)
            .join("")}</svg>`
        : "";
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(root);
    Array.from(root.children).forEach((c) => ro.observe(c));
    void document.fonts?.ready.then(draw);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <div ref={overlayRef} aria-hidden className="pointer-events-none absolute inset-0" />
      {children}
    </div>
  );
}
