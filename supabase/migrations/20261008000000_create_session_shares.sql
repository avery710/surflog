-- Public share links for single sessions ("Share link" in the session
-- card's Share dialog). A session is private until its owner turns sharing
-- on; that inserts a row here, turning it off DELETES the row (the old link
-- then 404s; turning it on again mints a new token). One active share per
-- session: session_id is unique.
--
-- `token` is the secret in /s/<token>: 32 random bytes, base64url (43
-- chars). It is stored as is, not hashed, because the owner has to be able
-- to copy the link again later (a hash could not give it back). The table is
-- only reachable with the server-side secret key (RLS on, no policies), and a
-- leaked token exposes no more than the public page already shows.
--
-- owner_name / owner_image are a snapshot of the owner's Google display name
-- and avatar URL, taken when sharing is turned on, so the public page can
-- show who surfed without ever looking up the owner. `lang` is the language
-- the owner picked for the page ('en' / 'zh-TW'); null = follow the visitor's
-- Accept-Language.

create table if not exists public.session_shares (
  token text primary key,
  session_id text not null unique references public.sessions (id) on delete cascade,
  owner_id text not null,
  lang text check (lang in ('en', 'zh-TW')),
  owner_name text,
  owner_image text,
  created_at timestamptz not null default now()
);

create index if not exists session_shares_owner_id_idx
  on public.session_shares (owner_id);

alter table public.session_shares enable row level security;
