-- Personal access tokens for the MCP endpoint (and any other non-browser
-- client): a signed-in user creates one in the app, pastes it into their MCP
-- client as `Authorization: Bearer sfl_…`, and calls act as that user only.
--
-- Only a SHA-256 hash is stored — the token itself is shown once at creation
-- and can't be recovered. Tokens carry 256 random bits, so a plain fast hash
-- is enough (there is nothing to brute-force). Same access model as every
-- other table: RLS on with no policies, the app uses the service-role key
-- and scopes by owner_id in lib/token-auth.ts and app/api/tokens/**.
--
-- Revoking sets revoked_at rather than deleting, so the list can still show
-- what existed and a revoked token keeps failing instead of vanishing.

create table if not exists public.api_tokens (
  id text primary key,
  owner_id text not null,
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null unique,
  -- 'read' = list/get only; 'write' = read plus create/update/delete.
  scope text not null check (scope in ('read', 'write')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_tokens_owner_id_idx
  on public.api_tokens (owner_id);

alter table public.api_tokens enable row level security;
