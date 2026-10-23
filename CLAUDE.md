# Surflog

A surf journal. Log a session (spot + date + time + notes) and the
wave/wind/tide conditions for that moment get attached. The point: after
enough sessions, spot which conditions produce good surfs at which breaks.

Started as a personal journal for Capy (a doc nickname; the user is Avery).
Since 2026-09-18 a shared platform: anyone signs in with Google and gets a
private journal. Nothing aggregates across users (one exception: spot
reviews).

Compacted 2026-10-16 (before that 2026-10-08). Every dated decision and
earlier wording is in git: `git log -p -- CLAUDE.md`. Dates below are when
something was decided or last checked. Pixel-level layout lives in the
components and their header comments; this file keeps decisions, don'ts
and what is unverified.

## Status

- Next.js (App Router) + shadcn/ui + Supabase (Postgres + Storage), Google
  sign-in via Auth.js. Public repo `github.com/avery710/surflog`.
- **Deploy** (SURFLOG-8, done 2026-10-21): two environments in one Vercel
  project. `main` → `.github/workflows/deploy-production.yml` → Vercel
  **Production** at `surflog.tw` (`www` redirects) on the original Supabase
  project (`tosozexlcqedocfcckwh`, real data). First production deploy
  2026-10-21 (`443068c`; `main` was fast-forwarded to `staging`);
  `surflog.tw` was matched to that deployment by asset fingerprint, **not
  yet checked signed in**. `staging` → `.github/workflows/deploy-staging.yml`
  → Vercel **Preview** aliased to `stag-wipeout.surflog.tw`
  (`STAGING_DOMAIN`; CNAME at GoDaddy) on a separate **empty** Supabase
  project (`traxhjhcvtonqrgfpcqk`; its `photos` bucket not checked). Copying
  production's data was declined. In Vercel, Preview has its own
  `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AUTH_SECRET` and
  `SIGNIN_ALLOWED_EMAILS`; Production keeps the originals plus
  `SPOT_ADMIN_EMAILS` (set by Avery, not read back). The staging workflow
  refuses `STAGING_DOMAIN` = `surflog.tw`. **Release flow**: push
  `staging`, check it, then fast-forward `main`
  (`git push origin staging:main`), which deploys production. **Vercel
  Authentication is on, Standard Protection** (2026-10-21): every URL except
  the production custom domains needs a Vercel login, so staging,
  `surflog-staging.vercel.app` and all `surflog-<hash>….vercel.app` URLs
  (production's included) 302 to `vercel.com/sso-api`, while `surflog.tw`,
  `www` and `surflog.tw/api/mcp` stay public (checked anonymously). **Never
  pick "All Deployments"**: it locks `surflog.tw`. Only Avery passes the
  wall (Hobby: plus one approved external user, Shareable Links, or a
  bypass secret; none set up), and a browser logged into Vercel passes it
  silently. Behind it, staging still needs Google sign-in with an email in
  `SIGNIN_ALLOWED_EMAILS`. It blocks AI-app OAuth callbacks and any other
  server-to-server call to staging. **Stale alias**:
  `surflog-staging.vercel.app` points at deployment `surflog-a43wdfil6`
  (2026-10-12), built before the split with **production's database** and
  no allowlist; it is behind the wall, but deleting that deployment (and its
  Google redirect URI) is still recommended. CLI: for staging pass `STAGING_DB_PASSWORD` from `.env.local`
  and clear `SUPABASE_DB_PASSWORD` (sourcing the file loads the prod one,
  which overrides `-p`), then relink to prod. `gh` is logged in; the Vercel
  MCP connector has no access to the team (403), so Vercel logs/env come
  from Avery. README "Deploys: production and staging".
- **Function region `hnd1`** (Tokyo, `vercel.json`, 2026-10-21): was the
  default `iad1` (live header `hkg1::iad1`) while production Supabase is in
  `ap-northeast-1`, so every query crossed the Pacific. Staging Supabase is
  in `ap-southeast-2` (Sydney), still far; recreating it in Tokyo (it is
  empty) was suggested, not decided. Not yet checked on a deploy.
- **Page switches** (2026-10-21): `loading.tsx` skeletons for `/spots`,
  `/spots/[slug]`, `/ai-apps`, `/admin` (`components/page-skeleton.tsx`);
  `/` uses a Suspense fallback inside `app/page.tsx` instead (a root
  `loading.tsx` would also cover the landing and every route). The `/spots`
  page lives in the `app/spots/(list)/` route group so its skeleton doesn't
  also wrap `/spots/[slug]` (it did: the list skeleton showed before a spot
  page). Each skeleton mirrors its page's blocks, measured to within ~1 px at
  375 and 1100 px; data-sized cards use Avery's journal. Bars are black at
  7%; the skeleton body fades in after 120 ms, bars pulse, and the real page
  column fades in over 150 ms (`.page-enter`); all off under reduced motion
  (classes in `globals.css`). Suggested by the ui-designer agent, items 1–5. Home and
  spot-page queries all start at once (one Supabase round trip); the spot
  page reads only that spot's sessions (`listSessionsAtSpot`). Not done:
  router cache `staleTimes` (would show stale pages after writes) and view
  transitions. Checked signed in on localhost dev only.
- **Keep both databases awake** (2026-10-21): a Vercel Cron job
  (`vercel.json`, daily 03:17 UTC; Hobby fires sometime within that hour) on
  **production** calls `/api/cron/keep-awake`, which calls each
  environment's `/api/health` (`HEALTH_CHECK_URLS` in `lib/health.ts`:
  `surflog.tw` and `stag-wipeout.surflog.tw`); each reads one `spots` row
  from its own database, so neither free Supabase project pauses after 7
  idle days. Vercel runs crons on Production only, hence production calls
  staging over HTTP (a GitHub Actions schedule was built first and replaced
  on request). The cron route 401s unless `CRON_SECRET` (Vercel Production
  env) matches, answers `{ production, staging }` (502 if either is false),
  and sends `VERCEL_AUTOMATION_BYPASS_SECRET` if the project has one. It
  never follows redirects and counts only a 200 `{ ok: true }`, so the
  staging login wall's 302 reads as `staging: false`. **Staging needs
  Protection Bypass for Automation turned on** (then redeploy production),
  or its ping always fails. `/api/health` is unsigned and answers only
  `{ ok }`. **Not live until released to `main` and `CRON_SECRET` is set.**
  A paused project doesn't wake from requests: restore it in Supabase.
- **The original**: a Claude artifact
  (`https://claude.ai/artifact/Bs9xqTtE8Yj1mqPopK8evM`, source
  `reference/surf-journal.html`), conditions typed in by hand.
- `BACKLOG.md`: Avery's list, **local only, gitignored**, kept by the
  `add-ticket` skill (short lines; details belong here).
- `VALIDATION.md`: spot-fit experiments. Read it before changing
  `lib/spot-fit.ts`.
- **Migrations**: every file in `supabase/migrations/` is applied to both
  Supabase projects (production's last one, `20261021000000` session
  duration, on 2026-10-21; the avatar and pin ones were already there).
  Apply to staging first, then production, with the CLI linked to the
  right project.
