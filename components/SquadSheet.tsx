"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SPECIALITIES = ["Passing", "Scoring", "Shooting", "Dribbling", "Teamwork", "Goalkeeping", "Defending", "Pace", "Strength", "Heading"] as const;
const SKILL_BADGES: Record<string, string> = {
  Passing: "/badges/skills/passing.png",
  Scoring: "/badges/skills/scoring.png",
  Shooting: "/badges/skills/shooting.png",
  Dribbling: "/badges/skills/dribbling.png",
  Teamwork: "/badges/skills/teamwork.png",
  Goalkeeping: "/badges/skills/goalkeeping.png",
  Defending: "/badges/skills/defending.png",
  Pace: "/badges/skills/pace.png",
  Strength: "/badges/skills/strength.png",
  Heading: "/badges/skills/heading.png",
};
const MAX_PLAYER_SKILLS = 4;
const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"] as const;
const POSITION_SKILL_PRIORITY: Record<string, string[]> = {
  GK: ["Goalkeeping", "Teamwork", "Strength", "Passing"],
  CB: ["Defending", "Heading", "Strength", "Teamwork", "Pace"],
  LB: ["Pace", "Defending", "Passing", "Dribbling", "Teamwork"],
  RB: ["Pace", "Defending", "Passing", "Dribbling", "Teamwork"],
  CDM: ["Defending", "Passing", "Strength", "Teamwork"],
  CM: ["Passing", "Teamwork", "Dribbling", "Strength"],
  CAM: ["Passing", "Dribbling", "Shooting", "Scoring", "Teamwork"],
  LM: ["Pace", "Dribbling", "Passing", "Shooting", "Teamwork"],
  RM: ["Pace", "Dribbling", "Passing", "Shooting", "Teamwork"],
  LW: ["Pace", "Dribbling", "Scoring", "Shooting", "Passing"],
  RW: ["Pace", "Dribbling", "Scoring", "Shooting", "Passing"],
  CF: ["Scoring", "Shooting", "Heading", "Dribbling", "Passing"],
  ST: ["Scoring", "Shooting", "Heading", "Pace", "Strength"],
};
const POSITION_STAT_OFFSETS: Record<string, Record<string, number>> = {
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
const CARD_STYLES = [
  { id: "classic", name: "Classic Gold", src: "/card-templates/classic-gold.png", cleanSrc: "/card-templates/classic-gold-clean.png" },
  { id: "royal", name: "Royal Gold", src: "/card-templates/royal-gold.png", cleanSrc: "/card-templates/royal-gold-clean.png" },
  { id: "electric", name: "Electric Blue", src: "/card-templates/electric-blue.png", cleanSrc: "/card-templates/electric-blue-clean.png" },
  { id: "crimson", name: "Crimson", src: "/card-templates/crimson-obsidian.png", cleanSrc: "/card-templates/crimson-obsidian-clean.png" },
  { id: "eclipse", name: "Amethyst Eclipse", src: "/card-templates/eclipse-amethyst.png", cleanSrc: "/card-templates/eclipse-amethyst-clean.png" },
  { id: "inferno", name: "Crimson Inferno", src: "/card-templates/inferno-crimson.png", cleanSrc: "/card-templates/inferno-crimson-clean.png" },
  { id: "aurora", name: "Emerald Aurora", src: "/card-templates/aurora-emerald.png", cleanSrc: "/card-templates/aurora-emerald-clean.png" },
  { id: "prism", name: "Holographic Prism", src: "/card-templates/prism-holographic.png", cleanSrc: "/card-templates/prism-holographic-clean.png" },
] as const;
const SEED = ["Abdul Rafay", "Faiq Ali Khan", "Hamza Yildirim", "Hassan", "Ali", "Atif Rajpoot", "Saad Naseer", "Tariq Azeez", "Zian", "Wahid Bux", "Zubair", "Hasnain", "Waris", "Muhammad Saad"];

type MainTab = "match" | "team" | "players";
type MatchTab = "timeline" | "lineups" | "stats" | "history" | "edit";
type HistoryDetailTab = "timeline" | "lineups" | "stats";
type CardStyleId = typeof CARD_STYLES[number]["id"];
type Player = { id: string; name: string; rating: number; spec: string; skills?: string[]; customOverall?: number; image?: string; cardStyle?: CardStyleId; position?: string; flag?: string; on?: boolean };
type Goal = { s: string; a: string; m: number | null; team?: 1 | 2 };
type Team = { ids: string[]; captain: string };
type LineupPositions = Record<string, string>;
type BalancedTeam = { name: string; ids: string[]; captain: string; positions: LineupPositions };
type BalancedTeams = {
  team1: BalancedTeam;
  team2: BalancedTeam;
  seed: number;
  cost: number;
};
type Match = { opp: string; us: string; them: number; ev: Goal[]; motm: string; st: "Live" | "Full-time" };
type MatchHistoryEntry = {
  id: string;
  endedAt: string;
  team1: { name: string; captain: string; players: Array<{ id: string; name: string; position: string }> };
  team2: { name: string; captain: string; players: Array<{ id: string; name: string; position: string }> };
  score1: number;
  score2: number;
  goals: Goal[];
  motm: string;
};
type AppState = {
  players: Player[];
  want: number;
  team: Team | null;
  balancedTeams: BalancedTeams | null;
  pool: Player[] | null;
  tab: MainTab;
  sub: MatchTab;
  match: Match;
  history: MatchHistoryEntry[];
  seeded: boolean;
  savedAt?: number;
};

type SyncStatus = "loading" | "saving" | "saved" | "offline";
type LegacySquad = {
  players?: Array<{ id: number; name: string; rating: number; available: boolean; team: 0 | 1 | 2; imageUrl?: string | null }>;
  team1Name?: string;
  team2Name?: string;
};

const newMatch = (previous?: Match): Match => ({
  opp: previous?.opp || "Team 2",
  us: previous?.us || "Team 1",
  them: 0,
  ev: [],
  motm: "",
  st: "Live",
});

const flagEmoji = (value?: string) => {
  const flag = value?.trim() || "PK";
  if (!/^[a-z]{2}$/i.test(flag)) return flag;
  return [...flag.toUpperCase()].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("");
};

const flagCountryCode = (value?: string) => {
  const flag = value?.trim() || "PK";
  if (/^[a-z]{2}$/i.test(flag)) return flag.toUpperCase();
  const symbols = [...flag];
  if (symbols.length !== 2) return "";
  const points = symbols.map((symbol) => symbol.codePointAt(0) || 0);
  if (points.some((point) => point < 0x1f1e6 || point > 0x1f1ff)) return "";
  return points.map((point) => String.fromCharCode(65 + point - 0x1f1e6)).join("");
};

const initialState = (): AppState => ({
  players: SEED.map((name, i) => ({ id: `s${i}`, name, rating: 0, spec: "", cardStyle: "classic" })),
  want: 0,
  team: null,
  balancedTeams: null,
  pool: null,
  tab: "match",
  sub: "timeline",
  match: newMatch(),
  history: [],
  seeded: true,
});

const legacyRatingToStars = (rating: number) => Math.max(1, Math.min(10, Math.round((rating - 42.5) / 5)));
const normalizeRating = (rating: number) => Math.max(0, Math.min(10, Math.round(rating * 2) / 2));
const normalizeCustomOverall = (overall: unknown) => {
  const value = Number(overall);
  return Number.isInteger(value) && value >= 1 && value <= 99 ? value : undefined;
};
const validSkills = (skills: unknown, legacySkill = "") => [...new Set([
  ...(Array.isArray(skills) ? skills : []),
  legacySkill,
].filter((skill): skill is string => typeof skill === "string" && SPECIALITIES.includes(skill as typeof SPECIALITIES[number])))].slice(0, MAX_PLAYER_SKILLS);
const playerSkills = (player: Player) => validSkills(player.skills, player.spec);
const toggledSkills = (skills: string[], skill: string) => skills.includes(skill) ? skills.filter((item) => item !== skill) : skills.length < MAX_PLAYER_SKILLS ? [...skills, skill] : skills;

function RatingPicker({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const previewRating = hoverRating ?? value;
  const ratingFromPointer = (number: number, button: HTMLButtonElement, clientX: number) => {
    const bounds = button.getBoundingClientRect();
    return number - (clientX - bounds.left < bounds.width / 2 ? 0.5 : 0);
  };

  return <div className="rating-picker" onPointerLeave={() => setHoverRating(null)}>
    <div className="rating-buttons" role="radiogroup" aria-label="Player rating out of 10">
      {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => {
        const fill = previewRating >= number ? 100 : previewRating === number - 0.5 ? 50 : 0;
        return <button
          type="button"
          key={number}
          className={`rating-step${fill === 100 ? " is-full" : fill === 50 ? " is-half" : ""}`}
          style={{ "--rating-fill": `${fill}%` } as React.CSSProperties}
          aria-label={`${number - 0.5} on the left half or ${number} on the right half`}
          aria-checked={value === number || value === number - 0.5}
          role="radio"
          onPointerMove={(event) => setHoverRating(ratingFromPointer(number, event.currentTarget, event.clientX))}
          onFocus={() => setHoverRating(null)}
          onClick={(event) => {
            const selected = event.detail === 0 ? number : ratingFromPointer(number, event.currentTarget, event.clientX);
            onChange(value === selected ? 0 : selected);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            onChange(number - (event.key === "ArrowLeft" ? 0.5 : 0));
          }}
        >{number}</button>;
      })}
    </div>
    <output className="rating-value" aria-live="polite">{hoverRating === null ? (value ? `${value}/10 selected` : "Not rated") : `${hoverRating}/10 preview`}</output>
  </div>;
}

function SkillPicker({ skills, onChange }: { skills: string[]; onChange: (skills: string[]) => void }) {
  return <>
    <div className="cl edit-specialities skill-picker">{SPECIALITIES.map((skill) => {
      const selected = skills.includes(skill);
      return <button type="button" key={skill} disabled={!selected && skills.length >= MAX_PLAYER_SKILLS} onClick={() => onChange(toggledSkills(skills, skill))} className={selected ? "on" : ""} aria-pressed={selected}>{skill}</button>;
    })}</div>
    <p className="skill-count">{skills.length}/{MAX_PLAYER_SKILLS} selected</p>
  </>;
}

const restoreState = (value: unknown): AppState => {
  const base = initialState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const parsed = value as Partial<AppState>;
  const hasSavedPlayers = Array.isArray(parsed.players);
  const players: Player[] = (hasSavedPlayers ? parsed.players || [] : base.players)
    .filter((item): item is Player => Boolean(item && typeof item.name === "string" && (typeof item.id === "string" || typeof item.id === "number")))
    .map((item) => {
      const legacy = item as Player & { id: string | number; available?: boolean; imageUrl?: string | null };
      const rawRating = Number(legacy.rating) || 0;
      const skills = validSkills(legacy.skills, legacy.spec);
      const customOverall = normalizeCustomOverall(legacy.customOverall);
      return {
        id: String(legacy.id),
        name: legacy.name.trim() || "Player",
        rating: customOverall ? 0 : rawRating > 10 ? legacyRatingToStars(rawRating) : normalizeRating(rawRating),
        spec: skills[0] || "",
        skills,
        customOverall,
        image: typeof legacy.image === "string" ? legacy.image : typeof legacy.imageUrl === "string" ? legacy.imageUrl : undefined,
        cardStyle: CARD_STYLES.some((style) => style.id === legacy.cardStyle) ? legacy.cardStyle : "classic",
        position: typeof legacy.position === "string" ? legacy.position : undefined,
        flag: flagEmoji(typeof legacy.flag === "string" ? legacy.flag : undefined),
        on: typeof legacy.on === "boolean" ? legacy.on : legacy.available === false ? false : undefined,
      } satisfies Player;
    });
  const playerIds = new Set(players.map((item) => item.id));
  const savedTeam = parsed.team && Array.isArray(parsed.team.ids)
    ? { ids: parsed.team.ids.filter((id) => playerIds.has(String(id))).map(String), captain: String(parsed.team.captain || "") }
    : null;
  const savedBalance = parsed.balancedTeams;
  const balancedTeams = savedBalance && Array.isArray(savedBalance.team1?.ids) && Array.isArray(savedBalance.team2?.ids)
    ? {
      team1: { name: savedBalance.team1.name || "Team 1", ids: savedBalance.team1.ids.map(String).filter((id) => playerIds.has(id)), captain: String(savedBalance.team1.captain || savedBalance.team1.ids[0] || ""), positions: savedBalance.team1.positions && typeof savedBalance.team1.positions === "object" ? savedBalance.team1.positions : {} },
      team2: { name: savedBalance.team2.name || "Team 2", ids: savedBalance.team2.ids.map(String).filter((id) => playerIds.has(id)), captain: String(savedBalance.team2.captain || savedBalance.team2.ids[0] || ""), positions: savedBalance.team2.positions && typeof savedBalance.team2.positions === "object" ? savedBalance.team2.positions : {} },
      seed: Number(savedBalance.seed) || 0,
      cost: Number(savedBalance.cost) || 0,
    }
    : null;
  const normalizedBalancedTeams = balancedTeams ? {
    ...balancedTeams,
    team1: { ...balancedTeams.team1, positions: normalizeLineupPositions(balancedTeams.team1.ids.map((id) => players.find((item) => item.id === id)).filter((item): item is Player => Boolean(item)), balancedTeams.team1.positions) },
    team2: { ...balancedTeams.team2, positions: normalizeLineupPositions(balancedTeams.team2.ids.map((id) => players.find((item) => item.id === id)).filter((item): item is Player => Boolean(item)), balancedTeams.team2.positions) },
  } : null;
  return {
    ...base,
    ...parsed,
    players,
    want: Number.isFinite(Number(parsed.want)) ? Math.max(0, Number(parsed.want)) : 0,
    team: savedTeam?.ids.length ? { ...savedTeam, captain: playerIds.has(savedTeam.captain) ? savedTeam.captain : savedTeam.ids[0] } : null,
    balancedTeams: normalizedBalancedTeams,
    pool: Array.isArray(parsed.pool) ? parsed.pool.filter((item) => item && playerIds.has(String(item.id))).map((item) => players.find((player) => player.id === String(item.id))!).filter(Boolean) : null,
    tab: parsed.tab === "team" || parsed.tab === "players" ? parsed.tab : "match",
    sub: parsed.sub === "lineups" || parsed.sub === "stats" || parsed.sub === "history" || parsed.sub === "edit" ? parsed.sub : "timeline",
    match: { ...base.match, ...(parsed.match && typeof parsed.match === "object" ? parsed.match : {}) },
    history: Array.isArray(parsed.history) ? parsed.history.slice(0, 100) : [],
    savedAt: Number(parsed.savedAt) || undefined,
  };
};

const legacySquadState = (value: unknown): AppState | null => {
  if (!value || typeof value !== "object") return null;
  const legacy = value as LegacySquad;
  if (!Array.isArray(legacy.players) || !legacy.players.length) return null;
  const players: Player[] = legacy.players.map((item) => ({
    id: `db-${item.id}`,
    name: item.name,
    rating: item.rating <= 10 ? Math.max(0, item.rating) : legacyRatingToStars(item.rating),
    spec: "",
    image: item.imageUrl || undefined,
    cardStyle: "classic",
    on: item.available === false ? false : undefined,
  }));
  const team1Ids = legacy.players.filter((item) => item.team === 1).map((item) => `db-${item.id}`);
  const team2Ids = legacy.players.filter((item) => item.team === 2).map((item) => `db-${item.id}`);
  return {
    ...initialState(),
    players,
    balancedTeams: team1Ids.length && team2Ids.length ? {
      team1: { name: legacy.team1Name || "Team 1", ids: team1Ids, captain: team1Ids[0] || "", positions: {} },
      team2: { name: legacy.team2Name || "Team 2", ids: team2Ids, captain: team2Ids[0] || "", positions: {} },
      seed: 0,
      cost: 0,
    } : null,
  };
};

const ratingLabel = (player: Player) => player.customOverall ? `${player.customOverall} OVR` : player.rating ? `${player.rating}/10` : "Not rated";
const specialityLabel = (player: Player) => playerSkills(player).join(" · ") || "No skills";
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase() || "?";
const playerRanking = (player: Player) => player.customOverall ? Math.max(0, Math.min(10, (player.customOverall - 44) / 5)) : player.rating;
const sortPlayers = (players: Player[]) => [...players].sort((a, b) => playerRanking(b) - playerRanking(a) || Number(playerSkills(b).includes("Teamwork")) - Number(playerSkills(a).includes("Teamwork")) || a.name.localeCompare(b.name));
const defaultPosition = (player: Player) => player.position || ({ Scoring: "ST", Shooting: "ST", Dribbling: "LW", Passing: "CM", Teamwork: "CDM", Goalkeeping: "GK", Defending: "CB", Pace: "RW", Strength: "CDM", Heading: "ST" }[playerSkills(player)[0]] || "CM");
const primarySkill = (player: Player) => {
  const skills = playerSkills(player);
  return POSITION_SKILL_PRIORITY[defaultPosition(player)]?.find((skill) => skills.includes(skill)) || skills[0] || "";
};
const generatedCardStats = (player: Player) => {
  if (!player.rating && !player.customOverall) return [["PAC", "–"], ["SHO", "–"], ["PAS", "–"], ["DRI", "–"], ["DEF", "–"], ["PHY", "–"]];
  const base = player.customOverall ?? 44 + player.rating * 5;
  const skills = playerSkills(player);
  const boost = (label: string) => {
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
  const offsets = POSITION_STAT_OFFSETS[defaultPosition(player)] || POSITION_STAT_OFFSETS.CM;
  const value = (label: string) => String(Math.round(Math.max(1, Math.min(99, base + offsets[label] + boost(label)))));
  return [["PAC", value("PAC")], ["SHO", value("SHO")], ["PAS", value("PAS")], ["DRI", value("DRI")], ["DEF", value("DEF")], ["PHY", value("PHY")]];
};
const calculatedOverall = (player: Player) => {
  const values = generatedCardStats(player).map(([, value]) => Number(value)).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
};
const displayedOverall = (player: Player) => player.customOverall ?? calculatedOverall(player);

const FORMATION_SLOTS: Record<number, string[]> = {
  1: ["GK"],
  2: ["GK", "ST"],
  3: ["GK", "CB", "ST"],
  4: ["GK", "CB", "CM", "ST"],
  5: ["GK", "CB", "CM", "LW", "ST"],
  6: ["GK", "LB", "CB", "RB", "CM", "ST"],
  7: ["GK", "LB", "CB", "RB", "CM", "LW", "ST"],
  8: ["GK", "LB", "CB", "RB", "CM", "LW", "RW", "ST"],
  9: ["GK", "LB", "CB", "CB", "RB", "CM", "LW", "RW", "ST"],
  10: ["GK", "LB", "CB", "CB", "RB", "CM", "CM", "LW", "RW", "ST"],
  11: ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"],
};

const formationSlots = (count: number) => {
  if (count <= 11) return [...(FORMATION_SLOTS[Math.max(1, count)] || [])];
  const extras = ["CM", "CB", "ST", "LW", "RW"];
  return [...FORMATION_SLOTS[11], ...Array.from({ length: count - 11 }, (_, index) => extras[index % extras.length])];
};
const FULL_FORMATION_SLOTS = FORMATION_SLOTS[11];

const positionFamily = (position: string) => {
  if (position === "GK") return "goalkeeper";
  if (["CB", "LB", "RB"].includes(position)) return "defence";
  if (["CDM", "CM", "CAM", "LM", "RM"].includes(position)) return "midfield";
  return "attack";
};

const POSITION_STAT_WEIGHTS: Record<string, Record<string, number>> = {
  GK: { PAC: .10, SHO: .05, PAS: .10, DRI: .05, DEF: .45, PHY: .25 },
  CB: { PAC: .12, SHO: .03, PAS: .10, DRI: .05, DEF: .45, PHY: .25 },
  LB: { PAC: .22, SHO: .05, PAS: .16, DRI: .14, DEF: .28, PHY: .15 },
  RB: { PAC: .22, SHO: .05, PAS: .16, DRI: .14, DEF: .28, PHY: .15 },
  CDM: { PAC: .10, SHO: .06, PAS: .25, DRI: .13, DEF: .29, PHY: .17 },
  CM: { PAC: .10, SHO: .10, PAS: .30, DRI: .20, DEF: .15, PHY: .15 },
  CAM: { PAC: .12, SHO: .20, PAS: .28, DRI: .27, DEF: .05, PHY: .08 },
  LM: { PAC: .22, SHO: .15, PAS: .23, DRI: .25, DEF: .05, PHY: .10 },
  RM: { PAC: .22, SHO: .15, PAS: .23, DRI: .25, DEF: .05, PHY: .10 },
  LW: { PAC: .27, SHO: .22, PAS: .14, DRI: .27, DEF: .03, PHY: .07 },
  RW: { PAC: .27, SHO: .22, PAS: .14, DRI: .27, DEF: .03, PHY: .07 },
  CF: { PAC: .15, SHO: .30, PAS: .18, DRI: .22, DEF: .05, PHY: .10 },
  ST: { PAC: .22, SHO: .38, PAS: .07, DRI: .15, DEF: .03, PHY: .15 },
};

const weightedPositionRating = (player: Player, position: string) => {
  const stats = Object.fromEntries(generatedCardStats(player).map(([label, value]) => [label, Number(value) || 0]));
  return Object.entries(POSITION_STAT_WEIGHTS[position] || POSITION_STAT_WEIGHTS.CM).reduce((total, [stat, weight]) => total + (stats[stat] || 0) * weight, 0);
};

const POSITION_NEIGHBORS: Record<string, string[]> = {
  CB: ["LB", "RB", "CDM"],
  LB: ["CB", "LM", "LW"],
  RB: ["CB", "RM", "RW"],
  CDM: ["CB", "CM"],
  CM: ["CDM", "CAM", "LM", "RM"],
  CAM: ["CM", "LM", "RM", "LW", "RW", "CF"],
  LM: ["LB", "CM", "CAM", "LW"],
  RM: ["RB", "CM", "CAM", "RW"],
  LW: ["LB", "LM", "CAM", "RW", "CF", "ST"],
  RW: ["RB", "RM", "CAM", "LW", "CF", "ST"],
  CF: ["CAM", "LW", "RW", "ST"],
  ST: ["LW", "RW", "CF"],
};

const positionChangePenalty = (mainPosition: string, assignedPosition: string) => {
  if (mainPosition === assignedPosition) return 0;
  if (mainPosition === "GK" || assignedPosition === "GK") return 30;
  const mirrored = [["LB", "RB"], ["LM", "RM"], ["LW", "RW"]].some((pair) => pair.includes(mainPosition) && pair.includes(assignedPosition));
  if (mirrored) return 1;
  if (POSITION_NEIGHBORS[mainPosition]?.includes(assignedPosition) || POSITION_NEIGHBORS[assignedPosition]?.includes(mainPosition)) return 2;
  return positionFamily(mainPosition) === positionFamily(assignedPosition) ? 4 : 7;
};

const positionOverall = (player: Player, assignedPosition?: string) => {
  const originalOverall = displayedOverall(player);
  if (originalOverall === null) return null;
  const mainPosition = defaultPosition(player);
  const position = assignedPosition || mainPosition;
  if (position === mainPosition) return originalOverall;
  const attributeSuitability = weightedPositionRating(player, position) - weightedPositionRating(player, mainPosition);
  return Math.max(1, Math.min(99, Math.round(originalOverall + attributeSuitability - positionChangePenalty(mainPosition, position))));
};

const positionFit = (item: Player, slot: string) => {
  const preferred = defaultPosition(item);
  const family = positionFamily(slot);
  const preferredFamily = positionFamily(preferred);
  const stats = Object.fromEntries(generatedCardStats(item).map(([label, value]) => [label, Number(value) || 50]));
  const skills = playerSkills(item);
  let score = preferred === slot ? 120 : preferredFamily === family ? 62 : 12;
  if (slot === "GK") score += preferred === "GK" ? 100 : (stats.DEF + stats.PHY) / 12;
  else if (family === "defence") score += (stats.DEF * 1.4 + stats.PHY + stats.PAC * .35) / 10;
  else if (family === "midfield") score += (stats.PAS * 1.25 + stats.DRI + stats.PHY * .3) / 10;
  else score += (stats.SHO * 1.35 + stats.PAC + stats.DRI * .65) / 10;
  if (skills.includes("Passing") && family === "midfield") score += 20;
  if ((skills.includes("Scoring") || skills.includes("Shooting")) && family === "attack") score += 20;
  if (skills.includes("Dribbling") && ["LW", "RW", "CAM"].includes(slot)) score += 20;
  if (skills.includes("Teamwork") && ["CDM", "CM", "CB"].includes(slot)) score += 14;
  if (skills.includes("Goalkeeping") && slot === "GK") score += 30;
  if (skills.includes("Defending") && family === "defence") score += 20;
  if (skills.includes("Pace") && ["LW", "RW", "LM", "RM", "LB", "RB", "ST"].includes(slot)) score += 18;
  if (skills.includes("Strength") && ["CB", "CDM", "ST"].includes(slot)) score += 18;
  if (skills.includes("Heading") && ["CB", "CF", "ST"].includes(slot)) score += 18;
  return score;
};

const optimalLineupPositions = (roster: Player[], slots: string[]): LineupPositions => {
  const result: LineupPositions = {};
  const count = roster.length;
  if (!count || slots.length !== count) return result;

  // OVR is the primary objective. Position fit only resolves lineups with the same total OVR.
  const score = roster.map((item) => slots.map((slot) => (positionOverall(item, slot) || 0) * 1_000_000 + positionFit(item, slot)));
  const maximum = Math.max(...score.flat());
  const playerPotential = Array.from({ length: count + 1 }, () => 0);
  const slotPotential = Array.from({ length: count + 1 }, () => 0);
  const matchedPlayer = Array.from({ length: count + 1 }, () => 0);
  const previousSlot = Array.from({ length: count + 1 }, () => 0);

  // Hungarian assignment finds the exact maximum-OVR player-to-position arrangement.
  for (let playerIndex = 1; playerIndex <= count; playerIndex++) {
    matchedPlayer[0] = playerIndex;
    let currentSlot = 0;
    const minimum = Array.from({ length: count + 1 }, () => Number.POSITIVE_INFINITY);
    const used = Array.from({ length: count + 1 }, () => false);
    do {
      used[currentSlot] = true;
      const currentPlayer = matchedPlayer[currentSlot];
      let change = Number.POSITIVE_INFINITY;
      let nextSlot = 0;
      for (let slotIndex = 1; slotIndex <= count; slotIndex++) {
        if (used[slotIndex]) continue;
        const cost = maximum - score[currentPlayer - 1][slotIndex - 1] - playerPotential[currentPlayer] - slotPotential[slotIndex];
        if (cost < minimum[slotIndex]) {
          minimum[slotIndex] = cost;
          previousSlot[slotIndex] = currentSlot;
        }
        if (minimum[slotIndex] < change) {
          change = minimum[slotIndex];
          nextSlot = slotIndex;
        }
      }
      for (let slotIndex = 0; slotIndex <= count; slotIndex++) {
        if (used[slotIndex]) {
          playerPotential[matchedPlayer[slotIndex]] += change;
          slotPotential[slotIndex] -= change;
        } else minimum[slotIndex] -= change;
      }
      currentSlot = nextSlot;
    } while (matchedPlayer[currentSlot] !== 0);

    do {
      const nextSlot = previousSlot[currentSlot];
      matchedPlayer[currentSlot] = matchedPlayer[nextSlot];
      currentSlot = nextSlot;
    } while (currentSlot !== 0);
  }

  for (let slotIndex = 1; slotIndex <= count; slotIndex++) {
    const item = roster[matchedPlayer[slotIndex] - 1];
    if (item) result[item.id] = slots[slotIndex - 1];
  }
  return result;
};

const assignLineupPositions = (roster: Player[]): LineupPositions => (
  optimalLineupPositions(roster, formationSlots(roster.length))
);

const normalizeLineupPositions = (roster: Player[], saved: LineupPositions): LineupPositions => {
  if (!roster.length) return {};
  const requiredSlots = formationSlots(roster.length);
  const allowedSlots = formationSlots(Math.max(11, roster.length));
  const capacity = allowedSlots.reduce<Record<string, number>>((result, position) => { result[position] = (result[position] || 0) + 1; return result; }, {});
  const used: Record<string, number> = {};
  const result: LineupPositions = {};

  for (const item of roster) {
    const position = saved?.[item.id];
    if (!position || !POSITIONS.includes(position as typeof POSITIONS[number]) || (used[position] || 0) >= (capacity[position] || 0)) continue;
    result[item.id] = position;
    used[position] = (used[position] || 0) + 1;
  }

  const reserved = { ...used };
  const openSlots = requiredSlots.filter((position) => {
    if ((reserved[position] || 0) >= (capacity[position] || 0)) return false;
    reserved[position] = (reserved[position] || 0) + 1;
    return true;
  });
  const unassigned = roster.filter((item) => !result[item.id]);
  return { ...result, ...optimalLineupPositions(unassigned, openSlots.slice(0, unassigned.length)) };
};

const reconcileBalancedTeams = (balancedTeams: BalancedTeams | null, players: Player[]): BalancedTeams | null => {
  if (!balancedTeams) return null;
  const available = new Map(players.filter((item) => item.on !== false).map((item) => [item.id, item]));
  const repairTeam = (team: BalancedTeam): BalancedTeam => {
    const ids = team.ids.filter((id) => available.has(id));
    const roster = ids.map((id) => available.get(id)).filter((item): item is Player => Boolean(item));
    const captain = ids.includes(team.captain) ? team.captain : sortPlayers(roster)[0]?.id || "";
    return { ...team, ids, captain, positions: normalizeLineupPositions(roster, team.positions) };
  };
  return { ...balancedTeams, cost: -1, team1: repairTeam(balancedTeams.team1), team2: repairTeam(balancedTeams.team2) };
};

const reconcilePickedTeam = (team: Team | null, players: Player[]): Team | null => {
  if (!team) return null;
  const available = new Map(players.filter((item) => item.on !== false).map((item) => [item.id, item]));
  const ids = team.ids.filter((id) => available.has(id));
  if (!ids.length) return null;
  const roster = ids.map((id) => available.get(id)).filter((item): item is Player => Boolean(item));
  return { ids, captain: ids.includes(team.captain) ? team.captain : sortPlayers(roster)[0]?.id || ids[0] };
};

const formationLabel = (positions: LineupPositions) => {
  const counts = Object.values(positions).reduce<Record<string, number>>((result, position) => { result[position] = (result[position] || 0) + 1; return result; }, {});
  return POSITIONS.filter((position) => counts[position]).map((position) => `${counts[position] && counts[position] > 1 ? `${counts[position]}×` : ""}${position}`).join(" · ");
};

type BalanceVector = number[];
type BalanceItem = { player: Player; values: BalanceVector };
type BalanceCandidate = { first: BalanceItem[]; second: BalanceItem[]; cost: number; signature: string };

const BALANCE_WEIGHTS: BalanceVector = [2.4, 1, 1, 1, 1, 1, 1, 14, 6, 6, 6, ...SPECIALITIES.map(() => .7)];
const BALANCE_SCALES: BalanceVector = [1, 5, 5, 5, 5, 5, 5, .15, .22, .22, .22, ...SPECIALITIES.map(() => .25)];
const FALLBACK_BALANCE_VECTOR: BalanceVector = [5.5, 75, 73, 74, 76, 66, 71, 0, 0, 0, 0, ...SPECIALITIES.map(() => 0)];
const naturalRoleVector = (player: Player): [number, number, number, number] => {
  const family = positionFamily(defaultPosition(player));
  return [Number(family === "goalkeeper"), Number(family === "defence"), Number(family === "midfield"), Number(family === "attack")];
};
const skillBalanceVector = (player: Player) => {
  const skills = playerSkills(player);
  return SPECIALITIES.map((skill) => Number(skills.includes(skill)));
};

const numericBalanceVector = (player: Player): BalanceVector | null => {
  if (!player.rating && !player.customOverall) return null;
  const values = generatedCardStats(player).map(([, value]) => Number(value));
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) return null;
  const ranking = player.customOverall ? Math.max(0, Math.min(10, (player.customOverall - 44) / 5)) : player.rating;
  return [ranking, values[0], values[1], values[2], values[3], values[4], values[5], ...naturalRoleVector(player), ...skillBalanceVector(player)];
};

const createBalanceItems = (players: Player[]) => {
  const known = players.map(numericBalanceVector).filter((values): values is BalanceVector => values !== null);
  const fallback = [...FALLBACK_BALANCE_VECTOR] as BalanceVector;
  if (known.length) {
    for (let feature = 0; feature < fallback.length; feature++) {
      fallback[feature] = known.reduce((sum, values) => sum + values[feature], 0) / known.length;
    }
  }
  return players.map((player) => {
    const values = numericBalanceVector(player);
    if (values) return { player, values };
    const fallbackValues = [...fallback] as BalanceVector;
    fallbackValues.splice(7, 4, ...naturalRoleVector(player));
    fallbackValues.splice(11, SPECIALITIES.length, ...skillBalanceVector(player));
    return { player, values: fallbackValues };
  });
};

const balanceRng = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
};

