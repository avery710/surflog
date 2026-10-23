"use client";

import { ConditionTile, Figure } from "@/components/condition-tile";
import { LangSwitch } from "@/app/dev/lang-switch";
import { fmtDuration } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
import { tideTrend } from "@/lib/tide-display";
import type { TideEvent } from "@/lib/types";

import { SpanChart } from "../tide-span/base";
import { DEFS, LABEL_DEFS, type Info } from "./variants";

/**
 * Ways to draw the session's own time span in blue on the Tide-tile curve,
 * after the "Growth, plotted." poster (thick round-capped line, solid marker
 * shapes at the ends, bold label + small caption). Each variant is drawn by
 * the dev copy of the real chart (../tide-span/base.tsx, which now matches
 * components/tide-chart.tsx including the spotlight and the blue), inside the
 * real ConditionTile with the real Rising / Falling headline. Synthetic events
 * only; suggestions, the real card shows variant 1 ("now"). 404s in
 * production (app/dev/layout.tsx).
 */

// Strings that exist only on this page. Anything already in DICT goes
// through t() (tile.tideOpenMeteo, tide.rising, tide.falling ...).
const L: Record<string, Record<Lang, string>> = {
  title: { en: "Tide curve: the session's span in blue", "zh-TW": "潮汐曲線：衝浪時段標成藍色" },
  intro: {
    en: "The session's own length (start to end) on the Tide tile's curve, in the app blue, after two posters. \"Growth, plotted.\": one thick round-capped line, solid marker shapes, a bold label with a small caption. \"A career that moves you.\": a thin line that stops short of each word and starts again after it, the word in the line's own colour. So the span is one solid blue line (no halo, no dots: its ends are the line's round caps), and the low / high times sit inside gaps cut in the curve, replacing the hollow dots. The curve uses the height the old labels needed; the tile stays 40 px. Where a variant needs more room it says how many px taller. Without a duration every variant shows a single blue dot (no white ring).",
    "zh-TW": "曲線上標出衝浪本身的長度（開始到結束），用 App 的藍色，參考兩張海報。「Growth, plotted.」：一條粗圓頭線、實心標記形狀、粗體標籤加小字說明。「A career that moves you.」：細線在每個字前停下、字後再接上，字與線同色。所以時段是一條實心藍線（沒有光暈、沒有圓點，兩端就是線本身的圓頭），滿潮／乾潮的時間嵌在曲線切出的缺口裡，取代原本的空心圓點。曲線用掉舊標籤所需的高度，磚塊維持 40 px。需要更多高度的版本會註明高多少。沒有時長時，每個版本都只有一個藍點（沒有白色外圈）。",
  },
  jump: { en: "Jump to", "zh-TW": "跳到" },
  now: { en: "now (real chart)", "zh-TW": "現在（實際圖表）" },
  isNew: { en: "new", "zh-TW": "新" },
  sameH: { en: "same height as today (40 px)", "zh-TW": "高度與現在相同（40 px）" },
  taller: { en: "+{n} px taller with a duration, +{m} px without", "zh-TW": "有時長時高 {n} px，沒有時長時高 {m} px" },
  tallerSame: { en: "+{n} px taller than today", "zh-TW": "比現在高 {n} px" },
  labelsTitle: { en: "Time labels set into the curve: iterations", "zh-TW": "嵌在曲線裡的時間標籤：幾種寫法" },
  labelsIntro: {
    en: "The label is a gap cut in the curve with the time inside it, centred on the curve, bending with it, and in its own tone. Edge cases: near the tile's left or right edge the label slides in so the text never clips; a turning point inside the blue span is cut into the span in blue when the span is long enough to stay a line on both sides, otherwise the label is dropped; a label that would collide with another is slid up to 12 px away, else the one farther from the session is dropped. The span below is the real one.",
    "zh-TW": "標籤是在曲線上切一個缺口、把時間放在裡面，置中於曲線上並順著曲線彎曲，顏色與曲線同調。邊界處理：靠近磚塊左右邊緣時標籤往內移，字不會被切掉；轉折點落在藍色時段內時，若時段夠長（兩側仍是線）就把標籤以藍色嵌進時段，否則捨棄；兩個標籤會相撞時，離衝浪較遠的往旁邊挪最多 12 px，挪不開就捨棄。下方的時段是實際圖表的樣子。",
  },
  jumpLabels: { en: "Labels", "zh-TW": "標籤" },
  nodur: { en: "Without a duration:", "zh-TW": "沒有時長時：" },
  trade: { en: "Trade-off:", "zh-TW": "代價：" },
  start: { en: "start", "zh-TW": "開始" },
  end: { en: "end", "zh-TW": "結束" },
  caseRising: { en: "Rising, 11:00 to 13:00 (2 h session)", "zh-TW": "漲潮中 11:00–13:00（2 小時）" },
  caseFalling: { en: "Falling, 17:30 to 19:00 (1.5 h session)", "zh-TW": "退潮中 17:30–19:00（1.5 小時）" },
  caseShort: { en: "Rising, 12:00 to 12:30 (30 min session)", "zh-TW": "漲潮中 12:00–12:30（30 分鐘）" },
  caseCross: {
    en: "Rising, 14:30 to 16:30, passes the 15:20 high",
    "zh-TW": "漲潮中 14:30–16:30，經過 15:20 的滿潮",
  },
  caseCrossLong: {
    en: "Rising, 13:30 to 17:30 (4 h), passes the 15:20 high: its time is cut into the blue span",
    "zh-TW": "漲潮中 13:30–17:30（4 小時），經過 15:20 的滿潮：時間嵌進藍色時段",
  },
  caseLeft: {
    en: "Rising, 06:30 to 07:30: the previous high (02:40) sits at the tile's left edge (at 140 px the nearer low wins the room and it is dropped)",
    "zh-TW": "漲潮中 06:30–07:30：前一個滿潮（02:40）在磚塊最左邊（140 px 時較近的乾潮先佔位，它會被捨棄）",
  },
  caseRight: {
    en: "Falling, 17:00 to 17:40: the next low (21:45) sits at the tile's right edge (at 140 px it would touch the span and is dropped)",
    "zh-TW": "退潮中 17:00–17:40：下一個乾潮（21:45）在磚塊最右邊（140 px 時會碰到時段，所以捨棄）",
  },
  caseClose: {
    en: "Falling, 13:00 to 13:40: high 12:00 and low 14:10 only 2 h apart, labels close",
    "zh-TW": "退潮中 13:00–13:40：滿潮 12:00 與乾潮 14:10 只差 2 小時，標籤很近",
  },
  caseNone: { en: "Rising, 12:00, no duration (only a start)", "zh-TW": "漲潮中 12:00，沒有時長（只有開始）" },
  caseNoHeights: { en: "Falling, 17:30 to 18:30, events without heights", "zh-TW": "退潮中 17:30–18:30，事件沒有潮高" },
  // variant names, what the user sees, no-duration behaviour, trade-off
  "now.name": { en: "Blue span (now)", "zh-TW": "藍色時段（現在）" },
  "now.note": {
    en: "What the real chart draws today: the span is one solid blue round-capped line as thick as the curve (2.25 px), with flat ends where it meets the grey curve (no dots, no halo); the rest of the curve is a light grey at full strength, every end of it round, including both sides of each label gap; the low and high times sit in gaps of the curve and bend with it (on a slightly flattened copy of the curve, with a little letter spacing, so the glyphs of a low do not squeeze). Taken from the posters: the round-capped line, the route that stops at words, and words that follow the line.",
    "zh-TW": "目前實際圖表的樣子：時段是一條與曲線同粗（2.25 px）的實心藍色圓頭線，兩端是平的、與灰色曲線無縫相接（沒有圓點、沒有光暈）；其餘曲線是淺灰色、不變淡，每一個端點（包括每個標籤缺口的兩側）都是圓頭；滿潮與乾潮的時間嵌在曲線的缺口裡，並順著曲線彎曲（字走在稍微拉平的曲線上，字距略為加寬，乾潮處的字就不會擠在一起）。取自海報：圓頭線、「線在字前停下」，以及「字沿著線走」。",
  },
  "now.nodur": { en: "one blue dot (no white ring) on the curve at the start", "zh-TW": "只有起點一個藍點" },
  "now.trade": { en: "calmest, a 1 h span is only about 6 px long at 140 px and a 30 min one is drawn at a 6 px minimum (centred on the real span), so short sessions read as a stub", "zh-TW": "最安靜；140 px 寬時 1 小時只有約 6 px，30 分鐘的則至少畫 6 px（以實際時段為中心），所以短時段看起來只是一小段線" },
  "route.name": { en: "Route", "zh-TW": "路線" },
  "route.note": {
    en: "The span becomes the boldest thing on the chart: a 4.5 px solid blue line with no halo, a blue circle where you started and a rounded square where you finished (the markers are this variant's whole point, so it keeps them, without a white ring), and the rest of the curve fades further (20%). Taken from the poster: the thick line and the distinct solid end shapes.",
    "zh-TW": "時段變成圖上最醒目的東西：4.5 px 實心藍線、不加光暈，起點是藍色圓形、終點是藍色圓角方形（標記是這個版本的重點，所以保留，但沒有白色外圈），其餘曲線再淡一些（20%）。取自海報：粗線與不同的實心端點形狀。",
  },
  "route.nodur": { en: "a single blue circle, nothing dims", "zh-TW": "只有一個藍色圓形，沒有東西變淡" },
  "route.trade": { en: "under about 9 px (1 h or less at 140 px) the square is dropped, so the shape cue only shows on longer sessions", "zh-TW": "短於約 9 px（140 px 時 1 小時以內）會省略方形，所以形狀的辨識只在較長的時段才看得到" },
  "label.name": { en: "Bold time + caption", "zh-TW": "粗體時間加小字" },
  "label.note": {
    en: "The solid blue span, plus the poster's label pair hanging under the start: the start time in bold blue mono (\"11:00\") with the length as a small grey caption under it (\"2h\"), on a new row beneath the chart. Taken from the poster: the bold label with a plain caption.",
    "zh-TW": "實心藍色時段，再加上海報風格的標籤：起點下方粗體藍色等寬字的開始時間（「11:00」），底下用小灰字寫長度（「2h」），放在圖表下方新增的一列。取自海報：粗體標籤加一行平實說明。",
  },
  "label.nodur": { en: "the start time only, no caption, and the extra row shrinks to 12 px", "zh-TW": "只有開始時間、沒有小字，多出的一列縮成 12 px" },
  "label.trade": { en: "says something the card header already says (the time), at the cost of a taller tile", "zh-TW": "卡片標題已經寫了時間，這裡等於重複，而且讓磚塊變高" },
  "pill.name": { en: "Time pill", "zh-TW": "時間膠囊" },
  "pill.note": {
    en: "The solid blue span, plus a solid blue pill with white bold mono \"11:00–13:00\" centred under it, joined by a small caret. Reads as a tag on the span. Taken from the poster: the solid, saturated marker and the bold mono label.",
    "zh-TW": "實心藍色時段，下方置中放一個實心藍色膠囊，白色粗體等寬字寫「11:00–13:00」，並用小三角連回時段。像貼在時段上的標籤。取自海報：實心飽和的標記與粗體等寬標籤。",
  },
  "pill.nodur": { en: "a pill with the start time only (\"11:00\") under the dot", "zh-TW": "圓點下方一個只寫開始時間（「11:00」）的膠囊" },
  "pill.trade": { en: "the biggest blue shape on the tile, so it competes with the headline", "zh-TW": "是磚塊上最大的藍色形狀，會和標題搶視線" },
  "milestones.name": { en: "Milestones", "zh-TW": "里程標" },
  "milestones.note": {
    en: "The poster's route idea: a blue circle at the start and a four-lobed clover at the end on a 3.5 px blue line, with a bold mono time under each marker and a small caption (start / end) beneath. Close ends share the row side by side. Taken from the poster: distinct solid shapes, bold label plus caption.",
    "zh-TW": "海報的路線概念：3.5 px 藍線，起點藍色圓形、終點四瓣花形，每個標記下方有粗體等寬時間與小字說明（開始／結束）。兩端靠近時兩個標籤並排。取自海報：不同的實心形狀、粗體標籤加小字。",
  },
  "milestones.nodur": { en: "one blue circle with the start time under it, 12 px extra row", "zh-TW": "一個藍色圓形，下方是開始時間，多出 12 px 的一列" },
  "milestones.trade": { en: "closest to the poster, and the busiest: two labels in a ~120 px tile", "zh-TW": "最接近海報，也最擁擠：約 120 px 寬的磚塊裡放兩個標籤" },
  "track.name": { en: "Route track below", "zh-TW": "下方路線軌道" },
  "track.note": {
    en: "The curve keeps a thin solid blue stretch, and the span is projected onto its own row below as a thick 4.5 px round-capped blue track with a circle and a rounded square at its ends, tied to the curve by two dotted blue lines (solid blue dots, no tint). Taken from the poster: the thick line, the end shapes, the route-on-its-own-path feel.",
    "zh-TW": "曲線上保留一小段細藍線，並把時段投影到下方獨立一列，成為 4.5 px 粗圓頭藍色軌道，兩端是圓形與圓角方形，用兩條藍色虛線連回曲線。取自海報：粗線、端點形狀、走在自己路上的感覺。",
  },
  "track.nodur": { en: "a blue dot on the curve and a blue circle on the track", "zh-TW": "曲線上一個藍點，軌道上一個藍色圓形" },
  "track.trade": { en: "the eye travels down to read it, and a span that is 30 min or less gives a track stub only a few px long", "zh-TW": "視線要往下才讀得到，30 分鐘以內的時段在軌道上只剩幾 px 的短線" },
  "embBase.name": { en: "a. Time only, 8.5 px (the real chart)", "zh-TW": "a. 只有時間，8.5 px（實際圖表）" },
  "embBase.note": { en: "Mono 8.5 px medium, a 3 px clear gap either side, only the two turning points around the session. The calmest: the line just pauses.", "zh-TW": "等寬 8.5 px 中粗，兩側各留 3 px 缺口，只標衝浪前後兩個轉折點。最安靜：線只是停一下。" },
  "embBase.nodur": { en: "same; the single blue dot sits on the curve, labels slide clear of it", "zh-TW": "相同；單一藍點在曲線上，標籤會往旁邊讓開" },
  "embBase.trade": { en: "the time alone does not say high or low, the curve's shape has to", "zh-TW": "光看時間分不出滿潮或乾潮，要靠曲線形狀判斷" },
  "embLetter.name": { en: "b. Letter + time (H 15:20)", "zh-TW": "b. 字母加時間（滿 15:20）" },
  "embLetter.note": { en: "A tiny L or H (zh-TW 乾 or 滿) before the time, so the stop says which turning point it is. About 10 px wider per label.", "zh-TW": "時間前面加一個小小的 L 或 H（中文用乾或滿），讓這一站自己說明是哪種轉折點。每個標籤約寬 10 px。" },
  "embLetter.nodur": { en: "same, the letters stay", "zh-TW": "相同，字母保留" },
  "embLetter.trade": { en: "wider gaps cut more of a 140 px curve, and two labels collide sooner", "zh-TW": "缺口變寬，140 px 的曲線被切掉更多，兩個標籤也更容易相撞" },
  "embBig.name": { en: "c. 10 px semibold", "zh-TW": "c. 10 px 半粗體" },
  "embBig.note": { en: "Bigger, heavier text, closer to the posters' bold words. The gap grows with it.", "zh-TW": "更大更粗的字，更接近海報上的粗體字。缺口跟著變大。" },
  "embBig.nodur": { en: "same", "zh-TW": "相同" },
  "embBig.trade": { en: "the text is about as tall as half the curve's travel, so it competes with the shape", "zh-TW": "字高約是曲線起伏的一半，會和曲線形狀搶視線" },
  "embAll.name": { en: "d. Every turning point", "zh-TW": "d. 每個轉折點" },
  "embAll.note": { en: "Every high and low in the visible day gets a stop, like each word on the poster, not only the two around the session.", "zh-TW": "當天看得到的每個滿潮、乾潮都有一站，像海報上的每個字，而不只是衝浪前後兩個。" },
  "embAll.nodur": { en: "same", "zh-TW": "相同" },
  "embAll.trade": { en: "up to four gaps in a 140 px curve: it reads as a dashed line", "zh-TW": "140 px 的曲線最多切出四個缺口，看起來像虛線" },
  "embWide.name": { en: "e. Wide gap (6 px)", "zh-TW": "e. 寬缺口（6 px）" },
  "embWide.note": { en: "Same text, 6 px of clear line either side instead of 3: the word floats clearly inside the gap, as on the green poster.", "zh-TW": "同樣的字，兩側留 6 px 而非 3 px：字清楚地浮在缺口裡，像綠色海報那樣。" },
  "embWide.nodur": { en: "same", "zh-TW": "相同" },
  "embWide.trade": { en: "6 px more cut out per label, so the curve loses about 12 px of a 120 px chart per label", "zh-TW": "每個標籤多切 6 px，120 px 寬的圖上每個標籤讓曲線少約 12 px" },
  "ripple.name": { en: "Ripple on the curve", "zh-TW": "曲線上的漣漪" },
  "ripple.note": {
    en: "The span becomes a fine solid blue ripple (about 6 px per wave, 1.75 px line) that rides the grey curve for the session's length, always an exact number of waves so it begins and ends on the curve; no dots, the stroke's round caps are the ends. The grey curve stays beneath it, dimmed. Reads like a little sine wave: \"surfed here\".",
    "zh-TW": "時段變成一條細緻的實心藍色漣漪（約每 6 px 一個波、線寬 1.75 px），沿著灰色曲線走完衝浪的長度，波數永遠是整數，所以起點與終點都落在曲線上；沒有圓點，兩端就是線的圓頭。灰色曲線淡淡地留在下面。像一小段正弦波：「在這裡衝過」。",
  },
  "ripple.nodur": { en: "one blue dot, nothing dims", "zh-TW": "只有一個藍點，沒有東西變淡" },
  "ripple.trade": { en: "a 30 min span is under 6 px, too short for a wave, so it falls back to a 3 px solid stub", "zh-TW": "30 分鐘的時段不到 6 px，放不下一個波，改成 3 px 實心短線" },
  "rolling.name": { en: "Rolling waves", "zh-TW": "翻滾的浪" },
  "rolling.note": {
    en: "Fewer, bigger rounded waves (about 15 px per wave, 6.4 px high, 2.25 px line) that replace the curve for the span: the grey curve is cut out under it, no end dots. The span stops being a line and becomes a swell.",
    "zh-TW": "更少、更大的圓潤波浪（約每 15 px 一個波、高 6.4 px、線寬 2.25 px），在時段內取代曲線：灰色曲線在這一段被切掉，沒有端點圓點。時段不再是一條線，而是一段湧浪。",
  },
  "rolling.nodur": { en: "one blue dot, the curve is whole", "zh-TW": "只有一個藍點，曲線完整" },
  "rolling.trade": { en: "the biggest wave needs a long span: at 140 px a 2 h session is one wave and under 1 h it is a stub, and it hides the exact tide shape under it", "zh-TW": "大浪需要夠長的時段：140 px 時 2 小時只有一個波、不到 1 小時退成短線，而且會蓋掉那一段潮的實際形狀" },
  "scallops.name": { en: "Scallops", "zh-TW": "扇貝浪" },
  "scallops.note": {
    en: "Round humps standing on the curve, all on the upper side, like the ocean-wave icon (about 9 px per hump, 3.4 px high, 2 px line), no end dots. The grey curve stays beneath, so the tide shape is never hidden.",
    "zh-TW": "站在曲線上的圓弧，全部朝上，像海浪圖示（約每 9 px 一個弧、高 3.4 px、線寬 2 px），沒有端點圓點。灰色曲線留在下面，不會蓋掉潮的形狀。",
  },
  "scallops.nodur": { en: "one blue dot, nothing dims", "zh-TW": "只有一個藍點，沒有東西變淡" },
  "scallops.trade": { en: "the cusps between humps look busy at 140 px, and a 30 min span is a stub", "zh-TW": "140 px 時弧與弧之間的尖點看起來有點雜，30 分鐘的時段只剩短線" },
  "waveRoute.name": { en: "Wave route", "zh-TW": "浪之路線" },
  "waveRoute.note": {
    en: "The poster's route with a wave for the line: a 2.5 px solid blue wave (about 10 px per wave) replaces the curve for the span, starting at a solid blue circle and ending in a four-lobed clover. The most playful one.",
    "zh-TW": "海報的路線概念，線換成浪：2.5 px 實心藍色波浪（約每 10 px 一個波）在時段內取代曲線，起點是實心藍色圓形，終點是四瓣花形。最活潑的一個。",
  },
  "waveRoute.nodur": { en: "one blue circle, the curve is whole", "zh-TW": "只有一個藍色圓形，曲線完整" },
  "waveRoute.trade": { en: "under about 9 px the clover is dropped and under 6 px the wave is a stub, so the shapes show on longer sessions only", "zh-TW": "短於約 9 px 時省略花形、短於 6 px 時波浪退成短線，所以形狀只在較長的時段才看得到" },
};

