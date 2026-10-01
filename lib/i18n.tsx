"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type Lang = "en" | "zh-TW";

const STORAGE_KEY = "surflog:lang";

/**
 * Every user-facing string in the UI. Deliberately left untranslated: units
 * (m, s, m/s, °C), source names (Open-Meteo, Swelleye), the Surflog name,
 * and error messages that come back from the API routes (server-side,
 * English). `{name}` placeholders are filled by t(key, vars).
 */
const DICT = {
  "toast.sessionDeleted": { en: "Session deleted", "zh-TW": "紀錄已刪除" },
  "toast.couldntDelete": { en: "Couldn't delete", "zh-TW": "無法刪除" },
  "toast.uploadFailed": { en: "Upload failed", "zh-TW": "上傳失敗" },
  "toast.couldntRemovePhoto": { en: "Couldn't remove photo", "zh-TW": "無法移除照片" },
  "toast.savedFilled": { en: "Session saved — conditions filled in", "zh-TW": "已儲存，浪況已自動帶入" },
  "toast.saved": { en: "Session saved", "zh-TW": "已儲存" },
  "toast.couldntSave": { en: "Couldn't save", "zh-TW": "無法儲存" },
  "toast.changesSaved": { en: "Changes saved", "zh-TW": "已儲存變更" },
  "toast.conditionsRefreshed": { en: "Conditions refreshed", "zh-TW": "浪況已更新" },
  "toast.stillNoCoords": { en: "Still no coordinates for this spot", "zh-TW": "這個浪點還沒有座標" },
  "toast.couldntRefresh": { en: "Couldn't refresh", "zh-TW": "無法更新" },
  "toast.nothingToExport": { en: "Nothing to export yet", "zh-TW": "還沒有可匯出的紀錄" },

  "tile.swellOpenMeteo": { en: "Swell", "zh-TW": "湧浪" },
  "tile.swellSwelleye": { en: "Swell (Swelleye)", "zh-TW": "湧浪（Swelleye）" },
  "tile.wind": { en: "Wind", "zh-TW": "風" },
  "tile.tideSwelleye": { en: "Tide (Swelleye)", "zh-TW": "潮汐（Swelleye）" },
  "tile.tideOpenMeteo": { en: "Tide", "zh-TW": "潮汐" },
  "tide.rising": { en: "rising", "zh-TW": "漲潮中" },
  "tide.falling": { en: "falling", "zh-TW": "退潮中" },
  "cond.swellSub": { en: "@ {p} s from {dir}", "zh-TW": "週期 {p} 秒・{dir}" },
  "wind.mode.offshore": { en: "Offshore", "zh-TW": "離岸風" },
  "wind.mode.cross-offshore": { en: "Mostly offshore", "zh-TW": "偏離岸風" },
  "wind.mode.cross": { en: "Cross-shore", "zh-TW": "側風" },
  "wind.mode.cross-onshore": { en: "Mostly onshore", "zh-TW": "偏向岸風" },
  "wind.mode.onshore": { en: "Onshore", "zh-TW": "向岸風" },
  "wind.strength.calm": { en: "Calm", "zh-TW": "無風" },
  "wind.strength.light": { en: "Light", "zh-TW": "微風" },
  "wind.strength.gentle": { en: "Gentle", "zh-TW": "輕風" },
  "wind.strength.moderate": { en: "Moderate", "zh-TW": "中等風" },
  "wind.strength.fresh": { en: "Fresh", "zh-TW": "偏強風" },
  "wind.strength.strong": { en: "Strong", "zh-TW": "強風" },
  "wind.strength.nearGale": { en: "Near gale", "zh-TW": "疾風" },
  "wind.strength.gale": { en: "Gale", "zh-TW": "大風" },
  "tile.height": { en: "Height", "zh-TW": "浪高" },
  "tile.period": { en: "Period", "zh-TW": "週期" },
  "tile.temp": { en: "Water temp", "zh-TW": "水溫" },
  "tile.airTemp": { en: "Air {t}°C", "zh-TW": "氣溫 {t}°C" },
  "cond.windSpeedLabel": { en: "speed", "zh-TW": "風速" },
  "cond.windDirLabel": { en: "direction", "zh-TW": "風向" },
  "cond.swellHeightLabel": { en: "height", "zh-TW": "浪高" },
  "cond.swellPeriodLabel": { en: "period", "zh-TW": "週期" },
  "cond.periodOnly": { en: "@ {p} s", "zh-TW": "週期 {p} 秒" },
  "cond.windFrom": { en: "from {dir}", "zh-TW": "{dir}風" },
  "cond.gust": { en: "gust {g}", "zh-TW": "陣風 {g}" },
  "tide.high": { en: "high", "zh-TW": "滿潮" },
  "tide.low": { en: "low", "zh-TW": "乾潮" },
  "tide.chartLabel": { en: "Tide curve between low and high, dot marks the session", "zh-TW": "乾潮到滿潮的潮汐曲線，圓點為衝浪時間" },
  "tide.nextDay": { en: "+1d", "zh-TW": "隔天" },
  "tide.prevDay": { en: "−1d", "zh-TW": "前一天" },

  "entry.noCoords": {
    en: "No coordinates yet for this spot — Open-Meteo can't fill in conditions automatically. Enter Swelleye's numbers by hand if you have them.",
    "zh-TW": "這個浪點還沒有座標，Open-Meteo 無法自動帶入浪況。有 Swelleye 的數據的話，可以手動輸入。",
  },
  "entry.typeThemIn": { en: "Type them in", "zh-TW": "手動輸入" },
  "entry.photoAlt": { en: "Surf photo from {when}", "zh-TW": "{when} 的衝浪照片" },
  "entry.removePhoto": { en: "Remove photo", "zh-TW": "移除照片" },
  "entry.example": { en: "Example — delete whenever", "zh-TW": "範例——可隨時刪除" },
  "badge.swelleyeForecast": { en: "Swelleye forecast", "zh-TW": "Swelleye 預報" },
  "badge.enteredByHand": { en: "Entered by hand", "zh-TW": "手動輸入" },

  "form.spot": { en: "Spot", "zh-TW": "浪點" },
  "form.setAsDefault": { en: "Set as default", "zh-TW": "設為預設" },
  "form.defaultSpot": { en: "Default", "zh-TW": "預設浪點" },
  "form.setDefaultSpot": {
    en: "Use this spot by default when logging a session",
    "zh-TW": "記錄時預設使用這個浪點",
  },
  "form.clearDefaultSpot": { en: "Clear default spot", "zh-TW": "取消預設浪點" },
  "form.date": { en: "Date", "zh-TW": "日期" },
  "form.timeInWater": { en: "Time in the water", "zh-TW": "下水時段" },
  "form.time": { en: "Time", "zh-TW": "時段" },
  "form.notes": { en: "Notes", "zh-TW": "筆記" },
  "form.notesPlaceholder": {
    en: 'How it felt. What worked, what didn\'t. Type "- " for a bullet.',
    "zh-TW": "感覺如何？哪裡順、哪裡不順。輸入「- 」可建立項目符號。",
  },
  "form.saveSession": { en: "Save session", "zh-TW": "儲存紀錄" },
  "form.saving": { en: "Saving…", "zh-TW": "儲存中…" },
  "form.autoFillHint": {
    en: "Swell, wind and tide fill in automatically from Open-Meteo and CWA once saved",
    "zh-TW": "儲存後會自動帶入 Open-Meteo 與氣象署的浪況、風和潮汐",
  },

  "edit.conditionsHeader": { en: "Conditions (Swelleye, entered by hand)", "zh-TW": "浪況（Swelleye，手動輸入）" },
  "edit.refreshing": { en: "Refreshing…", "zh-TW": "更新中…" },
  "edit.refreshOpenMeteo": { en: "Refresh Open-Meteo", "zh-TW": "重新抓取 Open-Meteo" },
  "edit.saveChanges": { en: "Save changes", "zh-TW": "儲存變更" },
  "edit.cancel": { en: "Cancel", "zh-TW": "取消" },
  "cond.swellHeightM": { en: "Swell m", "zh-TW": "湧浪 m" },
  "cond.swellPeriodS": { en: "Period s", "zh-TW": "週期 s" },
  "cond.swellDir": { en: "Swell from", "zh-TW": "湧浪方向" },
  "cond.windSpeedMs": { en: "Wind m/s", "zh-TW": "風速 m/s" },
  "cond.windGustMs": { en: "Gust m/s", "zh-TW": "陣風 m/s" },
  "cond.windDir": { en: "Wind from", "zh-TW": "風向" },


  "editor.placeholder": { en: "How it felt. What worked, what didn't.", "zh-TW": "感覺如何？哪裡順、哪裡不順。" },
  "editor.bullets": { en: "Bullets", "zh-TW": "項目符號" },
  "editor.numbered": { en: "Numbered", "zh-TW": "編號清單" },
  "editor.bold": { en: "Bold", "zh-TW": "粗體" },
  "editor.italic": { en: "Italic", "zh-TW": "斜體" },

  "patterns.title": { en: "What you've surfed", "zh-TW": "你衝過的浪點" },
  "patterns.sessions": { en: "Sessions", "zh-TW": "次數" },
  "patterns.description": { en: "Description", "zh-TW": "描述" },
  "patterns.addDescription": { en: "+ Add description", "zh-TW": "+ 新增描述" },
  "patterns.descriptionPlaceholder": {
    en: "e.g. best at mid tide, crowded on weekends",
    "zh-TW": "例如：中潮最好，週末人多",
  },
  "patterns.editDescription": { en: "Edit description for {spot}", "zh-TW": "編輯「{spot}」的描述" },
  "toast.couldntSaveDescription": { en: "Couldn't save description", "zh-TW": "無法儲存描述" },
  "calendar.session": { en: "{n} session", "zh-TW": "{n} 次" },
  "calendar.sessions": { en: "{n} sessions", "zh-TW": "{n} 次" },
  "calendar.showOlderWeeks": { en: "Show older weeks", "zh-TW": "顯示較舊的週次" },
  "calendar.showNewerWeeks": { en: "Show more recent weeks", "zh-TW": "顯示較新的週次" },
  // Monday-first weekday header above the dot grid, one letter/character each.
  "calendar.weekday.mon": { en: "M", "zh-TW": "一" },
  "calendar.weekday.tue": { en: "T", "zh-TW": "二" },
  "calendar.weekday.wed": { en: "W", "zh-TW": "三" },
  "calendar.weekday.thu": { en: "T", "zh-TW": "四" },
  "calendar.weekday.fri": { en: "F", "zh-TW": "五" },
  "calendar.weekday.sat": { en: "S", "zh-TW": "六" },
  "calendar.weekday.sun": { en: "S", "zh-TW": "日" },
  "menu.signedIn": { en: "Signed in", "zh-TW": "已登入" },

  "signin.subtitle": {
    en: "Sign in to log sessions and see your own journal.",
    "zh-TW": "登入後即可記錄衝浪並查看你的日誌。",
  },
  "signin.continueGoogle": { en: "Continue with Google", "zh-TW": "使用 Google 繼續" },
  "signin.err.OAuthAccountNotLinked": {
    en: "That Google account is already linked a different way. Try again.",
    "zh-TW": "這個 Google 帳號已用其他方式連結，請再試一次。",
  },
  "signin.err.AccessDenied": { en: "Access denied.", "zh-TW": "拒絕存取。" },
  "signin.err.Default": { en: "Couldn't sign in — try again.", "zh-TW": "無法登入，請再試一次。" },

  "action.logSession": { en: "Log a session", "zh-TW": "新增衝浪紀錄" },
  "action.exportCsv": { en: "Export CSV", "zh-TW": "匯出 CSV" },
  "action.signOut": { en: "Sign out", "zh-TW": "登出" },
  "section.sessions": { en: "Sessions", "zh-TW": "紀錄" },
  "goal.title": { en: "Goal for next session", "zh-TW": "下次衝浪的目標" },
  "goal.add": { en: "Add a technique goal to work on next time", "zh-TW": "新增下次要練習的技巧目標" },
  "goal.placeholder": { en: "e.g. look where you want to go", "zh-TW": "例如：視線看向要去的方向" },
  "goal.edit": { en: "Edit goal for next session", "zh-TW": "編輯下次衝浪的目標" },
  "goal.addPoint": { en: "Add point", "zh-TW": "新增項目" },
  "goal.editPoint": { en: "Point {n}", "zh-TW": "第 {n} 項" },
  "goal.removePoint": { en: "Remove “{point}”", "zh-TW": "移除「{point}」" },
  "goal.charsLeft": { en: "{n} characters left", "zh-TW": "剩下 {n} 字" },
  "goal.whichDidYouAchieve": { en: "Which did you achieve?", "zh-TW": "這次達成了哪些？" },
  "goal.pointCount": { en: "{met}/{n}", "zh-TW": "{met}/{n}" },
  "goal.scrollHint": { en: "More goal points — scroll to see them", "zh-TW": "還有更多目標項目，可捲動查看" },
  "goal.chipCount": { en: "{met}/{n} achieved", "zh-TW": "達成 {met}/{n}" },
  "goal.notAssessed": { en: "Not checked", "zh-TW": "未確認" },
  "toast.couldntSaveGoal": { en: "Couldn't save the goal", "zh-TW": "無法儲存目標" },
  "dialog.logSessionTitle": { en: "Log a session", "zh-TW": "新增衝浪紀錄" },
  "empty.title": { en: "Nothing logged yet", "zh-TW": "還沒有任何紀錄" },
  "empty.body": {
    en: "Log a session — spot, date, the 2-hour slot you were out. Conditions from Open-Meteo fill in automatically; add Swelleye's numbers by hand whenever you have them.",
    "zh-TW": "新增一筆紀錄——地點、日期、下水的兩小時時段。Open-Meteo 的浪況資料會自動帶入；有 Swelleye 的數據時，也可以手動補上。",
  },
  "menu.language": { en: "Language", "zh-TW": "語言" },
  "region.North": { en: "North", "zh-TW": "北部" },
  "region.Northeast": { en: "Northeast", "zh-TW": "東北部" },
  "region.East": { en: "East", "zh-TW": "東部" },
  "region.South": { en: "South", "zh-TW": "南部" },
  "region.West": { en: "West", "zh-TW": "西部" },
  "lang.en": { en: "English", "zh-TW": "English" },
  "lang.zhTW": { en: "繁體中文", "zh-TW": "繁體中文" },
  "entry.edit": { en: "Edit", "zh-TW": "編輯" },
  "entry.close": { en: "Close", "zh-TW": "關閉" },
  "entry.actions": { en: "Session actions", "zh-TW": "紀錄選項" },
  "entry.addMedia": { en: "Add photos/video", "zh-TW": "新增照片/影片" },
  "entry.uploading": { en: "Uploading…", "zh-TW": "上傳中…" },
  "entry.delete": { en: "Delete", "zh-TW": "刪除" },
  "entry.deleting": { en: "Deleting…", "zh-TW": "刪除中…" },
  "entry.deleteTitle": { en: "Delete this session?", "zh-TW": "刪除這筆紀錄？" },
  "entry.deleteDescription": {
    en: "This will permanently delete your {spot} session from {when}.",
    "zh-TW": "這會永久刪除 {when} 的 {spot} 紀錄。",
  },

  "section.boards": { en: "Your board rack", "zh-TW": "我的板架" },
  "board.add": { en: "+ Add board", "zh-TW": "+ 新增衝浪板" },
  "board.addTitle": { en: "Add a board", "zh-TW": "新增衝浪板" },
  "board.editTitle": { en: "Edit board", "zh-TW": "編輯衝浪板" },
  "board.empty": {
    en: "No boards yet. Add the ones you ride, then pick one when you log a session.",
    "zh-TW": "還沒有衝浪板。先加入你常用的板子，記錄時就能選擇。",
  },
  "board.brand": { en: "Brand", "zh-TW": "品牌" },
  "board.brandPlaceholder": { en: "e.g. Pyzel Ghost", "zh-TW": "例如：Pyzel Ghost" },
  "board.length": { en: "Length", "zh-TW": "長度" },
  "board.lengthFeet": { en: "Length, feet", "zh-TW": "長度（英尺）" },
  "board.lengthInches": { en: "Length, inches", "zh-TW": "長度（英吋）" },
  "board.volume": { en: "Volume", "zh-TW": "體積" },
  "board.rocker": { en: "Rocker", "zh-TW": "弧度" },
  "board.rocker.none": { en: "Not set", "zh-TW": "未設定" },
  "board.rocker.low": { en: "Low", "zh-TW": "低" },
  "board.rocker.medium": { en: "Medium", "zh-TW": "中" },
  "board.rocker.high": { en: "High", "zh-TW": "高" },
  "board.rockerValue": { en: "{r} rocker", "zh-TW": "弧度：{r}" },
  "board.note": { en: "Note", "zh-TW": "備註" },
  "board.notePlaceholder": { en: "e.g. small-wave board, fins FCS II", "zh-TW": "例如：小浪用，FCS II 舵" },
  "board.photoOptional": { en: "Photo (optional)", "zh-TW": "照片（選填）" },
  "board.choosePhoto": { en: "Choose photo", "zh-TW": "選擇照片" },
  "board.changePhoto": { en: "Change photo", "zh-TW": "更換照片" },
  "board.removePhoto": { en: "Remove photo", "zh-TW": "移除照片" },
  "board.photoAlt": { en: "Photo of {name}", "zh-TW": "{name} 的照片" },
  "board.favorite": { en: "Go-to", "zh-TW": "常用" },
  "board.sort": { en: "Reorder", "zh-TW": "排序" },
  "board.sortDone": { en: "Done", "zh-TW": "完成" },
  "board.sortHint": { en: "Drag a board to reorder. Go-to boards stay on top.", "zh-TW": "拖曳衝浪板調整順序，常用板固定在最前面。" },
  "board.setFavorite": { en: "Mark as go-to", "zh-TW": "設為常用" },
  "board.unsetFavorite": { en: "Remove from go-to", "zh-TW": "取消常用" },
  "board.removeFavoriteLabel": { en: "Remove {name} from go-to boards", "zh-TW": "從常用移除「{name}」" },
  "board.dragHandle": { en: "Drag to reorder {name}", "zh-TW": "拖曳以調整「{name}」的順序" },
  "toast.couldntSetFavorite": { en: "Couldn't update the board", "zh-TW": "無法更新衝浪板" },
  "toast.couldntReorder": { en: "Couldn't reorder boards", "zh-TW": "無法調整衝浪板順序" },
  "board.save": { en: "Save board", "zh-TW": "儲存衝浪板" },
  "board.editLabel": { en: "Edit {name}", "zh-TW": "編輯「{name}」" },
  "board.actionsLabel": { en: "Actions for {name}", "zh-TW": "「{name}」的選項" },
  "board.deleteTitle": { en: "Delete this board?", "zh-TW": "刪除這個衝浪板？" },
  "board.deleteDescription": {
    en: "This can't be undone. Sessions logged with {name} keep their record, just without a board.",
    "zh-TW": "此動作無法復原。曾以「{name}」紀錄的日誌仍會保留，只是不再連結衝浪板。",
  },
  "board.lengthInvalid": {
    en: "Length is feet plus inches (under 12), e.g. 6 and 2",
    "zh-TW": "長度請填英尺與英吋（英吋小於 12），例如 6 與 2",
  },
  "board.volumeInvalid": { en: "Volume is a number of litres", "zh-TW": "體積請填公升數" },
  "board.needBrandOrLength": { en: "Add a brand or a length", "zh-TW": "請填寫品牌或長度" },
  "toast.boardSaved": { en: "Board saved", "zh-TW": "衝浪板已儲存" },
  "toast.boardDeleted": { en: "Board deleted", "zh-TW": "衝浪板已刪除" },
  "toast.couldntSaveBoard": { en: "Couldn't save board", "zh-TW": "無法儲存衝浪板" },
  "toast.boardPhotoFailed": {
    en: "Board saved, but the photo didn't upload",
    "zh-TW": "衝浪板已儲存，但照片上傳失敗",
  },
  "form.boardOptional": { en: "Board (optional)", "zh-TW": "衝浪板（選填）" },
  "form.noBoard": { en: "No board", "zh-TW": "不指定" },
  "entry.board": { en: "Board", "zh-TW": "衝浪板" },
} as const satisfies Record<string, Record<Lang, string>>;

