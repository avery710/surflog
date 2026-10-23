"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, Hash, MapPin, Tag, WandSparkles, X } from "lucide-react";
import { LangSwitch } from "@/app/dev/lang-switch";
import { KnownTagsProvider, TagPicker } from "@/components/tag-picker";
import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Session tags (SURFLOG-11): UI proposals, nothing built yet. Suggestions
 * only. Static synthetic markup: no t(), no imports of the real log form,
 * card or filter (none of them know about tags). Classes copied from
 * components/entry-card.tsx and components/session-filter.tsx so the
 * proposals sit in the real look.
 *
 * Chosen so far (Avery, 2026-10-23):
 *   1  picker: grouped chips (B), small group labels
 *   2  card: one quiet line under the notes (C), tag icon in a soft circle (7)
 *   3  filter chip: "#" icon, pick several (B)
 * Longboard/shortboard/foam-board tags were dropped: the board chip says it.
 */

type Bi = { en: string; zh: string; alts?: string[]; open?: boolean; enAlts?: string[] };

/**
 * zh = the wording used by the picker. Decided by Avery on 2026-10-23 except
 * where `open` is set (Size is new and unreviewed). alts are
 * the options that were not taken, or, for an open row, the new proposals.
 */
const STARTERS: Record<string, Bi[]> = {
  Waves: [
    { en: "Glassy", zh: "鏡面海", alts: ["清澈", "鏡面", "平滑", "玻璃面"] },
    { en: "Clean", zh: "浪型整齊", alts: ["乾淨", "浪型漂亮", "浪線整齊", "工整", "規律"] },
    { en: "Peeling", zh: "很順", alts: ["順暢", "流暢"], enAlts: ["Down the line", "Flowy", "Smooth"] },
    { en: "Barrel", zh: "管浪", alts: ["桶浪", "進管"] },
    { en: "Choppy", zh: "浪面亂", alts: ["雜亂", "雜浪多"] },
    { en: "Closeouts", zh: "整排蓋", alts: ["全蓋", "全蓋浪"] },
  ],
  Size: [
    { en: "Ankle to waist", zh: "腳踝到腰", alts: ["腳踝到膝", "腿到腰", "腰高"] },
    { en: "Chest to shoulder", zh: "胸肩浪", alts: ["胸到肩", "胸高", "肩高"] },
    { en: "Head-high", zh: "一人高", alts: ["頭高", "一個頭"] },
    { en: "Overhead", zh: "過頭", alts: ["高過頭"] },
    { en: "Double overhead+", zh: "兩人高及以上", alts: ["兩倍頭", "雙過頭", "兩個頭"] },
  ],
  Crowd: [
    { en: "Crowded", zh: "擁擠", alts: ["人多", "人擠", "擠爆"] },
    { en: "Quiet", zh: "人少", alts: ["沒什麼人", "清淨"] },
    { en: "Solo", zh: "包場", alts: ["獨衝", "一個人衝"] },
  ],
  Others: [
    { en: "Dawn patrol", zh: "開燈", alts: ["晨衝", "日出衝", "早起衝"] },
    { en: "Sunset", zh: "關燈", alts: ["日落衝", "夕陽場", "傍晚衝"] },
    { en: "Lesson", zh: "上課", alts: ["衝浪課", "教學"] },
    { en: "Surf trip", zh: "衝浪旅行", alts: ["浪旅", "遠征"] },
    { en: "With surf buddies", zh: "跟浪友", alts: ["浪友同行", "浪友同衝", "和浪友一起", "跟衝浪夥伴", "揪浪友", "揪團衝", "跟朋友一起"] },
  ],
};
const YOURS: Bi[] = [
  { en: "With Ming", zh: "跟阿明" },
  { en: "Nanwan crew", zh: "南灣夥伴" },
];
const GROUP_ZH: Record<string, string> = { Waves: "浪況", Size: "浪高", Crowd: "擁擠度", Others: "其他" };
const ALL: Bi[] = [...Object.values(STARTERS).flat(), ...YOURS];
const COUNTS: Record<string, number> = { Glassy: 6, Clean: 4, Crowded: 3, Solo: 5, "Dawn patrol": 2, "With Ming": 3 };

function tagText(k: string, lang: Lang) {
  const t = ALL.find((x) => x.en === k);
  return t ? (lang === "zh-TW" ? t.zh : t.en) : k;
}

/* ------------------------------------------------------------------ 1 */

/** Synthetic history for the real TagPicker: what this "user" has used, and how often. */
const HISTORY = {
  custom: ["With Ming", "Nanwan crew"],
  counts: new Map([["Glassy", 9], ["With Ming", 8], ["Solo", 6], ["Crowded", 5], ["Dawn patrol", 4], ["Nanwan crew", 2], ["Barrel", 1]]),
};
const EMPTY_HISTORY = { custom: [] as string[], counts: new Map<string, number>() };

