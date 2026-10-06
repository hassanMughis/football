begin;

alter table public.players
  drop constraint if exists players_card_style_check;

alter table public.players
  add constraint players_card_style_check
  check (card_style in ('classic', 'royal', 'electric', 'crimson', 'eclipse', 'inferno', 'aurora', 'prism'));

commit;
