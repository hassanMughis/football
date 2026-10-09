import { getSupabaseConfig, supabaseRest } from "@/lib/supabase-rest";
import { isAdmin } from "@/lib/admin-auth";
import { cricketOverall, cricketStats, restoreCricketState } from "@/lib/cricket";

export const dynamic = "force-dynamic";

const stateObjectPath = "player-images/squad-sheet/app-state.json";
const statNames = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"] as const;
const specialities = new Set(["", "Passing", "Scoring", "Shooting", "Dribbling", "Teamwork", "Goalkeeping", "Defending", "Pace", "Strength", "Heading"]);
const maxPlayerSkills = 4;
const cardStyles = new Set(["classic", "royal", "electric", "crimson", "eclipse", "inferno", "aurora", "prism"]);
const positions = new Set(["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"]);
const positionStatOffsets: Record<string, Record<typeof statNames[number], number>> = {
  GK: { PAC: -15, SHO: -30, PAS: -5, DRI: -15, DEF: 30, PHY: 35 },
  CB: { PAC: -7, SHO: -22, PAS: -4, DRI: -12, DEF: 25, PHY: 20 },
  LB: { PAC: 7, SHO: -13, PAS: 4, DRI: 3, DEF: 10, PHY: -11 },
  RB: { PAC: 7, SHO: -13, PAS: 4, DRI: 3, DEF: 10, PHY: -11 },
  CDM: { PAC: -2, SHO: -10, PAS: 7, DRI: -1, DEF: 12, PHY: -6 },
  CM: { PAC: 0, SHO: -2, PAS: 9, DRI: 6, DEF: -5, PHY: -8 },
  CAM: { PAC: 3, SHO: 5, PAS: 10, DRI: 10, DEF: -23, PHY: -5 },
  LM: { PAC: 8, SHO: 3, PAS: 7, DRI: 8, DEF: -18, PHY: -8 },
  RM: { PAC: 8, SHO: 3, PAS: 7, DRI: 8, DEF: -18, PHY: -8 },
  LW: { PAC: 12, SHO: 7, PAS: 4, DRI: 12, DEF: -30, PHY: -5 },
  RW: { PAC: 12, SHO: 7, PAS: 4, DRI: 12, DEF: -30, PHY: -5 },
  CF: { PAC: 5, SHO: 10, PAS: 5, DRI: 8, DEF: -30, PHY: 2 },
  ST: { PAC: 8, SHO: 12, PAS: 1, DRI: 7, DEF: -35, PHY: 7 },
};

type JsonObject = Record<string, unknown>;
type PlayerRow = {
  client_id: string;
  name: string;
  rating: number;
  speciality: string;
  skills: string[] | null;
  custom_overall: number | null;
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
type CricketPlayerRow = {
  client_id: string;
  name: string;
  rating: number;
  custom_overall: number | null;
  role: string;
  batting_hand: string;
  bowling_style: string;
  image_url: string | null;
  flag: string;
  card_style: string;
  active: boolean;
  batting: number | null;
  bowling: number | null;
  fielding: number | null;
  speed: number | null;
  power: number | null;
  technique: number | null;
};

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

function normalizedSkills(value: unknown, legacySkill: unknown) {
  const candidates = [...(Array.isArray(value) ? value : []), legacySkill];
  return [...new Set(candidates.map(String).filter((skill) => skill && specialities.has(skill)))].slice(0, maxPlayerSkills);
}

function defaultPositionFor(player: JsonObject, skills = normalizedSkills(player.skills, player.spec)) {
  const savedPosition = String(player.position || "");
  if (positions.has(savedPosition)) return savedPosition;
  return ({ Scoring: "ST", Shooting: "ST", Dribbling: "LW", Passing: "CM", Teamwork: "CDM", Goalkeeping: "GK", Defending: "CB", Pace: "RW", Strength: "CDM", Heading: "ST" } as Record<string, string>)[skills[0]] || "CM";
}

function generatedStats(player: JsonObject) {
  const rating = Math.max(0, Math.min(10, Math.round(numberValue(player.rating) * 2) / 2));
  const skills = normalizedSkills(player.skills, player.spec);
  const customOverallValue = Number(player.customOverall);
  const customOverall = Number.isInteger(customOverallValue) && customOverallValue >= 1 && customOverallValue <= 99 ? customOverallValue : null;
  if (!rating && !customOverall) return { OVR: null, PAC: null, SHO: null, PAS: null, DRI: null, DEF: null, PHY: null };
  const base = customOverall ?? 44 + rating * 5;
  const boost = (label: typeof statNames[number]) => {
    let total = 0;
    if ((skills.includes("Scoring") || skills.includes("Shooting")) && label === "SHO") total += 6;
    if (skills.includes("Passing") && label === "PAS") total += 6;
    if (skills.includes("Dribbling") && label === "DRI") total += 6;
    if (skills.includes("Teamwork") && (label === "PAS" || label === "PHY")) total += 4;
    if (skills.includes("Goalkeeping") && label === "DEF") total += 6;
    if (skills.includes("Goalkeeping") && label === "PHY") total += 4;
    if (skills.includes("Defending") && label === "DEF") total += 6;
    if (skills.includes("Pace") && label === "PAC") total += 6;
    if (skills.includes("Strength") && label === "PHY") total += 6;
    if (skills.includes("Heading") && (label === "SHO" || label === "PHY")) total += 3;
    return total;
  };
  const offsets = positionStatOffsets[defaultPositionFor(player, skills)] || positionStatOffsets.CM;
  const stats = Object.fromEntries(statNames.map((label) => [label, Math.round(Math.max(1, Math.min(99, base + offsets[label] + boost(label))))])) as Record<typeof statNames[number], number>;
  return { OVR: customOverall ?? Math.round(statNames.reduce((sum, label) => sum + stats[label], 0) / statNames.length), ...stats };
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
    if (rating < 0 || rating > 10 || Math.abs(rating * 2 - Math.round(rating * 2)) > Number.EPSILON) throw new Error("Player ratings must be between 0 and 10 in half-point steps.");
    const skills = normalizedSkills(candidate.skills, candidate.spec);
    const spec = skills[0] || "";
    const rawCustomOverall = candidate.customOverall;
    const customOverall = rawCustomOverall === undefined || rawCustomOverall === null || rawCustomOverall === "" ? null : numberValue(rawCustomOverall, Number.NaN);
    if (customOverall !== null && (!Number.isInteger(customOverall) || customOverall < 1 || customOverall > 99)) throw new Error("Custom OVR must be a whole number from 1 to 99.");
    const position = defaultPositionFor(candidate, skills);
    const cardStyle = cardStyles.has(String(candidate.cardStyle || "")) ? String(candidate.cardStyle) : "classic";
    const flag = flagEmoji(candidate.flag);
    const normalized = { ...candidate, id, name, rating: customOverall ? 0 : rating, spec, skills, customOverall, position, cardStyle, flag, on: candidate.on !== false };
    ids.add(id);
    return { ...normalized, cardStats: generatedStats(normalized) };
  });
  const sportMode = value.sportMode === "cricket" ? "cricket" : "football";
  const cricket = restoreCricketState(value.cricket);
  return { ...value, sportMode, cricket, players };
}

