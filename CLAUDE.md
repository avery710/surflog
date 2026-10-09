# Surflog

A surf journal. Log a session (spot + date + time + notes) and the
wave/wind/tide conditions for that moment get attached. The point: after
enough sessions, spot which conditions produce good surfs at which breaks.

Started as a personal journal for Capy (a doc nickname; the user is Avery).
Since 2026-09-18 it is a shared platform: anyone signs in with Google and
gets a private journal. Nothing aggregates across users.

Compacted 2026-10-08 from a much longer running log. The full history
(dated decisions, every revision of a design) is in git:
`git log -p -- CLAUDE.md`. Dates below are when something was decided or
last checked.

## Status

- **This repo**: Next.js (App Router) + shadcn/ui + Supabase (Postgres +
  Storage), Google sign-in via Auth.js. Public repo
  `github.com/avery710/surflog`.
- **Deploy**: pushing to `staging` runs
  `.github/workflows/deploy-staging.yml` (lint, typecheck, test) → Vercel
  (`surflog-staging.vercel.app`). No production pipeline. See README.md
  "Staging deploys" / "Before deploying to Vercel".
- **The original**: a published Claude artifact
  (`https://claude.ai/artifact/Bs9xqTtE8Yj1mqPopK8evM`, source in
  `reference/surf-journal.html`), conditions typed in by hand via Claude.
- `BACKLOG.md` is Avery's feature/chore list, **local only, gitignored**;
  the `add-ticket` skill maintains it (short lines; details belong here).
- `VALIDATION.md` holds the spot-fit experiments. Read it before changing
  `lib/spot-fit.ts`.
- Never tried on a real phone. Most "not verified" notes below still stand.
- In the repo but not described here: spot **edit** requests
  (`lib/spot-edit-*.ts`, `app/api/spot-edit-requests`, migration
  `20261008100000`), the `security-auditor` agent. Read the code.

## The automation problem (why Open-Meteo)

Don't re-derive this.

- **Swelleye has no API.** It is the Taiwan forecast Avery pays for (PRO).
  Table renders client-side in an iframe from a private endpoint; 9-day
  forward only, 2-hourly, directions are rendered arrows (good to ~half a
  compass point), one swell train, Taiwan only (41 spots).
- **Its forecast numbers are not spot-adjusted.** Nanwan (S-facing, "flat
  most of the year") and Jialeshui (SE) on the same E swell: 1.0 m vs
  1.1 m; Open-Meteo 1.06 vs 1.12. Swelleye's "Swell Height" is the
  regional offshore swell. Its spot knowledge is the **Spot Infographic**
  (facing, best swell/wind/tide), which is in the `spots` table.
- **Never scrape `api.swelleye.com` or reuse the PRO cookie.** Fragile and
  against their terms. Scheduled browser automation was also declined.
- The artifact sandbox blocks outbound network, hence this repo.
- **Decision 2026-09-25: Open-Meteo is the sole conditions source**,
  fetched server-side at save time. A source that fills every session the
  same way (past dates, overseas) beats a maybe-better one typed in
  sometimes. Typing Swelleye numbers into `cond` is no longer routine.
  **Exception: tide** — CWA wins whenever it has events (below).

## Data sources

### Open-Meteo (`lib/openmeteo.ts`)

`https://marine-api.open-meteo.com/v1/marine`, no key, global. Gives
primary + secondary swell, wind-wave split, directions in degrees, hourly.

- **Wind is not in the marine endpoint**: use the forecast/archive weather
  API. **Always pass `wind_speed_unit=ms`** (default is km/h). For any new
  variable check its unit in `hourly_units`.
- **Resolution limit**: five Yilan points over ~20 km snapped to one grid
  node and returned byte-identical data. It discriminates by day and
  region, not by break. Don't build UI as if each spot has its own
  forecast. The grid node can be ~10 km off; `gridLat/gridLng` are stored.
- **How far back** (tested 2026-09-25, Jialeshui): swell from ~Oct 2021;
  `sea_level_height_msl` and `sea_surface_temperature` from ~Dec 2022;
  wind and air temp (archive) from 1940. The app accepts any date; older
  sessions just get fewer tiles.
- **Sea level / tide events**: `seaLevelM`, `seaLevelTrend` (centred
  difference, widening on a tie), and `tideEvents` = turning points within
  ±14 h plus always the bracketing pair, refined by a 3-point parabolic
  fit (`findTideEvents`, `refineExtrema`; a run of equal hourly values is
  one extremum at its midpoint; same-type neighbours are merged so events
  alternate). MSL datum, **not comparable to CWA's TWVD heights** — only
  rising/falling is. Timing is ±~30 min (API rounds to 0.01 m).
  Open: `tideTrend()` treats a 7 cm dip in a mixed tide as a real "falling".
- **Water temp runs ~1 °C warm** vs CWA stations (bias −0.8 to +2.5 °C,
  worst on the north coast). Decision 2026-09-29: keep it, no offset
  (bias varies by spot). Revisit for winter north-coast sessions; CWA
  buoys (`O-B0075-002`, stations in file API `O-B0076-001`) would be the fix.
- **Wind speed** read 23–50% lower than Swelleye overnight/morning at
  Jialeshui, close from 08:00 (n=3 days, one spot). Unresolved; the coarse
  strength label absorbs most of it.

### CWA tide (`lib/cwa-tide.ts`)

Dataset `F-A0021-001` on opendata.cwa.gov.tw, key `CWA_API_KEY`.

- **Keyed by township**, exact `LocationName` (`宜蘭縣頭城鎮`, not `頭城鎮`),
  stored per spot as `tideTownship`. Several spots share one.
- Heights are `TideHeights.AboveTWVD`, **centimetres as a string**.
  `Daily[]` is **not sorted by date** — flatten and sort by `DateTime`.
- **Forward-only (today + ~32 days).** `getTide()` returns null unless the
  session sits between two forecast events. No per-event distance cap
  (mixed tides leave gaps up to ~17 h).
- Stored as `condCwaTide` with `events` (±14 h + the bracket).
- **Why CWA wins the tide tile**: for Jialeshui 2026-09-26 CWA was within
  3–15 min of Swelleye/Windy; Open-Meteo was 20–65 min early, by a
  different amount per spot, so no fixed offset corrects it.
  Rising/falling never disagreed.

### Swelleye vs Open-Meteo comparison (`npm run compare`)

`scripts/compare-sources.ts` + `lib/source-compare.ts` →
`reports/swelleye-vs-openmeteo.md`. Gap score = mean abs diff ÷ the
metric's `absLarge`; numbers first (Avery's preference).

