---
name: verify-surflog
description: Launch Surflog (Next.js on localhost) and prove a user-facing flow in Chrome, capturing screenshots and a transcript. Use when a change to the landing page, journal, sessions, spots, boards, uploads, or sharing needs an end-to-end check, or when an agent is asked to verify Surflog in the browser.
---

# Verify Surflog

Surflog is a web app. The primary surface is the Next.js UI on port 3000. Secondary surfaces, not driven by this skill: `POST/GET /api/*` (cookie session), `/api/mcp` (bearer token), and `npm test` (Vitest, Supabase mocked). There is no Playwright or Cypress project.

Two dev servers in one checkout cannot run side by side. `next dev` locks `.next`, and every instance reads the same `.env.local`, so they would share one Supabase project. Do not start a second copy. A different `PORT` in another worktree still shares the database if it uses the same keys.

Signed-out pages are the only ones this environment can drive with no extra secrets. The journal, session save, video upload, spots catalogue, board rack, and share dialog need a real Google sign-in plus Supabase. Nothing in `auth.ts` or `proxy.ts` bypasses that, and this skill must not add a bypass.

## Launch

From the repo root, once per machine:

```bash
npm ci
```

Then:

```bash
.cursor/skills/verify-surflog/scripts/launch.sh
```

That runs `npm run dev -- --hostname 127.0.0.1 --port "${PORT:-3000}"` (`next dev --webpack`). It waits until `GET /` returns 200 and the HTML contains the signed-out hero `Log it easy. Surf it better.` A process that is merely listening, or a 500 page, is not ready. First compile can take a couple of minutes; the script waits up to three minutes and prints `run/dev.log` if the process dies.

From an empty checkout there is no data directory to seed. `data/sessions.json` is the retired file store and is not read. Schema lives in `supabase/migrations/` and is applied to a Supabase project, not to a local folder.

What launch does to env, and what it refuses to invent:

- If `.env.local` has no `AUTH_SECRET`, the script appends one (`openssl`-equivalent random, mode 0600) so Auth.js can sign a cookie. It prints that it wrote the key and never prints the value. `.env*.local` is gitignored.
- It does not set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, or `CWA_API_KEY`.
- An existing non-empty `AUTH_SECRET` is left alone.

Usable without those secrets: `/` (landing), `/signin`, `/dev` (dev server only), and the auth redirects. `GET /api/health` answers `503 {"ok":false}` until Supabase answers a one-row `spots` read (`lib/health.ts`). The landing hides its live spot count when that read fails (`getLandingSpots`) and still renders.

Usable only with secrets, on a machine that can complete Google's prompt:

| Need | Why |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Every journal read and the `photos` bucket. Server-only; the secret key bypasses RLS. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | The only provider in `auth.ts`. Redirect URI must be `http://localhost:3000/api/auth/callback/google` (or the origin you actually serve). |
| A human Google account | OAuth cannot be finished headless. On Avery's machine the `cmux` browser is already signed in; a fresh VM is not. |
| `CWA_API_KEY` | Taiwan tide tile only. Open-Meteo needs no key. A session still saves without it. |
| Migrations applied on that Supabase project | `supabase db push` against the linked project, including `20261023000000_add_session_tags.sql` before tag writes. |

Local Supabase is the legitimate stand-in for the hosted project, and it is not set up in this repo: there is no `supabase/config.toml`, and this VM has neither Docker nor the Supabase CLI. When those exist, `supabase init` (once), `supabase start`, apply `supabase/migrations/`, create a private Storage bucket named `photos`, and point `.env.local` at the local API URL and service-role key. That still does not sign anyone in. Do not point a verification run at the production project `tosozexlcqedocfcckwh`.

Teardown is `scripts/cleanup.sh` (below). It does not delete `.env.local`.

## Doctor

Read-only. Run after launch, before driving:

```bash
.cursor/skills/verify-surflog/scripts/doctor.sh
```