async function readStorageState() {
  const config = getSupabaseConfig("public");
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
    headers: { apikey: config.key, "content-type": "application/json", "x-upsert": "true" },
    body: JSON.stringify(state),
    cache: "no-store",
  });
  if (!response.ok) throw new Error((await response.text()) || `Supabase state save failed (${response.status}).`);
}

async function readDatabaseState() {
  const [playersResponse, settingsResponse] = await Promise.all([
    supabaseRest("players?select=client_id,name,rating,speciality,skills,custom_overall,image_url,card_style,position,flag,available,team,is_captain,in_match_squad,overall,pac,sho,pas,dri,def,phy&order=sort_order.asc,id.asc"),
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
  let cricketPlayerRows: CricketPlayerRow[] | null = null;
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
  try {
    const response = await supabaseRest("cricket_players?select=client_id,name,rating,custom_overall,role,batting_hand,bowling_style,image_url,flag,card_style,active,batting,bowling,fielding,speed,power,technique&order=sort_order.asc,id.asc");
    cricketPlayerRows = await response.json() as CricketPlayerRow[];
  } catch { /* Preserve the embedded cricket roster until the cricket migration is run. */ }

  const base = settings.app_state;
  const players = rows.map((row) => ({
    id: row.client_id,
    name: row.name,
    rating: row.rating,
    spec: row.speciality,
    skills: row.skills || (row.speciality ? [row.speciality] : []),
    customOverall: row.custom_overall ?? undefined,
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
  const baseEvents = Array.isArray(baseMatch.ev) ? baseMatch.ev : [];
  const captain1 = rows.find((row) => row.team === 1 && row.is_captain)?.client_id || String(baseTeam1.captain || matchIds[0] || "");
  const captain2 = rows.find((row) => row.team === 2 && row.is_captain)?.client_id || String(baseTeam2.captain || secondIds[0] || "");
  const positions1 = Object.fromEntries(rows.filter((row) => row.team === 1).map((row) => [row.client_id, lineupPositions.get(row.client_id) || (typeof basePositions1[row.client_id] === "string" ? String(basePositions1[row.client_id]) : "")]).filter((entry) => entry[1]));
  const positions2 = Object.fromEntries(rows.filter((row) => row.team === 2).map((row) => [row.client_id, lineupPositions.get(row.client_id) || (typeof basePositions2[row.client_id] === "string" ? String(basePositions2[row.client_id]) : "")]).filter((entry) => entry[1]));
  const restoredCricketPlayers = cricketPlayerRows?.map((row) => ({
      id: row.client_id,
      name: row.name,
      rating: Number(row.rating) || 0,
      customOverall: row.custom_overall ?? undefined,
      role: row.role === "Batter" || row.role === "Bowler" || row.role === "Wicketkeeper" ? row.role : "All-rounder",
      batting: row.batting_hand === "Left hand" ? "Left hand" : "Right hand",
      bowling: row.bowling_style,
      image: row.image_url || undefined,
      flag: row.flag,
      cardStyle: row.card_style === "classic" || row.card_style === "eclipse" || row.card_style === "crimson" ? row.card_style : "electric",
      stats: {
        ...(row.batting ? { BAT: row.batting } : {}),
        ...(row.bowling ? { BWL: row.bowling } : {}),
        ...(row.fielding ? { FLD: row.fielding } : {}),
        ...(row.speed ? { SPD: row.speed } : {}),
        ...(row.power ? { PWR: row.power } : {}),
        ...(row.technique ? { TEC: row.technique } : {}),
      },
      active: row.active,
    }));
  const baseCricket = isJsonObject(base.cricket) ? base.cricket : {};
  const useCricketPlayerTable = Boolean(cricketPlayerRows) && (
    baseCricket.playersSource === "table"
    || (baseCricket.playersSource !== "embedded" && (!Array.isArray(baseCricket.players) || baseCricket.players.length === 0))
  );
  const cricket = restoreCricketState(useCricketPlayerTable ? { ...baseCricket, players: restoredCricketPlayers } : baseCricket);
  return {
    ...base,
    cricket,
    players,
    history: historyRows.length ? historyRows.map((row) => row.snapshot).filter(isJsonObject) : base.history,
    team: matchIds.length ? { ids: matchIds, captain: captain1 } : null,
    balancedTeams: firstIds.length || secondIds.length ? {
      ...baseBalance,
      team1: { ...baseTeam1, name: settings.team_1_name, ids: firstIds, captain: captain1, positions: positions1 },
      team2: { ...baseTeam2, name: settings.team_2_name, ids: secondIds, captain: captain2, positions: positions2 },
    } : null,
    match: {
      ...baseMatch,
      us: settings.match_team_name,
      opp: settings.opponent_name,
      them: settings.opponent_goals,
      st: settings.match_status,
      motm: settings.motm_client_id || "",
      ev: events ? events.map((event, index) => ({ ...(isJsonObject(baseEvents[index]) ? baseEvents[index] : {}), s: event.scorer_client_id, a: event.assist_client_id || "", m: event.minute, team: event.team_number === 2 ? 2 : 1 })) : baseMatch.ev,
    },
  };
}

export async function GET() {
  try {
    let databaseState: JsonObject | null = null;
    let storageState: JsonObject | null = null;
    try { databaseState = await readDatabaseState(); } catch { /* The rich-table migration may not have been run yet. */ }
    try { storageState = await readStorageState(); } catch { /* Database state can remain available if Storage is temporarily unavailable. */ }
    if (databaseState && numberValue(databaseState.syncVersion) >= 1) return Response.json({ state: databaseState, source: "database" });
    const databaseSavedAt = numberValue(databaseState?.savedAt);
    const storageSavedAt = numberValue(storageState?.savedAt);
    if (storageState && (!databaseState || storageSavedAt > databaseSavedAt)) return Response.json({ state: storageState, source: "storage" });
    return Response.json({ state: databaseState || storageState, source: databaseState ? "database" : "storage" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the squad state." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!await isAdmin()) return Response.json({ error: "Admin login required." }, { status: 401 });
  try {
    const state = { ...validateAndEnrichState(await request.json()), syncVersion: 1 };
    try {
      const cricketState = restoreCricketState(state.cricket);
      const cricketPlayers = cricketState.players.map((player, sortOrder) => {
        const stats = Object.fromEntries(cricketStats(player).map(([label, value]) => [label, typeof value === "number" ? value : null]));
        return {
          id: player.id,
          name: player.name,
          rating: player.rating,
          customOverall: player.customOverall ?? null,
          overall: cricketOverall(player) || null,
          role: player.role,
          batting: player.batting,
          bowling: player.bowling,
          image: player.image || null,
          flag: player.flag || "PK",
          cardStyle: player.cardStyle,
          active: player.active,
          sortOrder,
          stats,
        };
      });
      let cricketPlayersSaved = false;
      try {
        await supabaseRest("rpc/save_cricket_players", {
          method: "POST",
          body: JSON.stringify({ p_players: cricketPlayers }),
        });
        cricketPlayersSaved = true;
      } catch { /* Keep cricket players embedded so the canonical state row can still update in Realtime. */ }
      const databaseState = {
        ...state,
        cricket: cricketPlayersSaved
          ? { ...cricketState, players: [], playersSource: "table" }
          : { ...cricketState, playersSource: "embedded" },
      };
      await supabaseRest("rpc/save_squad_sheet_state", {
        method: "POST",
        body: JSON.stringify({ p_state: databaseState }),
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
