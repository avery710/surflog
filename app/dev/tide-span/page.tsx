"use client";

import { ConditionTile, Figure } from "@/components/condition-tile";
import { TideChart } from "@/components/tide-chart";
import { LangSwitch } from "@/app/dev/lang-switch";
import { useLang, type Lang } from "@/lib/i18n";
import { tideTrend } from "@/lib/tide-display";
import type { TideEvent } from "@/lib/types";

import { SpanChart, type Variant } from "./base";
import { NONE, VARIANTS } from "./variants";

/**
 * Ways to mark a time span on the session card's Tide-tile curve, drawn on a
 * dev-only copy of components/tide-chart.tsx (./base.tsx). The real chart is
 * unchanged and shown first, next to the copy with no marking, so the copy
 * can be checked against it. Synthetic events only. Not linked from the real
 * app; 404s in production (app/dev/layout.tsx).
 */

// Strings that exist only on this page. Anything already in DICT goes
// through t() (tide.rising / tide.falling / tile.tideOpenMeteo ...).
const L: Record<string, Record<Lang, string>> = {
  title: { en: "Tide curve: marking a time span", "zh-TW": "潮汐曲線：標出一段時間" },
  intro: {
    en: "The curve itself is the real one, unchanged. Each variant marks the tide leg the session sat in (previous to next turning point: low to high is rising, high to low is falling) and keeps the session's own stretch exactly as today (thick blue line, end dot; the halo was removed 2026-10-22).",
    "zh-TW": "曲線本身維持現狀。每個版本標出衝浪時所在的那一段潮（前一個到下一個轉折點：乾潮到滿潮是漲潮，滿潮到乾潮是退潮），並照現在的樣子保留衝浪時段本身（藍色粗線、終點圓點；光暈已於 2026-10-22 移除）。",
  },
  jump: { en: "Jump to", "zh-TW": "跳到" },
  checkTitle: { en: "Check: the real chart and the copy", "zh-TW": "對照：實際圖表與複本" },
  checkShort: { en: "Check", "zh-TW": "對照" },
  checkNote: {
    en: "Top of each pair: the real TideChart (\"now\"). Below it: the dev copy with no marking. They should be identical.",
    "zh-TW": "每組上方是實際的 TideChart（「現在」），下方是沒有標記的複本，兩者應該一模一樣。",
  },
  now: { en: "now (TideChart)", "zh-TW": "現在（TideChart）" },
  copy: { en: "copy, no marking", "zh-TW": "複本，無標記" },
  isNew: { en: "new", "zh-TW": "新" },
  earlier: { en: "earlier idea, now on the real curve", "zh-TW": "先前的點子，改畫在實際曲線上" },
  extra: { en: "+{n} px taller than today", "zh-TW": "比現在高 {n} px" },
  sameH: { en: "same height as today (40 px)", "zh-TW": "高度與現在相同（40 px）" },
  coexist: { en: "With the session:", "zh-TW": "與衝浪時段並存：" },
  caseRising: { en: "Rising, 12:00 (low 09:05, high 15:20)", "zh-TW": "漲潮中 12:00（乾潮 09:05、滿潮 15:20）" },
  caseFalling: { en: "Falling, 17:30 (high 15:20, low 21:45)", "zh-TW": "退潮中 17:30（滿潮 15:20、乾潮 21:45）" },
  caseDuration: { en: "Rising, 11:00 to 13:00 (2 h session)", "zh-TW": "漲潮中 11:00–13:00（2 小時）" },
  caseTomorrow: { en: "Rising, 23:30 (next high is tomorrow)", "zh-TW": "漲潮中 23:30（下一個滿潮在明天）" },
  caseNoHeights: { en: "Falling, 17:30, events without heights", "zh-TW": "退潮中 17:30，事件沒有潮高" },
  // variant names + notes
  "band.name": { en: "Vertical band", "zh-TW": "垂直色帶" },
  "band.note": {
    en: "A faint column across the full height between the two turning points, hairline edges. Reads at a glance; the session halo sits on top of it. Trade-off: the column also tints the time labels and the whole chart height.",
    "zh-TW": "兩個轉折點之間整個高度的淡色帶，邊緣有細線。一眼就看得到；衝浪時段的光暈疊在上面。代價：色帶也會蓋住時間標籤與整張圖的高度。",
  },
  "band.co": { en: "halo and thick line draw over the band, which is lighter than the halo", "zh-TW": "光暈與粗線畫在色帶上方，色帶比光暈淡" },
  "area.name": { en: "Water under the leg", "zh-TW": "腿下方填色" },
  "area.note": {
    en: "A flat tint fills the space between the curve and the floor across the leg: a wedge that grows toward the high. Shows rising or falling by its shape, not just its width. Trade-off: it looks like a measured height, which the half-cosine isn't.",
    "zh-TW": "這一段曲線與底線之間填上淡色，形成往滿潮變厚的楔形，單看形狀就知道在漲或退。代價：看起來像量測到的潮高，但曲線其實只是示意。",
  },
  "area.co": { en: "the tint is lighter than the halo; halo and thick line stay on top", "zh-TW": "填色比光暈淡，光暈與粗線仍在最上層" },
  "hatch.name": { en: "Hatched water, leaning by direction", "zh-TW": "斜線填色，方向代表漲退" },
  "hatch.note": {
    en: "Same wedge as the tint but hatched with fine diagonal lines: \"/\" while rising, \"\\\" while falling, so direction is told without a colour. Trade-off: busiest of the area looks, and hatching at 3.5 px can shimmer on low-density screens.",
    "zh-TW": "與填色相同的楔形，但改用細斜線：漲潮是「/」、退潮是「\\」，不靠顏色就能分辨方向。代價：區域類裡最雜，3.5 px 的斜線在低密度螢幕上可能閃爍。",
  },
  "hatch.co": { en: "hatching is fine and light; the solid halo and thick line read clearly over it", "zh-TW": "斜線細且淡，實心光暈與粗線疊在上面仍清楚" },
  "spotlight.name": { en: "Spotlight", "zh-TW": "聚光" },
  "spotlight.note": {
    en: "The curve outside the leg fades to about a quarter; the leg keeps full strength and a slightly heavier 2.25 px line. No new shapes at all, so it is the calmest. Trade-off: the leg is only a little wider than the session's own thick line, so the two can blur.",
    "zh-TW": "這一段以外的曲線淡到約四分之一，這一段維持完整濃度並稍粗（2.25 px）。完全不加新圖形，最安靜。代價：這一段只比衝浪時段的粗線略細，兩者可能混在一起。",
  },
  "spotlight.co": { en: "the halo is what tells them apart; the session line is 3 px with a halo, the leg 2.25 px", "zh-TW": "靠光暈區分：衝浪時段 3 px 加光暈，這一段 2.25 px" },
  "fade.name": { en: "Fade toward the next turning point", "zh-TW": "朝下一個轉折點漸深" },
  "fade.note": {
    en: "A column that starts transparent and gets denser toward the leg's end, closed by a hairline at the next turning point: you read it as heading toward the dark side. Trade-off: the start of the leg is hard to see, so its left edge is vague.",
    "zh-TW": "色帶從透明開始，越靠近這一段的終點越深，並在下一個轉折點收一條細線：看起來就是在朝深色那邊前進。代價：這一段的起點很淡，左緣不明確。",
  },
  "fade.co": { en: "the session halo is stronger than the faded start; most legible once the session is past the middle", "zh-TW": "光暈比漸淡的起點強；衝浪時段在中段之後時最清楚" },
  "drop.name": { en: "Dotted drop lines", "zh-TW": "虛線垂線" },
  "drop.note": {
    en: "A dotted line runs from each turning point across the rest of the height (down from a high, up from a low, never through its own time label). Lightest in ink and adds no height. Trade-off: it marks the ends only, so the span between them is implied.",
    "zh-TW": "從兩個轉折點各拉一條虛線穿過其餘高度（滿潮往下、乾潮往上，不會穿過自己的時間標籤）。墨量最少、不增加高度。代價：只標出兩端，中間那段是靠想像。",
  },
  "drop.co": { en: "untouched: the lines are thin and dotted, the session stretch is a solid thick line", "zh-TW": "互不干擾：虛線很細，衝浪時段是實心粗線" },
  "carets.name": { en: "Carets in the water", "zh-TW": "水中箭頭" },
  "carets.note": {
    en: "Small triangles stand in the water under the leg: pointing up while rising, down while falling, on a faint tint. Says the direction in a symbol, not a colour. Trade-off: they need room, so a short leg at 140 px gets one or none.",
    "zh-TW": "這一段下方的水中站著小三角形：漲潮朝上、退潮朝下，底下有淡色。用符號而不是顏色說明方向。代價：需要空間，140 px 時短的一段只有一個或沒有。",
  },
  "carets.co": { en: "carets sit below the curve, the session's halo hugs the curve: they don't touch", "zh-TW": "箭頭在曲線下方，衝浪時段的光暈貼著曲線，兩者不相碰" },
  "track.name": { en: "Track with end caps", "zh-TW": "底部軌道與端點" },
  "track.note": {
    en: "A row under the chart: a thick 4 px track with a cap at each turning point, over a hairline for the whole day. Sits entirely outside the curve, which stays untouched. Trade-off: the chart grows taller and the eye travels down to read it.",
    "zh-TW": "圖表下方多一列：4 px 粗軌道，兩個轉折點各有端點，底下是整天的細線。完全在曲線外面，曲線不被碰到。代價：圖變高，視線要往下才讀得到。",
  },
  "track.co": { en: "the session is projected onto the track: a darker stretch (a dot when there is no duration)", "zh-TW": "衝浪時段投影在軌道上：較深的一段（沒有時長則是一個圓點）" },
  "dimension.name": { en: "Dimension line with length", "zh-TW": "標註線與長度" },
  "dimension.note": {
    en: "Like a technical drawing: a thin line with ticks at the two turning points and the leg's length in a small pill in the middle (fmtDuration, e.g. 6h15m). The only variant that gives a number. Trade-off: also taller, and a short leg's pill is wider than the leg.",
    "zh-TW": "像技術圖面：細線，兩個轉折點有刻度，中間的小膠囊寫出這一段的長度（例如 6h15m）。唯一有數字的版本。代價：同樣變高，短的一段膠囊比線還寬。",
  },
  "dimension.co": { en: "kept separate: the session stays only on the curve, so the pill is never covered", "zh-TW": "分開處理：衝浪時段只留在曲線上，膠囊不會被蓋住" },
  "dashed.name": { en: "Solid leg, dashed rest", "zh-TW": "實線這一段、其餘虛線" },
  "dashed.note": {
    en: "The leg is a solid 2 px line; the rest of the curve turns dashed and lighter. Cheap and clear, nothing extra drawn. Trade-off: a dashed curve looks like a forecast or an estimate, which changes the whole chart's tone.",
    "zh-TW": "這一段是 2 px 實線，其餘曲線變成較淡的虛線。簡單清楚、不多畫東西。代價：虛線看起來像預測或估計，會改變整張圖的調性。",
  },
  "dashed.co": { en: "the session's halo and 3 px line are the only heavy, haloed part; the solid leg is thinner", "zh-TW": "只有衝浪時段有光暈與 3 px 粗線，實線這一段比較細" },
};