Pass an evidence directory to also write `doctor.txt` there:

```bash
.cursor/skills/verify-surflog/scripts/doctor.sh "$(cat .cursor/skills/verify-surflog/evidence/LATEST)"
```

It exits 0 only when all of these hold:

- `run/pid` is alive and its command line is this `npm run dev` / `next dev`, not some other Node process.
- Port `run/port` (default 3000) is listened on by that pid or a descendant. It will not kill a stranger on the port.
- `GET /` is 200 and contains `Log it easy. Surf it better.`
- `GET /signin` is 200 and contains `Continue with Google`.
- `GET /spots` is a 302/307 to `/signin` with a `callbackUrl` (no cookie).
- `GET /api/sessions` is 401 `{"error":"unauthorized"}`.
- `GET /dev` is 200. Production builds 404 `/dev` (`app/dev/layout.tsx`), so this is the "right build" check: a `next start` production server fails it.
- `GET /api/auth/session` is 200 and has no user id. That is a valid signed-out auth state. A 500 is a failure.
- If both Supabase variables are set, `GET /api/health` must be 200 `{"ok":true}`. If they are unset, 503 `{"ok":false}` is reported as info, not a failure. A `500` whose body is the dev overlay (`Manifest file is empty`, a compile race) is retried up to three times. Three failures still fail the doctor.

The report says whether Google, CWA, and `cmux` are present. It never prints secret values and never sends a POST.

## Drive

Harness is Chrome, driven by the DevTools protocol. Stable handles are the visible English strings (the server render is `en`; `localStorage` key `surflog:lang`) and the ARIA roles already in the components. Do not click by coordinates. Language in that browser is shared per origin via `surflog:lang` — put it back to `en` before finishing.

`/dev/*` renders the same components on synthetic fixtures and is useful for layout, but it is not a user path. Do not count a `/dev` page as proof that a journal write worked. `npm test` does not start the server.

The one journey that is fully specified as a script, and the one to run when proving this skill, is the signed-out landing:

```bash
.cursor/skills/verify-surflog/scripts/drive-landing.mjs
```

It opens a fresh Chrome profile (no cookies), sets a 1280×900 viewport, and does this:

