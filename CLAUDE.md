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
   table, Google sign-in. Storage is `data/sessions.json` + `data/blobs/` on
   the local filesystem — **dev-only**, not deployed. See README.md "Before
   deploying to Vercel" before putting this on Vercel; it needs a real
   database and blob store first.

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
- **Photos are scoped too.** `lib/blob.ts` writes an `.owner` sidecar next
  to each blob; `app/api/blob/[id]/route.ts` checks it before serving, so
  one user can't view another's photo even by guessing/knowing its id.
- **Nothing aggregates across users.** Patterns table, CSV export, spot-fit
  — all computed from one person's own sessions only. If cross-user
  aggregate stats ever get asked for, that's new scope, not an extension of
  what's here.
- **The pre-login data problem.** The 3 real sessions logged before accounts
  existed have no natural owner. They're tagged with a placeholder
  (`"legacy"`) and claimed automatically — permanently — by whoever's email
  matches the `LEGACY_OWNER_EMAIL` env var the first time that person signs
  in (`lib/db.ts` `claimLegacySessions`). This has to be gated on a specific
  email, not "whoever signs in first" — a friend beating Capy to first
  sign-in must never end up owning Capy's own journal.

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

## Data sources

### Open-Meteo Marine (primary here) — VERIFIED WORKING

`https://marine-api.open-meteo.com/v1/marine` — no API key, free for
non-commercial use.

German open-source project. It runs no models of its own; it aggregates open
data from national weather services (NOAA, DWD, Meteo-France, ECMWF,
Copernicus). Marine forecasts come from a global wave model; history is
ERA5-Ocean, 1940 to present.

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
- Historical archive (ERA5-Ocean, 1940→present, 0.5° resolution, ~5 day lag)

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
  two things: **official tide tables** (authoritative for Taiwan) and **buoy
  observations** (real measurements, not model output — there is a buoy near
  Guishan Island, close to the Yilan breaks; station status unverified).

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
- Capy's journal has **no rating field** — it was offered at the start and
  declined.

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

## Entry schema

The artifact db (collection `sessions`) holds the version below without
`ownerId`/`condOpenMeteo`/`rating`. This repo's schema (`lib/types.ts`) is
that plus all three, now implemented — `data/sessions.json` is what this app
reads and writes directly (dev-only storage, see "Status"). That file is
gitignored as of 2026-09-18 (repo went public; it held Capy's real entries —
see `data/README.md`), so it won't exist in a fresh clone until something's
been saved.

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
    gridLat, gridLng,        // the grid node actually used — always shown, may be km off
    source: "open-meteo",
    fetchedAt: ISO string
  }
  rating:     number | null   // 1-5, optional — see "The unfalsifiability problem"
  createdAt:  ISO string
  example?:   true       // the seeded demo row
}
```

`condOpenMeteo` is auto-filled server-side at save time
(`app/api/sessions/route.ts` → `lib/openmeteo.ts`) whenever the spot has known
coordinates; `cond` stays manual-only — nothing scrapes Swelleye. Both are
kept as separate blocks rather than merged, per Capy's original requirement
to know which number came from where.

`rating` is wired into the UI (`components/rating-picker.tsx`) but still has
zero real submissions as of 2026-09-18 — it only becomes useful once Capy
actually starts rating sessions. Spot-fit is still unverified until then.

## Spots

42 Taiwan spots, slugs harvested from swelleye.com — see `lib/spots.ts`.
Slugs are NOT derivable from names (`wushi-north`, `eight-immortals-cave`,
`greenbay`), so the table is the source of truth.

**Coordinates confirmed so far** (from each spot page, where lat/lng are
embedded in the page URLs), with their Spot Infographic:

| spot | lat, lng | facing | best swell | best wind | best tide |
|---|---|---|---|---|---|
| Wai'ao | 24.882278, 121.846166 | E | ENE/E/SE/SSE | NW/W | Mid to High |
| Jialeshui | 21.987722, 120.845982 | SE | ENE/E/SE/SSE | W | Mid |
| Nanwan | 21.959292, 120.762598 | S | S/SE/SSW | N/NE | Low to Mid |

The Jialeshui figure supersedes an earlier guess of 22.05, 120.90 — that was
~8 km out. Never approximate a coordinate; the grid node it picks changes.

The other 39 spots still need theirs. Method: open
`swelleye.com/en/surf-spots/<slug>/`, take lat/lng from the page source and the
infographic from the page body. Harvest both in the same pass — the
infographic is what makes per-spot reasoning possible at all.

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

## Conventions

- Metric throughout: metres, seconds, m/s, °C. Never feet or knots.
- Times are Asia/Taipei local, no timezone suffix stored.
- UI: white background, black text, single light theme (no dark mode — removed
  on request). Rounded components, Coinbase-ish: 24px cards, 16px tiles, pill
  buttons. Plus Jakarta Sans for UI, Newsreader serif for Capy's own notes,
  IBM Plex Mono for readings. Teal accent `#0E7C86`.
- Notes are rich text with a markdown-ish `- ` shortcut for bullets. Capy writes
  notes in Chinese; don't break CJK handling.
