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
  "toast.fileTooLarge": { en: "That file is too large (15 MB max)", "zh-TW": "檔案太大（上限 15 MB）" },
  "toast.notMedia": { en: "Only photos and videos can be added", "zh-TW": "只能新增照片或影片" },
  "toast.tooManyMedia": { en: "Up to {max} photos/videos per session", "zh-TW": "每筆紀錄最多 {max} 個照片/影片" },
  "toast.savedMediaFailed": {
    en: "Session saved, but {n} of {total} files couldn't be uploaded. Add them from the session's ⋯ menu.",
    "zh-TW": "已儲存，但 {total} 個檔案中有 {n} 個上傳失敗，可以從該筆紀錄的 ⋯ 選單重新新增。",
  },
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
  "form.media": { en: "Photos / video (optional)", "zh-TW": "照片/影片（選填）" },
  "form.removeMedia": { en: "Remove {name}", "zh-TW": "移除 {name}" },
  "form.uploadingMedia": { en: "Uploading {n} of {total}…", "zh-TW": "上傳中 {n}/{total}…" },
  "form.uploadingHint": {
    en: "Your session is saved. Keep this window open until the uploads finish.",
    "zh-TW": "紀錄已儲存，上傳完成前請不要關閉視窗。",
  },
  "form.autoFillHint": {
    en: "Swell, wind and tide fill in automatically from Open-Meteo and CWA once saved",
    "zh-TW": "儲存後會自動帶入 Open-Meteo 與氣象署的浪況、風和潮汐",
  },

  "edit.conditionsHeader": { en: "Conditions (entered by hand)", "zh-TW": "浪況（手動輸入）" },
  "edit.refreshing": { en: "Refreshing…", "zh-TW": "更新中…" },
  "edit.refreshOpenMeteo": { en: "Refresh conditions", "zh-TW": "更新浪況" },
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

  // Signed-out landing page (components/landing/landing.tsx)
  "landing.signIn": { en: "Sign in", "zh-TW": "登入" },
  "landing.hero.title": {
    en: "The surf journal that fills in the ocean for you.",
    "zh-TW": "幫你自動記下海況的衝浪日誌。",
  },
  "landing.hero.body": {
    en: "Log the spot and the time. Swell, wind, tide and water temperature for that moment attach themselves — so after a season, you can see which conditions actually work at your breaks.",
    "zh-TW": "只要填浪點和時間，當下的湧浪、風、潮汐和水溫就會自動附上。累積一季後，你就看得出哪些條件在你常去的浪點真的好衝。",
  },
  "landing.hero.private": {
    en: "Free · your journal is private to you",
    "zh-TW": "免費・日誌只有你自己看得到",
  },
  "landing.cond.title": { en: "Conditions fill themselves", "zh-TW": "浪況自動帶入" },
  "landing.cond.body": {
    en: "No more copying numbers from a forecast app. Save a session and the readings for that spot and hour are fetched for you — past dates too.",
    "zh-TW": "不用再從預報 App 抄數字。儲存紀錄時，系統會自動抓那個浪點、那個時段的資料，過去的日期也可以。",
  },
  "landing.cond.youType": { en: "You type", "zh-TW": "你填" },
  "landing.cond.weAdd": { en: "Surflog adds", "zh-TW": "Surflog 補上" },
  "landing.cond.spot": { en: "Spot", "zh-TW": "浪點" },
  "landing.cond.when": { en: "Time", "zh-TW": "時間" },
  "landing.cond.notes": { en: "Notes", "zh-TW": "筆記" },
  "landing.cond.swell": { en: "Swell height, period and direction", "zh-TW": "湧浪高度、週期與方向" },
  "landing.cond.wind": {
    en: "Wind speed, strength, and offshore / onshore for that break",
    "zh-TW": "風速、風力，以及對這個浪點是離岸還是向岸風",
  },
  "landing.cond.tide": {
    en: "Rising or falling, the next high or low, and the day's tide curve",
    "zh-TW": "漲潮或退潮、下一次滿潮或乾潮，以及當天的潮汐曲線",
  },
  "landing.cond.temp": { en: "Water and air temperature", "zh-TW": "水溫與氣溫" },
  "landing.cond.sources": {
    en: "Waves and wind from Open-Meteo, tide times from Taiwan's Central Weather Administration. 41 Taiwan spots built in.",
    "zh-TW": "浪與風來自 Open-Meteo，潮汐時間來自中央氣象署。內建台灣 41 個浪點。",
  },
  "landing.rhythm.title": { en: "See your rhythm", "zh-TW": "看見你的衝浪節奏" },
  "landing.rhythm.body": {
    en: "Every day you surfed, month by month, and where you go most — with your own notes on each spot.",
    "zh-TW": "逐月看你哪幾天下水、最常去哪裡，每個浪點還能留下自己的筆記。",
  },
  "landing.goal.title": { en: "Surf with a goal", "zh-TW": "帶著目標下水" },
  "landing.goal.body": {
    en: "Set a few things to work on. Each session, tick off what you managed — and watch the count grow.",
    "zh-TW": "設定幾個想練的重點，每次衝完勾選做到的項目，看著次數慢慢累積。",
  },
  "landing.goal.tryIt": {
    en: "Try editing it — nothing here is saved.",
    "zh-TW": "可以試著編輯看看，這裡的內容不會被儲存。",
  },
  "landing.quiver.title": { en: "Your quiver", "zh-TW": "你的衝浪板" },
  "landing.quiver.body": {
    en: "Keep your boards with their length, volume and rocker, and see which one you rode each session.",
    "zh-TW": "記下每塊板的長度、體積和 rocker，每次紀錄都看得到當天用哪一塊。",
  },
  "landing.extra.bilingual": { en: "In English and 繁體中文", "zh-TW": "支援繁體中文與英文" },
  "landing.extra.media": { en: "Add photos and video to any session", "zh-TW": "每筆紀錄都能加上照片和影片" },
  "landing.extra.csv": { en: "Export everything to CSV, any time", "zh-TW": "隨時把所有紀錄匯出成 CSV" },
  "landing.extra.private": {
    en: "Private by default — no feed, no followers",
    "zh-TW": "預設私人，沒有動態牆也沒有追蹤者",
  },
  "landing.cta.title": { en: "Ready for your next session?", "zh-TW": "準備好下一次下水了嗎？" },
  "landing.cta.body": {
    en: "Sign in with Google and your journal is ready.",
    "zh-TW": "用 Google 登入，你的日誌就準備好了。",
  },
  "landing.demo.notes": {
    en: "Clean and glassy early, sets every few minutes. Caught my best right of the month on the falling tide.",
    "zh-TW": "早上很乾淨、海面平滑，每幾分鐘就有一組浪。退潮時抓到這個月最好的一道右邊浪。",
  },
  "landing.demo.notesShort": { en: "Clean and glassy early…", "zh-TW": "早上很乾淨、海面平滑…" },
  "landing.demo.goal1": { en: "Pop up without rushing", "zh-TW": "起乘不要心急，感受腳站穩再下" },
  "landing.demo.goal2": { en: "Eyes on the wave face", "zh-TW": "視線盯著浪壁" },

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
  "spot.add": { en: "Add a spot…", "zh-TW": "新增浪點…" },
  "spot.edit": { en: "Edit “{name}”…", "zh-TW": "編輯「{name}」…" },
  "spot.addTitle": { en: "Add a spot", "zh-TW": "新增浪點" },
  "spot.editTitle": { en: "Edit spot", "zh-TW": "編輯浪點" },
  "spot.detected": {
    en: "Detected from the location — fix it if it's not what you'd call this place.",
    "zh-TW": "已依位置自動偵測——如果不是你習慣的稱呼，可以直接修改。",
  },
  "spot.intro": {
    en: "Spots are shared with everyone who uses Surflog, so they can log sessions there too.",
    "zh-TW": "浪點會分享給所有 Surflog 使用者，大家都能在那裡記錄。",
  },
  "spot.name": { en: "Name", "zh-TW": "名稱" },
  "spot.namePlaceholder": { en: "e.g. Cloud 9", "zh-TW": "例如 Cloud 9" },
  "spot.nameZh": { en: "Chinese name (optional)", "zh-TW": "中文名稱（選填）" },
  "spot.country": { en: "Country", "zh-TW": "國家" },
  "spot.countryPlaceholder": { en: "e.g. Philippines", "zh-TW": "例如 Philippines" },
  "spot.area": { en: "Area", "zh-TW": "地區" },
  "spot.areaPlaceholder": { en: "e.g. Siargao", "zh-TW": "例如 Siargao" },
  "spot.location": { en: "Location", "zh-TW": "位置" },
  "spot.locationPlaceholder": {
    en: "Coordinates or a Google Maps link",
    "zh-TW": "座標或 Google 地圖連結",
  },
  "spot.locationHint": {
    en: "In Google Maps, press and hold the break, then copy the coordinates (or the link). Conditions come from the nearest ocean grid point, so the pin only needs to be on the right stretch of coast.",
    "zh-TW": "在 Google 地圖上長按浪點，複製座標（或連結）貼上即可。浪況取自最近的海面網格點，所以位置標在正確的海岸附近就夠了。",
  },
  "spot.locationKeep": { en: "Leave empty to keep {coords}", "zh-TW": "留空則維持 {coords}" },
  "spot.pin": { en: "Pin: {coords}", "zh-TW": "座標：{coords}" },
  "spot.shortLink": {
    en: "Short links are looked up when you save.",
    "zh-TW": "短網址會在儲存時解析。",
  },
  "spot.useMyLocation": { en: "Use my current location", "zh-TW": "使用我目前的位置" },
  "spot.locating": { en: "Locating…", "zh-TW": "定位中…" },
  "spot.err.geoDenied": {
    en: "Couldn't get your location. Check the browser's location permission, or paste coordinates instead.",
    "zh-TW": "無法取得你的位置。請檢查瀏覽器的定位權限，或改貼座標。",
  },
  "spot.err.geoUnavailable": {
    en: "This browser can't share its location. Paste coordinates instead.",
    "zh-TW": "這個瀏覽器無法提供定位。請改貼座標。",
  },
  "request.limit": { en: "You already have 20 pending requests.", "zh-TW": "你已經有 20 個待處理的申請。" },
  "spot.facing": { en: "Faces (optional)", "zh-TW": "朝向（選填）" },
  "spot.facingUnknown": { en: "Not sure", "zh-TW": "不確定" },
  "spot.facingHint": {
    en: "The compass direction the break faces out to sea. With it, the wind tile can say onshore / offshore.",
    "zh-TW": "浪點面向外海的方位。填了之後，風向欄會標示是向岸風還是離岸風。",
  },
  "spot.save": { en: "Add spot", "zh-TW": "新增浪點" },
  "spot.saving": { en: "Adding…", "zh-TW": "新增中…" },
  "spot.update": { en: "Save changes", "zh-TW": "儲存變更" },
  "spot.delete": { en: "Delete spot", "zh-TW": "刪除浪點" },
  "spot.deleteConfirm": { en: "Delete for everyone?", "zh-TW": "要為所有人刪除嗎？" },
  "spot.added": { en: "Spot added", "zh-TW": "已新增浪點" },
  "spot.updated": { en: "Spot updated", "zh-TW": "已更新浪點" },
  "spot.deleted": { en: "Spot deleted", "zh-TW": "已刪除浪點" },
  "spot.pickExisting": { en: "Use “{name}”", "zh-TW": "使用「{name}」" },
  "spot.addAnyway": { en: "It's different — add anyway", "zh-TW": "不同的浪點，仍要新增" },
  "spot.err.duplicate": {
    en: "“{name}” is already in the catalogue.",
    "zh-TW": "「{name}」已經在浪點清單裡了。",
  },
  "spot.err.nearby": {
    en: "These spots are already close by: {names}. Is yours a different break?",
    "zh-TW": "附近已經有這些浪點：{names}。你要新增的是不同的浪點嗎？",
  },
  "spot.err.badLocation": {
    en: "Couldn't find coordinates in that. Paste like 9.814, 126.167 or a Google Maps link.",
    "zh-TW": "找不到座標。請貼上像 9.814, 126.167 的座標，或 Google 地圖連結。",
  },
  "spot.err.noSea": {
    en: "There's no ocean data at that location — is the pin on land, far from the coast?",
    "zh-TW": "這個位置查不到海況資料——座標是不是標在離海岸很遠的陸地上？",
  },
  "spot.err.lookup": {
    en: "Couldn't check that location right now. Try again in a moment.",
    "zh-TW": "目前無法確認這個位置，請稍後再試。",
  },
  "spot.err.inUse": {
    en: "Sessions are logged at this spot, so it can't be deleted.",
    "zh-TW": "已有人在這個浪點留下紀錄，所以無法刪除。",
  },
  "spot.err.generic": { en: "Couldn't save the spot", "zh-TW": "無法儲存浪點" },
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
  // Spot picker (components/spot-picker.tsx) + its note in the log form.
  "picker.title": { en: "Choose a spot", "zh-TW": "選擇浪點" },
  "picker.search": { en: "Search spots", "zh-TW": "搜尋浪點" },
  "picker.clear": { en: "Clear search", "zh-TW": "清除搜尋" },
  "picker.current": { en: "Current", "zh-TW": "目前的浪點" },
  "picker.recent": { en: "Recent", "zh-TW": "最近去過" },
  "picker.nearby": { en: "Near {name}", "zh-TW": "{name}附近" },
  "picker.nearYou": { en: "Near you", "zh-TW": "離你最近" },
  "picker.taiwan": { en: "Taiwan", "zh-TW": "台灣" },
  "picker.elsewhere": { en: "Elsewhere", "zh-TW": "其他地區" },
  "picker.nearMe": { en: "Near me", "zh-TW": "我附近" },
  "picker.locating": { en: "Finding you…", "zh-TW": "定位中…" },
  "picker.located": {
    en: "Sorted by distance. Your location stays on this device.",
    "zh-TW": "已依距離排序，你的位置只留在這台裝置上。",
  },
  "picker.locationDenied": {
    en: "Location is off for this site, so spots can't be sorted by distance.",
    "zh-TW": "這個網站沒有定位權限，無法依距離排序。",
  },
  "picker.locationUnavailable": { en: "Couldn't get your location.", "zh-TW": "無法取得你的位置。" },
  "picker.noMatch": { en: "No spots match “{query}”.", "zh-TW": "找不到符合「{query}」的浪點。" },
  "picker.add": { en: "Add “{query}” as a new spot", "zh-TW": "將「{query}」新增為浪點" },
  "picker.request": { en: "Can't find your spot? Request it", "zh-TW": "找不到你的浪點？申請新增" },
  "picker.pending": { en: "Requested — waiting for approval", "zh-TW": "已申請 — 等待審核" },
  "request.title": { en: "Request a spot", "zh-TW": "申請新增浪點" },
  "request.intro": {
    en: "Avery will add it to the spot list. You can log your session there right away — conditions fill in once it's approved.",
    "zh-TW": "Avery 會把它加進浪點清單。你現在就可以先記錄這次衝浪，審核通過後會自動補上浪況。",
  },
  "request.name": { en: "Spot name", "zh-TW": "浪點名稱" },
  "request.location": { en: "Location (optional)", "zh-TW": "位置（選填）" },
  "request.locationPlaceholder": {
    en: "Paste a map link or coordinates",
    "zh-TW": "貼上地圖連結或座標",
  },
  "request.useMyLocation": { en: "Use my current location", "zh-TW": "使用我目前的位置" },
  "request.locating": { en: "Finding you…", "zh-TW": "定位中…" },
  "request.locationDenied": {
    en: "Location is off for this site — paste a map link instead.",
    "zh-TW": "這個網站沒有定位權限，請改貼地圖連結。",
  },
  "request.locationUnavailable": {
    en: "Couldn't get your location — paste a map link instead.",
    "zh-TW": "無法取得你的位置，請改貼地圖連結。",
  },
  "request.note": { en: "Note (optional)", "zh-TW": "備註（選填）" },
  "request.notePlaceholder": {
    en: "Anything that helps find it: nearest town, which side of the bay…",
    "zh-TW": "有助於找到它的資訊：最近的城鎮、在海灣的哪一側…",
  },
  "request.send": { en: "Send request", "zh-TW": "送出申請" },
  "request.sending": { en: "Sending…", "zh-TW": "送出中…" },
  "request.sent": { en: "Request sent", "zh-TW": "已送出申請" },
  "request.failed": { en: "Couldn't send the request. Try again.", "zh-TW": "無法送出申請，請再試一次。" },
  "form.spotTimeNote": {
    en: "Times are local to {place} ({tz}).",
    "zh-TW": "時間為{place}當地時間（{tz}）。",
  },
  // spot admin dashboard (/admin) — only ever rendered for SPOT_ADMIN_EMAILS
  "menu.spotAdmin": { en: "Spot admin", "zh-TW": "浪點管理" },
  "admin.title": { en: "Spot admin", "zh-TW": "浪點管理" },
  "admin.back": { en: "Back to journal", "zh-TW": "回到日誌" },
  "admin.requests": { en: "Requests", "zh-TW": "待處理的申請" },
  "admin.noRequests": { en: "No requests waiting.", "zh-TW": "目前沒有待處理的申請。" },
  "admin.unknownRequester": { en: "Unknown requester", "zh-TW": "申請人不明" },
  "admin.approve": { en: "Approve", "zh-TW": "核准" },
  "admin.decline": { en: "Decline", "zh-TW": "婉拒" },
  "admin.approved": { en: "Request approved", "zh-TW": "已核准申請" },
  "admin.declined": { en: "Request declined", "zh-TW": "已婉拒申請" },
  "admin.couldntApprove": { en: "Couldn't approve the request", "zh-TW": "無法核准申請" },
  "admin.couldntDecline": { en: "Couldn't decline the request", "zh-TW": "無法婉拒申請" },
  "admin.resolved": { en: "Handled requests ({count})", "zh-TW": "已處理的申請（{count}）" },
  "admin.statusApproved": { en: "approved", "zh-TW": "已核准" },
  "admin.statusDeclined": { en: "declined", "zh-TW": "已婉拒" },
  "admin.spots": { en: "Spots", "zh-TW": "浪點" },
  "admin.addSpot": { en: "Add spot", "zh-TW": "新增浪點" },
  "admin.search": { en: "Search spots", "zh-TW": "搜尋浪點" },
  "admin.noSpots": { en: "No spots match.", "zh-TW": "找不到符合的浪點。" },
  "admin.edit": { en: "Edit", "zh-TW": "編輯" },
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
