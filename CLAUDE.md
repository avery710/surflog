# Surflog

Started as a personal surf journal for Capy. As of 2026-09-18 it's a shared
platform — anyone signs in with Google and gets their own private journal
(see "Multi-user" below). Log a session (spot + date + time + notes), and the
wave/wind/tide conditions for that moment get attached to it.

The point of the whole thing: after enough sessions, spot the patterns —
which conditions actually produce good surfs at which breaks. That's still
per-person — nothing here aggregates across users.

## Status

Two implementations exist:

1. **Working today** — a published Claude artifact at
   `https://claude.ai/artifact/Bs9xqTtE8Yj1mqPopK8evM`, single HTML file, kept in
   `reference/surf-journal.html`. Real data in it, in daily use. It works, but
   conditions are filled in manually via Claude (see "The automation problem").
2. **This repo** — the self-hosted rewrite, so conditions fill in automatically.
   Next.js + shadcn/ui, built out 2026-09-18: log form, session list, inline
   edit, photo/video upload, CSV export, spot-fit description chips, patterns
   table, Google sign-in. Storage moved to Supabase the same day (Postgres
   for `sessions`, Storage for photos — see `lib/db.ts`/`lib/blob.ts` and
   `supabase/migrations/`); the original `data/sessions.json` +
   `data/blobs/` filesystem version is gone, migrated in. Repo went public
   the same day too (`github.com/avery710/surflog`, `main` only — a
   `staging` branch existed briefly, deleted same day, not worth the
   overhead yet. Reintroduced 2026-09-22 as the deploy branch: pushing to
   `staging` runs `.github/workflows/deploy-staging.yml` → Vercel; see
   README.md "Staging deploys"). A responsive-design pass also landed 2026-09-18: most of
   the UI was already mobile-friendly by construction, two real overflow
   risks got fixed (`entry-card.tsx`'s button row, `edit-panel.tsx`'s
   refresh-conditions row) — see git log. **Live phone/tablet testing is
   still owed**: the browser resize tool wasn't reliably shrinking the
   viewport in this environment, and testing against the real authenticated
   app would've meant weakening auth locally, which was deliberately not
   done — see "Bugs already hit" if this needs revisiting.

   **As of 2026-09-19**: still not deployed anywhere — no Vercel project
   existed. See README.md "Before deploying to Vercel" for what's left.

   **As of 2026-09-22**: the Google OAuth client is configured
   (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` filled in `.env.local`) and the app
   is in use locally. Landed the same day:
   - **Tide** from CWA (中央氣象署) + an Open-Meteo sea-level fallback — see
     "Data sources". Migration `20260922000000_add_cond_cwa_tide.sql`
     pushed to the live Supabase project.
   - **All 41 spots** now have coordinates, Spot Infographic and CWA
     township in `lib/spots.ts` (was 2) — see "Spots".
   - **Wind unit bug fixed**: every Open-Meteo wind value stored before this
     date was km/h labelled as m/s — see "Bugs already hit".
   - **Bilingual UI** (English / 繁體中文) — see "Localization".
   - UI flow: logging a session is a `+` button in the top-right, beside
     the avatar, that opens a modal (`components/ui/dialog.tsx`); the avatar
     opens a menu with Export CSV, a Language submenu, and Sign out; an
     activity calendar (`components/activity-calendar.tsx`) and a
     spot/session-count table sit below the header; sessions list newest
     first. The "Elsewhere" (overseas) group was removed from the spot
     pickers for now — `lib/overseas-presets.ts` is kept, just unused.

   **As of 2026-09-24** (session cards, `components/entry-card.tsx`):
   - **Tide tile = direction + next turning point, not a height.** The
     card no longer shows a single "tide at session time" figure. The
     headline is **rising / falling** (`tideTrend()` in
     `components/tide-events.tsx`: next event is a high → rising, a low →
     falling); the small print is only that next event, i.e. the next high
     when rising / next low when falling (`high 20:26 · 1.2 m`, `+1d` if it
     falls on another day). Same tile shape for both sources.
   - **Open-Meteo is the only tide shown** (since 2026-09-25; until then
     CWA won and the tile read `Tide (CWA)` whenever `condCwaTide`
     existed). Switched on request so every card uses one consistent
     source, accepting rougher times (±~30 min-1 h) on recent sessions.
     The tile shows Open-Meteo's `tideEvents`, labelled plain `Tide` (the
     "(Open-Meteo)" suffix was dropped from the swell and tide labels
     2026-09-24; the teal "Open-Meteo · auto" badge still names the
     source). `condCwaTide` is still fetched at save time and stored (and
     in the CSV), just not displayed, as are Open-Meteo's `seaLevelM`
     figure and the manual Swelleye `cond.tideM`/`tideNote`.
   - **Open-Meteo wins over typed Swelleye numbers.** When a session has
     `condOpenMeteo`, the manual `cond` swell/wind row and its
     "Swelleye forecast" badge are hidden (they duplicated the Open-Meteo
     tiles); the manual row only shows for sessions with no Open-Meteo
     block. Nothing is deleted from `cond`.
   - **The whole spot-fit tag row was removed from the cards** (2026-09-24),
     the one between the tiles and the notes (wind, tide-band, wind-chop and
     the earlier swell-window / exposure tags). `entry-card.tsx` no longer
     calls `fitDescriptions`; `lib/spot-fit-descriptions.ts` and
     `lib/spot-fit.ts` are kept. The wind tile's shore word
     (`components/wind-shore-badge.tsx`) is now the only fit-derived label.

   **As of 2026-09-25** (condition tiles, restyled on request):
   - **Tiles**: Swell (height, with arrow + compass point under it) ·
     Period (split out of the swell tile into its own) · Wind · Tide.
     Every tile's big figure uses one style (`Figure` in
     `components/condition-tile.tsx`: 20px mono, foreground colour); the
     hover tooltips on figures were removed, and `components/ui/tooltip.tsx`
     with them.
   - **Wind tile** is two rows: `4.2 m/s  ● 中等風` (speed big, strength a
     small grey note) and `← 東  側風` (teal bold arrow + compass point,
     then the shore mode as a small grey note, omitted when the spot has
     no `facing`, e.g. Taitung). The shore word is plain text now, no pill
     or tint. Gust is **not displayed** (tried as a line, then "only when
     gusty", then removed on request) but still feeds the strength label
     and is stored/in the CSV.
   - **Wind strength label** (`components/wind-strength.tsx`): Beaufort
     bands on the **midpoint of speed and gust** (when gust > speed), so
     gusty wind rates stronger. That midpoint rule is our own choice, not
     an established scale. Bands (m/s): <1.5 Calm, <3.4 Light, <5.5
     Gentle, <8 Moderate, <10.8 Fresh, <13.9 Strong, <17.2 Near gale,
     else Gale; green→red dot. zh-TW deliberately plain words, not the
     official Beaufort terms (清風 reads as "gentle breeze" to a layperson
     but is Force 5): 無風 / 微風 / 輕風 / 中等風 / 偏強風 / 強風 / 疾風 /
     大風.
   - Not checked in a browser: all of the above was type-checked and
     linted only.

`VALIDATION.md` holds the experiments run against the spot-fit model and their
results, including the ones that killed features. Read it before changing
`lib/spot-fit.ts`.

## Multi-user

Pivoted from single-user (Capy only) to shared 2026-09-18, same day auth got
built — Capy wants to share the platform with friends, each with their own
journal. What this means concretely:

- **Auth is Google sign-in via Auth.js** (`auth.ts`, `proxy.ts`), JWT
  sessions, no database adapter. There's deliberately **no invite
  list/domain restriction** — anyone with a Google account who signs in gets
  an empty journal of their own. Google auth here buys identity, not
  gatekeeping. If Capy wants that tightened later (allowlist, domain
  restriction), it's a small addition in `auth.ts`'s callbacks — not built.
- **Every `Session` row carries `ownerId`** (Google's stable OIDC `sub`
  claim). Every read/write in `app/api/*` filters or checks against it —
  `lib/db.ts`'s `listSessions` takes `ownerId`, and every mutation route
  fetches the row first and 404s (not 403 — don't confirm the id exists) if
  `ownerId` doesn't match the caller.
- **Photos are scoped too.** Bytes live in Supabase Storage (bucket
  `photos`); ownership and mime type live in a companion Postgres table,
  `photo_blobs` (not Storage's own custom-metadata support — version-
  dependent and awkward to query, a plain table is the same proven pattern
  as `sessions`). `app/api/blob/[id]/route.ts` checks `owner_id` there
  before serving, so one user can't view another's photo even by
  guessing/knowing its id.
- **Nothing aggregates across users.** Patterns table, CSV export, spot-fit
  — all computed from one person's own sessions only. If cross-user
  aggregate stats ever get asked for, that's new scope, not an extension of
  what's here.
- **The pre-login data problem — resolved 2026-09-22.** The 3 real
  sessions logged before accounts existed were migrated with a placeholder
  owner, `"legacy"`, meant to be claimed by whoever signed in with the email
  in a `LEGACY_OWNER_EMAIL` env var. The claim never fired, so the rows were
  reassigned directly to Capy's account (the only real account), and the
  claim code and env var were removed. No `"legacy"` rows remain. If
  ownerless data is ever imported again, assign it to an explicit account;
  never to "whoever signs in first".
- **Storage is Supabase** (Postgres for `sessions`/`photo_blobs`, Storage
  for photo bytes), not a local file — see `lib/supabase.ts`. RLS is
  enabled on both tables with **no policies**; the app authenticates as the
  service_role-equivalent secret key (server-side only, never sent to the
  browser) which bypasses RLS entirely, and does its own ownership checks
  in the API routes as described above. This is deliberate, not a gap to
  fill in later — see README.md "Setting up Supabase" for why RLS/Supabase
  Auth was never the plan here (Google sign-in via Auth.js is the only auth
  system in this app).

## The automation problem (read this first)

This is the constraint that shaped every decision. Don't re-derive it.

**Swelleye has no API.** It's the Taiwan forecast Capy pays for (Swelleye PRO,
NT$145/mo) and trusts. Investigated 2026-09-16:

- Forecast table renders client-side inside an `<iframe>`, data from a private
  undocumented endpoint at `api.swelleye.com`. Not scrapeable from the parent
  page's DOM.
- 9-day **forward** forecast only. No archive, no past dates. This is why the
  journal is same-day-log-only.
- 2-hour granularity (00, 02, 04 … 22), not hourly.
- Directions are **rendered arrows**, never degrees. Reading them off a
  screenshot is good to ~half a compass point. This is the weakest data we have.
- One swell train only. No secondary swell.
- Detailed forecast is behind the PRO login.
- **Taiwan only.** 42 spots, nothing outside the island. Capy has lived in
  Siargao and travels; Swelleye is useless the moment he leaves.
- **Its forecast NUMBERS are not spot-adjusted** — see "What Swelleye's numbers
  actually are" below. This was misunderstood for the first two days.

**What Swelleye's numbers actually are** (established 2026-09-18, Phase 1b):

Nanwan and Jialeshui sit 25 km apart, face S and SE respectively. On an E
swell, Nanwan is side-on and its own page says it is "flat for most of the
year". Swelleye gave them 1.0 m and 1.1 m. Near-identical. Open-Meteo gave
1.06 m and 1.12 m — the same thing.

So Swelleye's "Swell Height" is the regional offshore swell, the same quantity
Open-Meteo reports. **Swelleye's spot knowledge lives in the Spot Infographic**
(facing, best swell direction, best wind, best tide), not in the forecast
table. Two consequences:

1. Open-Meteo gives up nothing on height by not being Taiwan-specific.
2. Nothing in either forecast distinguishes one break from another. That has
   to be computed — see "Spot fit".

**The artifact sandbox blocks all outbound network.** So even with an API, the
published page cannot call it. Combined with the above, the only way to get
Swelleye numbers today is: Claude opens the spot page in Capy's logged-in
Chrome, reads the table visually, writes the values into the artifact's
database. Works, but Capy has to ask each time.

**Automating Swelleye at all means scraping** — hitting `api.swelleye.com`
directly with Capy's PRO session cookie. Fragile, and a grey area against their
terms. Deliberately not done. If it's ever attempted it belongs server-side in
this repo, never as the primary source.

**Therefore this repo uses Open-Meteo**, called server-side at save time. No key,
no CORS, no sandbox, fills instantly, and covers past dates.

**Decision 2026-09-25: Open-Meteo is the sole conditions source.** Typing
Swelleye numbers into `cond` is no longer routine (the field and edit form
stay). Swelleye becomes an occasional spot-check instead: a full-day
browser reading every week or two (see "Swelleye vs Open-Meteo comparison
tool"), focusing on swell period and morning wind, until ~10 days of
comparisons exist. Why:
where it matters it agrees (see "Swelleye vs Open-Meteo comparison"), and
for spotting patterns across one person's sessions a source that fills
every session the same way — past dates and overseas included — beats a
possibly-better one typed in sometimes. Swelleye is a model too, not ground
truth; its spot knowledge is the Spot Infographic, already in
`lib/spots.ts`. Real ground truth would be CWA buoy observations (see
"Ruled out" → CWA), not built.

## Data sources

### Open-Meteo Marine (primary here) — VERIFIED WORKING

`https://marine-api.open-meteo.com/v1/marine` — no API key, free for
non-commercial use.

German open-source project. It runs no models of its own; it aggregates open
data from national weather services (NOAA, DWD, Meteo-France, ECMWF,
Copernicus). Marine forecasts come from a global wave model. History is
far shorter than the "1940 to present" this file used to claim — see "How
far back it fills in" below.

**Global coverage — verified 2026-09-18.** Cloud 9, Siargao returned
0.56 m @ 7.1 s from 69 deg (grid node ~4 km off). Same endpoint, same
parameters, just different coordinates. This is the one place Open-Meteo
clearly beats Swelleye, which stops at Taiwan's coastline.

Verified 2026-09-17 against Swelleye for Jialeshui:

| | Swelleye | Open-Meteo |
|---|---|---|
| Primary swell | 1.0 m @ 7.0 s from E | 0.98 m @ 7.5 s from 85° |

Close enough to trust. Open-Meteo additionally gives what Swelleye can't:

- `secondary_swell_wave_height / _direction / _period` — the secondary swell
  Capy asked for on day one
- Directions in **degrees**, not arrows
- **Hourly**, not 2-hourly
- `wind_wave_*` split out from `swell_wave_*` — this turned out to explain
  sessions better than either number alone (2026-09-17 06:00 Jialeshui: 1.16 m
  of wind chop at 4.55 s sitting on 0.98 m of real swell — matches Capy's note
  that it was blown out)
- Past dates — back to late 2021 for swell, late 2022 for sea level (see
  below); wind from the archive endpoint goes back to 1940

### Open-Meteo's real resolution limit — TESTED 2026-09-18, READ THIS

Queried five Yilan points spread over ~20 km (Wai'ao, Double Lions, Wushi,
Daxi, and one south of Wai'ao). **All five snapped to the same grid node
(24.875, 121.875015) and returned byte-identical data.**

So Open-Meteo CANNOT tell one Yilan break from another. It discriminates by
day and by region (Jialeshui returns completely different numbers from Yilan),
not by break. This is the same coarseness that got CWA ruled out as a
per-session source — it applies here too, just at a smaller scale.

Two consequences:

1. Don't build the UI as if each spot has its own forecast. Within a cluster
   there is one offshore sea state, shared.
2. What actually differs between neighbouring breaks is how that same offshore
   swell refracts onto different orientations and bathymetry. No free global
   model gives that; it is exactly what Swelleye's spot tuning adds.

The workable substitute: store the offshore reading from Open-Meteo alongside
each spot's **static attributes**, which Swelleye publishes on every spot page
("Spot Infographic" — facing, wave type, seabed, best tide, best swell
direction, best wind direction, surfer level). Wai'ao for example: faces E,
beach break, best tide mid-to-high, best swell ENE/E/SE/SSE, best wind NW/W.
Offshore swell direction + the spot's best-swell window is a decent proxy for
whether it was working, and it is computable. Harvest those attributes into
`lib/spots.ts` at the same time as the coordinates.

Caveats: model grid snaps to the nearest sea point — a Jialeshui request at
22.05/120.90 came back as 21.958/120.875, ~10 km off. Open ocean model, no
bathymetry or refraction, so it is NOT spot-tuned the way Swelleye is.
Wind speed/gust are NOT in the marine endpoint — use the forecast/archive
weather API for `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`.
**Always pass `wind_speed_unit=ms`** — Open-Meteo's default is km/h (see
"Bugs already hit").

**How far back it fills in — tested live 2026-09-25** (Jialeshui, the
same endpoints `lib/openmeteo.ts` calls). The app accepts a session on any
date (no min in the form, format-only check in the API); what's missing
is conditions:
- **Marine endpoint** (swell, period, direction, sea temp): data from
  **early Oct 2021** (2021-09-01 null, 2021-10-05 present). Older → null.
- **`sea_level_height_msl`** (→ `tideEvents`, the tide tile): from
  **~Nov/Dec 2022** (2022-11-01 null, 2022-12-01 present). Older → no tide.
- **Wind** (`archive-api`, used for dates >6 days old): back to **1940**
  (2010-01-01 returned data).
So a fully filled card works back ~3.8 years from 2026-09; before Oct 2021
only wind fills in. Exact start days not pinned down; they may also differ
by grid node.

**Sea level (added 2026-09-22)** — the marine endpoint's
`sea_level_height_msl` (tide + surge, metres vs mean sea level, hourly,
past dates back to ~Nov/Dec 2022 only). Stored as `condOpenMeteo.seaLevelM` plus
`seaLevelTrend` (rising/falling, from the neighbouring hour). It's the
tide fallback for whenever CWA can't cover a session (past dates,
overseas). Model output at the offshore grid node, and a different datum
from CWA's TWVD heights — the two numbers are not comparable, only the
rising/falling direction is.

**Tide events (added 2026-09-24)** — `condOpenMeteo.tideEvents`, the
turning points (high/low) of hourly `sea_level_height_msl` within ±14 h of
the session, plus always the bracketing pair (last at/before, first after,
even if further out; mixed tides have gaps up to ~17 h) — sorted, strictly
alternating; widened from the bare pair on 2026-09-24 so the card can draw
a tide-chart curve (`windowAround()` in `lib/tide-bracket.ts`; the
date-1..date+1 fetch covers ±14 h for any hour). Each with its own `time`/`heightM` (see `TideEvent` in
"Entry schema"). `lib/openmeteo.ts`'s `findTideEvents()` fetches a separate
date-1..date+1 marine request (so the existing single-day `hour` indexing
for the other variables is untouched), finds local extrema in the hourly
series, and refines each to sub-hour precision with a 3-point parabolic
fit (hourly resolution alone is only ±30 min). Verified live against
Jialeshui 2026-09-16, where the session's own manually-entered `cond`
already records Swelleye's reading of "low 14:44, high 20:26": the raw
hourly series has its min (0.44 m) at 14:00 and max (1.21 m) at 20:00,
refining to ~13:50 and ~20:10. The high moves the right way (16 min off,
down from an hour); the low moves the wrong way (13:50 vs 14:44) — traced
to the API's 2-decimal-place rounding on the surrounding hours, where the
fit's curvature term is small enough that rounding error swings the vertex
a lot. The formula itself checks out against a synthetic parabola; this is
a real precision limit of the rounded input, not a fit bug. Same MSL-vs-
TWVD caveat as `seaLevelM` above — not comparable to `condCwaTide.events`'
heights, only useful as a same-shape fallback when CWA can't cover the
session.

**Rising/falling verified 2026-09-24** against the raw hourly series for
all 5 sessions (Jialeshui, 16/17/20/21/22 Sep): every one really was on a
rising tide, matching Swelleye's typed notes and, for 22 Sep, CWA's 16:41
high. No free past-date tide table exists to cross-check times, so the
timing of Open-Meteo events (±~30 min; the 16 Sep low was ~1 h off
Swelleye's) is unverified independently. **Fixed 2026-09-24:**
- `refineExtrema` (`lib/openmeteo.ts`) used strict `>`/`<`, so two equal
  adjacent hourly values (the API rounds to 0.01 m) hid a flat peak or
  trough (22 Sep 16:00/17:00 high, 17 Sep 03:00/04:00 and 21 Sep
  09:00/10:00 lows), giving a low/low bracket and a wrong "falling". Now a
  run of equal values that beats both outside neighbours is one extremum at
  the run midpoint (no parabolic fit), and consecutive same-type extrema
  are merged (more extreme wins; equal -> midpoint) so prev/next always
  alternate. Verified live: 22 Sep now low 10:00 / high 16:30, rising.
- `seaLevelTrend` now uses a centred difference (h+1 vs h-1, clamped at
  hours 0/23), widening to +/-2 h on a tie; the 20 Sep session is no
  longer null.
- `tideTrend()` sorts a copy of its input by time before picking.
Still open: `tideTrend()` treats a 7 cm dip in a mixed tide as a real
"falling"; consider a minimum range (~0.10 m Open-Meteo, ~15 cm CWA).

### CWA tide forecast (in use since 2026-09-22) — VERIFIED WORKING

`lib/cwa-tide.ts`. CWA opendata (中央氣象署開放資料平臺), dataset
`F-A0021-001`, `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-A0021-001?Authorization=<CWA_API_KEY>&format=JSON`.
Free key from opendata.cwa.gov.tw, in `.env.local` as `CWA_API_KEY`.

- **Keyed by township, not lat/lng.** ~266 coastal townships. Each spot
  carries its CWA `LocationName` as `tideTownship` in `lib/spots.ts`
  (county + township, exact match: `宜蘭縣頭城鎮`, not `頭城鎮`).
  `LocationName` works as a server-side filter param.
- Response: `records.TideForecasts[].Location.TimePeriods.Daily[].Time[]`
  with `DateTime`, `Tide` (`滿潮` high / `乾潮` low) and
  `TideHeights.AboveTWVD` — **centimetres, and a string**. Converted to
  metres.
- Discrete high/low events (~4/day), not a curve. The app stores the
  event nearest the session time (`tideM`/`tideType`/`time`) plus, since
  2026-09-24, `events: TideEvent[]` — every event within ±14 h of the
  session plus always the bracket (last at/before, first after), sorted,
  for the tide chart and "low 14:44 · 0.4 m, high 20:26 · 1.2 m" text.
  `Daily[]` in the raw response is **not sorted by date** (verified live
  2026-09-24) — `getTide()` flattens every day's events and sorts by
  `DateTime` before picking anything positional.
- **Forward-only: today + ~32 days.** No past dates. `getTide()` returns
  `null` when the session is outside the forecast window (no event at/before
  it, which is every past date, or none after it), so a past session never
  silently gets the window's first event. There is deliberately no
  per-event distance cap: **fixed 2026-09-24**, the old 7 h cap assumed
  highs/lows ~6 h apart, but live gaps run 3.9-17.4 h (mixed tides at
  屏東縣滿州鄉, e.g. 2026-10-04 07:10 -> 10-05 00:34), so mid-gap sessions
  got null. `events` always contains the prev/next bracket; the legacy
  `tideM`/`tideType`/`time` is whichever is nearer. Past sessions rely on
  Open-Meteo sea level/tide events instead (CWA can't be backfilled).
- Stored in its own block, `condCwaTide`, fetched at save time and
  re-fetched on spot/date edits — same pattern as `condOpenMeteo`.
  **Not displayed since 2026-09-25** — the card's tide tile is
  Open-Meteo-only (see "Status").

### Swelleye vs Open-Meteo comparison tool (added 2026-09-24)

`npm run compare` (`scripts/compare-sources.ts`, pure logic in
`lib/source-compare.ts`) writes `reports/swelleye-vs-openmeteo.md` plus a
terminal table. Differences are Open-Meteo minus Swelleye; each metric gets
a **gap score = mean abs diff ÷ its `absLarge` in `THRESHOLDS`** (0 =
identical, 1 = at the "large" line), sorted biggest first — numbers first,
per Avery's preference, with close/noticeable/large verdicts kept below.
Uses `npx tsx` (fetched on demand, not a dependency). Two Swelleye inputs:

1. **Browser readings (the main input since 2026-09-25).** A full day of
   Swelleye's table for one spot, in
   `data/swelleye-readings/<slug>/<YYYY-MM-DD>.json` (`SwelleyeReading`:
   `hours` keyed `"00"`…`"22"`, each with swell height/period/dir, wind
   speed/gust/dir, sea/air temp; plus `tide` turning points as `"HH:mm"`).
   Directions are 16-point compass values, or a band like `"ENE-E"` when
   the arrows can't be read finer (diff 0 inside it). Open-Meteo for the
   same hours comes from the app's own `getConditions()` and is
   **snapshotted once** as `<date>.openmeteo.json` beside it, so a re-run
   weeks later doesn't swap the forecast for archive data — delete the
   snapshot to refetch. The whole folder is **gitignored** (Swelleye's paid
   PRO data; repo is public).
   **Taking a reading is on request only**: when Avery asks, open
   `swelleye.com/en/surf-spots/<slug>/` in Avery's logged-in Chrome, scroll
   to the table, zoom the arrow rows, write the JSON, run `npm run compare`.
   The `data-source-engineer` agent has no browser, so the reading itself
   is done in the main session. Never scrape `api.swelleye.com` or reuse the
   cookie — see "The automation problem"; automating the browser on a
   schedule was offered and declined 2026-09-25 for the same reason.
2. **Typed session readings**: sessions (read-only, all owners) with both
   a Swelleye `cond` and a `condOpenMeteo`. Tide compares turning-point
   timing only (datums differ). 2 sessions (Jialeshui, 16 and 17 Sep): height,
   direction and sea temp close; wind speed ~25% lower in Open-Meteo both
   times.

The wind strength label is compared too (Beaufort band steps), using the
same `windLevelIndex()` as the card (`lib/wind-strength.ts`).

**2026-09-25, Jialeshui, full day** (12 two-hourly marks; the first
browser reading, reproduced by `npm run compare`; a hand-written write-up
is in `reports/jialeshui-2026-09-25-openmeteo-vs-swelleye.md`, untracked
like all of `reports/` — it names session ids and the repo is public). Gap score = mean absolute diff ÷ that metric's `absLarge` (0 =
identical, 1 = at the "large" line): swell period **0.80** (MAE 1.20 s;
Swelleye rises smoothly 6.4→8.2 s, Open-Meteo bounces 4.45–8.15 s), gust
0.48, wind speed 0.42 (Open-Meteo 23–50% low 00:00–06:00, close or higher
from 08:00), wind direction 0.38, tide turning-point timing 0.37 (16–51 min;
rising/falling agreed every hour), wind strength label 0.33, swell height
0.13, swell direction 0.00
(inside Swelleye's ENE–E band). Wind strength label matched 8/12 hours.
Swelleye's tide times track CWA's closely (11:51 vs 11:47, 17:31 vs 17:43),
so it likely uses CWA tides — unverified guess.

### Ruled out

- **Windy** — Point Forecast API is EUR 990/year, and the free "testing" tier
  "returns randomly shuffled and slightly modified data" (deliberately wrong).
  Decisive problem: their terms forbid you to "store, extract, modify,
  distribute the weather data … create any weather works or databases derived
  therefrom". A journal is exactly that. Not licensed for this use at any price.
- **Stormglass.io** — technically the best paid fit (swell1 + swell2, gust,
  tide, multi-model). Free tier is 10 req/day non-commercial, which would
  actually be enough for one surf a day. Kept as a fallback; not needed while
  Open-Meteo covers it.
- **CWA (Taiwan 中央氣象署) opendata** — free, official, needs a token. Rejected
  as the per-session source because its marine forecasts are area-scale
  ("northeast sea area, 2-3 m"), too coarse to distinguish one session from
  another, which is the entire point of the journal. Genuinely worth using for
  two things: **official tide tables** — now in use, see "CWA tide forecast"
  above — and **buoy observations** (real measurements, not model output;
  `O-B0075-001` is the 48 h buoy/tide-gauge dataset; there is a buoy near
  Guishan Island, close to the Yilan breaks). Buoys not built yet.

## Spot fit — computing what the forecasts don't give you

`lib/spot-fit.ts`. Since neither Swelleye nor Open-Meteo distinguishes one
break from another (see above), the difference has to be derived from each
spot's orientation and published preferences.

**Status: computable, physically reasonable, NOT verified.** Read
`VALIDATION.md` before extending it.

What it derives, and where each stands:

| field | status |
|---|---|
| `exposure`, `incidenceDeg` | **kept** — the per-spot discriminator |
| `inSwellWindow`, `swellWindowOffsetDeg` | **kept** |
| `windMode`, `offshoreness`, `onshoreWindMs` | kept |
| `tideBand`, `tideMatchesBest` | kept — genuine added value, neither source does this |
| `junkRatio` | kept, one contradicting observation so far |
| `effectiveSwellM` | **demoted — do not display** |

`effectiveSwellM` scaled swell height by `cos(incidence)` and under-predicted
Swelleye by ~25%. Waves refract toward shore-normal as they shoal, so cos() of
the deep-water angle over-penalises. Raw Open-Meteo height needs no correction.

`exposure` itself survives on different grounds: Nanwan vs Jialeshui on the
same E swell gave an exposure ratio of 10.7 where both forecasts' heights
differed by 1.10. It is the only thing that separates them.

### The unfalsifiability problem — decide this before building on it

Spot fit has **no outcome variable to test against**:

- Swelleye's surfer star ratings were the plan; Capy ruled them out
  2026-09-18 (1-2 voters per spot-day, inconsistent raters). Fair call.
- Neither forecast's height discriminates between spots, so no forecast number
  can be the target either.
- The original artifact journal has **no rating field** — it was offered at
  the start and declined. This repo has an optional 1-5 `rating` (see
  "Entry schema"), but real sessions haven't used it yet.

So the features can be computed but not checked. Weak corroboration exists —
`facing` and `bestSwellDir` are independent published fields and they agree
(Nanwan: exposure 0.07, outside window, and its description says "flat most of
the year") — but that is close to circular.

**The fix is one field: a 1-5 star or even binary good/bad on each session.**
It has come up three times and it is now load-bearing. Without it, spot fit
stays a plausible unverified heuristic forever.

**Until it exists:** show these as description ("side-on to the swell",
"outside the usual window", "tide suits this break"), never as a score. A
number that looks authoritative and has never been tested is worse than no
number.

### Open question — wind speed disagreement

Open-Meteo 5.5 m/s vs Swelleye 8 m/s at Jialeshui 06:00 on 2026-09-18, roughly
30% apart, while gusts agreed (10.7 vs 10). Possibly different reference
heights or averaging windows. Unresolved; pin it down before trusting wind
numbers from either source.

2026-09-25 narrows it: across a full day at Jialeshui the gap was
concentrated overnight/morning (Open-Meteo 23–50% low until 06:00) and gone
by 08:00 — so possibly time-of-day, not a constant offset. Still n=3 days,
one spot. Open-Meteo is used anyway (see "The automation problem"); the
strength label on the card is coarse enough that this mostly moves it by
one band at most.

Not explained by the km/h bug found 2026-09-22 (see "Bugs already hit"):
the gusts agreeing means that comparison was already in m/s. But any wind
number read out of the app's stored data before 2026-09-22 was 3.6× too
high — re-check against the corrected values, not old screenshots.

## Entry schema

The artifact db (collection `sessions`) holds the version below without
`ownerId`/`condOpenMeteo`/`condCwaTide`/`rating`. This repo's schema
(`lib/types.ts`) is that plus all four, now implemented — backed by the `sessions` table in
Supabase Postgres (`supabase/migrations/`), read/written through
`lib/db.ts`. The old `data/sessions.json` file this used to be is gone; see
`data/README.md` for where its 3 real rows ended up.

`TideEvent = { type: "high" | "low", time, heightM }` (added 2026-09-24,
`lib/types.ts`) — one tide turning point, shared by both tide sources below
so a session can show the bracketing pair around it ("low 14:44 · 0.4 m,
high 20:26 · 1.2 m") instead of one nearest-in-time figure. `time` is
`"YYYY-MM-DDTHH:mm"`, no tz suffix, same as `when`. Both sources' bracket-
picking (last event at/before the session, first after it) shares one
implementation, `pickBracket()` in `lib/tide-bracket.ts` — CWA and
Open-Meteo still fetch and compute their own events independently; only the
"pick the pair around a target time" array-walk is shared code.

```
{
  ownerId:    string     // Google account's OIDC sub — see "Multi-user"
  spot:       string     // Swelleye slug, e.g. "waiao", or "custom:Siargao - Cloud 9"
  when:       string     // "YYYY-MM-DDTHH:mm", local Taiwan time, 2-hour grid
  notesHtml:  string     // sanitized rich text: p/br/div/u/ul/ol/li/b/i (contentEditable's
                          // real output — see lib/rich-text.ts for why it's broader
                          // than the ul/ol/li/b/i this comment used to say)
  notes:      string     // plain-text mirror, for CSV export and search
  photos:     [{ id, type }]   // asset id + mime; video/* renders as <video>
  cond: null | {
    swellHeightM, swellPeriodS, swellDir,      // swellDir is a compass point today
    windSpeedMs,  windGustMs,   windDir,
    tideM, tideNote,
    seaTempC, airTempC, sky,
    source:   "swelleye" | "manual",
    filledAt: ISO string
  }
  condOpenMeteo: null | {   // parallel block, per-field source kept separate from `cond`
    swellHeightM, swellPeriodS, swellDirDeg,
    secondarySwellHeightM, secondarySwellPeriodS, secondarySwellDirDeg,
    windWaveHeightM, windWavePeriodS, combinedWaveHeightM,
    windSpeedMs, windGustMs, windDirDeg,
    seaTempC, airTempC,
    seaLevelM?, seaLevelTrend?,  // "rising" | "falling" — tide fallback, optional (added 2026-09-22)
    tideEvents?: TideEvent[],   // sea-level turning points within ±14 h + always the bracket, sorted, optional (added 2026-09-24)
    gridLat, gridLng,        // the grid node actually used — always shown, may be km off
    source: "open-meteo",
    fetchedAt: ISO string
  }
  condCwaTide: null | {     // CWA tide forecast — null for past dates / no township
    tideM,                   // nearest high/low event's height, metres (TWVD)
    tideType,                // "high" | "low"
    time,                    // ISO, when that event happens
    stationTownship,         // CWA LocationName, e.g. "宜蘭縣頭城鎮"
    events?: TideEvent[],    // events within ±14 h of the session + always the bracket, sorted, optional (added 2026-09-24)
    source: "cwa",
    fetchedAt: ISO string
  }
  rating:     number | null   // 1-5, optional — see "The unfalsifiability problem"
  createdAt:  ISO string
  example?:   true       // the seeded demo row
}
```

`condOpenMeteo` is auto-filled server-side at save time
(`app/api/sessions/route.ts` → `lib/openmeteo.ts`) whenever the spot has known
coordinates, and `condCwaTide` (→ `lib/cwa-tide.ts`) whenever it has a
`tideTownship`; both re-fetch when spot or date is edited. `cond` stays
manual-only — nothing scrapes Swelleye. All three are kept as separate
blocks rather than merged, per Capy's original requirement to know which
number came from where.

**Spot descriptions** live outside sessions, in their own table
`spot_notes` (`owner_id`, `spot`, `description`, `updated_at`; primary key
`(owner_id, spot)`, migration `20260923000000_create_spot_notes_table.sql`).
A user's own free-text note per spot ("best at mid tide, crowded on
weekends"), edited inline in the "What you've surfed" table via
`PUT /api/spot-notes`; an empty description deletes the row. Per owner,
like everything else — same RLS-on/no-policies access model as `sessions`.

`rating` is wired into the UI (`components/rating-picker.tsx`) but still has
zero real submissions as of 2026-09-18 — it only becomes useful once Capy
actually starts rating sessions. Spot-fit is still unverified until then.

## Spots

41 Taiwan spots, slugs harvested from swelleye.com — see `lib/spots.ts`
(this file used to say 42; the table has always had 41). Slugs are NOT
derivable from names (`wushi-north`, `eight-immortals-cave`, `greenbay`),
so the table is the source of truth.

**As of 2026-09-22 every spot has** `lat`/`lng`, the Spot Infographic
(`facing`, `bestSwellDir`, `bestWindDir`, `bestTide`), `tideTownship`
(CWA LocationName) and `nameZh` (Swelleye's own Chinese name). Harvested
by the `data-source-engineer` agent; spot-checked against Swelleye.

Where each piece comes from:
- **Coordinates**: the `lt=`/`ln=` params in the surf-report/forecast/map
  iframe `src` URLs on `swelleye.com/en/surf-spots/<slug>/` — not visible
  page text, so a text-only fetch misses them; curl the raw HTML. Identical
  on the Chinese page. Never approximate a coordinate; the Open-Meteo grid
  node it picks changes. (Jialeshui's once-guessed 22.05, 120.90 was ~8 km
  out.)
- **Infographic**: the same page's "Spot Infographic" block.
- **tideTownship**: reverse-geocode the coordinate (Nominatim; zoom=10
  often returns only "臺灣" for beach points — use 14–18), then confirm the
  exact string exists in a live `F-A0021-001` response.
- **nameZh**: the Chinese page is the root path,
  `swelleye.com/surf-spots/<slug>/`; the name is the `<title>` text before
  `浪點指南`. Never translate a spot name by hand (Restaurants → 餐廳,
  Gongs → 鹽寮漁港).

Exceptions:
- **Taitung**: real coordinate and tide township, but Swelleye's
  infographic is all "N/A" (an area listing, not a tuned break), so those
  fields are omitted and spot-fit badges won't appear for it.
- **Shanshui** is in Penghu (澎湖縣馬公市), an offshore island, but filed
  under `region: "West"`. CWA covers it. Left as-is; a region change is
  Capy's call.
- Several neighbours share a township (eight Yilan spots → 宜蘭縣頭城鎮,
  Jiupeng + Jialeshui → 屏東縣滿州鄉), which is expected — CWA's tide is
  per township, not per break.

## Bugs already hit — don't repeat these

- **Frozen snapshots.** The artifact db hands back snapshot documents as frozen
  objects. `data.id = d.id` on one throws in strict mode, which killed the
  render callback silently and made the whole session list appear empty while
  the data was fine. Copy the body before adding the id.
- **`claude.use()` can hang.** In some views the promise never settles, leaving
  the page on a loading spinner forever. Always race it against a timeout.
- **Opening the raw artifact URL top-level shows an empty log.** The db only
  answers inside Claude's own artifact viewer.
- **`execCommand` after `deleteContents()`** needs the caret restored
  explicitly, or the list command silently no-ops. Bit us on the "- " shortcut.
- **Open-Meteo wind in km/h, stored as m/s** (fixed 2026-09-22). The
  forecast/archive APIs default to km/h; `lib/openmeteo.ts` never passed
  `wind_speed_unit=ms`, so every stored `windSpeedMs`/`windGustMs` was 3.6×
  too high (Jialeshui 2026-09-17 06:00 read "26.8 m/s"; really 7.45). Fixed
  in the request, and the 5 existing rows were re-fetched and corrected.
  Any new Open-Meteo variable: check its unit in `hourly_units`.
- **Rewriting a contentEditable while typing breaks Chinese input**
  (fixed 2026-09-22). The edit panel passed its live `notesHtml` state back
  into the editor's `dangerouslySetInnerHTML`, so React rewrote the DOM on
  every keystroke — wiping IME composition (注音/倉頡) mid-word and jumping
  the caret, which came out as garbled text. `RichTextEditor` now freezes
  its initial HTML at mount, and skips emitting while `isComposing`.
  Never feed an uncontrolled editor's own output back into it.
- **Nearest-event matching with no distance cap.** CWA's tide forecast is
  forward-only, so "nearest event" for a past session was days away and
  looked perfectly valid. `getTide()` now rejects matches over 7 h.
  Anything that picks "the closest reading" needs a maximum distance.
- **Turbopack + `next/font/google` fails even with working network**
  (hit 2026-09-22). Every page 500'd with "next/font/google queries have
  exactly one entry" / `Can't resolve
  '@vercel/turbopack-next/internal/font/google/font'`. Not a proxy/VPN
  issue — `curl https://fonts.googleapis.com` worked fine, and a full
  `.next` cache wipe didn't help either; it's a known flaky Turbopack
  resolver bug (vercel/next.js#61886). Fix: `npm run dev` now runs
  `next dev --webpack` (see `package.json`). `next build` is unaffected
  and still uses Turbopack, since CI/Vercel builds have run clean.
- **`user.id` in the Auth.js JWT callback is a random UUID, not Google's
  `sub`** (hit and fixed 2026-09-22). Without a database adapter, Auth.js
  generates a fresh `crypto.randomUUID()` for `user.id` on every sign-in —
  it's not the OIDC subject claim NextAuth docs imply. `auth.ts`'s `jwt`
  callback used it as `token.sub`, so signing out and back in (or a second
  browser/staging) minted a brand-new `ownerId` each time and orphaned all
  earlier sessions. Fixed by reading `account.providerAccountId` instead
  (only present on the initial sign-in, alongside `account`) — that's
  Google's real stable subject id. Never use `user.id` for identity in a
  JWT-strategy, adapter-less Auth.js setup.
  **Aftermath (seen 2026-09-24):** the fix only applies at sign-in. A
  browser still holding a JWT from before it (cmux's built-in browser here)
  keeps the random-UUID `ownerId`, gets renewed on every visit, and shows an
  empty journal while the server is fine — `/api/auth/session` returns a
  UUID `user.id` instead of a ~21-digit Google sub. Fix: sign out and back
  in. If "the page shows no sessions", check that id before debugging
  anything else.

## Localization

Bilingual since 2026-09-22: English and Traditional Chinese as used in
Taiwan (`zh-TW`, never Simplified). Switched from the avatar menu →
Language; the choice lives in localStorage (`surflog:lang`), per browser.

- `lib/i18n.tsx` is the whole system: a `DICT` of key → `{ en, "zh-TW" }`
  (typed so a key missing either language fails typecheck), `useLang()` →
  `{ lang, setLang, t }`, and `t(key, { name })` fills `{name}`
  placeholders. `LanguageProvider` wraps everything in `app/layout.tsx`
  and keeps `<html lang>` in sync.
- **Every user-visible string goes through `t()`** — labels, buttons,
  toasts, placeholders, aria-labels, alt text. Formatters in `lib/` take a
  `lang` param instead: `spotLabel`, `fmtWhen`, `compassLabel`,
  `fitDescriptions`.
- Language is read with `useSyncExternalStore` (server snapshot always
  `"en"`), not useEffect+setState — that would break hydration and fails
  the `react-hooks/set-state-in-effect` lint rule.
- Deliberately not translated: units, source names (Surflog, Open-Meteo,
  Swelleye), CSV export, error messages returned by API routes, and user
  content (notes, typed Swelleye readings).
- Terminology: 浪點 spot · 湧浪 swell · 週期 period · 陣風 gust · 滿潮/乾潮
  high/low tide (CWA's terms) · compass points in CWA's form (北北東,
  東南…).

## Project agents

`.claude/agents/` — both run on Sonnet:
- **`data-source-engineer`** — Open-Meteo and CWA fetches, new datasets,
  spot harvesting into `lib/spots.ts`. Its file records the verified API
  shapes and gotchas.
- **`localizer`** — translations, finding hard-coded strings,
  language-aware formatting.

New agent files only load when a Claude Code session starts.

## Conventions

- Metric throughout: metres, seconds, m/s, °C. Never feet or knots.
- Times are Asia/Taipei local, no timezone suffix stored.
- UI: white background, black text, single light theme (no dark mode — removed
  on request). Rounded components, Coinbase-ish: 24px cards, 16px tiles, pill
  buttons. Plus Jakarta Sans for UI and notes (notes were Newsreader serif
  until 2026-09-22; switched to match the labels, on request), IBM Plex Mono
  for readings. Teal accent `#0E7C86`.
- Notes are rich text with a markdown-ish `- ` shortcut for bullets. Capy writes
  notes in Chinese; don't break CJK handling.
