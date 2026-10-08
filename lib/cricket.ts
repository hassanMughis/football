export const CRICKET_ROLES = ["Batter", "Bowler", "All-rounder", "Wicketkeeper"] as const;
export const CRICKET_CARD_STYLES = ["classic", "royal", "electric", "crimson", "eclipse", "inferno", "aurora", "prism"] as const;

export type CricketRole = typeof CRICKET_ROLES[number];
export type CricketCardStyle = typeof CRICKET_CARD_STYLES[number];
export type CricketTab = "match" | "team" | "players";
export type CricketPlayer = {
  id: string;
  name: string;
  rating: number;
  customOverall?: number;
  role: CricketRole;
  batting: "Right hand" | "Left hand";
  bowling: string;
  image?: string;
  flag?: string;
  cardStyle: CricketCardStyle;
  active: boolean;
};

export type CricketTeam = { name: string; ids: string[]; captain: string };
export type CricketTeams = { team1: CricketTeam; team2: CricketTeam; seed: number; cost: number };
export type CricketDeliveryKind = "dot" | "run" | "four" | "six" | "wicket" | "wide" | "no-ball";
export type CricketDelivery = {
  id: string;
  innings: 1 | 2;
  over: number;
  ball: number;
  legal: boolean;
  kind: CricketDeliveryKind;
  runs: number;
  batterId: string;
  nonStrikerId: string;
  bowlerId: string;
  commentary: string;
};
export type CricketInnings = {
  battingTeam: 1 | 2;
  runs: number;
  wickets: number;
  balls: number;
  deliveries: CricketDelivery[];
};
export type CricketMatchStatus = "setup" | "scheduled" | "live" | "innings-break" | "complete";
export type CricketMatch = {
  status: CricketMatchStatus;
  overs: number;
  battingFirst: 1 | 2;
  inningsNumber: 1 | 2;
  innings: CricketInnings[];
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
};
export type CricketState = {
  tab: CricketTab;
  players: CricketPlayer[];
  teams: CricketTeams | null;
  match: CricketMatch;
};

export const emptyCricketMatch = (): CricketMatch => ({
  status: "setup",
  overs: 5,
  battingFirst: 1,
  inningsNumber: 1,
  innings: [],
  strikerId: "",
  nonStrikerId: "",
  bowlerId: "",
});

