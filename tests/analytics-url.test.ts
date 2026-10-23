import { describe, expect, it } from "vitest";
import { scrubAnalyticsUrl } from "@/lib/analytics-url";

const TOKEN = "a".repeat(43);

describe("scrubAnalyticsUrl", () => {
  it("masks a public share token", () => {
    expect(scrubAnalyticsUrl(`https://surflog.tw/share/${TOKEN}`)).toBe(
      "https://surflog.tw/share/[token]",
    );
    expect(scrubAnalyticsUrl(`https://surflog.tw/share/${TOKEN}/card.png`)).toBe(
      "https://surflog.tw/share/[token]/card.png",
    );
  });

  it("drops the query string and hash", () => {
    expect(
      scrubAnalyticsUrl("https://surflog.tw/signin?callbackUrl=%2Foauth%2Fauthorize%3Fstate%3Dx#top"),
    ).toBe("https://surflog.tw/signin");
  });

  it("keeps ordinary paths", () => {
    expect(scrubAnalyticsUrl("https://surflog.tw/spots/jialeshui")).toBe(
      "https://surflog.tw/spots/jialeshui",
    );
    expect(scrubAnalyticsUrl("https://surflog.tw/")).toBe("https://surflog.tw/");
  });

  it("still scrubs an address it cannot parse", () => {
    expect(scrubAnalyticsUrl(`/share/${TOKEN}?x=1`)).toBe("/share/[token]");
  });
});
