# Squad Sheet – Football & Cricket

A mobile-first Next.js squad manager with shared football and cricket modes, player cards, balanced team generation, and live match tracking.

## Features

- Supabase Auth admin login with a 30-day session and secure password changes
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
SUPABASE_SECRET_KEY=sb_secret_...
ADMIN_EMAIL=your-admin-user@example.com
```

`SUPABASE_SECRET_KEY` is server-only and must never use the `NEXT_PUBLIC_` prefix. Server routes use it only after applying their own admin checks; browser login and Realtime continue to use the publishable key.

Create that email/password user in **Supabase Dashboard â†’ Authentication â†’ Users** and enable **Auto Confirm User**. The email must exactly match `ADMIN_EMAIL`. The app does not contain a fallback admin password.

For a new project, run `supabase/schema.sql` first. Then run `supabase/rich-player-migration.sql`, `supabase/add-cricket-mode.sql`, and `supabase/secure-server-writes.sql` in that order. For an existing project, deploy the server code with `SUPABASE_SECRET_KEY` first, then run `supabase/secure-server-writes.sql` to remove direct browser write access.

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

Open `http://localhost:3000` and sign in with the password belonging to the Supabase Auth user configured by `ADMIN_EMAIL`.

## Vercel deployment

Import this repository as a Next.js project and add the four variables above to the Vercel project's Environment Variables. Local environment files are intentionally excluded from Git. Redeploy after adding or changing those variables.
