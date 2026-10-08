# Jialeshui, 2026-09-25 — Open-Meteo vs Swelleye

Jialeshui (lat 21.987722, lng 120.845982). Open-Meteo fetched live 2026-09-25
the way `lib/openmeteo.ts` does it (marine + weather endpoints,
`wind_speed_unit=ms`, `timezone=Asia%2FTaipei`); grid node used
21.958336, 120.875015 (~4.4 km off). Swelleye read by eye off the PRO
forecast table in Avery's logged-in Chrome — no scraping, no
`api.swelleye.com`, no cookie. Arrows only, so Swelleye directions are
±11.25° at best; swell direction could only be read as a band, ENE–E
(56.25°–101.25°), not per-hour.

**Gap score = MAE ÷ that metric's `absLarge` in `lib/source-compare.ts`'s
THRESHOLDS.** 0 = identical, 1.0 = at the "large" line. n=1 day, 12
two-hourly points (4 for tide).

## Gap scores, biggest first

| Field | Gap score | Mean diff (OM−SW) | MAE | Max abs diff (hour) | Mean abs % diff | Within absClose |
|---|---|---|---|---|---|---|
| Swell period | **0.80** (absLarge 1.5s) | −0.72 s | 1.20 s | 2.15 s (04:00) | 16.5% | 1/12 (8%) |
| Wind gust | **0.48** (absLarge 4 m/s) | +1.52 m/s | 1.93 m/s | 5.30 m/s (12:00) | 29.3% | 8/12 (67%) |
| Wind speed | **0.42** (absLarge 2.5 m/s) | −0.62 m/s | 1.06 m/s | 3.02 m/s (06:00) | 22.3% | 7/12 (58%) |
| Wind direction | **0.38** (absLarge 45°) | +13.8° | 17.1° | 54.5° (18:00) | — | 9/12 (75%) |
| Tide turn timing | **0.37** (absLarge 90min) | −33 min | 33 min | 51 min (11:00 low) | — | 2/4 (50%) |
| Swell height | **0.13** (absLarge 0.35m) | −0.02 m | 0.05 m | 0.14 m (14:00) | 7.5% | 12/12 (100%) |
| Swell direction | **0.00** (dist. from SW's band) | 0° (always inside band) | 0° | 0° | — | 12/12 (100%) |

Wind strength label (`components/wind-strength.tsx`, categorical, no
`THRESHOLDS` entry): matches **8/12 (67%)**; mean step diff (Calm=0…Gale=7,
OM−SW) **+0.17**, mean abs step diff 0.33.

## Per-hour

Swell dir "dist" = 0 whenever Open-Meteo's degree falls inside Swelleye's
ENE–E band (all 12 hours here).

| Time | Swell H OM/SW (diff) | Swell P OM/SW (diff) | Swell dir OM° (dist) | Wind spd OM/SW (diff) | Wind gust OM/SW (diff) | Wind dir OM°/SW° (diff) | Strength OM/SW |
|---|---|---|---|---|---|---|---|
| 00:00 | 0.62/0.6 (+0.02) | 7.60/6.4 (+1.20) | 77 (0) | 5.40/7 (−1.60) | 11.10/10 (+1.10) | 57/45 (+12.0) | fresh/fresh |
| 02:00 | 0.62/0.6 (+0.02) | 5.45/6.4 (−0.95) | 73 (0) | 4.60/6 (−1.40) | 9.80/9 (+0.80) | 49/22.5 (+26.5) | moderate/moderate |
| 04:00 | 0.62/0.6 (+0.02) | 4.45/6.6 (−2.15) | 72 (0) | 3.80/6 (−2.20) | 7.70/8 (−0.30) | 35/22.5 (+12.5) | moderate/moderate |
| 06:00 | 0.58/0.6 (−0.02) | 5.55/6.8 (−1.25) | 76 (0) | 2.98/6 (−3.02) | 5.80/8 (−2.20) | 25/22.5 (+2.5) | gentle/moderate |
| 08:00 | 0.52/0.6 (−0.08) | 8.15/7.1 (+1.05) | 84 (0) | 3.22/4 (−0.78) | 8.00/7 (+1.00) | 46/45 (+1.0) | moderate/moderate |
| 10:00 | 0.52/0.6 (−0.08) | 8.05/7.4 (+0.65) | 83 (0) | 4.04/4 (+0.04) | 9.70/7 (+2.70) | 54/22.5 (+31.5) | moderate/moderate |
| 12:00 | 0.54/0.6 (−0.06) | 7.55/7.6 (−0.05) | 83 (0) | 5.36/4 (+1.36) | 12.30/7 (+5.30) | 59/45 (+14.0) | fresh/moderate |
| 14:00 | 0.56/0.7 (−0.14) | 7.10/7.7 (−0.60) | 84 (0) | 3.89/3 (+0.89) | 11.20/6 (+5.20) | 45/45 (0.0) | moderate/gentle |
| 16:00 | 0.62/0.6 (+0.02) | 6.55/7.9 (−1.35) | 83 (0) | 1.80/2 (−0.20) | 6.60/5 (+1.60) | 3/22.5 (−19.5) | gentle/gentle |
| 18:00 | 0.64/0.6 (+0.04) | 6.35/8.0 (−1.65) | 84 (0) | 2.36/2 (+0.36) | 4.40/4 (+0.40) | 77/22.5 (+54.5) | light/light |
| 20:00 | 0.62/0.6 (+0.02) | 6.55/8.1 (−1.55) | 86 (0) | 3.77/4 (−0.23) | 7.50/6 (+1.50) | 39/22.5 (+16.5) | moderate/gentle |
| 22:00 | 0.56/0.6 (−0.04) | 6.20/8.2 (−2.00) | 85 (0) | 3.36/4 (−0.64) | 7.10/6 (+1.10) | 37/22.5 (+14.5) | gentle/gentle |

Tide trend (rising/falling) agrees at all 12 marks.

## Tide

Swelleye: high 04:50, low 11:51, high 17:31, low 23:41 (heights unknown
datum, not compared). Open-Meteo (`findTideEvents`/`refineExtrema`,
`sea_level_height_msl`):

| Type | OM | SW | Diff (OM−SW) |
|---|---|---|---|
| high | 04:34 | 04:50 | −16 min |
| low | 11:00 | 11:51 | −51 min |
| high | 17:13 | 17:31 | −18 min |
| low | 22:53 | 23:41 | −48 min |

CWA's own forecast for this session (11:47 low, 17:43 high) is within
4–12 min of Swelleye but 51/18 min from Open-Meteo — Swelleye's tide table
likely comes from CWA, unverified guess from one day's match.

## vs the 2-session running comparison (`reports/swelleye-vs-openmeteo.md`)

Today isn't a logged session (`cond` is still null on the DB row), so
`npm run compare` won't pick it up. Swell height stays the tightest match
across all three days (16th/17th/25th mean diffs −0.08/−0.12/−0.02 m). Wind
speed's ~25% low bias on 16th/17th (single points each) only holds
00:00–06:00 today — afternoon runs close-to-high — narrowing, not resolving,
CLAUDE.md's open wind question. Swell period is the new outlier: not
flagged on 16th/17th, largest gap of any metric today.

## Caveats

- Grid node ~4.4 km off Jialeshui's coordinate (open-ocean model, no
  refraction).
- Swelleye is read-by-eye, arrows only (±11.25°); swell direction could
  only be read as a band.
- Tide/sea-level datums differ (Open-Meteo MSL, CWA TWVD, Swelleye
  unknown) — only timing/direction compared, never height.
- Sea temp (29–30°C on Swelleye) skipped — not on the entry card.
- n=1 day. Don't over-read a single day's numbers.
