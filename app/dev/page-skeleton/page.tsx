"use client";

import { useState } from "react";
import { PageSkeleton, type PageSkeletonVariant } from "@/components/page-skeleton";

/**
 * components/page-skeleton.tsx — what each signed-in page shows while it
 * loads. Pick a page; "Replay" remounts it, so the 120 ms delay and the fade-in
 * play again (not under prefers-reduced-motion). It stays on screen here; in
 * the app it is replaced as soon as the page arrives. "All five" shows every
 * skeleton side by side at phone width, each in an iframe (./frame/[variant])
 * so the media queries follow the frame. Dev only (app/dev/layout.tsx).
 */
const VARIANTS: { key: PageSkeletonVariant; label: string }[] = [
  { key: "journal", label: "Journal /" },
  { key: "spots", label: "Spots /spots" },
  { key: "spot", label: "Spot page /spots/<slug>" },
  { key: "aiApps", label: "AI apps /ai-apps" },
  { key: "admin", label: "Admin /admin" },
];

export default function PageSkeletonDevPage() {
  const [variant, setVariant] = useState<PageSkeletonVariant | "all">("all");
  const [run, setRun] = useState(0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3.5 py-2.5 text-[13px]">
        <span className="font-semibold text-muted-foreground">Loading skeleton:</span>
        <button
          type="button"
          onClick={() => {
            setVariant("all");
            setRun((n) => n + 1);
          }}
          aria-pressed={variant === "all"}
          className={`rounded-full border px-3 py-1 ${variant === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
        >
          All five
        </button>
        {VARIANTS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              setVariant(v.key);
              setRun((n) => n + 1);
            }}
            aria-pressed={variant === v.key}
            className={`rounded-full border px-3 py-1 ${variant === v.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
          >
            {v.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="ml-auto rounded-full border px-3 py-1 hover:bg-secondary"
        >
          Replay
        </button>
      </div>
      {variant === "all" ? (
        <div className="flex gap-4 overflow-x-auto bg-secondary p-4">
          {VARIANTS.map((v) => (
            <div key={`${v.key}-${run}`} className="shrink-0">
              <div className="mb-2 text-[13px] font-semibold text-muted-foreground">{v.label}</div>
              <iframe
                title={v.label}
                src={`/dev/page-skeleton/frame/${v.key}`}
                className="h-[760px] w-[375px] rounded-[var(--r-card)] border bg-card"
              />
            </div>
          ))}
        </div>
      ) : (
        <PageSkeleton key={`${variant}-${run}`} variant={variant} user={{ name: "Avery Lin" }} />
      )}
    </>
  );
}