const l = (key: string, lang: Lang) => L[key]?.[lang] ?? key;

interface Case {
  key: string;
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
  { key: "caseRising", when: "2026-10-18T11:00", end: "2026-10-18T13:00", events: DAY },
  {
    key: "caseFalling",
    when: "2026-10-18T17:30",
    end: "2026-10-18T19:00",
    events: [...DAY.slice(1), ev("high", "2026-10-19T04:10", 1.3)],
  },
  { key: "caseShort", when: "2026-10-18T12:00", end: "2026-10-18T12:30", events: DAY },
  { key: "caseCross", when: "2026-10-18T14:30", end: "2026-10-18T16:30", events: DAY },
  { key: "caseCrossLong", when: "2026-10-18T13:30", end: "2026-10-18T17:30", events: DAY },
  { key: "caseLeft", when: "2026-10-18T06:30", end: "2026-10-18T07:30", events: DAY },
  { key: "caseRight", when: "2026-10-18T17:00", end: "2026-10-18T17:40", events: DAY },
  {
    key: "caseClose",
    when: "2026-10-18T13:00",
    end: "2026-10-18T13:40",
    events: [
      ev("low", "2026-10-18T07:00", 0.2),
      ev("high", "2026-10-18T12:00", 1.2),
      ev("low", "2026-10-18T14:10", 0.4),
      ev("high", "2026-10-18T20:00", 1.3),
    ],
  },
  { key: "caseNone", when: "2026-10-18T12:00", events: DAY },
  {
    key: "caseNoHeights",
    when: "2026-10-18T17:30",
    end: "2026-10-18T18:30",
    events: [
      ev("low", "2026-10-18T09:05", null),
      ev("high", "2026-10-18T15:20", null),
      ev("low", "2026-10-18T21:45", null),
    ],
  },
];

