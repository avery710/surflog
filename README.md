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
   - production: `https://<your-vercel-domain>/api/auth/callback/google`
     (add this once you have the domain; you can add it later and redeploy)
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

## Staging deploys

Pushing to the `staging` branch runs `.github/workflows/deploy-staging.yml`:
lint → typecheck → `vercel build` → deploy to Vercel (Preview environment)
→ alias it to one fixed staging URL. A failing lint or typecheck stops the
deploy. `vercel.json` turns off Vercel's own deploy-on-push, so this
workflow is the only thing that deploys — nothing reaches Vercel without
passing those checks. There is no production deploy yet; `main` doesn't
deploy anywhere.

One-time setup:

1. **Vercel project** — vercel.com → Add New → Project → import this repo
   (Next.js is detected). The first deploy it offers can be skipped.
2. **App env vars** — Vercel project → Settings → Environment Variables,
   environment **Preview**: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `AUTH_SECRET` (generate a fresh one: `openssl rand -base64 33`),
   `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `CWA_API_KEY`. These stay in
   Vercel; the workflow pulls them at build time.
3. **GitHub secrets** — repo → Settings → Secrets and variables → Actions:
   - Secrets: `VERCEL_TOKEN` (vercel.com/account/tokens),
     `VERCEL_PROJECT_ID` (Vercel project → Settings → General),
     `VERCEL_ORG_ID` (your Vercel account/team → Settings → General → ID).
   - Variables: `STAGING_DOMAIN`, e.g. `surflog-staging.vercel.app` — any
     free `*.vercel.app` name. Every deploy gets a new random URL; this is
     the one address that always points at the latest staging build.
4. **Google sign-in** — in Google Cloud Console, add
   `https://<STAGING_DOMAIN>/api/auth/callback/google` as an authorized
   redirect URI on the OAuth client (see "Setting up Google sign-in").
5. **Who can open it** — Vercel puts a Vercel-login wall on Preview
   deployments by default. To let friends in, Vercel project → Settings →
   Deployment Protection → turn off Vercel Authentication.
6. Push: `git push origin staging`. Watch it under the repo's Actions tab.

Staging uses the same Supabase project as local dev — there's only one
database, so anything created on staging is real data.

Run `npm run build` locally before pushing if in doubt — missing env vars
fail loudly via `lib/supabase.ts`'s explicit check. Open-Meteo needs no key.

## Licence note

Open-Meteo is free for non-commercial use. Keep it that way, or get a key.
Don't build Swelleye scraping into this without reading the CLAUDE.md section
on it first.