const l = (key: string, lang: Lang) => L[key]?.[lang] ?? key;

interface Case {
  key: string;
  label: string;
  when: string;
  end?: string;
  events: TideEvent[];
}

const ev = (type: "high" | "low", time: string, heightM: number | null): TideEvent => ({ type, time, heightM });

const DAY = [
  ev("high", "2026-10-18T02:40", 1.1),
  ev("low", "2026-10-18T09:05", 0.3),
  ev("high", "2026-10-18T15:20", 1.4),
  ev("low", "2026-10-18T21:45", 0.2),
];

const CASES: Case[] = [
  { key: "caseRising", label: "caseRising", when: "2026-10-18T12:00", events: DAY },
  {
    key: "caseFalling",
    label: "caseFalling",
    when: "2026-10-18T17:30",
    events: [...DAY.slice(1), ev("high", "2026-10-19T04:10", 1.3)],
  },
  { key: "caseDuration", label: "caseDuration", when: "2026-10-18T11:00", end: "2026-10-18T13:00", events: DAY },
  {
    key: "caseTomorrow",
    label: "caseTomorrow",
    when: "2026-10-18T23:30",
    events: [DAY[2], DAY[3], ev("high", "2026-10-19T04:10", 1.3), ev("low", "2026-10-19T10:30", 0.35)],
  },
  {
    key: "caseNoHeights",
    label: "caseNoHeights",
    when: "2026-10-18T17:30",
    events: [
      ev("low", "2026-10-18T09:05", null),
      ev("high", "2026-10-18T15:20", null),
      ev("low", "2026-10-18T21:45", null),
    ],
  },
];

