-- OAuth 2.1 for the MCP endpoint, so claude.ai custom connectors (web and the
-- mobile app) can connect: they can't send a hand-made bearer header, they
-- discover the server, register themselves and send the user through a
-- consent page.
--
-- An OAuth access token is an ordinary `api_tokens` row (same `sfl_` format,
-- same hash, same scope, revocable on /tokens) that also expires and carries a
-- refresh token, so lib/token-auth.ts authenticates both kinds the same way.
-- Only hashes are stored, as for personal tokens. Same access model as every
-- other table: RLS on, no policies, service-role key.

create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text not null check (char_length(client_name) between 1 and 60),
  redirect_uris jsonb not null,
  created_at timestamptz not null default now()
);

-- One-time authorization codes (10 minutes, single use, PKCE-bound).
create table if not exists public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  owner_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null check (scope in ('read', 'write')),
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.api_tokens
  add column if not exists client_id text references public.oauth_clients (client_id) on delete cascade,
  add column if not exists expires_at timestamptz,
  add column if not exists refresh_hash text unique,
  add column if not exists refresh_expires_at timestamptz;

alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
