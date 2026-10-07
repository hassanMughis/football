-- Run or re-run this entire file in the Supabase SQL Editor after each schema update.
-- It upgrades the existing basic roster without deleting current players.

begin;

alter table public.players add column if not exists client_id text;
alter table public.players add column if not exists speciality text not null default '';
alter table public.players add column if not exists skills text[] not null default '{}'::text[];
alter table public.players add column if not exists custom_overall integer;
alter table public.players add column if not exists card_style text not null default 'classic';
alter table public.players add column if not exists position text not null default 'CM';
alter table public.players add column if not exists lineup_position text;
alter table public.players add column if not exists flag text not null default '🇵🇰';
alter table public.players add column if not exists overall integer;
alter table public.players add column if not exists pac integer;
alter table public.players add column if not exists sho integer;
alter table public.players add column if not exists pas integer;
alter table public.players add column if not exists dri integer;
alter table public.players add column if not exists def integer;
alter table public.players add column if not exists phy integer;
alter table public.players add column if not exists in_match_squad boolean not null default false;
alter table public.players add column if not exists is_captain boolean not null default false;
alter table public.players add column if not exists created_at timestamptz not null default now();
alter table public.players add column if not exists updated_at timestamptz not null default now();

update public.players set client_id = 'db-' || id::text
where client_id is null or btrim(client_id) = '';
alter table public.players alter column client_id set not null;
create unique index if not exists players_client_id_key on public.players (client_id);

update public.players set skills = array[speciality]
where cardinality(skills) = 0 and speciality <> '';

