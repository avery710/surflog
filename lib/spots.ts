/**
 * Swelleye spot slugs — harvested from swelleye.com 2026-09-16.
 * Slugs are NOT derivable from names; this table is the source of truth.
 *
 * `lat`/`lng` are needed for Open-Meteo. Wai'ao and Jialeshui are confirmed
 * (taken from their spot pages, where coordinates are embedded in the page
 * URLs). Everything else is null — fill it by opening
 * swelleye.com/en/surf-spots/<slug>/. Never approximate a coordinate; the
 * grid node it picks changes (see CLAUDE.md "Spots").
 *
 * NOTE: neighbouring spots share one Open-Meteo grid node (see CLAUDE.md,
 * "Open-Meteo's real resolution limit"). Coordinates still matter for picking
 * the right node across regions, but do not expect per-break differences.
 */
export type Region = "North" | "Northeast" | "East" | "South" | "West";

export interface Spot {
  slug: string;
  name: string;
  region: Region;
  lat: number | null;
  lng: number | null;
  /** From Swelleye's "Spot Infographic" — fill these in, they carry the
   *  break-specific information Open-Meteo cannot provide. */
  facing?: string;
  bestSwellDir?: string[];
  bestWindDir?: string[];
  bestTide?: string;
}

export const SPOTS: Spot[] = [
  { slug: "shalun", name: "Shalun", region: "North", lat: null, lng: null },
  { slug: "baishawan", name: "Baishawan", region: "North", lat: null, lng: null },
  { slug: "restaurants", name: "Restaurants", region: "North", lat: null, lng: null },
  { slug: "jinshan", name: "Jinshan", region: "North", lat: null, lng: null },
  { slug: "greenbay", name: "Green Bay", region: "North", lat: null, lng: null },
  { slug: "wanli", name: "Wanli", region: "North", lat: null, lng: null },
  { slug: "fulong", name: "Fulong", region: "North", lat: null, lng: null },

  { slug: "daxi", name: "Daxi", region: "Northeast", lat: null, lng: null },
  { slug: "gengfang", name: "Gengfang", region: "Northeast", lat: null, lng: null },
  { slug: "double-lions", name: "Double Lions", region: "Northeast", lat: null, lng: null },
  {
    slug: "waiao",
    name: "Wai'ao",
    region: "Northeast",
    lat: 24.882278,
    lng: 121.846166,
    facing: "E",
    bestSwellDir: ["ENE", "E", "SE", "SSE"],
    bestWindDir: ["NW", "W"],
    bestTide: "Mid to High",
  },
  { slug: "wushi-north", name: "Wushi Harbor (North)", region: "Northeast", lat: null, lng: null },
  { slug: "wushi-south", name: "Wushi Harbor (South)", region: "Northeast", lat: null, lng: null },
  { slug: "choushui", name: "Chou Shui", region: "Northeast", lat: null, lng: null },
  { slug: "zhuan", name: "Zhu'an", region: "Northeast", lat: null, lng: null },
  { slug: "qingshui", name: "Qing Shui", region: "Northeast", lat: null, lng: null },
  { slug: "wuwei", name: "Su'ao - Wuwei Harbor", region: "Northeast", lat: null, lng: null },

  { slug: "environmental-park", name: "Environmental Park", region: "East", lat: null, lng: null },
  { slug: "beibin", name: "Hualien Beibin", region: "East", lat: null, lng: null },
  { slug: "double-bridge", name: "Double Bridge", region: "East", lat: null, lng: null },
  { slug: "gongs", name: "Gongs", region: "East", lat: null, lng: null },
  { slug: "jiqi", name: "Jiqi", region: "East", lat: null, lng: null },
  { slug: "eight-immortals-cave", name: "Baxian Dong", region: "East", lat: null, lng: null },
  { slug: "yiwan", name: "Yiwan", region: "East", lat: null, lng: null },
  { slug: "chenggong", name: "Chenggong", region: "East", lat: null, lng: null },
  { slug: "duli", name: "Duli", region: "East", lat: null, lng: null },
  { slug: "donghe", name: "Donghe", region: "East", lat: null, lng: null },
  { slug: "jinzun", name: "Jinzun", region: "East", lat: null, lng: null },
  { slug: "dulan", name: "Dulan", region: "East", lat: null, lng: null },
  { slug: "taitung", name: "Taitung", region: "East", lat: null, lng: null },

  { slug: "jiupeng", name: "Jiupeng", region: "South", lat: null, lng: null },
  {
    slug: "jialeshui",
    name: "Jialeshui",
    region: "South",
    // confirmed from the spot page — supersedes an earlier ~10km-off guess
    // of 22.05, 120.9 (see CLAUDE.md "Spots")
    lat: 21.987722,
    lng: 120.845982,
    facing: "SE",
    bestSwellDir: ["ENE", "E", "SE", "SSE"],
    bestWindDir: ["W"],
    bestTide: "Mid",
  },
  {
    slug: "nanwan",
    name: "Nanwan",
    region: "South",
    lat: null,
    lng: null,
    facing: "S",
    bestSwellDir: ["S", "SE", "SSW"],
    bestWindDir: ["N", "NE"],
    bestTide: "Low to Mid",
  },
  { slug: "sheliao", name: "Sheliao", region: "South", lat: null, lng: null },

  { slug: "qijin", name: "Qijin", region: "West", lat: null, lng: null },
  { slug: "yuguangdao", name: "Yuguangdao", region: "West", lat: null, lng: null },
  { slug: "sicao-bridge", name: "Sicao Bridge", region: "West", lat: null, lng: null },
  { slug: "shanshui", name: "Shanshui", region: "West", lat: null, lng: null },
  { slug: "songbai", name: "Songbai Harbor", region: "West", lat: null, lng: null },
  { slug: "waipu", name: "Waipu Fishing Harbor", region: "West", lat: null, lng: null },
  { slug: "zhunan", name: "Zhunan", region: "West", lat: null, lng: null },
];

export const spotBySlug = (slug: string) => SPOTS.find((s) => s.slug === slug);
