# Swelleye vs Open-Meteo

Generated 2026-09-25T06:40:01.069Z by `npm run compare` (scripts/compare-sources.ts, lib/source-compare.ts). Differences are Open-Meteo minus Swelleye.

## Browser readings: 1 day(s), 12 hour marks

Swelleye's table read in Chrome on request (data/swelleye-readings/). Open-Meteo is the app's own `getConditions()` for the same hours, snapshotted at first compare. **Gap score = mean abs diff ÷ that metric's "large" line** (0 = identical, 1.00 = at the line; see Thresholds). Wind strength label is in Beaufort band steps.

| Metric | Gap score | Mean diff (OM-SW) | Mean abs diff | Max abs diff | Within close | n |
|---|---|---|---|---|---|---|
| Swell period | 0.80 | -0.72 s | 1.2 s | 2.15 s | 1/12 (8%) | 12 |
| Wind gust | 0.48 | +1.52 m/s | 1.93 m/s | 5.3 m/s | 8/12 (67%) | 12 |
| Air temp | 0.46 | -0.11 °C | 1.38 °C | 2.9 °C | 5/12 (42%) | 12 |
| Wind speed | 0.42 | -0.62 m/s | 1.06 m/s | 3.02 m/s | 7/12 (58%) | 12 |
| Wind direction | 0.38 | +13.83 deg | 17.08 deg | 54.5 deg | 9/12 (75%) | 12 |
| Tide turn timing | 0.37 | -33.25 min | 33.25 min | 51 min | 2/4 (50%) | 4 |
| Wind strength label | 0.33 | +0.17 bands | 0.33 bands | 1 bands | 8/12 (67%) | 12 |
| Swell height | 0.13 | -0.02 m | 0.05 m | 0.14 m | 12/12 (100%) | 12 |
| Sea temp | 0.11 | +0.15 °C | 0.32 °C | 0.5 °C | 12/12 (100%) | 12 |
| Swell direction | 0.00 | 0 deg | 0 deg | 0 deg | 12/12 (100%) | 12 |
| Tide trend | - | - | - | - | 12/12 (100%) | 12 |

### jialeshui 2026-09-25

Read 2026-09-25 by Claude, by eye from the Swelleye PRO table in Chrome (swell direction only readable as a band). Open-Meteo grid node 21.958336, 120.875015, fetched 2026-09-25T06:39:41.387Z. Cells: Swelleye / Open-Meteo (Open-Meteo minus Swelleye).

