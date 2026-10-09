"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * The journal's "connect an AI app" card, beside the activity calendar, shown
 * only while the owner has no AI app connected (app/page.tsx asks
 * hasConnectedApp()). The whole card links to /ai-apps. On phones it gets
 * what is left of the calendar's row (~80px at 375), so it keeps to the
 * heading, a short title and an arrow; the one-line pitch and the "Connect"
 * label show from `sm`. From `lg` it is a fixed-width third column.
 */
export function AiAppCard() {
  const { t } = useLang();
  return (
    <Link
      href="/ai-apps"
      className="group flex min-w-[72px] flex-1 flex-col rounded-[var(--r-card)] border border-card-border bg-card px-3 pt-3.5 pb-4 outline-none transition-colors hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5 sm:pb-5 lg:w-[200px] lg:flex-none"
    >
      {/* Same type style as the other dashboard titles. */}
      <h2 className="h-5 shrink-0 font-sans text-[13px] leading-5 font-bold text-muted-foreground">{t("aiCard.heading")}</h2>
      <p className="mt-2 text-[13px] leading-snug font-bold break-words sm:text-[15px]">{t("aiCard.title")}</p>
      <p className="mt-1 hidden text-[13px] leading-relaxed text-muted-foreground sm:block">{t("aiCard.body")}</p>
      <div className="mt-auto pt-3">
        <span className="inline-flex size-8 items-center justify-center gap-1.5 rounded-full bg-primary text-[13px] font-bold text-primary-foreground transition-[filter] group-hover:brightness-110 sm:size-auto sm:px-3.5 sm:py-1.5">
          <span className="hidden sm:inline">{t("aiCard.cta")}</span>
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
