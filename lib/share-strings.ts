/**
 * Strings for the places that render on the SERVER in a language chosen per
 * request, not per browser: the share images (next/og) and the public
 * /s/<token> page. lib/i18n.tsx is a "use client" module, so its DICT can't
 * be called from a route handler — this is the pure counterpart for just
 * these surfaces.
 *
 * Keys that exist in lib/i18n.tsx (wind.strength.*, tide.*, tile.*) are the
 * same strings; tests/share-strings.test.ts reads lib/i18n.tsx and fails if
 * a copy drifts. Share-only keys (`share.*`) live here; the dialog's own
 * strings (client side) are in lib/i18n.tsx.
 */
export type ShareLang = "en" | "zh-TW";

export const SHARE_LANGS: readonly ShareLang[] = ["en", "zh-TW"];

export function isShareLang(v: unknown): v is ShareLang {
  return v === "en" || v === "zh-TW";
}

const S = {
  "tile.swellOpenMeteo": { en: "Swell", "zh-TW": "湧浪" },
  "tile.period": { en: "Period", "zh-TW": "週期" },
  "tile.wind": { en: "Wind", "zh-TW": "風" },
  "tile.temp": { en: "Water temp", "zh-TW": "水溫" },
  "tile.airTemp": { en: "Air {t}°C", "zh-TW": "氣溫 {t}°C" },
  "tile.tideOpenMeteo": { en: "Tide", "zh-TW": "潮汐" },
  "tide.rising": { en: "rising", "zh-TW": "漲潮中" },
  "tide.falling": { en: "falling", "zh-TW": "退潮中" },
  "tide.high": { en: "high", "zh-TW": "滿潮" },
  "tide.low": { en: "low", "zh-TW": "乾潮" },
  "tide.nextDay": { en: "+1d", "zh-TW": "隔天" },
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

  "share.board": { en: "Board", "zh-TW": "衝浪板" },
  "share.unknownSpot": { en: "Surf session", "zh-TW": "衝浪紀錄" },
  "share.page.title": { en: "{spot}, {date}", "zh-TW": "{spot}，{date}" },
  "share.page.description": {
    en: "{name} surfed {spot} on {date}.",
    "zh-TW": "{name} 在 {date} 於{spot}衝浪。",
  },
  "share.page.descriptionAnon": {
    en: "A surf session at {spot} on {date}.",
    "zh-TW": "{date} 在{spot}的衝浪紀錄。",
  },
  "share.page.by": { en: "Surfed by {name}", "zh-TW": "衝浪者：{name}" },
  "share.page.conditions": { en: "Conditions", "zh-TW": "浪況" },
  "share.page.photoAlt": { en: "Photo from the session", "zh-TW": "衝浪紀錄的照片" },
  "share.page.cta": { en: "Keep your own surf journal", "zh-TW": "也來記錄你的衝浪日誌" },
  "share.page.open": { en: "Open Surflog", "zh-TW": "開啟 Surflog" },
  "share.page.footer": {
    en: "Shared with Surflog. Conditions are model data for the nearest grid point.",
    "zh-TW": "由 Surflog 分享。浪況為最近網格點的模型資料。",
  },
  "share.image.noConditions": { en: "No conditions recorded", "zh-TW": "沒有浪況資料" },
} as const;

export type ShareKey = keyof typeof S;

export function shareT(lang: ShareLang, key: ShareKey, vars?: Record<string, string | number>): string {
  const s: string = S[key][lang];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

/** The keys that must stay identical to lib/i18n.tsx (checked by a test). */
export const SHARED_WITH_I18N: ShareKey[] = (Object.keys(S) as ShareKey[]).filter((k) => !k.startsWith("share."));

export function shareStringsFor(key: ShareKey): { en: string; "zh-TW": string } {
  return S[key];
}