const shuffled = <T,>(items: T[], random: () => number) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

const vectorTotal = (items: BalanceItem[]) => {
  const total: BalanceVector = Array.from({ length: BALANCE_WEIGHTS.length }, () => 0);
  for (const item of items) {
    for (let feature = 0; feature < total.length; feature++) total[feature] += item.values[feature];
  }
  return total;
};

const balanceCost = (first: BalanceVector, firstCount: number, second: BalanceVector, secondCount: number) => {
  let weightedDifference = 0;
  let totalWeight = 0;
  let largestDifference = 0;
  for (let feature = 0; feature < first.length; feature++) {
    const difference = Math.abs(first[feature] / firstCount - second[feature] / secondCount) / BALANCE_SCALES[feature];
    weightedDifference += BALANCE_WEIGHTS[feature] * difference * difference;
    totalWeight += BALANCE_WEIGHTS[feature];
    largestDifference = Math.max(largestDifference, difference);
  }
  return weightedDifference / totalWeight + largestDifference * largestDifference * .15;
};

const formationQuality = (items: BalanceItem[]) => {
  const roster = items.map(({ player }) => player);
  const positions = assignLineupPositions(roster);
  let overall = 0;
  let naturalOverall = 0;
  let fit = 0;
  for (const item of items) {
    const assigned = positions[item.player.id] || defaultPosition(item.player);
    const original = displayedOverall(item.player) ?? 44 + item.values[0] * 5;
    const assignedOverall = positionOverall(item.player, assigned) ?? original;
    overall += assignedOverall;
    naturalOverall += original;
    fit += positionFit(item.player, assigned);
  }
  const count = Math.max(1, items.length);
  return { overall: overall / count, loss: Math.max(0, (naturalOverall - overall) / count), fit: fit / count };
};

