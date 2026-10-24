"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { AnimatedHeight } from "@/components/animated-height";

/**
 * The shared white card: the resting surface (radius, white fill, soft
 * shadow) plus the standing height easing, so a card whose content grows or
 * shrinks never jumps (Avery's rule, 2026-10-08/17).
 *
 * The surface sits on the AnimatedHeight wrapper itself, not on a box inside
 * it: the wrapper sets overflow:hidden while it eases, which clips a child's
 * shadow and makes it flash back in when the transition ends. An element's
 * own shadow is never clipped by its own overflow.
 *
 * Put padding and layout on a child (or via `className` for margins); keep
 * the card's own box free of padding so the measured inner height is the
 * whole content. Use this for any new white card instead of repeating
 * `rounded-[var(--r-card)] surface-card`.
 */
export function WhiteCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <AnimatedHeight className={cn("rounded-[var(--r-card)] surface-card", className)}>
      {children}
    </AnimatedHeight>
  );
}
