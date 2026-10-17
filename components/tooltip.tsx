"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";

/**
 * The one tooltip style in the app (dark grey --badge fill, 11px medium text, 4px corners,
 * no arrow, 3px under the trigger, centred and clamped to the viewport).
 * Portalled to <body> with position: fixed so scroll containers can't clip it
 * and it sits above the sticky header (z-30) and dialogs. Shown on mouse hover
 * and keyboard focus only (touch has no sticky hover); hides on press, scroll
 * and resize. Replaces native `title` on icon buttons: keep the child's
 * aria-label, the tip is only a visual hint (it is wired via aria-describedby).
 */
export function Tooltip({
  tip,
  children,
  className,
  suppress = false,
}: {
  tip: string;
  children: React.ReactNode;
  /** Extra classes for the wrapper span (layout only). */
  className?: string;
  /** While true the tip stays hidden and won't show. For a trigger that opens a
   *  menu: closing it returns focus to the trigger, which would show the tip. */
  suppress?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // going quiet also clears a tip that is already showing
  const [wasSuppressed, setWasSuppressed] = useState(suppress);
  if (suppress !== wasSuppressed) {
    setWasSuppressed(suppress);
    if (suppress) setPos(null);
  }

  function show() {
    if (suppress) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 3, left: r.left + r.width / 2 });
  }
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [pos]);

  return (
    <span
      ref={ref}
      className={cn("inline-flex", className)}
      aria-describedby={pos ? id : undefined}
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => e.target.matches(":focus-visible") && show()}
      onBlur={hide}
    >
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            style={{ top: pos.top, left: pos.left }}
            className="pointer-events-none fixed z-[60] max-w-[calc(100vw-16px)] -translate-x-1/2 rounded-[var(--r-tile)] bg-badge px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-badge-foreground shadow-sm"
          >
            {tip}
          </span>,
          document.body
        )}
    </span>
  );
}
