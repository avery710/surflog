# Surflog

Surf journal. Log spot + date + time + notes; conditions attach themselves
via [Open-Meteo](https://open-meteo.com), called server-side at save time.
Sign in with Google — each person gets their own private journal.

**Start by reading `CLAUDE.md`** — it holds the findings that shaped this
(why Swelleye can't be automated, what Open-Meteo can and can't resolve, the
entry schema, and the bugs already paid for).

## Stack

Next.js (App Router) + [shadcn/ui](https://ui.shadcn.com) (`radix-nova`
preset) + Tailwind v4 + [Auth.js](https://authjs.dev) (Google provider) +
[Supabase](https://supabase.com) (Postgres + Storage). Single light theme,
no dark mode — see CLAUDE.md "Conventions".

## Running it locally

```
npm install
cp .env.example .env.local   # then fill it in — see the two setup sections below
npm run dev
```

Opens on `http://localhost:3000` and redirects to `/signin` until Google
OAuth is set up. Open-Meteo needs no key. Supabase and Google sign-in both
need setup once (below) — after that, nothing else to configure for local
dev.

## Setting up Supabase

The project already exists (`surflog`, org `averysSupabase`, ap-northeast-1)
with its schema pushed — you likely just need the keys, not to create
anything:

1. **Dashboard → Project Settings → API** → copy the **Project URL** and the
   **secret** `service_role`-equivalent key (`sb_secret_...` — not the
   `sb_publishable_...` one).
2. Put them in `.env.local` as `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

That's it for an existing clone. Setting this up **from scratch** (a fresh
Supabase project) instead:

1. `supabase login`, then `supabase projects create surflog --org-id
   <your-org-id> --region <closest-to-you> --db-password <generate one>`.
2. `supabase link --project-ref <the new ref>`.
3. `supabase db push` — applies everything in `supabase/migrations/`
   (creates the `sessions` and `photo_blobs` tables).
4. Create a **private** Storage bucket named `photos` (Dashboard → Storage,
   or `POST /storage/v1/bucket` with `{"id":"photos","public":false}` —
   there's no CLI subcommand for this yet).
5. Grab the URL/key as in step 1 above.

`SUPABASE_SECRET_KEY` bypasses Row Level Security entirely — see
`lib/supabase.ts` and CLAUDE.md "Multi-user" for why that's fine here (it's
server-side only; ownership is enforced in the API routes, not in Postgres)
but never let it reach the browser or a client component.

## Setting up Google sign-in

You need your own OAuth client — you can't reuse anyone else's Client ID.

1. **Google Cloud Console** → create a project (or use an existing one).
2. **APIs & Services → OAuth consent screen**: User type "External", app
   name "Surflog", your email as support contact. While the app is in
   "Testing" status only emails you explicitly add as test users can sign
   in; click **Publish App** to let anyone with a Google account sign in
   (fine here — it only requests basic profile/email, which doesn't need
   Google's verification review).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   application type **Web application**. Add an authorized redirect URI:
   - local dev: `http://localhost:3000/api/auth/callback/google`
   - production: `https://surflog.tw/api/auth/callback/google`
   - staging: `https://stag-wipeout.surflog.tw/api/auth/callback/google`
4. Copy the **Client ID** and **Client secret** into `.env.local` as
   `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
5. Generate the session-signing secret: `AUTH_SECRET=$(openssl rand -base64 33)` and add
   it to `.env.local`. (`npx auth secret` installs the wrong package and fails silently —
   use `openssl` instead.)
6. `npm run dev`, visit `http://localhost:3000` → redirects to `/signin` →
   "Continue with Google" should work end to end.

On Vercel, set the same three variables (`AUTH_SECRET`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`) as project environment variables. Auth.js detects the
deployment URL from Vercel's request headers automatically — no `AUTH_URL`
needed there.

## Multi-user

Every session row is tagged with `ownerId` — the signer's Google account id
— and every read/write in `app/api/*` is scoped to it (see `lib/db.ts` /
CLAUDE.md "Multi-user"). There's no invite list: anyone who publishes the
app in step 2 above and has a Google account can sign in and gets their own
empty journal. If you want to restrict *who* can sign in at all (not just
what they can see), that's a small addition on top — ask for it if you want
it; it isn't built in.

The 3 real sessions logged before accounts existed were migrated into
Supabase with a placeholder owner, then assigned directly to Capy's account
on 2026-09-22.

## What's here

```
CLAUDE.md                     context for Claude Code — read first
VALIDATION.md                 spot-fit experiments — read before touching lib/spot-fit.ts
reference/surf-journal.html   the artifact version, still in daily use today
data/                         pre-Supabase local storage — unused now, see data/README.md
supabase/migrations/          the actual schema (sessions, photo_blobs tables)
lib/spots.ts                  42 Swelleye spot slugs + coordinates (most still TODO)
lib/openmeteo.ts              server-side conditions lookup
lib/spot-fit.ts               per-spot discriminator (see VALIDATION.md — unverified)
lib/supabase.ts               server-side Supabase client — never import from a client component
lib/db.ts, lib/blob.ts        Supabase-backed storage (Postgres + Storage)
auth.ts, proxy.ts             Google sign-in + route protection (Auth.js)
app/api/sessions/…            session CRUD + photo upload, calls Open-Meteo at save time
app/page.tsx, components/     the UI
```

## MCP access

Each user can let an MCP client (Claude Code, Claude Desktop, Cursor…) read
and change their own session log.

1. Sign in, open the avatar menu → **API tokens** (`/tokens`), create a
   token (read only, or read and write) and copy it. It is shown once.
2. Add the server to the client, for example in Claude Code:

   ```bash
   claude mcp add --transport http surflog https://<your-host>/api/mcp \
     --header "Authorization: Bearer sfl_…"
   ```

Tools: `list_sessions`, `get_session`, `list_spots`, `list_boards`, and
with a write token `create_session`, `update_session`, `delete_session`.
A token only ever reaches its owner's own sessions. Photos and video,
goals and spot requests are not available over MCP. Revoke a token on the
same page. `npm test` runs the unit tests for this layer.

## Deploys: production and staging

Two environments in one Vercel project, each deployed only by a GitHub
Actions workflow (`vercel.json` turns off Vercel's own deploy-on-push, so
nothing reaches Vercel without passing lint, typecheck and tests):

| | Production | Staging |
|---|---|---|
| Branch | `main` | `staging` |
| Workflow | `deploy-production.yml` | `deploy-staging.yml` |
| Vercel environment | Production | Preview |
| Address | `surflog.tw` (+ `www`) | `stag-wipeout.surflog.tw` (`STAGING_DOMAIN`) |
| Supabase | the original project — real data | `surflog-staging`, its own empty project |

Production deploys get the production domains from Vercel itself. Staging
deploys get a random URL, then the workflow aliases it to `STAGING_DOMAIN`
(Google OAuth needs one fixed redirect URI). The staging workflow refuses
to run if `STAGING_DOMAIN` is set to the production domain.

Functions run in Tokyo (`"regions": ["hnd1"]` in `vercel.json`, both
environments), next to the production Supabase project (`ap-northeast-1`).
Every page waits on Supabase, so a function far from the database pays
that distance on every query; Vercel's default (`iad1`, Washington) made
each page switch cost about a second. Keep the two in the same region.

One-time setup:

1. **Vercel project** — vercel.com → Add New → Project → import this repo
   (Next.js is detected). The first deploy it offers can be skipped.
2. **App env vars** — Vercel project → Settings → Environment Variables:
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
   `AUTH_GOOGLE_SECRET`, `CWA_API_KEY`, `SPOT_ADMIN_EMAILS`, set **separately
   for Production and Preview**. The two Supabase values and `AUTH_SECRET`
   must differ between them (Preview = the staging Supabase project; a fresh
   secret from `openssl rand -base64 33`); the Google and CWA values can be
   shared. These stay in Vercel; the workflows pull them at build time.
3. **GitHub secrets** — repo → Settings → Secrets and variables → Actions:
   - Secrets (used by both workflows): `VERCEL_TOKEN`
     (vercel.com/account/tokens), `VERCEL_PROJECT_ID` (Vercel project →
     Settings → General), `VERCEL_ORG_ID` (your Vercel account/team →
     Settings → General → ID).
   - Variable: `STAGING_DOMAIN` = `stag-wipeout.surflog.tw`. (Before the
     split `surflog.tw` pointed at staging; the staging workflow now
     refuses that value.)
4. **Domains** — Vercel project → Settings → Domains: `surflog.tw` and
   `www.surflog.tw` assigned to **Production**; `stag-wipeout.surflog.tw`
   added too (Preview, branch `staging`). At the registrar (GoDaddy) add
   a CNAME, Name `stag-wipeout`, Value = the one Vercel shows.
5. **Google sign-in** — on the OAuth client in Google Cloud Console, keep
   `https://surflog.tw/api/auth/callback/google` and add
   `https://stag-wipeout.surflog.tw/api/auth/callback/google` (see
   "Setting up Google sign-in").
6. **Staging database** — a second Supabase project set up as in "Setting up
   Supabase" → "from scratch": `supabase db push` and a private `photos`
   bucket. It starts empty apart from the spots the migrations seed.
7. **Who can open staging** — two layers, both optional:
   - Vercel project → Settings → Deployment Protection → **Vercel
     Authentication** on for Preview: only people logged into your Vercel
     account can load the site at all. (Hobby has one user, you. It also
     blocks AI-app OAuth callbacks from claude.ai etc., so those can't be
     tried on staging while it is on.)
   - `SIGNIN_ALLOWED_EMAILS` in Vercel's **Preview** environment
     (comma-separated Google emails): only those accounts can sign in. Unset
     = open to every Google account, which is what production does.
8. Push: `git push origin staging` deploys staging; pushing `main` deploys
   production. Watch both under the repo's Actions tab.

Migrations run in the deploy workflows. A push to `staging` applies pending
`supabase/migrations/` to the staging Supabase project before the deploy
(job `migrate`). A push to `main` runs `plan` (a dry run against production,
listed in the run summary), then `migrate`, which applies them without a
manual approval and is skipped when nothing is pending, then the deploy. A failed migration stops the deploy. One-time setup,
repo → Settings:

- Secrets and variables → Actions → **Secrets**: `STAGING_DB_PASSWORD`,
  `PRODUCTION_DB_PASSWORD`. No Supabase access token: the jobs connect straight
  to each database through its session pooler (IPv4; the direct
  `db.<ref>.supabase.co` address is IPv6-only, which GitHub's runners lack).
  The pooler hosts are in the workflows (`POOLER_HOST`).
- **Variables**: `STAGING_SUPABASE_PROJECT_REF`, `PRODUCTION_SUPABASE_PROJECT_REF`
  (the project ref from each dashboard URL; the staging job refuses the
  production ref).

Migrations cannot be rolled back, so write them add-only (new tables and
columns); a rename or drop belongs in a later release, after the code stopped
using it. By hand, as a fallback: `supabase link --project-ref <ref>` then
`supabase db push`, staging first.

Run `npm run build` locally before pushing if in doubt — missing env vars
fail loudly via `lib/supabase.ts`'s explicit check. Open-Meteo needs no key.

## Licence note

Open-Meteo is free for non-commercial use. Keep it that way, or get a key.
Don't build Swelleye scraping into this without reading the CLAUDE.md section
on it first.
