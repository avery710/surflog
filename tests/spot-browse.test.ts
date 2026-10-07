import { describe, expect, it } from "vitest";
import {
  browseGroups,
  facingPoints,
  fold,
  nameMatches,
  searchSpots,
  searchTokens,
  tideBandKey,
} from "@/lib/spot-browse";
import type { Region, Spot } from "@/lib/spots";

const spot = (over: Partial<Spot> & { slug: string; name: string }): Spot => ({
  country: "Taiwan",
  area: "",
  lat: 0,
  lng: 0,
  timezone: "Asia/Taipei",
  ...over,
});

const SPOTS: Spot[] = [
  spot({ slug: "jialeshui", name: "Jialeshui", nameZh: "佳樂水", region: "South", area: "South" }),
  spot({ slug: "waiao", name: "Wai'ao", nameZh: "外澳", region: "Northeast", area: "Northeast" }),
  spot({ slug: "uluwatu", name: "Uluwatu", country: "Indonesia", area: "Bali", timezone: "Asia/Makassar" }),
  spot({ slug: "arugam", name: "Arugam Bay", country: "Sri Lanka", area: "East Coast", timezone: "Asia/Colombo" }),
  spot({ slug: "cloud-9", name: "Cloud 9", country: "Philippines", area: "Siargao", timezone: "Asia/Manila" }),
  spot({ slug: "bali-hai", name: "Bali Hai", country: "Fiji", area: "Mamanuca", timezone: "Pacific/Fiji" }),
  spot({ slug: "nowhere", name: "Nowhere", country: "", area: "" }),
];

const regionZh: Record<Region, string> = { North: "北部", Northeast: "東北部", East: "東部", South: "南部", West: "西部" };
const slugs = (q: string) => searchSpots(SPOTS, q, (r) => regionZh[r]).map((s) => s.slug);

describe("fold / searchTokens", () => {
  it("ignores case, accents and apostrophes", () => {
    expect(fold("Wai’ao")).toBe("waiao");
    expect(fold("Élan")).toBe("elan");
    expect(searchTokens("  Cloud   9 ")).toEqual(["cloud", "9"]);
  });
});

describe("searchSpots", () => {
  it("matches English and Chinese names", () => {
    expect(slugs("waiao")).toEqual(["waiao"]);
    expect(slugs("外澳")).toEqual(["waiao"]);
  });

  it("matches area, country and the Taiwan aliases", () => {
    expect(slugs("indonesia")).toEqual(["uluwatu"]);
    expect(slugs("台灣")).toEqual(["jialeshui", "waiao"]);
    expect(slugs("taiwan")).toEqual(["jialeshui", "waiao"]);
    expect(slugs("東北部")).toEqual(["waiao"]);
  });

  it("finds a name typed without its space", () => {
    expect(slugs("cloud9")).toEqual(["cloud-9"]);
  });

  it("needs every token", () => {
    expect(slugs("bali uluwatu")).toEqual(["uluwatu"]);
    expect(slugs("bali waiao")).toEqual([]);
  });

  it("puts names starting with the query before area matches", () => {
    expect(slugs("bali")).toEqual(["bali-hai", "uluwatu"]);
  });
});

describe("nameMatches", () => {
  it("checks every token against a requested spot's name", () => {
    expect(nameMatches("Secret Left", searchTokens("left secret"))).toBe(true);
    expect(nameMatches("Secret Left", searchTokens("secret right"))).toBe(false);
  });
});

describe("browseGroups", () => {
  const groups = browseGroups(SPOTS, { regionTitle: (r) => `Taiwan · ${r}`, elsewhere: "Elsewhere" });

  it("lists the Taiwan regions first, in the fixed order, empty ones included", () => {
    expect(groups.slice(0, 5).map((g) => [g.key, g.list.length])).toEqual([
      ["tw-Northeast", 1],
      ["tw-North", 0],
      ["tw-East", 0],
      ["tw-South", 1],
      ["tw-West", 0],
    ]);
    expect(groups[0].title).toBe("Taiwan · Northeast");
  });

  it("then Siargao, Bali, and the rest alphabetically by country · area", () => {
    expect(groups.slice(5).map((g) => g.title)).toEqual([
      "Philippines · Siargao",
      "Indonesia · Bali",
      "Elsewhere",
      "Fiji · Mamanuca",
      "Sri Lanka · East Coast",
    ]);
  });

  it("keeps every spot exactly once", () => {
    expect(groups.flatMap((g) => g.list).length).toBe(SPOTS.length);
  });
});

describe("tideBandKey / facingPoints", () => {
  it("maps the known tide bands and leaves other text alone", () => {
    expect(tideBandKey("Mid to High")).toBe("spots.tide.midHigh");
    expect(tideBandKey(" all  tides ")).toBe("spots.tide.all");
    expect(tideBandKey("Mid")).toBe("spots.tide.mid");
    expect(tideBandKey("Dead low only")).toBeNull();
  });

  it("splits a two-point facing", () => {
    expect(facingPoints("E / SE")).toEqual(["E", "SE"]);
    expect(facingPoints("NW")).toEqual(["NW"]);
  });
});