| Hour | Swell height | Swell period | Swell direction | Wind speed | Wind gust | Wind direction | Wind strength label | Tide trend |
|---|---|---|---|---|---|---|---|---|
| 00:00 | 0.6 / 0.62 (+0.02) | 6.4 / 7.6 (+1.2) | ENE-E (67.5°–90°) / ENE (77°) (0) | 7 / 5.4 (-1.6) | 10 / 11.1 (+1.1) | NE (45°) / ENE (57°) (+12) | fresh / fresh (0) | rising / rising (same) |
| 02:00 | 0.6 / 0.62 (+0.02) | 6.4 / 5.45 (-0.95) | ENE-E (67.5°–90°) / ENE (73°) (0) | 6 / 4.6 (-1.4) | 9 / 9.8 (+0.8) | NNE (22.5°) / NE (49°) (+26.5) | moderate / moderate (0) | rising / rising (same) |
| 04:00 | 0.6 / 0.62 (+0.02) | 6.6 / 4.45 (-2.15) | ENE-E (67.5°–90°) / ENE (72°) (0) | 6 / 3.8 (-2.2) | 8 / 7.7 (-0.3) | NNE (22.5°) / NE (35°) (+12.5) | moderate / moderate (0) | rising / rising (same) |
| 06:00 | 0.6 / 0.58 (-0.02) | 6.8 / 5.55 (-1.25) | ENE-E (67.5°–90°) / ENE (76°) (0) | 6 / 2.98 (-3.02) | 8 / 5.8 (-2.2) | NNE (22.5°) / NNE (25°) (+2.5) | moderate / gentle (-1) | falling / falling (same) |
| 08:00 | 0.6 / 0.52 (-0.08) | 7.1 / 8.15 (+1.05) | ENE-E (67.5°–90°) / E (84°) (0) | 4 / 3.22 (-0.78) | 7 / 8 (+1) | NE (45°) / NE (46°) (+1) | moderate / moderate (0) | falling / falling (same) |
| 10:00 | 0.6 / 0.52 (-0.08) | 7.4 / 8.05 (+0.65) | ENE-E (67.5°–90°) / E (83°) (0) | 4 / 4.04 (+0.04) | 7 / 9.7 (+2.7) | NNE (22.5°) / NE (54°) (+31.5) | moderate / moderate (0) | falling / falling (same) |
| 12:00 | 0.6 / 0.54 (-0.06) | 7.6 / 7.55 (-0.05) | ENE-E (67.5°–90°) / E (83°) (0) | 4 / 5.36 (+1.36) | 7 / 12.3 (+5.3) | NE (45°) / ENE (59°) (+14) | moderate / fresh (+1) | rising / rising (same) |
| 14:00 | 0.7 / 0.56 (-0.14) | 7.7 / 7.1 (-0.6) | ENE-E (67.5°–90°) / E (84°) (0) | 3 / 3.89 (+0.89) | 6 / 11.2 (+5.2) | NE (45°) / NE (45°) (0) | gentle / moderate (+1) | rising / rising (same) |
| 16:00 | 0.6 / 0.62 (+0.02) | 7.9 / 6.55 (-1.35) | ENE-E (67.5°–90°) / E (83°) (0) | 2 / 1.8 (-0.2) | 5 / 6.6 (+1.6) | NNE (22.5°) / N (3°) (-19.5) | gentle / gentle (0) | rising / rising (same) |
| 18:00 | 0.6 / 0.64 (+0.04) | 8 / 6.35 (-1.65) | ENE-E (67.5°–90°) / E (84°) (0) | 2 / 2.36 (+0.36) | 4 / 4.4 (+0.4) | NNE (22.5°) / ENE (77°) (+54.5) | light / light (0) | falling / falling (same) |
| 20:00 | 0.6 / 0.62 (+0.02) | 8.1 / 6.55 (-1.55) | ENE-E (67.5°–90°) / E (86°) (0) | 4 / 3.77 (-0.23) | 6 / 7.5 (+1.5) | NNE (22.5°) / NE (39°) (+16.5) | gentle / moderate (+1) | falling / falling (same) |
| 22:00 | 0.6 / 0.56 (-0.04) | 8.2 / 6.2 (-2) | ENE-E (67.5°–90°) / E (85°) (0) | 4 / 3.36 (-0.64) | 6 / 7.1 (+1.1) | NNE (22.5°) / NE (37°) (+14.5) | gentle / gentle (0) | falling / falling (same) |

| Tide turn | Swelleye | Open-Meteo | Diff (min) |
|---|---|---|---|
| high | 04:50 | 04:34 | -16 |
| low | 11:51 | 11:00 | -51 |
| high | 17:31 | 17:13 | -18 |
| low | 23:41 | 22:53 | -48 |

## Typed session readings

> **Small sample: 2 session(s) have both a typed Swelleye reading and an Open-Meteo reading (of 7 total). Treat every verdict as anecdotal.**

| Metric | Gap score | Mean diff (OM-SW) | Mean abs diff | Max abs diff | Within close | n |
|---|---|---|---|---|---|---|
| Wind speed | 0.96 | -2.39 m/s | 2.4 m/s | 2.55 m/s | 0/2 (0%) | 2 |
| Wind gust | 0.64 | +2.55 m/s | 2.55 m/s | 3.5 m/s | 1/2 (50%) | 2 |
| Wind strength label | 0.50 | +0.5 bands | 0.5 bands | 1 bands | 1/2 (50%) | 2 |
| Swell period | 0.45 | -0.67 s | 0.68 s | 1.35 s | 1/2 (50%) | 2 |
| Wind direction | 0.31 | +14 deg | 14 deg | 18.5 deg | 2/2 (100%) | 2 |
| Swell height | 0.29 | -0.1 m | 0.1 m | 0.12 m | 2/2 (100%) | 2 |
| Tide turn timing | 0.28 | -25 min | 25 min | 57 min | 3/4 (75%) | 4 |
| Air temp | 0.27 | -0.8 °C | 0.8 °C | 1.5 °C | 1/2 (50%) | 2 |
| Swell direction | 0.08 | +0.5 deg | 3.5 deg | 4 deg | 2/2 (100%) | 2 |
| Sea temp | 0.02 | +0.05 °C | 0.05 °C | 0.1 °C | 2/2 (100%) | 2 |
| Tide trend | - | - | - | - | 2/2 (100%) | 2 |

### Verdicts

