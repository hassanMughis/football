-- Run this once in the Supabase SQL Editor after rich-player-migration.sql.
-- Cricket players, teams, innings and commentary remain inside the canonical
-- app_state JSON so the existing one-row Realtime subscription stays atomic.

begin;

alter table public.squad_settings
  add column if not exists sport_mode text not null default 'football';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'squad_settings_sport_mode_check'
      and conrelid = 'public.squad_settings'::regclass
  ) then
    alter table public.squad_settings
      add constraint squad_settings_sport_mode_check
      check (sport_mode in ('football', 'cricket'));
  end if;
end $$;

create or replace function public.sync_squad_sheet_sport_mode()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.sport_mode := case
    when new.app_state->>'sportMode' = 'cricket' then 'cricket'
    else 'football'
  end;
  return new;
end;
$$;

drop trigger if exists squad_settings_sync_sport_mode on public.squad_settings;
create trigger squad_settings_sync_sport_mode
before insert or update of app_state on public.squad_settings
for each row execute function public.sync_squad_sheet_sport_mode();

update public.squad_settings
set sport_mode = case
  when app_state->>'sportMode' = 'cricket' then 'cricket'
  else 'football'
end
where id = 1;

-- The app listens to squad_settings only. Keep that row in the publication so
-- sport switches, cricket score updates and commentary arrive without polling.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'squad_settings'
  ) then
    execute 'alter publication supabase_realtime add table public.squad_settings';
  end if;
end $$;

commit;
