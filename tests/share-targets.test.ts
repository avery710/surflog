import { describe, expect, it } from "vitest";
import { canInstagramStory, detectMobileOS, lineUrl, moreShareKind, whatsappUrl } from "@/lib/share-targets";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

describe("detectMobileOS", () => {
  it("recognises phones", () => {
    expect(detectMobileOS(IPHONE, 5)).toBe("ios");
    expect(detectMobileOS(ANDROID, 5)).toBe("android");
  });
  it("treats a touch Mac as an iPad but a plain Mac as desktop", () => {
    expect(detectMobileOS(MAC, 5)).toBe("ios");
    expect(detectMobileOS(MAC, 0)).toBeNull();
  });
});

describe("canInstagramStory", () => {
  it("needs a phone and image clipboard", () => {
    expect(canInstagramStory("ios", true)).toBe(true);
    expect(canInstagramStory("android", false)).toBe(false);
    expect(canInstagramStory(null, true)).toBe(false);
  });
});

describe("link intents", () => {
  const link = "https://x.test/s/abc?v=1&a=b";
  it("encodes the whole message", () => {
    expect(whatsappUrl(link)).toBe(`https://wa.me/?text=${encodeURIComponent(link)}`);
    expect(whatsappUrl(link, "Hi 浪")).toContain(encodeURIComponent("Hi 浪 " + link));
    expect(lineUrl(link)).toBe(`https://line.me/R/msg/text/?${encodeURIComponent(link)}`);
    expect(lineUrl(link, "Hi")).toContain("%0A");
  });
});

describe("moreShareKind", () => {
  it("prefers the file, falls back to the link, else hides", () => {
    expect(moreShareKind({ hasShare: true, canShareFile: true, link: null })).toBe("file");
    expect(moreShareKind({ hasShare: true, canShareFile: false, link: "https://a" })).toBe("link");
    expect(moreShareKind({ hasShare: true, canShareFile: false, link: null })).toBeNull();
    expect(moreShareKind({ hasShare: false, canShareFile: true, link: "https://a" })).toBeNull();
  });
});
