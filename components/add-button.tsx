"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Tooltip } from "@/components/tooltip";

/** The log-session button's "+" glyph — Avery's own icon (surflog+button.png,
 * 300x257, black on transparent, a chunky square-ended plus), rebuilt as inline
 * SVG so it stays crisp at any size and takes `currentColor`. Geometry measured
 * from the PNG's alpha channel: two rectangles, the vertical bar 80 wide, the
 * horizontal 63 tall, deliberately unequal. (Moved here from journal.tsx
 * 2026-10-16, which re-exports it.) */
export function LogIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 257" fill="currentColor" aria-hidden className={className}>
      <rect x="110" y="0" width="80" height="257" />
      <rect x="0" y="97" width="300" height="63" />
    </svg>
  );
}

/**
 * The header's white "+" button with the "rising wave, follows the mouse" hover
 * (variant 3b of /dev/add-button, adopted 2026-10-16). Used by the journal
 * header (a button) and the sub-page header (a link). Styles: `.ab.v3b` in
 * app/globals.css.
 */
const WAVE_PATH = "M0 4.5 " + Array.from({ length: 8 }, (_, i) => (i === 0 ? "Q5 0 10 4.5" : "T" + (i + 1) * 10 + " 4.5")).join(" ") + " V9 H0 Z";
const BASE = 40; // px: the header circle the spring numbers below were tuned on; other sizes scale from it

/**
 * The water simulation behind the header "+" button, shared by AddButton (3b)
 * and the dev page's halo / beneath variants so they can't drift apart. Two
 * damped springs (surface level, tilt) run in one rAF loop that writes
 * --wy / --wr on the element `ref` points at, and STOPS once settled,
 * so nothing runs while idle. `handlers` go on the pointer-sensitive element
 * (any pointer event from its children bubbles to it).
 */
export function useWaterSpring(force = false, size = BASE) {
  const k = size / BASE;
  const SURFACE_OFF = 48 * k; // px: surface below the circle = no water showing
  const CALM_LEVEL = 18 * k; // px from the top: the centred rising wave used for focus and touch
  const ref = useRef<HTMLElement>(null);
  const sim = useRef({
    level: SURFACE_OFF, levelV: 0, levelT: SURFACE_OFF,
    tilt: 0, tiltV: 0, tiltT: 0,
    raf: 0, last: 0, held: { hover: false, calm: false }, forced: false,
  });

  function reduced() {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function step(now: number) {
    const b = ref.current;
    const m = sim.current;
    if (!b) return;
    const dt = Math.min(0.032, Math.max(0.001, (now - (m.last || now - 16)) / 1000));
    m.last = now;
    const spring = (p: number, v: number, t: number, k: number, c: number) => {
      const nv = v + (k * (t - p) - c * v) * dt;
      return [p + nv * dt, nv];
    };
    [m.level, m.levelV] = spring(m.level, m.levelV, m.levelT, 140, 11);
    [m.tilt, m.tiltV] = spring(m.tilt, m.tiltV, m.tiltT, 90, 5);
    b.style.setProperty("--wy", m.level.toFixed(2));
    b.style.setProperty("--wr", m.tilt.toFixed(2));
    const settled =
      Math.abs(m.levelT - m.level) < 0.05 && Math.abs(m.levelV) < 0.05 && Math.abs(m.tilt - m.tiltT) < 0.05 && Math.abs(m.tiltV) < 0.05;
    if (settled && !m.held.hover && !m.held.calm && !m.forced) {
      m.raf = 0;
      m.last = 0;
      b.removeAttribute("data-live");
      return;
    }
    m.raf = requestAnimationFrame(step);
  }
  function wake() {
    const m = sim.current;
    ref.current?.setAttribute("data-live", "true");
    if (!m.raf) m.raf = requestAnimationFrame(step);
  }
  function aim(x: number, y: number) {
    const m = sim.current;
    m.levelT = Math.min(34 * k, Math.max(6 * k, y * 40 * k));
    m.tiltT = -(x - 0.5) * 36;
  }
  function drain() {
    const m = sim.current;
    m.held.hover = false;
    m.held.calm = false;
    m.levelT = SURFACE_OFF;
    m.tiltT = 0;
    wake();
  }
  function calm() {
    const m = sim.current;
    m.held.calm = true;
    m.levelT = CALM_LEVEL;
    m.tiltT = 0;
    wake();
  }

  // Forced: a slow scripted circle stands in for the pointer.
  useEffect(() => {
    const m = sim.current;
    m.forced = force;
    if (!force || reduced()) return;
    let id = 0;
    const t0 = performance.now();
    m.held.hover = true;
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      aim(0.5 + 0.45 * Math.cos(t * 1.6), 0.5 + 0.35 * Math.sin(t * 1.6));
      wake();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      drain();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [force]);

  useEffect(() => {
    const m = sim.current;
    return () => cancelAnimationFrame(m.raf);
  }, []);

  function rel(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const;
  }

  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (reduced() || sim.current.forced || e.pointerType === "touch") return;
      const [x, y] = rel(e);
      const m = sim.current;
      m.held.hover = true;
      aim(x, y);
      m.tiltV += (x < 0.5 ? 1 : -1) * 160; // slosh kick from the entry side
      wake();
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (reduced() || sim.current.forced || e.pointerType === "touch") return;
      const [x, y] = rel(e);
      const m = sim.current;
      if (!m.held.hover) return;
      aim(x, y);
      wake();
    },
    onPointerLeave: () => {
      if (reduced() || sim.current.forced) return;
      sim.current.tiltV += 80;
      drain();
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "touch" && !reduced()) calm();
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType === "touch") drain();
    },
    onPointerCancel: () => drain(),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (!reduced() && (e.target as HTMLElement).matches(":focus-visible")) calm();
    },
    onBlur: () => !sim.current.forced && drain(),
  };
  return { ref, handlers };
}

