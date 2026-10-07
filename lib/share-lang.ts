import type { ShareLang } from "./share-strings";

/** Accept-Language -> the app's two languages: anything starting with zh
 *  (zh-TW, zh-HK, zh-Hant, even zh-CN) reads as 繁體中文, else English. Only
 *  the highest-ranked language that is zh or en decides. */
export function langFromAcceptLanguage(header: string | null | undefined): ShareLang {
  if (!header) return "en";
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => /^\s*q=([\d.]+)/.exec(p)?.[1]).find(Boolean);
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1, i };
    })
    .filter((x) => x.tag && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    if (tag.startsWith("zh")) return "zh-TW";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}