- Never tried on a real phone. Most "not verified" notes below still stand.
- In the repo but not described here: spot **edit** requests
  (`lib/spot-edit-*.ts`, `app/api/spot-edit-requests`, migration
  `20261008100000` applied, reviewed on `/admin`), the `security-auditor`
  agent. Read the code.

## The automation problem (why Open-Meteo)

Don't re-derive this.

- **Swelleye has no API.** It is the Taiwan forecast Avery pays for (PRO):
  client-side table in an iframe from a private endpoint, 9 days forward,
  2-hourly, directions as arrows (~half a compass point), one swell train,
  41 Taiwan spots.
- **Its numbers are not spot-adjusted** (Nanwan, S-facing, and Jialeshui,
  SE, on the same E swell: 1.0 vs 1.1 m; Open-Meteo 1.06 vs 1.12). Its
  spot knowledge is the **Spot Infographic** (facing, best
  swell/wind/tide), which is in the `spots` table.
- **Never scrape `api.swelleye.com` or reuse the PRO cookie** (fragile,
  against their terms). Scheduled browser automation was also declined.
- The artifact sandbox blocks outbound network, hence this repo.
- **Decision 2026-09-25: Open-Meteo is the sole conditions source**,
  fetched server-side at save time: one source that fills every session
  the same way (past dates, overseas) beats a maybe-better one typed in
  sometimes. Typing Swelleye numbers into `cond` is no longer routine.
  **Exception: tide**, where CWA wins whenever it has events.

## Data sources

### Open-Meteo (`lib/openmeteo.ts`)

`https://marine-api.open-meteo.com/v1/marine`, no key, global: primary +
secondary swell, wind-wave split, directions in degrees, hourly.

- **Wind is not in the marine endpoint**: use the forecast/archive weather
  API and **always pass `wind_speed_unit=ms`** (default km/h). Check any
  new variable's unit in `hourly_units`.
- **Resolution**: five Yilan points over ~20 km returned byte-identical
  data (one grid node, possibly ~10 km off; `gridLat/gridLng` stored). It
  discriminates by day and region, not by break. Don't build UI as if
  each spot has its own forecast.
- **How far back** (2026-09-25): swell ~Oct 2021; sea level and sea temp
  ~Dec 2022; wind and air temp from 1940. Any date is accepted; older
  sessions get fewer tiles.
- **Tide from sea level**: `seaLevelM`, `seaLevelTrend` (centred
  difference, widening on a tie), `tideEvents` = turning points within
  ±14 h plus the bracketing pair, refined by a 3-point parabola
  (`findTideEvents`, `refineExtrema`; a flat run is one extremum at its
  midpoint; same-type neighbours merged). MSL datum, **not comparable to
  CWA's TWVD heights**, only rising/falling is. Timing ±~30 min.
  Open: `tideTrend()` treats a 7 cm dip in a mixed tide as "falling".
- **Water temp runs ~1 °C warm** vs CWA stations (−0.8 to +2.5 °C, worst
  north coast). Decision 2026-09-29: no offset (bias varies by spot).
  Revisit for winter north-coast sessions; fix would be CWA buoys
  (`O-B0075-002`, stations in `O-B0076-001`).
- **Wind speed** read 23–50% below Swelleye overnight/morning at Jialeshui,
  close from 08:00 (n=3 days, one spot). Unresolved; the strength label
  absorbs most of it.

### CWA tide (`lib/cwa-tide.ts`)

Dataset `F-A0021-001` on opendata.cwa.gov.tw, key `CWA_API_KEY`.

- **Keyed by township**, exact `LocationName` (`宜蘭縣頭城鎮`, not
  `頭城鎮`), stored per spot as `tideTownship`; several spots share one.
- Heights are `TideHeights.AboveTWVD`, **centimetres as a string**.
  `Daily[]` is **not sorted** — flatten and sort by `DateTime`.
- **Forward only (today + ~32 days).** `getTide()` is null unless the
  session sits between two forecast events. No per-event distance cap
  (mixed tides leave gaps up to ~17 h). Stored as `condCwaTide` with
  `events` (±14 h + the bracket).
- **Why CWA wins the tide tile**: Jialeshui 2026-09-26, CWA within 3–15 min
  of Swelleye/Windy; Open-Meteo 20–65 min early by a per-spot amount, so
  no fixed offset fixes it. Rising/falling never disagreed.

### Swelleye vs Open-Meteo (`npm run compare`)

`scripts/compare-sources.ts` + `lib/source-compare.ts` →
`reports/swelleye-vs-openmeteo.md` (untracked: it names session ids). Gap
score = mean abs diff ÷ the metric's `absLarge`; numbers first.

- Input: a full day of Swelleye's table in
  `data/swelleye-readings/<slug>/<YYYY-MM-DD>.json`, **gitignored** (paid
  data); Open-Meteo snapshotted beside it (delete to refetch).
- **A reading is taken on request only**, in Avery's logged-in Chrome, by
  the main session (`data-source-engineer` has no browser).
- 2026-09-25 Jialeshui: period 0.80 (worst), gust 0.48, wind speed 0.42,
  wind dir 0.38, tide timing 0.37, height 0.13, swell dir 0.00.

### Ruled out

Windy (terms forbid storing/deriving data); Stormglass (fine fallback, 10
req/day free, not needed); CWA marine forecasts (area-scale). CWA **buoy
observations** would be real ground truth; not built.

## Spot fit (`lib/spot-fit.ts`)

How a break's orientation and published preferences meet the offshore sea
state. **Computable, physically reasonable, NOT verified.**

- Kept: `exposure`/`incidenceDeg`, `inSwellWindow`, `windMode`,
  `offshoreness`, `tideBand`/`tideMatchesBest`, `junkRatio`.
- **`effectiveSwellM` is demoted — do not display** (cos(incidence)
  under-predicts ~25%; waves refract while shoaling).
- **No outcome variable exists to test it.** A 1–5 `rating` was built and
  **removed on request 2026-09-29 — don't re-add unasked** (the
  `sessions.rating` column remains, unread). Goal ticks are the only
  outcome-like field.
- Show fit as description, never a score. Today only the wind tile's shore
  word is fit-derived; `lib/spot-fit-descriptions.ts` is kept unused.

## Data model

Types `lib/types.ts`; reads/writes `lib/db.ts`; migrations
`supabase/migrations/`. **Apply a migration before code that reads its
column runs, even locally.**

```
Session {
  ownerId                // Google OIDC sub
  spot                   // spots.slug | "req:<id>" (pending request) | legacy "custom:…"
  when                   // "YYYY-MM-DDTHH:mm", local time AT THE SPOT, half-hour grid, no tz
  durationMin?           // 30-min steps, at most 4 h (240); optional
  notesHtml, notes       // sanitized rich text (lib/rich-text.ts) + plain mirror
  photos: [{ id, type }] // video/* renders as <video>
  boardId
  cond: null | { swellHeightM, swellPeriodS, swellDir, windSpeedMs, windGustMs,
                 windDir, tideM, tideNote, seaTempC, airTempC, sky,
                 source: "swelleye" | "manual", filledAt }
  condOpenMeteo: null | { swell*, secondarySwell*, windWave*, combinedWaveHeightM,
                 windSpeedMs, windGustMs, windDirDeg, seaTempC, airTempC,
                 seaLevelM?, seaLevelTrend?, tideEvents?: TideEvent[],
                 gridLat, gridLng, source: "open-meteo", fetchedAt }
  condCwaTide: null | { tideM, tideType, time, stationTownship,
                 events?: TideEvent[], source: "cwa", fetchedAt }
  goal_text, goal_met, goal_points_met   // see Goals
  createdAt
}
TideEvent = { type: "high" | "low", time, heightM }
```