const formationBalancePenalty = (first: BalanceItem[], second: BalanceItem[]) => {
  const a = formationQuality(first);
  const b = formationQuality(second);
  const strengthGap = Math.abs(a.overall - b.overall) / 4;
  const fitGap = Math.abs(a.fit - b.fit) / 24;
  const lossGap = Math.abs(a.loss - b.loss) / 3;
  const averageLoss = (a.loss + b.loss) / 12;
  const weakFormation = Math.max(0, 95 - (a.fit + b.fit) / 2) / 30;
  return strengthGap * strengthGap * .28
    + fitGap * fitGap * .12
    + lossGap * lossGap * .08
    + averageLoss * averageLoss * .06
    + weakFormation * weakFormation * .04;
};

const completeBalanceCost = (first: BalanceItem[], second: BalanceItem[], firstTotal = vectorTotal(first), secondTotal = vectorTotal(second)) => (
  balanceCost(firstTotal, first.length, secondTotal, second.length) + formationBalancePenalty(first, second)
);

const balanceSignature = (first: BalanceItem[], second: BalanceItem[]) => {
  const firstIds = first.map(({ player }) => player.id).sort().join("|");
  const secondIds = second.map(({ player }) => player.id).sort().join("|");
  return firstIds < secondIds ? `${firstIds}::${secondIds}` : `${secondIds}::${firstIds}`;
};

const improveBalance = (firstSeed: BalanceItem[], secondSeed: BalanceItem[], lockedIds = new Set<string>()): BalanceCandidate => {
  let first = [...firstSeed];
  let second = [...secondSeed];
  const firstTotal = vectorTotal(first);
  const secondTotal = vectorTotal(second);
  let cost = completeBalanceCost(first, second, firstTotal, secondTotal);
  const maxPasses = Math.min(48, first.length * second.length);

  for (let pass = 0; pass < maxPasses; pass++) {
    let bestFirst = -1;
    let bestSecond = -1;
    let bestCost = cost;
    for (let firstIndex = 0; firstIndex < first.length; firstIndex++) {
      if (lockedIds.has(first[firstIndex].player.id)) continue;
      for (let secondIndex = 0; secondIndex < second.length; secondIndex++) {
        if (lockedIds.has(second[secondIndex].player.id)) continue;
        const nextFirst = [...firstTotal] as BalanceVector;
        const nextSecond = [...secondTotal] as BalanceVector;
        for (let feature = 0; feature < nextFirst.length; feature++) {
          const change = second[secondIndex].values[feature] - first[firstIndex].values[feature];
          nextFirst[feature] += change;
          nextSecond[feature] -= change;
        }
        const nextFirstItems = [...first];
        const nextSecondItems = [...second];
        nextFirstItems[firstIndex] = second[secondIndex];
        nextSecondItems[secondIndex] = first[firstIndex];
        const nextCost = completeBalanceCost(nextFirstItems, nextSecondItems, nextFirst, nextSecond);
        if (nextCost < bestCost - 1e-10) {
          bestCost = nextCost;
          bestFirst = firstIndex;
          bestSecond = secondIndex;
        }
      }
    }
    if (bestFirst < 0) break;
    const oldFirst = first[bestFirst];
    const oldSecond = second[bestSecond];
    first[bestFirst] = oldSecond;
    second[bestSecond] = oldFirst;
    for (let feature = 0; feature < firstTotal.length; feature++) {
      const change = oldSecond.values[feature] - oldFirst.values[feature];
      firstTotal[feature] += change;
      secondTotal[feature] -= change;
    }
    cost = bestCost;
  }

  if (!lockedIds.size && first.length === second.length) {
    const firstKey = first.map(({ player }) => player.id).sort().join("|");
    const secondKey = second.map(({ player }) => player.id).sort().join("|");
    if (secondKey < firstKey) [first, second] = [second, first];
  }
  return { first, second, cost, signature: balanceSignature(first, second) };
};

