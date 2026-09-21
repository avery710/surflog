-- Adds the CWA tide forecast block (lib/types.ts CondCwaTide), auto-filled
-- server-side at save time alongside cond_open_meteo — see lib/cwa-tide.ts.
-- Kept as its own jsonb column rather than merged into cond_open_meteo,
-- same reasoning as cond vs cond_open_meteo: each source's numbers stay
-- attributable to where they came from. Taiwan-only and null whenever the
-- spot has no known township (lib/spots.ts `tideTownship`).

alter table public.sessions
  add column if not exists cond_cwa_tide jsonb;