- The three condition blocks stay **separate, never merged**.
  `condOpenMeteo` fills when the spot has coordinates, `condCwaTide` when
  it has a township; both refetch **only when the spot changes**, so a
  failed fetch has no retry. `cond` is manual only.
- **No future sessions** (2026-10-20): `createSessionFor` answers 400 for a
  `when` later than now at the spot + 15 min (`latestLoggableWhen()`, now + 15 min: the
  half-hour slot the form rounds to is still "now"); the log form caps the date and greys later
  slots; MCP goes through the same check. Before this, a future date saved a
  *forecast* as the session's conditions. Sessions already saved with a future
  date are left alone.
- **Time grid = every 30 min** (2026-10-20, by request; was 2-hourly, from
  Swelleye's table). `lib/time-slots.ts`. Open-Meteo is hourly, so a `:30`
  session reads the **nearest hour** (`:30` rounds up, `getConditions`); the
  tide bracket already works to the minute. Older sessions stay on even hours.
- **Duration** (2026-10-21, by request, instead of an end time): optional
  `sessions.duration_min`, same day only (never past midnight), and the whole
  session must be over (no future). **Fixed after creation like the date and
  time** (a different value on update is a 400; the edit panel shows it
  read-only). Open-Meteo is read over the hours it spans (the start's nearest
  hour through the last whole hour at or before the end); `swellHeightM` stays
  the start's reading, and `swellHeightMedianM` (inside `condOpenMeteo`, 2026-10-21)
  is the median over those hours. The swell tile shows that median as one figure
  (no range; falls back to the start reading), the card shows "10:00–12:30", and
  the tide chart draws the stretch you were out as one solid blue line (see
  "Tide tile" under UI). Share images show the
  time range and the start's swell reading, not the median. In the log form, while the start is still the untouched "now", a
  duration moves the start back so the session ends now.
- **Date/time are fixed after creation** (2026-10-16): a different `when`
  on update is a 400, an unchanged one is accepted.
- Tide bracket picking for both sources: `pickBracket()` /
  `windowAround()` in `lib/tide-bracket.ts`.
- **`lib/session-service.ts`** (`createSessionFor`, `updateSessionFor`,
  `deleteSessionFor`) is the only place sessions change; web routes and
  MCP both go through it.

**Boards** (`boards`: brand, `length_in`, `volume_l`, rocker, note,
`photo_id`, `is_favorite`, `sort_order`). `sessions.board_id` is `on
delete set null`. Any number of 常用 / go-to boards; `sortBoards()`
(`lib/boards.ts`) puts them first, `sort_order` within each group. The
log form pre-selects the last-used board (`preselectBoardId()`).
`PUT /api/boards/order` takes the full id list and 404s unless it is
exactly the caller's rack. `is_default` is unread, droppable.
`boardPhotoSrc(board)` resolves the photo (demo boards use `photoUrl`).

**Goals** (`goals`: one row per owner, `text` ≤200). Points are
newline-separated (`goalPoints()` / `joinGoalPoints()`, `lib/goal.ts`).
Each session **snapshots** the goal text with per-point ticks in
`goal_points_met`; always read through `sessionPointsMet()`.
`pointStats()` counts by **exact wording**, deliberately no fuzzy
matching. An AI "suggest a goal" button was deferred. **No Enter shortcut**
in the goal editor (clashed with 注音/倉頡 candidate selection); add
points with +.

**Spot notes** (`spot_notes`, PK `(owner_id, spot)`): one private note per
spot, edited in "What you've surfed"; empty deletes the row.

## Spots

**The `spots` table is the single source of truth** (2026-10-05), one
worldwide list maintained by Avery: 76 rows (41 Taiwan with Swelleye
fields + CWA township, 9 Siargao, 26 Bali).

- `lib/spots.ts` is types/helpers only. Server: `lib/spot-store.ts`
  (`listSpots()`, `resolveSpot(slug)`). Client: `useSpotCatalog()`
  (`lib/spot-catalog.tsx`), never a static import. `lib/spot-fixtures.ts`
  is an unsynced static copy of the Taiwan spots for places with no
  database (landing, `app/dev/`, the compare script).
- **Never copy spots from WannaSurf, Surfline, or the unlicensed GitHub
  gist.** Seeds are OpenStreetMap objects (credited in the migration).
  **Never guess a coordinate**: it changes the grid node.
- **Timezone per spot** (IANA); `when` is local at the spot. Every spot is
  UTC+8, so the timezone path is unproven. The activity calendar's "today"
  is still Asia/Taipei.
- **Admins** = emails in `SPOT_ADMIN_EMAILS` (`lib/spot-admin.ts`; unset =
  nobody; set in `.env.local` and Vercel Preview). Non-admins get 404 from
  admin routes and `/admin`.
- **Adding** (`AddSpotDialog`, `POST /api/spots`): coordinates, a Google
  Maps link, or GPS on tap. Refused within 100 m or same name nearby;
  100 m–1 km asks. A spot with sessions can't be deleted. Swelleye fields
  and CWA township are SQL only.
- **Requests** (`spot_requests`): anyone can request a spot and log
  against it at once (`req:<id>`, no conditions). Approving moves those
  sessions to the real slug and fetches conditions. Email to Avery on a
  new request is wanted, not built (`lib/spot-request-notify.ts` logs).
- **Picker** (`components/spot-picker.tsx`) and `/spots` share
  `lib/spot-browse.ts`. Group order: Siargao, Bali (`AREA_PRIORITY`),
  then alphabetical. "Near me" asks for location **only on tap**.
- **Harvesting Taiwan rows**: coordinates are the `lt=`/`ln=` params in the
  iframe `src` on `swelleye.com/en/surf-spots/<slug>/` (curl the raw HTML);
  `nameZh` is the `<title>` of the root-path Chinese page, never a hand
  translation; slugs aren't derivable from names. Taitung has no
  infographic; Shanshui (Penghu) is filed under West.
- **Reviews** (2026-10-08, `spot_reviews`, migration `20261008200000`
  applied; `components/spot-reviews-dialog.tsx`,
  `GET/PUT/DELETE /api/spots/:slug/reviews`): 1–5 stars required, comment
  ≤1000, one per user per spot (posting again replaces). **Shared with
  every signed-in user**, the one deliberate cross-user exception; others
  see only display name, avatar, rating, comment, date (`toPublic()`,
  unit-tested). Admin can delete any review. Google-Maps style: form until
  you've posted, then yours first ("You" tag) with Edit / Delete.
  `author_image` is a snapshotted https URL; until migration
  `20261009000000` is applied the list shows initials. Not checked in a
  browser.
- **Pins** (2026-10-09, `spot_pins`, `lib/spot-pins.ts`,
  `PUT`/`DELETE /api/spots/:slug/pin`): private, max 50, a "Pinned"
  section atop `/spots` (oldest first; spots also stay in their groups),
  optimistic with rollback. Not in the log-form picker. Until migration
  `20261009100000` is applied, toggling says "not switched on yet". Not
  checked in a browser.
- **Spot page** `/spots/<slug>` (`components/spot-detail.tsx`): Pin, "Log
  a session here" (`/?log=1&spot=<slug>` → `presetSpot`), About (Suggest
  an edit for non-admins), "Your sessions here" (own data only, private
  note editable), Reviews inline. Linked from `/spots` rows and "What
  you've surfed" (whose "Share as review" opens the review dialog with the
  note copied in). Not built: nearby spots, per-session pages. Preview
  `/dev/spot-detail`; not checked signed in.