- Input: a full day of Swelleye's table in
  `data/swelleye-readings/<slug>/<YYYY-MM-DD>.json`, **gitignored** (paid
  data). Open-Meteo is snapshotted once beside it; delete to refetch.
- **A reading is taken on request only**, in Avery's logged-in Chrome, by
  the main session (the `data-source-engineer` agent has no browser).
- `reports/` is untracked: it names session ids.
- 2026-09-25 Jialeshui: period 0.80 (worst), gust 0.48, wind speed 0.42,
  wind dir 0.38, tide timing 0.37, height 0.13, swell dir 0.00.

### Ruled out

- **Windy**: terms forbid storing or deriving databases from the data.
- **Stormglass**: fine fallback (10 req/day free), not needed.
- **CWA marine forecasts**: area-scale, too coarse. CWA **buoy
  observations** would be real ground truth; not built.

## Spot fit (`lib/spot-fit.ts`)

Computes what no forecast gives: how a break's orientation and published
preferences meet the offshore sea state. **Computable, physically
reasonable, NOT verified.**

- Kept: `exposure`/`incidenceDeg`, `inSwellWindow`, `windMode`,
  `offshoreness`, `tideBand`/`tideMatchesBest`, `junkRatio`.
- **`effectiveSwellM` is demoted — do not display** (cos(incidence)
  under-predicts ~25%; waves refract while shoaling).
- **No outcome variable exists to test it.** A 1–5 `rating` was built and
  **removed on request 2026-09-29 — don't re-add unasked** (the
  `sessions.rating` column is still in the DB, unread). Goal ticks are the
  only outcome-like field.
- So: show fit as description, never as a score. On the card today only
  the wind tile's shore word is fit-derived; the tag row was removed and
  `lib/spot-fit-descriptions.ts` is kept unused.

## Data model

Types in `lib/types.ts`; reads/writes through `lib/db.ts`; migrations in
`supabase/migrations/`. **Apply a migration before code that reads its
column runs, even locally.**

