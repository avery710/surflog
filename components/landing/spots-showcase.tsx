"use client";

import { LocateFixed, MapPinPlus, PencilLine, Star } from "lucide-react";
import { Stars } from "@/components/spot-reviews-dialog";
import { compassLabel, spotLabel } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { cn } from "cn";

/**
 * Landing section 04: the spot list as something every surfer builds (on
 * request 2026-10-09, replacing a grid of spot names). Three things a
 * signed-in surfer can do, each with a small static mock of its real UI:
 * request a spot (components/request-spot-dialog.tsx), rate and review one
 * (components/spot-reviews-dialog.tsx), suggest an edit
 * (components/suggest-spot-edit-dialog.tsx). Nothing here is interactive or
 * calls the API; the reviewers and their words are made up. Copy says that
 * requests and edits are checked first, because they are.
 */
export function SpotsShowcase() {
  const { lang, t } = useLang();
  const demoSpot = t("landing.spots.add.demoName");
  const reviews = [
    { name: "Mika", rating: 5, body: t("landing.spots.review.demo1") },
    { name: "Leo", rating: 4, body: t("landing.spots.review.demo2") },
  ];
  const average = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Feature icon={MapPinPlus} title={t("landing.spots.add.title")} body={t("landing.spots.add.body")}>
        <MockField label={t("request.name")} value={demoSpot} />
        <MockField label={t("request.location")} value="maps.app.goo.gl/…" mono />
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-primary">
          <LocateFixed className="size-3.5" aria-hidden />
          {t("request.useMyLocation")}
        </p>
        <MockButton>{t("request.send")}</MockButton>
      </Feature>

      <Feature icon={Star} title={t("landing.spots.review.title")} body={t("landing.spots.review.body")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
          <span className="text-[14px] font-bold">{spotLabel("jialeshui", lang)}</span>
          <Stars value={average} />
          <span className="font-mono text-[11.5px] text-muted-foreground">
            {t("review.summary", { average: average.toFixed(1), count: reviews.length })}
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {reviews.map((r) => (
            <li key={r.name} className="flex gap-2.5 rounded-[12px] bg-card px-3 py-2.5">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-badge text-[12px] font-semibold text-badge-foreground"
              >
                {r.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-semibold">{r.name}</span>
                  <Stars value={r.rating} className="[&_svg]:size-3" />
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug break-words">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Feature>

      <Feature icon={PencilLine} title={t("landing.spots.fix.title")} body={t("landing.spots.fix.body")}>
        <p className="px-1 text-[13px] font-bold">{t("spotEdit.title", { name: demoSpot })}</p>
        <MockChange label={t("spots.faces")} from={compassLabel("E", lang) ?? "E"} to={compassLabel("ESE", lang) ?? "ESE"} />
        <MockChange label={t("spots.bestSwell")} from={compassLabel("E", lang) ?? "E"} to={[compassLabel("E", lang), compassLabel("NE", lang)].join(" · ")} />
        <MockButton>{t("spotEdit.send")}</MockButton>
      </Feature>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[var(--r-card)] border border-card-border bg-card p-5">
      {/* The mock first: a grey tile standing in for the dialog, growing to
          even out the cards in a row. Hidden from screen readers; the title
          and text under it say what it shows. */}
      <div aria-hidden className="flex flex-1 flex-col justify-center rounded-[var(--r-tile)] bg-secondary p-3">
        {children}
      </div>
      <p className="mt-4 flex items-center gap-2 text-[15px] font-bold">
        <Icon className="size-4.5 shrink-0 text-primary" aria-hidden />
        {title}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function MockField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-1 text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate rounded-[10px] bg-card px-3 py-1.5 text-[13.5px] font-semibold", mono && "font-mono text-[12.5px]")}>
        {value}
      </p>
    </div>
  );
}

function MockChange({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="mt-2 rounded-[10px] bg-card px-3 py-2">
      <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13.5px] font-semibold">
        <span className="text-muted-foreground line-through">{from}</span>
        <span className="text-muted-foreground">→</span>
        <span>{to}</span>
      </p>
    </div>
  );
}

function MockButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-3 inline-flex self-start rounded-full bg-primary px-4 py-1.5 text-[13px] font-bold text-primary-foreground">
      {children}
    </span>
  );
}
