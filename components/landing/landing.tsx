"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowDown } from "lucide-react";
import { EntryCard } from "@/components/entry-card";
import { ActivityCalendar } from "@/components/activity-calendar";
import { PatternsTable } from "@/components/patterns-table";
import { GoalCard } from "@/components/goal";
import { spotLabel, taipeiToday } from "@/lib/format";
import { PAGE_COLUMN } from "@/lib/layout";
import { useAutoHideHeader } from "@/lib/use-auto-hide-header";
import { useLang, type Lang } from "@/lib/i18n";
import type { LandingSpot } from "@/lib/landing-spots";
import { cn } from "cn";
import { BoardRack } from "@/components/board-rack";
import { BOARD_PHOTO_CREDITS, DEMO_BOARDS, demoSessions } from "./demo-data";
import { ShareShowcase } from "./share-showcase";
import { SpotsShowcase } from "./spots-showcase";
import { noop } from "@/app/dev/fixtures";

/**
 * The signed-out "/" — what Surflog does, shown with the app's real
 * components fed synthetic data (./demo-data.ts), so the page never drifts
 * from the app. Every demo component is read-only or keeps its edits in
 * local state: nothing here calls the API (a signed-out visitor would only
 * get 401s). Sign-in is the same Google flow as /signin, which still exists
 * on its own for redirects and errors.
 */