const WIDTHS = [140, 220, 360];

function Tile({ c, chart }: { c: Case; chart: React.ReactNode }) {
  const { t } = useLang();
  const trend = tideTrend(c.events, c.when);
  return (
    <ConditionTile
      label={t("tile.tideOpenMeteo")}
      value={
        trend ? <Figure value={<span className="capitalize">{t(trend === "rising" ? "tide.rising" : "tide.falling")}</span>} /> : null
      }
      sub={chart}
    />
  );
}

function Sized({ w, children }: { w: number; children: React.ReactNode }) {
  return (
    <div style={{ width: w }} className="max-w-full min-w-0">
      {children}
    </div>
  );
}

function VariantSection({ variant, isNew }: { variant: Variant; isNew: boolean }) {
  const { lang } = useLang();
  const extra = variant.extra ?? 0;
  return (
    <section id={`v-${variant.id}`} className="scroll-mt-4 min-w-0 rounded-[var(--r-card)] bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-[15px] font-bold">{l(`${variant.id}.name`, lang)}</h2>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
            (isNew ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")
          }
        >
          {isNew ? l("isNew", lang) : l("earlier", lang)}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {extra ? l("extra", lang).replace("{n}", String(extra)) : l("sameH", lang)}
        </span>
      </div>
      <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">{l(`${variant.id}.note`, lang)}</p>
      <p className="mt-1 max-w-prose text-[12.5px] text-muted-foreground">
        <span className="font-semibold">{l("coexist", lang)}</span> {l(`${variant.id}.co`, lang)}
      </p>
      <div className="mt-3 flex min-w-0 flex-col gap-3">
        {CASES.map((c) => (
          <div key={c.key} className="min-w-0">
            <div className="mb-1 text-[11.5px] font-semibold text-muted-foreground">{l(c.label, lang)}</div>
            <div className="flex min-w-0 flex-wrap items-start gap-3">
              {WIDTHS.map((w) => (
                <Sized key={w} w={w}>
                  <Tile c={c} chart={<SpanChart events={c.events} sessionWhen={c.when} sessionEnd={c.end} variant={variant} />} />
                </Sized>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TideSpanPage() {
  const { lang } = useLang();
  return (
    <div className="mx-auto w-full max-w-[1000px] min-w-0 px-3.5 py-6 sm:px-4.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-extrabold">{l("title", lang)}</h1>
        <LangSwitch />
      </div>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">{l("intro", lang)}</p>

      <nav className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px]" aria-label={l("jump", lang)}>
        <span className="font-semibold text-muted-foreground">{l("jump", lang)}</span>
        <a href="#check" className="rounded-full bg-secondary px-2.5 py-1 font-semibold">
          {l("checkShort", lang)}
        </a>
        {VARIANTS.map(({ variant }, i) => (
          <a key={variant.id} href={`#v-${variant.id}`} className="rounded-full bg-secondary px-2.5 py-1 font-semibold">
            {i + 1}. {l(`${variant.id}.name`, lang)}
          </a>
        ))}
      </nav>

      <div className="mt-5 flex min-w-0 flex-col gap-4">
        <section id="check" className="scroll-mt-4 min-w-0 rounded-[var(--r-card)] bg-card p-4 shadow-soft">
          <h2 className="text-[15px] font-bold">{l("checkTitle", lang)}</h2>
          <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">{l("checkNote", lang)}</p>
          <div className="mt-3 flex min-w-0 flex-col gap-3">
            {CASES.map((c) => (
              <div key={c.key} className="min-w-0">
                <div className="mb-1 text-[11.5px] font-semibold text-muted-foreground">{l(c.label, lang)}</div>
                <div className="flex min-w-0 flex-wrap items-start gap-3">
                  {WIDTHS.map((w) => (
                    <Sized key={w} w={w}>
                      <div className="mb-1 font-mono text-[10px] text-muted-foreground">{l("now", lang)}</div>
                      <div data-chart="real">
                        <Tile c={c} chart={<TideChart events={c.events} sessionWhen={c.when} sessionEnd={c.end} />} />
                      </div>
                      <div className="mb-1 mt-2 font-mono text-[10px] text-muted-foreground">{l("copy", lang)}</div>
                      <div data-chart="copy">
                        <Tile c={c} chart={<SpanChart events={c.events} sessionWhen={c.when} sessionEnd={c.end} variant={NONE} />} />
                      </div>
                    </Sized>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {VARIANTS.map(({ variant, isNew }) => (
          <VariantSection key={variant.id} variant={variant} isNew={isNew} />
        ))}
      </div>
    </div>
  );
}