export type TKey = keyof typeof DICT;

/**
 * Plain module-level store (not React state) so the current language is
 * readable synchronously via useSyncExternalStore — the hydration-safe way
 * to seed client state from localStorage: the server snapshot is always
 * "en", and React swaps in the real client snapshot right after hydration,
 * with no useEffect+setState render flagged by react-hooks/set-state-in-effect.
 */
let currentLang: Lang = "en";
let hydratedFromStorage = false;
const listeners = new Set<() => void>();

function readStoredLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh-TW") return saved;
  } catch {
    // private window / blocked storage — fall back to English silently
  }
  return "en";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Lang {
  if (!hydratedFromStorage) {
    currentLang = readStoredLang();
    hydratedFromStorage = true;
  }
  return currentLang;
}

function getServerSnapshot(): Lang {
  return "en";
}

function setLang(l: Lang) {
  currentLang = l;
  hydratedFromStorage = true;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // per-viewer convenience only — fine if it doesn't persist
  }
  listeners.forEach((fn) => fn());
}

type Vars = Record<string, string | number>;

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Vars) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Syncing an external system (the <html> element), not React state — lets
  // the browser pick Traditional Chinese glyphs for CJK text.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: TKey, vars?: Vars) => {
        const s: string = DICT[key][lang];
        return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
      },
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within a LanguageProvider");
  return ctx;
}
