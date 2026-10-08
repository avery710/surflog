import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHARED_WITH_I18N, shareStringsFor } from "@/lib/share-strings";
import { langFromAcceptLanguage } from "@/lib/share-lang";
import { publicSharePath, isTokenShape } from "@/lib/share-paths";
import { clientIp, limitShareMiss, limitShareRequest, SHARE_LIMITS, SHARE_MISSES } from "@/lib/share-limits";
import { resetRateLimits } from "@/lib/rate-limit";

const i18n = readFileSync(new URL("../lib/i18n.tsx", import.meta.url), "utf8");

describe("lib/share-strings.ts stays in step with lib/i18n.tsx", () => {
  it.each(SHARED_WITH_I18N)("%s is the same string in both languages", (key) => {
    const line = i18n.split("\n").find((l) => l.trimStart().startsWith(`"${key}":`));
    expect(line, `${key} missing from lib/i18n.tsx`).toBeTruthy();
    const m = /\{ en: "(.*?)", "zh-TW": "(.*?)" \}/.exec(line as string);
    expect(m, `${key} must be a one-line entry`).toBeTruthy();
    const { en, "zh-TW": zh } = shareStringsFor(key);
    expect(en).toBe(m![1]);
    expect(zh).toBe(m![2]);
  });
});

describe("langFromAcceptLanguage", () => {
  it.each([
    [null, "en"],
    ["", "en"],
    ["en-US,en;q=0.9", "en"],
    ["zh-TW,zh;q=0.9,en;q=0.8", "zh-TW"],
    ["zh-Hant-HK", "zh-TW"],
    ["zh-CN", "zh-TW"],
    ["fr-FR,fr;q=0.9,en;q=0.5", "en"],
    ["de", "en"],
    ["en;q=0.5,zh;q=0.9", "zh-TW"],
    ["ZH-tw", "zh-TW"],
  ])("%s -> %s", (header, expected) => {
    expect(langFromAcceptLanguage(header)).toBe(expected);
  });
});

describe("publicSharePath: the only unauthenticated paths", () => {
  const T = "A".repeat(43);
  const BLOB = "0123456789abcdef0123456789abcdef";
  it("accepts exactly the three shapes", () => {
    expect(publicSharePath(`/share/${T}`)).toBe("page");
    expect(publicSharePath(`/share/${T}/card.png`)).toBe("image");
    expect(publicSharePath(`/api/share/${T}/media/${BLOB}`)).toBe("media");
    expect(publicSharePath(`/share/abc_-${"x".repeat(40)}`)).toBe("page");
  });
  it.each([
    "/share",
    "/share/",
    `/s/${T}`, // the old path: redirected by next.config.ts, never served
    `/share/${T}/`,
    `/share/${T}/other`,
    `/share/${T}/card.png/extra`,
    `/share/${T}/../api/sessions`,
    "/share/short",
    `/share/${"A".repeat(200)}`,
    `/share/${T}%2Fx`,
    `/api/share/${T}`,
    `/api/share/${T}/media`,
    `/api/share/${T}/media/NOT-HEX-NOT-HEX-NOT-HEX-NOT-HEX1`,
    `/api/share/${T}/media/${BLOB}/x`,
    `/api/sessions/${T}/share`,
    `/api/blob/${BLOB}`,
    `/api/mcp`,
  ])("keeps %s behind sign-in", (p) => {
    expect(publicSharePath(p)).toBeNull();
  });
  it("isTokenShape", () => {
    expect(isTokenShape(T)).toBe(true);
    expect(isTokenShape("short")).toBe(false);
    expect(isTokenShape(`${T}!`)).toBe(false);
  });
});

describe("share rate limits", () => {
  it("limits per IP and per kind; misses have their own, smaller budget", () => {
    resetRateLimits();
    const img = SHARE_LIMITS.image.limit;
    for (let i = 0; i < img; i++) expect(limitShareRequest("1.1.1.1", "image").ok).toBe(true);
    expect(limitShareRequest("1.1.1.1", "image").ok).toBe(false);
    expect(limitShareRequest("2.2.2.2", "image").ok).toBe(true);
    expect(limitShareRequest("1.1.1.1", "page").ok).toBe(true);

    for (let i = 0; i < SHARE_MISSES.limit; i++) expect(limitShareMiss("3.3.3.3").ok).toBe(true);
    const over = limitShareMiss("3.3.3.3");
    expect(over.ok).toBe(false);
    expect(over.retryAfterS).toBeGreaterThan(0);
    resetRateLimits();
  });

  it("clientIp takes the first x-forwarded-for hop", () => {
    const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null });
    expect(clientIp(h({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(h({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
