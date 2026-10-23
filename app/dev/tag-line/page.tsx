"use client";

import { AtSign, Award, Bookmark, BookmarkPlus, CircleDot, Feather, Flag, Gem, Hash, Highlighter, Milestone, Notebook, Pin, Shell, Signpost, Sparkle, Stamp, Tag, Tags, Ticket, Waves, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { LangSwitch } from "@/app/dev/lang-switch";
import { useLang, type Lang } from "@/lib/i18n";
import { tagLabel } from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * Tag line on the session card, without the grey circle (SURFLOG-11).
 * Suggestions only: static markup, the real TagLine (components/tag-line.tsx)
 * is unchanged until one is picked. Each option sits in the same card context
 * (notes above, condition tiles below) at 360 px so spacing can be judged.
 */

const TAGS = ["Glassy", "Chest to shoulder", "Empty break", "With Ming"];

type Option = { id: string; title: string; note: string; render: (labels: string[]) => ReactNode };

const word = "min-w-0 break-words";
const row = "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] font-medium text-muted-foreground";
const dot = (
  <span aria-hidden className="opacity-40">
    ·
  </span>
);

function joined(labels: string[], sep: ReactNode = dot) {
  return labels.map((l, i) => (
    <span key={l} className={word}>
      {l}
      {i < labels.length - 1 && <span className="ml-1.5">{sep}</span>}
    </span>
  ));
}

const OPTIONS: Option[] = [
  {
    id: "1",
    title: "Bare # in front",
    note: "Today’s line with the grey circle taken off: just a faint # glyph, then the words.",
    render: (l) => (
      <p className={row}>
        <Hash className="size-3.5 shrink-0 opacity-60" aria-hidden />
        {joined(l)}
      </p>
    ),
  },
  {
    id: "2",
    title: "# on every tag (hashtags)",
    note: "No icon at all: each tag carries its own #. Reads instantly as tags; a bit busier.",
    render: (l) => (
      <p className={cn(row, "gap-x-2.5")}>
        {l.map((t) => (
          <span key={t} className={word}>
            #{t}
          </span>
        ))}
      </p>
    ),
  },
  {
    id: "3",
    title: "# in the brand blue, words grey",
    note: "Hashtags whose # is blue: ties to the chips and the filter, still quiet.",
    render: (l) => (
      <p className={cn(row, "gap-x-2.5")}>
        {l.map((t) => (
          <span key={t} className={word}>
            <span className="text-primary/70">#</span>
            {t}
          </span>
        ))}
      </p>
    ),
  },
  {
    id: "4",
    title: "Bare tags icon",
    note: "Tags (plural) with no background, in the tags’ own grey (no opacity). Reads as several labels, not one.",
    render: (l) => (
      <p className={row}>
        <Tags className="size-3.5 shrink-0" aria-hidden />
        {joined(l)}
      </p>
    ),
  },
  {
    id: "5",
    title: "Words only, dots between",
    note: "No icon, no symbol. Quietest; relies on position (under the notes) to be read as tags.",
    render: (l) => <p className={row}>{joined(l)}</p>,
  },
  {
    id: "6",
    title: "Words only, slashes between",
    note: "Glassy / Chest to shoulder / Empty break. A touch more structure than dots.",
    render: (l) => <p className={row}>{joined(l, <span className="opacity-40">/</span>)}</p>,
  },
  {
    id: "7",
    title: "Left rule",
    note: "A thin grey line to the left, like a quote or caption: marks the line as separate from the notes.",
    render: (l) => <p className={cn(row, "border-l-2 border-border pl-2")}>{joined(l)}</p>,
  },
  {
    id: "8",
    title: "Dotted underline per tag",
    note: "Each tag underlined with a dotted line (like a glossary term). Hints they are things, without pills.",
    render: (l) => (
      <p className={cn(row, "gap-x-2.5")}>
        {l.map((t) => (
          <span key={t} className={cn(word, "underline decoration-muted-foreground/40 decoration-dotted underline-offset-4")}>
            {t}
          </span>
        ))}
      </p>
    ),
  },
  {
    id: "9",
    title: "Small blue dot in front",
    note: "A 6 px brand-blue dot, then the words: a hint of colour, no glyph.",
    render: (l) => (
      <p className={row}>
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary/70" />
        {joined(l)}
      </p>
    ),
  },
];

/** Other icons for option 4: the bare glyph, same grey as the words, same size. */
const ICONS: { name: string; Icon: typeof Tag }[] = [
  { name: "Tag", Icon: Tag },
  { name: "Tags", Icon: Tags },
  { name: "Bookmark", Icon: Bookmark },
  { name: "BookmarkPlus", Icon: BookmarkPlus },
  { name: "Ticket", Icon: Ticket },
  { name: "Stamp", Icon: Stamp },
  { name: "Flag", Icon: Flag },
  { name: "Pin", Icon: Pin },
  { name: "Shell", Icon: Shell },
  { name: "Waves", Icon: Waves },
  { name: "Milestone", Icon: Milestone },
  { name: "Signpost", Icon: Signpost },
  { name: "Notebook", Icon: Notebook },
  { name: "Gem", Icon: Gem },
  { name: "Award", Icon: Award },
  { name: "Feather", Icon: Feather },
  { name: "Highlighter", Icon: Highlighter },
  { name: "Sparkle", Icon: Sparkle },
  { name: "Zap", Icon: Zap },
  { name: "AtSign", Icon: AtSign },
  { name: "CircleDot", Icon: CircleDot },
  { name: "Hash", Icon: Hash },
];

function Card({ children }: { children: ReactNode }) {
  return (
    <article className="w-[360px] max-w-full rounded-[var(--r-card)] bg-card p-4 shadow-soft">
      <p className="text-[15px] leading-[1.6]">Clean shape on the dropping tide, chest to shoulder high, light offshore.</p>
      <div className="pt-2">{children}</div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {["Swell 1.2 m", "Wind 3 m/s", "Tide ↓ 11:20"].map((x) => (
          <div key={x} className="rounded-[var(--r-tile)] bg-secondary px-2 py-2 font-mono text-[11px] text-muted-foreground">
            {x}
          </div>
        ))}
      </div>
    </article>
  );
}

function labelsFor(lang: Lang) {
  return TAGS.map((t) => tagLabel(t, lang));
}

export default function TagLineOptions() {
  // option 4's icon, swapped: each shown in its own card, same line

  const { lang } = useLang();
  const labels = labelsFor(lang);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">Tag line without the grey circle</h1>
        <p className="max-w-prose text-[13px] text-muted-foreground">
          Nine ways to draw the tags under a session’s notes with no grey background. Suggestions only; the real card is unchanged. Flip 中文 to see
          the Chinese.
        </p>
        <LangSwitch />
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {OPTIONS.map((o) => (
          <section key={o.id} className="min-w-0">
            <h2 className="text-[14px] font-bold">
              <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[11px] text-primary-foreground">
                {o.id}
              </span>
              {o.title}
            </h2>
            <p className="mt-1 mb-2 max-w-prose text-[13px] text-muted-foreground">{o.note}</p>
            <Card>{o.render(labels)}</Card>
          </section>
        ))}
      </div>
      <section className="min-w-0">
        <h2 className="text-[14px] font-bold">Option 4, other icons</h2>
        <p className="mt-1 mb-2 max-w-prose text-[13px] text-muted-foreground">
          The same bare line with a different glyph, in the tags’ grey at the same size. Pick one, or say which to try next.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {ICONS.map(({ name, Icon }) => (
            <div key={name} className="min-w-0">
              <p className="mb-1 font-mono text-[11px] text-muted-foreground">{name}</p>
              <Card>
                <p className={row}>
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  {joined(labels)}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
