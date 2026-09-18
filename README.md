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

The 3 real sessions logged before accounts existed were migrated into
Supabase with a placeholder owner. See `.env.example` → `LEGACY_OWNER_EMAIL`
for the one-time claim that hands them to whoever's email matches it, the
first time that person signs in.

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

## ⚠️ Before deploying to Vercel

The database and photo storage are handled now (Supabase, both set up —
see above). What's left before this can actually go live:

- **A Vercel project**, with the GitHub repo connected and these env vars
  set: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AUTH_SECRET`,
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (and `LEGACY_OWNER_EMAIL` if you
  still need that one-time claim to happen). None of this has been done yet
  — no Vercel project exists.
- **The production Google OAuth redirect URI** — add
  `https://<your-vercel-domain>/api/auth/callback/google` in Google Cloud
  Console once you know the domain (see "Setting up Google sign-in" above).
- `npm run build` locally first — it already catches most misconfiguration
  (missing env vars fail loudly via `lib/supabase.ts`'s explicit check,
  rather than silently doing the wrong thing).

Open-Meteo needs no key and has no CORS/sandbox issues server-side, so
nothing to do there.

## Licence note

Open-Meteo is free for non-commercial use. Keep it that way, or get a key.
Don't build Swelleye scraping into this without reading the CLAUDE.md section
on it first.
