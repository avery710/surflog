-- Account activity (SURFLOG-33): one row per person per day they opened the
-- signed-in journal. Counts only, no email or name: owner_id is the Google sub,
-- like every other owner_id. Powers the sign-up and daily-active-user numbers
-- on /admin. A person's first day here is their sign-up day.
-- Same access model as every other table: RLS on, NO policies; the server uses
-- the secret key (lib/account-activity.ts).
create table if not exists public.account_activity (
  owner_id text not null,         -- Google sub, like sessions.owner_id
  day date not null,              -- calendar day in Asia/Taipei
  primary key (owner_id, day)
);

create index if not exists account_activity_day_idx on public.account_activity (day);

alter table public.account_activity enable row level security;

-- Backfill from what we know: the days people saved a session or added a
-- board. These dates are saves, not sign-ins, so a person's "sign-up day" for
-- anyone who joined before this migration is their first save.
insert into public.account_activity (owner_id, day)
select owner_id, (created_at at time zone 'Asia/Taipei')::date from public.sessions
union
select owner_id, (created_at at time zone 'Asia/Taipei')::date from public.boards
on conflict do nothing;

-- Everything /admin shows, in one round trip. p_today is today in Asia/Taipei
-- (the app passes it, so the database clock's zone never matters).
create or replace function public.account_activity_stats(p_today date)
returns json
language sql
stable
as $$
  with first_day as (
    select owner_id, min(day) as d from public.account_activity group by owner_id
  ),
  days as (
    select (p_today - g)::date as d from generate_series(0, 29) as g
  )
  select json_build_object(
    'total', (select count(*) from first_day),
    'active7', (select count(distinct owner_id) from public.account_activity where day > p_today - 7),
    'active30', (select count(distinct owner_id) from public.account_activity where day > p_today - 30),
    'new7', (select count(*) from first_day where d > p_today - 7),
    'new30', (select count(*) from first_day where d > p_today - 30),
    'daily', (
      select json_agg(
        json_build_object(
          'day', days.d,
          'active', (select count(*) from public.account_activity a where a.day = days.d),
          'new', (select count(*) from first_day f where f.d = days.d)
        )
        order by days.d
      )
      from days
    )
  );
$$;

revoke execute on function public.account_activity_stats(date) from public, anon, authenticated;
grant execute on function public.account_activity_stats(date) to service_role;