/** The real picker (components/tag-picker.tsx) on synthetic history. */
function PickerDemo({ history, initial }: { history: typeof HISTORY; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  return (
    <KnownTagsProvider custom={history.custom} counts={history.counts}>
      <TagPicker value={tags} onChange={setTags} />
    </KnownTagsProvider>
  );
}

/* ------------------------------------------------------------------ 2 */

const goalPill = "flex h-7 items-center rounded-full bg-secondary px-3 text-[13.5px] font-medium tracking-[-0.01em]";
const SAMPLE_TAGS = ["Glassy", "Solo", "Dawn patrol"];

type Style = {
  icon: ReactNode;
  /** how each tag is written */
  wrap?: (text: string) => ReactNode;
  sep?: string;
  tone?: string;
};

/** The tag line itself, in the style being compared. */
function TagLine({ style, tags, lang }: { style: Style; tags: string[]; lang: Lang }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] font-medium text-muted-foreground", style.tone)}>
      {style.icon}
      {tags.map((k, i) => (
        <span key={k}>
          {style.wrap ? style.wrap(tagText(k, lang)) : tagText(k, lang)}
          {i < tags.length - 1 && <span className="ml-1.5 opacity-40">{style.sep ?? "·"}</span>}
        </span>
      ))}
    </p>
  );
}

/** A hand-drawn session card up to the notes, then the chosen tag line. */
function FakeCard({ style, lang }: { style: Style; lang: Lang }) {
  const goals = lang === "zh-TW" ? ["鴨潛", "底轉"] : ["Duck dive", "Bottom turn"];
  const board = lang === "zh-TW" ? "迷你長板 6'2\"" : "Mini-Mal 6'2\"";
  return (
    <article className="rounded-[var(--r-card)] bg-card p-4 shadow-soft">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-bold">{lang === "zh-TW" ? "佳樂水" : "Jialeshui"}</h3>
        <span className="font-mono text-[12px] text-muted-foreground">Thu 22 Oct · 07:00–09:30</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className={goalPill}>{board}</span>
        {goals.map((g) => (
          <span key={g} className={cn(goalPill, "gap-1")}>
            <Check className="size-3.5 text-primary" aria-hidden />
            {g}
          </span>
        ))}
      </div>
      <p className="mt-2.5 text-[15px] leading-relaxed">
        {lang === "zh-TW" ? "早上退潮的時候浪型很乾淨，胸肩高，離岸風。" : "Clean shape on the dropping tide, chest to shoulder high, light offshore."}
      </p>
      <div className="mt-1.5">
        <TagLine style={style} tags={SAMPLE_TAGS} lang={lang} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {["Swell 1.2–1.6 m", "Wind 3 m/s", "Tide ↓ 11:20"].map((x) => (
          <div key={x} className="rounded-[var(--r-tile)] bg-secondary px-2 py-2 font-mono text-[11px] text-muted-foreground">
            {x}
          </div>
        ))}
      </div>
    </article>
  );
}

/** Chosen (2026-10-23, option 7 of 10): the tag icon in a soft circle, like the board chip's photo. */
const CHOSEN: Style = {
  icon: (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary">
      <Tag className="size-3 opacity-70" aria-hidden />
    </span>
  ),
};

/* ------------------------------------------------------------------ 3 */

function ChipStatic({ icon, value, name }: { icon: ReactNode; value?: string; name: string }) {
  const set = !!value;
  return (
    <span
      aria-label={value ? `${name}: ${value}` : name}
      title={name}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full text-[13px] font-medium",
        set ? "bg-primary pr-2 pl-2.5 text-primary-foreground" : "bg-secondary px-2 text-muted-foreground"
      )}
    >
      {icon}
      {set && (
        <span className="ml-1 flex items-center gap-1 whitespace-nowrap">
          <span className="max-w-[8rem] truncate">{value}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </span>
      )}
    </span>
  );
}

const ic = "size-3.5";
function Bar({ tag, lang, count, clear }: { tag: ReactNode; lang: Lang; count: number; clear?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[var(--r-card)] bg-card p-3 shadow-soft">
      <div className="inline-flex items-center gap-1.5 pl-1 font-sans text-[13px] font-bold text-muted-foreground">
        {lang === "zh-TW" ? "記錄" : "Sessions"}
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1.5 font-mono text-[10.5px] font-semibold text-foreground">
          {count}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <ChipStatic icon={<CalendarDays className={ic} aria-hidden />} name="Date" />
        <ChipStatic icon={<MapPin className={ic} aria-hidden />} name="Spot" />
        <ChipStatic icon={<WandSparkles className={ic} aria-hidden />} name="Board" />
        {tag}
        {clear && (
          <span className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted-foreground">
            <X className="size-3.5" aria-hidden />
            {lang === "zh-TW" ? "清除" : "Clear"}
          </span>
        )}
      </div>
    </div>
  );
}

