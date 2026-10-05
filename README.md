# Squad Sheet – Football Team Builder

A mobile-first Next.js squad manager with football player cards, balanced team generation, and live match tracking.

## Features

- Entry password: `3456` (remembered for the current browser tab)
- Add, edit, rate, activate, deactivate, and remove players
- Upload transparent player photos to Supabase Storage
- Four card designs with a gray fallback silhouette
- Card OVR and PAC/SHO/PAS/DRI/DEF/PHY generated from rating and speciality
- Generate and shuffle two balanced teams using rating and all six card stats
- Use either generated side as the match team
- Track scorers, assists, minutes, opponent goals, lineups, and player match stats
- Automatic or manually selected player of the match
- Full app state saved to Supabase, with local storage as an offline fallback

## Supabase

The ignored `.env.local` file must contain:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

For a new project, run `supabase/schema.sql` first. Then run `supabase/rich-player-migration.sql`. For the existing project, only the rich-player migration is needed now.

The migration stores every card field directly in `players`: stable player ID, name, 0–10 rating, speciality, card style, position, flag, photo URL, availability, balanced-team assignment, match-squad/captain state, OVR, and PAC/SHO/PAS/DRI/DEF/PHY. Scorers, assists, and minutes are stored in `match_events`; the remaining UI/match state is stored in `squad_settings.app_state`.

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
