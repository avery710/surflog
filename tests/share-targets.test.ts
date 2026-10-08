import { describe, expect, it } from "vitest";
import { canInstagramStory, detectMobileOS, sharePayload } from "@/lib/share-targets";

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

describe("sharePayload", () => {
  const file = new File(["x"], "surflog.png", { type: "image/png" });
  const base = { hasShare: true, file, text: "Come join me on Surflog", url: "https://x.test/share/abc" };
  it("sends image, text and link together when the browser takes them", () => {
    expect(sharePayload({ ...base, canShare: () => true })).toEqual({ files: [file], text: base.text, url: base.url });
  });
  it("folds the link into the text, then drops to the image, then to text + link", () => {
    const noUrlWithFile = (d: ShareData) => !(d.files && d.url);
    expect(sharePayload({ ...base, canShare: noUrlWithFile })).toEqual({ files: [file], text: `${base.text} ${base.url}` });
    const filesOnly = (d: ShareData) => !d.files || (!d.text && !d.url);
    expect(sharePayload({ ...base, canShare: (d) => !!d.files && filesOnly(d) })).toEqual({ files: [file] });
    expect(sharePayload({ ...base, canShare: (d) => !d.files })).toEqual({ text: base.text, url: base.url });
  });
  it("without the image yet it shares text + link; without the Web Share API, nothing", () => {
    expect(sharePayload({ ...base, file: null, canShare: () => true })).toEqual({ text: base.text, url: base.url });
    expect(sharePayload({ ...base, hasShare: false, canShare: () => true })).toBeNull();
    expect(sharePayload({ ...base, canShare: () => false })).toBeNull();
  });
});