alter table public.players drop constraint if exists players_rating_check;
update public.players
set rating = greatest(1, least(10, round((rating - 42.5) / 5.0)::integer))
where rating > 10;
alter table public.players alter column rating set default 0;
alter table public.players alter column rating type numeric(3,1) using round(rating::numeric * 2) / 2;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_rating_check' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_rating_check check (rating between 0 and 10 and rating * 2 = trunc(rating * 2));
  end if;
  alter table public.players drop constraint if exists players_speciality_check;
  alter table public.players add constraint players_speciality_check check (speciality in ('', 'Passing', 'Scoring', 'Shooting', 'Dribbling', 'Teamwork', 'Goalkeeping', 'Defending', 'Pace', 'Strength', 'Heading'));
  alter table public.players drop constraint if exists players_skills_check;
  alter table public.players add constraint players_skills_check check (
    cardinality(skills) <= 4 and
    skills <@ array['Passing', 'Scoring', 'Shooting', 'Dribbling', 'Teamwork', 'Goalkeeping', 'Defending', 'Pace', 'Strength', 'Heading']::text[]
  );
  if not exists (select 1 from pg_constraint where conname = 'players_custom_overall_check' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_custom_overall_check check (custom_overall is null or custom_overall between 1 and 99);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_card_style_check' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_card_style_check check (card_style in ('classic', 'royal', 'electric', 'crimson', 'eclipse', 'inferno', 'aurora', 'prism'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_position_check' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_position_check check (position in ('GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_lineup_position_check' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_lineup_position_check check (lineup_position is null or lineup_position in ('GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_overall_check' and conrelid = 'public.players'::regclass) then
    alter table public.players add constraint players_overall_check check (overall is null or overall between 1 and 99);
  end if;
end $$;

do $$ declare column_name text; begin
  foreach column_name in array array['pac','sho','pas','dri','def','phy'] loop
    if not exists (select 1 from pg_constraint where conname = 'players_' || column_name || '_check' and conrelid = 'public.players'::regclass) then
      execute format('alter table public.players add constraint %I check (%I is null or %I between 1 and 99)', 'players_' || column_name || '_check', column_name, column_name);
    end if;
  end loop;
end $$;

update public.players set
  pac = least(99, 44 + rating * 5 + 1),
  sho = least(99, 44 + rating * 5 - 1),
  pas = least(99, 44 + rating * 5),
  dri = least(99, 44 + rating * 5 + 2),
  def = least(99, 44 + rating * 5 - 8),
  phy = least(99, 44 + rating * 5 - 3)
where rating > 0 and pac is null;
update public.players set overall = round((pac + sho + pas + dri + def + phy) / 6.0)::integer
where rating > 0 and overall is null;

alter table public.squad_settings add column if not exists match_team_name text not null default 'Team 1';
alter table public.squad_settings add column if not exists opponent_name text not null default 'Team 2';
alter table public.squad_settings add column if not exists opponent_goals integer not null default 0;
alter table public.squad_settings add column if not exists match_status text not null default 'Live';
alter table public.squad_settings add column if not exists motm_client_id text;
alter table public.squad_settings add column if not exists app_state jsonb not null default '{}'::jsonb;

create table if not exists public.match_events (
  id bigint generated by default as identity primary key,
  scorer_client_id text not null references public.players(client_id) on delete cascade,
  assist_client_id text references public.players(client_id) on delete set null,
  minute integer check (minute is null or minute between 0 and 130),
  event_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.match_events add column if not exists team_number integer not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'match_events_team_number_check' and conrelid = 'public.match_events'::regclass) then
    alter table public.match_events add constraint match_events_team_number_check check (team_number in (1, 2));
  end if;
end $$;

create table if not exists public.match_history (
  history_id text primary key,
  ended_at timestamptz not null,
  team1_name text not null,
  team2_name text not null,
  team1_captain_id text,
  team2_captain_id text,
  team1_players jsonb not null default '[]'::jsonb,
  team2_players jsonb not null default '[]'::jsonb,
  score1 integer not null default 0,
  score2 integer not null default 0,
  goals jsonb not null default '[]'::jsonb,
  motm_client_id text,
  snapshot jsonb not null
);

alter table public.match_events enable row level security;
drop policy if exists "public match events read" on public.match_events;
drop policy if exists "public match events write" on public.match_events;
create policy "public match events read" on public.match_events for select to anon using (true);
create policy "public match events write" on public.match_events for all to anon using (true) with check (true);
grant select, insert, update, delete on public.match_events to anon;
grant usage, select on sequence public.match_events_id_seq to anon;

alter table public.match_history enable row level security;
drop policy if exists "public match history read" on public.match_history;
drop policy if exists "public match history write" on public.match_history;
create policy "public match history read" on public.match_history for select to anon using (true);
create policy "public match history write" on public.match_history for all to anon using (true) with check (true);
grant select, insert, update, delete on public.match_history to anon;

create or replace function public.set_player_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at before update on public.players
for each row execute function public.set_player_updated_at();

create or replace function public.save_squad_sheet_state(p_state jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  item jsonb;
  match_event jsonb;
  history_item jsonb;
  ordinal integer := 0;
  event_ordinal integer := 0;
  player_id text;
  scorer_id text;
  assist_id text;
begin
  if jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_state->'players') is distinct from 'array' then
    raise exception 'State must be an object containing a players array';
  end if;
  if jsonb_array_length(p_state->'players') > 100 then
    raise exception 'A squad supports at most 100 players';
  end if;

  perform pg_advisory_xact_lock(7312905);
  -- Supabase projects with the safe-update extension require an explicit WHERE.
  delete from public.match_events where true;
  delete from public.match_history where true;

  for item in select value from jsonb_array_elements(p_state->'players') loop
    player_id := btrim(item->>'id');
    if player_id = '' or length(player_id) > 80 then raise exception 'Invalid player ID'; end if;
    if length(btrim(item->>'name')) not between 1 and 60 then raise exception 'Invalid player name'; end if;

    insert into public.players (
      client_id, name, rating, speciality, skills, custom_overall, image_url, card_style, position, lineup_position, flag,
      available, team, in_match_squad, is_captain, overall, pac, sho, pas, dri, def, phy, sort_order
    ) values (
      player_id,
      btrim(item->>'name'),
      coalesce((item->>'rating')::numeric, 0),
      coalesce(item->>'spec', ''),
      case
        when jsonb_typeof(item->'skills') = 'array' then array(select value from jsonb_array_elements_text(item->'skills') with ordinality as selected(value, position) order by position limit 4)
        when coalesce(item->>'spec', '') <> '' then array[item->>'spec']
        else array[]::text[]
      end,
      nullif(item->>'customOverall', '')::integer,
      nullif(item->>'image', ''),
      coalesce(nullif(item->>'cardStyle', ''), 'classic'),
      coalesce(nullif(item->>'position', ''), 'CM'),
      nullif(coalesce(
        p_state #>> array['balancedTeams','team1','positions',player_id],
        p_state #>> array['balancedTeams','team2','positions',player_id]
      ), ''),
      coalesce(nullif(item->>'flag', ''), '🇵🇰'),
      case when item ? 'on' then coalesce((item->>'on')::boolean, true) else true end,
      case
        when coalesce(p_state #> '{balancedTeams,team1,ids}', '[]'::jsonb) ? player_id then 1
        when coalesce(p_state #> '{balancedTeams,team2,ids}', '[]'::jsonb) ? player_id then 2
        else 0
      end,
      coalesce(p_state #> '{team,ids}', '[]'::jsonb) ? player_id,
      coalesce(p_state #>> '{balancedTeams,team1,captain}', '') = player_id
        or coalesce(p_state #>> '{balancedTeams,team2,captain}', '') = player_id
        or coalesce(p_state #>> '{team,captain}', '') = player_id,
      nullif(item #>> '{cardStats,OVR}', '')::integer,
      nullif(item #>> '{cardStats,PAC}', '')::integer,
      nullif(item #>> '{cardStats,SHO}', '')::integer,
      nullif(item #>> '{cardStats,PAS}', '')::integer,
      nullif(item #>> '{cardStats,DRI}', '')::integer,
      nullif(item #>> '{cardStats,DEF}', '')::integer,
      nullif(item #>> '{cardStats,PHY}', '')::integer,
      ordinal
    )
    on conflict (client_id) do update set
      name = excluded.name, rating = excluded.rating, speciality = excluded.speciality,
      skills = excluded.skills, custom_overall = excluded.custom_overall,
      image_url = excluded.image_url, card_style = excluded.card_style, position = excluded.position,
      lineup_position = excluded.lineup_position,
      flag = excluded.flag, available = excluded.available, team = excluded.team,
      in_match_squad = excluded.in_match_squad, is_captain = excluded.is_captain,
      overall = excluded.overall, pac = excluded.pac, sho = excluded.sho, pas = excluded.pas,
      dri = excluded.dri, def = excluded.def, phy = excluded.phy, sort_order = excluded.sort_order;
    ordinal := ordinal + 1;
  end loop;

  delete from public.players existing
  where not exists (
    select 1 from jsonb_array_elements(p_state->'players') incoming
    where incoming->>'id' = existing.client_id
  );

  for match_event in select value from jsonb_array_elements(coalesce(p_state #> '{match,ev}', '[]'::jsonb)) loop
    scorer_id := nullif(match_event->>'s', '');
    assist_id := nullif(match_event->>'a', '');
    if scorer_id is not null and exists (select 1 from public.players where client_id = scorer_id) then
      if assist_id is not null and not exists (select 1 from public.players where client_id = assist_id) then assist_id := null; end if;
      insert into public.match_events (scorer_client_id, assist_client_id, minute, team_number, event_order)
      values (
        scorer_id,
        assist_id,
        case when jsonb_typeof(match_event->'m') = 'number' then (match_event->>'m')::integer else null end,
        case when match_event->>'team' = '2' then 2 else 1 end,
        event_ordinal
      );
      event_ordinal := event_ordinal + 1;
    end if;
  end loop;

  for history_item in select value from jsonb_array_elements(coalesce(p_state->'history', '[]'::jsonb)) loop
    if nullif(history_item->>'id', '') is not null and nullif(history_item->>'endedAt', '') is not null then
      insert into public.match_history (
        history_id, ended_at, team1_name, team2_name, team1_captain_id, team2_captain_id,
        team1_players, team2_players, score1, score2, goals, motm_client_id, snapshot
      ) values (
        history_item->>'id',
        (history_item->>'endedAt')::timestamptz,
        coalesce(nullif(history_item #>> '{team1,name}', ''), 'Team 1'),
        coalesce(nullif(history_item #>> '{team2,name}', ''), 'Team 2'),
        nullif(history_item #>> '{team1,captain}', ''),
        nullif(history_item #>> '{team2,captain}', ''),
        coalesce(history_item #> '{team1,players}', '[]'::jsonb),
        coalesce(history_item #> '{team2,players}', '[]'::jsonb),
        coalesce((history_item->>'score1')::integer, 0),
        coalesce((history_item->>'score2')::integer, 0),
        coalesce(history_item->'goals', '[]'::jsonb),
        nullif(history_item->>'motm', ''),
        history_item
      );
    end if;
  end loop;

  insert into public.squad_settings (
    id, team_1_name, team_2_name, match_team_name, opponent_name,
    opponent_goals, match_status, motm_client_id, app_state
  ) values (
    1,
    coalesce(nullif(p_state #>> '{balancedTeams,team1,name}', ''), 'Team 1'),
    coalesce(nullif(p_state #>> '{balancedTeams,team2,name}', ''), 'Team 2'),
    coalesce(nullif(p_state #>> '{match,us}', ''), 'Team 1'),
    coalesce(nullif(p_state #>> '{match,opp}', ''), 'Team 2'),
    coalesce((p_state #>> '{match,them}')::integer, 0),
    case when p_state #>> '{match,st}' = 'Full-time' then 'Full-time' else 'Live' end,
    nullif(p_state #>> '{match,motm}', ''),
    p_state
  )
  on conflict (id) do update set
    team_1_name = excluded.team_1_name,
    team_2_name = excluded.team_2_name,
    match_team_name = excluded.match_team_name,
    opponent_name = excluded.opponent_name,
    opponent_goals = excluded.opponent_goals,
    match_status = excluded.match_status,
    motm_client_id = excluded.motm_client_id,
    app_state = excluded.app_state;
end;
$$;

revoke execute on function public.save_squad_sheet_state(jsonb) from public;
grant execute on function public.save_squad_sheet_state(jsonb) to anon;

-- The browser listens only to this single canonical state row. The block is
-- safe to rerun and avoids polling the API for public/view-only updates.
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
end;
$$;

commit;
