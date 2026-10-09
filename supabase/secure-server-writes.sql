-- Run this only after the deployed Next.js app has SUPABASE_SECRET_KEY.
-- Public visitors keep read access required by the site and Realtime, but all
-- database and Storage writes must go through the app's admin-checked routes.

begin;

alter table if exists public.players enable row level security;
alter table if exists public.squad_settings enable row level security;
alter table if exists public.match_events enable row level security;
alter table if exists public.match_history enable row level security;
alter table if exists public.cricket_players enable row level security;

drop policy if exists "public players write" on public.players;
drop policy if exists "public settings write" on public.squad_settings;
drop policy if exists "public match events write" on public.match_events;
drop policy if exists "public match history write" on public.match_history;

revoke insert, update, delete on table public.players from anon, authenticated;
revoke insert, update, delete on table public.squad_settings from anon, authenticated;
revoke insert, update, delete on table public.match_events from anon, authenticated;
revoke insert, update, delete on table public.match_history from anon, authenticated;
revoke insert, update, delete on table public.cricket_players from anon, authenticated;
revoke usage, update on sequence public.players_id_seq from anon, authenticated;
revoke usage, update on sequence public.match_events_id_seq from anon, authenticated;

revoke execute on function public.save_team_maker_squad(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.save_team_maker_squad(jsonb, text, text) to service_role;

revoke execute on function public.save_squad_sheet_state(jsonb) from public, anon, authenticated;
grant execute on function public.save_squad_sheet_state(jsonb) to service_role;

revoke execute on function public.save_cricket_players(jsonb) from public, anon, authenticated;
grant execute on function public.save_cricket_players(jsonb) to service_role;

drop policy if exists "public player images upload" on storage.objects;
drop policy if exists "public player images update" on storage.objects;
drop policy if exists "public player images delete" on storage.objects;

commit;
