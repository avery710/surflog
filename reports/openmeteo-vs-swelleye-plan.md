# Plan: test and compare Open-Meteo with Swelleye

Written 2026-09-24. Plan only, nothing built, nothing written to the DB. Untracked on purpose (mentions the user's session details; repo is public).
Facts marked **(live)** were checked against public Open-Meteo and the user's CWA key today, read-only. Swelleye's private API and logins were not touched.

## 0. Headline finding that changes the plan

The earlier reports could only ask "how far apart are the two sources" (n=2). CWA has **real observations that can arbitrate**, and, unexpectedly, **30 days of backfill**:

| Dataset | Path | Window | What it gives |
|---|---|---|---|
| `O-B0075-001` | `datastore` | rolling 48 h, hourly | 84 buoy / tide-gauge stations |
| `O-B0075-002` | `datastore` (+ `&StationID=` filter) | rolling ~30 days (721 hourly stamps, 2026-08-24 to 09-23) | same fields, month of history |
| `O-B0076-001` | **`fileapi`**, not `datastore` (datastore path 404s; fileapi 302-redirects, use `curl -L`) | static | station names, lat/lng (buoy positions are NOT in the obs datasets) |

Fields per station-hour (live): `WaveHeight`, `WavePeriod`, `WaveDirection`, `SeaTemperature`, `Temperature`, `TideHeight`/`TideLevel`, and `PrimaryAnemometer.{WindSpeed, WindDirection, MaximumWindSpeed}`. Missing values are the string `"None"`. **The observation arrays are not in time order; sort by `DateTime`.** Different stations carry different field subsets (wave, wind, tide, SST are separate capabilities; count non-`"None"` per station).

### Nearest observations to the spots (live, haversine from `lib/spots.ts` coordinates)

| Spot | Wave + wind buoy | Distance | Tide gauge | Distance |
|---|---|---|---|---|
| Jialeshui | 46759A 鵝鑾鼻資料浮標 | 8.7 km | C4Q03 後壁湖 | 11.4 km |
| Nanwan | 46759A | 6.9 km | C4Q03 | 2.3 km |
| Wai'ao / Double Lions / Wushi N / Daxi | 46708A 龜山島資料浮標 | 9.0-10.4 km | C4U02 烏石 | 0.5-8.5 km |
| Green Bay | C6AH2 富貴角 (46694A 龍洞 at 25.8 km) | 20.3 km | C4B01 基隆 | 7.6 km |
| Taitung | WRA007 臺東資料浮標 | 1.8 km | 1586 富岡 | 7.6 km |

Buoys are offshore at 8-10 km, not at the break. They measure the open sea state and 10 m-ish wind, which is the same quantity the two forecasts claim to give. They cannot measure what happens at the beach.

### Preliminary numbers already obtained (live, treat as indicative)

**A. Swelleye's typed values match the buoy, Open-Meteo does not (wind).** Buoy 46759A at the two session hours:

| Session hour | Swelleye typed | Open-Meteo stored | Buoy 46759A |
|---|---|---|---|
| 2026-09-16 16:00 wind / gust / dir | 9 / 12 / NNE | 6.76 / 15.5 / 32 deg | 9.6 / 12.7 max / 43 deg |
| 2026-09-17 06:00 wind / gust / dir | 10 / 13 / NNE | 7.45 / 14.6 / 41 deg | 10.3 / 14.0 max / 37 deg |

**B. Over 30 days the OM wind deficit is systematic, not just those two sessions** (hourly, OM archive endpoint, `wind_speed_unit=ms`):

| Pair | n (hours) | Buoy mean wind | OM mean wind | Ratio OM/buoy | OLS slope | r | Buoy max-wind vs OM gust |
|---|---|---|---|---|---|---|---|
| 46759A vs Jialeshui | 553 | 6.92 | 5.33 | 0.77 | 0.56 | 0.76 | 9.88 vs 11.58 |
| 46708A vs Wai'ao | 567 | 4.60 | 2.20 | 0.48 | 0.37 | 0.63 | 6.29 vs 6.59 |

Same result from the forecast endpoint's `past_days=14` (0.75 and 0.44), so it is not an archive-vs-forecast artefact. Reading: OM wind is low by ~25% at Jialeshui and by more than half at Wai'ao (Wai'ao's wind grid node is (24.851, 121.805), a coastal/land cell, versus its marine node (24.875, 121.875); Jialeshui's wind node (21.968, 120.833) also differs from its marine node). Gust agrees or is slightly high. Caveats: buoy anemometer height and averaging are not published in these datasets (unknown); hours are autocorrelated (effective n is a few dozen days, not 550); the buoy is 9 km from the break.

**C. Waves are NOT comparable like-for-like, and that is itself informative.** OM total wave height vs buoy Hs over 30 days: 46759A ratio 1.50 (r 0.81), 46708A ratio 1.28 (r 0.66); OM period 7.7-7.8 s vs buoy 5.8-6.1 s. Probable causes: OM `wave_period` is a different definition (peak vs mean period) and the buoys sit in partly sheltered nearshore water (Eluanbi is in the lee of the Hengchun peninsula for some directions). Swelleye typed 1.1 m / 6.9 s at Jialeshui while the buoy read 0.4 m / 5.7 s the same hour. So the buoys cannot referee swell height until the definition difference is understood; do not use them to "correct" swell.

**D. Tide (live).** Houbihu gauge C4Q03 turning points (48 h, sorted; gauge has small noise wiggles) vs OM sea level at the Jialeshui node: OM turns at 09-23 03:00 H, 10:00 L, 16:00 H, 22:00 L and 09-24 04:00 H, 11:00 L; the gauge turns at 04:00 H, 12:00 L, 18:00 H, 23:00 L, 04:00 H, 12:00 L. OM is early by roughly 0-2 h vs the gauge, consistent in sign with the ~25 min "early" vs Swelleye. Different location (11 km) and hourly OM resolution limit this; needs the proper analysis below.

**E. SST:** OM is +0.4 to +0.6 C warm vs buoys. Small, plausibly a skin-vs-bulk or grid effect.

## 1. Questions, ranked

| # | Question | Answerable with existing constraints? | Needs |
|---|---|---|---|
| Q1 | Is Open-Meteo good enough to remain the automatic source? | Partly: only the decision "is a documented adjustment needed" | Q2-Q4 |
| Q2 | Where does it differ systematically from Swelleye (wind speed, gust, tide timing, period)? | Yes, needs more typed Swelleye rows (n=2 now) | Phase 1 collection |
| Q3 | Is each gap a stable bias (fixable) or noise? | Only with n >= ~20 typed pairs across regimes; for wind, the buoy 30-day series answers OM's side already | Buoy backfill + Q2 |
| Q4 | Which source is closer to reality? | Yes for **wind, gust, wind direction, SST, tide timing/trend** (buoy/gauge). Not for swell height/period/direction | CWA observations |
| Q5 | Does OM grid-node choice matter (marine vs wind node)? | Yes, no new data: query nearby points | Phase 0 |
| Q6 | Does Swelleye's *forecast* verify against the buoy? | Yes, if typed values are kept and compared with observations afterwards | Phase 1 |

What the constraints do NOT allow: judging swell height/period/direction accuracy at the break (no observation at the break; buoys are sheltered offshore and use different period definitions), or any conclusion about surf quality (no rating data; CLAUDE.md "unfalsifiability").

## 2. Constraints and what they imply

| Constraint | Implication for design |
|---|---|
| Swelleye has no API; scraping is ruled out | Every Swelleye number is typed by a human. Sample rate is human-limited; design for cheap entry, not automation |
| Forward forecast only, same-day logging | A reading is a *forecast for a slot*, typed at the session or on the day. Type the slot nearest to "now" (lead ~0) so it is a nowcast, and record which slot |
| 2-hourly slots vs hourly OM | Compare at the Swelleye slot hour (OM hour equal) as primary; also test interpolation between neighbouring hours and "OM at slot+/-1 h" (see section 5) |
| Directions are arrows, 16-point compass | Swelleye quantisation +/-11.25 deg; only compare direction with circular stats and judge in units of one step |
| One swell train only | Compare only against OM's primary swell; never sum trains |
| PRO login | The user reads the page; an agent cannot |
| Heights typed to 0.1 m, period 1 s | Rounding floor: +/-0.05 m, +/-0.5 s; do not read differences below that |
| No observation at the break | Buoys arbitrate offshore sea state and wind only |
| CWA obs are a rolling window (48 h / 30 d), no archive | Snapshot them, or history older than 30 days is lost forever |
| Blocks stay separate (`cond`, `condOpenMeteo`, `condCwaTide`) | If an observation block is added, it is a fourth block, never merged |

Automatable within the rules: everything on the OM and CWA side (fetch, store, align, statistics). Not automatable: Swelleye readings.

## 3. Data collection protocol (the user)

### Per typed reading

Open the spot page (or the forecast table), find the row for the **2-hour slot containing the session time (or, for a non-surf reading, the slot containing "now")**, and type into `cond`:

| Field | Note |
|---|---|
| swell height (m), period (s), direction (compass point) | primary train only |
| wind speed and gust (m/s), wind direction (compass point) | convert if the page shows km/h or knots; write down the unit shown |
| tide note in the existing format, e.g. `rising - low 14:44, high 20:26` | the parser (`parseTideNote`) needs the `low`/`high` HH:mm |
| air and sea temp | cheap |
| the slot time and the time of typing | not in `cond` today; put `slot 16:00, typed 15:40` in the tideNote or notes until a field exists |

Also once, per spot-visit: whether the reading is the current slot or a later slot.

### How many, and where

Spread matters more than count. Target grid, roughly:

| Dimension | Target |
|---|---|
| Spots | at least 2 regions: Yilan (one shared cell) and Jialeshui/Nanwan (south); ideally add one north-coast |
| Wind regimes | NE monsoon-type, light/variable, at least one strong (>8 m/s) day, at least one southwesterly or offshore day |
| Swell directions | E, plus at least one NE and one S/SW event |
| Wind speed range | calm (<3), moderate (4-8), strong (>8): the ratio may not be constant across it |
| Seasons | Sep now; add a winter (NE monsoon, Nov-Feb) block, since bias may be regime-dependent. Say so in any conclusion |

### Sample-size ladder

| Typed pairs (independent days) | What becomes possible |
|---|---|
| ~5 (soon) | Sanity: sign and rough size of wind/gust/tide-timing gaps; nothing beyond "consistent with the buoy story" |
| ~10 | Mean ratio for wind speed with a usable interval (if scatter is ~15%, +/-10%); flag whether gust gap is a real sign; tide-timing sign |
| ~20-30 | Regression (slope + intercept), not just a ratio; split by wind regime or by region; bias vs noise decision for wind; period bias; first Swelleye-forecast-vs-buoy check |
| ~50+ / two seasons | Per-spot corrections, winter vs summer stability, anything you would hard-code |

Rows on the same day/session block are correlated (one weather system): count independent **days**, not slots.

### Low-effort extra samples: "compare-only" readings on non-surf days

Realistic, with limits. Swelleye is same-day-only, but it shows the whole current day and the next 8, and that is enough:

- One visit per day: type **today's current slot** for 1-2 spots: about 3 minutes per reading. 3 weeks x 1 spot x 1 slot is ~20 readings for about 1 hour total.
- Better: in the same visit, type the **next day's 12 slots** for one spot (a screenshot the user pastes to an agent for transcription, or the user types). Later, the buoy backfill (30 days, hourly) lets us score Swelleye's *forecast* against observations at each of those hours. The forecast lead is a known confound; record it.
- This needs a place to store readings without a surf session. Today `cond` lives only on a session. Options: (a) log a "compare-only" session (unclean: pollutes the journal and patterns table; not recommended) or (b) a new small table for readings. Option (b) is a tooling change, section 7.
- Not practical: any daily automated reading (nothing scrapes Swelleye), and backfilling past dates (Swelleye has no archive).

## 4. Ground truth

| Metric | Can observations arbitrate? | Reference | Caveat |
|---|---|---|---|
| Wind speed / gust / direction | Yes, best case | buoy `PrimaryAnemometer` (46759A, 46708A) | anemometer height and averaging unknown; 9 km offshore; "max wind" is a gust proxy but its window is unspecified |
| Tide timing / trend | Yes | tide gauge (C4Q03 Houbihu, C4U02 Wushi) | gauge includes surge and noise; datum differs (compare timing/trend, not heights) |
| Sea temp | Yes | buoy `SeaTemperature` | trivial stake |
| Air temp | Roughly | buoy `Temperature`, or `O-A0001-001` land stations | land vs sea |
| Swell height | Not cleanly | buoy `WaveHeight` is Hs of total sea at a sheltered offshore point | measured ratio to OM 1.3-1.5; disagrees with Swelleye's own value too (Swelleye 1.1 m vs buoy 0.4 m at Jialeshui); needs the definition question answered first |
| Swell period | Not cleanly | buoy `WavePeriod` | 5.7 s buoy vs 6.9 s (both sources); mean-vs-peak period suspected, unconfirmed |
| Swell direction | Weakly | buoy `WaveDirection` | same sheltering issue, 146 deg (SE) vs sources' 90 deg (E) at Jialeshui |

Other reachable data (live): `O-A0001-001` (876 automatic land stations with lat/lng and hourly wind) and `O-A0003-001`; useful for coastal wind, but land stations underestimate over-water wind and will not settle the offshore wind question. `F-D0047-*` township forecasts are a possible third *forecast* source, not ground truth.

Not reachable: a buoy at the break; wave observations for Wai'ao itself; anything before the 30-day window (except sessions logged within it).

## 5. Test design and metrics

### Per metric

| Metric | Statistics | Threshold notes |
|---|---|---|
| Swell height | mean diff, MAE, ratio (mean of OM/SW and ratio of means), Bland-Altman (diff vs mean) | current close 0.15 m / 15%: fine, but rounding floor is 0.05 m. Report vs period, since ratio may depend on period |
| Swell period | mean diff, MAE | current close 0.5 s equals the rounding floor of a 1 s-quantised Swelleye value; treat < 1 s as indistinguishable, and confirm whether Swelleye period is peak or mean |
| Swell direction | circular mean difference, circular MAE; count of same-compass-point | judge in compass steps: 1 step (22.5 deg) is quantisation; keep |
| Wind speed | ratio of means, OLS slope and intercept (Swelleye on OM, and buoy on OM), MAE, then r once n >= ~20 | current 15% close / 30% large: the observed gap (25-50% low) sits in the "noticeable/large" band; keep thresholds, add a **bias** verdict ("stable ratio within +/-10%") separate from a **noise** one (residual SD) |
| Wind gust | same; compare gust to Swelleye gust and to buoy `MaximumWindSpeed` | gust definitions differ (OM gust = 10 m max over the preceding hour; buoy window unspecified): expect offset, check sign stability only |
| Wind direction | circular stats | wind direction is meaningless below ~2 m/s; exclude those |
| Tide timing | mean and SD of signed offset in minutes, for lows and highs separately | current close 30 min is at OM's hourly-derived floor; improve OM turning points by parabolic fit on 3 points (already sub-hour) and report interval |
| Tide trend | agreement % | keep |
| Temps | mean diff | keep |

Sequence: bias and MAE first (n >= 5); ratio and interval at n >= 10; regression and correlation at n >= 20; never correlate at n < 10.

### Alignment (2-hourly vs hourly)

Test all three, report the one with the lowest MAE, and expect them to agree within noise for smooth quantities: (1) OM at the Swelleye slot hour (primary); (2) OM linearly interpolated to the session minute vs Swelleye slot value; (3) best of OM slot-1h, slot, slot+1h (an upper bound on what timing alone can explain). For wind gust, use the max of the two hours around the slot for OM. If (3) is much better than (1) the "different time base" hypothesis in the current report is real.

### Separating disagreement from model revision

Three sources of drift, each measured separately:

1. Stored vs fresh fetch for the same hour (the last run found only tide events drift); rerun for every row each analysis, and record the max and mean drift.
2. Forecast endpoint vs archive endpoint for the same hour (live: they agree on wind within ~3% ratio at both spots).
3. Marine grid node vs wind grid node (see experiment E4).
Only after those are small does a Swelleye-OM gap count as source disagreement.

### Stats hygiene

Unit of analysis = the day/session (not slot, not hour). Report n, mean, SD, and a bootstrap or t interval with the number of independent days. Do not fit anything to n < 20. Keep the buoy series as the primary "is OM biased on wind" evidence (n is big enough for the 30-day, multi-regime picture), and Swelleye pairs as the evidence for "which number does Swelleye display".

## 6. Experiments to run now (no new Swelleye data)

| ID | Hypothesis | Method | Success / failure criterion |
|---|---|---|---|
| E1 | Swelleye wind is close to the buoy, not to OM | For the two typed sessions, pull buoy hour +/-1 from `O-B0075-002` (done for the exact hour, see 0-A) and add a per-slot table | Confirmed if |Swelleye - buoy| < 1 m/s at both (it is: -0.6 / -0.3) and |OM - buoy| > 2 m/s (it is: -2.8 / -2.9). Fails if a third session flips |
| E2 | OM low wind is a bias with stable ratio | 30-day hourly OM (archive) vs buoy for 46759A and 46708A; ratio, slope, intercept, by wind band | Stable if ratio varies < ~0.1 across bands and residual SD is small. Preliminary: ratio 0.77 vs 0.48 (differs by site), so a *single* global factor already fails; site-dependent at best |
| E3 | Reference-height/averaging explains it: OM gust or a neighbouring hour matches Swelleye's "wind" | Compare Swelleye wind to OM wind at h-1, h, h+1, to OM 80 m wind (`wind_speed_80m`, 1-line variable), and to OM gust x factor | If OM wind_speed_80m or a power-law scaling (10 m to Swelleye's assumed height) matches Swelleye/buoy within 1 m/s and stably, adopt as the documented explanation. Fail: none does |
| E4 | The wind-grid node (not the marine node) is the problem at Wai'ao | Query OM wind at 4-6 points around each spot (offshore and coastal, +/-0.1 deg), compare each with the buoy | If an offshore node fits the buoy within ~10%, the fix is choosing the coordinate for wind, not scaling. Otherwise OM is coarse there |
| E5 | OM tide runs early | For 30 days: OM turning points vs Houbihu (C4Q03) and Wushi (C4U02) gauge turning points; separate lows/highs; also CWA `F-A0021-001` forecast vs gauge where dates overlap (forecast covers today onward only, so start snapshotting now) | Offset SD < 30 min and mean stable -> a documented "OM is ~X min early" note; CWA forecast expected to be the better tide reference |
| E6 | The swell-height gap depends on period | Scatter OM/SW height ratio vs period at every typed pair; and OM vs buoy Hs by direction sector | Only n >= 10 can support this; today: two pairs, both about 0.9 |
| E7 | Buoy vs OM wave definitions | Check OM `wave_period`, `swell_wave_period`, `wave_peak_period` variants against buoy `WavePeriod` for 30 days | If `swell_wave_peak_period` matches, the period gap is definitional |
| E8 | OM grid-node position for waves | Query 3-4 nearby marine points around Jialeshui and Nanwan; compare | Expect identical (coarse grid, per CLAUDE.md); confirms nothing to gain |

E1-E5 and E7-E8 need no typing. E6 waits for data.

## 7. Tooling changes proposed (not built)

Extensions to `npm run compare` / `lib/source-compare.ts`:

1. Across-session statistics: signed bias, SD, ratio of means, bootstrap interval, and circular mean for directions (the summary currently reports mean diff and mean OM/SW ratio only).
2. Per-spot and per-wind-regime breakdown.
3. A **readiness line** per metric: e.g. "Wind speed: n=2 (need 10 for a ratio, 20-30 for a regression)"; use the ladder in section 3.
4. CSV export of pairs (for spreadsheets).
5. Threshold config overrides (still defaults in `THRESHOLDS`).
6. Alignment modes (slot, interpolated, best-of-neighbours) and a stored-vs-fresh drift column.
7. A separate script `scripts/compare-observations.ts` (read-only): pulls `O-B0075-002`, picks the nearest buoy/gauge per spot from a static station table, and prints OM-vs-observation and Swelleye-vs-observation tables. Handles: sort by `DateTime`, `"None"`, `fileapi` station list for coordinates, nearest-station table stored with the coordinate source.
8. **Observation snapshotting**: since CWA keeps only 30 days, a monthly (or weekly) saved pull of the 3-5 relevant stations to a file or a new table, so the wind/tide history survives. This is the only piece that is truly time-sensitive: data older than 30 days is unrecoverable.

Would a UI helper raise the sample rate? Yes, most of the burden is in typing. Ranked by value:

| Option | Effort | Effect |
|---|---|---|
| Paste-a-row parser (user pastes the text of a Swelleye table row or transcribes; parser fills `cond`) | small | Cuts typing errors; still manual; consistent with the no-scraping rule since the user pastes their own copy |
| Quick-entry form with a slot picker and compass select, prefilled with the session time's slot | small-medium | Lowers per-reading time to ~1 minute |
| A separate "readings" table so non-surf-day reads do not need a session | medium (new table + migration) | Enables the compare-only route; keeps the journal clean |
| Any automation reading Swelleye | not allowed | n/a |

Suggest: quick-entry form + readings table only if the user commits to the non-surf-day plan; otherwise just improve the tideNote / slot capture.

## 8. Decision rules

Decide per metric, not globally. Do not adopt a correction on fewer than ~20 independent days across at least two wind regimes, and always re-test on a held-out set (or the next collection round).

| Result | Action |
|---|---|
| Wind: OM is low vs the buoy by a ratio stable across regimes and sites within ~10% | Document a wind adjustment factor **per region**, applied at display time only (store raw), labelled as an approximation. Not a global constant (already 0.77 vs 0.48) |
| Wind: the gap is due to the wind grid node (E4) or the reference height (E3) | Fix the request (coordinate or variable) rather than scaling; re-fetch stored rows; note in CLAUDE.md |
| Wind: the gap varies by wind speed or direction | Do not correct. Show OM wind with a "tends to read low; buoy X km away read Y" note, or add a buoy block |
| Gust: sign flips across sessions or sites | Leave alone (noise); report only |
| Swell height/period/direction: agree within rounding | Keep OM as-is; no correction |
| Swell period: consistent 1 s offset | Investigate definition (E7) first; do not apply a fix before that |
| Tide timing: stable offset, small SD | Prefer CWA's forecast for tide within its window (already the case), mention OM's offset in the doc |
| Buoy data shown to be closer on wind/tide and reachable in real time | **Add a buoy/observation block** (`condCwaObs`, separate, per the source-separation rule) with the nearest station and its distance shown, instead of changing `condOpenMeteo` |
| Nothing conclusive | Keep as-is, keep collecting, keep snapshotting |

Over-fitting risk: n=2 Swelleye pairs gave 25% and 25.5% low: it looks like a clean factor, but it is one spot in one week, one wind regime (NE ~10 m/s). The buoy series already shows the factor differs by site (0.77 vs 0.48), so a single hard-coded multiplier would be wrong elsewhere. Correction values must not be derived from the tiny Swelleye sample; Swelleye's role is to say which reference it follows, the buoy series supplies the magnitude.

## 9. Phases, effort, who does what

| Phase | Work | Effort | User | Agent |
|---|---|---|---|---|
| 0: now, no new data (about half a day) | E1-E5, E7-E8; build `compare-observations` read-only script; station table; snapshot the CWA 30-day window to a file for the 2-3 spots (starts the archive) | 2-4 h agent time | approve the plan and decisions below | write script, run experiments, write the results report |
| 1: collect (3-6 weeks) | Typed Swelleye readings per protocol; keep snapshotting observations weekly | ~3 min per reading; ~10-20 readings ~ 1 h total; plus session typing as usual | type readings; say which spots/days | after each ~5 readings rerun `compare` and the readiness line; weekly snapshot |
| 1b (optional) | Quick-entry form and/or readings table | 2-6 h agent time | approve; push to the live DB (only DB, no dev DB; says so before pushing) | build, migration, `supabase db push` after approval |
| 2: analysis (once n >= ~20 independent days, plus winter round later) | Full statistics, alignment test, decision per section 8 | 2-3 h agent time | read the report; decide on any correction / new block | run analysis, write recommendation with intervals and caveats |
| 3: winter revisit | Repeat with 10+ readings in NE monsoon | small | type readings | rerun |

## 10. Risks and open questions for the user

Risks:
- The buoys measure offshore water 7-10 km from the break; they can arbitrate wind and tide timing, not surf-zone conditions.
- Buoy anemometer height/averaging are not in the data. "Buoy is truth" for wind is an assumption; only a published station spec could confirm it (worth one look at CWA's station documentation).
- Wave height/period from the buoys did not match either forecast; do not be tempted to correct swell to them.
- Seasonality: September (post-typhoon, NE flow) may differ from winter monsoon and spring.
- The CWA 30-day window is a hard clock on history.
- Swelleye may change display units or definitions; record the units read.
- Data is on the live DB only; any new table or block is a migration to the live project.

Decisions needed:
1. Approve Phase 0 (read-only scripts + starting a local snapshot of CWA observations)? Where should snapshots live: a local file (untracked), or a new DB table?
2. Are you willing to do ~3 min compare-only readings on non-surf days (which spots, how many per week), or only type on surf days?
3. Do you want a quick-entry form / readings table (Phase 1b), or keep typing into the existing `cond` fields?
4. If wind proves biased, do you prefer a documented display-time factor or a new separate observation block (buoy) shown next to Open-Meteo?
5. Should Green Bay/north coast or Taitung be included in the study (Taitung has a buoy 1.8 km away but Swelleye infographic is all N/A)?