export const initialCricketState = (): CricketState => ({
  tab: "match",
  players: [],
  teams: null,
  match: emptyCricketMatch(),
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const safeRating = (value: unknown) => Math.max(0, Math.min(10, Math.round((Number(value) || 0) * 2) / 2));
const safeOverall = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 99 ? number : undefined;
};

const normalizePlayer = (value: unknown, index: number): CricketPlayer | null => {
  if (!isRecord(value)) return null;
  const name = String(value.name || "").trim();
  if (!name) return null;
  const role = CRICKET_ROLES.includes(value.role as CricketRole) ? value.role as CricketRole : "All-rounder";
  const cardStyle = CRICKET_CARD_STYLES.includes(value.cardStyle as CricketCardStyle) ? value.cardStyle as CricketCardStyle : "classic";
  return {
    id: String(value.id || `cricket-${index}`),
    name: name.slice(0, 60),
    rating: safeOverall(value.customOverall) ? 0 : safeRating(value.rating),
    customOverall: safeOverall(value.customOverall),
    role,
    batting: value.batting === "Left hand" ? "Left hand" : "Right hand",
    bowling: String(value.bowling || (role === "Batter" || role === "Wicketkeeper" ? "Does not bowl" : "Right-arm medium")).slice(0, 50),
    image: typeof value.image === "string" && value.image ? value.image : undefined,
    flag: typeof value.flag === "string" && value.flag ? value.flag : "PK",
    cardStyle,
    active: value.active !== false,
  };
};

const normalizeTeam = (value: unknown, validIds: Set<string>, fallbackName: string): CricketTeam | null => {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null;
  const ids = value.ids.map(String).filter((id, index, all) => validIds.has(id) && all.indexOf(id) === index);
  if (!ids.length) return null;
  const requestedCaptain = String(value.captain || "");
  return { name: String(value.name || fallbackName).trim().slice(0, 40) || fallbackName, ids, captain: ids.includes(requestedCaptain) ? requestedCaptain : ids[0] };
};

const normalizeDelivery = (value: unknown): CricketDelivery | null => {
  if (!isRecord(value)) return null;
  const kind = ["dot", "run", "four", "six", "wicket", "wide", "no-ball"].includes(String(value.kind)) ? value.kind as CricketDeliveryKind : "dot";
  return {
    id: String(value.id || ""),
    innings: value.innings === 2 ? 2 : 1,
    over: Math.max(0, Math.floor(Number(value.over) || 0)),
    ball: Math.max(0, Math.min(6, Math.floor(Number(value.ball) || 0))),
    legal: value.legal !== false,
    kind,
    runs: Math.max(0, Math.min(7, Math.floor(Number(value.runs) || 0))),
    batterId: String(value.batterId || ""),
    nonStrikerId: String(value.nonStrikerId || ""),
    bowlerId: String(value.bowlerId || ""),
    commentary: String(value.commentary || "Delivery recorded.").slice(0, 500),
  };
};

const normalizeInnings = (value: unknown): CricketInnings | null => {
  if (!isRecord(value)) return null;
  return {
    battingTeam: value.battingTeam === 2 ? 2 : 1,
    runs: Math.max(0, Math.floor(Number(value.runs) || 0)),
    wickets: Math.max(0, Math.floor(Number(value.wickets) || 0)),
    balls: Math.max(0, Math.floor(Number(value.balls) || 0)),
    deliveries: Array.isArray(value.deliveries) ? value.deliveries.map(normalizeDelivery).filter((item): item is CricketDelivery => Boolean(item)).slice(-600) : [],
  };
};

export function restoreCricketState(value: unknown): CricketState {
  const base = initialCricketState();
  if (!isRecord(value)) return base;
  const players = Array.isArray(value.players) ? value.players.map(normalizePlayer).filter((item): item is CricketPlayer => Boolean(item)).slice(0, 100) : [];
  const validIds = new Set(players.map((item) => item.id));
  const rawTeams = isRecord(value.teams) ? value.teams : null;
  const team1 = normalizeTeam(rawTeams?.team1, validIds, "Team 1");
  const team2 = normalizeTeam(rawTeams?.team2, validIds, "Team 2");
  const teams = team1 && team2 ? { team1, team2, seed: Math.max(0, Math.floor(Number(rawTeams?.seed) || 0)), cost: Math.max(0, Number(rawTeams?.cost) || 0) } : null;
  const rawMatch = isRecord(value.match) ? value.match : {};
  const innings = Array.isArray(rawMatch.innings) ? rawMatch.innings.map(normalizeInnings).filter((item): item is CricketInnings => Boolean(item)).slice(0, 2) : [];
  const status = ["setup", "scheduled", "live", "innings-break", "complete"].includes(String(rawMatch.status)) ? rawMatch.status as CricketMatchStatus : "setup";
  return {
    tab: value.tab === "team" || value.tab === "players" ? value.tab : "match",
    players,
    teams,
    match: {
      status: teams ? status : "setup",
      overs: Math.max(1, Math.min(50, Math.floor(Number(rawMatch.overs) || 5))),
      battingFirst: rawMatch.battingFirst === 2 ? 2 : 1,
      inningsNumber: rawMatch.inningsNumber === 2 ? 2 : 1,
      innings,
      strikerId: validIds.has(String(rawMatch.strikerId || "")) ? String(rawMatch.strikerId) : "",
      nonStrikerId: validIds.has(String(rawMatch.nonStrikerId || "")) ? String(rawMatch.nonStrikerId) : "",
      bowlerId: validIds.has(String(rawMatch.bowlerId || "")) ? String(rawMatch.bowlerId) : "",
      scheduledFor: typeof rawMatch.scheduledFor === "string" && Number.isFinite(Date.parse(rawMatch.scheduledFor)) ? rawMatch.scheduledFor : undefined,
      startedAt: typeof rawMatch.startedAt === "string" ? rawMatch.startedAt : undefined,
      completedAt: typeof rawMatch.completedAt === "string" ? rawMatch.completedAt : undefined,
      result: typeof rawMatch.result === "string" ? rawMatch.result.slice(0, 160) : undefined,
    },
  };
}

export function cricketOverall(player: CricketPlayer) {
  return player.customOverall ?? (player.rating ? Math.max(45, Math.min(99, Math.round(44 + player.rating * 5))) : 0);
}

export function cricketStats(player: CricketPlayer): Array<[string, number | "–"]> {
  const overall = cricketOverall(player);
  if (!overall) return [["BAT", "–"], ["BWL", "–"], ["FLD", "–"], ["SPD", "–"], ["PWR", "–"], ["TEC", "–"]];
  const offsets: Record<CricketRole, number[]> = {
    Batter: [8, -18, 2, 2, 7, 9],
    Bowler: [-15, 10, 3, 4, 2, 1],
    "All-rounder": [4, 5, 4, 3, 4, 4],
    Wicketkeeper: [5, -12, 11, 6, 2, 7],
  };
  const labels = ["BAT", "BWL", "FLD", "SPD", "PWR", "TEC"];
  return labels.map((label, index) => [label, Math.max(1, Math.min(99, overall + offsets[player.role][index]))]);
}

const balanceCost = (first: CricketPlayer[], second: CricketPlayer[]) => {
  const ratingDifference = Math.abs(first.reduce((sum, item) => sum + cricketOverall(item), 0) - second.reduce((sum, item) => sum + cricketOverall(item), 0));
  const roleWeight: Record<CricketRole, number> = { Batter: 7, Bowler: 12, "All-rounder": 8, Wicketkeeper: 35 };
  const roleDifference = CRICKET_ROLES.reduce((total, role) => total + Math.abs(first.filter((item) => item.role === role).length - second.filter((item) => item.role === role).length) * roleWeight[role], 0);
  const keeperPenalty = (first.some((item) => item.role === "Wicketkeeper") ? 0 : 80) + (second.some((item) => item.role === "Wicketkeeper") ? 0 : 80);
  const bowlingOptions = (team: CricketPlayer[]) => team.filter((item) => item.role === "Bowler" || item.role === "All-rounder").length;
  const bowlingPenalty = (bowlingOptions(first) ? 0 : 55) + (bowlingOptions(second) ? 0 : 55);
  return ratingDifference * 10 + roleDifference + keeperPenalty + bowlingPenalty;
};

export function makeBalancedCricketTeams(players: CricketPlayer[], captain1: string, captain2: string, seed = Date.now()): CricketTeams {
  const active = players.filter((item) => item.active);
  if (active.length < 2) throw new Error("Add at least two active cricket players.");
  if (!captain1 || !captain2 || captain1 === captain2) throw new Error("Choose two different captains.");
  const firstCaptain = active.find((item) => item.id === captain1);
  const secondCaptain = active.find((item) => item.id === captain2);
  if (!firstCaptain || !secondCaptain) throw new Error("Both captains must be active players.");
  const seededOrder = (id: string) => [...id].reduce((total, character) => (total * 33 + character.charCodeAt(0) + seed) % 2147483647, seed % 2147483647);
  const remaining = active.filter((item) => item.id !== captain1 && item.id !== captain2).sort((a, b) => cricketOverall(b) - cricketOverall(a) || seededOrder(a.id) - seededOrder(b.id) || a.name.localeCompare(b.name));
  const firstSize = Math.ceil(active.length / 2);
  let bestFirst: CricketPlayer[] = [];
  let bestSecond: CricketPlayer[] = [];
  let bestCost = Number.POSITIVE_INFINITY;
  const needed = firstSize - 1;

  if (remaining.length <= 18) {
    const chosen: CricketPlayer[] = [];
    const search = (index: number) => {
      if (chosen.length > needed || chosen.length + remaining.length - index < needed) return;
      if (index === remaining.length) {
        if (chosen.length !== needed) return;
        const chosenIds = new Set(chosen.map((item) => item.id));
        const first = [firstCaptain, ...chosen];
        const second = [secondCaptain, ...remaining.filter((item) => !chosenIds.has(item.id))];
        const cost = balanceCost(first, second);
        if (cost < bestCost) { bestCost = cost; bestFirst = first; bestSecond = second; }
        return;
      }
      chosen.push(remaining[index]); search(index + 1); chosen.pop(); search(index + 1);
    };
    search(0);
  } else {
    bestFirst = [firstCaptain]; bestSecond = [secondCaptain];
    remaining.forEach((item) => {
      const canFirst = bestFirst.length < firstSize;
      const canSecond = bestSecond.length < active.length - firstSize;
      if (!canSecond || (canFirst && balanceCost([...bestFirst, item], bestSecond) <= balanceCost(bestFirst, [...bestSecond, item]))) bestFirst.push(item);
      else bestSecond.push(item);
    });
    bestCost = balanceCost(bestFirst, bestSecond);
  }

  return {
    team1: { name: "Team 1", ids: bestFirst.map((item) => item.id), captain: captain1 },
    team2: { name: "Team 2", ids: bestSecond.map((item) => item.id), captain: captain2 },
    seed,
    cost: bestCost,
  };
}

export const cricketOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;