| Metric | n | Differs a lot? | close/noticeable/large | Mean diff (OM-SW) | Mean abs diff | Max abs diff | Mean OM/SW ratio |
|---|---|---|---|---|---|---|---|
| Swell height | 2 | NO | 2/0/0 | -0.1 m | 0.1 m | 0.12 m | 0.90 |
| Swell period | 2 | MIXED | 1/1/0 | -0.67 s | 0.68 s | 1.35 s | 0.90 |
| Swell direction | 2 | NO | 2/0/0 | +0.5 deg | 3.5 deg | 4 deg | - |
| Wind speed | 2 | MIXED | 0/2/0 | -2.39 m/s | 2.4 m/s | 2.55 m/s | 0.75 |
| Wind gust | 2 | MIXED | 1/1/0 | +2.55 m/s | 2.55 m/s | 3.5 m/s | 1.21 |
| Wind direction | 2 | NO | 2/0/0 | +14 deg | 14 deg | 18.5 deg | - |
| Wind strength label | 2 | MIXED | 1/1/0 | +0.5 bands | 0.5 bands | 1 bands | - |
| Tide turn timing | 4 | MIXED | 3/1/0 | -25 min | 25 min | 57 min | - |
| Tide trend | 2 | NO | 2/0/0 | - | - | - | - |
| Sea temp | 2 | NO | 2/0/0 | +0.05 °C | 0.05 °C | 0.1 °C | 1.00 |
| Air temp | 2 | MIXED | 1/1/0 | -0.8 °C | 0.8 °C | 1.5 °C | 0.97 |

("Differs a lot?" = NO if every sample is close, YES if more than 50% of samples are large, otherwise MIXED. Ratio = Open-Meteo / Swelleye.)

## Per-session, per-metric

| Session | Metric | Swelleye | Open-Meteo | Diff | Diff % | Verdict |
|---|---|---|---|---|---|---|
| jialeshui 2026-09-16 16:00 | Swell height | 1.1 | 1.02 | -0.08 m | -7.3% | close |
| jialeshui 2026-09-16 16:00 | Swell period | 6.9 | 6.9 | 0 s | 0% | close |
| jialeshui 2026-09-16 16:00 | Swell direction | E (90°) | E (94°) | +4 deg | - | close |
| jialeshui 2026-09-16 16:00 | Wind speed | 9 | 6.76 | -2.24 m/s | -24.9% | noticeable |
| jialeshui 2026-09-16 16:00 | Wind gust | 12 | 15.5 | +3.5 m/s | +29.2% | noticeable |
| jialeshui 2026-09-16 16:00 | Wind direction | NNE (22.5°) | NNE (32°) | +9.5 deg | - | close |
| jialeshui 2026-09-16 16:00 | Wind strength label | fresh | strong | +1 bands | - | noticeable |
| jialeshui 2026-09-16 16:00 | Sea temp | 29 | 29.1 | +0.1 °C | +0.3% | close |
| jialeshui 2026-09-16 16:00 | Air temp | 28 | 27.9 | -0.1 °C | -0.4% | close |
| jialeshui 2026-09-16 16:00 | Tide turn timing | low 14:44 | low 13:47 | -57 min | - | noticeable |
| jialeshui 2026-09-16 16:00 | Tide turn timing | high 20:26 | high 20:23 | -3 min | - | close |
| jialeshui 2026-09-16 16:00 | Tide trend | rising | rising | - | - | close |
| jialeshui 2026-09-17 06:00 | Swell height | 1 | 0.88 | -0.12 m | -12% | close |
| jialeshui 2026-09-17 06:00 | Swell period | 7 | 5.65 | -1.35 s | -19.3% | noticeable |
| jialeshui 2026-09-17 06:00 | Swell direction | E (90°) | E (87°) | -3 deg | - | close |
| jialeshui 2026-09-17 06:00 | Wind speed | 10 | 7.45 | -2.55 m/s | -25.5% | noticeable |
| jialeshui 2026-09-17 06:00 | Wind gust | 13 | 14.6 | +1.6 m/s | +12.3% | close |
| jialeshui 2026-09-17 06:00 | Wind direction | NNE (22.5°) | NE (41°) | +18.5 deg | - | close |
| jialeshui 2026-09-17 06:00 | Wind strength label | strong | strong | 0 bands | - | close |
| jialeshui 2026-09-17 06:00 | Sea temp | 29 | 29 | 0 °C | 0% | close |
| jialeshui 2026-09-17 06:00 | Air temp | 27 | 25.5 | -1.5 °C | -5.6% | noticeable |
| jialeshui 2026-09-17 06:00 | Tide turn timing | low 03:52 | low 03:30 | -22 min | - | close |
| jialeshui 2026-09-17 06:00 | Tide turn timing | high 09:33 | high 09:15 | -18 min | - | close |
| jialeshui 2026-09-17 06:00 | Tide trend | rising | rising | - | - | close |


## Thresholds used

Defined in `THRESHOLDS` in lib/source-compare.ts. Judgement calls, not fitted to data.