const WIDTHS = [140, 220, 360];

const minutes = (from: string, to: string) =>
  Math.round((new Date(`${to}:00Z`).getTime() - new Date(`${from}:00Z`).getTime()) / 60000);

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

function infoFor(c: Case, lang: Lang): Info {
  return {
    start: c.when.slice(11, 16),
    end: c.end ? c.end.slice(11, 16) : null,
    dur: c.end ? fmtDuration(minutes(c.when, c.end)) : null,
    startCap: l("start", lang),
    endCap: l("end", lang),
    letters: lang === "zh-TW" ? { high: "滿", low: "乾" } : { high: "H", low: "L" },
  };
}

function VariantSection({ index, defs, first }: { index: number; defs: typeof DEFS; first?: boolean }) {
  const { lang } = useLang();
  const def = defs[index];
  const withDur = def.extra(true);
  const noDur = def.extra(false);
  const heightNote = !withDur
    ? l("sameH", lang)
    : withDur === noDur
      ? l("tallerSame", lang).replace("{n}", String(withDur))
      : l("taller", lang).replace("{n}", String(withDur)).replace("{m}", String(noDur));
  return (
    <section id={`v-${def.id}`} className="scroll-mt-4 min-w-0 rounded-[var(--r-card)] bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-[15px] font-bold">
          {first || defs !== DEFS ? "" : `${index + 1}. `}
          {l(`${def.id}.name`, lang)}
        </h2>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
            (index === 0 ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground")
          }
        >
          {index === 0 ? l("now", lang) : l("isNew", lang)}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">{heightNote}</span>
      </div>
      <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">{l(`${def.id}.note`, lang)}</p>
      <p className="mt-1 max-w-prose text-[12.5px] text-muted-foreground">
        <span className="font-semibold">{l("nodur", lang)}</span> {l(`${def.id}.nodur`, lang)}
      </p>
      <p className="mt-1 max-w-prose text-[12.5px] text-muted-foreground">
        <span className="font-semibold">{l("trade", lang)}</span> {l(`${def.id}.trade`, lang)}
      </p>
      <div className="mt-3 flex min-w-0 flex-col gap-3">
        {CASES.map((c) => (
          <div key={c.key} className="min-w-0">
            <div className="mb-1 text-[11.5px] font-semibold text-muted-foreground">{l(c.key, lang)}</div>
            <div className="flex min-w-0 flex-wrap items-start gap-3">
              {WIDTHS.map((w) => (
                <Sized key={w} w={w}>
                  <Tile
                    c={c}
                    chart={<SpanChart events={c.events} sessionWhen={c.when} sessionEnd={c.end} variant={def.build(infoFor(c, lang))} />}
                  />
                </Sized>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TideBluePage() {
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
        {DEFS.map((d, i) => (
          <a key={d.id} href={`#v-${d.id}`} className="rounded-full bg-secondary px-2.5 py-1 font-semibold">
            {i + 1}. {l(`${d.id}.name`, lang)}
          </a>
        ))}
        <span className="ml-1 font-semibold text-muted-foreground">{l("jumpLabels", lang)}</span>
        {LABEL_DEFS.map((d) => (
          <a key={d.id} href={`#v-${d.id}`} className="rounded-full bg-secondary px-2.5 py-1 font-semibold">
            {l(`${d.id}.name`, lang)}
          </a>
        ))}
      </nav>

      <div className="mt-5 flex min-w-0 flex-col gap-4">
        {DEFS.map((d, i) => (
          <VariantSection key={d.id} index={i} defs={DEFS} />
        ))}
        <div id="labels" className="scroll-mt-4">
          <h2 className="text-lg font-extrabold">{l("labelsTitle", lang)}</h2>
          <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">{l("labelsIntro", lang)}</p>
        </div>
        {LABEL_DEFS.map((d, i) => (
          <VariantSection key={d.id} index={i} defs={LABEL_DEFS} first />
        ))}
      </div>
    </div>
  );
}
