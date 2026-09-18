# Surflog

Surf journal. Log spot + date + time + notes; conditions attach themselves
via [Open-Meteo](https://open-meteo.com), called server-side at save time.
Sign in with Google — each person gets their own private journal.

**Start by reading `CLAUDE.md`** — it holds the findings that shaped this
(why Swelleye can't be automated, what Open-Meteo can and can't resolve, the
entry schema, and the bugs already paid for).

## Stack

Next.js (App Router) + [shadcn/ui](https://ui.shadcn.com) (`radix-nova`
preset) + Tailwind v4 + [Auth.js](https://authjs.dev) (Google provider).
Single light theme, no dark mode — see CLAUDE.md "Conventions".

## Running it locally

```
npm install
cp .env.example .env.local   # then fill it in — see "Setting up Google sign-in"
npm run dev
```

Opens on `http://localhost:3000` and redirects straight to `/signin` until
you've set up Google OAuth (below). Open-Meteo itself needs no API key, and
storage is a JSON file already in the repo — nothing else to configure for
local dev once sign-in works.

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
5. Generate the session-signing secret: `npx auth secret` (writes
   `AUTH_SECRET` into `.env.local` for you).
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

The 3 real sessions logged before accounts existed carry a placeholder
owner. See `.env.example` → `LEGACY_OWNER_EMAIL` for the one-time claim that
hands them to whoever's email matches it, the first time that person signs
in.

## What's here

```
CLAUDE.md                     context for Claude Code — read first
VALIDATION.md                 spot-fit experiments — read before touching lib/spot-fit.ts
reference/surf-journal.html   the artifact version, still in daily use today
data/sessions.json            live storage, read/written by this app — gitignored (see data/README.md)
data/blobs/                   uploaded photos/videos (gitignored, local-only)
lib/spots.ts                  42 Swelleye spot slugs + coordinates (most still TODO)
lib/openmeteo.ts              server-side conditions lookup
lib/spot-fit.ts               per-spot discriminator (see VALIDATION.md — unverified)
lib/db.ts, lib/blob.ts        storage — filesystem today, swap before deploying (see below)
auth.ts, proxy.ts             Google sign-in + route protection (Auth.js)
app/api/sessions/…            session CRUD + photo upload, calls Open-Meteo at save time
app/page.tsx, components/     the UI
```

## ⚠️ Before deploying to Vercel

This runs great locally, but **do not deploy it to Vercel as-is** — two
things will silently break:

1. **Storage is a JSON file on disk** (`lib/db.ts`, `data/sessions.json`).
   Vercel's filesystem is read-only outside `/tmp`, and `/tmp` doesn't
   survive between requests or across serverless instances. Sessions would
   appear to save, then vanish. Swap `lib/db.ts` for a real database before
   deploying — every call site goes through that one file, so it's the only
   thing that needs to change. You already have the Supabase CLI installed
   locally (`~/.supabase`); [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres),
   [Neon](https://neon.tech), and [Supabase](https://supabase.com) all work
   and have a free tier.
2. **Photo/video uploads are local files** (`lib/blob.ts`,
   `data/blobs/`). Same problem, same fix: swap for
   [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (simplest,
   same-vendor) or S3-compatible storage before deploying.

These are two different kinds of "storage": (1) is a database — structured
rows (spot, notes, conditions) — currently just a JSON file, nothing set up
yet. (2) is object/blob storage for the raw photo/video files themselves —
the same category AWS S3 is in; Vercel Blob is Vercel's equivalent. Neither
is needed for local dev, only once this runs on Vercel's read-only,
ephemeral filesystem.

Once those two are swapped:

- `vercel link` / `vercel env pull` to wire up whichever database/blob env
  vars your provider gives you (`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`,
  etc. — exact names depend on what you pick), plus `AUTH_SECRET` /
  `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` from "Setting up Google sign-in"
  above.
- Add the production redirect URI in Google Cloud Console once you know the
  Vercel domain (step 3 above).
- No other API keys needed — Open-Meteo is free, keyless, and CORS/sandbox
  problems don't apply server-side.
- `npm run build` locally first — it catches most of this (it won't catch
  the storage issue itself, since that only shows up at runtime on
  read-only infra).

## Licence note

Open-Meteo is free for non-commercial use. Keep it that way, or get a key.
Don't build Swelleye scraping into this without reading the CLAUDE.md section
on it first.
