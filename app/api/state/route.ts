import { getSupabaseConfig, supabaseRest } from "@/lib/supabase-rest";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const stateObjectPath = "player-images/squad-sheet/app-state.json";
const statNames = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"] as const;
const specialities = new Set(["", "Passing", "Scoring", "Shooting", "Dribbling", "Teamwork"]);
const cardStyles = new Set(["classic", "royal", "electric", "crimson"]);
const positions = new Set(["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"]);

type JsonObject = Record<string, unknown>;
type PlayerRow = {
  client_id: string;
  name: string;
  rating: number;
  speciality: string;
  image_url: string | null;
  card_style: string;
  position: string;
  flag: string;
  available: boolean;
  team: number;
  is_captain: boolean;
  in_match_squad: boolean;
  overall: number | null;
  pac: number | null;
  sho: number | null;
  pas: number | null;
  dri: number | null;
  def: number | null;
  phy: number | null;
};
type SettingsRow = {
  team_1_name: string;
  team_2_name: string;
  match_team_name: string;
  opponent_name: string;
  opponent_goals: number;
  match_status: "Live" | "Full-time";
  motm_client_id: string | null;
  app_state: unknown;
};
type EventRow = { scorer_client_id: string; assist_client_id: string | null; minute: number | null; team_number: number };
type HistoryRow = { snapshot: unknown };
type LineupPositionRow = { client_id: string; lineup_position: string | null };

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function flagEmoji(value: unknown) {
  const flag = typeof value === "string" && value.trim() ? value.trim().slice(0, 16) : "PK";
  if (!/^[a-z]{2}$/i.test(flag)) return flag;
  return [...flag.toUpperCase()].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("");
}

function generatedStats(player: JsonObject) {
  const rating = Math.max(0, Math.min(10, Math.round(numberValue(player.rating))));
  const speciality = typeof player.spec === "string" ? player.spec : "";
  if (!rating) return { OVR: null, PAC: null, SHO: null, PAS: null, DRI: null, DEF: null, PHY: null };
  const base = 44 + rating * 5;
  const boost = (label: typeof statNames[number]) => {
    if ((speciality === "Scoring" || speciality === "Shooting") && label === "SHO") return 6;
    if (speciality === "Passing" && label === "PAS") return 6;
    if (speciality === "Dribbling" && label === "DRI") return 6;
    if (speciality === "Teamwork" && (label === "PAS" || label === "PHY")) return 4;
    return 0;
  };
  const offsets = { PAC: 1, SHO: -1, PAS: 0, DRI: 2, DEF: -8, PHY: -3 } as const;
  const stats = Object.fromEntries(statNames.map((label) => [label, Math.max(1, Math.min(99, base + offsets[label] + boost(label)))])) as Record<typeof statNames[number], number>;
  return { OVR: Math.round(statNames.reduce((sum, label) => sum + stats[label], 0) / statNames.length), ...stats };
}

function validateAndEnrichState(value: unknown) {
  if (!isJsonObject(value) || !Array.isArray(value.players)) throw new Error("The squad state must contain a players array.");
  if (value.players.length > 100) throw new Error("A squad supports at most 100 players.");
  const ids = new Set<string>();
  const players = value.players.map((candidate) => {
    if (!isJsonObject(candidate)) throw new Error("Every player must be an object.");
    const id = String(candidate.id || "").trim();
    const name = String(candidate.name || "").trim();
    const rating = numberValue(candidate.rating);
    if (!id || id.length > 80 || ids.has(id)) throw new Error("Every player needs a unique ID.");
    if (!name || name.length > 60) throw new Error("Player names must be between 1 and 60 characters.");
    if (!Number.isInteger(rating) || rating < 0 || rating > 10) throw new Error("Player ratings must be between 0 and 10.");
    const spec = specialities.has(String(candidate.spec || "")) ? String(candidate.spec || "") : "";
    const defaultPosition = ({ Scoring: "ST", Shooting: "ST", Dribbling: "LW", Passing: "CM", Teamwork: "CDM" } as Record<string, string>)[spec] || "CM";
    const position = positions.has(String(candidate.position || "")) ? String(candidate.position) : defaultPosition;
    const cardStyle = cardStyles.has(String(candidate.cardStyle || "")) ? String(candidate.cardStyle) : "classic";
    const flag = flagEmoji(candidate.flag);
    const normalized = { ...candidate, id, name, rating, spec, position, cardStyle, flag, on: candidate.on !== false };
    ids.add(id);
    return { ...normalized, cardStats: generatedStats(normalized) };
  });
  return { ...value, players };
}

async function readStorageState() {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${stateObjectPath}`, {
    headers: { apikey: config.key },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    if (/Object not found|NoSuchKey|not_found|"404"/i.test(detail)) return null;
    throw new Error(detail || `Supabase state request failed (${response.status}).`);
  }
  const state: unknown = await response.json();
  if (!isJsonObject(state)) throw new Error("The saved squad state is not a JSON object.");
  return state;
}

async function writeStorageState(state: JsonObject) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${stateObjectPath}`, {
    method: "POST",
    headers: { apikey: config.key, "content-type": "image/png", "x-upsert": "true" },
    body: JSON.stringify(state),
    cache: "no-store",
  });
  if (!response.ok) throw new Error((await response.text()) || `Supabase state save failed (${response.status}).`);
}

