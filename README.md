# Squad Sheet – Football & Cricket

A mobile-first Next.js squad manager with shared football and cricket modes, player cards, balanced team generation, and live match tracking.

## Features

- Entry password: `3456` (remembered for the current browser tab)
- Add, edit, rate, activate, deactivate, and remove players
- Upload transparent player photos to Supabase Storage
- Four football card designs and four generated cricket card designs, each with a matching gray fallback version
- Card OVR and PAC/SHO/PAS/DRI/DEF/PHY generated from rating and speciality
- Generate and shuffle two balanced teams using rating and all six card stats
- Use either generated side as the match team
- Track scorers, assists, minutes, opponent goals, lineups, and player match stats
- Automatic or manually selected player of the match
- Full app state saved to Supabase, with local storage as an offline fallback
- Admin-only global Football/Cricket switch synchronized to every viewer with Supabase Realtime
- Separate cricket player cards with batting, bowling, fielding, speed, power, and technique ratings
- Cricket-aware team balancing by OVR, role distribution, wicketkeeping, and bowling coverage
- Scheduled or immediate cricket matches with overs, legal balls, wickets, extras, innings, targets, chase results, undo, and ball-by-ball commentary

## Supabase

The ignored `.env.local` file must contain:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

For a new project, run `supabase/schema.sql` first. Then run `supabase/rich-player-migration.sql` and `supabase/add-cricket-mode.sql`. For an existing project that already has rich player data, run only `supabase/add-cricket-mode.sql` for this update.

The migration stores every football card field directly in `players`: stable player ID, name, 0–10 rating, speciality, card style, position, flag, photo URL, availability, balanced-team assignment, match-squad/captain state, OVR, and PAC/SHO/PAS/DRI/DEF/PHY. Scorers, assists, and minutes are stored in `match_events`. Cricket players are stored separately in `cricket_players`, including role, batting hand, bowling style, photo, card design, availability, OVR, and BAT/BWL/FLD/SPD/PWR/TEC attributes. Cricket teams, innings, deliveries, commentary, and the shared sport mode remain in `squad_settings.app_state`; `sport_mode` mirrors the active mode for easy SQL inspection.

After running the migration, check all rich tables and Storage write/delete access with:

```sh
node scripts/check-supabase.mjs
```

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:3000` and enter `3456`.

## Vercel deployment

Import this repository as a Next.js project and add both Supabase variables from `.env.local` to the Vercel project's Environment Variables. Local environment files are intentionally excluded from Git. Redeploy after adding or changing those variables.