1. Open `http://127.0.0.1:<port>/`. The `<h1>` must read `Log it easy. Surf it better.`
2. Click the `<button aria-pressed>` whose text is `中文` inside the language group (`aria-label` is `Language` in English, `語言` after the switch — match the button text, not the group label).
3. The `<h1>` becomes `輕鬆記錄每次下水，陪你衝浪進步的好幫手`, `document.documentElement.lang` is `zh-TW`, and `localStorage["surflog:lang"]` is `zh-TW`.
4. Click the `EN` button. The hero and `surflog:lang` return to English.
5. The `<h2>` `Conditions fill themselves` is on the page and the body text includes `Jialeshui` (the demo spot in `components/landing/landing.tsx`).
6. Navigate to `/spots`. The app must redirect to `/signin?callbackUrl=...` and show `Continue with Google`.
7. Back on `/`, click the header `<button>` `Sign in`. Record the host it lands on (do not store the query string; it is Google's, not ours). Then open `/api/auth/session` on this origin again. Success is **not** a Google account. Success is a body of `null` (no user id). With `AUTH_GOOGLE_*` unset, Auth.js still sends the browser to `accounts.google.com` with `client_id=undefined`, and Google shows an OAuth client error. With the credentials set, the same host shows the real account chooser. Stop there either way. `sign-in-observation.json` records the host, whether Google rejected the client, and the session body.

Other features are driven with the same Chrome (or with `cmux` when it is on PATH and already signed in) by following `features/`. Selectors for those journeys are in the feature files. If the precondition is missing, stop and record the failure. Do not retarget the journey at `/dev` to make it pass.

Side effects worth checking when a journey is allowed to write:

- A saved session is `201` from `POST /api/sessions` with `{ session }`, then a card under the `Sessions` heading, and `GET /api/sessions?page=1` includes that id. `condOpenMeteo` is filled only when the spot has coordinates and Open-Meteo answered; a failed fetch is not retried until the spot changes.
- Video and photos never go through the Next route as bytes. The picker (`input[type=file][accept="image/*,video/*"]`, aria-label `Add photos/video`) stages files; Save calls `POST /api/uploads` for a signed URL, the browser PUTs the bytes to Storage, then `POST /api/sessions/:id/photos` with `{ uploadId }`. The card then contains a `<video>` for a `video/*` item. Cap is 10 items and 50 MB (`lib/upload-client.ts`).
- A board is `201` from `POST /api/boards` and shows in `Your board rack`.
- A public share is a row the owner can turn off: switch `#share-link-switch`. On, the URL is `/share/<token>` (and `/share/<token>/card.png`). Off, that URL is 404. There is no `/s/<token>` route.

Unsigned curl checks belong in Doctor. They do not replace the clicks above.

Delete anything a signed-in drive created (session, board, token, pin) before cleanup. This is a private journal; do not leave probe rows. Video-upload proof is incomplete until those rows and storage objects are gone and a second `GET` confirms it.

## Evidence

Each drive creates a new directory:

```text
.cursor/skills/verify-surflog/evidence/<UTC-timestamp>/
  transcript.json
  01-landing-en.png
  02-landing-zh.png
  03-conditions.png
  04-signin-gate.png
  05-after-sign-in-click.png
  sign-in-observation.json
```

`evidence/LATEST` holds the absolute path of the newest directory. `doctor.sh <that-dir>` adds `doctor.txt`. The folder is gitignored (`evidence/` in this skill's `.gitignore`) because a later signed-in run would capture private session notes and photos.

`transcript.json` lists each step's `ok` flag. `passed: true` means the landing assertions held. The `note` field records what this run did not prove: the conditions block on the landing is demo copy from `components/landing/demo-data.ts`, not a `sessions` row, and Google sign-in was not completed.

A screenshot of a `/dev` page, a Vitest exit code, or a hand-edited React state is not evidence for a journal feature.

## Cleanup

```bash
.cursor/skills/verify-surflog/scripts/cleanup.sh
```

Reads `run/pid` and `run/chrome.pid`. Kills that process group only when `/proc/<pid>/cmdline` still contains `npm` or `chrome`. If the pid was reused by something else, it refuses and exits 1. It never runs `pkill`, `killall`, or matches a process name.

Removes `run/chrome-profile`, `run/port`, and the chrome pid files. Leaves `run/dev.log` (the server log) and the entire `evidence/` tree. Does not delete `.env.local` or any Supabase row.

After cleanup, confirm:

```bash
EV="$(cat .cursor/skills/verify-surflog/evidence/LATEST)"
test -s "$EV/transcript.json"
test -s "$EV/01-landing-en.png"
test ! -f .cursor/skills/verify-surflog/run/pid
```

## Helpers

All four live in `.cursor/skills/verify-surflog/scripts/` and are executable. Invoke from the repo root:

```bash
.cursor/skills/verify-surflog/scripts/launch.sh
.cursor/skills/verify-surflog/scripts/doctor.sh
.cursor/skills/verify-surflog/scripts/drive-landing.mjs
.cursor/skills/verify-surflog/scripts/cleanup.sh
```

`PORT` overrides the app port (default 3000). `VERIFY_BASE_URL` overrides the URL the driver opens. `VERIFY_CHROME_PORT` overrides Chrome's DevTools port (default 9333). `CHROME_BIN` overrides the browser binary (default `google-chrome`).

## Maintenance

When a flow's selectors, routes, or preconditions change, update the feature file in the same change. Use `/maintain-verification-skill` to re-check this map against the app instead of letting it drift.