const rosterBalanceSeed = (players: Player[]) => {
  const fingerprint = [...players]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}:${item.rating}:${item.customOverall || "auto"}:${playerSkills(item).join(",")}:${defaultPosition(item)}`)
    .join("|");
  let hash = 2166136261;
  for (const character of fingerprint) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
};

const nextBalanceSeed = (seed: number) => {
  let value = (seed ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  value = Math.imul(value ^ value >>> 15, 0x735a2d97);
  return (value ^ value >>> 15) >>> 0;
};

const makeBalancedTeams = (players: Player[], seed: number, previousSignature = "", captain1 = "", captain2 = "") => {
  if (players.length < 2) throw new Error("At least two active players are required.");
  const items = createBalanceItems(players);
  const firstCaptain = items.find((item) => item.player.id === captain1);
  const secondCaptain = items.find((item) => item.player.id === captain2);
  if (!firstCaptain || !secondCaptain || captain1 === captain2) throw new Error("Choose two different active captains.");
  const remaining = items.filter((item) => item.player.id !== captain1 && item.player.id !== captain2);
  const lockedIds = new Set([captain1, captain2]);
  const firstSize = Math.ceil(items.length / 2);
  const random = balanceRng(seed);
  const restarts = Math.max(32, Math.min(72, items.length * 3));
  const candidates = new Map<string, BalanceCandidate>();

  for (let restart = 0; restart < restarts; restart++) {
    let first: BalanceItem[];
    let second: BalanceItem[];
    if (restart === 0) {
      const strength = (item: BalanceItem) => item.values.slice(0, 7).reduce((sum, value, feature) => sum + value / BALANCE_SCALES[feature] * BALANCE_WEIGHTS[feature], 0);
      const ordered = [...remaining].sort((a, b) => strength(b) - strength(a) || a.player.name.localeCompare(b.player.name));
      first = [firstCaptain];
      second = [secondCaptain];
      ordered.forEach((item, index) => {
        const preferFirst = index % 4 === 0 || index % 4 === 3;
        if ((preferFirst && first.length < firstSize) || second.length >= items.length - firstSize) first.push(item);
        else second.push(item);
      });
    } else {
      const ordered = shuffled(remaining, random);
      first = [firstCaptain, ...ordered.slice(0, firstSize - 1)];
      second = [secondCaptain, ...ordered.slice(firstSize - 1)];
    }
    const candidate = improveBalance(first, second, lockedIds);
    const saved = candidates.get(candidate.signature);
    if (!saved || candidate.cost < saved.cost) candidates.set(candidate.signature, candidate);
  }

  const ranked = [...candidates.values()].sort((a, b) => a.cost - b.cost || a.signature.localeCompare(b.signature));
  const best = ranked[0];
  const excellent = ranked.filter((candidate) => candidate.cost <= best.cost + Math.max(.035, best.cost * .25));
  const alternatives = excellent.filter((candidate) => candidate.signature !== previousSignature);
  const pool = alternatives.length ? alternatives : excellent;
  const chosen = previousSignature ? pool[Math.floor(random() * pool.length)] : best;
  return {
    first: chosen.first.map(({ player }) => player.id),
    second: chosen.second.map(({ player }) => player.id),
    cost: chosen.cost,
    signature: chosen.signature,
  };
};

async function preparePlayerImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Please choose an image smaller than 8 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The image could not be opened."));
    element.src = source;
  });
  const limit = 700;
  const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("The image could not be prepared.")), "image/webp", .86));
  const form = new FormData();
  const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "player";
  form.append("file", new File([blob], `${safeName}.webp`, { type: "image/webp" }));
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const result = await response.json().catch(() => null) as { imageUrl?: string; error?: string } | null;
  if (!response.ok || !result?.imageUrl) throw new Error(result?.error || "The image could not be uploaded.");
  return result.imageUrl;
}

export default function SquadSheet() {
  const [state, setState] = useState<AppState>(initialState);
  const [draft, setDraft] = useState<{ rating: number; customOverall: string; skills: string[]; name: string; image: string; cardStyle: CardStyleId; position: string; flag: string }>({ rating: 0, customOverall: "", skills: [], name: "", image: "", cardStyle: "classic", position: "CM", flag: "🇵🇰" });
  const [pickCaptain, setPickCaptain] = useState("");
  const [pickCaptainTwo, setPickCaptainTwo] = useState("");
  const [showGoal, setShowGoal] = useState(false);
  const [goalTeam, setGoalTeam] = useState<1 | 2>(1);
  const [openHistoryId, setOpenHistoryId] = useState("");
  const [historyDetailTab, setHistoryDetailTab] = useState<HistoryDetailTab>("timeline");
  const [openRosterCardId, setOpenRosterCardId] = useState("");
  const [formationTeam, setFormationTeam] = useState<1 | 2>(1);
  const [formationPlayerId, setFormationPlayerId] = useState("");
  const [draggedFormationId, setDraggedFormationId] = useState("");
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [accessChecked, setAccessChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const hydrated = useRef(false);
  const saveSequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ authenticated?: boolean }> : { authenticated: false })
      .then((result) => { if (!cancelled) setUnlocked(Boolean(result.authenticated)); })
      .catch(() => { if (!cancelled) setUnlocked(false); })
      .finally(() => { if (!cancelled) setAccessChecked(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!accessChecked) return;
    let cancelled = false;
    setSyncStatus("loading");
    const load = async () => {
      let localValue: unknown = null;
      try {
        const saved = localStorage.getItem("sqs1");
        if (saved) localValue = JSON.parse(saved);
      } catch { /* A damaged local save should not prevent Supabase from loading. */ }

      let remoteValue: unknown = null;
      let legacyValue: unknown = null;
      let supabaseAvailable = false;
      try {
        const [stateResponse, legacyResponse] = await Promise.all([
          fetch("/api/state", { cache: "no-store" }),
          fetch("/api/squad", { cache: "no-store" }),
        ]);
        if (stateResponse.ok) {
          const payload = await stateResponse.json() as { state?: unknown };
          remoteValue = payload.state ?? null;
          supabaseAvailable = true;
        }
        if (legacyResponse.ok) legacyValue = await legacyResponse.json();
      } catch { /* Local state remains available when the network is offline. */ }

      const remoteTime = remoteValue && typeof remoteValue === "object" ? Number((remoteValue as { savedAt?: number }).savedAt) || 0 : 0;
      const localTime = localValue && typeof localValue === "object" ? Number((localValue as { savedAt?: number }).savedAt) || 0 : 0;
      const savedValue = remoteValue && (!unlocked || !localValue || remoteTime >= localTime) ? remoteValue : localValue;
      const restored = savedValue ? restoreState(savedValue) : legacySquadState(legacyValue) || initialState();
      if (cancelled) return;
      hydrated.current = true;
      setState(restored);
      setSyncStatus(supabaseAvailable ? "saved" : "offline");
    };
    void load();
    return () => { cancelled = true; };
  }, [accessChecked]);

  useEffect(() => {
    if (!unlocked || !hydrated.current) return;
    const sequence = ++saveSequence.current;
    const payload: AppState = { ...state, savedAt: Date.now() };
    try { localStorage.setItem("sqs1", JSON.stringify(payload)); } catch { /* Storage can be unavailable in private browsing. */ }
    setSyncStatus("saving");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Supabase save failed.");
        if (sequence === saveSequence.current) setSyncStatus("saved");
      } catch {
        if (sequence === saveSequence.current) setSyncStatus("offline");
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [state, unlocked]);

  useEffect(() => {
    if (!accessChecked || unlocked) return;
    const refreshPublicView = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { state?: unknown };
        if (!payload.state) return;
        const refreshed = restoreState(payload.state);
        setState((current) => ({ ...refreshed, tab: current.tab, sub: current.sub }));
        setSyncStatus("saved");
      } catch { /* Keep showing the last loaded public state while temporarily offline. */ }
    };
    const interval = window.setInterval(() => void refreshPublicView(), 15000);
    return () => window.clearInterval(interval);
  }, [accessChecked, unlocked]);

  const active = useMemo(() => state.players.filter((player) => player.on !== false), [state.players]);
  const teamSize = state.want ? Math.min(state.want, active.length) : active.length;
  const player = (id: string) => state.players.find((item) => item.id === id);
  const setTab = (tab: MainTab) => setState((current) => ({ ...current, tab }));
  const setSub = (sub: MatchTab) => setState((current) => ({ ...current, sub }));
  const resetTeam = () => {
    setState((current) => ({ ...current, team: null, pool: null, match: newMatch(current.match) }));
    setPickCaptain("");
    setShowGoal(false);
  };
  const readSize = (value: number) => setState((current) => {
    const available = current.players.filter((item) => item.on !== false).length;
    return { ...current, want: value >= 1 && value < available ? value : 0 };
  });
  const stats = (id: string) => ({
    g: state.match.ev.filter((goal) => goal.s === id).length,
    a: state.match.ev.filter((goal) => goal.a === id).length,
  });
  const automaticMotm = () => {
    if (!state.team || !state.match.ev.length) return "";
    const ids = [...new Set([...state.team.ids, ...(state.balancedTeams?.team2.ids || [])])];
    return ids.sort((a, b) => {
      const aa = stats(a); const bb = stats(b);
      return (bb.g * 3 + bb.a * 2 + (player(b) ? playerRanking(player(b)!) : 0) / 10) - (aa.g * 3 + aa.a * 2 + (player(a) ? playerRanking(player(a)!) : 0) / 10);
    })[0];
  };

  function PlayerCard({ item, children, compact = false, positionOverride }: { item: Player; children?: React.ReactNode; compact?: boolean; positionOverride?: string }) {
    const design = CARD_STYLES.find((style) => style.id === item.cardStyle) || CARD_STYLES[0];
    const flagCode = flagCountryCode(item.flag);
    const flagSrc = flagCode === "PK" ? "/flags/pk.svg" : flagCode ? `https://flagcdn.com/w40/${flagCode.toLowerCase()}.png` : "";
    const skills = playerSkills(item);
    const featuredSkill = primarySkill(item);
    const badgeSrc = SKILL_BADGES[featuredSkill] || "/badges/squad-sheet-fc.png";
    const secondarySkills = skills.filter((skill) => skill !== featuredSkill);
    const cardStats = generatedCardStats(item);
    const overall = positionOverall(item, positionOverride) ?? "–";
    return <article className={`player-card${item.on === false ? " is-inactive" : ""}${compact ? " is-compact" : ""}`}>
      <div className={`player-card__visual card-theme-${design.id}`}>
        <img className="player-card__frame" src={item.image ? design.cleanSrc : design.src} alt="" aria-hidden="true" />
        <div className="player-card__strip"><strong>{overall}</strong><span>{defaultPosition(item)}</span><span className="player-card__flag">{flagSrc ? <img src={flagSrc} alt={`${flagCode} flag`} /> : flagEmoji(item.flag)}</span><img src={badgeSrc} alt={featuredSkill ? `${featuredSkill} skill badge` : "Squad Sheet FC badge"} /></div>
        {secondarySkills.length > 0 && <div className="player-card__skill-stack" aria-label={`Other skills: ${secondarySkills.join(", ")}`}>{secondarySkills.map((skill) => <img key={skill} src={SKILL_BADGES[skill]} alt={`${skill} skill`} title={skill} />)}</div>}
        {positionOverride && <span className="player-card__lineup-position" title={`Assigned team position: ${positionOverride}`}>{positionOverride}</span>}
        <div className="player-card__photo">
          {item.image && <img src={item.image} alt={`${item.name} portrait`} />}
        </div>
        <div className="player-card__identity"><h3 className={item.name.length > 18 ? "is-long" : item.name.length > 13 ? "is-medium" : ""} title={item.name}>{item.name}</h3><p>{skills.join(" · ") || "Footballer"}</p></div>
        <div className="player-card__stats">{cardStats.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      </div>
      <div className="player-card__meta"><span>{item.customOverall ? `${item.customOverall} custom OVR` : item.rating ? `${item.rating}/10 rating` : "Not rated"}</span><span>{item.on === false ? "Inactive" : "Active"}</span></div>
      {children && <div className="player-card__actions">{children}</div>}
    </article>;
  }

  function RosterRow({ item, captain = false, lineupPosition, children, rowKey }: { item: Player; captain?: boolean; lineupPosition?: string; children?: React.ReactNode; rowKey?: React.Key }) {
    const open = openRosterCardId === item.id;
    const currentOverall = positionOverall(item, lineupPosition);
    return <div className={`roster-entry${open ? " is-open" : ""}`} key={rowKey}>
      <div className="roster-row">
        <button className="roster-player-button" onClick={() => setOpenRosterCardId(open ? "" : item.id)} aria-expanded={open}>
          <span className="roster-avatar">{item.image ? <img src={item.image} alt="" /> : initials(item.name)}</span>
          <span className="roster-copy"><strong>{item.name}{captain && <span className="cp"> (C)</span>}</strong><small>{lineupPosition || defaultPosition(item)} · {currentOverall ?? "–"} OVR · {specialityLabel(item)}</small></span>
          <span className="roster-chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
        </button>
        {children && <div className="roster-actions">{children}</div>}
      </div>
      {open && <div className="roster-card-preview">{PlayerCard({ item, compact: true, positionOverride: lineupPosition })}</div>}
    </div>;
  }

  function Squad({ ids, title }: { ids: string[]; title: string }) {
    return <div className="sec simple-squad"><h2>{title}</h2><div className="roster-list">{ids.map((id) => {
      const item = player(id); if (!item) return null;
      const captain = state.team?.captain === id || state.balancedTeams?.team1.captain === id || state.balancedTeams?.team2.captain === id;
      const lineupPosition = state.balancedTeams?.team1.positions[id] || state.balancedTeams?.team2.positions[id] || defaultPosition(item);
      return RosterRow({ item, captain, lineupPosition, rowKey: id });
    })}</div></div>;
  }

  function FormationBoard() {
    if (!state.balancedTeams) return null;
    const selected = formationTeam === 1 ? state.balancedTeams.team1 : state.balancedTeams.team2;
    const selectedPlayer = selected.ids.includes(formationPlayerId) ? player(formationPlayerId) : undefined;
    const rowFor = (position: string) => ["ST", "CF"].includes(position) ? 12 : ["LW", "CAM", "RW"].includes(position) ? 31 : ["LM", "CM", "CDM", "RM"].includes(position) ? 50 : ["LB", "CB", "RB"].includes(position) ? 70 : position === "GK" ? 88 : 50;
    const fixedX = (position: string) => ({ LW: 13, LM: 11, LB: 11, RW: 87, RM: 89, RB: 89 } as Record<string, number>)[position];
    const placeItems = (items: Array<{ id: string; position: string }>) => {
      const result: Array<{ id: string; position: string; x: number; y: number }> = [];
      for (const y of [12, 31, 50, 70, 88]) {
        const row = items.filter((item) => rowFor(item.position) === y);
        const central = row.filter((item) => fixedX(item.position) === undefined);
        row.filter((item) => fixedX(item.position) !== undefined).forEach((item) => result.push({ ...item, x: fixedX(item.position), y }));
        const leftOccupied = row.some((item) => (fixedX(item.position) || 50) < 50);
        const rightOccupied = row.some((item) => (fixedX(item.position) || 50) > 50);
        const minimum = leftOccupied ? 34 : central.length > 1 ? 34 : 50;
        const maximum = rightOccupied ? 66 : central.length > 1 ? 66 : 50;
        central.forEach((item, index) => result.push({ ...item, x: central.length === 1 ? 50 : minimum + (maximum - minimum) * index / (central.length - 1), y }));
      }
      return result;
    };
    const positionUse = new Map<string, number>();
    const slotItems = FULL_FORMATION_SLOTS.map((position) => { const occurrence = positionUse.get(position) || 0; positionUse.set(position, occurrence + 1); return { id: `slot-${position}-${occurrence}`, position, occurrence }; });
    const slotPlacements = placeItems(slotItems).map((slot) => ({ ...slot, occurrence: Number(slot.id.split("-").at(-1) || 0), occupantId: selected.ids.filter((id) => (selected.positions[id] || defaultPosition(player(id)!)) === slot.position)[Number(slot.id.split("-").at(-1) || 0)] || "" }));
    const occupiedSlotIds = new Set(slotPlacements.map((slot) => slot.occupantId).filter(Boolean));
    const positioned = selected.ids.map((id) => ({ id, position: selected.positions[id] || defaultPosition(player(id) || { id, name: "Player", rating: 0, spec: "" }) }));
    const placements = [
      ...slotPlacements.filter((slot) => slot.occupantId).map((slot) => ({ id: slot.occupantId, position: slot.position, x: slot.x, y: slot.y })),
      ...placeItems(positioned.filter((item) => !occupiedSlotIds.has(item.id))),
    ];
    const moveFormationPlayer = (id: string, position: string, occupantId = "") => {
      if (!unlocked || !id || !selected.ids.includes(id)) return;
      setState((current) => {
        if (!current.balancedTeams) return current;
        const key = formationTeam === 1 ? "team1" : "team2";
        const team = current.balancedTeams[key];
        const previous = team.positions[id] || defaultPosition(current.players.find((item) => item.id === id)!);
        if (occupantId === id || (!occupantId && previous === position)) return current;
        const positions = { ...team.positions, [id]: position };
        if (occupantId && occupantId !== id) positions[occupantId] = previous;
        return { ...current, balancedTeams: { ...current.balancedTeams, cost: -1, [key]: { ...team, positions } } };
      });
      setFormationPlayerId(id);
      setDraggedFormationId("");
    };
    const miniCard = ({ id, x, y }: { id: string; x: number; y: number }) => {
      const item = player(id); if (!item) return null;
      const design = CARD_STYLES.find((style) => style.id === item.cardStyle) || CARD_STYLES[0];
      const assignedPosition = selected.positions[id] || defaultPosition(item);
      return <button type="button" draggable={unlocked} className={`formation-mini-card${formationPlayerId === id ? " is-selected" : ""}${draggedFormationId === id ? " is-dragging" : ""}`} style={{ "--formation-x": `${x}%`, "--formation-y": `${y}%` } as React.CSSProperties} key={id} onDragStart={(event) => { if (!unlocked) return; setDraggedFormationId(id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); }} onDragEnd={() => setDraggedFormationId("")} onDragOver={(event) => { if (unlocked && draggedFormationId && draggedFormationId !== id) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); moveFormationPlayer(event.dataTransfer.getData("text/plain") || draggedFormationId, assignedPosition, id); }} onClick={() => unlocked && draggedFormationId && draggedFormationId !== id ? moveFormationPlayer(draggedFormationId, assignedPosition, id) : setFormationPlayerId(formationPlayerId === id ? "" : id)} aria-label={`View ${item.name} card, ${assignedPosition}`}>
        <img className="formation-mini-frame" src={item.image ? design.cleanSrc : design.src} alt="" />
        {item.image && <img className="formation-mini-photo" src={item.image} alt="" />}
        <span className="formation-mini-overall">{positionOverall(item, assignedPosition) ?? "–"}</span>
        <span className="formation-mini-position">{assignedPosition}</span>
        <span className="formation-mini-name">{item.name}</span>
        {selected.captain === id && <span className="formation-mini-captain">C</span>}
      </button>;
    };
    return <section className="formation-board">
      <div className="formation-board-head"><div><h2>Formation map</h2><p>{selected.name} · {selected.ids.length}/11 positions filled · {unlocked ? "Drag cards to move or swap" : "Select a card to view player details"}</p></div><div className="formation-team-tabs"><button className={formationTeam === 1 ? "on" : ""} onClick={() => { setFormationTeam(1); setFormationPlayerId(""); setDraggedFormationId(""); }}>{state.balancedTeams.team1.name}</button><button className={formationTeam === 2 ? "on" : ""} onClick={() => { setFormationTeam(2); setFormationPlayerId(""); setDraggedFormationId(""); }}>{state.balancedTeams.team2.name}</button></div></div>
      <div className={`formation-stage${selectedPlayer ? " has-selection" : ""}`}><div className={`formation-pitch${draggedFormationId ? " is-moving" : ""}`}><span className="pitch-box pitch-box-top" /><span className="pitch-box pitch-box-bottom" />{slotPlacements.map((slot) => <button type="button" className="formation-slot" style={{ "--formation-x": `${slot.x}%`, "--formation-y": `${slot.y}%` } as React.CSSProperties} key={slot.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); moveFormationPlayer(event.dataTransfer.getData("text/plain") || draggedFormationId, slot.position, slot.occupantId); }} onClick={() => draggedFormationId && moveFormationPlayer(draggedFormationId, slot.position, slot.occupantId)} aria-label={`Move selected player to ${slot.position}`}><span>{slot.position}</span></button>)}{placements.map(miniCard)}</div>
      {selectedPlayer && <aside className="formation-selected-card"><div className="formation-selected-head"><span>{selectedPlayer.name} · {selected.positions[selectedPlayer.id] || defaultPosition(selectedPlayer)}</span><div className="formation-move-actions">{unlocked && <button className={`b sm ${draggedFormationId === selectedPlayer.id ? "pri" : "line"}`} onClick={() => setDraggedFormationId(draggedFormationId === selectedPlayer.id ? "" : selectedPlayer.id)}>{draggedFormationId === selectedPlayer.id ? "Cancel move" : "Move"}</button>}<button className="b line sm" onClick={() => { setFormationPlayerId(""); setDraggedFormationId(""); }}>Close</button></div></div>{PlayerCard({ item: selectedPlayer, compact: true, positionOverride: selected.positions[selectedPlayer.id] })}</aside>}</div>
    </section>;
  }

  function PlayersView() {
    const addPlayer = () => {
      const name = draft.name.trim();
      if (!name) { setError("Enter a name."); return; }
      const customOverall = draft.customOverall === "" ? undefined : normalizeCustomOverall(draft.customOverall);
      if (draft.customOverall !== "" && customOverall === undefined) { setError("Custom OVR must be a whole number from 1 to 99."); return; }
      setState((current) => ({ ...current, players: [...current.players, { id: `p${Date.now()}${Math.random().toString(36).slice(2, 5)}`, name, rating: draft.rating, customOverall, spec: draft.skills[0] || "", skills: draft.skills, image: draft.image, cardStyle: draft.cardStyle, position: draft.position, flag: flagEmoji(draft.flag) }] }));
      setDraft({ rating: 0, customOverall: "", skills: [], name: "", image: "", cardStyle: "classic", position: "CM", flag: "🇵🇰" }); setError("");
    };
    const updatePlayer = (id: string, patch: Partial<Player>) => setState((current) => ({ ...current, players: current.players.map((item) => item.id === id ? { ...item, ...patch } : item), balancedTeams: current.balancedTeams ? { ...current.balancedTeams, cost: -1 } : null }));
    const togglePlayer = (id: string) => setState((current) => {
      const players = current.players.map((item) => item.id === id ? { ...item, on: item.on === false } : item);
      return {
        ...current,
        players,
        balancedTeams: reconcileBalancedTeams(current.balancedTeams, players),
        team: reconcilePickedTeam(current.team, players),
        pool: current.pool?.filter((item) => players.some((candidate) => candidate.id === item.id && candidate.on !== false)) || null,
        match: current.match.motm === id && players.find((item) => item.id === id)?.on === false ? { ...current.match, motm: "" } : current.match,
      };
    });
    const deletePlayer = (id: string) => {
      const selected = player(id);
      if (!selected || !window.confirm(`Delete ${selected.name}? Their saved match-history records will be kept.`)) return;
      setState((current) => {
        const players = current.players.filter((item) => item.id !== id);
        return {
          ...current,
          players,
          balancedTeams: reconcileBalancedTeams(current.balancedTeams, players),
          team: reconcilePickedTeam(current.team, players),
          pool: current.pool?.filter((item) => item.id !== id) || null,
          match: current.match.motm === id ? { ...current.match, motm: "" } : current.match,
        };
      });
      if (editId === id) setEditId("");
    };
    return <>
      {unlocked && <div className="sec"><h2>Add a player</h2>
        <label htmlFor="pn">Name</label><input id="pn" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Player name" autoComplete="off" />
        <label>Rating, 0.5–10 (optional)</label><RatingPicker value={draft.rating} onChange={(rating) => setDraft((current) => ({ ...current, rating, customOverall: rating ? "" : current.customOverall }))} />
        <label htmlFor="custom-overall">Custom OVR (optional)</label><input id="custom-overall" type="number" inputMode="numeric" min="1" max="99" step="1" value={draft.customOverall} onChange={(event) => setDraft((current) => ({ ...current, customOverall: event.target.value, rating: event.target.value ? 0 : current.rating }))} placeholder="Auto calculated" /><p className="note">A custom OVR replaces the 0.5–10 rating. Leave both blank for an unrated player.</p>
        <label>Skills (choose up to {MAX_PLAYER_SKILLS})</label><SkillPicker skills={draft.skills} onChange={(skills) => setDraft((current) => ({ ...current, skills }))} />
        <div className="player-details-row"><div><label htmlFor="position">Main position</label><select id="position" value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></div><div><label htmlFor="flag">Flag or country code</label><input id="flag" value={draft.flag} maxLength={8} onChange={(e) => setDraft({ ...draft, flag: e.target.value })} onBlur={() => setDraft((current) => ({ ...current, flag: flagEmoji(current.flag) }))} placeholder="🇵🇰 or PK" /></div></div>
        <p className="note">Main position is where the player is naturally best. Their assigned team position is changed separately on the formation map.</p>
        <label>Card design</label><div className="design-picker">{CARD_STYLES.map((style) => <button type="button" key={style.id} className={draft.cardStyle === style.id ? "on" : ""} onClick={() => setDraft({ ...draft, cardStyle: style.id })}><img src={style.src} alt="" /><span>{style.name}</span></button>)}</div>
        <label>Player photo (optional)</label><div className="photo-field">{draft.image ? <img src={draft.image} alt="New player preview" /> : <div className="mini-silhouette"><span /></div>}<label className="b line photo-button">{draft.image ? "Change photo" : "Add photo"}<input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setDraft({ ...draft, image: await preparePlayerImage(file) }); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add that image."); } e.target.value = ""; }} /></label>{draft.image && <button className="b line sm" onClick={() => setDraft({ ...draft, image: "" })}>Remove</button>}</div>
        <p className="note" aria-live="polite">{error}</p><button className="b pri" onClick={addPlayer}>Add player</button>
      </div>}
      <div className="sec top-rule"><h2>Squad · {active.length} active of {state.players.length}</h2><p className="note">{unlocked ? "Tap Active to switch off a player who is not available. Inactive players are skipped when the team is made." : "View-only player cards. Admin login is required to add, rate or edit players."}</p>
        {state.players.length ? <div className="player-grid">{state.players.map((item) => <div key={item.id} className="player-card-wrap">
          {PlayerCard({ item, children: unlocked ? <>
            <button className="b sm line" onClick={() => setEditId(editId === item.id ? "" : item.id)}>{editId === item.id ? "Done" : "Rate"}</button>
            <button className={`b sm ${item.on === false ? "line" : ""}`} onClick={() => togglePlayer(item.id)}>{item.on === false ? "Set active" : "Active"}</button>
            <button className="b sm line danger" onClick={() => deletePlayer(item.id)}>Delete</button>
          </> : undefined })}
          {unlocked && editId === item.id && <div className="edit-block card-editor">
            <label htmlFor={`player-name-${item.id}`}>Player name</label>
            <input id={`player-name-${item.id}`} defaultValue={item.name} maxLength={60} autoComplete="off" onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (!name) { event.currentTarget.value = item.name; window.alert("Player name cannot be empty."); return; } if (name !== item.name) updatePlayer(item.id, { name }); }} />
            <label>Rating, 0.5–10</label>
            <RatingPicker value={item.rating} onChange={(rating) => updatePlayer(item.id, { rating, ...(rating ? { customOverall: undefined } : {}) })} />
            <label htmlFor={`custom-overall-${item.id}`}>Custom OVR (optional)</label>
            <input key={`custom-overall-${item.id}-${item.customOverall || "auto"}`} id={`custom-overall-${item.id}`} type="number" inputMode="numeric" min="1" max="99" step="1" defaultValue={item.customOverall || ""} placeholder="Auto calculated" onChange={(event) => { if (event.currentTarget.value && item.rating) updatePlayer(item.id, { rating: 0 }); }} onBlur={(event) => { const value = event.currentTarget.value.trim(); const customOverall = value ? normalizeCustomOverall(value) : undefined; if (value && customOverall === undefined) { event.currentTarget.value = item.customOverall ? String(item.customOverall) : ""; window.alert("Custom OVR must be a whole number from 1 to 99."); return; } updatePlayer(item.id, { customOverall, ...(customOverall ? { rating: 0 } : {}) }); }} />
            <p className="note">A custom OVR replaces the 0.5–10 rating. Leave both blank for an unrated player.</p>
            <label>Skills (choose up to {MAX_PLAYER_SKILLS})</label>
            <SkillPicker skills={playerSkills(item)} onChange={(skills) => updatePlayer(item.id, { skills, spec: skills[0] || "" })} />
            <div className="player-details-row"><div><label>Main position</label><select value={defaultPosition(item)} onChange={(e) => updatePlayer(item.id, { position: e.target.value })}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></div><div><label>Flag or country code</label><input value={item.flag || "🇵🇰"} maxLength={8} onChange={(e) => updatePlayer(item.id, { flag: e.target.value })} onBlur={(e) => updatePlayer(item.id, { flag: flagEmoji(e.currentTarget.value) })} placeholder="🇵🇰 or PK" /></div></div>
            <p className="note">This changes the player&apos;s natural position only. Team lineup positions stay unchanged.</p>
            <label>Card design</label><div className="design-picker is-small">{CARD_STYLES.map((style) => <button type="button" key={style.id} className={(item.cardStyle || "classic") === style.id ? "on" : ""} onClick={() => updatePlayer(item.id, { cardStyle: style.id })}><img src={style.src} alt="" /><span>{style.name}</span></button>)}</div>
            <label>Player photo</label><div className="photo-edit-row"><label className="b line sm photo-button">{item.image ? "Change photo" : "Add photo"}<input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { updatePlayer(item.id, { image: await preparePlayerImage(file) }); } catch (reason) { window.alert(reason instanceof Error ? reason.message : "Could not add that image."); } e.target.value = ""; }} /></label>{item.image && <button className="b line sm" onClick={() => updatePlayer(item.id, { image: "" })}>Remove photo</button>}</div>
          </div>}
        </div>)}</div> : <div className="empty">No players yet.</div>}
      </div>
    </>;
  }

  function LegacyTeamView() {
    const savedBalance = state.balancedTeams;
    const previousBalanceSignature = savedBalance ? [
      [...savedBalance.team1.ids].sort().join("|"),
      [...savedBalance.team2.ids].sort().join("|"),
    ].sort().join("::") : "";

    const generateBalance = (shuffleTeams: boolean) => {
      if (active.length < 2) {
        window.alert("Set at least two players active before generating teams.");
        return;
      }
      const rosterSeed = rosterBalanceSeed(active);
      const seed = shuffleTeams ? nextBalanceSeed(savedBalance?.seed ?? rosterSeed) : rosterSeed;
      const result = makeBalancedTeams(active, seed, shuffleTeams ? previousBalanceSignature : "", pickCaptain || active[0]?.id, pickCaptainTwo || active[1]?.id);
      const firstPositions = assignLineupPositions(result.first.map((id) => active.find((item) => item.id === id)).filter((item): item is Player => Boolean(item)));
      const secondPositions = assignLineupPositions(result.second.map((id) => active.find((item) => item.id === id)).filter((item): item is Player => Boolean(item)));
      setState((current) => ({
        ...current,
        balancedTeams: {
          team1: { name: current.balancedTeams?.team1.name || "Team 1", ids: result.first, captain: pickCaptain || result.first[0], positions: firstPositions },
          team2: { name: current.balancedTeams?.team2.name || "Team 2", ids: result.second, captain: pickCaptainTwo || result.second[0], positions: secondPositions },
          seed,
          cost: result.cost,
        },
      }));
    };

    const renameBalancedTeam = (team: "team1" | "team2", name: string) => setState((current) => {
      if (!current.balancedTeams) return current;
      return {
        ...current,
        balancedTeams: {
          ...current.balancedTeams,
          [team]: { ...current.balancedTeams[team], name },
        },
      };
    });

    const balanceSummary = (ids: string[]) => {
      const roster = sortPlayers(ids.map(player).filter((item): item is Player => Boolean(item)));
      const rated = roster.map((item) => ({ item, values: numericBalanceVector(item) })).filter((entry): entry is { item: Player; values: BalanceVector } => entry.values !== null);
      if (!rated.length) return { roster, text: "No rated players yet" };
      const average = (feature: number) => Math.round(rated.reduce((sum, entry) => sum + entry.values[feature], 0) / rated.length * 10) / 10;
      const labels = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"];
      const attributes = labels.map((label, index) => `${label} ${Math.round(average(index + 1))}`).join(" · ");
      return { roster, text: `Avg rating ${average(0)}/10 · ${attributes}` };
    };

    const balancedRoster = (team: "team1" | "team2") => {
      if (!savedBalance) return null;
      const savedTeam = savedBalance[team];
      const otherTeam = savedBalance[team === "team1" ? "team2" : "team1"];
      const summary = balanceSummary(savedTeam.ids);
      const teamNumber = team === "team1" ? 1 : 2;
      const useForMatch = () => {
        if (!summary.roster.length) return;
        const captain = summary.roster[0].id;
        setState((current) => ({
          ...current,
          tab: "match",
          team: { ids: savedTeam.ids, captain },
          pool: null,
          match: { ...newMatch(current.match), us: savedTeam.name || `Team ${teamNumber}`, opp: otherTeam.name || "Opponents" },
        }));
      };
      return <div className="card balanced-team-card">
        <label htmlFor={`balanced-team-${teamNumber}`}>Team {teamNumber} name</label>
        <input id={`balanced-team-${teamNumber}`} value={savedTeam.name} onChange={(event) => renameBalancedTeam(team, event.target.value)} />
        <p className="note">{summary.text}</p>
        {summary.roster.map((item) => <div className="rowp" key={item.id}>
          <div className="t"><div>{item.name}</div><small>{specialityLabel(item)} · {defaultPosition(item)}</small></div>
          <span className="chip">{ratingLabel(item)}</span>
        </div>)}
        <button className="b line sm balanced-use-button" onClick={useForMatch}>Use Team {teamNumber} in match</button>
      </div>;
    };

    const balancedSection = <div className="sec">
      <h2>Balanced two-team match</h2>
      <p className="note">Generate two sides using rating plus PAC, SHO, PAS, DRI, DEF and PHY. Every active player is included.</p>
      {active.length % 2 === 1 && active.length > 1 && <p className="note">There is an odd number of active players, so Team 1 will have one extra player.</p>}
      {active.some((item) => !item.rating) && <p className="note">Unrated players use the rated squad average for balancing. Rate them for a more accurate split.</p>}
      <div className="button-row">
        <button className="b pri" disabled={active.length < 2} onClick={() => generateBalance(false)}>Generate teams</button>
        <button className="b line" disabled={active.length < 2} onClick={() => generateBalance(true)}>Shuffle teams</button>
      </div>
      {savedBalance && <>
        <p className="note">Balance score {savedBalance.cost.toFixed(3)} · lower is closer</p>
        <div className="row2 balanced-team-grid">{balancedRoster("team1")}{balancedRoster("team2")}</div>
      </>}
    </div>;

    if (state.pool && state.team) {
      const captain = player(state.team.captain); const full = state.team.ids.length >= teamSize || !state.pool.length;
      return <>{balancedSection}<div className="sec"><h2>Manual selection</h2><p className="note">Captain: {captain?.name}. Tap Pick to add a player; they leave the list. {state.team.ids.length}/{teamSize} picked.</p>
        {full ? <button className="b pri" onClick={() => setState((current) => ({ ...current, pool: null }))}>Finish team</button> : <div className="player-grid">{sortPlayers(state.pool).map((item) => <PlayerCard item={player(item.id) || item} compact key={item.id}><button className="b sm pri" onClick={() => setState((current) => ({ ...current, team: current.team ? { ...current.team, ids: [...current.team.ids, item.id] } : null, pool: current.pool?.filter((p) => p.id !== item.id) || null }))}>Pick player</button></PlayerCard>)}</div>}
        <div className="button-row"><button className="b line sm" onClick={resetTeam}>Cancel</button></div></div><Squad ids={state.team.ids} title="Picked so far" /></>;
    }
    if (state.team?.ids.length) return <>{balancedSection}<Squad ids={state.team.ids} title={`${state.match.us} squad`} /><div className="bar transparent-bar"><button className="b pri" onClick={() => setTab("match")}>Go to match</button><button className="b line" onClick={resetTeam}>Make a new team</button></div></>;
    return <>{balancedSection}<div className="sec"><h2>Make the team</h2><label htmlFor="sz">Players in the team (all available by default)</label><input id="sz" type="number" min="1" max="30" value={teamSize} disabled={!active.length} onChange={(e) => readSize(Number.parseInt(e.target.value) || 0)} />
      <p className="note">{active.length ? `${active.length} active player${active.length === 1 ? "" : "s"} available. Lower the number to pick fewer.` : "No active players. Add players or set some active."}</p>
      {active.some((item) => !item.rating) && <p className="note">Some active players are not rated yet, so auto-pick puts them last. Use Rate on the Players tab.</p>}
      <div className="button-row"><button className="b pri" disabled={!active.length} onClick={() => { if (!active.length) return; const picked = sortPlayers(active).slice(0, teamSize); setState((current) => ({ ...current, team: { ids: picked.map((item) => item.id), captain: picked[0].id }, pool: null, match: newMatch(current.match) })); }}>Auto-pick best team</button></div><p className="note">Auto-pick takes the highest rated players; the best one is captain.</p></div>
      <div className="sec top-rule"><h2>Pick manually</h2><label htmlFor="cp">1. Choose the captain</label><select id="cp" value={pickCaptain} onChange={(e) => setPickCaptain(e.target.value)}><option value="">Select captain…</option>{sortPlayers(active).map((item) => <option key={item.id} value={item.id}>{item.name} ({ratingLabel(item)})</option>)}</select>
        <div className="button-row"><button className="b" disabled={!active.length} onClick={() => { if (!pickCaptain) { window.alert("Choose a captain first."); return; } setState((current) => ({ ...current, team: { ids: [pickCaptain], captain: pickCaptain }, pool: active.filter((item) => item.id !== pickCaptain), match: newMatch(current.match) })); }}>2. Start picking players</button></div></div></>;
  }

  function TeamView() {
    const saved = state.balancedTeams;
    const captain1 = saved?.team1.captain || pickCaptain;
    const captain2 = saved?.team2.captain || pickCaptainTwo;
    const assignedIds = new Set(saved ? [...saved.team1.ids, ...saved.team2.ids] : []);
    const unassigned = sortPlayers(active.filter((item) => !assignedIds.has(item.id)));
    const draftTeam: "team1" | "team2" = saved && Math.max(0, saved.team1.ids.length + saved.team2.ids.length - 2) % 2 === 1 ? "team2" : "team1";
    const draftCaptain = saved ? player(saved[draftTeam].captain) : undefined;
    const previousSignature = saved ? [[...saved.team1.ids].sort().join("|"), [...saved.team2.ids].sort().join("|")].sort().join("::") : "";

    const captainsReady = () => {
      if (!captain1 || !captain2) { window.alert("Choose both captains first."); return false; }
      if (captain1 === captain2) { window.alert("Choose two different captains."); return false; }
      if (!active.some((item) => item.id === captain1) || !active.some((item) => item.id === captain2)) { window.alert("Both captains must be active players."); return false; }
      return true;
    };

    const generateTeams = (shuffle: boolean) => {
      if (!captainsReady()) return;
      const rosterSeed = rosterBalanceSeed(active);
      const seed = shuffle ? nextBalanceSeed(saved?.seed ?? rosterSeed) : rosterSeed;
      const result = makeBalancedTeams(active, seed, shuffle ? previousSignature : "", captain1, captain2);
      const firstPositions = assignLineupPositions(result.first.map((id) => active.find((item) => item.id === id)).filter((item): item is Player => Boolean(item)));
      const secondPositions = assignLineupPositions(result.second.map((id) => active.find((item) => item.id === id)).filter((item): item is Player => Boolean(item)));
      setState((current) => ({
        ...current,
        balancedTeams: {
          team1: { name: current.balancedTeams?.team1.name || "Team 1", ids: result.first, captain: captain1, positions: firstPositions },
          team2: { name: current.balancedTeams?.team2.name || "Team 2", ids: result.second, captain: captain2, positions: secondPositions },
          seed,
          cost: result.cost,
        },
      }));
    };

    const startManualPick = () => {
      if (!captainsReady()) return;
      setState((current) => ({
        ...current,
        balancedTeams: {
          team1: { name: current.balancedTeams?.team1.name || "Team 1", ids: [captain1], captain: captain1, positions: { [captain1]: "GK" } },
          team2: { name: current.balancedTeams?.team2.name || "Team 2", ids: [captain2], captain: captain2, positions: { [captain2]: "GK" } },
          seed: rosterBalanceSeed(active),
          cost: -1,
        },
      }));
    };

    const updateTeam = (team: "team1" | "team2", patch: Partial<BalancedTeam>) => setState((current) => {
      if (!current.balancedTeams) return current;
      return { ...current, balancedTeams: { ...current.balancedTeams, [team]: { ...current.balancedTeams[team], ...patch } } };
    });

    const assignPlayer = (id: string, destination: "team1" | "team2") => setState((current) => {
      if (!current.balancedTeams) return current;
      const source = destination === "team1" ? "team2" : "team1";
      if (current.balancedTeams[source].captain === id) return current;
      const sourceIds = current.balancedTeams[source].ids.filter((playerId) => playerId !== id);
      const destinationIds = [...new Set([...current.balancedTeams[destination].ids, id])];
      const positionsFor = (ids: string[]) => assignLineupPositions(ids.map((playerId) => current.players.find((item) => item.id === playerId)).filter((item): item is Player => Boolean(item)));
      return {
        ...current,
        balancedTeams: {
          ...current.balancedTeams,
          cost: -1,
          [source]: { ...current.balancedTeams[source], ids: sourceIds, positions: positionsFor(sourceIds) },
          [destination]: { ...current.balancedTeams[destination], ids: destinationIds, positions: positionsFor(destinationIds) },
        },
      };
    });

    const updateLineupPosition = (team: "team1" | "team2", id: string, position: string) => setState((current) => {
      if (!current.balancedTeams || !POSITIONS.includes(position as typeof POSITIONS[number])) return current;
      const selected = current.balancedTeams[team];
      const previousPosition = selected.positions[id] || "CM";
      if (previousPosition === position) return current;
      const positions = { ...selected.positions };
      const allowedCount = Math.max(1, FULL_FORMATION_SLOTS.filter((slot) => slot === position).length);
      const occupants = selected.ids.filter((playerId) => playerId !== id && positions[playerId] === position);
      if (occupants.length >= allowedCount) positions[occupants[0]] = previousPosition;
      else if (previousPosition === "GK" && position !== "GK") {
        const replacement = selected.ids.filter((playerId) => playerId !== id).map((playerId) => current.players.find((item) => item.id === playerId)).filter((item): item is Player => Boolean(item)).sort((a, b) => positionFit(b, "GK") - positionFit(a, "GK"))[0];
        if (!replacement) return current;
        positions[replacement.id] = "GK";
      }
      positions[id] = position;
      return { ...current, balancedTeams: { ...current.balancedTeams, cost: -1, [team]: { ...selected, positions } } };
    });

    const deleteTeams = () => {
      if (!window.confirm("Delete both generated teams? The player list and match history will be kept.")) return;
      setState((current) => ({ ...current, balancedTeams: null, team: null, pool: null, match: newMatch() }));
      setPickCaptain("");
      setPickCaptainTwo("");
    };

    const hostMatch = () => {
      if (!saved || unassigned.length) return;
      setState((current) => ({
        ...current,
        tab: "match",
        sub: "timeline",
        team: { ids: saved.team1.ids, captain: saved.team1.captain },
        pool: null,
        match: { us: saved.team1.name || "Team 1", opp: saved.team2.name || "Team 2", them: 0, ev: [], motm: "", st: "Live" },
      }));
      setShowGoal(false);
    };

    const teamCard = (key: "team1" | "team2") => {
      if (!saved) return null;
      const team = saved[key];
      const other = key === "team1" ? "team2" : "team1";
      const number = key === "team1" ? 1 : 2;
      const roster = sortPlayers(team.ids.map(player).filter((item): item is Player => Boolean(item)));
      const rated = roster.map(numericBalanceVector).filter((value): value is BalanceVector => value !== null);
      const average = rated.length ? Math.round(rated.reduce((sum, values) => sum + values[0], 0) / rated.length * 10) / 10 : null;
      return <div className="card balanced-team-card">
        {unlocked ? <><label htmlFor={`team-name-${number}`}>Team {number} name</label><input id={`team-name-${number}`} value={team.name} onChange={(event) => updateTeam(key, { name: event.target.value })} /></> : <h3 className="public-team-name">{team.name}</h3>}
        <p className="note">{roster.length} player{roster.length === 1 ? "" : "s"}{average !== null ? ` · Avg ${average}/10` : ""}</p>
        <p className="formation-label">Formation: {formationLabel(team.positions)}</p>
        <div className="roster-list">{roster.map((item) => RosterRow({ item, captain: team.captain === item.id, lineupPosition: team.positions[item.id] || defaultPosition(item), rowKey: item.id, children: unlocked ? <><select className="lineup-position-select" aria-label={`${item.name} lineup position`} value={team.positions[item.id] || defaultPosition(item)} onChange={(event) => updateLineupPosition(key, item.id, event.target.value)}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select>{unassigned.length === 0 && team.captain !== item.id && <button className="b line sm" onClick={() => assignPlayer(item.id, other)}>Move</button>}</> : undefined }))}</div>
      </div>;
    };

    return <>
      {unlocked ? <div className="sec"><h2>Set up two teams</h2><p className="note">Choose two captains, then let the app balance every active player or let the captains draft one player at a time.</p>
        <div className="row2 captain-selects"><div><label htmlFor="captain-one">Team 1 captain</label><select id="captain-one" value={captain1} disabled={Boolean(saved)} onChange={(event) => setPickCaptain(event.target.value)}><option value="">Choose captain…</option>{sortPlayers(active).filter((item) => item.id !== captain2).map((item) => <option value={item.id} key={item.id}>{item.name} ({ratingLabel(item)})</option>)}</select></div><div><label htmlFor="captain-two">Team 2 captain</label><select id="captain-two" value={captain2} disabled={Boolean(saved)} onChange={(event) => setPickCaptainTwo(event.target.value)}><option value="">Choose captain…</option>{sortPlayers(active).filter((item) => item.id !== captain1).map((item) => <option value={item.id} key={item.id}>{item.name} ({ratingLabel(item)})</option>)}</select></div></div>
        {!saved ? <div className="button-row"><button className="b pri" disabled={active.length < 2} onClick={() => generateTeams(false)}>Auto-pick balanced teams</button><button className="b line" disabled={active.length < 2} onClick={startManualPick}>Pick manually</button></div> : <div className="button-row"><button className="b" onClick={() => generateTeams(true)}>Shuffle again</button><button className="b line" onClick={deleteTeams}>Delete generated teams</button></div>}
        {active.some((item) => !item.rating) && <p className="note">Unrated players use the squad average. Add ratings for a more accurate automatic split.</p>}
      </div> : !saved && <div className="sec"><h2>No teams yet</h2><p className="empty">An admin can log in and create the next two teams.</p></div>}
      {saved && <div className="sec top-rule"><h2>{unlocked ? "Edit teams and positions" : "Teams"}</h2><p className="note">{unlocked ? "Positions are assigned automatically and can be changed. Captains stay on their selected side." : "View the current squads, formations and player cards."}</p>
        {unassigned.length > 0 && <div className="draft-arena" aria-live="polite"><div className={`draft-captain draft-captain-left${draftTeam === "team1" ? " is-turn" : ""}`}><span className="draft-hand">✋</span><strong>{player(saved.team1.captain)?.name || saved.team1.name}</strong><small>{draftTeam === "team1" ? "Picking now" : "Waiting"}</small></div><div className="draft-ball">⚽</div><div className={`draft-captain draft-captain-right${draftTeam === "team2" ? " is-turn" : ""}`}><span className="draft-hand">✋</span><strong>{player(saved.team2.captain)?.name || saved.team2.name}</strong><small>{draftTeam === "team2" ? "Picking now" : "Waiting"}</small></div><p><strong>{draftCaptain?.name || saved[draftTeam].name}&apos;s turn</strong> · choose one player</p></div>}
        <div className="row2 balanced-team-grid">{teamCard("team1")}{teamCard("team2")}</div>{FormationBoard()}
        {unassigned.length > 0 && <div className="unassigned-card"><h2>Players waiting to be picked · {unassigned.length}</h2><p className="note">Captains take turns. Only the captain whose hand is highlighted can make the next pick.</p><div className="roster-list">{unassigned.map((item) => RosterRow({ item, rowKey: item.id, children: unlocked ? <button className="b sm pri" onClick={() => assignPlayer(item.id, draftTeam)}>Pick for {draftCaptain?.name || saved[draftTeam].name}</button> : undefined }))}</div></div>}
        {unlocked && <div className="button-row"><button className="b pri" disabled={unassigned.length > 0 || !saved.team1.ids.length || !saved.team2.ids.length} onClick={hostMatch}>Host Team 1 vs Team 2</button></div>}{unlocked && unassigned.length > 0 && <p className="note">Complete the captain draft before hosting the match.</p>}
      </div>}
    </>;
  }

  function MatchView() {
    if (!state.team?.ids.length || state.match.st !== "Live") return <><div className="sec"><h2>No active match</h2><p className="empty">Your teams are ready. Host a match when everyone is ready to play.</p><button className="b pri" onClick={() => setTab("team")}>{state.balancedTeams ? "Review teams and host match" : "Set up teams"}</button></div>{HistoryView()}</>;
    const match = state.match; const team1Goals = match.ev.filter((goal) => goal.team !== 2).length; const team2Goals = match.them + match.ev.filter((goal) => goal.team === 2).length; const live = match.st === "Live";
    const scorerLines = (teamNumber: 1 | 2) => Object.entries(match.ev.filter((goal) => (goal.team || 1) === teamNumber).reduce<Record<string, (number | null)[]>>((result, goal) => { (result[goal.s] ||= []).push(goal.m); return result; }, {}));
    const scoringIds = goalTeam === 1 ? state.team.ids : state.balancedTeams?.team2.ids || [];
    const addGoal = () => {
      if (!live) return;
      const scorer = (document.getElementById("gs") as HTMLSelectElement).value;
      const assist = (document.getElementById("ga") as HTMLSelectElement).value;
      const minute = Number.parseInt((document.getElementById("gm") as HTMLInputElement).value);
      if (assist && assist === scorer) { window.alert("Scorer and assist must be different players."); return; }
      setState((current) => ({ ...current, match: { ...current.match, ev: [...current.match.ev, { s: scorer, a: assist, m: minute >= 0 && minute <= 130 ? minute : null, team: goalTeam }] } })); setShowGoal(false);
    };
    return <>
      <div className="hd"><div className="lg"><span>Hosted match</span><b className={live ? "live" : ""}>{live ? "Live" : "Full-time"}</b></div><div className="sb"><div className="tm"><div className="crest">{initials(match.us)}</div><div className="tn">{match.us}</div></div><div className="sc"><span>{team1Goals}</span><i>-</i><span>{team2Goals}</span></div><div className="tm"><div className="crest">{initials(match.opp)}</div><div className="tn">{match.opp}</div></div></div>
        <div className="gl"><div>{scorerLines(1).map(([id, minutes]) => { const who = player(id); const sorted = minutes.filter((m): m is number => m !== null).sort((a, b) => a - b); const suffix = sorted.length ? sorted.map((m) => `${m}'`).join(", ") : minutes.length > 1 ? `(${minutes.length})` : ""; return who ? <div key={id}>{who.name} {suffix}</div> : null; })}</div><div className="bl">{match.ev.length ? "⚽" : ""}</div><div>{scorerLines(2).map(([id, minutes]) => { const who = player(id); const sorted = minutes.filter((m): m is number => m !== null).sort((a, b) => a - b); const suffix = sorted.length ? sorted.map((m) => `${m}'`).join(", ") : minutes.length > 1 ? `(${minutes.length})` : ""; return who ? <div key={id}>{who.name} {suffix}</div> : null; })}</div></div>
      </div>
      {unlocked ? (live ? <div className="bar"><button className="b pri" onClick={() => { setGoalTeam(1); setShowGoal(true); }}>⚽ {match.us} goal</button><button className="b pri" onClick={() => { setGoalTeam(2); setShowGoal(true); }}>⚽ {match.opp} goal</button><button className="b line" onClick={() => setState((current) => ({ ...current, match: { ...current.match, ev: current.match.ev.slice(0, -1) } }))}>Undo last goal</button><button className="b line" onClick={endCurrentMatch}>End & save</button></div> : <div className="bar"><span className="note">This match is finished and saved in history.</span><button className="b pri" onClick={() => { setState((current) => ({ ...current, team: null, match: newMatch(), tab: "team", sub: "timeline" })); }}>Set up next match</button></div>) : <div className="bar spectator-bar"><span className="note">View-only live match · Admin login is required to record goals or end the match.</span></div>}
      {unlocked && showGoal && live && <div className="card" style={{ marginTop: 16 }}><h2>{goalTeam === 1 ? match.us : match.opp} goal</h2><div className="row2"><div><label htmlFor="gs">Scored by</label><select id="gs">{scoringIds.map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div><div><label htmlFor="ga">Assist by</label><select id="ga"><option value="">No assist</option>{scoringIds.map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div></div><label htmlFor="gm">Minute (optional)</label><input id="gm" type="number" min="0" max="130" inputMode="numeric" placeholder="e.g. 23" /><div className="button-row"><button className="b pri" onClick={addGoal}>Save goal</button><button className="b line" onClick={() => setShowGoal(false)}>Cancel</button></div></div>}
      <div className="tabs match-tabs">{(["timeline", "lineups", "stats", "history", ...(unlocked ? ["edit" as const] : [])] as MatchTab[]).map((tab) => <button key={tab} onClick={() => setSub(tab)} className={state.sub === tab ? "on" : ""}>{tab}</button>)}</div>
      {(state.sub === "timeline" || (!unlocked && state.sub === "edit")) && Timeline()}{state.sub === "lineups" && <><div className="sec">{FormationBoard()}</div>{Squad({ ids: state.team.ids, title: `${match.us} lineup` })}{state.balancedTeams?.team2.ids.length ? Squad({ ids: state.balancedTeams.team2.ids, title: `${match.opp} lineup` }) : null}</>}{state.sub === "stats" && Stats()}{state.sub === "history" && HistoryView()}{unlocked && state.sub === "edit" && MatchSettings()}
      {state.sub !== "history" && state.history.length > 0 && HistoryView()}
    </>;
  }

  function Timeline() {
    const events = state.match.ev.map((goal, index) => ({ ...goal, index })).sort((a, b) => (a.m ?? 999) - (b.m ?? 999) || a.index - b.index);
    return <div className="sec"><h2>Timeline</h2>{events.length ? events.map((goal) => {
      const teamName = (goal.team || 1) === 1 ? state.match.us : state.match.opp;
      return <div className="tl" key={goal.index}><div className="mn">{goal.m !== null ? `${goal.m}'` : "⚽"}</div><div className="t"><div>⚽ {player(goal.s)?.name || "?"}</div><small style={{ color: "var(--mu)" }}>{teamName}{goal.a && player(goal.a) ? ` · Assist: ${player(goal.a)?.name}` : ""}</small></div>{unlocked && state.match.st === "Live" && <button className="b line sm" onClick={() => setState((current) => ({ ...current, match: { ...current.match, ev: current.match.ev.filter((_, index) => index !== goal.index) } }))}>Delete</button>}</div>;
    }) : <div className="empty">No goals yet. Use either team&apos;s goal button to record the scorer.</div>}</div>;
  }

  function HistoryView() {
    const removeHistory = (id: string) => {
      if (!window.confirm("Delete this match from history?")) return;
      if (openHistoryId === id) setOpenHistoryId("");
      setState((current) => ({ ...current, history: current.history.filter((entry) => entry.id !== id) }));
    };
    const historyPlayer = (entry: MatchHistoryEntry, id: string) => [...entry.team1.players, ...entry.team2.players].find((item) => item.id === id);
    const detail = (entry: MatchHistoryEntry) => {
      const goalCount = (id: string) => entry.goals.filter((goal) => goal.s === id).length;
      const assistCount = (id: string) => entry.goals.filter((goal) => goal.a === id).length;
      const allPlayers = [...entry.team1.players.map((item) => ({ ...item, team: entry.team1.name, captain: entry.team1.captain === item.id })), ...entry.team2.players.map((item) => ({ ...item, team: entry.team2.name, captain: entry.team2.captain === item.id }))];
      return <div className="history-detail">
        <div className="history-fulltime">Full-time · {new Date(entry.endedAt).toLocaleString()}</div>
        <div className="history-detail-score"><div><div className="crest">{initials(entry.team1.name)}</div><span>{entry.team1.name}</span></div><strong>{entry.score1} <i>–</i> {entry.score2}</strong><div><div className="crest">{initials(entry.team2.name)}</div><span>{entry.team2.name}</span></div></div>
        <div className="history-scorers"><div>{entry.goals.filter((goal) => goal.team !== 2).map((goal, index) => <span key={`h1-${index}`}>{historyPlayer(entry, goal.s)?.name || "Player"}{goal.m !== null ? ` ${goal.m}'` : ""}</span>)}</div><span>⚽</span><div>{entry.goals.filter((goal) => goal.team === 2).map((goal, index) => <span key={`h2-${index}`}>{historyPlayer(entry, goal.s)?.name || "Player"}{goal.m !== null ? ` ${goal.m}'` : ""}</span>)}</div></div>
        <div className="tabs history-tabs">{(["timeline", "lineups", "stats"] as HistoryDetailTab[]).map((tab) => <button key={tab} className={historyDetailTab === tab ? "on" : ""} onClick={() => setHistoryDetailTab(tab)}>{tab}</button>)}</div>
        {historyDetailTab === "timeline" && <div className="history-detail-body">{entry.goals.length ? entry.goals.map((goal, index) => { const side = (goal.team || 1) === 1 ? entry.team1 : entry.team2; return <div className="tl" key={`${entry.id}-goal-${index}`}><div className="mn">{goal.m !== null ? `${goal.m}'` : "⚽"}</div><div className="t"><div>⚽ {historyPlayer(entry, goal.s)?.name || "Player"}</div><small>{side.name}{goal.a ? ` · Assist: ${historyPlayer(entry, goal.a)?.name || "Player"}` : ""}</small></div></div>; }) : <div className="empty">No goals were recorded.</div>}</div>}
        {historyDetailTab === "lineups" && <div className="history-lineups"><div><h3>{entry.team1.name}</h3>{entry.team1.players.map((item) => <div className="history-player" key={item.id}><span className="history-position">{item.position || "—"}</span><span className="history-player-name">{item.name}</span>{item.id === entry.team1.captain && <span>Captain</span>}</div>)}</div><div><h3>{entry.team2.name}</h3>{entry.team2.players.map((item) => <div className="history-player" key={item.id}><span className="history-position">{item.position || "—"}</span><span className="history-player-name">{item.name}</span>{item.id === entry.team2.captain && <span>Captain</span>}</div>)}</div></div>}
        {historyDetailTab === "stats" && <div className="history-detail-body"><div className="sr"><span>{entry.score1}</span><span>Goals</span><span>{entry.score2}</span></div><table><thead><tr><th>Player</th><th>Team</th><th>G</th><th>A</th></tr></thead><tbody>{allPlayers.map((item) => <tr key={`${item.team}-${item.id}`}><td>{item.name}{item.captain && <span className="cp"> (C)</span>}</td><td>{item.team}</td><td>{goalCount(item.id)}</td><td>{assistCount(item.id)}</td></tr>)}</tbody></table>{entry.motm && <p className="history-motm">Player of the match: <strong>{historyPlayer(entry, entry.motm)?.name || "Player"}</strong></p>}</div>}
      </div>;
    };
    return <div className="sec match-history"><h2>Match history</h2>{state.history.length ? state.history.map((entry) => { const open = openHistoryId === entry.id; return <article className={`history-card${open ? " is-open" : ""}`} key={entry.id}>
      <button className="history-summary" aria-expanded={open} onClick={() => { setOpenHistoryId(open ? "" : entry.id); setHistoryDetailTab("timeline"); }}><span className="history-date">{new Date(entry.endedAt).toLocaleDateString()}</span><span className="history-score"><span>{entry.team1.name}</span><strong>{entry.score1} – {entry.score2}</strong><span>{entry.team2.name}</span></span><span className="history-result">Full-time <b>{open ? "⌃" : "⌄"}</b></span></button>
      {open && detail(entry)}
      {unlocked && <button className="b line sm history-delete" onClick={() => removeHistory(entry.id)}>Delete match</button>}
    </article>; }) : <div className="empty">Ended matches will be saved here.</div>}</div>;
  }

  function endCurrentMatch() {
    if (!state.team || state.match.st !== "Live") return;
    if (!window.confirm("End this match and save it to history?")) return;
    const second = state.balancedTeams?.team2;
    const firstPlayers = state.team.ids.map((id) => player(id)).filter((item): item is Player => Boolean(item)).map((item) => ({ id: item.id, name: item.name, position: state.balancedTeams?.team1.positions[item.id] || defaultPosition(item) }));
    const secondPlayers = (second?.ids || []).map((id) => player(id)).filter((item): item is Player => Boolean(item)).map((item) => ({ id: item.id, name: item.name, position: second?.positions[item.id] || defaultPosition(item) }));
    const entry: MatchHistoryEntry = {
      id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      endedAt: new Date().toISOString(),
      team1: { name: state.match.us, captain: state.team.captain, players: firstPlayers },
      team2: { name: state.match.opp, captain: second?.captain || "", players: secondPlayers },
      score1: state.match.ev.filter((goal) => goal.team !== 2).length,
      score2: state.match.them + state.match.ev.filter((goal) => goal.team === 2).length,
      goals: state.match.ev,
      motm: state.match.motm || automaticMotm(),
    };
    setShowGoal(false);
    setOpenHistoryId(entry.id);
    setHistoryDetailTab("timeline");
    setState((current) => ({ ...current, team: null, sub: "history", match: newMatch(current.match), history: [entry, ...current.history].slice(0, 100) }));
  }

  function Stats() {
    if (!state.team) return null;
    const team1Ids = state.team.ids; const team2Ids = state.balancedTeams?.team2.ids || []; const ids = [...new Set([...team1Ids, ...team2Ids])]; const motm = state.match.motm || automaticMotm();
    const team1Goals = state.match.ev.filter((goal) => goal.team !== 2).length; const team2Goals = state.match.them + state.match.ev.filter((goal) => goal.team === 2).length;
    const team1Assists = state.match.ev.filter((goal) => goal.team !== 2 && goal.a).length; const team2Assists = state.match.ev.filter((goal) => goal.team === 2 && goal.a).length;
    const max = (key: "g" | "a") => Math.max(0, ...ids.map((id) => stats(id)[key]));
    return <><div className="sec"><div className="team-stat-head"><span>{state.match.us}</span><span>TEAM STATS</span><span>{state.match.opp}</span></div><div className="sr"><span>{team1Goals > team2Goals && team1Goals > 0 ? <span className="pill l">{team1Goals}</span> : team1Goals}</span><span>Goals</span><span>{team2Goals > team1Goals && team2Goals > 0 ? <span className="pill r">{team2Goals}</span> : team2Goals}</span></div><div className="sr"><span>{team1Assists}</span><span>Assists</span><span>{team2Assists}</span></div></div>
      <div className="card motm"><div className="note" style={{ margin: "0 0 4px" }}>Man of the match</div>{motm && player(motm) ? <><div className="big">{player(motm)?.name}</div><p className="note">{stats(motm).g} goals, {stats(motm).a} assists. {state.match.motm ? "Chosen by you." : "Picked from goals, assists and rating."}</p></> : <div className="empty">Appears after the first goal.</div>}</div>
      <div className="sec stats-table"><table><thead><tr><th>Player</th><th>Team</th><th>Goals</th><th>Assists</th></tr></thead><tbody>{ids.map((id) => { const item = player(id); const totals = stats(id); const isTeam1 = team1Ids.includes(id); const isCaptain = (isTeam1 ? state.team?.captain : state.balancedTeams?.team2.captain) === id; return <tr key={id}><td>{item?.name}{isCaptain && <span className="cp"> (C)</span>}</td><td>{isTeam1 ? state.match.us : state.match.opp}</td><td>{totals.g > 0 && totals.g === max("g") ? <span className="pill l">{totals.g}</span> : totals.g}</td><td>{totals.a > 0 && totals.a === max("a") ? <span className="pill l">{totals.a}</span> : totals.a}</td></tr>; })}</tbody></table></div></>;
  }

  function MatchSettings() {
    if (!unlocked || !state.team) return null;
    const updateMatch = (patch: Partial<Match>) => setState((current) => ({ ...current, match: { ...current.match, ...patch } }));
    const allIds = [...new Set([...state.team.ids, ...(state.balancedTeams?.team2.ids || [])])];
    return <div className="sec"><h2>Match settings</h2><div className="row2"><div><label htmlFor="tn">Team 1 name</label><input id="tn" value={state.match.us} onChange={(e) => updateMatch({ us: e.target.value })} /></div><div><label htmlFor="on">Team 2 name</label><input id="on" value={state.match.opp} onChange={(e) => updateMatch({ opp: e.target.value })} /></div></div><label htmlFor="mo">Man of the match</label><select id="mo" value={state.match.motm} onChange={(e) => updateMatch({ motm: e.target.value })}><option value="">Automatic</option>{allIds.map((id) => <option value={id} key={id}>{player(id)?.name}</option>)}</select>
      <div className="button-row">{state.match.st === "Live" && <button className="b pri" onClick={endCurrentMatch}>End & save match</button>}<button className="b line" onClick={() => { if (!window.confirm("Delete the current match? Saved history will be kept.")) return; setShowGoal(false); setState((current) => ({ ...current, team: null, match: newMatch(), tab: "team", sub: "timeline" })); }}>Delete current match</button></div></div>;
  }

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      if (!response.ok) { setPasswordError("Incorrect password. Try again."); return; }
      setPassword("");
      setShowAdminLogin(false);
      setUnlocked(true);
    } catch {
      setPasswordError("Could not reach the server. Try again.");
    }
  };
  const lock = async () => {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => null);
    setEditId("");
    setShowGoal(false);
    setDraggedFormationId("");
    setUnlocked(false);
  };
  if (!accessChecked || !hydrated.current) return <div className="app access-screen"><div className="access-card"><img src="/badges/squad-sheet-fc.png" alt="Squad Sheet FC" /><p className="access-kicker">SQUAD SHEET</p><h1>Loading…</h1></div></div>;

  const syncText = !unlocked ? (syncStatus === "loading" ? "Loading public view…" : syncStatus === "offline" ? "View only · Supabase offline" : "View only · Live data") : syncStatus === "loading" ? "Loading Supabase…" : syncStatus === "saving" ? "Saving…" : syncStatus === "saved" ? "Saved to Supabase" : "Saved locally · Supabase offline";
  return <div className={`app${unlocked ? " is-admin" : " is-view-only"}`}><nav className="tabs" aria-label="Main navigation">{(["match", "team", "players"] as MainTab[]).map((tab) => <button key={tab} onClick={() => setTab(tab)} className={state.tab === tab ? "on" : ""}>{tab}</button>)}</nav><div className={`sync-status is-${syncStatus}`} role="status" aria-live="polite"><span />{syncText}<button type="button" onClick={() => unlocked ? void lock() : setShowAdminLogin(true)}>{unlocked ? "Exit admin" : "Admin login"}</button></div><main>{state.tab === "players" ? PlayersView() : state.tab === "team" ? TeamView() : MatchView()}</main>
    {showAdminLogin && !unlocked && <div className="admin-login-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdminLogin(false); }}><form className="access-card admin-login-card" onSubmit={unlock} role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
      <button className="admin-login-close" type="button" onClick={() => setShowAdminLogin(false)} aria-label="Close admin login">×</button>
      <img src="/badges/squad-sheet-fc.png" alt="" />
      <p className="access-kicker">ADMIN MODE</p>
      <h1 id="admin-login-title">Enter password</h1>
      <p className="note">Admin mode can manage players, teams and matches.</p>
      <label htmlFor="app-password">Password</label>
      <input id="app-password" type="password" inputMode="numeric" autoComplete="current-password" autoFocus value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(""); }} />
      {passwordError && <p className="access-error" role="alert">{passwordError}</p>}
      <button className="b pri" type="submit">Unlock admin mode</button>
    </form></div>}
  </div>;
}