- Never exercised on live data: create/edit/delete a spot,
  send/approve/decline a request, the non-admin view, "Near me".

## Multi-user, auth, storage

- **Google sign-in via Auth.js** (`auth.ts`, `proxy.ts`), JWT sessions, no
  adapter, **no allowlist** by design. **One opt-in exception for staging**
  (2026-10-21): `SIGNIN_ALLOWED_EMAILS` (comma-separated, `lib/signin-allowlist.ts`,
  checked in the `signIn` callback of `auth.ts`) restricts sign-in to those Google
  emails; **unset = open** (production). Set it in Vercel **Preview** only. Checked
  at sign-in only, so an older cookie survives until it expires. Unit-tested; **not
  tried with a real Google sign-in, and not yet set in Vercel**. Staging can also sit
  behind Vercel Authentication (Deployment Protection), which blocks AI-app OAuth
  callbacks. Identity is
  `account.providerAccountId` (Google `sub`) — **never `user.id`** (a
  random UUID per sign-in). An empty journal in an old browser: check
  `/api/auth/session` for a UUID id, then sign out and in.
- **Every row carries `ownerId`; every route checks it and answers 404,
  not 403**, for a foreign id.
- **RLS on with no policies, deliberately**: the server uses the secret key
  and does its own ownership checks (README "Setting up Supabase").
- Ownerless imported data goes to an explicit account, never "whoever
  signs in first".
- `proxy.ts` gates everything; unsigned paths are exact rules: `/`,
  `/landing/<name>.jpg|.webp` (lower-case), `/api/mcp`, `/api/health`, `/api/cron/keep-awake`, the OAuth
  discovery/register/token routes, the three share path shapes. `/dev`
  only outside production.

**Uploads** (`lib/blob.ts`, `lib/upload-client.ts`): `POST /api/uploads` →
signed URL → browser PUTs straight to Storage → attach with `{ uploadId }`.
**Never send file bytes through a route, either way** (Vercel's 4.5 MB
body cap). `registerUpload()` checks what landed: ≤50 MB, image/video
only, claimed once. Photos over 2560 px / 3 MB are redrawn in the browser;
videos over 16 MB re-encoded (`lib/video-compress.ts`, mediabunny),
falling back to the original. Serving: images ≤4 MB via `/api/blob/:id`
(owner-checked, year-long private cache), else 302 to a 1-hour signed URL.
Attach/delete run **one request at a time** (the route rewrites the photo
list). Deleting a session/photo/board photo frees storage; never-attached
uploads are orphaned (no clean-up). Media is added/removed in the log form
and edit panel (`components/media-picker.tsx`, max 10, staged until
Save), not on the card.

## MCP and AI apps

A user connects an MCP client to their own journal via `/api/mcp`.
**Both auth routes stay — don't remove either unasked**: OAuth for chat
apps, personal tokens for anything that can't open a browser.

- **Page** `/ai-apps` (`/agents`, `/tokens` redirect; API routes keep the
  `tokens` name). Wording is "AI app", not "agent"; zh-TW keeps "AI App" /
  "Agent" in English, never 代理. `components/connect-agent.tsx`: one row
  of tiles (Claude, ChatGPT, Gemini, Others). **The tile decides OAuth vs
  token, never the user.** Connected tiles carry a ✓
  (`connectionMatches()`); taken names are numbered (`uniqueName()`).
  Avery was advised not to add tiles until existing ones are confirmed.
- **Tokens** (`lib/token-auth.ts`, `api_tokens`): `sfl_` + 32 random
  bytes, shown once, SHA-256 stored, scope `read`/`write`, 10 active per
  owner. **Token management is cookie-session only** — a leaked token must
  never mint or list tokens.
- **OAuth** (`lib/oauth.ts`): authorization code + PKCE (S256), public
  clients, open dynamic registration (rate limited, ≤20 redirect URIs).
  Access tokens are `api_tokens` rows; access 1 h, refresh 60 days
  rotating. Consent at `/oauth/authorize`. **Never truncate, trim or
  re-encode a value that belongs to the other side of a protocol** —
  cutting `state` to 500 chars broke Gemini. Not built: client secrets,
  revocation endpoint, cleanup of old rows.
- **Endpoint**: Streamable HTTP, stateless, `mcp-handler` 2.x +
  `@modelcontextprotocol/server` 2.x (`registerTool` with a full
  `z.object`). **The route's own bearer check is its only protection.**
- **Tools** (`lib/mcp-tools.ts`): read — `list_sessions`, `get_session`,
  `list_spots`, `list_boards`, `get_goal`; write (not registered for a read
  token) — `create_session`, `update_session`, `delete_session`,
  `set_goal`, `clear_goal`. Choices to change if they bite: `when` on the
  half-hour grid on create, **no `when` in `update_session`**; `notes` plain
  text and `update_session` **replaces the whole note**; catalogue slugs
  only; `goalsAchieved` must match the goal word for word; no media,
  boards or spot admin. Tool descriptions say notes are untrusted text.
- **Rate limit** (`lib/rate-limit.ts`): 120 req/min, 60 writes/10 min per
  owner, **in memory per instance** — a brake, not a quota.
- `/admin` Connected services table: counts only, no user named.
- Confirmed by Avery: claude.ai, ChatGPT (Plugins → custom MCP server,
  free plan), Gemini. Never tried: Claude Code, Codex, Cursor, Claude
  Desktop, the mobile app.

## Sharing a session

Card ⋯ → Share → `components/share-dialog.tsx`: generated images (Sticker /
Card) and a public link.

- **Images**: element + layout `lib/share-element.tsx` (pure, browser-safe),
  PNG `lib/share-image.tsx` (next/og / satori), data
  `lib/share-card-data.ts` (card rules, `lib/tide-display.ts`, CWA-first).
  Sticker = transparent with a dark plate; Card 1080×1350; `og` 1200×630
  for link previews only. **Never goal ticks.** Notes wrapped by
  `lib/share-text.ts` (estimated widths). Fonts (`lib/share-fonts.ts`):
  TTF subsets from Google Fonts at runtime; unreachable → 503, no fallback.
- **Public link** (`session_shares`, `lib/session-share.ts`): off by
  default; on = a row with a 32-byte token **stored plain** (owner must be
  able to copy it again); off = row deleted, link 404s at once. Public
  functions return only `PublicShare` (`lib/share-public.ts`), built field
  by field; a test asserts the allow-list. `/s/<token>` does **not** reuse
  `EntryCard` (it takes a full Session).