```
Session {
  ownerId                // Google OIDC sub
  spot                   // spots.slug | "req:<id>" (pending request) | legacy "custom:…"
  when                   // "YYYY-MM-DDTHH:mm", local time AT THE SPOT, 2-hour grid, no tz
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

- The three condition blocks stay **separate, never merged** (which number
  came from where). `condOpenMeteo` fills when the spot has coordinates,
  `condCwaTide` when it has a township; both refetch when spot or date
  changes. `cond` is manual only.
- Bracket picking for both tide sources: `pickBracket()` /
  `windowAround()` in `lib/tide-bracket.ts`.
- **`lib/session-service.ts`** (`createSessionFor`, `updateSessionFor`,
  `deleteSessionFor`) is the only place sessions change; the web routes
  and MCP both go through it.

**Boards** (`boards`: brand, `length_in`, `volume_l`, rocker, note,
`photo_id`, `is_favorite`, `sort_order`). `sessions.board_id` is
`on delete set null`. Any number of 常用 / go-to boards; `sortBoards()`
(`lib/boards.ts`) puts them first, `sort_order` orders within each group.
The log form pre-selects the last-used board (`preselectBoardId()`).
`PUT /api/boards/order` takes the full id list and 404s unless it is
exactly the caller's rack. Old `is_default` column is unread, droppable.
`boardPhotoSrc(board)` resolves the photo (demo boards use `photoUrl`).

**Goals** (`goals`: one row per owner, `text` ≤200). Points are
newline-separated lines (`goalPoints()` / `joinGoalPoints()` in
`lib/goal.ts`). Each session **snapshots** the goal text, with per-point
ticks in `goal_points_met`; always read through `sessionPointsMet()`.
`pointStats()` counts each point by **exact wording** across sessions —
deliberately no fuzzy matching. Manual on purpose: an AI "suggest a goal"
button was discussed and deferred. **No Enter shortcut** in the goal editor
(it clashed with 注音/倉頡 candidate selection); points are added with +.

**Spot notes** (`spot_notes`, PK `(owner_id, spot)`): a free-text note per
spot, edited in the "What you've surfed" table; empty deletes the row.

## Spots

**The `spots` table is the single source of truth** (2026-10-05), one
worldwide list maintained by Avery: 76 rows (41 Taiwan with Swelleye
fields + CWA township, 9 Siargao, 26 Bali).

- `lib/spots.ts` is types/helpers only. Server reads: `lib/spot-store.ts`
  (`listSpots()`, `resolveSpot(slug)`). Client: `useSpotCatalog()`
  (`lib/spot-catalog.tsx`), never a static import.
  `lib/spot-fixtures.ts` is a static copy of the Taiwan spots for places
  with no database (landing, `app/dev/`, the compare script); not synced.
- **Never copy spots from WannaSurf, Surfline, or the unlicensed GitHub
  gist.** Seeds are OpenStreetMap objects (credited in the migration).
  Never guess a coordinate: it changes the grid node.
- **Timezone per spot** (IANA). `when` is local at the spot. Every current
  spot is UTC+8, so the timezone path is unproven on real sessions. The
  activity calendar's "today" is still Asia/Taipei.
- **Admins** = emails in `SPOT_ADMIN_EMAILS` (`lib/spot-admin.ts`; unset =
  nobody; set in `.env.local` and Vercel Preview). Non-admins get 404
  from admin routes and `/admin`.
- **Adding** (`AddSpotDialog`, `POST /api/spots`): coordinates, a Google
  Maps link, or GPS on tap. Refused within 100 m or same name nearby;
  100 m–1 km asks. A spot with sessions can't be deleted. The dialog does
  not edit Swelleye fields or the CWA township (SQL only).
- **Requests** (`spot_requests`): anyone can request a spot and log
  against it at once (`req:<id>`, no conditions). Approving moves those
  sessions to the real slug and fetches conditions. Email to Avery on a
  new request is wanted, not built (`lib/spot-request-notify.ts` only logs).
- **Picker** (`components/spot-picker.tsx`) and overview page `/spots`
  share `lib/spot-browse.ts`. Group order: Siargao, then Bali
  (`AREA_PRIORITY`), others alphabetical. "Near me" asks for location
  **only on tap**.
- Harvesting Taiwan rows: coordinates are the `lt=`/`ln=` params in the
  iframe `src` on `swelleye.com/en/surf-spots/<slug>/` (curl the raw
  HTML); `nameZh` is the `<title>` of the root-path Chinese page, never a
  hand translation; slugs are not derivable from names. Taitung has no
  infographic (no fit badges); Shanshui (Penghu) is filed under West.
- **Spot reviews** (2026-10-08): `spot_reviews` (1-5 stars required,
  comment ≤1000, one per user per spot, posting again replaces it; RLS on,
  no policies), `/spots` row → `components/spot-reviews-dialog.tsx`,
  routes `GET/PUT/DELETE /api/spots/:slug/reviews`. **Shared with every
  signed-in user** — the one deliberate exception to "nothing aggregates
  across users". Others see only the Google display name, rating, comment,
  date (`toPublic()`, unit-tested); the spot admin can delete any review.
  Migration `20261008200000` applied 2026-10-08 (fails soft without it).
  Every review is listed with the author's avatar (`author_image`,
  snapshotted https URL like `author_name`; your own review falls back to
  your current avatar), yours first with a "You" tag. Google-Maps style:
  the form shows only until you've posted; then your review sits in the
  list with Edit (reopens the form prefilled, Cancel / Update) and Delete. Migration
  `20261009000000` is **NOT applied yet**: until it is, saves skip the
  avatar and the list shows initials. Not checked in a browser. Spot edit suggestions (`5226577`, migration
  `20261008100000`, applied) are reviewed on `/admin`.
- **Pinned spots** (2026-10-09): `spot_pins` (owner, spot, created_at; private
  per user, max 50), pin button on every `/spots` row, a "Pinned" section on
  top (oldest pin first; the spots also stay in their groups; search filters
  it), optimistic with rollback. `PUT`/`DELETE /api/spots/:slug/pin`,
  `lib/spot-pins.ts`. Migration `20261009100000` **NOT applied yet** (page
  shows no pins, toggling says "not switched on yet"). Not in the log-form
  picker. Not checked in a browser.
- **Spot page** `/spots/<slug>` (2026-10-09, `components/spot-detail.tsx`): header
  with Pin and "Log a session here" (`/?log=1&spot=<slug>` → `presetSpot` on the
  log form), About (facing, best swell/wind/tide, map link, Suggest an edit for
  non-admins), "Your sessions here" (count, range, the private note editable,
  headline numbers per session, own data only), Reviews inline (`Reviews`
  exported from the dialog). Spot names link here from `/spots` rows and from
  the journal's "What you've surfed" table (whose column is "My notes
  (private)"; its icon-only "Share as review" button opens the review dialog
  with the note copied in). Not built: nearby spots, per-session pages.
  `/dev/spot-detail` previews it on synthetic data. Not checked signed in.
- Never exercised on live data: create/edit/delete a spot,
  send/approve/decline a request, the non-admin view, "Near me".

## Multi-user, auth, storage

- **Google sign-in via Auth.js** (`auth.ts`, `proxy.ts`), JWT sessions, no
  adapter, **no allowlist** by design. Identity is
  `account.providerAccountId` (Google `sub`) — **never `user.id`**, which
  is a random UUID per sign-in. A browser with an old JWT shows an empty
  journal: check `/api/auth/session` for a UUID id, then sign out and in.
- **Every row carries `ownerId`; every route checks it and answers 404,
  not 403**, for a foreign id.
- **RLS is on with no policies, deliberately.** The server uses the secret
  key and does its own ownership checks (README "Setting up Supabase").
- Ownerless imported data goes to an explicit account, never "whoever
  signs in first".
- `proxy.ts` gates everything; unsigned paths are exact rules: `/`,
  `/landing/<name>.jpg|.webp` (lower-case names), `/api/mcp`, the OAuth discovery/register/token
  routes, and the three share path shapes. `/dev` only outside production.

**Uploads** (`lib/blob.ts`, `lib/upload-client.ts`): `POST /api/uploads`
→ signed URL → browser PUTs straight to Storage → attach with
`{ uploadId }`. **Never send file bytes through a route, either way**
(Vercel caps bodies at 4.5 MB). `registerUpload()` checks what landed:
50 MB (Supabase's own ceiling), image/video only, claimed once. Photos
over 2560 px / 3 MB are redrawn in the browser; videos over 16 MB are
re-encoded (`lib/video-compress.ts`, mediabunny), falling back to the
original. Serving: images ≤4 MB through `/api/blob/:id` (owner-checked,
year-long private cache), videos/larger by 302 to a 1-hour signed URL.
Attach/delete run **one request at a time** (the route rewrites the photo
list). Deleting a session/photo/board photo frees storage; an upload never
attached is orphaned (no clean-up built). Media is added and removed in
the log form and edit panel (`components/media-picker.tsx`, max 10,
staged until Save), not on the card; tap a thumbnail for
`components/media-viewer.tsx`.

## MCP and AI apps

A user connects an MCP client to their own journal via `/api/mcp`.
**Both auth routes stay — don't remove either unasked**: OAuth for chat
apps, personal tokens for anything that can't open a browser.

- **Page**: `/ai-apps` (`/agents` and `/tokens` redirect; API routes keep
  the `tokens` name). Wording is "AI app", not "agent" (chat apps only act
  when asked). zh-TW keeps "AI App" / "Agent" in English, never 代理.
  `components/connect-agent.tsx`: one flat row of tiles — Claude, ChatGPT,
  Gemini, Others. **The tile decides OAuth vs token, the user never
  does.** A connected tile carries a ✓ (`connectionMatches()`); a taken
  name is numbered (`uniqueName()`). Avery was advised not to add tiles
  until existing ones are confirmed.
- **Tokens** (`lib/token-auth.ts`, table `api_tokens`): `sfl_` + 32 random
  bytes, shown once, SHA-256 stored, scope `read`/`write`, 10 active per
  owner. **Token management is cookie-session only** — a leaked token must
  never mint or list tokens.
- **OAuth** (`lib/oauth.ts`): authorization code + PKCE (S256), public
  clients, open dynamic registration (rate limited, up to 20 redirect
  URIs). An OAuth access token is an ordinary `api_tokens` row; access
  1 h, refresh 60 days rotating. Consent at `/oauth/authorize`.
  **Never truncate, trim or re-encode a value that belongs to the other
  side of a protocol** — cutting `state` to 500 chars broke Gemini.
  Not built: client secrets, a revocation endpoint, cleanup of old rows.
- **Endpoint**: Streamable HTTP, stateless, `mcp-handler` 2.x +
  `@modelcontextprotocol/server` 2.x (`registerTool` with a full
  `z.object`). **The route's own bearer check is its only protection.**
- **Tools** (`lib/mcp-tools.ts`): read — `list_sessions`, `get_session`,
  `list_spots`, `list_boards`, `get_goal`; write — `create_session`,
  `update_session`, `delete_session`, `set_goal`, `clear_goal` (not
  registered for a read token). The agent's choices, change if they bite:
  `when` must be on the 2-hour grid; `notes` is plain text and
  `update_session` **replaces the whole note**; catalogue slugs only;
  `goalsAchieved` must match the current goal word for word; no media,
  boards or spot admin.
- **Rate limit** (`lib/rate-limit.ts`): 120 req/min and 60 writes/10 min
  per owner, **in memory per instance** — a brake, not a quota.
- Notes are untrusted text to a model; tool descriptions say so.
- `/admin` has a Connected services table: counts only, no user named.
- Confirmed working by Avery: claude.ai, ChatGPT (Plugins → custom MCP
  server, free plan), Gemini. Never tried: Claude Code, Codex, Cursor,
  Claude Desktop, the mobile app specifically.

## Sharing a session

Session card ⋯ → Share → `components/share-dialog.tsx`: generated images
(Sticker / Card) and a public link.

- **Images**: element + layout in `lib/share-element.tsx` (pure, bundles
  for the browser), PNG via `lib/share-image.tsx` (next/og / satori),
  data from `lib/share-card-data.ts` (same rules as the card:
  `lib/tide-display.ts`, CWA-first). Sticker = transparent canvas with a
  dark plate; Card = 1080×1350; `og` = 1200×630 for link previews only.
  **Never goal ticks.** Notes are wrapped by `lib/share-text.ts`
  (estimated widths). Fonts (`lib/share-fonts.ts`) are fetched as TTF
  subsets from Google Fonts at runtime; unreachable → 503, no fallback.
- **Public link** (`session_shares`, `lib/session-share.ts`): private by
  default; on = a row with a 32-byte token, **stored plain** (the owner
  must be able to copy it again); off = row deleted, link 404s at once.
  Public functions return only `PublicShare` (`lib/share-public.ts`),
  built field by field; a test asserts the allow-list. The public page
  `/s/<token>` does **not** reuse `EntryCard` (it takes a full Session).
- Owner routes are cookie only, never bearer. `/api/blob/:id` stays
  owner-only; shared media goes through `/api/share/<token>/media/<id>`
  (15-minute signed URLs).
- **Caching**: page `force-dynamic`, `card.png` `no-store`, media
  `private, max-age=60` — a shared CDN copy would outlive "turn off".
- Per-IP limits in `proxy.ts`; unknown and turned-off tokens give the
  identical 404. No per-app deep-link buttons, by decision.
- Strings: `lib/share-strings.ts` (server-side copy of `lib/i18n.tsx`
  keys; a test fails on drift).
- **Dialog layout** (2026-10-08): everything left-aligned at every width.
  `DialogContent` there needs `grid-cols-[minmax(0,1fr)]`: without it the
  grid column grows to the gallery's width and the dialog drifts off-centre
  on phones. Checked with Playwright at 375 / 1280 px, no data.
- Not verified: the buttons on a phone, a session with notes/media on the
  public page, Instagram paste, chat-app link previews, anything on
  staging.

## UI

**Session card** (`components/entry-card.tsx`):
- Tiles: Swell (height + arrow + compass) · Period · Wind · Water temp ·
  Tide. Below `sm` a 3-column grid; from `sm` one flex row. Missing tiles
  are left out. Big figures are one style (`Figure` in
  `components/condition-tile.tsx`): 20px **mono — keep them mono**. No
  hover tooltips.
- **Open-Meteo wins over typed numbers**: the manual `cond` row shows only
  when there is no `condOpenMeteo`. Nothing is deleted from `cond`.
- **Wind tile**: speed + strength label, then arrow + compass + shore
  word (omitted without `facing`). **Gust is not displayed** but feeds
  the label. Strength (`lib/wind-strength.ts`): Beaufort bands on the
  **midpoint of speed and gust** (our own rule). zh-TW uses plain words,
  not official Beaufort terms: 無風 / 微風 / 輕風 / 中等風 / 偏強風 / 強風
  / 疾風 / 大風.
- **Tide tile = direction + next turning point, not a height**
  (`tideTrend()`), plus a day-long chart (`components/tide-chart.tsx`,
  two-line labels on the bracketing events). Source: CWA when
  `condCwaTide.events` is non-empty, else Open-Meteo. Label is plain
  "Tide" for both.
- **Water temp**: `condOpenMeteo.seaTempC`, air temp as small print.
- Header: spot + date, and a ⋯ menu with **Edit / Share / Delete** (delete
  confirms in a dialog). `readOnly` prop drops the menu (landing).
- **Necks** (`components/pill-neck.tsx`): grey stems joining the board
  chip's photo and name, neighbouring tiles (`components/tile-group.tsx`,
  measured in a layout effect + `ResizeObserver`), and goal pills
  (`GoalSection` in `components/goal.tsx`). The board chip's stem SVG must
  stay its **first child**.
- Edit panel offers only fields the card shows; other `cond` values ride
  along untouched. Button is "Refresh conditions" (no source name).

**Dashboard** (`components/journal.tsx`): one `bg-panel` wrapper holding
white cards — row 1 goal card + activity calendar (`sm:w-[260px]`,
`items-start`), row 2 "What you've surfed" table, row 3 board rack.
`app/dev/dashboard/page.tsx` mirrors this markup; keep in sync.
- **Activity calendar**: the component's header comment is the source of
  truth. Week rows, Sunday-first, titled "Days in the water". The ↑/↓
  week buttons sit in a side rail from `sm`, at the end of the title row
  below it (2026-10-09, to give the AI app card room on phones). Below `sm`,
  when the calendar is full width (no AI app card), the card also shows
  the most recent session behind a divider: spot, today / yesterday / N
  days ago + time, swell height and period (`LastSession`).
- **AI app card** (`components/ai-app-card.tsx`, 2026-10-09): shown only
  while the owner has no un-revoked token (`hasConnectedApp()`, fails soft
  to hidden); links to `/ai-apps`. Sits beside the calendar in one row at
  every width (calendar `fit`, card takes the rest); below `lg` the goal
  card moves to its own row above them; at 320 px the card wraps under.
  Without it the row is the old goal + calendar layout.
- **Board rack** (`components/board-rack.tsx`): 常用 via the ⋯ menu; the
  badge is also a remove button. **排序 / Reorder mode** makes the whole
  card the drag surface (dnd-kit, **one** `SortableContext` for all cards;
  a cross-group drop snaps back). Reorder and 常用 are optimistic with
  rollback. Photos are square-cropped at every width using an
  absolutely-positioned `<img>` in a wrapper — a plain stretched `<img>`
  blows up in WebKit.
- Goal card counts show only the number (`✓ 3`), full text is `sr-only`.

**Header**: solid `bg-primary`, sticky, hides on scroll down
(`lib/use-auto-hide-header.ts`, never hides under reduced motion).
`components/site-header.tsx` on sub pages duplicates the journal header's
classes — keep in step; its "+" links to `/?log=1`. Controls on the blue
are white-filled with white focus rings. **The wordmark stays black, by
request.** The "+" icon is Avery's own mark (`LogIcon`). Every signed-in
page and the landing header use **`PAGE_COLUMN`** (`lib/layout.ts`) —
change the width there only.

**Landing** (`components/landing/landing.tsx`, signed-out `/`; preview at
`/dev/landing`): sections 01 conditions, 02 dashboard, 03 AI app, 04 spot
list, 05 sharing. Real components on synthetic data
(`components/landing/demo-data.ts`) — never `lib/db.ts` or the API.
`/signin` is separate and stays. Copy only claims what exists. Section 03
is one static mock conversation whose wording Avery edited line by line —
keep it. Section 04 (`spots-showcase.tsx`, 2026-10-09) sells the spot list
as built by everyone: three static mocks (request a spot, rate and review,
suggest an edit) under the live spot count; it replaced a grid of spot
names. Section 05 (`share-showcase.tsx`) is the three sticker styles in one
row, unlabelled, on the dialog's dark transparency checkerboard (no photo
stand-ins "for now", no share-link box). The stickers are WebPs in
`public/landing/` drawn by the real renderer from the demo session:
**re-run `npx tsx scripts/landing-share-images.ts` when the share images
change** (the strip's cut-out text can't be done in the DOM).
**Licence NOT settled** for the demo board photos in `public/landing/`:
the Haydenshapes one is CC BY-SA 4.0 (credit line required, present); the
Wavestorm one is the maker's "All Rights Reserved" image.

**Tried and removed on request — don't bring back unasked**: the rating
field; CSV export; the spot-fit tag row; gust on the wind tile; hover
tooltips on figures; Funnel Sans for figures; a ticket-shaped session
card; tiles butted with pinched corners; a divider above the notes; a
transposed phone calendar; the liquid-glass header pill and the black
header underline; the second landing AI card; dark mode; a rack card
"default board". Details: `.claude/agents/ui-designer.md` "Style
references".

## Testing

**Use the cmux CLI to check UI changes, not only type-check** (Avery's
standing instruction). cmux's browser is signed in to the dev server.

- `cmux tree` lists surfaces. `cmux browser surface:N reload | wait
  --load-state complete | eval '<js>' | screenshot --out <png> | errors
  list | console list | click <css> | press Escape`. Measure with `eval` +
  `getBoundingClientRect()`.
- `viewport 375 850` emulates a phone; **always `viewport reset`**. The
  native pane is below `lg`; emulate 1280 for desktop. Wait ~1 s after a
  viewport change before measuring `ResizeObserver`-positioned things.
- `cmux read-screen --surface <dev-terminal> --scrollback --lines 2000`
  reads the dev log.
- **The tab is Avery's real data**: only reversible actions, undo every
  test change, and clean up fake-owner rows and tokens afterwards (a
  previous "cleaned up" claim was wrong — verify).
- Limits: native file pickers and `window.confirm` block automation;
  synthetic `hover` doesn't apply `:hover`. Drive a file `<input>` with a
  `File` in a `DataTransfer` + a bubbling `change`. Fetch deleted photos
  with `{ cache: "no-store" }`.
- **A hidden tab stalls** timers and uploads; check
  `document.visibilityState` before debugging a "stuck" request.
- **`/dev` tabs sometimes don't hydrate in cmux** — check `window.next`
  before trusting or blaming one.
- Concurrent agents share tabs: open your own with `cmux browser open
  <url>`. Language is localStorage, shared per origin — switch it back.
- `npm test` (Vitest **4**; v5 needs `@types/node` ≥22), `tests/*.test.ts`,
  Supabase and condition sources mocked. `npm run lint` scans
  `.claude/` too: use `npx eslint app components lib tests`.
- `npm run dev` is `next dev --webpack` (Turbopack + `next/font/google`
  fails in dev; builds are fine).
- Shell is zsh: `set -- $var` doesn't split; quote `--include=*.ts`.

## Bugs already hit — don't repeat these

- **Open-Meteo wind in km/h stored as m/s** — pass `wind_speed_unit=ms`.
- **Rewriting a contentEditable while typing breaks Chinese IME.**
  `RichTextEditor` freezes its initial HTML at mount and skips emitting
  while `isComposing`. Never feed an uncontrolled editor its own output.
- **"Nearest reading" needs a maximum distance** (CWA picked an event days
  away for past sessions).
- **`user.id` is not Google's `sub`** (see Multi-user).
- **"Supabase: JWT issued at future"**, intermittent: `lib/supabase.ts`
  retries only that error (4 retries, ~4 s) and logs each. After all
  tries it's a real Supabase incident.
- **Vercel's 4.5 MB body cap.** Safari's "The string did not match the
  expected pattern" means the server answered non-JSON; parse errors with
  `.json().catch(() => null)`.
- **Notes sanitiser double-escaped `&<>`** (fixed 2026-10-06). Notes saved
  before that containing those characters are still double-escaped.
- **`cva` doesn't merge conflicting classes**: overriding a Button
  variant's `hover:bg-*` needs your own matching `hover:bg-*`.
- **`offsetTop` of a stuck `position: sticky` element** isn't its static
  position in Chromium.
- **A `max-width` flex child needs `min-w-0`**, or a wide descendant
  pushes the column past the viewport.
- **An `overflow-auto` box only clips absolutely positioned descendants
  if it is positioned itself.** The spots table's `sr-only` header (which
  is `position: absolute`) escaped its scroller and widened the journal
  on phones (fixed 2026-10-09 with `relative` on the scroller). Measure
  `document.documentElement.scrollWidth` with real-shaped data.
- **`scale: tan(atan2(100cqw, 1080px))` is wrong in WebKit.** Scale with
  SVG `viewBox` + `foreignObject`, or measure in JS.
- **When moving or renaming a module, fix its importers in the same
  step** (the dev server 500s for everyone meanwhile).
- Artifact only: db snapshots are frozen (copy before adding `id`);
  `claude.use()` can hang (race a timeout); the db only answers inside
  Claude's artifact viewer.

## Localization

English and Traditional Chinese as used in Taiwan (`zh-TW`, never
Simplified). Avatar menu → Language; stored in localStorage
(`surflog:lang`).

- `lib/i18n.tsx`: `DICT` of key → `{ en, "zh-TW" }` (a missing language
  fails typecheck), `useLang()` → `{ lang, setLang, t }`.
- **Every user-visible string goes through `t()`**, including
  aria-labels and alt text. `lib/` formatters take a `lang` param.
- Language is read with `useSyncExternalStore` (server snapshot `"en"`),
  not `useEffect` + `setState` (hydration, and a lint rule).
- Not translated: units, source names, API error messages, user content.
- Terms: 浪點 spot · 湧浪 swell · 週期 period · 陣風 gust · 滿潮 / 乾潮
  high / low tide (CWA's terms, not 高潮) · compass points in CWA's form
  (北北東). Never translate a spot name by hand.
- Much zh-TW wording was written by the agent and is unreviewed.

## Project agents

`.claude/agents/` (Sonnet, except `push-stag` on Haiku). New agent files
load only when a session starts.

- **`data-source-engineer`**: Open-Meteo / CWA fetches, spot harvesting.
  No browser.
- **`localizer`**: translations, hard-coded strings.
- **`ui-designer`**: look and feel; its file holds Avery's style
  references. No browser — visual checks stay with the main session.
- **`storybook`**: dev-only showcase pages under `app/dev/` on synthetic
  fixtures (`app/dev/fixtures.ts`), indexed at `/dev`. Real Storybook was
  declined. `app/dev/layout.tsx` 404s the tree in production (route
  handlers there must repeat the check). Limits: no photos, actions hit
  the real API and fail, width frames don't trigger `sm:`/`lg:`.
- **`push-stag`**: commits and pushes to `staging` only, never main, never
  force; runs lint + typecheck first; keeps `.env*`, `reports/` and
  Swelleye readings out; asks before applying migrations.

## Conventions

- **Metric**: metres, seconds, m/s, °C. Never feet or knots. One
  exception: **board length is feet/inches** (stored as inches); volume
  in litres.
- Times are local to the session's spot, no timezone suffix stored.
- Single light theme, white page. Rounded, Coinbase-ish: 24px cards, 16px
  tiles, pill buttons. **Funnel Sans** for UI and notes, **IBM Plex Mono**
  for readings.
- Colour tokens (`app/globals.css`, whose comments hold the history):
  `--primary` `#0018FF` (8.16:1 on white) for buttons, header, badges
  (go-to badge, goal chip), focus rings; `--panel` `#f2f5f5` for the
  dashboard panel; `--badge` `#374151` for the avatar fallback and, via
  `--data`, the direction arrows and tide curve — readings are
  deliberately not blue.
- Notes are rich text with a `- ` bullet shortcut. Avery writes notes in
  Chinese; don't break CJK handling.
- Secrets: open `.env.local` in the editor for Avery to paste into.
