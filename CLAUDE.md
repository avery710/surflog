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
   refresh-conditions row) — see git log. **Phone/tablet layouts are now
   checked with the cmux CLI** (2026-09-30, see "Testing in the browser
   (cmux)"): `cmux browser … viewport 375 850` emulates the width inside
   Avery's already signed-in cmux browser, so no auth weakening was
   needed. A real physical device is still untested.

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
     pickers for now — `lib/overseas-presets.ts` is kept, just unused
     (overseas spots are real catalogue rows since 2026-10-05, see
     "Spots").

   **As of 2026-09-24** (session cards, `components/entry-card.tsx`):
   - **Tide tile = direction + next turning point, not a height.** The
     card no longer shows a single "tide at session time" figure. The
     headline is **rising / falling** (`tideTrend()` in
     `components/tide-events.tsx`: next event is a high → rising, a low →
     falling); the small print is only that next event, i.e. the next high
     when rising / next low when falling (`high 20:26 · 1.2 m`, `+1d` if it
     falls on another day). Same tile shape for both sources.
   - **CWA wins the tide tile when `condCwaTide.events` is non-empty**,
     else Open-Meteo `tideEvents` (then CWA's legacy single event, then
     `seaLevelTrend`, for the trend headline). Label is plain `Tide`
     for both since 2026-09-30 (was `Tide (CWA)` for CWA). History: CWA-first until 2026-09-25, Open-Meteo-only
     2026-09-25 to 2026-09-28 (for one consistent source), **back to
     CWA-first 2026-09-28** after Avery flagged the tide as inaccurate.
     Checked against two independent references for Jialeshui 2026-09-26
     (Swelleye low 12:16 / high 17:53; Windy 11:58 / 18:02): CWA
     12:12 / 18:05, Open-Meteo 11:25 / 17:30. Across the 3 stored sessions
     with both, and 5 forecast days at 屏東縣滿州鄉 and 宜蘭縣頭城鎮,
     Open-Meteo was always early — 2-54 min at Jialeshui (shrinking with
     forecast horizon), a steady ~55-65 min at Wai'ao — so a fixed
     per-spot offset won't correct it. Likely cause: coarse global model +
     grid node (Jialeshui snaps ~5 km SSE past the cape; the Nanwan-side
     node was 20-40 min closer). Rising/falling never disagreed. CWA is
     forward-only, so older sessions (and 2026-09-22, saved before
     `events` existed) still show Open-Meteo. `seaLevelM` and the manual
     `cond.tideM`/`tideNote` stay stored and in the CSV, not displayed.
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
     Period (split out of the swell tile into its own) · Wind · Tide
     (Water temp added after Wind 2026-09-29, see below).
     Every tile's big figure uses one style (`Figure` in
     `components/condition-tile.tsx`: 20px mono, foreground colour); the
     hover tooltips on figures were removed, and `components/ui/tooltip.tsx`
     with them. (Funnel Sans bold was tried for these 2026-09-30 and
     reverted the same day on request — keep them mono.)
   - **Wind tile** is two rows: `4.2 m/s  ● 中等風` (speed big, strength a
     small grey note, text baseline-aligned with the speed since
     2026-09-29 — the dot is `self-center` so it doesn't set the baseline)
     and `← 東  側風` (teal bold arrow + compass point,
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

   **As of 2026-09-28** (uncommitted at time of writing):
   - **Activity calendar — the description in this bullet is stale**
     (found 2026-10-06; the component's own header comment is the source
     of truth): since 2026-10-01 every row is one full week, not a month
     (`VISIBLE_WEEKS` = 4, not `VISIBLE_MONTHS`), and since 2026-10-06 the
     grid is **Sunday-first** (S M T W T F S / 日 一 … 六), not
     Monday-first. The card also has a title now ("Days in the water").
     What follows is the history up to 2026-09-30.
     `components/activity-calendar.tsx` was redesigned
     on request after two swipe-grid iterations were rejected: no heading,
     a fixed-width white card (344px at the time, since narrowed to 260px
     — see "As of 2026-09-30" below; full width on phones) with months
     stacked vertically, oldest on top, current at the bottom.
     Each month = a short label (`Sep` / `9月`, no year; current month
     dark, others the same light grey as the dots) + one 10px dot per day.
     **Changed 2026-09-30 on request: a proper Monday-first week grid, 7
     dots per row instead of 14 with no weekday alignment** — day 1 sits
     under its real weekday (`leadingEmptyDots()`, computed from the local
     y/m/d `Date`, never an ISO string, so it can't UTC-shift); leading
     slots before it are invisible, not styled as dots; the last row of a
     month can be short. A faint Monday-first weekday header (M T W T F S S
     / 一 二 三 四 五 六 日, via `t()`/`calendar.weekday.*`) sits once above
     the whole card, not per month — it lines up with the dot columns below
     purely because both use the same fixed-pixel grid track, regardless of
     their separate flex containers. Dot size stayed at 10px (tried larger,
     14px, first, sized back down on request); the gap between dots widened
     from 6px to 10px on request, since 7-per-row freed up horizontal room.
     Dots: teal = surfed, light grey = past no-surf, grey outline = future;
     today gets no special marker. Only months from the earliest session's
     month to now are shown. Max 2 months visible (`VISIBLE_MONTHS`, lowered
     from 3 — a week-aligned month is now 4-6 dot rows instead of 2-3, so 3
     would make the card noticeably taller than the table it sits beside;
     measured from rendered rows, not guessed); older ones via ↑/↓ buttons
     in a rail on the right, one month per click, eased 380 ms scroll
     (instant under reduced motion). The past-month label grey is
     low-contrast as text — accepted on request. Not checked in a browser —
     eyeball a month starting on Sunday (6 rows), February, today's dot, and
     zh-TW.
   - **Edit panel** (`components/edit-panel.tsx`) only offers fields the
     card can show: `cond.tideM`, `tideNote`, `seaTempC`, `airTempC` inputs
     removed. Existing values ride along untouched in the saved `cond`
     object; nothing deleted from the DB or CSV.
   - `app/dev/activity-preview/` (synthetic sessions, 1-4 months) is for
     eyeballing the calendar — now part of the `app/dev/` showcase (see
     "Project agents" → `storybook`), gated by `app/dev/layout.tsx` and
     `proxy.ts`'s dev-only bypass, so it's safe to commit like the rest of
     `app/dev/`; no longer a throwaway to delete before committing.

   **As of 2026-09-29** (uncommitted at time of writing, entry card; not
   checked in a browser, type-checked and linted only):
   - **Water temp tile** after Wind: `condOpenMeteo.seaTempC` big (Open-
     Meteo marine `sea_surface_temperature`, °C, offshore grid node — model
     output, not a measurement), `Air 25.5°C` / `氣溫` small print from
     `airTempC` (weather `temperature_2m`). Hidden when both are null. No
     new fetch: both were already stored, 8/8 sessions have them (checked
     2026-09-29). The manual `cond.seaTempC`/`airTempC` are still not
     shown. Real water temp would be CWA buoys (`O-B0075-001`), not built
     — see "CWA vs Open-Meteo temperature" for how far off Open-Meteo is.
   - **Tile layout**: on `lg` a column-major grid with two shared rows
     (`lg:grid-flow-col lg:grid-rows-[auto_auto]`): Swell over Period,
     Wind over Water temp, Tide spanning both rows — so Swell and Wind
     are always the same height (was two flex columns, which didn't
     align; changed on request). A missing Period/temp makes the tile
     above it span both rows. Phones/tablets: Swell · Period · Wind, then Water temp
     (1 col) + Tide (2 cols; 3 when there's no temp tile).
     **Stale since 2026-10-01** (found 2026-10-06, see the comment in
     `entry-card.tsx`): the `lg` grid is gone. Below `sm` it is that
     3-column grid; from `sm` up all five tiles share one flex row.
   - **Tide chart shortened** (`components/tide-chart.tsx`, 106 → 64 px):
     x-range is the session's whole day, 00:00–24:00, cut to where the
     stored events reach (they span ±14 h + bracket, so an early session's
     curve can stop before midnight). Cropping to just the session's leg
     was tried first and replaced on request. Labels are one line,
     `20:26 · 1.2m`, only on the bracketing low/high, and only when that
     event is inside the day. The y-scale spans every stored event, so
     the curve never clips into the time pill. On `lg` the tide tile spans
     both rows, so it's a flex column and the chart is vertically centred
     in the space under the headline (`subClassName="lg:my-auto"`, a
     `ConditionTile` prop added for this) instead of hugging the top.
     **2026-09-30: labels back to two lines** (time, then height
     underneath, e.g. `08:05` / `0.7m`, `+1d`/`-1d` staying on the time
     line) — the one-line form above was too cramped once Avery looked at
     it again. `H` grew 64 → 88 (`TOP` 29 → 41, `BOTTOM` 15 → 27, a new
     `LINE_GAP` = 10 between a label's two stacked `<tspan>`s) to keep a
     two-line label from clipping the top of the SVG or the session-time
     pill (y 0–15), or the bottom edge; the plot area itself (`H - TOP -
     BOTTOM`) stayed 20 px, so the curve is the same height as before, just
     with more label room around it. Missing `heightM` still renders only
     the time line, at the same position it held with one line. The
     tile's own label lost "(CWA)" the same session — see the bullet
     right below.
   - **Tide tile label no longer names the source.** `tile.tideCwa` ("Tide
     (CWA)" / "潮汐（氣象署）") was removed from `lib/i18n.tsx`; both CWA-
     and Open-Meteo-backed tiles now show the plain `tile.tideOpenMeteo`
     string ("Tide" / "潮汐"). The `tideSource` logic in
     `components/entry-card.tsx` is unchanged — CWA still wins whenever it
     has `events` — only the label stopped naming which source won.
   - **Dashboard panel**: the goal card, activity calendar, "What you've
     surfed" table and board rack (`components/journal.tsx`) are now one
     shared card instead of four separate floating ones, on request — a
     `rounded-[var(--r-card)]` wrapper tinted `bg-primary-soft` (new token,
     `app/globals.css`: `--primary-soft` a pale wash of `--primary`, mapped
     to `--color-primary-soft` so `bg-primary-soft` works in Tailwind;
     deliberately its own token rather than reusing `--accent`, which is a
     shadcn interactive-highlight colour — e.g. select focus — not a
     static panel background, even though the two hexes are close), with
     tighter padding on phones (`p-3` vs `sm:p-5`) and `gap-4` between
     sections instead of each section's old `mt-6.5`. Each section keeps
     its own white `bg-card` surface (border + shadow) nested on the tint.
     **Superseded 2026-09-30** — the calendar no
     longer sits next to the table; see below.
   - **Session card header**: Edit / Add media / Delete buttons replaced
     with one `⋯` (`MoreHorizontal`) icon-button menu (`components/ui/dropdown-menu.tsx`,
     same one `user-menu.tsx` uses), items Edit / Add photos/video /
     separator / Delete (red). The file `<input>` stays outside the menu
     so it survives the menu closing when "Add photos/video" clicks it;
     an uploading spinner now sits next to the `⋯` button since the old
     button's "Uploading…" text is gone. Delete's old two-step inline
     confirm doesn't work inside a menu, so it's now a `components/ui/dialog.tsx`
     confirm ("Delete this session?" + spot/date) with Cancel/Delete.
     `entry-card.tsx` only. Checked in cmux 2026-09-30: menu opens with the
     three items, the delete dialog names the session, Escape cancels with
     nothing deleted. "Add photos/video" (native file picker) can't be
     driven from the CLI — untested. Header is two groups, spot+date
     (wrapping) and a fixed actions column, so on a 375 px phone the date
     drops under the spot name and `⋯` stays pinned top-right (with one
     `flex-wrap` row, `⋯` was what wrapped). The board chip lost its
     "Board / 衝浪板" label (screen-reader-only now): photo + name only.
     **Since 2026-10-05 the menu is just Edit / Delete**: the "Add
     photos/video" item, the card's file input and the uploading spinner
     are gone (media is managed in the edit panel, see "As of 2026-10-05").

   **As of 2026-09-30** (dashboard panel, `components/journal.tsx` +
   `components/activity-calendar.tsx` + `components/patterns-table.tsx`;
   `app/dev/dashboard/page.tsx` kept in sync; measured in cmux at 1280 and
   390 px — goal + 260 px calendar side by side, then stacked): rearranged on request — the calendar
   card no longer needs as much space as it was given. Its content (a
   Monday-first week grid: month-label column + 7×10px dots + the ↑/↓
   rail) is only ~200px wide, so the old fixed 344px card next to the
   table left a lot of blank white space on tablets/narrow desktops
   between `sm` and `lg` — the actual complaint, reproducible at ~800px.
   New layout, top to bottom inside the shared `bg-primary-soft` panel:
   - **Row 1**: the goal card (flexible width) beside the activity
     calendar (now content-sized, `sm:w-[260px] sm:shrink-0`, down from
     344px — see the arithmetic in `activity-calendar.tsx`'s own
     comment), from `sm` up; both full-width and stacked (goal above
     calendar) below `sm`. `items-start`, not `items-stretch`: the goal
     can run several lines (multiple points), and stretching the
     calendar to match would just move the same blank-space problem
     inside its own card — the calendar keeps its own natural,
     content-sized height instead.
   - **Row 2**: the "What you've surfed" table, full width at every
     breakpoint now (it no longer shares a row/height with the
     calendar; `ActivityCalendar`'s `h-full` and `PatternsTable`'s
     matching `h-full max-h-[320px]` height-stretch were removed, its
     own `max-h-[320px]` internal scroll cap kept).
   - **Row 3**: the board rack, full width, unchanged.
   Empty states checked by construction, not visually: no goal set
   (`GoalCard`'s "add a goal" prompt) and the table's own
   `sessions.length < 2 → null` don't leave a hole or stretch oddly,
   since row 1 is a plain flex pairing (no shared grid track to leave
   empty) and rows 2/3 are independent, no-height-matching blocks.
   The calendar's own dot size/spacing/header/rail/`VISIBLE_MONTHS`
   are untouched — only its card's outer width and the `h-full` height-
   match changed. To eyeball: ~800px width (the original complaint,
   should now show the goal+calendar row instead of a mostly-empty
   calendar card), a phone width (everything stacked, calendar full
   width), a long multi-point/Chinese goal beside the calendar (goal
   card taller than the calendar — should not stretch it), and the
   `sessions.length < 2` / no-goal empty states together.

   **As of 2026-10-02** (landing page, uncommitted at time of writing):
   signed-out `/` shows a feature showcase (`components/landing/landing.tsx`)
   instead of redirecting; signed-in `/` is still the journal. `/signin`
   is unchanged and stays (Avery's call — not the landing page).
   `proxy.ts` lets exactly `/` through without sign-in; `app/page.tsx`
   picks landing vs journal. The page renders the real components
   (`EntryCard` with a new `readOnly` prop that drops the ⋯ menu,
   `ActivityCalendar`, `PatternsTable`, `GoalCard`) on synthetic data
   from `components/landing/demo-data.ts` (built on `app/dev/fixtures.ts`,
   dated relative to today) — never `lib/db.ts`, never the API; goal and
   spot-note edits live in local state only. `BoardRack` fetches by
   itself, so the quiver section is a plain list. Copy only claims what
   exists: custom/overseas spots get **no** conditions (no coordinates),
   so nothing says "works worldwide" (stale since 2026-10-05: catalogue
   spots outside Taiwan do get conditions now; the landing copy and its
   Taiwan-only demo data were not revisited). All copy is `landing.*` in
   `lib/i18n.tsx`. Preview while signed in at `/dev/landing`. Checked in
   cmux at 1280 and 375 px (no horizontal overflow). **cmux's `/dev` tabs
   don't hydrate** (`main-app.js` is never requested, `window.next`
   undefined — seen on every `/dev` page 2026-10-02, cause unknown), so
   anything interactive there (language toggle, calendar landing on the
   current month) looks broken in cmux only; the same page in Chrome
   hydrates fine. Not checked: signed-out `/` in a real browser (both
   browsers are signed in), the Google button end to end.

   **As of 2026-10-05** (commits `53f28c1`..`99865ed`, all deployed to
   staging the same day; nothing below has been tried on a real phone):
   - **One worldwide spot catalogue in the database**, maintained only
     by Avery, with a searchable picker, spot requests and an admin page
     — see "Spots".
   - **Uploads go straight to Supabase Storage** (photos shrunk in the
     browser first) — see "Multi-user" → photos, and "Bugs already hit"
     for the Vercel 4.5 MB limit that forced it.
   - **Photos/video in the new-session form** (`components/log-form.tsx`):
     a picker section between the board select and the goal checkboxes,
     up to 10 files (the agent's number, not Avery's), previews with ×.
     Save creates the session, then uploads and attaches files **one at
     a time** (the attach route rewrites the session's photo list, so
     parallel attaches would overwrite each other). A failed file never
     loses the session: it is skipped and a toast says how many failed.
     The dialog can't be closed while saving (`formBusy` in
     `journal.tsx`); a page reload mid-upload is not guarded. Media is
     its own section, not part of the notes editor (Avery's call).
     Checked in cmux with injected files incl. one real save with a
     forced failure, cleaned up. Not checked: a real video, HEIC, the
     all-files-succeed toast, the English UI.
   - **Media is added and removed in the edit panel, not on the card**
     (on request): the same picker section as the log form
     (`components/media-picker.tsx`, shared by both), showing existing
     media with × and an add tile; 10 per session counting existing ones.
     Changes are **staged until Save** like every other field, and Cancel
     discards them. Save PATCHes the fields, then deletes and attaches
     one request at a time (`attachFiles()` in `lib/upload-client.ts`);
     a failure is counted and reported by toast, never thrown. Removing
     also moved off the card — **not asked for**: the old hover × sat on
     top of the new tap-to-view area, so a tap could have deleted a
     photo. Avery was told and hasn't objected.
   - **Tap a thumbnail to view it full-screen** (`components/media-viewer.tsx`,
     on request): dark overlay, prev/next buttons, `2 / 3` counter, ←/→,
     Escape / close / backdrop to dismiss. A video is a still with a play
     icon on the card (`#t=0.1` so WebKit paints a frame) and plays with
     controls in the viewer. No swipe gesture.
   - **Upload progress** (Avery picked "bar + per-thumbnail marks" from
     five options): a bar above Save with "Uploading 1 of 3…" and a
     percentage from real bytes sent (the PUT uses XMLHttpRequest because
     `fetch` can't report upload progress), and each picked tile is
     dimmed while waiting, then spinner → tick or red warning. The marks
     only exist during the save (the form resets / the panel closes
     after), so a failed file is known afterwards only from the toast.
   - Checked in cmux through the **edit panel** on a real session, then
     undone: add two photos, view and step through them at 775 and
     375 px, remove them; and three photos with the second forced to
     fail (bar 0 → 32 → 67 → 98 %, tiles uploaded / failed / uploading).
     Not checked: the log form's copy of the progress UI, a real camera
     video (only generated clips, see "Multi-user" → photos), the viewer
     playing a video, a slow connection, a failed delete.
   - **Edit panel copy**: header is "Conditions (entered by hand)" (no
     "Swelleye"), the button is "Refresh conditions" / "更新浪況" (was
     "Refresh Open-Meteo"; it also refetches CWA tide, so no source
     name), and the target icon beside "Which did you achieve?" is gone
     from both the edit panel and the log form. Other Swelleye mentions
     (tile label, badge, no-coordinates hint, landing copy) were left.

   **As of 2026-10-06** (commits `2a6f8aa`, `e5ddbae`, `7907d02`, pushed
   to `staging` the same day, deploy green incl. the new Test step;
   nothing below was tried on a real phone):
   - **MCP access** — a signed-in user makes a personal token at
     `/tokens` and an MCP client can then read and change that user's own
     session log through `/api/mcp`. See "MCP access". Also the first unit
     tests (`npm test`, Vitest) and a notes-sanitiser fix (see "Bugs
     already hit").
   - **"The neck" joins grey shapes on the session card** (on request,
     after a hang-tag reference; `components/pill-neck.tsx`): a thin stem,
     11 px thick with 3 px concave fillets, flat `fill-secondary`, no SVG
     filter. Used in three places, all checked in cmux at phone and wider
     widths:
     - **Board chip**: photo in a 30 px grey circle, stem, name pill
       (28 px). A board without a photo stays a plain pill. The stem SVG
       must stay the chip's **first child**: as the last child it painted
       over the photo's right 2 px (both are positioned, `z-index: auto`,
       so DOM order decides).
     - **Condition tiles** (`components/tile-group.tsx`): tiles keep an
       8 px gap and get one stem between each pair facing each other
       across it (phones: 3 horizontal + 3 vertical, two of them into the
       wide Tide tile; `sm` up: 4). Stems are drawn from the tiles'
       measured positions in a layout effect + `ResizeObserver` (DOM
       writes, no React state), so they appear a moment after load and
       **don't show on `/dev` pages in cmux** (no hydration). Cards
       missing a tile (no Period / temp / Tide) were therefore never
       looked at. The manual-`cond` tiles get no stems.
     - **Goals on the card** (`GoalSection` in `components/goal.tsx`):
       one blue tick in a 30 px grey circle, then one text-only pill per
       achieved goal, in a wrapping row. A pill gets exactly one stem:
       horizontal to its left neighbour, or, when it starts a new line,
       vertical up to the first shape of the line above (so a phone shows
       one spine down the left). Which one is measured after layout
       (`data-neck="left" | "up-circle" | "up-pill"`), hidden until then.
       Avery's spec was "icon - goal 1 - goal 2 - goal 3", one tick only.
       Not checked: a goal long enough to wrap inside its own pill.
   - **Goal card counts show only the number** (`✓ 3`, was `✓ 3 sessions`
     / `✓ 3 次`), on request; `goal.achievedSession(s)` now hold the
     screen-reader text ("achieved in 3 sessions" / "已達成 3 次") in an
     `sr-only` span. zh-TW not looked at in a browser.
   - **Notes have 12 px above them** (`pt-3`, was `pt-1`), on request.
   - **Tried the same day and removed on request — don't bring back
     unasked** (details in `.claude/agents/ui-designer.md` "Style
     references"): a ticket-shaped session card (slot-and-bridge, then two
     fused blocks, then a grey outer frame); the tiles butted together
     with pinched corners; a divider line above the notes (solid, dotted,
     inset, full-width were all tried); a transposed phone calendar
     (weekdays down the left, weeks as columns). The session card is the
     original single white card with one `border-card-border` outline.

`BACKLOG.md` (added 2026-09-29) is Avery's list of future features and
chores — **local only, gitignored** (not in the public repo, so it won't
exist on a fresh clone or in cloud sessions). The project skill `add-ticket` (`.claude/skills/add-ticket/`, renamed from `backlog` 2026-09-30) handles "add X to
the backlog" / ticking items into **Done** (short lines; details belong
here in CLAUDE.md).

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
  **Upload path since 2026-10-05** (`lib/blob.ts`, `lib/upload-client.ts`):
  `POST /api/uploads` returns a one-time signed URL, the browser PUTs the
  file straight to Storage, then `POST /api/sessions/:id/photos` or
  `/api/boards/:id/photo` with `{ uploadId }` attaches it.
  `registerUpload()` checks what actually landed (the signed URL limits
  neither size nor type): 50 MB cap, image/video only, and an id can be
  claimed once; a bad object is deleted. **50 MB is Supabase Storage's
  own per-file ceiling here** (measured 2026-10-05: 45 MB accepted,
  55 MB refused — it matches the free plan's limit; which plan this
  project is on was not checked), so raising the constant alone does
  nothing. The cap was 15 MB until Avery hit it with a video. Ids are random UUIDs, and an
  object is unreadable until it has an owner row. The old multipart
  routes are gone. Photos over 2560 px or 3 MB are redrawn to 2560 px,
  JPEG 0.9 (PNG stays PNG for transparency; GIF untouched; Avery asked
  not to lose much quality). **Videos over 16 MB are re-encoded in the
  browser** (`lib/video-compress.ts`, WebCodecs via the `mediabunny`
  package, MPL-2.0, dynamically imported): H.264 MP4, audio copied, aimed
  at ≤45 MB — 1080p at 5 Mbit/s, or 720p at 2.8 Mbit/s shrinking to a
  1.5 Mbit/s floor for longer clips; past ~4 minutes it is refused as too
  large. A clip already within the plan, a browser without WebCodecs, or
  any failure sends the original (console warning), which then has to be
  under 50 MB itself. The picker therefore accepts any size of video and
  the real check happens at upload. Measured in cmux (WebKit on this Mac,
  ffmpeg-generated clips, through the edit panel, then removed): 24 s
  1080p 40 MB → 7.9 MB in 3 s; 20 s portrait HEVC `.mov` 22 → 18.6 MB;
  100 s 1080p 121 MB → 29.5 MB at 720p in 69 s; all played back at full
  length. **The encoder does not reliably honour the bitrate**: an
  all-noise clip came out no smaller (original sent), so very detailed
  footage can overshoot the target. Never tried: a real iPhone clip,
  iOS Safari, the encode time on a phone. **Serving**: images up to 4 MB
  still go through `/api/blob/:id` with the year-long private cache;
  videos and anything larger get a 302 to a 1-hour signed URL after the
  same owner check, because a function's response is capped too.
  Not decided: whether the bucket should also get its own size/type
  limit (not set). **Deleting already frees storage**: deleting a
  session, removing one item in Edit, replacing or deleting a board
  photo all call `deleteBlob()` (object + row). The gap is an upload
  that is never attached (page closed between the PUT and the save): the
  object stays with no owner row; a clean-up was offered 2026-10-05, not
  built. To find them, list the bucket and subtract `photo_blobs` ids.
- **The spot catalogue is the one thing everyone shares** (2026-10-05):
  every signed-in user reads the same `spots` table. Only accounts in
  the `SPOT_ADMIN_EMAILS` env var (comma-separated Google emails,
  `lib/spot-admin.ts`; unset = nobody) can add, edit or delete spots or
  see the request list; non-admins get 404 from those routes and from
  `/admin`. Matched on the session email, not the Google `sub` — a
  stricter check was offered, not decided. Set in `.env.local` and in
  Vercel's Preview environment (not Production).
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

## MCP access (added 2026-10-06)

Avery asked to open MCP so users can create/read/update/delete their
session logs from an MCP client. Built in three steps the same day.

- **Auth is a personal access token, not OAuth** (Avery's choice from
  the two offered). An MCP client has no Auth.js cookie. Tokens are
  `sfl_` + 32 random bytes, shown **once**; only the SHA-256 is stored
  (table `api_tokens`, migration `20261006000000_create_api_tokens.sql`,
  applied to the live project 2026-10-06; RLS on / no policies). Scope is
  `read` or `write`; revoking sets `revoked_at` (the row stays); 10
  active tokens per owner (the agent's number). `lib/token-auth.ts`.
  **Consequence: claude.ai's "custom connector" flow won't work** — it
  needs OAuth. Offered as a later step, not built. Works with clients
  that take a header (Claude Code `--header`, Cursor, Claude Desktop via
  config).
- **Token management is cookie-session only** (`/tokens` page,
  `components/api-tokens.tsx`, `GET`/`POST /api/tokens`,
  `DELETE /api/tokens/:id`, avatar menu → API tokens): a leaked token
  must never be able to mint or list tokens. Every signed-in user can
  make tokens (not restricted to Avery — not explicitly decided, it
  was one of the open questions and went unanswered).
- **`lib/session-service.ts` is where session create/update/delete
  lives now** (`createSessionFor(ownerId, body)`, `updateSessionFor`,
  `deleteSessionFor`), returning `{ ok, data }` / `{ ok: false, status,
  error }`. `app/api/sessions/**` are thin wrappers. Anything new that
  changes sessions goes through it, so the ownership checks, validation
  and condition refetch can't drift between the web app and MCP.
- **Endpoint** `app/api/mcp/route.ts`: Streamable HTTP, stateless,
  via `mcp-handler` 2.x + `@modelcontextprotocol/server` 2.x (MCP SDK
  v2: `registerTool` with a full `z.object`, not the 1.x
  `@modelcontextprotocol/sdk`). `proxy.ts` lets exactly `/api/mcp` past
  the cookie gate, so **the route's own bearer check is the only thing
  protecting it**. The server is built per request around the verified
  token, so tools close over one `ownerId`.
- **Tools** (`lib/mcp-tools.ts`): `list_sessions`, `get_session`,
  `list_spots`, `list_boards`; with a write token also `create_session`,
  `update_session`, `delete_session` (a read token doesn't get these
  registered at all). Sessions come back in a compact shape (what the
  card shows: headline conditions, tide trend + next turning point, CWA
  first like the card), not the stored blobs. A foreign id is "not
  found", same as the routes.
- **The agent's choices, not Avery's — change if they bite**: `when`
  must be on the 2-hour grid (even hour, `:00`) so MCP-made sessions
  edit cleanly in the UI; `notes` is plain text and `update_session`
  **replaces the whole note**, losing bullets/bold (the tool description
  warns the model); only catalogue slugs are accepted (no `req:`); no
  goal ticks, photos/video, boards or spot admin over MCP.
- **Rate limit** (`lib/rate-limit.ts`): per owner, across all their
  tokens — 120 requests/min at the route (429 + `Retry-After`), 60
  changes per 10 min in the write tools. **In memory, per server
  instance**: on Vercel a second warm instance has its own counters, so
  it stops a runaway loop but is not an exact quota. A Postgres-backed
  counter was the alternative, skipped to avoid a round trip per call.
- **Notes are untrusted text to the model**: tool descriptions and the
  server instructions say to treat `notes` as data.
- **Tests** (`tests/*.test.ts`, `npm test`, also a CI step in
  `deploy-staging.yml`): 58 unit tests, Supabase and the condition
  sources mocked — session-service (ownership, validation,
  refetch-on-change, media freed on delete), the tools (scopes, foreign
  id, time grid, write limit), rate limit, token header parsing,
  sanitiser. Vitest **4**, because Vitest 5 wants `@types/node` ≥22 and
  the repo is on 20; config is `vitest.config.mts`.
- **Checked 2026-10-06** on the local dev server with curl and fake
  owner ids (all rows removed after): no/revoked token → 401; create
  fills conditions; changing spot+date refetches (tide switched to CWA
  for a future date); bad time/spot/board refused; get/update/delete on
  a real session id of Avery's → "not found", row intact; the 121st
  request in a minute → 429. Token create/revoke/cap/hash were checked
  against the live table by script.
- **Never tried**: a real MCP client (only raw JSON-RPC over curl), the
  `/tokens` page in a browser, a real token on staging, the zh-TW token
  strings (written by the agent, unreviewed). On staging only the
  signed-out behaviour was checked (2026-10-06): `POST /api/mcp` without
  a token → 401 with `WWW-Authenticate: Bearer`, `/tokens` → redirect to
  sign-in. No new env var was needed.

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
comparisons exist. **Exception, 2026-09-28: tide.** CWA is displayed
whenever the session has CWA events (see "Status"). Why:
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
- **Marine endpoint** (swell, period, direction): data from
  **early Oct 2021** (2021-09-01 null, 2021-10-05 present). Older → null.
- **`sea_level_height_msl`** (→ `tideEvents`, the tide tile): from
  **~Nov/Dec 2022** (2022-11-01 null, 2022-12-01 present). Older → no tide.
- **`sea_surface_temperature`** (→ `seaTempC`, the water-temp tile): also
  from **~Dec 2022** (2022-11-01 null, 2022-12-01 present; checked
  2026-09-29), not Oct 2021 like swell.
- **Wind** and **air temp** (`archive-api`, used for dates >6 days old):
  back to **1940** (2010-01-01 returned data).
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
  carries its CWA `LocationName` as `tideTownship` in the `spots` table
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
  **The card's tide source whenever `events` is non-empty** (hidden
  2026-09-25 to 2026-09-28; restored because it was within 3-15 min of
  Swelleye/Windy where Open-Meteo ran 20-65 min early — see "Status").
  Open-Meteo `tideEvents` is the fallback for past dates and overseas.

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

### CWA vs Open-Meteo temperature (checked 2026-09-29, not built)

CWA `O-B0075-002` (marine obs, hourly, last 30 days — `-001` is 48 h)
has `SeaTemperature`/`Temperature` per station; station coordinates are
in `O-B0076-001`, a **file** API
(`/fileapi/v1/opendataapi/O-B0076-001?...&downloadType=WEB&format=JSON`),
not the datastore. Compared 2026-08-30..09-28 for the 30 stations within
25 km of a spot, against Open-Meteo at that spot's coordinate (what the
card shows), ~717 hourly pairs each:
- **Sea temp: Open-Meteo runs warm.** Bias −0.8 to +2.5 °C, typically
  +1 °C; 20 of 29 stations ≥ +0.5. Worst on the north coast (Longdong/Fulong
  +1.6 to +2.5, Keelung +1.9, Wushi +1.7, Penghu +1.8); best at Hualien
  (−0.1), Tainan/Qigu (~0). Nearest to Jialeshui, Eluanbi buoy 46759A:
  +1.0. Many stations are harbour tide gauges, which may not represent
  the break either.
- **Air temp** (9 stations): bias −0.4 to +1.4 °C, hourly MAE 0.8–1.8 —
  fine for a card.
So the water figure is roughly right but typically ~1 °C high. A per-spot
CWA source would need a nearest-station map and is only 30 days back.

**Decision 2026-09-29: keep Open-Meteo for the water-temp tile.** Same
reasoning as "The automation problem": the bias is steady per spot, so
comparing sessions at one spot still ranks correctly, and it fills every
session (past, overseas) the same way. **No offset correction**: the
bias varies by spot (~0 to +2.5 °C) and rests on 30 days of September
only. Revisit if winter north-coast sessions start mattering, where
+2 °C could change wetsuit choice — that's where CWA buoys would earn it.

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
  the start and declined. This repo had an optional 1-5 `rating`, used on
  3 sessions, and **removed it on request 2026-09-29** (UI, API, CSV,
  types). The `sessions.rating` column and those 3 values are still in
  the DB, unread — dropping it is a separate, irreversible call.
  `goal_met` (see "Goal for next session") is the only outcome-like field
  left.

So the features can be computed but not checked. Weak corroboration exists —
`facing` and `bestSwellDir` are independent published fields and they agree
(Nanwan: exposure 0.07, outside window, and its description says "flat most of
the year") — but that is close to circular.

**The fix is one field: a 1-5 star or even binary good/bad on each session.**
It came up three times, was built, and was then removed at Avery's request
(2026-09-29) — so don't re-add it unasked. Without an outcome, spot fit
stays a plausible unverified heuristic.

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
`ownerId`/`condOpenMeteo`/`condCwaTide`. This repo's schema
(`lib/types.ts`) is that plus all three — backed by the `sessions` table in
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
  spot:       string     // `spots.slug` ("waiao", "cloud-9"), "req:<id>" for a pending
                         // spot request, or legacy "custom:Free text" (0 rows use it)
  when:       string     // "YYYY-MM-DDTHH:mm", local time AT THE SPOT (its timezone), 2-hour grid
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

**Board rack** (added 2026-09-25, migration
`20260925000000_create_boards_table.sql`, live on the Supabase project —
checked 2026-09-28): table `boards` (`id`, `owner_id`, `brand`,
`length_in`, `volume_l`, `rocker` low/medium/high, `note`, `photo_id`),
per owner, RLS on / no policies. `sessions.board_id` references it with
`on delete set null`, so deleting a board never deletes sessions.
Session create/update 404s a `boardId` the caller doesn't own
(`lib/board-access.ts`). Board photos reuse the session photo pipeline —
`photo_blobs` gained a nullable `board_id` (exactly one of
`session_id`/`board_id` set) — and are served by the same owner-checked
`/api/blob/:id`. Routes: `app/api/boards/**`. UI: `components/board-rack.tsx`
(below the calendar/table), `components/board-select.tsx` (log form + edit
panel), a board chip on each session card.
**常用 / go-to boards** (2026-09-30, migration
`20260930000000_add_board_favorite.sql`, applied to the live project the
same day; replaces the single default board of 2026-09-28/29).
`boards.is_favorite`, any number per owner. Toggled from the board card's
⋯ menu (設為常用 / 取消常用, `PUT`/`DELETE /api/boards/:id/favorite`); a
teal "✓ 常用 / Go-to" badge shows on favourites only — adding to 常用 stays
⋯-menu-only, but the badge itself is also a button (2026-10-01) that
removes: clicking it calls the same `toggleFavorite()` the menu item uses
(✓ swaps to × on hover/focus as the "clickable, removes" affordance; a new
`t("board.removeFavoriteLabel")` aria-label). Disabled back to a plain
`<span>` while **排序 / Reorder** mode is on, since then the whole card is
the drag surface and a drag starting on the badge must never be read as a
click. Favourites are listed first in the rack and the log form's board
picker (`sortBoards()` in `lib/boards.ts`). The log form pre-selects the
**last-used board** (most recent session whose board still exists), else
the only favourite, else the only board (`preselectBoardId()`). Why: Avery
rotates a few boards, so "one default" didn't fit and 常用 reads as
plural. The old `is_default` column + one-per-owner index are still in
the DB, unread, so the previously deployed staging build keeps working —
drop them in a later migration once staging runs this code.

**Drag-and-drop reorder** (2026-09-30, migration
`20260930100000_add_board_sort_order.sql`, applied to the live project the
same day). The code reached the dev server a few minutes before the
migration, and in that window every new board failed ("column
boards.sort_order does not exist") — apply a migration before code that
reads its column runs, even locally. Adds
`boards.sort_order`, a flat per-owner integer, backfilled to match the
order every rack already rendered in (常用 first, then the rest, both by
`created_at`) so applying it doesn't visibly reorder anyone's boards.
`listBoards()` now orders by `sort_order` then `created_at`; `createBoard()`
always assigns `max(sort_order for that owner) + 1`, i.e. end of the rack,
regardless of what the caller passes. **常用-first grouping still happens
in `sortBoards()`, not in the column** — `sort_order` only orders boards
*within* whichever group they're in (favourite or not), so toggling 常用
doesn't need to touch it. New route `PUT /api/boards/order`,
`{ ids: string[] }` = the caller's full new order; 400 for a malformed
body, 404 (not partial-success) if the set of ids isn't exactly the
caller's current rack — same "don't confirm a foreign id" rule as every
other board route. Writes `sort_order` = array index per id, one request
per drop, returns `{ boards }`.
UI (`components/board-rack.tsx`, `@dnd-kit/core` + `@dnd-kit/sortable` +
`@dnd-kit/utilities` — peer deps `react >=16.8`, so React 19.2 here is
fine, verified via `npm view ... peerDependencies` before installing): a
`GripVertical` handle at the **start of the name row** (leftmost reads as
"grab here", and it's the one spot free at every breakpoint including the
phone stack, where the photo already fills the row above — the ⋯ menu
stays at the far right, untouched). The handle, not the whole card, is the
drag surface (`setActivatorNodeRef` + dnd-kit's listeners on just the
button) with `touch-action: none` scoped to it alone, so dragging works on
touch without also scrolling the page — dnd-kit's own documented pattern
for this. **One** `<SortableContext>` covers every card, in one flat
favourites-first array (`rectSortingStrategy`, not the vertical-list one,
since the grid is 2-up from `sm`) — not one context per group, which was
tried first and caused a flash on every 常用 toggle: React reconciles each
group's `.map()` against its own parent, so a card moving from the
favourites array to the others array (or back) was a different parent
subtree either way, an unmount+remount despite the unchanged key (photo
`<img>` reloading, `useSortable` re-registering) — fixed 2026-10-01. The
favourites-only / others-only *drag* grouping is now enforced purely in
`handleDragEnd`: a drop from one group onto the other is a no-op (nothing
in state changes), so the card **snaps back to its own group** rather than
toggling 常用 — chosen over "disallow" because dnd-kit doesn't make
mid-drag group-crossing easy to block outright, and a snap-back reads the
same to the user. Keyboard: Tab to a handle (it's a
real `<button>`), Space to pick up, Arrow Up/Down to move within the
group, Space to drop, Escape to cancel — dnd-kit's default `KeyboardSensor`
+ `sortableKeyboardCoordinates`, unmodified; **not verified in a browser**
whether the keyboard drag *preview* (as opposed to the final drop, which
`handleDragEnd` does guard) can visually cross the group boundary before
snapping back. `prefers-reduced-motion` disables the per-card CSS
transition (`usePrefersReducedMotion()`, a `useSyncExternalStore` hook —
not `useEffect`+`setState`, see "Conventions") but not dnd-kit's own drag
tracking. Reorder is optimistic (array reordered locally on drop, PUT
fired after) with rollback + `toast.couldntReorder` on failure — same
pattern applied to the existing 常用 toggle the same day, once Avery
flagged it as laggy (0.6-1.7 s round trip): `toggleFavorite()` now flips
the board locally first, then reconciles with the single updated board the
route returns (`{ board }`, changed from `{ boards }` the same day) rather
than waiting on a full list re-fetch. The route itself went from 3
Supabase round trips to 1 (`setBoardFavorite()` updates with an
`owner_id` filter and `.select()`; no matching row → 404). Measured in
cmux: badge appears 47 ms after the click; request ~0.3 s.
**排序 / Reorder mode** (option D, chosen 2026-09-30 over a louder handle,
long-press, a coach mark or a caption): the ⋮⋮ handles only exist after
tapping 排序 in the rack header (shown with 2+ boards); while it's on,
完成 / Done replaces the header buttons, a hint line explains the 常用-first
rule, each card's ⋯ menu is hidden, and dragging is disabled outside the
mode (`useSortable({ disabled: !sorting })`). **In the mode the whole
card is the drag surface** (changed the same day on request — was the ⋮⋮
handle only; the ⋮⋮ icon was then removed entirely, and the hint reads
"拖曳卡片調整順序，常用板固定在最前面。"): listeners + keyboard
attributes on the `<li>`, `touch-none` only while sorting. Known trade-off:
while sorting on a phone, a swipe starting on a card drags instead of
scrolling, and phone cards are tall (full-width photo: 375–489 px each at
375 px wide) — a compact sort layout (hide the big photo while sorting) is
the likely next step if that bites. Verified in cmux at 375 px: mode
on/off (card gets tabindex/touch-none/grab cursor only while sorting), and
a keyboard drag on the focused card (Space, ↑, Space) reordered two 常用
boards and saved — then moved back. Mouse/touch drag not driven from the
CLI.
Card layout (2026-09-30, measured in cmux): phones stack a full-width
photo at its natural height (plain static `<img>`, nothing cropped) above
the name row `name · 常用 badge · ⋯` (`name · 常用`, no ⋯, in 排序 mode) (⋯ transparent until hover /
open), then specs and note; from `sm` the photo is a small square beside
the text, capped at 96 px (absolutely-positioned `<img>` in a wrapper —
a stretched plain `<img>` blew up to 329 px in WebKit and squeezed the
text to one character wide).
`components/board-select.tsx` (the log form / edit panel picker) already
called `sortBoards()`, so it follows the saved order with no changes there.

**Goal for next session** (added 2026-09-28, migration
`20260928000000_create_goals.sql`, applied to the live project 2026-09-28).
Manual first on purpose: Avery chose technique goals and no AI yet, to see
whether goals get used before adding an AI "suggest from recent notes"
button (discussed: opt-in, only on tap, notes go to the Claude API, must
say "not enough in your notes" instead of generic tips). Table `goals`
(`owner_id` PK, `text` ≤200), one current goal per owner, edited inline
via `PUT /api/goal` (empty deletes) in `components/goal.tsx`'s card above
the calendar. Each new session **snapshots** the goal text into
`sessions.goal_text` plus `goal_met` (true / false / null = not checked),
picked in the log form; the edit panel can change `goal_met` only. A copy,
not a reference, so editing the goal never rewrites past sessions. The card
shows "met X of N" over sessions with the exact current text. Goal chip on
each session card; `goal`/`goal_met` in the CSV. This is also the first
outcome-like field — see "The unfalsifiability problem".

**Goal shown as points (added 2026-09-29).** Still one `goals.text` column,
and originally one `goal_met` per session; per-point ticks came later the
same day (see below).
Points are just newline-separated lines within that same string (200 chars
total, newlines included; `goalPoints()`/`joinGoalPoints()` in
`lib/goal.ts` split/join and trim/drop-empty). The card
(`components/goal.tsx`'s `GoalCard`) shows them as a bulleted list and
edits them as a row per point (text input + × remove) plus an "add a
point" input with a + button. **No Enter shortcut** (removed
2026-09-29 on request — it clashed with 注音/倉頡 candidate selection even
with an `isComposing` guard): points are added with +, the list saves when
focus leaves the whole block, Escape cancels. `GoalCheck` (log
form / edit panel) also renders the bulleted list. `GoalChip` (session
card) joins points with " · " onto one line — no room for a list there.
CSV keeps the raw newline-joined text (`cell()` already quotes it). An
old single-sentence goal is just a one-point list, no migration needed.

**Per-point ticks (added 2026-09-29, migration
`20260929000000_add_goal_points_met.sql`, applied to the live project the
same day).** The log form and edit panel show one checkbox per point
(`GoalCheck`); ticked = achieved, unticked = not — a plain two-state
checkbox by Avery's choice, so a skipped point counts as not achieved.
Stored in `sessions.goal_points_met` (jsonb boolean array, same order as
that session's `goal_text` lines). `goal_met` is still written, derived as
"all points achieved". Always read through `sessionPointsMet()`
(`lib/goal.ts`): sessions from before this only have `goal_met`, which
then stands for every point. **Counted per point by its own text
(2026-09-30)**: the goal card used to count only sessions whose whole
`goal_text` equalled the current goal, so adding/removing/editing any
point reset every count to 0. Now `pointStats()` (`lib/goal.ts`) counts
each current point across all sessions whose goal has a line with the
**exact same wording** (after `goalPoints`' trim), reading the tick at
that point's index in *that session's own* list (first occurrence if the
text repeats); sessions with no ticks are skipped. So a point added later
has a smaller total, a point removed and re-added gets its history back,
and a reworded point starts fresh — deliberately no fuzzy matching (a
wrong match would silently merge two goals). The card shows `met/total`
per bullet; a faint "since {date}" only on points whose history starts
later than the oldest point's; a faint "not tried yet" on a point with
no history while others have some; the "Not tried yet" line under the
list only when no point has any history. The old summary line ("Counts
from N session(s)…", "Tried in N session(s), not checked off yet") was
removed. The session chip shows
"2/3 achieved"; CSV gains `goal_points_met` (`yes;no;yes`).

**Spot descriptions** live outside sessions, in their own table
`spot_notes` (`owner_id`, `spot`, `description`, `updated_at`; primary key
`(owner_id, spot)`, migration `20260923000000_create_spot_notes_table.sql`).
A user's own free-text note per spot ("best at mid tide, crowded on
weekends"), edited inline in the "What you've surfed" table via
`PUT /api/spot-notes`; an empty description deletes the row. Per owner,
like everything else — same RLS-on/no-policies access model as `sessions`.

## Spots

**The `spots` table is the single source of truth since 2026-10-05**
(Avery's decision: one list, maintained by Avery). 76 rows: the 41
Taiwan spots (slugs unchanged, with their Swelleye fields and CWA
township), 9 in Siargao, 26 in Bali. Migrations
`20261005000000_create_spots_table.sql`, `…000100_seed_siargao_bali_spots.sql`,
`…000200_create_spot_requests_table.sql`, applied to the live project
2026-10-05. `lib/spots.ts` is now types and helpers only;
`lib/spot-fixtures.ts` is a static copy of the 41 Taiwan spots used
**only** where there is no database (landing page, `app/dev/`,
`scripts/compare-sources.ts`, a provider-less `useSpotCatalog()`) — it
is not kept in sync automatically. Server reads go through
`lib/spot-store.ts` (`listSpots()`, `resolveSpot(slug)`); client
components use `useSpotCatalog()` (`lib/spot-catalog.tsx`), never a
static import.

- **Why our own table**: no importable global list exists (checked
  2026-10-05). OpenStreetMap `sport=surfing` has 1,280 features
  worldwide (10 in the Philippines, 50 in Indonesia, some of them
  shops); Wikidata 37; WannaSurf and Surfline forbid reuse; a 5,890-row
  GitHub gist has no licence, matches WannaSurf's spellings, and puts
  Wai'ao ~18 km out. Never copy from those three.
- **Timezone per spot** (IANA, from Open-Meteo `timezone=auto` at
  creation). `when` is local time at the spot; `getConditions(lat, lng,
  when, timezone)` requests in that zone, and the log form's date/slot
  default to "now" there. Siargao and Bali happen to be UTC+8 like
  Taipei, so a timezone bug would only show at a spot elsewhere
  (Mentawai is +7) — none exists yet, so this path is unproven on real
  sessions. The activity calendar's "today" is still Asia/Taipei.
- **Seeds are OpenStreetMap objects** (id on every row, credit in the
  migration). Siargao rows are the break's own node; **Bali rows are the
  beach in front of the break**, fine for a ~10 km model cell. Cemetery
  (Siargao) is the least certain pin. Left out for lack of a real
  location: Keramas, Kuta Reef, Airport Reef, Serangan, Lacerations,
  Playgrounds, Tuesday Rock, G1 — add them in the app, never guess.
- **Adding a spot** (admin, `AddSpotDialog`, `POST /api/spots`): pasted
  coordinates or a Google Maps link (short links are followed
  server-side) or current GPS on tap. Country and area are detected
  (`/api/spots/locate`: a spot within 30 km wins, else Nominatim) and
  stay editable — Nominatim says "Surigao del Norte" for Siargao.
  Refused within 100 m or with the same name nearby; 100 m-1 km asks
  "is it different?" (Cloud 9 / Quicksilver / Jacking Horse are
  ~220 m apart, so a flat 1 km rule would block real breaks). The
  "no sea data" check only catches deep-inland pins (Ubud snapped to a
  node 17 km away), so the card's grid node still matters. A spot with
  any session can't be deleted. The dialog edits name, Chinese name,
  country, area, location and facing only — **not** the Swelleye
  fields or CWA township (kept on save, changeable only by SQL).
- **Requests** (`spot_requests`, `components/request-spot-dialog.tsx`):
  anyone can ask for a spot (name; location and note optional) and log
  against it at once — the session's `spot` is `req:<id>`, shown as the
  typed name, no conditions. Approving (creating the spot from it, or
  linking to an existing one) moves those sessions to the real slug and
  fetches their conditions for their own date; declining leaves them as
  typed. A user reads only their own requests (id, name, status); the
  full list with requester name/email is admin-only. **Email to Avery
  on a new request is wanted but not built**: `lib/spot-request-notify.ts`
  only logs; no provider chosen.
- **Admin page** `/admin` (`components/admin/spots-admin.tsx`), linked
  from the avatar menu with a pending count: requests with Approve /
  Decline, and the catalogue with search, add and edit.
- **Picker** (`components/spot-picker.tsx`, log form + edit panel):
  search over English/Chinese name, area, country; sections Requested,
  Recent (4), Near <last spot> (5 within 80 km), then Taiwan regions and
  `country · area` — **Siargao first, then Bali** (`AREA_PRIORITY`, on
  request), any other area alphabetical after; the admin page is plain
  alphabetical. Popover from `sm`, full-screen sheet on phones.
  "Near me" asks for location **only on tap** and keeps it in the
  browser (Avery's decision: no permission prompt on open); a new
  user's first group comes from the browser timezone instead. Admins
  get an "add" row, everyone else "request it". Neither location button
  explains itself before the browser's own prompt. "Use my current
  location" in the **request** form is different from "Near me": those
  coordinates are sent and stored with the request (admin-visible) —
  a one-line notice under it was suggested 2026-10-05, not built.
- **Checked 2026-10-05 in cmux**: picker with all 76 spots, search
  ("bali", "外澳"), keyboard, 375 and 1280 px; picking Uluwatu shows the
  local-time note; `/api/conditions` returns full data for Uluwatu and
  Cloud 9; `/admin` lists and searches, edit dialog opens. **Never
  exercised** (each writes to live data, or needs a second account):
  creating/editing/deleting a spot, sending/approving/declining a
  request and the session re-pointing, the non-admin view, "Near me",
  real IME typing in the search box.

The rest of this section is how the 41 Taiwan rows were harvested.
Slugs are NOT derivable from names (`wushi-north`,
`eight-immortals-cave`, `greenbay`). (This file once said 42 spots; it
has always been 41.)

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

## Testing in the browser (cmux)

Avery runs the app in cmux, whose browser is already signed in to the
local dev server. **Use the cmux CLI to test UI changes** instead of only
type-checking (Avery's standing instruction, 2026-09-30):
- `cmux tree` lists surfaces: the `npm run dev` terminal and browser tabs
  on `localhost:3000/` (real journal), `/dev/*` (showcase), staging.
- `cmux browser surface:N reload | wait --load-state complete | eval '<js>'
  | screenshot --out <png> | errors list | click <css> | press Escape`.
  Measure layouts with `eval` + `getBoundingClientRect()` rather than
  eyeballing screenshots.
- `cmux browser surface:N viewport 375 850` emulates a phone; **always
  `viewport reset` afterwards**. The native pane is ~425-810 px wide, i.e.
  below `lg` — emulate 1280 for desktop layouts.
- `cmux read-screen --surface <dev-terminal> --scrollback --lines 2000`
  reads the dev server log (request timings, server errors).
- Screenshots are 2x at the pane's native width but **1x under `viewport`
  emulation**; to judge fine detail (seams, curves) crop and zoom a
  native-width shot (`sips -c <h> <w> --cropOffset <y> <x>`). After a
  `viewport` change wait ~1 s before measuring anything positioned by a
  `ResizeObserver` (the necks): an immediate read showed a stale state.
- Limits: native file pickers and `window.confirm` block automation — don't
  trigger them; synthetic `hover` doesn't apply `:hover`; the tab is
  Avery's **real** data — only reversible actions, and undo any test
  change (e.g. a 常用 toggle) before finishing.
- A file `<input>` can be driven without the native picker: build a
  `File` in page JS, put it in a `DataTransfer`, set `input.files`, and
  dispatch a bubbling `change` (used 2026-10-05 for both upload paths).
  When checking that a deleted photo is gone, fetch with
  `{ cache: "no-store" }` — `/api/blob/:id` is cached for a year, so a
  plain fetch still returns 200.
- **A hidden cmux tab stalls**: with `document.visibilityState ===
  "hidden"` (Avery looking at another tab) timers slow down and an
  upload froze mid-way for minutes, then completed once visible
  (2026-10-05, first read as an upload bug). Check visibility before
  debugging a "stuck" request; a phone leaving Safari mid-upload may
  behave the same, untested. `cmux browser … console list` reads the
  page console; `network requests` is not supported on WKWebView.
  A test file can be served to the page from `public/` (delete it after).
- Commands here run under zsh: `set -- $var` doesn't word-split, and an
  unquoted `--include=*.ts` glob errors.

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
  looked perfectly valid. `getTide()` now returns null unless the session
  sits between two forecast events (the 7 h cap tried first was removed
  2026-09-24 — mixed tides leave gaps up to ~17 h). Anything that picks "the closest reading" needs a maximum distance.
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

- **"Supabase: JWT issued at future", intermittent 500 on `/`** (hit
  often in dev; fixed 2026-09-30). Thrown from `listSessions` in the page's
  server render. Not our clock (local and Supabase's `Date` header matched
  to the second) and not reproducible on demand (0/80 direct requests):
  Supabase's gateway turns the `sb_secret_` key into a fresh JWT per
  request, and PostgREST/Storage occasionally sees its `iat` a moment in
  its own future. Fix: `lib/supabase.ts` passes a custom `global.fetch`
  that retries only that error; everything else passes straight through.
  **Widened 2026-10-01**: 2 retries (250/500 ms) wasn't enough. `/` still
  500'd after ~1.5-1.9 s with every attempt rejected (from `getGoal`/
  `listSpotNotes`), so it's now 4 retries (250/500/1000/2000 ms, ~4 s
  max), and each retry logs `[supabase] "JWT issued at future"` to the
  dev log, so the dev log shows how long a skew window really lasts. Tested with a mocked fetch (one blip →
  recovers; persistent → still errors after 3 tries; other 401s → not
  retried). If it ever shows up after all 5 tries, it's a real Supabase
  incident, not this.

- **Vercel caps a function's request AND response body at 4.5 MB**
  (hit on staging 2026-10-05, fixed the same day). A phone photo posted
  as multipart to our own route got Vercel's plain-text `413
  FUNCTION_PAYLOAD_TOO_LARGE` before our code ran; the client's
  `res.json()` then threw, and Safari's wording for that is **"The
  string did not match the expected pattern"** — that toast means "the
  server answered with non-JSON", not a validation error. Local dev has
  no such cap, so it only shows on Vercel. Fix: direct-to-Storage
  uploads (see "Multi-user"). Never send file bytes through a route,
  in either direction, and parse error responses with
  `.json().catch(() => null)`.
- **The notes sanitiser double-escaped `&`, `<`, `>`** (found and fixed
  2026-10-06 while testing MCP). `sanitizeNotesHtml()` ran its
  text-escaper over text that was already HTML, so the browser's `&lt;`
  became `&amp;lt;` and a typed `R&D` or `3 < 4` displayed as `R&amp;D` /
  `3 &lt; 4`. It now leaves existing entities alone (`escapeHtmlText` in
  `lib/rich-text.ts`, regression test in `tests/rich-text.test.ts`).
  **Notes saved before the fix that contain those characters are still
  stored double-escaped** — not searched for, not repaired.
- **Dev server down mid-refactor** (2026-10-05): two agents editing the
  tree while `npm run dev` served it left every route 500ing for a few
  minutes (a deleted module still imported). When moving or renaming a
  module, finish its importers in the same step.

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

`.claude/agents/` — all run on Sonnet, except `push-stag` on Haiku
(changed 2026-10-06 on request):
- **`data-source-engineer`** — Open-Meteo and CWA fetches, new datasets,
  spot harvesting into the `spots` table. Its file records the verified API
  shapes and gotchas.
- **`localizer`** — translations, finding hard-coded strings,
  language-aware formatting.
- **`ui-designer`** (added 2026-09-29) — look and feel: applies the
  style references Avery gives (kept in the agent file's "Style
  references" list), plus layout, responsive changes, the tide chart /
  calendar SVG. No browser: it type-checks and
  lints only, so visual checks stay with the main session.
- **`storybook`** (added 2026-09-29) — a home-grown Storybook: dev-only
  showcase pages under `app/dev/` rendering each component in all its
  cases from synthetic fixtures (`app/dev/fixtures.ts`), indexed at
  `/dev`. Real Storybook was offered and declined (heavier setup).
  `app/dev/layout.tsx` 404s the whole tree in production, and `proxy.ts`
  lets `/dev` through without sign-in only when `NODE_ENV !== "production"`
  — both built 2026-09-29, so `app/dev/` pages are safe to commit.
  Pages (the `/dev` index and each page's captions are the source of
  truth for cases — don't copy case lists here):
  - `/dev/entry-card` — session card, ~26 cases (missing period/temp/
    tide, CWA vs Open-Meteo tide, manual `cond`, wind extremes, board,
    goal chip, notes); en/zh-TW toggle, 375/768/1200 px frames.
  - `/dev/dashboard` — the teal panel (goal, calendar, spots table, board
    rack): empty/typical overviews plus goal, calendar, table and rack
    edge cases. Mirrors `journal.tsx`'s panel markup locally (keep in
    sync); `BoardRack` calls `fetch` itself, so its actions fail there.
  - `/dev/board-rack` — the board list alone: empty/one/two/many boards,
    the default-badge `onlyBoard` toggle, missing brand/length/specs/note,
    rocker values, long CJK names/notes.
  - `/dev/activity-preview` — calendar with 1-4 months of history.
  - `/dev/signin-preview`, `/dev/color-preview` — sign-in page, colour
    swatches.
  Limits, all pages: **no photos** (`/api/blob/:id` is owner-checked;
  deliberately not bypassed), **Edit/Save/Delete/upload hit the real
  API and fail**, and **width frames don't trigger `sm:`/`lg:`** — those
  are viewport media queries, so resize the real window for breakpoints.

- **`push-stag`** (added 2026-09-29) — commits and pushes to `staging`
  only (`git push origin HEAD:staging`, never main, never force), after
  running lint + typecheck like CI; keeps `.env*`, `reports/` and
  Swelleye readings out; asks before applying pending migrations.

New agent files only load when a Claude Code session starts.

## Conventions

- Metric throughout: metres, seconds, m/s, °C. Never feet or knots.
  **One deliberate exception: surfboard length** is feet/inches (6'2"),
  because boards are sized that way everywhere, Taiwan included. Stored as
  total inches (`boards.length_in`), entered/shown as ft'in via
  `lib/boards.ts`. Board volume stays metric (litres).
- Times are local to the session's spot (its `timezone`; Asia/Taipei for
  every Taiwan spot), no timezone suffix stored.
- UI: white background, black text, single light theme (no dark mode —
  removed on request). Rounded components, Coinbase-ish: 24px cards, 16px
  tiles, pill buttons. Funnel Sans for UI and notes (since 2026-09-29, on
  request, to match og.com's body/heading font; was Plus Jakarta Sans; notes
  were Newsreader serif until 2026-09-22), IBM Plex Mono for readings. og.com's
  display face (Lateral) is a paid trial font, deliberately not copied.
  **Blue accent** (since 2026-10-02, replacing the earlier teal `#0E7C86`;
  see "Style references" for the posters involved): `--primary` is
  `#0018FF`, a fully saturated royal blue named by its own reference poster
  ("Daily Poster" design, Choky/gstudio) — buttons, the + button, badges,
  checkboxes, ring/focus, the dashboard panel tint (now a *solid* block of
  this blue, not a pale wash — changed on request the same session so the
  panel reads as one of the reference's own bold solid-colour fields).
  Unusually, this hex needs no darkening for contrast: blue contributes very
  little to WCAG's luminance weighting, so a maxed-out blue channel still
  reads as near-black in contrast terms — 8.16:1 on white, both as text-on-
  white and white-text-on-fill. `--primary` went through two earlier values
  the same session (a detergent-bottle poster's `#3B85EB`, which *did* need
  darkening to `#176ADE` for contrast; and a plain grey `#E4E4E4` page
  background, tried and reverted to white) before landing here — see
  `app/globals.css`'s own comment for the full history and contrast math.
  `--data` (a separate green reading accent for the tide curve and
  swell/wind direction arrow+compass) was tried and then retired the same
  session to resolve to this same blue, on request — one consistent accent
  rather than a blue/green split — **then moved again, later the same
  session**, off blue to the neutral badge grey (`--data: var(--badge)`,
  `#374151`), on request: readings shouldn't share the buttons/panel's
  blue. `direction-arrow.tsx`, `entry-card.tsx`'s `DirSub` and
  `tide-chart.tsx` still read the `--data` token/classes throughout all of
  this, so each move is a one-line change in `globals.css`, not a
  component edit. `--primary-vivid` (used once, for the activity calendar's
  "surfed" dot) is the same value as `--primary`. **Badges were a
  temporary exception, same session**: the board rack's 常用/Go-to badge
  (`--badge`/`--badge-foreground`, `#374151` on white, ~10.3:1) moved to
  a neutral dark grey + white, on request, once the solid-blue panel
  made a same-hue badge read as low-contrast next to it. **Reverted in a
  later session, still 2026-10-02** — see the "Badges moved back to
  blue" paragraph further down — once the panel itself moved to grey
  (so blue no longer competed with it): the go-to badge and the session
  card's goal chip both went back to `bg-primary`/`text-primary-
  foreground`. `--badge` itself is unchanged throughout; only which
  components read it moved.
  **The sticky header** went through a whole liquid-glass-pill design (a
  club poster's blue-blob-dissolving-into-grain reference, several
  revisions) the same day, and then — **later the same session, on
  request** — that was all replaced outright with something much
  plainer: a flat white bar, `position: sticky; top: 0`, no rounding, no
  floating gap, no blur/translucency. Its *background* is full-bleed
  (spans the entire viewport), but the logo and `+`/avatar (or, on the
  signed-out landing page, the language toggle + Sign in) sit in an
  inner `max-w-[...]`/`mx-auto`/`px-4.5` column — the same one the page
  content below uses — so they line up with the dashboard panel/cards
  under them rather than tracking the viewport edges (tried full-bleed
  content too, for one revision, before this). Its old 1px `border-b` is
  gone, replaced by `components/header-underline.tsx`: a **flat 3px
  black line**, `inset-x-4.5` within that inner content column so it
  matches the *dashboard panel's* own width below (the panel is itself
  inset from the column by the same `px-4.5` — tried flush to the
  column's outer edge first, which ran wider than the panel/buttons
  under it), that dips into a smooth, shallow wave under the `+` button
  and the avatar specifically — as if underlining those two controls
  rather than the header as a whole — with a little clearance between
  the buttons and the line itself (tuned down from a first pass, both
  the gap and the dip depth — a deeper dip over the buttons' fixed 40px
  width read as sharper/V-shaped rather than round, so shallower is what
  actually reads as a gentle wave), then turns upward at its own right
  end into a true circular-arc "card corner" (`--r-tile`, on request —
  the left end stays flat, flush under the logo). The avatar's dip sits
  flush to that same right edge by design, so without clamping it would
  fight the end curve for the same few pixels and the path jumped
  backward on itself (a real bug, caught from the live SVG `d` string,
  not by eye) — `header-underline.tsx` now auto-nudges any dip left just
  enough to clear the end curve (and clear each other), rather than
  journal.tsx hand-tuning pixel offsets to dodge it. Landing's header
  has no matching pair of same-size circular controls (a variable-width
  language toggle beside a Sign in pill, not two 40px circles), so it
  renders the same component with no dips, just the plain line (still
  gets the right-end curve). The dip x-positions are computed from fixed
  layout constants (button size, gap — already fixed by Tailwind classes
  next to the call site), not measured off the actual button DOM nodes.
  This line went through two earlier concepts
  the same session before landing here — a bold (`7px`) line with
  upturned ends (first bezier curves, then true circular-arc "rounded
  card corner" curves, `--r-tile`), and before that a full
  surfboard-rocker-with-a-swept-fin silhouette — see that component's
  own comment and `.claude/agents/ui-designer.md`'s "Style references"
  for the full back-and-forth, including why the glass pill itself was
  dropped. Same bold-geometric reasoning sized the `+`
  button: it moved off blue to the neutral `--badge` grey
  (`bg-badge`/`text-badge-foreground`, a **darken**-on-hover
  `color-mix` rather than the default Button variant's lighten) and its
  `Plus` icon's `strokeWidth` went from lucide's default 2 to 3.5, both
  on request. **Hides on scroll down, reappears on scroll up** (a
  Medium-style pattern, also on request) — `lib/use-auto-hide-header.ts`,
  a ref-based hook with no React state per scroll event (a plain
  passive-scroll + `requestAnimationFrame` listener toggling a
  `data-autohide` attribute directly), always shown within one header-
  height of the top, while focus is inside it, or while a Radix
  popover/dialog whose trigger lives in it is open (the journal's log-
  session dialog opens from a plain button, not a `DialogTrigger`, so
  its `formOpen` state is threaded in as `forceVisible` instead — nothing
  else needs a prop, the hook finds any other open trigger generically
  via `[data-state="open"]`). Under `prefers-reduced-motion` it never
  hides at all, rather than hiding without a slide — see the hook's own
  comment for why. Two real bugs worth remembering, both caught live
  while verifying this, not by eye — see "Bugs already hit": `el.offsetTop`
  for a **currently-stuck** `position: sticky` element isn't reliably its
  static pre-scroll position in Chromium (it returned the live `scrollY`
  instead once stuck, breaking the "near top" check); and giving the
  header's content column a `max-width` while it's a flex child of
  `<body>` needs `min-w-0` on it too, or a wide enough descendant (the
  patterns table's own `min-w-[420px]`, itself correctly scrollable
  within its own card) can still push the *whole column* wider than the
  viewport via flexbox's `min-width: auto` default.
  **2026-10-02, later the same day: the flat white bar above went solid
  blue, its black underline removed** — "make the whole header bg color
  blue (same as the dashboard bg color); remove the black underline
  border." `bg-primary-soft` (the dashboard panel's own token, already a
  solid fill of `--primary`) applied straight to the header's background
  in `journal.tsx`/`landing.tsx`, so header and panel can't drift apart;
  the panel's existing `mt-8` gap (plain white page background) keeps
  the two blue blocks from reading as one fused shape rather than two.
  `<HeaderUnderline>`/`components/header-underline.tsx` — everything
  described in the paragraph above — is deleted outright, same treatment
  as the glass pill before it, not left as dead code. Black-on-`#0018FF`
  is only ~2.6:1, so most things inside the bar were re-picked for
  legibility on it: the log-session `+` button and landing's "Sign in"
  pill flipped from filled-blue/dark-grey to a white fill with a blue
  glyph/label (mirroring the landing page's own existing `inverted`
  `CtaButton` pattern on its closing CTA, rather than inventing a second
  one); the avatar's no-photo fallback (`user-menu.tsx`) moved off
  `bg-primary` — which would vanish on this background — to the neutral
  `--badge` grey; and every one of those buttons' `focus-visible` rings
  was pinned to white, since the default ring colour (`--ring`) is this
  same blue and would otherwise disappear against it. The language toggle
  pill (`bg-secondary`, light grey) needed no change — light on blue
  already reads clearly. **The wordmark is the one exception, by
  request**: a white version (`brightness-0 invert`) was tried and
  reverted the same session ("surflog logo text should remain black") —
  it stays black-on-transparent at ~2.6:1 on this blue, under the small-
  text floor, kept anyway for the logotype specifically. Not taken:
  recolouring anything *inside* the dashboard panel, or the panel's own
  tint — only the header moved.
  **Also the same session: the `+` button's icon became Avery's own
  mark**, not lucide's `Plus`. `surflog+button.png` (300×257,
  black-on-transparent, a chunky square-ended plus, not a symmetric
  cross) was rebuilt as an inline `<svg viewBox="0 0 300 257">` with two
  `<rect>`s (`LogIcon` in `journal.tsx`) rather than used as an `<img>`,
  so it stays crisp at any size and takes `currentColor` (the button's
  `text-primary`) instead of needing its own colour treatment; sized
  `h-[17px] w-5` to keep the 300:257 aspect at roughly the old icon's
  20px width. A real bug caught on this same button, live, not by eye
  (cmux's synthetic `hover` doesn't trigger real `:hover` — see "Testing
  in the browser (cmux)" — so a first pass missed it): the default
  shadcn `Button` variant's own `hover:bg-primary/80` isn't removed by
  a custom `className` unless that className supplies a *matching*
  `hover:bg-*` utility of its own (`cva`'s plain string concatenation
  here has no general class-conflict merging — see `cva`'s source, or
  `components/ui/button.tsx`) — so on real hover the white circle picked
  up a blue tint, which against the header's own blue read as the whole
  button vanishing rather than just dimming. Fixed with an explicit
  `hover:bg-card` alongside the existing `hover:brightness-95`.
  **Same session, one more follow-up: the dashboard panel moved off blue
  to light grey; the header above it stayed blue.** "Change the dashboard
  panel's background to light grey" — not the header, which stays
  `#0018ff`. Up to this point the panel's token (`--primary-soft`) *was*
  a solid fill of `--primary`, so header and panel were briefly the exact
  same colour, stacked directly on top of each other. Split apart: the
  header now reads `bg-primary` directly; the panel's token became
  `--panel: #f2f5f5` — the literal value of `--secondary`/`--muted`, not
  a new, slightly-different grey (a candidate near `#EEF0F2` was
  considered and dropped as too close to `#f2f5f5` to read as deliberate
  rather than an accidental near-miss of an existing token). Renamed
  `--primary-soft` → `--panel` everywhere (`app/globals.css`,
  `components/journal.tsx`, `components/landing/landing.tsx`'s two panel
  wrappers, `app/dev/dashboard/page.tsx`), since "primary-soft" stopped
  describing a tint of `--primary` at all. Each section inside still
  keeps its own opaque white `bg-card` surface, so the grey — like the
  blue before it — only shows in the panel's own padding and the gaps
  between cards, never behind text. The header/panel gap
  (`journal.tsx`'s `mt-8`) is unchanged — it mattered most while both
  blocks were the same blue, but stays as the cleaner break between two
  now-differently-coloured blocks rather than being removed.
  **Badges moved back to blue, 2026-10-02, a later session:** "change
  the go-to badge to blue bg white text; same for the badge in log
  card." The board rack's 常用/Go-to badge (`components/board-rack.tsx`)
  and the session card's goal-achievement chip (`GoalChip` in
  `components/goal.tsx`) both went from `bg-badge`/`text-badge-
  foreground` (the neutral dark grey described in the two paragraphs
  above) to `bg-primary`/`text-primary-foreground` — the same solid
  `#0018ff`, white text, 8.16:1. The landing page's demo quiver badge
  (`components/landing/landing.tsx`) was updated to match, so the
  signed-out page doesn't show a badge style the real app no longer has.
  **`--badge`/`--badge-foreground` themselves are untouched** — still
  read by `--data` (`var(--badge)`, the swell/wind direction arrow+
  compass and tide curve) and the avatar's no-photo fallback
  (`user-menu.tsx`), both of which stay dark grey; only the two/three
  components above stopped reading the token. The go-to badge's hover/
  focus classes moved from `hover:bg-badge/90` to `hover:bg-primary/80`
  (matching `components/ui/button.tsx`'s own default-variant hover) so
  no stale grey hover class was left behind — it's a plain `<button>`
  with a static `className` string, not a `cva` variant, so there was
  no second, conflicting hover utility to worry about this time (unlike
  the `+` button bug just above). Checked in cmux on the real journal
  at 375 and 1280 px: both the go-to badge and a goal chip compute to
  `rgb(0, 24, 255)` background / white text at both widths.
- Notes are rich text with a markdown-ish `- ` shortcut for bullets. Capy writes
  notes in Chinese; don't break CJK handling.