| Metric | Close | Large |
|---|---|---|
| Swell height | close: <=0.15 m or <=15% | large: >0.35 m and >30% |
| Swell period | close: <=0.5 s | large: >1.5 s |
| Wind speed | close: <=1 m/s or <=15% | large: >2.5 m/s and >30% |
| Wind gust | close: <=2 m/s or <=15% | large: >4 m/s and >30% |
| Swell / wind direction | close: <=22.5 deg (one compass step) | large: >45 deg |
| Tide turn timing | close: <=30 min | large: >90 min |
| Temperature | close: <=1 C | large: >3 C |
| Wind strength label | close: same band | large: >1 band apart |

Everything between close and large is "noticeable". Swelleye directions are quantised to a 16-point compass (+-11.25 deg), heights to 1 decimal.

## Analysis

**Sample size warning: n = 2 session(s), all from the same spot and week.** Every statement below describes these sessions only. Two points cannot separate a systematic bias from noise, so nothing here is a conclusion about the two sources in general. It scales as more Swelleye readings are typed into sessions; re-run then.

### What was measured

- **Swell height** (NO, n=2): mean diff -0.1 m, mean abs 0.1, max abs 0.12. Swelleye's own page says its number is the regional offshore swell, the same quantity Open-Meteo reports (CLAUDE.md, Nanwan vs Jialeshui test), so agreement is the expectation.
- **Swell period** (MIXED, n=2): mean diff -0.67 s, mean abs 0.68, max abs 1.35. Same quantity again; Swelleye gives one swell train, Open-Meteo's primary train is the comparable one (secondary swell and wind waves are separate fields and are not compared).
- **Swell direction** (NO, n=2): mean diff +0.5 deg, mean abs 3.5, max abs 4. Swelleye directions are arrows read to a 16-point compass, so this side is quantised to 22.5 degree steps. Differences under one step cannot be told apart from rounding.
- **Wind speed** (MIXED, n=2): mean diff -2.39 m/s, mean abs 2.4, max abs 2.55. See the open question in CLAUDE.md. Stored Open-Meteo wind values were checked: they look like the corrected m/s ones (17 Sep 06:00 reads 7.45 m/s, the corrected figure CLAUDE.md records for the same hour; the old km/h value was 26.8). Note the rows' fetchedAt still says 2026-09-21, i.e. before the 2026-09-22 fix, so they were corrected in place rather than re-stamped.
- **Wind gust** (MIXED, n=2): mean diff +2.55 m/s, mean abs 2.55, max abs 3.5. CLAUDE.md noted gusts agreeing earlier while mean wind did not; compare with the wind speed row.
- **Wind direction** (NO, n=2): mean diff +14 deg, mean abs 14, max abs 18.5. Same compass quantisation as swell direction.
- **Tide turn timing** (MIXED, n=4): mean diff -25 min, mean abs 25, max abs 57. Swelleye's tide note turning times vs Open-Meteo's turning points from hourly sea-level data (refined to sub-hour). Heights are not compared: different datums.
- **Tide trend** (NO, n=2): mean diff - , mean abs null, max abs null. Rising/falling agreement (categorical).
- **Sea temp** (NO, n=2): mean diff +0.05 °C, mean abs 0.05, max abs 0.1. 
- **Air temp** (MIXED, n=2): mean diff -0.8 °C, mean abs 0.8, max abs 1.5. Open-Meteo is a grid-cell value; Swelleye's air temp may be a station or model value; unknown.

### Plausible reasons for differences (hypotheses, not tested)

- **Different time base.** Swelleye is 2-hourly, Open-Meteo hourly; if the session time falls between Swelleye slots the typed value may be the neighbouring slot.
- **Quantisation.** Swelleye heights are typed to 1 decimal and directions to 16 points, so small direction and height gaps are partly rounding.
- **Wind: reference height / averaging window.** The open question in CLAUDE.md. Open-Meteo reports 10 m wind; Swelleye does not say what height or averaging it uses. If Open-Meteo is consistently lower than Swelleye by a stable ratio (see the OM/SW ratio column), that would fit a systematic definition difference rather than noise, but two points cannot establish a stable ratio, so the open question stays open.
- **Different models.** Both are regional/global model output, not observations; they will not match exactly even for the same underlying quantity.
- **Tide timing.** Open-Meteo's turning points are derived from hourly sea level, which limits precision to roughly 30 minutes (see lib/openmeteo.ts findTideEvents); Swelleye's times come from its own tide model.

### What cannot be concluded

- Whether either source is more accurate: neither is compared against observations. This only measures how far apart they are.
- Whether the differences are systematic. Need many more sessions across different conditions and spots.
- Anything about other spots or seasons.
