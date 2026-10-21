-- How long the session was, in minutes (30-minute steps, up to 8 h). Optional:
-- sessions logged before this have none, and a session may leave it out.
-- Fixed after creation like the date and time. The session's weather range
-- (swell height min-max) is stored inside cond_open_meteo, not here.
alter table public.sessions
  add column if not exists duration_min smallint
  check (duration_min is null or (duration_min between 30 and 480));