export function Landing({ signInAction, spots }: { signInAction: () => Promise<void>; spots?: LandingSpot[] | null }) {
  const { lang, setLang, t } = useLang();

  const goalText = `${t("landing.demo.goal1")}\n${t("landing.demo.goal2")}\n${t("landing.demo.goal3")}`;
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
  const spotNotes = useMemo<Record<string, string>>(
    () => ({
      jialeshui: t("landing.demo.spotNote.jialeshui"),
    }),
    [t]
  );
  // Board notes are demo copy, so they go through t() here (brand names are
  // product names and stay as written).
  const boards = useMemo(
    () =>
      DEMO_BOARDS.map((b) => ({
        ...b,
        note: t(b.id === "demo-board-3" ? "landing.demo.board.goofyNote" : "landing.demo.board.stitchNote"),
      })),
    [t]
  );
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
          logo/buttons are in a `max-w-[880px]` inner column, same
          `mx-auto`/`px-4.5` as the content wrapper below, so they line up
          with the page content under them. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-30 bg-primary pt-[calc(env(safe-area-inset-top)_+_0.5rem)] pb-2 auto-hide-header"
      >
        <div className={`${PAGE_COLUMN} flex flex-wrap items-center justify-between gap-4`}>
          {/* White wordmark on the blue bar — see journal.tsx's matching
              comment (2026-10-08: new logo file, white requested again). */}
          <div className="py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/surflog-logo.png"
              alt="Surflog"
              width={1200}
              height={228}
              className="block h-6 w-auto brightness-0 invert"
            />
          </div>
          <div className="flex items-center gap-2.5">
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
            <LangToggle lang={lang} setLang={setLang} label={t("menu.language")} />
          </div>
        </div>
      </header>

      {/* min-w-0 — same flexbox fix as journal.tsx's matching div, see its
          comment: a flex child of <body> defaults to not shrinking below
          its content's intrinsic width, which without this let the
          patterns table's own `min-w-[420px]` push this whole column
          wider than the viewport at narrow widths.
          key={lang} — triggers fade effect on language change */}
      <div key={lang} className={`animate-in fade-in duration-300 ${PAGE_COLUMN} min-w-0 flex-1 pb-18`}>
      {/* Hero — copy + CTA. The real session card lives in section 01. */}
      <section className="mt-12 sm:mt-16">
        <div>
          <h1 className="text-[38px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[52px]">
            {t("landing.hero.title")}
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
            {t("landing.hero.body")}
          </p>
          <CtaButton action={signInAction} className="mt-8" />
        </div>
      </section>

      {/* ① The dashboard: goal + calendar + spots table in one panel, as in the journal */}
      <Section n="1" title={t("landing.dash.title")} body={t("landing.dash.body")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div className="flex w-full min-w-0 flex-col sm:flex-1">
              <GoalCard
                goal={goalText}
                sessions={all}
                onSave={async () => false}
                readOnly
              />
            </div>
            <div className="w-full sm:flex sm:w-[260px] sm:shrink-0">
              <ActivityCalendar sessions={all} />
            </div>
          </div>
          <PatternsTable
            sessions={all}
            spotNotes={spotNotes}
            onSaveSpotNote={async () => false}
            readOnly
          />
          {/* BoardRack makes real API calls on add/edit/favourite/delete, so
              on the signed-out page it is shown inert (look, don't touch). */}
          <div inert>
            <BoardRack boards={boards} onSaved={noop} onDeleted={noop} onRackChanged={noop} />
          </div>
        </div>
      </Section>

      {/* ② Conditions fill themselves */}
      <Section n="2" title={t("landing.cond.title")} body={t("landing.cond.body")}>
        <div className="grid items-center gap-4 md:grid-cols-[minmax(0,2fr)_auto_minmax(0,5fr)] md:items-stretch">
          <Panel className="md:h-full">
            <p className="mb-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
              {t("landing.cond.youType")}
            </p>
            <FakeField label={t("landing.cond.spot")} value={spotLabel("jialeshui", lang)} />
            <FakeField label={t("landing.cond.when")} value="06:00" />
            <FakeField label={t("landing.cond.notes")} value={t("landing.demo.notesShort")} />
          </Panel>
          <div className="flex items-center justify-center text-primary" aria-hidden>
            <ArrowRight className="hidden size-7 md:block" />
            <ArrowDown className="size-7 md:hidden" />
          </div>
          <div className="flex min-w-0 flex-col md:[&>*]:flex-1 [&>*]:mt-0!">
            <EntryCard session={hero} boards={boards} onUpdated={noop} onDeleted={noop} readOnly />
          </div>
        </div>
      </Section>

      {/* ③ Your own AI agent (MCP, see /ai-apps). One card: a static mock
          conversation, nothing here calls the API. The agents are named in
          the description only (Claude, ChatGPT, Gemini — the ones seen to
          connect); the bullet list and "Works with" row were removed on
          request 2026-10-07. */}
      <Section
        n="3"
        title={t("landing.agent.title")}
        body={t("landing.agent.body")}
      >
        <div>
          <Panel className="flex flex-col gap-2.5">
            <p className="ml-auto max-w-[85%] rounded-[18px] rounded-br-md bg-primary px-3.5 py-2.5 text-[14.5px] font-medium text-primary-foreground">
              {t("landing.agent.ask")}
            </p>
            <p className="max-w-[85%] self-start rounded-full bg-secondary px-3 py-1 font-mono text-[11.5px] text-muted-foreground">
              create_session · jialeshui · 06:00
            </p>
            <p className="max-w-[85%] self-start rounded-[18px] rounded-bl-md bg-secondary px-3.5 py-2.5 text-[14.5px] font-medium">
              {t("landing.agent.reply")}
            </p>
            {/* Second exchange: reading the journal back for patterns and advice. */}
            <p className="mt-2 ml-auto max-w-[85%] rounded-[18px] rounded-br-md bg-primary px-3.5 py-2.5 text-[14.5px] font-medium text-primary-foreground">
              {t("landing.agent.ask2")}
            </p>
            <p className="max-w-[85%] self-start rounded-full bg-secondary px-3 py-1 font-mono text-[11.5px] text-muted-foreground">
              list_sessions · get_goal
            </p>
            <p className="max-w-[92%] self-start whitespace-pre-line rounded-[18px] rounded-bl-md bg-secondary px-3.5 py-2.5 text-[14.5px] font-medium">
              {t("landing.agent.reply2")}
            </p>
          </Panel>
        </div>
      </Section>

      {/* ④ The spot list as something every surfer builds: request, review,
          suggest an edit (./spots-showcase.tsx). The live count comes from the
          catalogue (lib/landing-spots.ts) and is left out when it couldn't be
          loaded; the section itself always shows. */}
      <Section
        n="4"
        title={t("landing.spots.title")}
        body={[
          spots && spots.length > 0
            ? t("landing.spots.count", { n: String(spots.length), c: String(new Set(spots.map((s) => s.country)).size) })
            : null,
          t("landing.spots.body"),
        ]
          .filter(Boolean)
          // CJK sentences run on without a space
          .join(lang === "zh-TW" ? "" : " ")}
      >
        <SpotsShowcase />
      </Section>

      {/* ⑤ Sharing: the three sticker styles in one row. */}
      <Section n="5" title={t("landing.share.title")} body={t("landing.share.body")}>
        <ShareShowcase />
      </Section>

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
      <p className="mt-2 mb-6 text-[15.5px] leading-relaxed text-muted-foreground">{body}</p>
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
    <div role="group" aria-label={label} className="flex rounded-full bg-secondary p-0.5 text-[13px] font-bold transition-all duration-300">
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
            "whitespace-nowrap rounded-full px-2.5 py-1.5 transition-all duration-200 ease-out",
            lang === code
              ? "bg-card text-primary shadow-sm scale-100"
              : "text-primary/60 hover:text-primary scale-95"
          )}
        >
          <span className="inline-block transition-opacity duration-200">
            {text}
          </span>
        </button>
      ))}
    </div>
  );
}
