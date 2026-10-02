"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowDown, Download, Globe, Image as ImageIcon, Lock } from "lucide-react";
import { EntryCard } from "@/components/entry-card";
import { ActivityCalendar } from "@/components/activity-calendar";
import { PatternsTable } from "@/components/patterns-table";
import { GoalCard } from "@/components/goal";
import { boardLabel, formatVolume } from "@/lib/boards";
import { spotLabel, taipeiToday } from "@/lib/format";
import { useAutoHideHeader } from "@/lib/use-auto-hide-header";
import { useLang, type Lang, type TKey } from "@/lib/i18n";
import { cn } from "cn";
import { DEMO_BOARDS, demoSessions } from "./demo-data";
import { noop } from "@/app/dev/fixtures";

/**
 * The signed-out "/" — what Surflog does, shown with the app's real
 * components fed synthetic data (./demo-data.ts), so the page never drifts
 * from the app. Every demo component is read-only or keeps its edits in
 * local state: nothing here calls the API (a signed-out visitor would only
 * get 401s). Sign-in is the same Google flow as /signin, which still exists
 * on its own for redirects and errors.
 */
export function Landing({ signInAction }: { signInAction: () => Promise<void> }) {
  const { lang, setLang, t } = useLang();

  const goalText = `${t("landing.demo.goal1")}\n${t("landing.demo.goal2")}`;
  const { hero, all } = useMemo(
    () =>
      demoSessions(taipeiToday(), {
        notesHtml: `<p>${t("landing.demo.notes")}</p>`,
        notes: t("landing.demo.notes"),
        goal: goalText,
      }),
    [t, goalText]
  );

  // Demo-only edits: the goal and spot notes are editable, but only in
  // this tab's memory — try-it-out, never saved.
  const [goal, setGoal] = useState<string | null>(null);
  const [spotNotes, setSpotNotes] = useState<Record<string, string>>({});
  // No forceVisible needed here — unlike journal.tsx's log-session
  // dialog, nothing in this header opens off a plain button; the
  // language toggle is a custom pair of buttons, not a Radix popover.
  const headerRef = useAutoHideHeader<HTMLElement>();

  return (
    <>
      {/* Flat, full-bleed bar — solid blue (2026-10-02, on request: "make
          the whole header bg color blue (same as the dashboard bg
          color); remove the black underline border"), same change as
          journal.tsx's header — see its comment for the full reasoning,
          including why this reads `bg-primary` directly rather than the
          panel sections' own `bg-panel` token below (that token moved to
          grey later the same session; the header kept the blue). The
          logo/buttons are in a `max-w-[1080px]` inner column, same
          `mx-auto`/`px-4.5` as the content wrapper below, so they line up
          with the page content under them. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-30 bg-primary pt-[calc(env(safe-area-inset-top)_+_0.5rem)] pb-2 auto-hide-header"
      >
        <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-3 px-4.5">
          {/* Stays black even on the blue bar — see journal.tsx's matching
              comment; the earlier white (`brightness-0 invert`) version
              was tried and reverted the same session. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/surflog-logo.svg"
            alt="Surflog"
            width={2292}
            height={603}
            className="block h-[30px] w-auto sm:h-9"
          />
          <div className="flex items-center gap-2">
            <LangToggle lang={lang} setLang={setLang} label={t("menu.language")} />
            <form action={signInAction}>
              {/* White fill + blue text, not bg-primary — on the header's
                  own solid blue this is the same "would vanish" problem
                  the closing CTA's `inverted` CtaButton already solves
                  below; mirrored here rather than switching to that
                  component, since this button is a plain pill, not its
                  icon+arrow layout. focus-visible:ring-white for the same
                  reason as journal.tsx's + button — the default ring
                  colour is the same blue as this background. */}
              <button
                type="submit"
                className="whitespace-nowrap rounded-full bg-card px-4 py-2 text-[14px] font-bold text-primary outline-none transition-[filter] hover:brightness-95 active:scale-[0.975] focus-visible:ring-3 focus-visible:ring-white"
              >
                {t("landing.signIn")}
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* min-w-0 — same flexbox fix as journal.tsx's matching div, see its
          comment: a flex child of <body> defaults to not shrinking below
          its content's intrinsic width, which without this let the
          patterns table's own `min-w-[420px]` push this whole column
          wider than the viewport at narrow widths. */}
      <div className="mx-auto w-full min-w-0 max-w-[1080px] flex-1 px-4.5 pb-18">
      {/* Hero — copy + CTA, beside a real session card from lg up. */}
      <section className="mt-12 grid items-center gap-10 sm:mt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          <h1 className="text-[38px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[52px]">
            {t("landing.hero.title")}
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
            {t("landing.hero.body")}
          </p>
          <CtaButton action={signInAction} className="mt-8" />
          <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            {t("landing.hero.private")}
          </p>
        </div>
        <div className="min-w-0">
          <EntryCard session={hero} boards={DEMO_BOARDS} onUpdated={noop} onDeleted={noop} readOnly />
        </div>
      </section>

      {/* ① Conditions fill themselves */}
      <Section n="1" title={t("landing.cond.title")} body={t("landing.cond.body")}>
        <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Panel>
            <p className="mb-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
              {t("landing.cond.youType")}
            </p>
            <FakeField label={t("landing.cond.spot")} value={spotLabel("jialeshui", lang)} />
            <FakeField label={t("landing.cond.when")} value="06:00" />
            <FakeField label={t("landing.cond.notes")} value={t("landing.demo.notesShort")} />
          </Panel>
          <div className="flex justify-center text-primary" aria-hidden>
            <ArrowRight className="hidden size-7 md:block" />
            <ArrowDown className="size-7 md:hidden" />
          </div>
          <Panel>
            <p className="mb-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
              {t("landing.cond.weAdd")}
            </p>
            <ul className="space-y-2.5 text-[14.5px] font-semibold">
              {(["landing.cond.swell", "landing.cond.wind", "landing.cond.tide", "landing.cond.temp"] as TKey[]).map(
                (k) => (
                  <li key={k} className="flex gap-2.5">
                    <span className="mt-[7px] size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    {t(k)}
                  </li>
                )
              )}
            </ul>
          </Panel>
        </div>
        <p className="mt-4 text-[13px] font-medium text-muted-foreground">{t("landing.cond.sources")}</p>
      </Section>

      {/* ② Rhythm + ③ goals, side by side from lg */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 lg:grid-cols-2 lg:[&>*]:min-w-0">
        <Section n="2" title={t("landing.rhythm.title")} body={t("landing.rhythm.body")}>
          <div className="flex flex-col gap-4 rounded-[var(--r-card)] bg-panel p-3 sm:p-5">
            <ActivityCalendar sessions={all} />
            <PatternsTable
              sessions={all}
              spotNotes={spotNotes}
              onSaveSpotNote={async (spot, description) => {
                setSpotNotes((prev) => ({ ...prev, [spot]: description }));
                return true;
              }}
            />
          </div>
        </Section>
        <Section n="3" title={t("landing.goal.title")} body={t("landing.goal.body")}>
          <div className="rounded-[var(--r-card)] bg-panel p-3 sm:p-5">
            <GoalCard
              goal={goal ?? goalText}
              sessions={all}
              onSave={async (text) => {
                setGoal(text);
                return true;
              }}
            />
          </div>
          <p className="mt-3 text-[13px] font-medium text-muted-foreground">{t("landing.goal.tryIt")}</p>
        </Section>
      </div>

      {/* ④ Quiver — a plain read-only list; BoardRack itself fetches. */}
      <Section n="4" title={t("landing.quiver.title")} body={t("landing.quiver.body")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {DEMO_BOARDS.map((b) => (
            <li key={b.id}>
              <Panel className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-bold">{boardLabel(b)}</p>
                  <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
                    {[formatVolume(b.volumeL), b.rocker && t(`board.rocker.${b.rocker}` as TKey)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {b.isFavorite && (
                  <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[12.5px] font-bold text-primary-foreground">
                    ✓ {t("board.favorite")}
                  </span>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      </Section>

      {/* Small extras */}
      <section className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            [Globe, "landing.extra.bilingual"],
            [ImageIcon, "landing.extra.media"],
            [Download, "landing.extra.csv"],
            [Lock, "landing.extra.private"],
          ] as const
        ).map(([Icon, k]) => (
          <Panel key={k} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden />
            <p className="text-[14px] font-semibold leading-snug">{t(k)}</p>
          </Panel>
        ))}
      </section>

      {/* Closing CTA */}
      <section className="mt-16 rounded-[var(--r-card)] bg-primary px-6 py-12 text-center text-primary-foreground">
        <h2 className="text-[28px] font-extrabold tracking-[-0.025em] sm:text-[34px]">{t("landing.cta.title")}</h2>
        <p className="mt-2 text-[15px] opacity-85">{t("landing.cta.body")}</p>
        <CtaButton action={signInAction} inverted className="mt-6 inline-flex" />
      </section>
      </div>
    </>
  );
}

function Section({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="mt-16 sm:mt-20">
      <p className="font-mono text-[13px] font-bold text-primary">0{n}</p>
      <h2 className="mt-1 text-[26px] font-extrabold tracking-[-0.025em] sm:text-[30px]">{title}</h2>
      <p className="mt-2 mb-6 max-w-[60ch] text-[15.5px] leading-relaxed text-muted-foreground">{body}</p>
      {children}
    </section>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[var(--r-card)] border border-card-border bg-card p-5", className)}>{children}</div>
  );
}

function FakeField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="text-[12.5px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 rounded-[var(--r-tile)] bg-secondary px-3.5 py-2 text-[14.5px] font-semibold">{value}</p>
    </div>
  );
}

function CtaButton({
  action,
  inverted = false,
  className,
}: {
  action: () => Promise<void>;
  /** White button, for use on a solid blue surface. */
  inverted?: boolean;
  className?: string;
}) {
  const { t } = useLang();
  return (
    <form action={action} className={className}>
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[16px] font-bold transition-[filter] hover:brightness-110 active:scale-[0.975]",
          inverted ? "bg-card text-primary hover:brightness-95" : "bg-primary text-primary-foreground"
        )}
      >
        {t("signin.continueGoogle")}
        <ArrowRight className="size-4.5" aria-hidden />
      </button>
    </form>
  );
}

function LangToggle({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-secondary p-0.5 text-[13px] font-bold">
      {(
        [
          ["en", "EN"],
          ["zh-TW", "中文"],
        ] as const
      ).map(([code, text]) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={cn(
            "whitespace-nowrap rounded-full px-2.5 py-1.5 transition-colors",
            lang === code ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
