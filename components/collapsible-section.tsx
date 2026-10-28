"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

/**
 * A section whose heading folds its body shut (/spots groups, /admin
 * sections). The heading is a button (`aria-expanded`); `actions` sit beside
 * it, outside the button. Starts open; the state lives in the component.
 *
 * The body eases with a grid-rows 1fr <-> 0fr transition, so the content keeps
 * rendering while it shrinks. Put a card surface on `bodyClassName`, not on a
 * child: the inner box clips (overflow hidden), which would cut a child's
 * shadow. Closed, the body is `visibility: hidden` (set at the end of the
 * ease), so nothing in it can be tabbed to. No motion under
 * prefers-reduced-motion.
 */
export function CollapsibleSection({
  id,
  title,
  count,
  actions,
  className,
  headingClassName,
  bodyClassName,
  dataGroup,
  children,
}: {
  /** Unique on the page; the body is `<id>-panel`. */
  id: string;
  title: ReactNode;
  count?: number;
  actions?: ReactNode;
  className?: string;
  headingClassName?: string;
  bodyClassName?: string;
  dataGroup?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const panel = `${id}-panel`;
  return (
    <section className={className} data-group={dataGroup}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={headingClassName}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panel}
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-sm text-left outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronDown
              className={cn("size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none", !open && "-rotate-90")}
              aria-hidden
            />
            <span>
              {title}
              {count != null && <span className="ml-1.5 font-mono text-muted-foreground">{count}</span>}
            </span>
          </button>
        </h2>
        {actions}
      </div>
      <div
        id={panel}
        className={cn(
          "grid transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
          bodyClassName
        )}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