async function readDatabaseState() {
  const [playersResponse, settingsResponse] = await Promise.all([
    supabaseRest("players?select=client_id,name,rating,speciality,image_url,card_style,position,flag,available,team,is_captain,in_match_squad,overall,pac,sho,pas,dri,def,phy&order=sort_order.asc,id.asc"),
    supabaseRest("squad_settings?id=eq.1&select=team_1_name,team_2_name,match_team_name,opponent_name,opponent_goals,match_status,motm_client_id,app_state"),
  ]);
  const rows = await playersResponse.json() as PlayerRow[];
  const settings = (await settingsResponse.json() as SettingsRow[])[0];
  if (!settings || !isJsonObject(settings.app_state) || !Object.keys(settings.app_state).length) return null;

  // These fields were added by the latest migration. Until it is rerun,
  // app_state remains the canonical copy so saves never appear to disappear.
  let events: EventRow[] | null = null;
  let historyRows: HistoryRow[] = [];
  let lineupPositions = new Map<string, string>();
  try {
    const response = await supabaseRest("match_events?select=scorer_client_id,assist_client_id,minute,team_number&order=event_order.asc,id.asc");
    events = await response.json() as EventRow[];
  } catch { /* Preserve events, including their team, from app_state on older schemas. */ }
  try {
    const response = await supabaseRest("match_history?select=snapshot&order=ended_at.desc");
    historyRows = await response.json() as HistoryRow[];
  } catch { /* Preserve history from app_state until the history table exists. */ }
  try {
    const response = await supabaseRest("players?select=client_id,lineup_position");
    const positionRows = await response.json() as LineupPositionRow[];
    lineupPositions = new Map(positionRows.filter((row) => row.lineup_position).map((row) => [row.client_id, row.lineup_position!]));
  } catch { /* Preserve generated lineup positions from app_state on older schemas. */ }

  const base = settings.app_state;
  const players = rows.map((row) => ({
    id: row.client_id,
    name: row.name,
    rating: row.rating,
    spec: row.speciality,
    image: row.image_url || undefined,
    cardStyle: row.card_style,
    position: row.position,
    flag: row.flag,
    on: row.available ? undefined : false,
    cardStats: { OVR: row.overall, PAC: row.pac, SHO: row.sho, PAS: row.pas, DRI: row.dri, DEF: row.def, PHY: row.phy },
  }));
  const firstIds = rows.filter((row) => row.team === 1).map((row) => row.client_id);
  const secondIds = rows.filter((row) => row.team === 2).map((row) => row.client_id);
  const matchIds = rows.filter((row) => row.in_match_squad).map((row) => row.client_id);
  const baseBalance = isJsonObject(base.balancedTeams) ? base.balancedTeams : {};
  const baseMatch = isJsonObject(base.match) ? base.match : {};
  const baseTeam1 = isJsonObject(baseBalance.team1) ? baseBalance.team1 : {};
  const baseTeam2 = isJsonObject(baseBalance.team2) ? baseBalance.team2 : {};
  const basePositions1 = isJsonObject(baseTeam1.positions) ? baseTeam1.positions : {};
  const basePositions2 = isJsonObject(baseTeam2.positions) ? baseTeam2.positions : {};
  const captain1 = rows.find((row) => row.team === 1 && row.is_captain)?.client_id || String(baseTeam1.captain || matchIds[0] || "");
  const captain2 = rows.find((row) => row.team === 2 && row.is_captain)?.client_id || String(baseTeam2.captain || secondIds[0] || "");
  const positions1 = Object.fromEntries(rows.filter((row) => row.team === 1).map((row) => [row.client_id, lineupPositions.get(row.client_id) || (typeof basePositions1[row.client_id] === "string" ? String(basePositions1[row.client_id]) : "")]).filter((entry) => entry[1]));
  const positions2 = Object.fromEntries(rows.filter((row) => row.team === 2).map((row) => [row.client_id, lineupPositions.get(row.client_id) || (typeof basePositions2[row.client_id] === "string" ? String(basePositions2[row.client_id]) : "")]).filter((entry) => entry[1]));
  return {
    ...base,
    players,
    history: historyRows.length ? historyRows.map((row) => row.snapshot).filter(isJsonObject) : base.history,
    team: matchIds.length ? { ids: matchIds, captain: captain1 } : null,
    balancedTeams: firstIds.length || secondIds.length ? {
      ...baseBalance,
      team1: { name: settings.team_1_name, ids: firstIds, captain: captain1, positions: positions1 },
      team2: { name: settings.team_2_name, ids: secondIds, captain: captain2, positions: positions2 },
    } : null,
    match: {
      ...baseMatch,
      us: settings.match_team_name,
      opp: settings.opponent_name,
      them: settings.opponent_goals,
      st: settings.match_status,
      motm: settings.motm_client_id || "",
      ev: events ? events.map((event) => ({ s: event.scorer_client_id, a: event.assist_client_id || "", m: event.minute, team: event.team_number === 2 ? 2 : 1 })) : baseMatch.ev,
    },
  };
}

export async function GET() {
  try {
    try {
      const databaseState = await readDatabaseState();
      if (databaseState) return Response.json({ state: databaseState, source: "database" });
    } catch { /* The rich-table migration may not have been run yet. */ }
    return Response.json({ state: await readStorageState(), source: "storage" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the squad state." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!await isAdmin()) return Response.json({ error: "Admin login required." }, { status: 401 });
  try {
    const state = validateAndEnrichState(await request.json());
    try {
      await supabaseRest("rpc/save_squad_sheet_state", {
        method: "POST",
        body: JSON.stringify({ p_state: state }),
      });
      return Response.json({ state, source: "database" });
    } catch {
      // Keep the app usable while the rich-table migration is pending or if a
      // database policy/function is temporarily unavailable. Storage is still
      // Supabase-backed and the next successful save will populate the tables.
      await writeStorageState(state);
      return Response.json({ state, source: "storage" });
    }
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "The request body must contain valid JSON." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Could not save the squad state.";
    const status = /must|needs|between|supports/i.test(message) ? 400 : 503;
    return Response.json({ error: message }, { status });
  }
}