- Owner routes are cookie only, never bearer. `/api/blob/:id` stays
  owner-only; shared media via `/api/share/<token>/media/<id>` (15-minute
  signed URLs).
- **Caching**: page `force-dynamic`, `card.png` `no-store`, media
  `private, max-age=60` — a shared CDN copy would outlive "turn off".
- Per-IP limits in `proxy.ts`; unknown and turned-off tokens give the same
  404. No per-app deep-link buttons, by decision.
- Strings: `lib/share-strings.ts` (server copy of `lib/i18n.tsx` keys; a
  test fails on drift).
- Dialog: left-aligned at every width; its `DialogContent` needs
  `grid-cols-[minmax(0,1fr)]` or it drifts off-centre on phones.
- Not verified: the buttons on a phone, a session with notes/media on the
  public page, Instagram paste, chat-app link previews, anything on staging.

## UI

**Session card** (`components/entry-card.tsx`):
- **Order** (2026-10-16, after several flips on request): header, board
  chip + goal pills (one flex-wrap row when they fit, else goals wrap
  beneath; CSS only, `GoalSection` `inline` prop; never a stem between
  chip and goals), notes, condition tiles, media. Missing parts drop out.
- **Media** (`MediaMosaic`, Strava-style): full card width, capped
  **260 px tall** (needs `w-full` + `max-h-[260px]`). 1 item 16:9, 2
  halves, 3 columns, 4 a 2×2, 5+ big cell + 2×2 with "+N". A single item
  sits beside the tiles from `sm`. Cells open
  `components/media-viewer.tsx` (black full screen, slide/swipe/←→, zoom
  for photos, no pinch; slide, swipe, zoom and focus return not checked).
- **Tiles**: Swell · Period · Wind · Water temp · Tide; 3-column grid below
  `sm`, one row from `sm`; missing ones left out. Big figures (`Figure`,
  `components/condition-tile.tsx`) are 20 px **mono — keep them mono**. No
  hover tooltips.
- **Open-Meteo wins over typed numbers**: the manual `cond` row shows only
  without `condOpenMeteo`. Nothing is deleted from `cond`.
- **Wind tile**: speed + strength label, arrow + compass + shore word
  (needs `facing`). **Gust not displayed** but feeds the label: Beaufort
  bands on the **midpoint of speed and gust** (`lib/wind-strength.ts`, our
  own rule). zh-TW plain words, not official Beaufort terms: 無風 / 微風 /
  輕風 / 中等風 / 偏強風 / 強風 / 疾風 / 大風.
