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
  /** Draw the board chip with a (synthetic) photo. */
  boardPhoto?: boolean;
}

// A small coloured disc standing in for a board photo (no real photos in /dev).
const PHOTO =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a3c"/><stop offset="1" stop-color="#7a2cff"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><ellipse cx="80" cy="80" rx="22" ry="62" fill="#fff" opacity=".85"/></svg>'
  ).toString("base64");

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

const BULLETS_HTML =
  "<div>今天的重點</div><ul><li>起乘的時候眼睛要看浪壁，不要看板頭</li><li>下一次試著把重心壓低，轉彎再慢一點</li><li>浪比預期大，早點出發排到好位置才行</li><li>潮水往上推之後變厚，換長板更順</li><li>十點之後海風轉成向岸風，整片碎掉</li><li>結束後去吃早餐，順便檢查板子的凹痕</li></ul>";

const LONG_EN =
  ("Got there at six before the wind picked up. Clean, chest to shoulder high with a bigger set every few minutes. First hour was almost empty and I caught three or four long rights. Once the tide pushed in the waves thickened, so switching to the bigger board helped. After ten the sea breeze turned onshore and it all fell apart, so I went for breakfast. " +
    "Next time I want to get there earlier and try a longer board in the same conditions, maybe with a friend.").slice(0, 400);

const PARA_ZH =
  "早上六點到的時候風還沒起來浪況很乾淨大概是胸到肩膀高的浪每隔幾分鐘就有一組比較大的第一個小時人很少抓到三四道很長的右浪潮水往上推之後浪開始變厚換成較大的板子才比較順十點之後海風轉成向岸風整片都碎掉了就上岸吃早餐整體來說是這個月最好玩的一次下次想早一點到也想試試看更長的板子今天也有遇到一位很友善的當地人教我怎麼看浪況".repeat(2).slice(0, 400);

export const SHARE_CASES: ShareCase[] = [
  {
    id: "para-zh",
    title: "400-character Chinese paragraph",
    session: fakeSession({ id: "dev-share-11", notesHtml: `<div>${PARA_ZH}</div>`, notes: PARA_ZH }),
    board: BOARD,
    boardPhoto: true,
  },
  {
    id: "long-en",
    title: "Long English paragraph",
    session: fakeSession({ id: "dev-share-10", notesHtml: `<div>${LONG_EN}</div>`, notes: LONG_EN }),
    board: BOARD,
  },
  {
    id: "bullets-zh",
    title: "Chinese bullet + numbered list notes",
    session: fakeSession({ id: "dev-share-9", notesHtml: BULLETS_HTML, notes: "今天的重點" }),
    board: BOARD,
    boardPhoto: true,
  },
  {
    id: "typical",
    title: "Typical: CWA tide, board, short note",
    session: fakeSession({ id: "dev-share-1", notesHtml: "<p>Fun peaky wave, offshore in the morning.</p>", notes: "Fun peaky wave, offshore in the morning." }),
    board: BOARD,
    boardPhoto: true,
  },
  {
    id: "long-zh",
    title: "Long Chinese notes (truncated with an ellipsis)",
    session: fakeSession({ id: "dev-share-2", notesHtml: toHtml(LONG_ZH), notes: LONG_ZH }),
    board: BOARD,
  },
  {
    id: "long-zh-name",
    title: "Long Chinese spot name, board with photo",
    session: fakeSession({ id: "dev-share-8", spot: "custom:花蓮縣壽豐鄉鹽寮漁港旁邊的長長長浪點名稱", notesHtml: "", notes: "" }),
    board: BOARD,
    boardPhoto: true,
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
  const spotName = spot ? (lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name) : c.session.spot.replace(/^custom:/, "");
  const data = buildShareCard({ session: c.session, spot, spotName, board: c.board, lang });
  return c.boardPhoto ? { ...data, boardPhoto: PHOTO } : data;
}
