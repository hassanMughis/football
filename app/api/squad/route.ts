import { supabaseRest } from "@/lib/supabase-rest";
import { z } from "zod";

export const dynamic = "force-dynamic";

const squadInput = z.object({
  players: z.array(z.object({
    id: z.number().int(),
    name: z.string().trim().min(1).max(60),
    rating: z.number().int().min(50).max(99),
    available: z.boolean(),
    team: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    imageUrl: z.string().url().max(500).nullish(),
  })).max(100),
  team1Name: z.string().trim().min(1).max(40),
  team2Name: z.string().trim().min(1).max(40),
});

type PlayerRow = { id: number; name: string; rating: number; available: boolean; team: number; image_url: string | null };
type SettingsRow = { team_1_name: string; team_2_name: string };

async function readState() {
  const [playerResponse, settingsResponse] = await Promise.all([
    supabaseRest("players?select=id,name,rating,available,team,image_url&order=sort_order.asc,id.asc"),
    supabaseRest("squad_settings?id=eq.1&select=team_1_name,team_2_name"),
  ]);
  const rows = await playerResponse.json() as PlayerRow[];
  const settings = await settingsResponse.json() as SettingsRow[];
  return {
    players: rows.map((row) => ({ id: row.id, name: row.name, rating: row.rating, available: row.available, team: row.team, imageUrl: row.image_url })),
    team1Name: settings[0]?.team_1_name || "Team 1",
    team2Name: settings[0]?.team_2_name || "Team 2",
  };
}

export async function GET() {
  try { return Response.json(await readState()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not load the squad." }, { status: 503 }); }
}

export async function PUT(request: Request) {
  try {
    const parsed = squadInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the player names, ratings and team names, then try again." }, { status: 400 });
    const squad = parsed.data;
    await supabaseRest("rpc/save_team_maker_squad", {
      method: "POST",
      body: JSON.stringify({ p_players: squad.players, p_team1_name: squad.team1Name, p_team2_name: squad.team2Name }),
    });
    return Response.json(await readState());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the squad." }, { status: 503 });
  }
}