function MenuMock({ lang, checked }: { lang: Lang; checked: string[] }) {
  const rows = ["Glassy", "Clean", "Crowded", "Solo", "Dawn patrol", "With Ming"];
  return (
    <div className="w-[190px] rounded-[var(--r-card)] bg-popover p-1 shadow-menu">
      <div className="flex h-8 items-center rounded-[var(--r-tile)] px-2 text-[13px] text-muted-foreground">{lang === "zh-TW" ? "所有標籤" : "All tags"}</div>
      {rows.map((k) => {
        const on = checked.includes(k);
        return (
          <div key={k} className={cn("flex h-8 items-center justify-between rounded-[var(--r-tile)] px-2 text-[13px]", on && "bg-secondary")}>
            <span className="flex items-center gap-2">
              <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                {on && <Check className="size-3" aria-hidden />}
              </span>
              {tagText(k, lang)}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{COUNTS[k]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

function Block({ id, title, note, children }: { id?: string; title?: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      {title && <h3 className="text-[14px] font-bold">
        {id && <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[11px] text-primary-foreground">{id}</span>}
        {title}
      </h3>}
      {note && <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function TagsPreview() {
  const { lang } = useLang();
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">Session tags: UI proposals (SURFLOG-11)</h1>
        <p className="max-w-prose text-[13px] text-muted-foreground">
          Suggestions only; nothing here is wired up and the real form, card and filter are unchanged. Chosen: grouped chips for the picker, one quiet
          line on the card, a “#” chip that picks several for the filter. “With Ming” and “Nanwan crew” stand for tags you typed earlier; the real
          thing would learn them from your own sessions.
        </p>
        <LangSwitch />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Starter tags</h2>
        <p className="max-w-prose text-[13px] text-muted-foreground">
          Descriptive only, no judgement tags (Epic, Good, Bad): the 1–5 rating was removed on request. Wind and tide are not tags; they come from
          Open-Meteo and CWA. Board-type tags (longboard day, foam board) are left out: the board chip already says it. Starters would be stored by
          their English key and shown in the viewer’s language; tags you type stay as typed. The zh-TW wording is Avery’s pick (2026-10-23). New since: “Peeling” (from 很順), “Barrel”, and a Size group for wave height on the surfer’s body scale, with the small sizes merged into ranges. Size wording is unreviewed.
        </p>
        <div className="max-w-3xl overflow-hidden rounded-[var(--r-card)] bg-card shadow-soft">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">Group</th>
                <th className="px-3 py-2 font-semibold">English</th>
                <th className="px-3 py-2 font-semibold">繁體中文</th>
                <th className="px-3 py-2 font-semibold">Not taken / new options</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(STARTERS).flatMap(([g, tags]) =>
                tags.map((t, i) => (
                  <tr key={t.en} className={i === 0 ? "border-t border-border" : ""}>
                    <td className="px-3 py-1.5 text-muted-foreground">{i === 0 ? `${g} · ${GROUP_ZH[g]}` : ""}</td>
                    <td className="px-3 py-1.5 font-medium">
                      {t.en}
                      {t.enAlts && <span className="block text-[11.5px] font-normal text-muted-foreground">or {t.enAlts.join(" · ")}</span>}
                    </td>
                    <td className="px-3 py-1.5 font-medium">
                      {t.zh}{t.open && <span className="ml-1.5 text-[11px] font-normal text-primary">English to pick</span>}
                    </td>
                    <td className={cn("px-3 py-1.5", "text-muted-foreground")}>{t.alts?.join(" · ")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-[17px] font-bold">1 · Picker in the log form and edit panel: collapsible grouped chips</h2>
        <Block
          title="Collapsed first, “All tags” opens the groups"
          note="The real picker. Collapsed it shows what is picked (Solo here), then the six most used (Glassy, With Ming, Crowded, Dawn patrol, Nanwan crew, Barrel), then + Add tag; “All tags” opens the grouped list. A new user with no history sees a few common starters instead."
        >
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-[360px] max-w-full rounded-[var(--r-card)] bg-card p-4 shadow-soft"><PickerDemo history={HISTORY} initial={["Solo"]} /></div>
            <div className="w-[360px] max-w-full rounded-[var(--r-card)] bg-card p-4 shadow-soft"><PickerDemo history={EMPTY_HISTORY} initial={[]} /></div>
          </div>
        </Block>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-[17px] font-bold">2 · Session card: one quiet line, tag icon in a soft circle</h2>
        <Block title="Chosen" note="Option 7 of ten icon treatments. Dots between tags, grey text, nothing tappable. Shown at 360 px and 560 px.">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-[360px] max-w-full"><FakeCard style={CHOSEN} lang={lang} /></div>
            <div className="w-[560px] max-w-full"><FakeCard style={CHOSEN} lang={lang} /></div>
          </div>
        </Block>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-[17px] font-bold">3 · Tag filter chip: “#”, pick several</h2>
        <Block note="Checkbox menu: sessions that have any of the ticked tags. The chip shows the first plus a count. The counts are how many of your sessions carry each tag.">
          <div className="flex max-w-md flex-col gap-3">
            <Bar lang={lang} count={12} tag={<ChipStatic icon={<Hash className={ic} aria-hidden />} name="Tag" />} />
            <Bar lang={lang} count={9} clear tag={<ChipStatic icon={<Hash className={ic} aria-hidden />} name="Tag" value={`${tagText("Glassy", lang)} +1`} />} />
            <MenuMock lang={lang} checked={["Glassy", "Clean"]} />
          </div>
        </Block>
      </section>
    </main>
  );
}
