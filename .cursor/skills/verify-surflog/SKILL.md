---
name: verify-surflog
description: >-
  Drive Surflog's web UI (Next.js journal) with control-surflog: launch a
  disposable local instance, doctor it, exercise landing / sign-in / session-card
  / journal / spots journeys, and capture screenshots + ARIA proof. Use when
  verifying Surflog behavior in a browser, proving a UI change, or checking a
  feature map entry end to end.
---

# Verify Surflog

Surflog is a Next.js (App Router) surf journal. The primary user surface is the
**web UI** (landing, Google sign-in, private journal, spots, share links).
Secondary surfaces: MCP HTTP at `/api/mcp`, unsigned `/api/health`. There is no
Playwright/Cypress suite in the app; this skill is the scripted drive path.

Read `features/README.md` before a journey. Prefer a mapped feature file over
improvising selectors.

## Launch

Install app deps once at the repo root (`npm install`). Install the harness
deps once:

```bash
cd .cursor/skills/verify-surflog/scripts && npm install
```

Put `control-surflog` on your PATH for the shell (or invoke it by path):

```bash
CONTROL="$(git rev-parse --show-toplevel)/.cursor/skills/verify-surflog/scripts/control-surflog.mjs"
alias control-surflog="node $CONTROL"
```

**Modes**

| Mode | Command | Needs | Ready when |
|------|---------|-------|------------|
| `ui` (default) | `control-surflog launch --port 3456` | `AUTH_SECRET` auto-minted if unset; placeholder Google OAuth ids | `GET /dev/landing` → 200 HTML containing `Surflog` / logo |
| `full` | `control-surflog launch --mode full --port 3456` | Real `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (+ real Google OAuth for signed-in journeys) | Same ready path, **and** `GET /api/health` → 200 `{ok:true}` |

`ui` mode is enough for `/dev/*`, `/signin`, and signed-out `/` (landing spot list may be empty without Supabase — that is fine). It does **not** make the private journal usable.

State lives in `$SURFLOG_VERIFY_STATE_DIR` (default `/tmp/surflog-verify-$USER`):
`state.json`, `next.log`, disposable Chrome profile. The harness binds
`127.0.0.1` only and refuses to start if the chosen port is already taken.

**Teardown:** `control-surflog stop` — SIGTERM/SIGKILL **only** the recorded
Next.js pid, then drops the Chrome profile. Does **not** delete proof under
`.cursor/skills/verify-surflog/artifacts/`.

## Doctor

```bash
control-surflog doctor
```

Requires: process alive, port owned by that pid, `/dev/landing` 200 with
Surflog mark. In `full` mode also requires `/api/health` 200. Exit `0` only
when worth driving; otherwise exit `2` and refuse the journey.

Never drive an instance whose `doctor` fails, and never drive a shared
`localhost:3000` you did not launch — Avery's real Google session may be on
that port.

## Drive

Harness: **`control-surflog browser …`** (Playwright-core + system Chrome).
Prefer accessible names / roles from `lib/i18n.tsx` English strings.

```bash
control-surflog browser goto /dev/landing
control-surflog browser wait --text "Conditions fill themselves"
control-surflog browser wait --text "Jialeshui" --state attached --scroll
control-surflog browser text --role heading --name "Your surf log"
control-surflog browser click --role button --name "Sign in"
control-surflog browser screenshot --path .cursor/skills/verify-surflog/artifacts/<feature>/after.jpg
control-surflog browser aria --path .cursor/skills/verify-surflog/artifacts/<feature>/after.aria.txt
control-surflog http get /api/health
```

Signed-in journal / spots / log-form journeys need a real Google session in the
Chrome profile (`SURFLOG_VERIFY_HEADED=1` helps complete OAuth once). Until
that cookie exists, report the journey blocked — do **not** call write APIs
with production secrets as a shortcut.

Stable handles (en locale; language is `localStorage surflog:lang`):

| UI | Handle |
|----|--------|
| Wordmark | `img[alt="Surflog"]` |
| Landing Sign in | `button` name `Sign in` |
| Sign-in CTA | `button` name `Continue with Google` |
| Header log | `button` / link name `Log a session` |
| Calendar title | text `Days in the water` |
| Patterns table | text `What you've surfed` |
| Spots page title | heading / text `Surf spots` |
| Spot count | `[data-testid="spot-count"]` |

## Evidence

Root: `.cursor/skills/verify-surflog/artifacts/<feature-id>/`

Proof standards:

1. Exercise the real user path (page + click), not internal setters.
2. Capture **action + resulting state** (before/after or aria + screenshot).
3. UI proof includes Surflog identity (logo/alt or visible brand) and the
   feature assertion (heading, card text, count).
4. Side effects (saved session, pin) need a second read (reload or list) —
   only on disposable / clearly owned accounts; never leave junk in Avery's
   production journal without deleting it.
5. Mocks only at production boundaries already isolated (`/dev/*` synthetic
   data is the intended ui-mode surface).

## Cleanup

```bash
control-surflog stop
```

Removes the verify Next.js process and Chrome profile. Keeps
`artifacts/` and `/tmp/.../next.log`. If a headed OAuth login created junk
sessions in a shared Supabase project, delete those rows before finishing.

## Helpers

| Script | Role |
|--------|------|
| `.cursor/skills/verify-surflog/scripts/control-surflog.mjs` | launch / doctor / stop / browser / http |
| `.cursor/skills/verify-surflog/scripts/package.json` | `playwright-core` only (verification scaffolding) |

Invoke: `node .cursor/skills/verify-surflog/scripts/control-surflog.mjs <cmd>`.

## Isolation

- Default port **3456** (not 3000) so a human `npm run dev` can stay up.
- One harness instance per `SURFLOG_VERIFY_STATE_DIR`.
- Do not double-drive the same state dir.
- `ui` mode must not mutate production data (no signed-in writes).
- `full` + signed-in writes: use a throwaway Google account or undo every change.

## Feature map

See [features/README.md](features/README.md).
