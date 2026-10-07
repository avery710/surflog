/**
 * Synthetic cases for the /dev/share showcase and its image route. Built
 * through lib/share-card-data.ts, i.e. the same code the real image routes
 * and the public page use. Synthetic only: no database, no real ids.
 */
import { fakeBoard, fakeCond, fakeCondCwaTide, fakeCondOpenMeteo, fakeSession, tideDay } from "@/app/dev/fixtures";
import { TAIWAN_SPOTS_FIXTURE } from "@/lib/spot-fixtures";
import { buildShareCard, type ShareCardData } from "@/lib/share-card-data";
import type { ShareLang } from "@/lib/share-strings";
import type { Session } from "@/lib/types";

export interface ShareCase {
  id: string;
  title: string;
  session: Session;
  board: { brand: string; lengthIn: number | null } | null;
}

const BOARD = fakeBoard({ brand: "Pyzel Ghost" });

const LONG_ZH =
  "早上六點到的時候風還沒起來，浪況很乾淨，大概是胸到肩膀高的浪，每隔幾分鐘就有一組比較大的。\n" +
  "- 第一個小時人很少，抓到三、四道很長的右浪\n" +
  "- 潮水往上推之後浪開始變厚，換成較大的板子才比較順\n" +
  "- 十點之後海風轉成向岸風，整片都碎掉了，就上岸吃早餐。\n" +
  "整體來說是這個月最好玩的一次，下次想早一點到，也想試試看更長的板子。";

const toHtml = (text: string) =>
  text
    .split("\n")
    .map((l) => `<div>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`)
    .join("");

export const SHARE_CASES: ShareCase[] = [
  {
    id: "typical",
    title: "Typical: CWA tide, board, short note",
    session: fakeSession({ id: "dev-share-1", notesHtml: "<p>Fun peaky wave, offshore in the morning.</p>", notes: "Fun peaky wave, offshore in the morning." }),
    board: BOARD,
  },
  {
    id: "long-zh",
    title: "Long Chinese notes (truncated with an ellipsis)",
    session: fakeSession({ id: "dev-share-2", notesHtml: toHtml(LONG_ZH), notes: LONG_ZH }),
    board: BOARD,
  },
  {
    id: "no-notes",
    title: "No notes",
    session: fakeSession({ id: "dev-share-3", notesHtml: "", notes: "" }),
    board: BOARD,
  },
  {
    id: "sparse",
    title: "Missing period, water temp and tide",
    session: fakeSession({
      id: "dev-share-4",
      condOpenMeteo: fakeCondOpenMeteo({ swellPeriodS: null, seaTempC: null, airTempC: null, tideEvents: [], seaLevelTrend: null }),
      condCwaTide: null,
    }),
    board: BOARD,
  },
  {
    id: "no-board",
    title: "No board, Open-Meteo tide (past date)",
    session: fakeSession({
      id: "dev-share-5",
      condCwaTide: null,
      condOpenMeteo: fakeCondOpenMeteo({ tideEvents: tideDay("2026-09-25", [0.2, 1.1, 0.3, 1.0]) }),
    }),
    board: null,
  },
  {
    id: "manual",
    title: "Typed Swelleye readings only (no Open-Meteo)",
    session: fakeSession({ id: "dev-share-6", condOpenMeteo: null, condCwaTide: fakeCondCwaTide(), cond: fakeCond() }),
    board: null,
  },
  {
    id: "long-spot",
    title: "Long spot name, no conditions at all",
    session: fakeSession({
      id: "dev-share-7",
      spot: "eight-immortals-cave",
      condOpenMeteo: null,
      condCwaTide: null,
      cond: null,
    }),
    board: BOARD,
  },
];

export function shareCaseData(id: string, lang: ShareLang): ShareCardData | null {
  const c = SHARE_CASES.find((x) => x.id === id);
  if (!c) return null;
  const spot = TAIWAN_SPOTS_FIXTURE.find((s) => s.slug === c.session.spot);
  const spotName = spot ? (lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name) : c.session.spot;
  return buildShareCard({ session: c.session, spot, spotName, board: c.board, lang });
}
