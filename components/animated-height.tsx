"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Eases its own height when the child's height changes (rows appearing, a
 * note opening into a textarea). The child's height is measured with a
 * ResizeObserver; on a change the wrapper is pinned to the old pixel
 * height, then to the new one, and released back to `auto` when the
 * transition ends so nothing stays clipped. Written straight to the DOM
 * (no React state), like tile-group.tsx. No transition under
 * prefers-reduced-motion.
 */
export function AnimatedHeight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let last = i.offsetHeight;
    const release = () => {
      o.style.height = "";
      o.style.overflow = "";
      o.style.transition = "";
    };
    const ro = new ResizeObserver(() => {
      const next = i.offsetHeight;
      if (next === last) return;
      // An inner element is already easing its own height (data-height-anim):
      // the card follows it frame by frame, so don't start a second transition.
      if (i.querySelector("[data-height-anim]")) {
        last = next;
        release();
        return;
      }
      // Where to start: the old content height, which is what the wrapper was
      // before this change. (Reading the wrapper itself is no good here: it is
      // `auto`, so it already has the new height and nothing would animate.)
      // Mid-ease the wrapper is pinned, so its own height is the real start.
      const easing = o.style.height !== "";
      const from = easing ? o.getBoundingClientRect().height : last;
      last = next;
      if (reduce.matches || !from) {
        release();
        return;
      }
      o.style.transition = "none";
      o.style.overflow = "hidden";
      o.style.height = `${from}px`;
      void o.offsetHeight; // commit the start height before animating
      o.style.transition = "height 240ms cubic-bezier(0.22, 1, 0.36, 1)";
      o.style.height = `${next}px`;
    });
    const onEnd = (e: TransitionEvent) => {
      if (e.target === o && e.propertyName === "height") release();
    };
    o.addEventListener("transitionend", onEnd);
    ro.observe(i);
    return () => {
      ro.disconnect();
      o.removeEventListener("transitionend", onEnd);
    };
  }, []);

  return (
    <div ref={outer} className={className}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
