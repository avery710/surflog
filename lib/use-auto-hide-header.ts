"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/** "Meaningful" scroll, in px — ignores the small deltas a trackpad or a
 *  momentum-scroll tail produces, so the header doesn't flicker. */
const DELTA_THRESHOLD = 8;

/**
 * Medium-style sticky header: hides on scroll down, reappears on any
 * scroll up, always shown near the top. Returns a ref to put on the
 * `<header>` element (`components/journal.tsx`, `components/landing/landing.tsx`);
 * the matching CSS (`.auto-hide-header`, `app/globals.css`) reads the
 * `data-autohide="hidden"` attribute this hook toggles on it.
 *
 * Deliberately **no React state** — every write is a direct DOM mutation
 * on the ref'd element inside a plain scroll listener, not a re-render
 * per scroll event (there'd be a lot of those), and there's nothing here
 * for the `react-hooks/set-state-in-effect` lint rule (CLAUDE.md
 * "Conventions") to catch, since no `useState` setter is ever called from
 * this effect — only a ref write for `forceVisible` tracking (see below),
 * which isn't state.
 *
 * `forceVisible`: the log-session dialog in journal.tsx is opened from a
 * plain button, not a Radix `DialogTrigger` living inside the header, so
 * there's no DOM attribute on the header to detect it by — the caller
 * passes its own `formOpen` state through this instead. Changes to it are
 * read via a ref kept current by a tiny separate effect, so the dialog
 * opening/closing doesn't re-subscribe the scroll listener itself.
 * Everything else that should block hiding — the user-menu dropdown,
 * or any other Radix popover/dialog whose *trigger* lives inside the
 * header (its trigger carries `data-state="open"` even though its portal
 * content renders elsewhere) — is found generically with one
 * `querySelector` per scroll tick, no prop needed per consumer.
 */
export function useAutoHideHeader<T extends HTMLElement>(options?: { forceVisible?: boolean }) {
  const ref = useRef<T | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const forceVisible = options?.forceVisible ?? false;
  const forceVisibleRef = useRef(forceVisible);

  // Keep the scroll handler's view of forceVisible current without
  // re-attaching the scroll listener every time it changes.
  useEffect(() => {
    forceVisibleRef.current = forceVisible;
  }, [forceVisible]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion: never hide at all, rather than hide/show without a
    // transition. An instantly-vanishing header is still motion a
    // sensitive user didn't ask for, and nothing here depends on the
    // header actually hiding (it's a convenience for scanning past it on
    // a long page, not load-bearing), so "always show" is the simpler and
    // safer of the two options the brief allowed for.
    if (reducedMotion) {
      el.removeAttribute("data-autohide");
      return;
    }

    const clampY = (y: number) => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      // iOS overscroll bounce can briefly report scrollY outside [0, max]
      // (elastic over-scroll at either end) — clamping stops that from
      // reading as a real scroll delta.
      return Math.min(Math.max(y, 0), max);
    };

    let lastY = clampY(window.scrollY);
    let hidden = false;
    let focusInside = el.contains(document.activeElement);
    let ticking = false;

    function setHidden(next: boolean) {
      if (next === hidden) return;
      hidden = next;
      if (hidden) el!.setAttribute("data-autohide", "hidden");
      else el!.removeAttribute("data-autohide");
    }

    function hasOpenPopover() {
      return !!el!.querySelector('[data-state="open"]');
    }

    function apply() {
      ticking = false;
      const y = clampY(window.scrollY);
      const delta = y - lastY;
      // "scrollY < header height" from the brief (the header has no top
      // offset of its own any more — it's flush to `top: 0`, see
      // journal.tsx/landing.tsx). Deliberately **not** `el.offsetTop +
      // el.offsetHeight` (tried first): offsetTop is only the element's
      // static, pre-scroll position for a *non-stuck* element — once this
      // sticky header is actually stuck, Chromium was observed returning
      // offsetTop == the current scrollY instead (its position relative
      // to offsetParent in the scrolled document, not its flow position),
      // which made `nearTop` true at any scroll depth and the header
      // never hid. offsetHeight doesn't have this problem (confirmed by
      // logging both live while scrolled: offsetHeight stayed correct,
      // offsetTop didn't), so it alone is what's used here.
      const nearTop = y < el!.offsetHeight;

      if (forceVisibleRef.current || focusInside || hasOpenPopover() || nearTop) {
        setHidden(false);
      } else if (delta > DELTA_THRESHOLD) {
        setHidden(true);
      } else if (delta < -DELTA_THRESHOLD) {
        setHidden(false);
      }
      lastY = y;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }

    // Keyboard users tabbing to a header control must see it immediately,
    // not wait for the next scroll event to notice focus moved in.
    function onFocusIn(e: FocusEvent) {
      if (!el!.contains(e.target as Node)) return;
      focusInside = true;
      setHidden(false);
    }
    function onFocusOut(e: FocusEvent) {
      const next = e.relatedTarget as Node | null;
      if (next && el!.contains(next)) return; // focus moved within the header
      focusInside = false;
    }

    apply(); // correct initial state if the page didn't mount at scrollY 0
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [reducedMotion]);

  return ref;
}
