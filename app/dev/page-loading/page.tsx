"use client";

import { useEffect, useState } from "react";
import { WhiteCard } from "@/components/white-card";
import {
  LoadingAnimation,
  PAGE_LOADING_VARIANTS,
  PageLoading,
  type PageLoadingVariant,
} from "@/components/page-loading";
import { PageSkeleton } from "@/components/page-skeleton";
import { PAGE_COLUMN } from "@/lib/layout";

/**
 * components/page-loading.tsx — candidate loading animations to replace the
 * grey skeleton (components/page-skeleton.tsx). Each card plays its animation;
 * "Full page" shows it as it would appear (blue header + animation centred in
 * the free height, 120 ms delayed fade-in) with a floating Back button. The
 * current skeleton is the last card, for comparison. Dev only (app/dev/layout.tsx).
 */
type Open = PageLoadingVariant | "skeleton" | null;

export default function PageLoadingDevPage() {
  const [open, setOpen] = useState<Open>(null);
  const [runs, setRuns] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (open) {
    return (
      <>
        {open === "skeleton" ? <PageSkeleton variant="journal" /> : <PageLoading key={open} variant={open} />}
        <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center">
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-menu"
          >
            Back to options (Esc)
          </button>
        </div>
      </>
    );
  }

  return (
    <div className={`${PAGE_COLUMN} py-8`}>
      <h1 className="text-xl font-semibold">Loading animations</h1>
      <p className="mt-1 max-w-prose text-[14px] text-muted-foreground">
        Pick one to replace the grey skeleton. Replay remounts the animation; Full page shows it under the
        real header, as a page would while it loads. Under prefers-reduced-motion each is a still frame.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {PAGE_LOADING_VARIANTS.map((v, i) => (
          <WhiteCard key={v.key}>
            <div className="p-4">
              <div className="flex h-44 items-center justify-center overflow-hidden rounded-[var(--r-tile)] bg-white">
                <LoadingAnimation key={runs[v.key] ?? 0} variant={v.key} />
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">
                    {i + 1}. {v.name}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{v.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuns((r) => ({ ...r, [v.key]: (r[v.key] ?? 0) + 1 }))}
                    className="rounded-full bg-secondary px-3 py-1 text-[13px] hover:bg-muted"
                  >
                    Replay
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(v.key)}
                    className="rounded-full bg-primary px-3 py-1 text-[13px] text-primary-foreground hover:bg-primary/80"
                  >
                    Full page
                  </button>
                </div>
              </div>
            </div>
          </WhiteCard>
        ))}
        <WhiteCard>
          <div className="p-4">
            <div className="flex h-44 items-center justify-center rounded-[var(--r-tile)] bg-white text-[13px] text-muted-foreground">
              Grey placeholders in the page&apos;s own layout
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">Current: grey skeleton</div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  What loading shows today, for comparison (journal layout).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen("skeleton")}
                className="shrink-0 rounded-full bg-primary px-3 py-1 text-[13px] text-primary-foreground hover:bg-primary/80"
              >
                Full page
              </button>
            </div>
          </div>
        </WhiteCard>
      </div>
    </div>
  );
}