/** The water layer (surface wave + body) drawn inside a circle that carries the
 *  `.ab.v3b` or `.wv` styles. `fill` is the water colour (the footer passes
 *  white and fades the whole layer with --wave-opacity so the wave/body overlap
 *  doesn't show a seam). */
export function WaterFill({ fill }: { fill: string }) {
  return (
    <span className="wf" aria-hidden>
      <span className="surf">
        <svg viewBox="0 0 80 9" preserveAspectRatio="none">
          <path d={WAVE_PATH} fill={fill} />
        </svg>
      </span>
      <span className="body" style={{ background: fill }} />
    </span>
  );
}

/**
 * Variant 3b. A cup of water in the circle: the surface height follows the
 * pointer's height, the crest leans toward the pointer's side, entering kicks
 * a slosh, leaving drains it. Three damped springs (level, tilt) run in one
 * rAF loop that writes --wy / --wr on the button and STOPS once the
 * water has settled, so nothing runs while idle. Focus-visible and touch press
 * have no pointer position and use the calm centred level. Forced mode drives a
 * scripted circular pointer path. Reduced motion: no tracking at all.
 */
export function AddButton({
  label,
  href,
  onClick,
  force = false,
  focusRing = false,
}: {
  /** aria-label and tooltip text (already translated). */
  label: string;
  /** Renders a link instead of a button (sub-page headers). */
  href?: string;
  onClick?: () => void;
  /** Dev page only: play a scripted pointer path instead of waiting for a mouse. */
  force?: boolean;
  /** Dev page only: show the focus-visible ring. */
  focusRing?: boolean;
}) {
  const { ref, handlers } = useWaterSpring(force);
  const props = {
    ref: ref as never,
    className: "ab v3b",
    "data-focus": focusRing ? "true" : undefined,
    "aria-label": label,
    ...handlers,
  };
  const inner = (
    <>
      <WaterFill fill="#cfd5ff" />
      <span className="ic">
        <LogIcon className="size-4" />
      </span>
    </>
  );
  return (
    <Tooltip tip={label}>
      {href ? (
        <Link href={href} {...props}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} {...props}>
          {inner}
        </button>
      )}
    </Tooltip>
  );
}