- **Tide tile = direction + next turning point, not a height**
  (`tideTrend()`), plus a day chart (`components/tide-chart.tsx`). CWA when
  `condCwaTide.events` is non-empty, else Open-Meteo; label plain "Tide".
  **Chart look** (2026-10-21/23, by request, after three poster references; history
  in `.claude/agents/ui-designer.md` "Style references"): the session is the one
  blue thing on the curve (`--primary`): with a duration a solid line **as thick as
  the curve** with **flat ends** that meet the grey flush (the grey is cut where the
  span is; no halo, no end dots; drawn at least 8 px long so 30 min still reads as
  a line); without one, a single blue dot (r 3.4). The curve is **2.25 px,
  light grey `--tide-curve` #b8c2c4** (its own token, picked lighter on request; the
  2026-10-21 "spotlight" dimming was dropped 2026-10-23), drawn as separate runs
  with **round ends** (outer ends and both sides of every label gap; no mask). The
  low and high either side of the session are timed **inside gaps cut in the
  curve, bending with it** (`<textPath>` on a copy of the curve with 60% of its
  bend removed and 0.6 px letter-spacing, so digits don't crowd on a tight bend;
  `--muted-foreground` text, Funnel Sans 9 px like the tiles' small print (2026-10-23; was 8.5 px mono), 5.2:1 on the tile; no dot, no label above/below).
  Layout, gaps and runs live in `components/tide-labels.ts`, shared with the dev
  copy; every drawn number is rounded to 0.01 (`r2`) because `Math.cos` differs in
  the last digit between Node and the browser (that was a hydration error). Candidates kept at `/dev/tide-span`,
  `/dev/tide-blue` (incl. waves iterations) and `/dev/tide-display`; their chart
  copy is `app/dev/tide-span/base.tsx`. Checked only on dev pages, **not on a
  real card with a duration, not on a phone**.
- **Water temp** `condOpenMeteo.seaTempC`, air temp as small print.
- Header: spot + date, ⋯ menu **Edit / Share / Delete** (delete confirms in
  a dialog); `readOnly` drops the menu (landing).
- **Necks** (`components/pill-neck.tsx`, `components/tile-group.tsx`
  measured with `ResizeObserver`): grey stems joining chip photo/name,
  neighbouring tiles, goal pills. The board chip's stem SVG must stay its
  **first child**.
- **Edit panel** offers only fields the card shows; other `cond` values
  ride along. Date/time read-only; "Refresh conditions" and the
  `refreshConditions` flag were removed 2026-10-16.
- Preview `/dev/session-card`: every media count × 375 / 700 / 1100 px in
  real iframes (`frame/`, height by `postMessage`) because `sm:`/`lg:`
  follow the window. Cases in `media-cases.ts`.

**Dashboard** (`components/journal.tsx`): white cards directly on the grey
page, `gap-2 sm:gap-3` (phones also tighten card padding and gutters).
Row 1 goal card + activity calendar, row 2 "What you've surfed", row 3
board rack. `app/dev/dashboard/page.tsx` mirrors this markup — keep in
sync. The landing's dashboard mirror still has the old `gap-4` spacing.
- **"What you've surfed"** (`components/patterns-table.tsx`): `table-fixed`
  at every width, header always visible, **vertical scroll only, never
  horizontal** (names and notes wrap); "Jialeshui" just fits at 320 px.
  Height animates (`components/animated-height.tsx`, `NoteField`; the card's fill, radius and **shadow sit on the `AnimatedHeight` wrapper**, because its `overflow:hidden` mid-ease clips a child's shadow and makes it flash; that arrangement is the shared `WhiteCard` (`components/white-card.tsx`), also used by the board rack and spot-detail sections; use it for new white cards,
  coordinated via `data-height-anim`; off under reduced motion; never
  watched in a visible tab). Share icon tooltip is portalled to `body`. A
  stacked phone layout was **reverted on request 2026-10-16 — don't bring
  back**.
- **Activity calendar**: its header comment is the source of truth.
  Sunday-first week rows, "Days in the water". Below `sm` at full width
  it also shows the last session (`LastSession`) as **its own white card beside
  the calendar card** (2026-10-17, by request; it used to share the calendar's
  card behind a divider), same height, 8 px gap; at 320 px it is 90 px wide and
  its title wraps to two lines.
- **AI app card** (`components/ai-app-card.tsx`): only while the owner has
  no un-revoked token (`hasConnectedApp()`, fails soft to hidden); beside
  the calendar, goal card on its own row below `lg`.
- **Board rack** (`components/board-rack.tsx`, height eased by `AnimatedHeight` like the patterns table, surface on the wrapper): 常用 via ⋯ (badge also
  removes it). **Reorder** mode makes the whole card the drag surface
  (dnd-kit, **one** `SortableContext`; cross-group drops snap back).
  Reorder and 常用 are optimistic with rollback. Square photos use an
  absolutely-positioned `<img>` in a wrapper — a stretched `<img>` blows
  up in WebKit.
- **Session list: paged by the database, infinite scroll** (2026-10-17):
  `GET /api/sessions?page=N[&pageSize=M]` (`lib/db.ts` `listSessionsPage`,
  10 per page, max 50, page clamped, ordered `session_when`, `created_at`
  desc, `id` — the same order as `compareSessions` in
  `lib/session-stats.ts`). The server page loads the first 10 in full plus
  `listSessionStats()`: **every** session as a slim row (`SessionStat`: date,
  spot, board, goal ticks, no notes/photos/conditions), which is all the goal
  card, calendar, spot table and log form read. `lib/use-session-feed.ts`
  owns both lists; `SessionList` has a sentinel (400 px ahead) that calls
  `loadMore`. **`loaded` is always rows 0..n-1**, so the next fetch is
  `pageToFetch(loaded.length)` (the page starting at or before the first
  unloaded row; `mergePage` drops repeats). A delete therefore re-fetches the
  page it shifted; a create joins `loaded` only if it ranks inside it
  (`addToLoaded`); a fetch in flight during either is discarded. No `?page=`
  on the homepage (a numbered page switcher was built first, then dropped
  for infinite scroll; the API kept the page params). The calendar's phone
  panel gets the newest session in full as `latest`. Checked in the built-in
  browser on a temporary `/dev` page with a fake `fetch` (scroll to the end,
  delete mid-scroll: nothing skipped or repeated); **not checked against real
  Supabase, a real sign-in, a phone, or a failed load / Try again.**
- **Session filter** (2026-10-17): a chip bar under the "Sessions" title
  (`components/session-filter.tsx`; Avery picked it over a panel, a
  toolbar, a dialog and presets-only): **Date · Spot · Board** chips, each
  opens a radio menu. **Icon-first look** (picked 2026-10-17 from nine: filled,
  outlined, soft tint, dark, underline, tiles, segmented, icon-first, dot): unset
  is a small round grey icon button with a tooltip (`Tooltip`, aria-label =
  its name); set it grows into a solid blue pill with the value and a chevron,
  and Clear appears. **It is one element that morphs** (fill crossfade + the
  value/chevron in a `0fr`↔`1fr` grid column, 200 ms ease-out; the last value
  is kept while it closes); Clear, the custom-range row and the count fade in
  (entry only); all off under `prefers-reduced-motion`. The chips tried the "+" button's water hover and it was
  **removed on request 2026-10-17: don't add it back unasked** (hover is a
  slight darkening of the idle chip). Measured on the real
  page: 28→96 px open, 96→28 px shut. Date menu = All time / Last 30 days / Last 3 months / This year
  (open-ended `from`, `datePresets()` in `lib/session-filter.ts`, today in
  Asia/Taipei; also Last 3 days / Last week = 7 days) / Custom range… (exact From / To under the chips). From `lg`
  the chips sit on the title's line, right-aligned; chips are 28 px high, `text-[13px]`, 14 px icons — the same size as the board rack's 常用 badge (2026-10-17, by request; the badge's name row is `leading-7` to match); the
  match count is a small grey badge after the title (option B of 8; not its own line); the
  chip menus are `min-w-[150px]`. **Board chip icon is lucide `WandSparkles`**
  (a magic wand, picked 2026-10-17 over sun, drawn surfboards, a flying
  broom and ~30 others; `Waves` was the original). The filter goes to `GET /api/sessions` (`spot`, `board`,
  `from`, `to`; bad values ignored, `countSessions` and `listSessionsPage`
  take it), so infinite scroll pages the filtered list; changing it empties
  `loaded` and the sentinel loads page 1 (`setFilter` in
  `lib/use-session-feed.ts`). The filtered count comes from the slim list
  (`matchesFilter`) and shows only while a filter is set. The dashboard (goal,
  calendar, spot table) is never filtered. A session edited out of the
  active filter leaves the list; a new one joins it only if it passes. Spot
  options are only spots you have sessions at. **Kept lists** (2026-10-17):
  switching filters keeps the list you leave for `FILTER_CACHE_MS` = 60 s
  (the infinite query's `gcTime`, counted from leaving it), so going back is
  instant and scrolling resumes; any create/edit/delete/board/goal change
  here clears all kept lists, so only changes made elsewhere (another tab,
  MCP) can be up to a minute old. The list on screen is never auto-refreshed.
  The no-library choice was reversed the same day on request: see
  **Client data fetching** below. Checked in the built-in browser
  on a temporary `/dev` page with a fake `fetch` (Last 30 days, scroll to the
  end, 1280 and 375 px layout); the Spot / Board menus and Custom range were
  only tried in an earlier panel version, **not in the chip bar, not against
  real Supabase, not on a real phone.**
- **Client data fetching = TanStack Query v5** (2026-10-17, by request;
  `@tanstack/react-query`, `components/query-provider.tsx` in the root layout,
  one client per page load, defaults `retry: false`,
  `refetchOnWindowFocus: false`). **Reads only**: the session list
  (`useInfiniteQuery`, key `["sessions","list",<filter params>]`,
  `staleTime: Infinity`), the latest session, a spot's reviews
  (`["reviews",slug]`, refetched on each open), a session's share link
  (`["share",id]`, refetched on each open) and the `/ai-apps` token list
  (`["tokens"]`, `initialData` from the server, `gcTime: 0`, 4 s
  `refetchInterval` while an app tile is picked, 10 min max). **Writes stay
  plain `fetch`** and write their result into the cache with `setQueryData`
  (no `useMutation`). The journal seeds its unfiltered list from the server
  on every mount (`seedLists`) and drops older lists. Session mutators
  `cancelQueries` first (synchronous in v5: the in-flight page is rolled back
  and its rows dropped), then rewrite the list as one page, so `loaded`
  stays rows 0..n-1. Pages may overlap; `flatten` merges them with
  `mergePage`. Server-rendered data (stats, boards, goal, spots) is not in
  the cache. Checked in the built-in browser on a temporary `/dev` page with
  a fake `fetch` (scroll to the end, delete during a page load, switch filter
  and back within 60 s); **not checked: the 60 s expiry, reviews, share link,
  token polling, real Supabase.**
- **Date picker** (2026-10-17, `components/date-picker.tsx`,
  `lib/calendar-grid.ts`): the one date field in the app, a Radix Popover
  month calendar (Sunday-first, en / zh-TW, fixed 6 rows) replacing the
  browser's native picker (`DateField`, deleted). `size` "md" = an Input-sized
  box with no icon (log form: not `clearable`, `today` = the chosen spot's
  today); "sm" = 28 px with an icon (filter From / To, `min`/`max` grey out
  days, × and Clear). Checked in the real log dialog (opens, picks, closes,
  nothing saved); **keyboard arrow navigation between days is not built**
  (Tab works), and it's unchecked on a phone.
- Goal card counts show only the number (`✓ 3`), full text `sr-only`.
- **Goal placeholder** ("Add a technique goal…") sits flush with the card
  title (no horizontal padding; 2026-10-21, by request). **Empty session
  list** ("Nothing logged yet"): plain text, **no card**, flush with the
  "Sessions" label, 15px bold title + 13px description like the AI app
  card (2026-10-21, by request; the 20 px / card version was replaced).

**Header**: solid `bg-primary`, sticky, hides on scroll down
(`lib/use-auto-hide-header.ts`, not under reduced motion).
`components/site-header.tsx` (sub pages) duplicates the journal header's
classes — keep in step. White controls and focus rings on the blue. **The
wordmark stays black, by request.** The "+" is Avery's own mark
(`LogIcon`), one component (`components/add-button.tsx`) with a
**water-wave hover inside the circle; the glyph never moves** (variant 3c,
damped spring `useWaterSpring`, constants in `step()`; never watched
running). Halo, band-beneath and bobbing variants were dropped; others
stay at `/dev/add-button`. Every page uses **`PAGE_COLUMN`**
(`lib/layout.ts`) — change the width there only.

**Footer** (`components/site-footer.tsx`, root layout, 2026-10-16):
full-width `bg-primary` banner, **one layout at every width** (approved;
the centred phone stack was dropped): white wordmark + "© year Surflog"
left, icon-only mail circle right to `mailto:support@surflog.tw`
(`SUPPORT_EMAIL`, address only in `aria-label`). `mt-auto` pins it on
short pages. Every page (header + content) sits in a `min-h-dvh` box in the
root layout (2026-10-21, by request), so the footer always starts below the
first screen, also while a page or skeleton loads; `/signin` and the OAuth
consent now centre in the full screen. No Privacy/Terms links until those pages exist. The public
share page's own muted line above it may read as doubled. The Google
consent screen's support email is set in Google Cloud, not here.

**Landing** (`components/landing/landing.tsx`, signed-out `/`; preview
`/dev/landing`): 01 conditions, 02 dashboard, 03 AI app, 04 spot list, 05
sharing. Real components on synthetic data
(`components/landing/demo-data.ts`) — never `lib/db.ts` or the API.
`/signin` stays separate. Copy claims only what exists. 03 is one static
conversation **Avery edited line by line — keep it**. 04
(`spots-showcase.tsx`): three static mocks (request, review, suggest an
edit) under the live spot count. 05 (`share-showcase.tsx`): the three
sticker WebPs in `public/landing/`, unlabelled, on a checkerboard;
**re-run `npx tsx scripts/landing-share-images.ts` when the share images
change**. **Licence NOT settled** for the demo board photos: Haydenshapes
is CC BY-SA 4.0 (credit present); Wavestorm is the maker's "All Rights
Reserved". The closing CTA (2026-10-16) has a looping video background
(`cta-video.tsx`, `public/landing/cta-waves.mp4`): Avery's "IMG_5420 2" clip,
cropped to a 3:2 band just above the horizon, rotated 0.58 degrees to level the (handheld, sloping) horizon, and re-encoded as **10-bit HEVC
HDR with the original HLG tags** (~5 MB, crf 20; every SDR re-encode looked
off in colour, and Avery asked for the original quality). HEVC is unsupported
in some browsers (poster stays). Checked at 320 / 375 / 768 / desktop: island
above the heading, text on water. White text on a dark shadow, white button,
no overlay. Lazy-loaded, paused offscreen, poster only under reduced motion.
`proxy.ts` lets `/landing/*.mp4` through. Not seen on a real phone or in Firefox.

**Tried and removed on request — don't bring back unasked**: the rating
field; CSV export; the spot-fit tag row; gust on the wind tile; hover
tooltips on figures; Funnel Sans for figures; a ticket-shaped card; tiles
butted with pinched corners; a divider above the notes; a transposed phone
calendar; the liquid-glass header pill and black header underline; the
second landing AI card; dark mode; a rack "default board"; the stacked
patterns table; submenu side flyouts. Details: `.claude/agents/ui-designer.md`
"Style references".

## Testing

**Use the cmux CLI to check UI changes, not only type-check** (Avery's
standing instruction). cmux's browser is signed in to the dev server.

- `cmux tree` lists surfaces. `cmux browser surface:N reload | wait
  --load-state complete | eval '<js>' | screenshot --out <png> | errors
  list | console list | click <css> | press Escape`. Measure with `eval` +
  `getBoundingClientRect()`. `cmux read-screen --surface <dev-terminal>
  --scrollback --lines 2000` reads the dev log.
- `viewport 375 850` emulates a phone; **always `viewport reset`**. The
  native pane is below `lg`; emulate 1280 for desktop. Wait ~1 s after a
  viewport change before measuring `ResizeObserver` things.
- **The tab is Avery's real data**: only reversible actions, undo every
  test change, clean up fake-owner rows and tokens (a past "cleaned up"
  claim was wrong — verify).
- Concurrent agents share tabs: open your own with `cmux browser open
  <url>`. Language is localStorage, shared per origin — switch it back.
- `/dev` tabs sometimes don't hydrate in cmux — check `window.next`.

**Built-in browser** (`mcp__Claude_Browser__*`) when cmux isn't running
(2026-10-16). **Not signed in**: real pages bounce to `/signin`, so check
on a `/dev/*` page or a temporary `app/dev/tmp-<name>/page.tsx` with a
fake user (**delete it afterwards**, the repo is public; stale
`.next/dev/types/app/dev/tmp-*` then fail `tsc` until `.next`
regenerates). `resize_window` `mobile` = 375, **always reset with
`desktop`**; the pane is ~800–1000 px. A new route may 404 once: navigate
again. Radix menus need `pointerdown`..`click` dispatched from
`javascript_tool`.

Both: native file pickers and `window.confirm` block automation;
synthetic hover doesn't apply `:hover`. Drive a file `<input>` with a
`File` in a `DataTransfer` + bubbling `change`. Fetch deleted photos with
`{ cache: "no-store" }`. **A hidden tab stalls** timers and uploads: check
`document.visibilityState` first.

- `npm test` (Vitest **4**; v5 needs `@types/node` ≥22), `tests/*.test.ts`,
  Supabase and sources mocked. `npm run lint` scans `.claude/` too: use
  `npx eslint app components lib tests`.
- `npm run dev` is `next dev --webpack` (Turbopack + `next/font/google`
  fails in dev; builds are fine).
- Shell is zsh: `set -- $var` doesn't split; quote `--include=*.ts`. `path` is tied to `PATH`: never use it as a loop variable (it broke `curl` mid-command).

## Bugs already hit — don't repeat these

- **A HEAD count query hides Supabase's error message.** `countSessions`
  uses `head: true`, and HEAD responses have no body, so a failure reads
  just `Supabase: ` (2026-10-21: a wrong Preview secret key looked exactly
  like this and took a while to find). If it bites again, put the HTTP
  status and code in `assertNoError`.

- **Open-Meteo wind in km/h stored as m/s** — pass `wind_speed_unit=ms`.
- **Rewriting a contentEditable while typing breaks Chinese IME.**
  `RichTextEditor` freezes its initial HTML at mount and skips emitting
  while `isComposing`. Never feed an uncontrolled editor its own output.
- **"Nearest reading" needs a maximum distance** (CWA picked an event days
  away for past sessions).
- **`user.id` is not Google's `sub`** (see Multi-user).
- **"Supabase: JWT issued at future"**, intermittent: `lib/supabase.ts`
  retries only that error (4 retries, ~4 s). After that it's a real
  Supabase incident.
- **Vercel's 4.5 MB body cap.** Safari's "The string did not match the
  expected pattern" means non-JSON from the server; parse errors with
  `.json().catch(() => null)`.
- **Notes sanitiser double-escaped `&<>`** (fixed 2026-10-06); notes saved
  before that with those characters are still double-escaped.
- **`cva` doesn't merge conflicting classes**: overriding a Button
  variant's `hover:bg-*` needs your own matching `hover:bg-*`.
- **`offsetTop` of a stuck `position: sticky` element** isn't its static
  position in Chromium.
- **A `max-width` flex child needs `min-w-0`**, or a wide descendant
  pushes the column past the viewport. Flex-wrap items in a `/dev` row
  need `min-w-0 max-w-full`.
- **An `overflow-auto` box only clips absolute descendants if it is
  positioned itself** (an `sr-only` header widened the journal on phones).
  Measure `document.documentElement.scrollWidth` with real-shaped data.
- **`scale: tan(atan2(100cqw, 1080px))` is wrong in WebKit.** Use SVG
  `viewBox` + `foreignObject`, or measure in JS.
- **`aspect-ratio` + `max-height` shrinks the width**: give the box
  `w-full`.
- **When moving or renaming a module, fix its importers in the same step**
  (the dev server 500s for everyone meanwhile).
- **dnd-kit hydration warning** (fixed 2026-10-16): its default
  `aria-describedby` id comes from a global counter that differs server vs
  client. Give every `DndContext` an explicit `id={useId()}` (goal card has
  two, board rack one).
- Artifact only: db snapshots are frozen (copy before adding `id`);
  `claude.use()` can hang (race a timeout); the db only answers inside
  Claude's artifact viewer.

## Localization

English and Traditional Chinese as used in Taiwan (`zh-TW`, never
Simplified). Avatar menu → Language; localStorage `surflog:lang`.

- `lib/i18n.tsx`: `DICT` of key → `{ en, "zh-TW" }` (a missing language
  fails typecheck), `useLang()` → `{ lang, setLang, t }`.
- **Every user-visible string goes through `t()`**, including aria-labels
  and alt text. `lib/` formatters take a `lang` param.
- Language is read with `useSyncExternalStore` (server snapshot `"en"`),
  not `useEffect` + `setState`.
- Not translated: units, source names, API error messages, user content.
- Terms: 浪點 spot · 湧浪 swell · 週期 period · 陣風 gust · 滿潮 / 乾潮
  high / low tide (CWA's, not 高潮) · compass points in CWA's form
  (北北東). Never translate a spot name by hand.
- Much zh-TW wording was written by the agent and is unreviewed.

## Project agents

`.claude/agents/` (Sonnet, except `push-stag` on Haiku). New agent files
load only when a session starts.

- **`data-source-engineer`**: Open-Meteo / CWA fetches, spot harvesting.
  No browser.
- **`localizer`**: translations, hard-coded strings.
- **`ui-designer`**: look and feel; its file holds Avery's style
  references. Has the built-in browser tools since 2026-10-16 (untested);
  if they don't load, visual checks stay with the main session.
- **`storybook`**: dev-only showcase pages under `app/dev/` on synthetic
  fixtures (`app/dev/fixtures.ts`), indexed at `/dev`. Real Storybook was
  declined. `app/dev/layout.tsx` 404s the tree in production (route
  handlers there must repeat the check). No photos; actions hit the real
  API and fail; width frames don't trigger `sm:`/`lg:`.
- **`push-stag`** (its file predates the staging/production split and still
  says staging is `surflog.tw` and shares the local database, so **read its
  migration step with care**: local `.env.local` and the CLI link point at
  production): commits and pushes to `staging` only, never main, never
  force; lint + typecheck first; keeps `.env*`, `reports/` and Swelleye
  readings out; asks before applying migrations; after the push watches the
  GitHub Actions deploy run with `gh run watch` (2026-10-23, now that `gh` is
  signed in) and reports pass/fail with the failing step. It never re-runs or
  fixes a failed run.

## Conventions

- **Metric**: metres, seconds, m/s, °C. Never feet or knots. Exception:
  **board length in feet/inches** (stored as inches); volume in litres.
- Times are local to the session's spot, no timezone suffix stored.
- Single light theme: **white page** (2026-10-16, by request; was light grey), white
  outline-free cards separated by a stronger shadow (`shadow-soft`,
  `--card-shadow`: 1px contact line + 4/12 blur at alpha .06). Rounded but tight since
  2026-10-16: cards `--r-card` 6px, tiles `--r-tile` 4px, inputs
  `--radius` 9px, pill buttons fully round. **Funnel Sans** for UI and
  notes, **IBM Plex Mono** for readings. Share images and landing sticker
  WebPs still have the old, rounder corners.
- **Menus** (dropdown, submenu, select, spot picker; 2026-10-16): white,
  borderless, `--r-card` corners, items `--r-tile`, `shadow-menu` (card
  shadow at alpha .10). Submenus (avatar → Language) open **inline as an
  accordion at every width**, never a side flyout (`InlineCollapse`,
  `components/ui/dropdown-menu.tsx`; not checked in a browser). Dialogs
  keep `--shadow-card`.
- Colour tokens (`app/globals.css`, whose comments hold the history):
  `--primary` `#0018FF` for buttons, header, badges, focus rings; `--panel`
  `#ffffff` is the **page background only** (body and public share page);
  `--secondary` / `--muted` `#f2f5f5` fill tiles, pills and board cards;
  `--background` stays white (inputs read it); `--badge` `#374151` for the
  avatar fallback and, via `--data`, direction arrows and tide curve —
  readings are deliberately not blue. **One exception** (2026-10-22, by
  request): the session's own mark on the tide curve is `--primary`. The tide
  curve itself has its own light grey, `--tide-curve` (2026-10-23).
- **Tooltips**: one shared `Tooltip` (`components/tooltip.tsx`); no native
  `title` on icon buttons (calendar day dots still use `title`).
  A trigger that opens a menu passes `suppress` while open and ~400 ms after
  closing (filter chips): closing returns focus to it, and that focus-visible
  focus would otherwise show the tip.
- Notes are rich text (bold / italic / underline toolbar; `->` becomes `→`,
  undo gives `->` back) with a `- ` bullet shortcut (a native `beforeinput`
  listener: React's `onBeforeInput` has no `inputType`, so it never fired)
  and Tab / Shift+Tab to nest list items (own DOM moves, not
  `execCommand("indent")`; Tab outside a list still moves focus). Avery
  writes notes in Chinese; don't break CJK handling.
- **Field focus** (2026-10-19): every text field, select/date/spot trigger
  and the notes editor shows only a blue border on focus, no glow ring.
- Secrets: open `.env.local` in the editor for Avery to paste into.
