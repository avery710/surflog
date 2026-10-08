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
  "entry.viewPhoto": { en: "View photo {n} of {total}", "zh-TW": "檢視第 {n} 張照片（共 {total} 個）" },
  "entry.viewVideo": { en: "Play video {n} of {total}", "zh-TW": "播放第 {n} 個影片（共 {total} 個）" },
  "viewer.title": { en: "Photos and videos", "zh-TW": "照片與影片" },
  "viewer.prev": { en: "Previous", "zh-TW": "上一個" },
  "viewer.next": { en: "Next", "zh-TW": "下一個" },
  "toast.editMediaFailed": {
    en: "Changes saved, but {n} photo/video change(s) failed. Open Edit to try again.",
    "zh-TW": "變更已儲存，但有 {n} 個照片/影片未能更新。請再次開啟編輯重試。",
  },
  "toast.fileTooLarge": {
    en: "That file is too large (50 MB max; videos up to about 4 minutes)",
    "zh-TW": "檔案太大（上限 50 MB，影片約 4 分鐘以內）",
  },
  "toast.notMedia": { en: "Only photos and videos can be added", "zh-TW": "只能新增照片或影片" },
  "toast.tooManyMedia": { en: "Up to {max} photos/videos per session", "zh-TW": "每筆紀錄最多 {max} 個照片/影片" },
  "toast.savedMediaFailed": {
    en: "Session saved, but {n} of {total} files couldn't be uploaded. Add them by editing the session.",
    "zh-TW": "已儲存，但 {total} 個檔案中有 {n} 個上傳失敗，可以編輯該筆紀錄重新新增。",
  },
  "toast.savedFilled": { en: "Session saved — conditions filled in", "zh-TW": "已儲存，浪況已自動帶入" },
  "toast.saved": { en: "Session saved", "zh-TW": "已儲存" },
  "toast.couldntSave": { en: "Couldn't save", "zh-TW": "無法儲存" },
  "toast.changesSaved": { en: "Changes saved", "zh-TW": "已儲存變更" },
  "toast.conditionsRefreshed": { en: "Conditions refreshed", "zh-TW": "浪況已更新" },
  "toast.stillNoCoords": { en: "Still no coordinates for this spot", "zh-TW": "這個浪點還沒有座標" },
  "toast.couldntRefresh": { en: "Couldn't refresh", "zh-TW": "無法更新" },

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
  "entry.removePhoto": { en: "Remove", "zh-TW": "移除" },
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
  "form.mediaUploading": { en: "Uploading", "zh-TW": "上傳中" },
  "form.mediaDone": { en: "Uploaded", "zh-TW": "已上傳" },
  "form.mediaFailed": { en: "Upload failed", "zh-TW": "上傳失敗" },
  "form.compressingMedia": { en: "Compressing video {n} of {total}…", "zh-TW": "壓縮影片中 {n}/{total}…" },
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
  "calendar.title": { en: "Days in the water", "zh-TW": "在海裡的日子" },
  "calendar.session": { en: "{n} session", "zh-TW": "{n} 次" },
  "calendar.sessions": { en: "{n} sessions", "zh-TW": "{n} 次" },
  "calendar.showOlderWeeks": { en: "Show older weeks", "zh-TW": "顯示較舊的週次" },
  "calendar.showNewerWeeks": { en: "Show more recent weeks", "zh-TW": "顯示較新的週次" },
  // Sunday-first (as displayed) weekday header above the dot grid, one letter/character each.
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
    "zh-TW": "幫你自動記下海況的衝浪日誌",
  },
  "landing.hero.body": {
    en: "Log the spot and the time. Swell, wind, tide and water temperature for that moment attach themselves — so after a season, you can see which conditions actually work at your breaks.",
    "zh-TW": "只要填浪點和時間，當下的湧浪、風、潮汐和水溫就會自動附上。累積一季後，你就看得出哪些條件在你常去的浪點真的好衝。",
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
  "landing.dash.title": { en: "Your surf log, your best sidekick", "zh-TW": "你的衝浪好幫手" },
  "landing.dash.body": {
    en: "Set a few things to work on and tick them off each session. See every day you surfed, month by month, and where you go most — with your own notes on each spot.",
    "zh-TW": "設定幾個想練的重點，每次衝完勾選做到的項目；逐月看你哪幾天下水、最常去哪裡，每個浪點還能留下自己的筆記。",
  },
  "landing.dash.photoCredits": { en: "Board photos", "zh-TW": "板子照片來源" },
  "landing.spots.title": { en: "A spot list surfers grow", "zh-TW": "和浪友一起蒐集世界浪點地圖" },
  "landing.spots.body": {
    en: "{n} spots across {c} countries, from Taiwan to Siargao to Bali, and growing. Pick one when you log a session and its conditions come with it.",
    "zh-TW": "橫跨 {c} 個國家、共 {n} 個浪點，從台灣、錫亞高到峇里島，持續增加。記錄時選一個，浪況就會自動帶入。",
  },
  "landing.spots.request": {
    en: "Missing yours? Sign in, request it, and start logging there right away.",
    "zh-TW": "找不到你的浪點？登入後申請新增，馬上就能開始記錄。",
  },
  "landing.share.title": { en: "Share a session your way", "zh-TW": "把這次衝浪分享出去" },
  "landing.share.body": {
    en: "Turn any session into an image, a strip, a column or a card to lay over your own photo, or switch on a link anyone can open. A session stays private until you share it.",
    "zh-TW": "把任何一筆紀錄變成圖片：可以疊在你照片上的橫條、直條或卡片；也可以開啟任何人都能打開的連結。在你分享之前，紀錄只有你看得到。",
  },
  "landing.share.linkBody": {
    en: "Anyone with the link sees the conditions, your notes, photos and videos, with no sign-in. Turn it off and the link stops working.",
    "zh-TW": "拿到連結的人不用登入，就能看到浪況、你的筆記、照片與影片。關閉後連結就會失效。",
  },
  "landing.agent.title": { en: "Bring your own AI app", "zh-TW": "接上你自己的 AI App" },
  "landing.agent.body": {
    en: "Connect the AI you already use: Claude, ChatGPT, Gemini and more. Log a session by just saying so, then have it analyse your journal and give you advice. Conditions fill in the same way as when you log by hand.",
    "zh-TW": "連結你平常在用的 AI：Claude、ChatGPT、Gemini 等等。用一句話就能記錄一次下水，再請它分析你的日誌、給你建議。浪況會和手動記錄時一樣自動帶入。",
  },
  "landing.agent.ask": {
    en: "Surfed Jialeshui at 6 this morning. Really clean, not crowded, great for practising. I looked where I wanted to go on the take-off.",
    "zh-TW": "我今天早上六點在佳樂水衝浪，很乾淨，人不多很好練習。起乘時有看向要去的地方了。",
  },
  "landing.agent.reply": {
    en: "Logged. Swell 1.1 m from the east at 8 s, light offshore wind, tide rising.",
    "zh-TW": "記好了。湧浪 1.1 m、東向、週期 8 s，微弱離岸風，漲潮中。",
  },
  "landing.agent.ask2": {
    en: "Looking at my last ten sessions, what should I work on next?",
    "zh-TW": "看我最近十次的紀錄，接下來該練什麼？",
  },
  // Condensed from advice a real agent gave Avery on their own journal
  // (2026-10-07). The line breaks render: the bubble is whitespace-pre-line.
  "landing.agent.reply2": {
    en: "For your next sessions, keep it to three simple goals:\n1. Position: stay in a deliberate spot instead of chasing every wave.\n2. Take-off: chest up, don't lie too far forward.\n3. Eyes: pick your direction before take-off, then look down the line.",
    "zh-TW": "接下來幾次下水，目標簡單就好，只要三個：\n1. 位置：待在選好的位置，不要一直追浪。\n2. 起乘：挺胸，不要趴太前面。\n3. 視線：起乘前先決定方向，站起來就看向要去的地方。",
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
  "landing.demo.spotNote.jialeshui": {
    en: "Best at mid tide, on ENE to SSE swell with a west wind. Steady river-mouth rights.",
    "zh-TW": "中潮最好，東北東到南南東的湧浪配西風，河口右浪很穩",
  },
  "landing.demo.spotNote.fulong": {
    en: "Works on any tide, on N to E swell with a south or southwest wind. Sandbar lefts and rights.",
    "zh-TW": "乾潮到滿潮都能衝，北到東的湧浪配南或西南風，沙洲左右浪都有",
  },
  "landing.demo.board.goofyNote": {
    en: "Zero flex. Maximum wipeout.",
    "zh-TW": "零炫技，摔爆全場。",
  },
  "landing.demo.board.stitchNote": {
    en: "Blue alien energy. Pure joy.",
    "zh-TW": "藍色外星人能量，純粹開心。",
  },
  "landing.demo.goal1": { en: "Eyes down the line", "zh-TW": "視線看向要去的地方" },
  "landing.demo.goal2": { en: "Check the peak before you paddle in", "zh-TW": "起乘時留意浪頭是否有人下了" },
  "landing.demo.goal3": { en: "Sit back into your heels on backside", "zh-TW": "背向要往腳跟坐下去" },

  "action.logSession": { en: "Log a session", "zh-TW": "新增衝浪紀錄" },
  "action.signOut": { en: "Sign out", "zh-TW": "登出" },
  "section.sessions": { en: "Sessions", "zh-TW": "紀錄" },
  "goal.title": { en: "Goal for next session", "zh-TW": "下次衝浪的目標" },
  "goal.add": { en: "Add a technique goal to work on next time", "zh-TW": "新增下次要練習的技巧目標" },
  "goal.placeholder": { en: "e.g. look where you want to go", "zh-TW": "例如：視線看向要去的方向" },
  "goal.edit": { en: "Edit goal for next session", "zh-TW": "編輯下次衝浪的目標" },
  "goal.addPoint": { en: "Add point", "zh-TW": "新增項目" },
  "goal.editPoint": { en: "Point {n}", "zh-TW": "第 {n} 項" },
  "goal.removePoint": { en: "Remove “{point}”", "zh-TW": "移除「{point}」" },
  "goal.removeSure": { en: "Remove?", "zh-TW": "移除？" },
  "goal.dragPoint": { en: "Drag to reorder “{point}”", "zh-TW": "拖曳調整「{point}」的順序" },
  "goal.whichDidYouAchieve": { en: "Which did you achieve?", "zh-TW": "這次達成了哪些？" },
  "goal.achievedSession": { en: "achieved in {n} session", "zh-TW": "已達成 {n} 次" },
  "goal.achievedSessions": { en: "achieved in {n} sessions", "zh-TW": "已達成 {n} 次" },
  "goal.achieved": { en: "Achieved", "zh-TW": "已達成" },
  "goal.showMore": { en: "Show {n} more achieved", "zh-TW": "再顯示 {n} 項已達成" },
  "goal.showLess": { en: "Show less", "zh-TW": "收合" },
  "goal.scrollHint": { en: "More goal points — scroll to see them", "zh-TW": "還有更多目標項目，可捲動查看" },
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
  "spot.err.geoPasteInstead": { en: "Or paste coordinates instead.", "zh-TW": "也可以改貼座標。" },
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
  "entry.delete": { en: "Delete", "zh-TW": "刪除" },
  "entry.share": { en: "Share", "zh-TW": "分享" },
  "share.title": { en: "Share this session", "zh-TW": "分享這次衝浪" },
  "share.description": {
    en: "Make an image of this session to post or send, or turn on a link anyone can open.",
    "zh-TW": "做一張這次衝浪的圖片來發佈或傳送，或開啟任何人都能打開的連結。",
  },
  "share.variant.label": { en: "Image style", "zh-TW": "圖片樣式" },
  "share.variant.strip": { en: "Strip", "zh-TW": "橫條" },
  "share.variant.column": { en: "Column", "zh-TW": "直條" },
  "share.variant.card": { en: "Card", "zh-TW": "卡片" },
  "share.variant.stripNote": {
    en: "Data in one row of cut-out tiles, plain text for the rest. Transparent: lay it over your own photo or video.",
    "zh-TW": "數據排成一列鏤空方塊，其餘為純文字。透明背景，可疊在你的照片或影片上。",
  },
  "share.variant.columnNote": {
    en: "Text only, data stacked. Transparent: lay it over your own photo or video.",
    "zh-TW": "純文字，數據直排。透明背景，可疊在你的照片或影片上。",
  },
  "share.variant.cardNote": {
    en: "A white card, transparent around it: lay it over your own photo or video.",
    "zh-TW": "白色卡片，四周透明，可疊在你的照片或影片上。",
  },
  "share.tone.label": { en: "Color mode", "zh-TW": "色彩模式" },
  "share.tone.light": { en: "Light", "zh-TW": "淺色" },
  "share.tone.dark": { en: "Dark", "zh-TW": "深色" },
  "share.parts.label": { en: "Show", "zh-TW": "顯示" },
  "share.part.datetime": { en: "Date & time", "zh-TW": "日期時間" },
  "share.part.waves": { en: "Wave data", "zh-TW": "浪況" },
  "share.part.board": { en: "Board", "zh-TW": "衝浪板" },
  "share.part.log": { en: "Log", "zh-TW": "筆記" },
  "share.parts.none": { en: "Turn at least one thing on.", "zh-TW": "至少開啟一項。" },
  "share.lang.label": { en: "Image language", "zh-TW": "圖片語言" },
  "share.lang.en": { en: "English", "zh-TW": "English" },
  "share.lang.zh": { en: "中文", "zh-TW": "中文" },
  "share.preview.alt": { en: "Preview of the share image", "zh-TW": "分享圖片預覽" },
  "share.preview.loading": { en: "Drawing the image…", "zh-TW": "圖片產生中…" },
  "share.preview.failed": { en: "Couldn't draw the image.", "zh-TW": "無法產生圖片。" },
  "share.preview.retry": { en: "Try again", "zh-TW": "重試" },
  "share.button.share": { en: "Share", "zh-TW": "分享" },
  "share.button.copyImage": { en: "Copy image", "zh-TW": "複製圖片" },
  "share.button.saveImage": { en: "Save image", "zh-TW": "儲存圖片" },
  "share.button.copyLink": { en: "Copy link", "zh-TW": "複製連結" },
  "share.toast.imageCopied": { en: "Image copied", "zh-TW": "圖片已複製" },
  "share.toast.linkCopied": { en: "Link copied", "zh-TW": "連結已複製" },
  "share.toast.copyFailed": { en: "Couldn't copy. Try Save image instead.", "zh-TW": "無法複製，請改用「儲存圖片」。" },
  "share.toast.shareFailed": { en: "Couldn't open the share sheet", "zh-TW": "無法開啟分享選單" },
  "share.noClipboard": {
    en: "This browser can't copy images. Use Save image.",
    "zh-TW": "這個瀏覽器無法複製圖片，請使用「儲存圖片」。",
  },
  "share.hint.story": {
    en: "For an Instagram story: copy or save the image, open Instagram, then paste the image onto your photo or video.",
    "zh-TW": "要發限時動態：先複製或儲存圖片，打開 Instagram，再把圖片貼到你的照片或影片上。",
  },
  "share.act.label": { en: "Send it", "zh-TW": "傳送" },
  "share.act.instagram": { en: "Instagram Story", "zh-TW": "Instagram 限時動態" },
  "share.act.more": { en: "More", "zh-TW": "更多" },
  "share.act.whatsapp": { en: "WhatsApp", "zh-TW": "WhatsApp" },
  "share.act.line": { en: "LINE", "zh-TW": "LINE" },
  "share.act.linkOff": {
    en: "Turn on Share link below to copy or send a link.",
    "zh-TW": "要複製或傳送連結，請先開啟下方的分享連結。",
  },
  "share.act.linkNote": { en: "WhatsApp and LINE send the public link, not the image.", "zh-TW": "WhatsApp 和 LINE 傳的是公開連結，不是圖片。" },
  "share.toast.storyCopied": {
    en: "Sticker copied. In your story, tap Add sticker to paste it.",
    "zh-TW": "貼圖已複製，到限時動態點「新增貼圖」就能貼上。",
  },
  "share.link.title": { en: "Share link", "zh-TW": "分享連結" },
  "share.link.offDescription": {
    en: "Only you can see this session. Turn this on to get a link anyone can open without signing in.",
    "zh-TW": "目前只有你看得到這筆紀錄。開啟後會產生一個連結，任何人不需登入就能打開。",
  },
  "share.link.onDescription": {
    en: "Anyone with the link can see this session: conditions, notes, photos and videos, and your name. Turn it off and the link stops working.",
    "zh-TW": "任何拿到連結的人都能看到這筆紀錄：浪況、筆記、照片與影片，以及你的名字。關閉後連結就會失效。",
  },
  "share.link.loading": { en: "Checking the link…", "zh-TW": "檢查連結中…" },
  "share.link.turnedOn": { en: "Link is on", "zh-TW": "連結已開啟" },
  "share.link.turnedOff": { en: "Link turned off", "zh-TW": "連結已關閉" },
  "share.link.failed": { en: "Couldn't change the link", "zh-TW": "無法變更連結" },
  "share.link.readonlyLabel": { en: "Public link", "zh-TW": "公開連結" },
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
  // Location failures, shared by "Near me" and both "Use my current
  // location" buttons (lib/geolocation.ts). A refusal often comes with no
  // prompt at all, so none of these say the user declined anything.
  "geo.denied.ios": {
    en: "Location is blocked for this browser or this site. In iOS Settings, open your browser's app → Location → While Using the App, then tap again.",
    "zh-TW": "這個瀏覽器或這個網站的定位被擋住了。請到 iOS「設定」找到你的瀏覽器 App →「位置」→「使用 App 期間」，再點一次。",
  },
  "geo.denied.android": {
    en: "Your browser isn't allowed to use location. In Android Settings, open your browser's app → Permissions → Location, then tap again.",
    "zh-TW": "你的瀏覽器沒有定位權限。請到 Android「設定」找到你的瀏覽器 App →「權限」→「位置」，再點一次。",
  },
  "geo.denied.site": {
    en: "Location is blocked for this site in your browser. Allow it in the site settings (the icon beside the address), then tap again.",
    "zh-TW": "瀏覽器封鎖了這個網站的定位。請在網站設定（網址列旁的圖示）允許定位，再點一次。",
  },
  "geo.denied.device": {
    en: "Your browser didn't allow location. Turn on location for the browser in your device's settings, then tap again.",
    "zh-TW": "瀏覽器沒有允許定位。請在裝置的設定裡開啟這個瀏覽器的定位，再點一次。",
  },
  "geo.unavailable": {
    en: "Couldn't get your location right now. Tap to try again.",
    "zh-TW": "目前無法取得你的位置，請再點一次試試。",
  },
  "geo.timeout": {
    en: "Finding your location took too long. Tap to try again.",
    "zh-TW": "定位花太久了，請再點一次試試。",
  },
  "geo.unsupported": {
    en: "This browser can't share its location.",
    "zh-TW": "這個瀏覽器無法提供定位。",
  },
  "geo.insecure": {
    en: "Location only works on a secure (https) page.",
    "zh-TW": "定位只能在安全連線（https）的頁面使用。",
  },
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
  "request.locationPasteInstead": { en: "Or paste a map link instead.", "zh-TW": "也可以改貼地圖連結。" },
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
  "menu.apiTokens": { en: "Connect an AI app", "zh-TW": "連結 AI App" },
  // /spots — the whole catalogue as a page
  "menu.spots": { en: "Surf spots", "zh-TW": "浪點總覽" },
  "spots.title": { en: "Surf spots", "zh-TW": "浪點總覽" },
  "spots.intro": {
    en: "Every break you can log a session at, shared by everyone on Surflog.",
    "zh-TW": "所有可以記錄的浪點，由 Surflog 的所有使用者共用。",
  },
  "spots.count": { en: "{count} spots", "zh-TW": "{count} 個浪點" },
  "spots.matchCount": { en: "{shown} of {count} spots", "zh-TW": "{count} 個浪點中符合 {shown} 個" },
  "spots.faces": { en: "Faces", "zh-TW": "朝向" },
  "spots.bestSwell": { en: "Best swell", "zh-TW": "最佳湧浪" },
  "spots.bestWind": { en: "Best wind", "zh-TW": "最佳風向" },
  "spots.bestTide": { en: "Best tide", "zh-TW": "最佳潮位" },
  "spots.tide.all": { en: "All tides", "zh-TW": "各種潮位皆可" },
  "spots.tide.lowMid": { en: "Low to mid", "zh-TW": "乾潮到中潮" },
  "spots.tide.mid": { en: "Mid", "zh-TW": "中潮" },
  "spots.tide.midHigh": { en: "Mid to high", "zh-TW": "中潮到滿潮" },
  "spots.tide.midLow": { en: "Mid to low", "zh-TW": "中潮到乾潮" },
  "oauth.title": { en: "Connect {name} to your journal?", "zh-TW": "要讓 {name} 連接你的日誌嗎？" },
  "oauth.intro": {
    en: "This app will be able to read, and if you allow it, change your own Surflog sessions and goal as you. Nobody else's data.",
    "zh-TW": "此應用程式將能以你的身分讀取你自己的 Surflog 紀錄與目標，若你允許，也能修改。不會接觸他人的資料。",
  },
  "oauth.readHelp": { en: "List and view sessions, spots, boards and your goal.", "zh-TW": "列出並檢視紀錄、浪點、板子與目標。" },
  "oauth.writeHelp": {
    en: "Also create, edit and delete sessions, and set or clear your goal.",
    "zh-TW": "另可新增、編輯、刪除紀錄，並設定或清除目標。",
  },
  "oauth.redirectNote": {
    en: "After you choose, you'll be sent back to {host}. Only continue if you started this from an app you trust.",
    "zh-TW": "選擇後將返回 {host}。僅在你從信任的應用程式發起時才繼續。",
  },
  "oauth.revokeNote": {
    en: "You can revoke access any time under Connect an AI app.",
    "zh-TW": "你隨時可在「連結 AI App」中撤銷存取。",
  },
  "oauth.allow": { en: "Allow", "zh-TW": "允許" },
  "oauth.deny": { en: "Cancel", "zh-TW": "取消" },
  "oauth.invalid": {
    en: "This connection link isn't valid. Go back to the app and start the connection again.",
    "zh-TW": "此連結無效。請回到應用程式重新發起連線。",
  },
  "tokens.title": { en: "AI apps", "zh-TW": "AI Apps" },
  "tokens.back": { en: "Back to journal", "zh-TW": "回到日誌" },
  "tokens.intro": {
    en: "Let your own AI app read and log your surf sessions. It acts as you, on your journal only, and you can cut it off here at any time.",
    "zh-TW": "讓你自己的 AI App 讀取並記錄你的衝浪紀錄。它以你的身分操作，只限你的日誌，你隨時可在此中斷存取。",
  },
  "tokens.scopeLabel": { en: "Access", "zh-TW": "權限" },
  "tokens.scopeRead": { en: "Read only", "zh-TW": "僅讀取" },
  "tokens.scopeWrite": { en: "Read and write", "zh-TW": "讀取與寫入" },
  "tokens.active": { en: "Connected", "zh-TW": "已連結" },
  "tokens.none": {
    en: "Nothing connected yet. Pick your AI app above to connect it.",
    "zh-TW": "尚未連結任何項目。請在上方選擇你的 AI App 來連結。",
  },
  "tokens.createdOn": { en: "Created {date}", "zh-TW": "建立於 {date}" },
  "tokens.lastUsed": { en: "Last used {date}", "zh-TW": "上次使用 {date}" },
  "tokens.neverUsed": { en: "Never used", "zh-TW": "從未使用" },
  "tokens.create": { en: "Create token", "zh-TW": "建立權杖" },
  "tokens.created": { en: "Token created", "zh-TW": "已建立權杖" },
  "tokens.copyNow": {
    en: "Copy it now — it won't be shown again.",
    "zh-TW": "請立即複製，之後無法再次查看。",
  },
  "tokens.copy": { en: "Copy", "zh-TW": "複製" },
  "tokens.copied": { en: "Copied", "zh-TW": "已複製" },
  "tokens.dismiss": { en: "I've saved it", "zh-TW": "我已儲存" },
  "tokens.couldntCreate": { en: "Couldn't create the token", "zh-TW": "無法建立權杖" },
  "connect.title": { en: "Connect an AI app", "zh-TW": "連結 AI App" },
  "connect.intro": { en: "Which one do you use?", "zh-TW": "你使用哪一個？" },
  "connect.other": { en: "Others", "zh-TW": "其他" },
  "connect.otherTokenName": { en: "My AI app", "zh-TW": "我的 AI App" },
  "connect.pasteUrl": { en: "Name it Surflog and paste this URL:", "zh-TW": "名稱填 Surflog，並貼上此網址：" },
  "connect.allow": {
    en: "Sign in to Surflog if asked, choose what it may do, and press Allow.",
    "zh-TW": "若出現提示請登入 Surflog，選擇權限後按「允許」。",
  },
  "connect.runCommand": { en: "Run this in your terminal:", "zh-TW": "在終端機執行：" },
  "connect.makeToken": { en: "Choose what it may do and create a token:", "zh-TW": "選擇權限並建立權杖：" },
  "connect.menuNote": {
    en: "Menu names inside the app may differ slightly.",
    "zh-TW": "應用程式內的選單名稱可能略有不同。",
  },
  "connect.claude.1": {
    en: "On claude.ai, open Settings → Connectors → Add custom connector.",
    "zh-TW": "在 claude.ai 開啟「設定 → 連接器 → 新增自訂連接器」。",
  },
  "connect.claude.4": {
    en: "It then shows up in Claude on the web, desktop and phone.",
    "zh-TW": "之後即可在 Claude 網頁版、桌面版與手機 App 中使用。",
  },
  "connect.chatgpt.1": {
    en: "In ChatGPT, open Plugins and choose Create a custom MCP server.",
    "zh-TW": "在 ChatGPT 開啟「外掛程式（Plugins）」，選擇建立自訂 MCP 伺服器。",
  },
  "connect.chatgpt.2": {
    en: "Name it Surflog, choose OAuth if asked how to sign in, and paste this URL:",
    "zh-TW": "名稱填 Surflog，若詢問登入方式請選 OAuth，並貼上此網址：",
  },
  "connect.chatgpt.note": {
    en: "Menu names inside ChatGPT may differ slightly.",
    "zh-TW": "ChatGPT 內的選單名稱可能略有不同。",
  },
  "connect.gemini.1": {
    en: "In Gemini, open Settings → Personal intelligence → Connected apps → Custom apps and create a custom app.",
    "zh-TW": "在 Gemini 開啟「設定 → Personal intelligence → Connected apps → Custom apps」，建立自訂應用程式。",
  },
  "connect.claudeCode.2": {
    en: "In Claude Code run /mcp, pick surflog, choose Authenticate, then press Allow in the browser.",
    "zh-TW": "在 Claude Code 執行 /mcp，選擇 surflog 並點選 Authenticate，然後在瀏覽器按「允許」。",
  },
  "connect.codex.2": {
    en: "Then sign in with this command, and press Allow in the browser:",
    "zh-TW": "接著執行此指令登入，並在瀏覽器按「允許」：",
  },
  "connect.cursor.2": {
    en: "Put this in ~/.cursor/mcp.json (or .cursor/mcp.json in a project):",
    "zh-TW": "將以下內容放入 ~/.cursor/mcp.json（或專案內的 .cursor/mcp.json）：",
  },
  "connect.cursor.3": { en: "Restart Cursor.", "zh-TW": "重新啟動 Cursor。" },
  "connect.other.1": {
    en: "Point your AI app at this MCP server (Streamable HTTP):",
    "zh-TW": "將你的 AI App 指向此 MCP 伺服器（Streamable HTTP）：",
  },
  "connect.other.2": {
    en: "If it can sign in with OAuth, that's all: sign in and press Allow.",
    "zh-TW": "若它支援 OAuth 登入，這樣就完成了：登入後按「允許」。",
  },
  "connect.other.3": {
    en: "If not, name it, create a token and send it as this header:",
    "zh-TW": "若不支援，請為它命名、建立權杖，並以此標頭傳送：",
  },
  "connect.waiting": { en: "Waiting for your AI app to connect…", "zh-TW": "等待你的 AI App 連線…" },
  "connect.nameLabel": { en: "Name for this AI app", "zh-TW": "這個 AI App 的名稱" },
  "connect.namePlaceholder": { en: "Name it, e.g. n8n, my script", "zh-TW": "取個名字，例如：n8n、我的腳本" },
  "connect.another": { en: "Connect another", "zh-TW": "再連結一個" },
  "connect.already": {
    en: "Already connected: {name}. Follow the steps only to connect another device.",
    "zh-TW": "已連結：{name}。只有要連結其他裝置時才需要依步驟操作。",
  },
  "connect.connected": { en: "Connected: {name}", "zh-TW": "已連結：{name}" },
  "tokens.personal": { en: "Personal token", "zh-TW": "個人權杖" },
  "admin.services": { en: "Connected services", "zh-TW": "已連結的服務" },
  "admin.servicesIntro": {
    en: "Apps that have connected to Surflog through sign-in, across all users. Counts only, no names.",
    "zh-TW": "所有使用者透過登入連結到 Surflog 的應用程式。僅顯示數量，不含姓名。",
  },
  "admin.servicesNone": { en: "No service has connected yet.", "zh-TW": "尚無服務連結。" },
  "admin.service": { en: "Service", "zh-TW": "服務" },
  "admin.serviceUsers": { en: "Users", "zh-TW": "使用者" },
  "admin.serviceConnections": { en: "Active connections", "zh-TW": "使用中的連結" },
  "admin.serviceLastUsed": { en: "Last used", "zh-TW": "上次使用" },
  "admin.serviceNeverUsed": { en: "never", "zh-TW": "從未" },
  "admin.servicePersonal": { en: "Personal tokens (older)", "zh-TW": "個人權杖（舊）" },
  "tokens.revoke": { en: "Revoke", "zh-TW": "撤銷" },
  "tokens.confirmRevoke": { en: "Confirm revoke", "zh-TW": "確認撤銷" },
  "tokens.revoked": { en: "Access revoked", "zh-TW": "已撤銷存取" },
  "tokens.revokedList": { en: "Revoked ({count})", "zh-TW": "已撤銷（{count}）" },
  "tokens.couldntRevoke": { en: "Couldn't revoke access", "zh-TW": "無法撤銷存取" },
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
