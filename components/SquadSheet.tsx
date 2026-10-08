"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import CricketWorkspace from "@/components/CricketWorkspace";
import { CricketState, CricketTab, initialCricketState, restoreCricketState } from "@/lib/cricket";

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
type SportMode = "football" | "cricket";
type MatchTab = "timeline" | "lineups" | "stats" | "history" | "edit";
type HistoryDetailTab = "timeline" | "lineups" | "stats";
type TeamRosterAction = "captain" | "bench" | "move";
type CardStyleId = typeof CARD_STYLES[number]["id"];
type Player = { id: string; name: string; rating: number; spec: string; skills?: string[]; customOverall?: number; image?: string; cardStyle?: CardStyleId; position?: string; flag?: string; on?: boolean };
type Goal = { s: string; a: string; m: number | null; team?: 1 | 2; kind?: "goal" | "penalty"; message?: number };
type MatchIncident =
  | { id: string; type: "yellow"; playerId: string; team: 1 | 2; m: number | null; message?: number }
  | { id: string; type: "substitution"; playerOutId: string; playerInId: string; team: 1 | 2; m: number | null; message?: number };
type Team = { ids: string[]; captain: string };
type LineupPositions = Record<string, string>;
type BalancedTeam = { name: string; flag?: string; ids: string[]; captain: string; positions: LineupPositions; substitutes?: string[] };
type BalancedTeams = {
  team1: BalancedTeam;
  team2: BalancedTeam;
  seed: number;
  cost: number;
};
type MatchPauseReason = "" | "break" | "half-time" | "time";
type Match = {
  opp: string;
  us: string;
  them: number;
  ev: Goal[];
  motm: string;
  st: "Live" | "Full-time";
  scheduledFor?: string;
  startedAt?: number;
  timerStartedAt?: number;
  elapsedSeconds?: number;
  halfTimeTaken?: boolean;
  pauseReason?: MatchPauseReason;
  incidents?: MatchIncident[];
};
type MatchHistoryEntry = {
  id: string;
  endedAt: string;
  scheduledFor?: string;
  startedAt?: string;
  durationSeconds?: number;
  team1: { name: string; flag?: string; captain: string; substitutes?: string[]; players: Array<{ id: string; name: string; position: string; flag?: string; image?: string }> };
  team2: { name: string; flag?: string; captain: string; substitutes?: string[]; players: Array<{ id: string; name: string; position: string; flag?: string; image?: string }> };
  score1: number;
  score2: number;
  goals: Goal[];
  incidents?: MatchIncident[];
  motm: string;
};
type AppState = {
  sportMode: SportMode;
  cricket: CricketState;
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

type SyncStatus = "loading" | "saving" | "saved" | "reconnecting" | "offline";
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
  incidents: [],
});

const MATCH_DURATION_SECONDS = 90 * 60;
const HALF_TIME_SECONDS = 45 * 60;
const elapsedMatchSeconds = (match: Match, now = Date.now()) => Math.min(MATCH_DURATION_SECONDS, Math.max(0,
  Math.floor(match.elapsedSeconds || 0) + (match.timerStartedAt ? Math.max(0, Math.floor((now - match.timerStartedAt) / 1000)) : 0),
));
const formatMatchClock = (seconds: number) => {
  const safeSeconds = Math.min(MATCH_DURATION_SECONDS, Math.max(0, Math.floor(seconds)));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
};
const formatMatchMinute = (minute: number | null) => minute === null ? "Event" : minute > 90 ? `90+${minute - 90}'` : `${minute}'`;
const formatKickoff = (value?: string) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "";
const formatKickoffDelay = (scheduledFor: string, now: number) => {
  const seconds = Math.max(0, Math.floor((now - Date.parse(scheduledFor)) / 1000));
  if (seconds < 60) return "less than 1 minute late";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (!hours) return `${minutes} minute${minutes === 1 ? "" : "s"} late`;
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ""} late`;
};
const scoredGoalTimeline = (goals: Goal[], openingTeam2Score = 0) => {
  let score1 = 0;
  let score2 = openingTeam2Score;
  return goals
    .map((goal, index) => ({ ...goal, index }))
    .sort((a, b) => (a.m ?? 999) - (b.m ?? 999) || a.index - b.index)
    .map((goal) => {
      if ((goal.team || 1) === 1) score1 += 1;
      else score2 += 1;
      return { ...goal, score1, score2 };
    });
};
type GoalMessageContext = { scorer: string; team: string; opponent: string; score: string; assist?: string; penalty: boolean };
const GOAL_MESSAGES: Array<(context: GoalMessageContext) => string> = [
  ({ scorer, team, score, assist, penalty }) => `${scorer} ${penalty ? "steps up and converts from the penalty spot with composure" : "finishes the attacking move and finds the net"} for ${team}. The goal changes the score to ${score}${assist ? `, with ${assist} providing the decisive assist` : " after an unassisted finish"}.`,
  ({ scorer, team, opponent, score, assist, penalty }) => `${penalty ? "A confidently taken penalty" : "A well-worked goal"} puts ${team} on the scoresheet against ${opponent}, with ${scorer} applying the finish. The scoreboard now reads ${score}${assist ? ` after ${assist} created the final opening` : ""}.`,
  ({ scorer, team, score, assist, penalty }) => `${scorer} ${penalty ? "keeps calm under pressure and scores from the spot" : "completes the move with a composed finish"} for ${team}. It is now ${score}${assist ? `, and ${assist} receives credit for the final pass that opened the chance` : ""}.`,
  ({ scorer, team, score, assist, penalty }) => `${team} have a goal to celebrate as ${scorer} ${penalty ? "makes the penalty count" : "turns their attack into a finish"}. The result moves to ${score}${assist ? ` following an important contribution and assist from ${assist}` : ""}.`,
  ({ scorer, team, opponent, score, assist, penalty }) => `${scorer} ${penalty ? "makes no mistake with the spot kick" : "breaks through and completes the opportunity"} for ${team} against ${opponent}. The new score is ${score}${assist ? `, with ${assist} involved at the decisive moment` : ""}.`,
  ({ scorer, team, score, assist, penalty }) => `${penalty ? "A composed penalty is converted by" : "A controlled attacking finish comes from"} ${scorer}, giving ${team} another goal. The match moves to ${score}${assist ? ` after ${assist} supplied the assist and helped create the opening` : ""}.`,
  ({ scorer, team, score, assist, penalty }) => `${scorer} ${penalty ? "wins the moment from the penalty spot and converts" : "caps the attacking sequence with the goal"} for ${team}. The scoreboard changes to ${score}${assist ? `, and ${assist} is rewarded for setting up the chance` : ""}.`,
  ({ scorer, team, opponent, score, assist, penalty }) => `${penalty ? "The penalty is converted" : "The ball is in the net"} as ${scorer} scores for ${team} against ${opponent}. That finish makes it ${score}${assist ? ` after ${assist} delivered the key assist in the build-up` : ""}.`,
  ({ scorer, team, score, assist, penalty }) => `${team} add to their total through ${scorer}, who ${penalty ? "scores from twelve yards" : "applies the final touch to the move"}. The score now stands at ${score}${assist ? `, with ${assist} credited for creating the opportunity` : ""}.`,
  ({ scorer, team, score, assist, penalty }) => `${penalty ? "The spot kick is successfully converted" : "The attacking move ends with a goal"} as ${scorer} scores for ${team}. The match now stands at ${score}${assist ? ` after ${assist} supplied the final pass and earned the assist` : ""}.`,
];
type IncidentMessageContext = { team: string; player?: string; playerIn?: string; playerOut?: string };
const INCIDENT_MESSAGE_STYLES: Array<{ yellow: (context: IncidentMessageContext) => string; substitution: (context: IncidentMessageContext) => string }> = [
  { yellow: ({ player, team }) => `${player} goes into the referee's book, giving ${team} a yellow card to manage for the remainder of the match. The player will need to be more careful in the next challenges.`, substitution: ({ playerIn, playerOut, team }) => `${team} make a change as ${playerIn} enters the match and ${playerOut} leaves the field. The substitution introduces a fresh option while preserving the team's current shape.` },
  { yellow: ({ player, team }) => `The referee stops play and shows a yellow card to ${player} of ${team}. It is an official caution, so another mistimed challenge could carry a more serious consequence.`, substitution: ({ playerIn, playerOut, team }) => `${team} turn to the bench, replacing ${playerOut} with ${playerIn}. The incoming player now takes over the role as the team adjusts for the next phase of the match.` },
  { yellow: ({ player, team }) => `${player} receives a caution and becomes the latest ${team} player to be booked. The yellow card is recorded in the match timeline and will remain part of the player's match total.`, substitution: ({ playerIn, playerOut, team }) => `A substitution is completed for ${team}: ${playerIn} comes on while ${playerOut} makes way. The lineup and formation now reflect the new player on the field.` },
  { yellow: ({ player, team }) => `The referee produces the yellow card for ${player}, leaving ${team} with a booked player. From this point, the player must manage the remaining minutes with extra discipline.`, substitution: ({ playerIn, playerOut, team }) => `${playerIn} joins the action for ${team}, taking the place of ${playerOut}. The change brings fresh energy into the lineup and moves the departing player to the substitutes list.` },
  { yellow: ({ player, team }) => `${player} is shown a yellow card and the caution is added to ${team}'s match record. The booking may influence how aggressively the player can approach later challenges.`, substitution: ({ playerIn, playerOut, team }) => `${team} refresh their on-field lineup with ${playerIn} replacing ${playerOut}. The substitution is now recorded, and both the formation map and timeline reflect the change.` },
];
const stableMessageIndex = (key: string, length: number) => [...key].reduce((total, character) => total + character.charCodeAt(0), 0) % length;
const yellowCardNumber = (incidents: MatchIncident[], target: Extract<MatchIncident, { type: "yellow" }>) => {
  const targetIndex = incidents.findIndex((incident) => incident.id === target.id);
  const relevantIncidents = targetIndex >= 0 ? incidents.slice(0, targetIndex + 1) : incidents;
  return relevantIncidents.filter((incident) => incident.type === "yellow" && incident.playerId === target.playerId).length;
};
const datetimeLocalValue = (value?: string) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const flagEmoji = (value?: string) => {
  const flag = value?.trim() || "PK";
  if (!/^[a-z]{2}$/i.test(flag)) return flag;
  return [...flag.toUpperCase()].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("");
};
const normalizeTeamFlag = (value?: string) => value?.trim() ? flagEmoji(value) : "";

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
  sportMode: "football",
  cricket: initialCricketState(),
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

const sharedStateFingerprint = (value: AppState) => JSON.stringify({
  sportMode: value.sportMode,
  cricket: value.cricket,
  players: value.players,
  want: value.want,
  team: value.team,
  balancedTeams: value.balancedTeams,
  pool: value.pool,
  match: value.match,
  history: value.history,
  seeded: value.seeded,
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

function PlayerPhoto({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  return <img
    className={`${className}${className ? " " : ""}is-${orientation}`}
    src={src}
    alt={alt}
    onLoad={(event) => {
      const image = event.currentTarget;
      setOrientation(image.naturalWidth > image.naturalHeight ? "landscape" : "portrait");
    }}
  />;
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
      team1: { name: savedBalance.team1.name || "Team 1", flag: normalizeTeamFlag(savedBalance.team1.flag), ids: savedBalance.team1.ids.map(String).filter((id) => playerIds.has(id)), captain: String(savedBalance.team1.captain || savedBalance.team1.ids[0] || ""), positions: savedBalance.team1.positions && typeof savedBalance.team1.positions === "object" ? savedBalance.team1.positions : {}, substitutes: Array.isArray(savedBalance.team1.substitutes) ? savedBalance.team1.substitutes.map(String).filter((id) => playerIds.has(id)) : [] },
      team2: { name: savedBalance.team2.name || "Team 2", flag: normalizeTeamFlag(savedBalance.team2.flag), ids: savedBalance.team2.ids.map(String).filter((id) => playerIds.has(id)), captain: String(savedBalance.team2.captain || savedBalance.team2.ids[0] || ""), positions: savedBalance.team2.positions && typeof savedBalance.team2.positions === "object" ? savedBalance.team2.positions : {}, substitutes: Array.isArray(savedBalance.team2.substitutes) ? savedBalance.team2.substitutes.map(String).filter((id) => playerIds.has(id)) : [] },
      seed: Number(savedBalance.seed) || 0,
      cost: Number(savedBalance.cost) || 0,
    }
    : null;
  const normalizedBalancedTeams = balancedTeams ? {
    ...balancedTeams,
    team1: { ...balancedTeams.team1, positions: normalizeLineupPositions(balancedTeams.team1.ids.map((id) => players.find((item) => item.id === id)).filter((item): item is Player => Boolean(item)), balancedTeams.team1.positions) },
    team2: { ...balancedTeams.team2, positions: normalizeLineupPositions(balancedTeams.team2.ids.map((id) => players.find((item) => item.id === id)).filter((item): item is Player => Boolean(item)), balancedTeams.team2.positions) },
  } : null;
  const parsedMatch: Partial<Match> = parsed.match && typeof parsed.match === "object" ? parsed.match : {};
  const normalizedMatch: Match = {
    ...base.match,
    ...parsedMatch,
    scheduledFor: typeof parsedMatch.scheduledFor === "string" && Number.isFinite(Date.parse(parsedMatch.scheduledFor)) ? parsedMatch.scheduledFor : undefined,
    startedAt: Number.isFinite(Number(parsedMatch.startedAt)) && Number(parsedMatch.startedAt) > 0 ? Number(parsedMatch.startedAt) : undefined,
    timerStartedAt: Number.isFinite(Number(parsedMatch.timerStartedAt)) && Number(parsedMatch.timerStartedAt) > 0 ? Number(parsedMatch.timerStartedAt) : undefined,
    elapsedSeconds: Math.min(MATCH_DURATION_SECONDS, Math.max(0, Math.floor(Number(parsedMatch.elapsedSeconds) || 0))),
    halfTimeTaken: Boolean(parsedMatch.halfTimeTaken),
    pauseReason: parsedMatch.pauseReason === "break" || parsedMatch.pauseReason === "half-time" || parsedMatch.pauseReason === "time" ? parsedMatch.pauseReason : "",
    incidents: Array.isArray(parsedMatch.incidents) ? parsedMatch.incidents : [],
  };
  return {
    ...base,
    ...parsed,
    sportMode: parsed.sportMode === "cricket" ? "cricket" : "football",
    cricket: restoreCricketState(parsed.cricket),
    players,
    want: Number.isFinite(Number(parsed.want)) ? Math.max(0, Number(parsed.want)) : 0,
    team: savedTeam?.ids.length ? { ...savedTeam, captain: playerIds.has(savedTeam.captain) ? savedTeam.captain : savedTeam.ids[0] } : null,
    balancedTeams: normalizedBalancedTeams,
    pool: Array.isArray(parsed.pool) ? parsed.pool.filter((item) => item && playerIds.has(String(item.id))).map((item) => players.find((player) => player.id === String(item.id))!).filter(Boolean) : null,
    tab: parsed.tab === "team" || parsed.tab === "players" ? parsed.tab : "match",
    sub: parsed.sub === "lineups" || parsed.sub === "stats" || parsed.sub === "history" || parsed.sub === "edit" ? parsed.sub : "timeline",
    match: normalizedMatch,
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
const flagImageSource = (flag?: string, width = 80) => {
  if (!flag) return "";
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(flag)) return flag;
  const code = flagCountryCode(flag);
  return code === "PK" ? "/flags/pk.svg" : code ? `https://flagcdn.com/w${width}/${code.toLowerCase()}.png` : "";
};
function TeamMark({ name, flag, className = "crest" }: { name: string; flag?: string; className?: string }) {
  const source = flagImageSource(flag);
  return <span className={`${className}${flag ? " has-team-flag" : ""}`}>{flag ? source ? <img src={source} alt={`${name} flag`} /> : normalizeTeamFlag(flag) : initials(name)}</span>;
}
type MatchEventBadgeKind = "goal" | "assist" | "yellow-card" | "red-card";
function MatchEventBadge({ kind, count, title, className = "" }: { kind: MatchEventBadgeKind; count?: number; title?: string; className?: string }) {
  const label = title || ({ goal: "Goal", assist: "Assist", "yellow-card": "Yellow card", "red-card": "Red card" }[kind]);
  return <span className={`match-event-badge match-event-badge-${kind}${className ? ` ${className}` : ""}`} title={label} aria-label={label}><img src={`/badges/match-events/${kind}.png`} alt="" />{count && count > 1 ? <b>{count}</b> : null}</span>;
}
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
const LINEUP_POSITION_POOL = ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"];
const lineupCandidateSlots = (count: number) => {
  if (count <= LINEUP_POSITION_POOL.length) return [...LINEUP_POSITION_POOL];
  const extras = ["CM", "CB", "ST", "LW", "RW"];
  return [...LINEUP_POSITION_POOL, ...Array.from({ length: count - LINEUP_POSITION_POOL.length }, (_, index) => extras[index % extras.length])];
};

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

const optimalLineupPositions = (roster: Player[], slots: string[], requiredPositions: string[] = []): LineupPositions => {
  const result: LineupPositions = {};
  const playerCount = roster.length;
  const slotCount = slots.length;
  if (!playerCount || slotCount < playerCount) return result;
  const count = Math.max(playerCount, slotCount);
  const requiredSlotIndexes = new Set<number>();
  for (const position of requiredPositions) {
    const slotIndex = slots.findIndex((slot, index) => slot === position && !requiredSlotIndexes.has(index));
    if (slotIndex >= 0) requiredSlotIndexes.add(slotIndex);
  }
  const requiredBonus = 1_000_000_000_000;

  // Real players may use any candidate slot. Dummy rows leave the unused positions empty.
  // OVR is the primary objective; position fit only resolves equal-total-OVR lineups.
  const score = Array.from({ length: count }, (_, playerIndex) => Array.from({ length: count }, (_, slotIndex) => {
    if (playerIndex >= playerCount) return 0;
    if (slotIndex >= slotCount) return -requiredBonus;
    const slot = slots[slotIndex];
    return (positionOverall(roster[playerIndex], slot) || 0) * 1_000_000
      + positionFit(roster[playerIndex], slot)
      + (requiredSlotIndexes.has(slotIndex) ? requiredBonus : 0);
  }));
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

  for (let slotIndex = 1; slotIndex <= slotCount; slotIndex++) {
    const playerIndex = matchedPlayer[slotIndex] - 1;
    const item = roster[playerIndex];
    if (item && playerIndex < playerCount) result[item.id] = slots[slotIndex - 1];
  }
  return result;
};

const lineupAssignmentScore = (roster: Player[], positions: LineupPositions) => roster.reduce((total, item) => {
  const position = positions[item.id] || defaultPosition(item);
  return total + (positionOverall(item, position) || 0) * 1_000_000 + positionFit(item, position);
}, 0);

const assignLineupPositions = (roster: Player[]): LineupPositions => {
  const slots = lineupCandidateSlots(roster.length);
  if (roster.length < 3) return optimalLineupPositions(roster, slots, ["GK"]);
  const defenders = ["LB", "CB", "RB"];
  const attackers = ["LW", "RW", "CF", "ST"];
  let best: LineupPositions = {};
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const defender of defenders) {
    for (const attacker of attackers) {
      const candidate = optimalLineupPositions(roster, slots, ["GK", defender, attacker]);
      const score = lineupAssignmentScore(roster, candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }
  return best;
};

const normalizeLineupPositions = (roster: Player[], saved: LineupPositions): LineupPositions => {
  if (!roster.length) return {};
  const allowedSlots = lineupCandidateSlots(Math.max(11, roster.length));
  const capacity = allowedSlots.reduce<Record<string, number>>((result, position) => { result[position] = (result[position] || 0) + 1; return result; }, {});
  const used: Record<string, number> = {};
  const result: LineupPositions = {};

  for (const item of roster) {
    const position = saved?.[item.id];
    if (!position || !POSITIONS.includes(position as typeof POSITIONS[number]) || (used[position] || 0) >= (capacity[position] || 0)) continue;
    result[item.id] = position;
    used[position] = (used[position] || 0) + 1;
  }

  const consumed: Record<string, number> = {};
  const openSlots = allowedSlots.filter((position) => {
    if ((consumed[position] || 0) < (used[position] || 0)) {
      consumed[position] = (consumed[position] || 0) + 1;
      return false;
    }
    return true;
  });
  const unassigned = roster.filter((item) => !result[item.id]);
  return { ...result, ...optimalLineupPositions(unassigned, openSlots, used.GK ? [] : ["GK"]) };
};

const reconcileBalancedTeams = (balancedTeams: BalancedTeams | null, players: Player[]): BalancedTeams | null => {
  if (!balancedTeams) return null;
  const available = new Map(players.filter((item) => item.on !== false).map((item) => [item.id, item]));
  const repairTeam = (team: BalancedTeam): BalancedTeam => {
    const ids = team.ids.filter((id) => available.has(id));
    const roster = ids.map((id) => available.get(id)).filter((item): item is Player => Boolean(item));
    const captain = ids.includes(team.captain) ? team.captain : sortPlayers(roster)[0]?.id || "";
    return { ...team, ids, captain, positions: normalizeLineupPositions(roster, team.positions), substitutes: (team.substitutes || []).filter((id) => ids.includes(id)) };
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

const BALANCE_WEIGHTS: BalanceVector = [1];
const BALANCE_SCALES: BalanceVector = [1];
const FALLBACK_BALANCE_VECTOR: BalanceVector = [75];

const numericBalanceVector = (player: Player): BalanceVector | null => {
  const overall = displayedOverall(player);
  return overall === null ? null : [overall];
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
    return { player, values: [...fallback] as BalanceVector };
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
  let cost = balanceCost(firstTotal, first.length, secondTotal, second.length);
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
        const nextCost = balanceCost(nextFirst, first.length, nextSecond, second.length);
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
    .map((item) => `${item.id}:${displayedOverall(item) ?? "unrated"}`)
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

async function uploadTeamFlag(file: File) {
  if (file.type !== "image/png") throw new Error("Please choose a PNG flag image.");
  if (file.size > 3 * 1024 * 1024) throw new Error("Team flag PNG files must be smaller than 3 MB.");
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const result = await response.json().catch(() => null) as { imageUrl?: string; error?: string } | null;
  if (!response.ok || !result?.imageUrl) throw new Error(result?.error || "The team flag could not be uploaded.");
  return result.imageUrl;
}

export default function SquadSheet() {
  const [state, setState] = useState<AppState>(initialState);
  const [draft, setDraft] = useState<{ rating: number; customOverall: string; skills: string[]; name: string; image: string; cardStyle: CardStyleId; position: string; flag: string }>({ rating: 0, customOverall: "", skills: [], name: "", image: "", cardStyle: "classic", position: "CM", flag: "🇵🇰" });
  const [pickCaptain, setPickCaptain] = useState("");
  const [pickCaptainTwo, setPickCaptainTwo] = useState("");
  const [showGoal, setShowGoal] = useState(false);
  const [goalTeam, setGoalTeam] = useState<1 | 2>(1);
  const [matchEventEditor, setMatchEventEditor] = useState<"" | "yellow" | "substitution">("");
  const [matchEventTeam, setMatchEventTeam] = useState<1 | 2>(1);
  const [scheduleInput, setScheduleInput] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [openHistoryId, setOpenHistoryId] = useState("");
  const [historyDetailTab, setHistoryDetailTab] = useState<HistoryDetailTab>("timeline");
  const [openRosterCardId, setOpenRosterCardId] = useState("");
  const [formationTeam, setFormationTeam] = useState<1 | 2>(1);
  const [formationPlayerId, setFormationPlayerId] = useState("");
  const [draggedFormationId, setDraggedFormationId] = useState("");
  const [teamFlagUploading, setTeamFlagUploading] = useState<"" | "team1" | "team2">("");
  const [openTeamMenu, setOpenTeamMenu] = useState<"" | "team1" | "team2">("");
  const [teamRosterAction, setTeamRosterAction] = useState<{ team: "team1" | "team2"; action: TeamRosterAction } | null>(null);
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [hydrationReady, setHydrationReady] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const hydrated = useRef(false);
  const saveSequence = useRef(0);
  const lastSyncedFingerprint = useRef("");
  const stateFingerprint = sharedStateFingerprint(state);

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
      let supabaseAvailable = false;
      try {
        const stateResponse = await fetch("/api/state", { cache: "no-store" });
        if (stateResponse.ok) {
          const payload = await stateResponse.json() as { state?: unknown };
          remoteValue = payload.state ?? null;
          supabaseAvailable = true;
        }
      } catch { /* Local state remains available when the network is offline. */ }

      let legacyValue: unknown = null;
      if (!remoteValue && !localValue) {
        try {
          const legacyResponse = await fetch("/api/squad", { cache: "no-store" });
          if (legacyResponse.ok) legacyValue = await legacyResponse.json();
        } catch { /* A new installation can still use its seeded local state. */ }
      }

      const remoteTime = remoteValue && typeof remoteValue === "object" ? Number((remoteValue as { savedAt?: number }).savedAt) || 0 : 0;
      const localTime = localValue && typeof localValue === "object" ? Number((localValue as { savedAt?: number }).savedAt) || 0 : 0;
      const savedValue = remoteValue && (!unlocked || !localValue || remoteTime >= localTime) ? remoteValue : localValue;
      const restored = savedValue ? restoreState(savedValue) : legacySquadState(legacyValue) || initialState();
      if (cancelled) return;
      lastSyncedFingerprint.current = sharedStateFingerprint(restored);
      hydrated.current = true;
      setState(restored);
      setSyncStatus(supabaseAvailable ? "saved" : "offline");
      setHydrationReady(true);
    };
    void load();
    return () => { cancelled = true; };
  }, [accessChecked]);

  useEffect(() => {
    if (!unlocked || !hydrated.current || !hydrationReady || stateFingerprint === lastSyncedFingerprint.current) return;
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
        if (sequence === saveSequence.current) {
          lastSyncedFingerprint.current = stateFingerprint;
          setSyncStatus("saved");
        }
      } catch {
        if (sequence === saveSequence.current) setSyncStatus("offline");
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [hydrationReady, stateFingerprint, unlocked]);

  useEffect(() => {
    const needsClockTick = Boolean(state.match.timerStartedAt || (!state.match.startedAt && state.match.scheduledFor));
    if (state.match.st !== "Live" || !needsClockTick) return;
    const tick = () => setClockNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [state.match.scheduledFor, state.match.st, state.match.startedAt, state.match.timerStartedAt]);

  useEffect(() => {
    if (state.match.st !== "Live" || !state.match.timerStartedAt || elapsedMatchSeconds(state.match, clockNow) < MATCH_DURATION_SECONDS) return;
    setState((current) => {
      if (!current.match.timerStartedAt || elapsedMatchSeconds(current.match) < MATCH_DURATION_SECONDS) return current;
      return { ...current, match: { ...current.match, elapsedSeconds: MATCH_DURATION_SECONDS, timerStartedAt: undefined, pauseReason: "time" } };
    });
  }, [clockNow, state.match.st, state.match.timerStartedAt]);

  useEffect(() => {
    if (!accessChecked || unlocked || !hydrationReady || !supabaseBrowser) return;
    const client = supabaseBrowser;
    let disposed = false;
    let channel: ReturnType<typeof client.channel> | null = null;
    let subscriptionGeneration = 0;
    let restarting = false;
    let browserOffline = !navigator.onLine;

    const refreshFromApi = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok || disposed) return;
        const payload = await response.json() as { state?: unknown };
        if (!payload.state || disposed) return;
        const refreshed = restoreState(payload.state);
        lastSyncedFingerprint.current = sharedStateFingerprint(refreshed);
        try { localStorage.setItem("sqs1", JSON.stringify(refreshed)); } catch { /* Realtime still updates memory if browser storage is unavailable. */ }
        setState((current) => ({ ...refreshed, tab: current.tab, sub: current.sub }));
        setSyncStatus("saved");
      } catch { /* The existing screen remains usable while Realtime reconnects. */ }
    };

    const subscribe = () => {
      const generation = ++subscriptionGeneration;
      channel = client
        .channel("squad-sheet-state")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "squad_settings", filter: "id=eq.1" },
          () => {
            if (disposed || generation !== subscriptionGeneration) return;
            void refreshFromApi();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cricket_players" },
          () => {
            if (disposed || generation !== subscriptionGeneration) return;
            void refreshFromApi();
          },
        )
        .subscribe((status) => {
          if (disposed || generation !== subscriptionGeneration) return;
          if (status === "SUBSCRIBED") {
            browserOffline = false;
            setSyncStatus("saved");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setSyncStatus(browserOffline ? "offline" : "reconnecting");
          }
        });
    };

    const restartSubscription = async () => {
      if (disposed || restarting) return;
      restarting = true;
      setSyncStatus("reconnecting");
      const staleChannel = channel;
      channel = null;
      ++subscriptionGeneration;
      if (staleChannel) await client.removeChannel(staleChannel);
      if (!disposed) subscribe();
      restarting = false;
    };

    subscribe();
    const handleOffline = () => {
      browserOffline = true;
      setSyncStatus("offline");
    };
    const handleOnline = () => {
      browserOffline = false;
      void restartSubscription();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && (!client.realtime.isConnected() || channel?.state !== "joined")) {
        void restartSubscription();
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      ++subscriptionGeneration;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) void client.removeChannel(channel);
    };
  }, [accessChecked, hydrationReady, unlocked]);

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

  function PlayerCard({ item, children, compact = false, positionOverride, flagOverride, flagLabel }: { item: Player; children?: React.ReactNode; compact?: boolean; positionOverride?: string; flagOverride?: string | null; flagLabel?: string }) {
    const design = CARD_STYLES.find((style) => style.id === item.cardStyle) || CARD_STYLES[0];
    const hasFlagOverride = flagOverride !== undefined;
    const visibleFlag = hasFlagOverride ? flagOverride || "" : item.flag;
    const flagSrc = flagImageSource(visibleFlag, 40);
    const playerFlagSrc = flagImageSource(item.flag, 40);
    const skills = playerSkills(item);
    const featuredSkill = primarySkill(item);
    const badgeSrc = SKILL_BADGES[featuredSkill] || "/badges/squad-sheet-fc.png";
    const secondarySkills = skills.filter((skill) => skill !== featuredSkill);
    const cardStats = generatedCardStats(item);
    const overall = positionOverall(item, positionOverride) ?? "–";
    return <article className={`player-card${item.on === false ? " is-inactive" : ""}${compact ? " is-compact" : ""}`}>
      <div className={`player-card__visual card-theme-${design.id}`}>
        <img className="player-card__frame" src={item.image ? design.cleanSrc : design.src} alt="" aria-hidden="true" />
        <div className="player-card__strip"><strong>{overall}</strong><span>{defaultPosition(item)}</span><span className={`player-card__flag${hasFlagOverride ? " is-team-flag match-card-flag" : ""}`} title={hasFlagOverride ? "Team flag · hover to see player flag" : undefined}>{hasFlagOverride ? <><span className="match-card-flag__layer is-team">{flagSrc ? <img src={flagSrc} alt={`${flagLabel || "Team"} flag`} /> : initials(flagLabel || "Team")}</span><span className="match-card-flag__layer is-player">{playerFlagSrc ? <img src={playerFlagSrc} alt={`${flagCountryCode(item.flag) || item.name} flag`} /> : flagEmoji(item.flag)}</span></> : flagSrc ? <img src={flagSrc} alt={`${flagCountryCode(visibleFlag) || item.name} flag`} /> : flagEmoji(visibleFlag)}</span><img src={badgeSrc} alt={featuredSkill ? `${featuredSkill} skill badge` : "Squad Sheet FC badge"} /></div>
        {secondarySkills.length > 0 && <div className="player-card__skill-stack" aria-label={`Other skills: ${secondarySkills.join(", ")}`}>{secondarySkills.map((skill) => <img key={skill} src={SKILL_BADGES[skill]} alt={`${skill} skill`} title={skill} />)}</div>}
        {positionOverride && <span className="player-card__lineup-position" title={`Assigned team position: ${positionOverride}`}>{positionOverride}</span>}
        <div className="player-card__photo">
          {item.image && <PlayerPhoto src={item.image} alt={`${item.name} portrait`} />}
        </div>
        <div className="player-card__identity"><h3 className={item.name.length > 18 ? "is-long" : item.name.length > 13 ? "is-medium" : ""} title={item.name}>{item.name}</h3><p>{skills.join(" · ") || "Footballer"}</p></div>
        <div className="player-card__stats">{cardStats.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      </div>
      <div className="player-card__meta"><span>{item.customOverall ? `${item.customOverall} custom OVR` : item.rating ? `${item.rating}/10 rating` : "Not rated"}</span><span>{item.on === false ? "Inactive" : "Active"}</span></div>
      {children && <div className="player-card__actions">{children}</div>}
    </article>;
  }

  function RosterRow({ item, captain = false, lineupPosition, flagOverride, flagLabel, children, rowKey, onPlayerClick, selecting = false }: { item: Player; captain?: boolean; lineupPosition?: string; flagOverride?: string | null; flagLabel?: string; children?: React.ReactNode; rowKey?: React.Key; onPlayerClick?: () => void; selecting?: boolean }) {
    const open = openRosterCardId === item.id;
    const currentOverall = positionOverall(item, lineupPosition);
    return <div className={`roster-entry${open ? " is-open" : ""}${selecting ? " is-selecting" : ""}`} key={rowKey}>
      <div className="roster-row">
        <button className="roster-player-button" onClick={() => onPlayerClick ? onPlayerClick() : setOpenRosterCardId(open ? "" : item.id)} aria-expanded={onPlayerClick ? undefined : open}>
          <span className="roster-avatar">{item.image ? <img src={item.image} alt="" /> : initials(item.name)}</span>
          <span className="roster-copy"><strong>{item.name}{captain && <span className="cp"> (C)</span>}</strong><small>{lineupPosition || defaultPosition(item)} · {currentOverall ?? "–"} OVR · {specialityLabel(item)}</small></span>
          <span className="roster-chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
        </button>
        {children && <div className="roster-actions">{children}</div>}
      </div>
      {open && <div className="roster-card-preview">{PlayerCard({ item, compact: true, positionOverride: lineupPosition, flagOverride, flagLabel })}</div>}
    </div>;
  }

  function Squad({ ids, title }: { ids: string[]; title: string }) {
    return <div className="sec simple-squad"><h2>{title}</h2><div className="roster-list">{ids.map((id) => {
      const item = player(id); if (!item) return null;
      const captain = state.team?.captain === id || state.balancedTeams?.team1.captain === id || state.balancedTeams?.team2.captain === id;
      const assignedTeam = state.balancedTeams?.team1.ids.includes(id) ? state.balancedTeams.team1 : state.balancedTeams?.team2.ids.includes(id) ? state.balancedTeams.team2 : undefined;
      const lineupPosition = assignedTeam?.positions[id] || defaultPosition(item);
      return RosterRow({ item, captain, lineupPosition, flagOverride: assignedTeam?.flag || null, flagLabel: assignedTeam?.name, rowKey: id });
    })}</div></div>;
  }

  function FormationBoard(useTeamFlags = false) {
    if (!state.balancedTeams) return null;
    const selected = formationTeam === 1 ? state.balancedTeams.team1 : state.balancedTeams.team2;
    const substituteIds = selected.substitutes || [];
    const starterIds = selected.ids.filter((id) => !substituteIds.includes(id));
    const selectedPlayer = selected.ids.includes(formationPlayerId) ? player(formationPlayerId) : undefined;
    const liveTeamFlag = useTeamFlags ? selected.flag || null : undefined;
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
    const slotPlacements = placeItems(slotItems).map((slot) => ({ ...slot, occurrence: Number(slot.id.split("-").at(-1) || 0), occupantId: starterIds.filter((id) => (selected.positions[id] || defaultPosition(player(id)!)) === slot.position)[Number(slot.id.split("-").at(-1) || 0)] || "" }));
    const occupiedSlotIds = new Set(slotPlacements.map((slot) => slot.occupantId).filter(Boolean));
    const positioned = starterIds.map((id) => ({ id, position: selected.positions[id] || defaultPosition(player(id) || { id, name: "Player", rating: 0, spec: "" }) }));
    const placements = [
      ...slotPlacements.filter((slot) => slot.occupantId).map((slot) => ({ id: slot.occupantId, position: slot.position, x: slot.x, y: slot.y })),
      ...placeItems(positioned.filter((item) => !occupiedSlotIds.has(item.id))),
    ];
    const moveFormationPlayer = (id: string, position: string, occupantId = "") => {
      if (!unlocked || !id || !starterIds.includes(id)) return;
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
    const matchMarks = (id: string) => {
      const goals = state.match.ev.filter((goal) => goal.s === id).length;
      const assists = state.match.ev.filter((goal) => goal.a === id).length;
      const incidents = state.match.incidents || [];
      const yellows = incidents.filter((incident) => incident.type === "yellow" && incident.playerId === id).length;
      const subbedOn = incidents.some((incident) => incident.type === "substitution" && incident.playerInId === id);
      const subbedOff = incidents.some((incident) => incident.type === "substitution" && incident.playerOutId === id);
      if (!goals && !assists && !yellows && !subbedOn && !subbedOff) return null;
      return <span className="formation-event-badges">{subbedOn && <i className="event-sub-on" title="Substituted on">↑</i>}{subbedOff && <i className="event-sub-off" title="Substituted off">↓</i>}{goals > 0 && <MatchEventBadge kind="goal" count={goals} title={`${goals} goal${goals === 1 ? "" : "s"}`} />}{assists > 0 && <MatchEventBadge kind="assist" count={assists} title={`${assists} assist${assists === 1 ? "" : "s"}`} />}{yellows >= 3 ? <MatchEventBadge kind="red-card" title="Red card after 3 yellow cards" /> : yellows > 0 ? <MatchEventBadge kind="yellow-card" count={yellows} title={`${yellows} yellow card${yellows === 1 ? "" : "s"}`} /> : null}</span>;
    };
    const miniCard = ({ id, x, y }: { id: string; x: number; y: number }) => {
      const item = player(id); if (!item) return null;
      const design = CARD_STYLES.find((style) => style.id === item.cardStyle) || CARD_STYLES[0];
      const assignedPosition = selected.positions[id] || defaultPosition(item);
      return <button type="button" draggable={unlocked} className={`formation-mini-card${formationPlayerId === id ? " is-selected" : ""}${draggedFormationId === id ? " is-dragging" : ""}`} style={{ "--formation-x": `${x}%`, "--formation-y": `${y}%` } as React.CSSProperties} key={id} onDragStart={(event) => { if (!unlocked) return; setDraggedFormationId(id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); }} onDragEnd={() => setDraggedFormationId("")} onDragOver={(event) => { if (unlocked && draggedFormationId && draggedFormationId !== id) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); moveFormationPlayer(event.dataTransfer.getData("text/plain") || draggedFormationId, assignedPosition, id); }} onClick={() => unlocked && draggedFormationId && draggedFormationId !== id ? moveFormationPlayer(draggedFormationId, assignedPosition, id) : setFormationPlayerId(formationPlayerId === id ? "" : id)} aria-label={`View ${item.name} card, ${assignedPosition}`}>
        <img className="formation-mini-frame" src={item.image ? design.cleanSrc : design.src} alt="" />
        {item.image && <PlayerPhoto className="formation-mini-photo" src={item.image} alt="" />}
        <span className="formation-mini-overall">{positionOverall(item, assignedPosition) ?? "–"}</span>
        <span className="formation-mini-position">{assignedPosition}</span>
        <span className="formation-mini-name">{item.name}</span>
        {selected.captain === id && <span className="formation-mini-captain">C</span>}
        {matchMarks(id)}
      </button>;
    };
    return <section className="formation-board">
      <div className="formation-board-head"><div><h2>Formation map</h2><p>{selected.name} · {starterIds.length}/11 starters{substituteIds.length ? ` · ${substituteIds.length} on bench` : ""} · {unlocked ? "Drag cards to move or swap" : "Select a card to view player details"}</p></div><div className="formation-team-tabs"><button className={formationTeam === 1 ? "on" : ""} onClick={() => { setFormationTeam(1); setFormationPlayerId(""); setDraggedFormationId(""); }}>{state.balancedTeams.team1.name}</button><button className={formationTeam === 2 ? "on" : ""} onClick={() => { setFormationTeam(2); setFormationPlayerId(""); setDraggedFormationId(""); }}>{state.balancedTeams.team2.name}</button></div></div>
      <div className={`formation-stage${selectedPlayer ? " has-selection" : ""}`}><div><div className={`formation-pitch${draggedFormationId ? " is-moving" : ""}`}><span className="pitch-box pitch-box-top" /><span className="pitch-box pitch-box-bottom" />{slotPlacements.map((slot) => <button type="button" className="formation-slot" style={{ "--formation-x": `${slot.x}%`, "--formation-y": `${slot.y}%` } as React.CSSProperties} key={slot.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); moveFormationPlayer(event.dataTransfer.getData("text/plain") || draggedFormationId, slot.position, slot.occupantId); }} onClick={() => draggedFormationId && moveFormationPlayer(draggedFormationId, slot.position, slot.occupantId)} aria-label={`Move selected player to ${slot.position}`}><span>{slot.position}</span></button>)}{placements.map(miniCard)}</div>{substituteIds.length > 0 && <div className="formation-bench"><strong>Substitutes</strong><div>{substituteIds.map((id) => { const item = player(id); if (!item) return null; return <button key={id} onClick={() => setFormationPlayerId(formationPlayerId === id ? "" : id)}><span className="bench-avatar">{item.image ? <img src={item.image} alt="" /> : initials(item.name)}</span><span>{item.name}</span>{matchMarks(id)}</button>; })}</div></div>}</div>
      {selectedPlayer && <aside className="formation-selected-card"><div className="formation-selected-head"><span>{selectedPlayer.name} · {substituteIds.includes(selectedPlayer.id) ? "Substitute" : selected.positions[selectedPlayer.id] || defaultPosition(selectedPlayer)}</span><div className="formation-move-actions">{unlocked && !substituteIds.includes(selectedPlayer.id) && <button className={`b sm ${draggedFormationId === selectedPlayer.id ? "pri" : "line"}`} onClick={() => setDraggedFormationId(draggedFormationId === selectedPlayer.id ? "" : selectedPlayer.id)}>{draggedFormationId === selectedPlayer.id ? "Cancel move" : "Move"}</button>}<button className="b line sm" onClick={() => { setFormationPlayerId(""); setDraggedFormationId(""); }}>Close</button></div></div>{PlayerCard({ item: selectedPlayer, compact: true, positionOverride: substituteIds.includes(selectedPlayer.id) ? undefined : selected.positions[selectedPlayer.id], flagOverride: liveTeamFlag, flagLabel: selected.name })}</aside>}</div>
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
          team1: { name: current.balancedTeams?.team1.name || "Team 1", flag: current.balancedTeams?.team1.flag, ids: result.first, captain: pickCaptain || result.first[0], positions: firstPositions },
          team2: { name: current.balancedTeams?.team2.name || "Team 2", flag: current.balancedTeams?.team2.flag, ids: result.second, captain: pickCaptainTwo || result.second[0], positions: secondPositions },
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
      const rated = roster.filter((item) => displayedOverall(item) !== null);
      if (!rated.length) return { roster, text: "No rated players yet" };
      const averageOverall = Math.round(rated.reduce((sum, item) => sum + (displayedOverall(item) || 0), 0) / rated.length * 10) / 10;
      const labels = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"];
      const attributes = labels.map((label) => {
        const values = rated.map((item) => Number(generatedCardStats(item).find(([name]) => name === label)?.[1])).filter(Number.isFinite);
        return `${label} ${values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : "–"}`;
      }).join(" · ");
      return { roster, text: `Avg OVR ${averageOverall} · ${attributes}` };
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
      {active.some((item) => displayedOverall(item) === null) && <p className="note">Unrated players use the rated squad average for balancing. Rate them for a more accurate split.</p>}
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
      {active.some((item) => displayedOverall(item) === null) && <p className="note">Some active players are not rated yet, so auto-pick puts them last. Use Rate on the Players tab.</p>}
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
    const averageTeamOverall = (ids: string[]) => {
      const ratings = ids.map(player).filter((item): item is Player => Boolean(item)).map(displayedOverall).filter((value): value is number => value !== null);
      return ratings.length ? Math.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length * 10) / 10 : null;
    };
    const team1Average = saved ? averageTeamOverall(saved.team1.ids) : null;
    const team2Average = saved ? averageTeamOverall(saved.team2.ids) : null;
    const averageGap = team1Average !== null && team2Average !== null ? Math.round(Math.abs(team1Average - team2Average) * 10) / 10 : null;
    const balanceReady = unassigned.length === 0 && averageGap !== null && team1Average !== null && team2Average !== null;
    const teamsUnbalanced = balanceReady && averageGap >= 2;
    const strongerTeamName = saved && team1Average !== null && team2Average !== null
      ? team1Average >= team2Average ? saved.team1.name || "Team 1" : saved.team2.name || "Team 2"
      : "";

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
          team1: { name: current.balancedTeams?.team1.name || "Team 1", flag: current.balancedTeams?.team1.flag, ids: result.first, captain: captain1, positions: firstPositions },
          team2: { name: current.balancedTeams?.team2.name || "Team 2", flag: current.balancedTeams?.team2.flag, ids: result.second, captain: captain2, positions: secondPositions },
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
          team1: { name: current.balancedTeams?.team1.name || "Team 1", flag: current.balancedTeams?.team1.flag, ids: [captain1], captain: captain1, positions: { [captain1]: "GK" } },
          team2: { name: current.balancedTeams?.team2.name || "Team 2", flag: current.balancedTeams?.team2.flag, ids: [captain2], captain: captain2, positions: { [captain2]: "GK" } },
          seed: rosterBalanceSeed(active),
          cost: -1,
        },
      }));
    };

    const updateTeam = (team: "team1" | "team2", patch: Partial<BalancedTeam>) => setState((current) => {
      if (!current.balancedTeams) return current;
      return { ...current, balancedTeams: { ...current.balancedTeams, [team]: { ...current.balancedTeams[team], ...patch } } };
    });

    const changeCaptain = (team: "team1" | "team2", id: string) => setState((current) => {
      if (!current.balancedTeams) return current;
      const selected = current.balancedTeams[team];
      if (!selected.ids.includes(id) || (selected.substitutes || []).includes(id)) return current;
      return {
        ...current,
        team: team === "team1" && current.team ? { ...current.team, captain: id } : current.team,
        balancedTeams: { ...current.balancedTeams, [team]: { ...selected, captain: id } },
      };
    });

    const changeTeamFlag = async (team: "team1" | "team2", file?: File) => {
      if (!file) return;
      setTeamFlagUploading(team);
      try {
        updateTeam(team, { flag: await uploadTeamFlag(file) });
      } catch (reason) {
        window.alert(reason instanceof Error ? reason.message : "The team flag could not be uploaded.");
      } finally {
        setTeamFlagUploading("");
      }
    };

    const toggleSubstitute = (team: "team1" | "team2", id: string) => {
      if (!saved) return;
      const selected = saved[team];
      const substitutes = selected.substitutes || [];
      const isSubstitute = substitutes.includes(id);
      if (!isSubstitute && selected.captain === id) { window.alert("Choose another captain before moving this player to the bench."); return; }
      const starterCount = selected.ids.length - substitutes.length;
      if (isSubstitute && starterCount >= 11) { window.alert("A lineup can have at most 11 starters."); return; }
      updateTeam(team, { substitutes: isSubstitute ? substitutes.filter((playerId) => playerId !== id) : [...substitutes, id] });
    };

    const chooseTeamAction = (team: "team1" | "team2", action: TeamRosterAction) => {
      setOpenRosterCardId("");
      setOpenTeamMenu("");
      setTeamRosterAction({ team, action });
    };

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
          [source]: { ...current.balancedTeams[source], ids: sourceIds, positions: positionsFor(sourceIds), substitutes: (current.balancedTeams[source].substitutes || []).filter((playerId) => playerId !== id) },
          [destination]: { ...current.balancedTeams[destination], ids: destinationIds, positions: positionsFor(destinationIds), substitutes: (current.balancedTeams[destination].substitutes || []).filter((playerId) => playerId !== id) },
        },
      };
    });

    const applyTeamAction = (team: "team1" | "team2", id: string) => {
      if (!teamRosterAction || teamRosterAction.team !== team) return;
      const selected = saved?.[team];
      const isSubstitute = Boolean(selected?.substitutes?.includes(id));
      if (teamRosterAction.action === "captain" && isSubstitute) { window.alert("Choose a starting player as captain."); return; }
      if (teamRosterAction.action === "bench" && selected?.captain === id && !isSubstitute) { window.alert("Choose another captain before moving this player to the bench."); return; }
      if (teamRosterAction.action === "move" && selected?.captain === id) { window.alert("Choose another captain before moving this player to the other team."); return; }
      if (teamRosterAction.action === "captain") changeCaptain(team, id);
      if (teamRosterAction.action === "bench") toggleSubstitute(team, id);
      if (teamRosterAction.action === "move") assignPlayer(id, team === "team1" ? "team2" : "team1");
      setTeamRosterAction(null);
    };

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

    const hostMatch = (scheduledFor?: string) => {
      if (!saved || unassigned.length) return;
      setState((current) => ({
        ...current,
        tab: "match",
        sub: "timeline",
        team: { ids: saved.team1.ids, captain: saved.team1.captain },
        pool: null,
        match: { us: saved.team1.name || "Team 1", opp: saved.team2.name || "Team 2", them: 0, ev: [], incidents: [], motm: "", st: "Live", scheduledFor, elapsedSeconds: 0, halfTimeTaken: false, pauseReason: "" },
      }));
      setShowGoal(false);
      setScheduleInput("");
    };

    const scheduleMatch = () => {
      const kickoff = new Date(scheduleInput);
      if (!scheduleInput || !Number.isFinite(kickoff.getTime())) { window.alert("Choose a kickoff date and time first."); return; }
      hostMatch(kickoff.toISOString());
    };

    const teamCard = (key: "team1" | "team2") => {
      if (!saved) return null;
      const team = saved[key];
      const other = key === "team1" ? "team2" : "team1";
      const number = key === "team1" ? 1 : 2;
      const roster = sortPlayers(team.ids.map(player).filter((item): item is Player => Boolean(item)));
      const substitutes = team.substitutes || [];
      const starterIds = team.ids.filter((id) => !substitutes.includes(id));
      const average = key === "team1" ? team1Average : team2Average;
      const activeAction = teamRosterAction?.team === key ? teamRosterAction.action : null;
      const actionPrompt = activeAction === "captain" ? "Choose the new captain" : activeAction === "bench" ? "Choose a player to move to or from the bench" : activeAction === "move" ? `Choose a player to move to ${saved[other].name || `Team ${number === 1 ? 2 : 1}`}` : "";
      return <div className="card balanced-team-card">
        {unlocked ? <div className="team-identity-fields"><div><label htmlFor={`team-name-${number}`}>Team {number} name</label><input id={`team-name-${number}`} value={team.name} onChange={(event) => updateTeam(key, { name: event.target.value })} /></div><div><div className="team-flag-heading"><label htmlFor={`team-flag-${number}`}>Team flag</label><div className="team-action-menu"><button type="button" className="b line sm team-menu-trigger" aria-label={`Open ${team.name || `Team ${number}`} actions`} aria-expanded={openTeamMenu === key} onClick={() => setOpenTeamMenu((current) => current === key ? "" : key)}>⋯</button>{openTeamMenu === key && <div className="team-action-menu__list"><button type="button" onClick={() => chooseTeamAction(key, "captain")}>Change captain</button><button type="button" disabled={Boolean(state.match.startedAt)} onClick={() => chooseTeamAction(key, "bench")}>Starter / bench</button><button type="button" disabled={unassigned.length > 0 || Boolean(state.match.startedAt)} onClick={() => chooseTeamAction(key, "move")}>Move to {saved[other].name || `Team ${number === 1 ? 2 : 1}`}</button></div>}</div></div><div className="team-flag-field"><TeamMark name={team.name} flag={team.flag} className="team-flag-preview" /><div className="team-flag-actions"><label className="b line sm photo-button">{teamFlagUploading === key ? "Uploading…" : team.flag ? "Replace PNG" : "Upload PNG"}<input id={`team-flag-${number}`} type="file" accept="image/png,.png" disabled={Boolean(teamFlagUploading)} onChange={(event) => { const file = event.target.files?.[0]; void changeTeamFlag(key, file); event.target.value = ""; }} /></label>{team.flag && <button type="button" className="b line sm" disabled={Boolean(teamFlagUploading)} onClick={() => updateTeam(key, { flag: "" })}>Remove</button>}</div></div></div></div> : <h3 className="public-team-name"><TeamMark name={team.name} flag={team.flag} className="team-name-flag" />{team.name}</h3>}
        {activeAction && <div className="team-action-prompt"><span>{actionPrompt}, then click their name.</span><button type="button" onClick={() => setTeamRosterAction(null)}>Cancel</button></div>}
        <p className="note">{roster.length} player{roster.length === 1 ? "" : "s"}{average !== null ? ` · Avg ${average} OVR` : ""}</p>
        <p className="formation-label">Formation: {formationLabel(Object.fromEntries(Object.entries(team.positions).filter(([id]) => starterIds.includes(id))))}{substitutes.length ? ` · ${substitutes.length} substitute${substitutes.length === 1 ? "" : "s"}` : ""}</p>
        <div className="roster-list">{roster.map((item) => { const isSubstitute = substitutes.includes(item.id); return RosterRow({ item, captain: team.captain === item.id, lineupPosition: team.positions[item.id] || defaultPosition(item), flagOverride: team.flag || null, flagLabel: team.name, rowKey: item.id, selecting: Boolean(activeAction), onPlayerClick: activeAction ? () => applyTeamAction(key, item.id) : undefined, children: unlocked ? <><span className={`lineup-role${isSubstitute ? " is-sub" : ""}`}>{isSubstitute ? "SUB" : "XI"}</span><select className="lineup-position-select" aria-label={`${item.name} lineup position`} value={team.positions[item.id] || defaultPosition(item)} onChange={(event) => updateLineupPosition(key, item.id, event.target.value)}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></> : <span className={`lineup-role${isSubstitute ? " is-sub" : ""}`}>{isSubstitute ? "SUB" : "XI"}</span> }); })}</div>
      </div>;
    };

    return <>
      {unlocked ? <div className="sec"><h2>Set up two teams</h2><p className="note">Choose two captains, then balance every active player by base OVR only. Positions are optimized separately after both rosters are fixed.</p>
        <div className="row2 captain-selects"><div><label htmlFor="captain-one">Team 1 captain</label><select id="captain-one" value={captain1} disabled={Boolean(saved)} onChange={(event) => setPickCaptain(event.target.value)}><option value="">Choose captain…</option>{sortPlayers(active).filter((item) => item.id !== captain2).map((item) => <option value={item.id} key={item.id}>{item.name} ({ratingLabel(item)})</option>)}</select></div><div><label htmlFor="captain-two">Team 2 captain</label><select id="captain-two" value={captain2} disabled={Boolean(saved)} onChange={(event) => setPickCaptainTwo(event.target.value)}><option value="">Choose captain…</option>{sortPlayers(active).filter((item) => item.id !== captain1).map((item) => <option value={item.id} key={item.id}>{item.name} ({ratingLabel(item)})</option>)}</select></div></div>
        {!saved ? <div className="button-row"><button className="b pri" disabled={active.length < 2} onClick={() => generateTeams(false)}>Auto-pick balanced teams</button><button className="b line" disabled={active.length < 2} onClick={startManualPick}>Pick manually</button></div> : <div className="button-row"><button className="b" onClick={() => generateTeams(true)}>Shuffle again</button><button className="b line" onClick={deleteTeams}>Delete generated teams</button></div>}
        {active.some((item) => displayedOverall(item) === null) && <p className="note">Unrated players use the squad average. Add ratings for a more accurate automatic split.</p>}
      </div> : !saved && <div className="sec"><h2>No teams yet</h2><p className="empty">An admin can log in and create the next two teams.</p></div>}
      {saved && <div className="sec top-rule"><h2>{unlocked ? "Edit teams and positions" : "Teams"}</h2><p className="note">{unlocked ? "After OVR-balanced teams are chosen, positions maximize lineup OVR while covering goalkeeper, defence and attack. Captains stay on their selected side." : "View the current squads, formations and player cards."}</p>
        {unassigned.length > 0 && <div className="draft-arena" aria-live="polite"><div className={`draft-captain draft-captain-left${draftTeam === "team1" ? " is-turn" : ""}`}><span className="draft-hand">✋</span><strong>{player(saved.team1.captain)?.name || saved.team1.name}</strong><small>{draftTeam === "team1" ? "Picking now" : "Waiting"}</small></div><div className="draft-ball">⚽</div><div className={`draft-captain draft-captain-right${draftTeam === "team2" ? " is-turn" : ""}`}><span className="draft-hand">✋</span><strong>{player(saved.team2.captain)?.name || saved.team2.name}</strong><small>{draftTeam === "team2" ? "Picking now" : "Waiting"}</small></div><p><strong>{draftCaptain?.name || saved[draftTeam].name}&apos;s turn</strong> · choose one player</p></div>}
        <div className="row2 balanced-team-grid">{teamCard("team1")}{teamCard("team2")}</div>
        {balanceReady && <div className={`team-balance-status${teamsUnbalanced ? " is-warning" : " is-balanced"}`} role={teamsUnbalanced ? "alert" : "status"}><strong>{teamsUnbalanced ? "Teams are not balanced" : "Teams are balanced"}</strong><span>{saved.team1.name || "Team 1"}: {team1Average?.toFixed(1)} OVR · {saved.team2.name || "Team 2"}: {team2Average?.toFixed(1)} OVR · Difference: {averageGap?.toFixed(1)} OVR.</span>{teamsUnbalanced && <span>{strongerTeamName} is stronger. Shuffle again or move players between the teams.</span>}<details className="team-balance-info"><summary aria-label="Show team balance rule"><span aria-hidden="true">ⓘ</span> Balance rule</summary><p>A “Teams are not balanced” warning appears when the average OVR differs by 2.0 or more.</p></details></div>}
        {FormationBoard(true)}
        {unassigned.length > 0 && <div className="unassigned-card"><h2>Players waiting to be picked · {unassigned.length}</h2><p className="note">Captains take turns. Only the captain whose hand is highlighted can make the next pick.</p><div className="roster-list">{unassigned.map((item) => RosterRow({ item, rowKey: item.id, children: unlocked ? <button className="b sm pri" onClick={() => assignPlayer(item.id, draftTeam)}>Pick for {draftCaptain?.name || saved[draftTeam].name}</button> : undefined }))}</div></div>}
        {unlocked && !state.team?.ids.length && <div className="match-host-card"><h3>Host this match</h3><p className="note">Start it today, or choose a kickoff time. The 90-minute clock only begins when an admin presses Start match.</p><div className="button-row"><button className="b pri" disabled={unassigned.length > 0 || !saved.team1.ids.length || !saved.team2.ids.length} onClick={() => hostMatch()}>Host now</button></div><label htmlFor="match-kickoff">Schedule kickoff</label><div className="schedule-row"><input id="match-kickoff" type="datetime-local" value={scheduleInput} onChange={(event) => setScheduleInput(event.target.value)} /><button className="b line" disabled={unassigned.length > 0 || !saved.team1.ids.length || !saved.team2.ids.length || !scheduleInput} onClick={scheduleMatch}>Schedule match</button></div></div>}
        {unlocked && state.team?.ids.length && <div className="match-host-card"><h3>Match already hosted</h3><p className="note">Finish or delete the current match before hosting another one.</p><button className="b pri" onClick={() => setTab("match")}>Open current match</button></div>}
        {unlocked && unassigned.length > 0 && <p className="note">Complete the captain draft before hosting or scheduling the match.</p>}
      </div>}
    </>;
  }

  function MatchView() {
    if (!state.team?.ids.length || state.match.st !== "Live") return <><div className="sec"><h2>No active match</h2><p className="empty">Your teams are ready. Host a match when everyone is ready to play.</p><button className="b pri" onClick={() => setTab("team")}>{state.balancedTeams ? "Review teams and host match" : "Set up teams"}</button></div>{HistoryView()}</>;
    const match = state.match;
    const team1Goals = match.ev.filter((goal) => goal.team !== 2).length;
    const team2Goals = match.them + match.ev.filter((goal) => goal.team === 2).length;
    const elapsed = elapsedMatchSeconds(match, clockNow);
    const started = Boolean(match.startedAt);
    const running = started && Boolean(match.timerStartedAt) && elapsed < MATCH_DURATION_SECONDS;
    const scheduled = !started && Boolean(match.scheduledFor);
    const kickoffDue = !scheduled || Date.parse(match.scheduledFor || "") <= clockNow;
    const kickoffDelay = scheduled && kickoffDue ? formatKickoffDelay(match.scheduledFor || "", clockNow) : "";
    const timeComplete = started && elapsed >= MATCH_DURATION_SECONDS;
    const statusText = scheduled
      ? kickoffDue ? `Kickoff delayed · ${kickoffDelay}` : `Scheduled · ${formatKickoff(match.scheduledFor)}`
      : !started ? "Ready to start"
      : running ? `Live · ${formatMatchClock(elapsed)}`
      : match.pauseReason === "half-time" ? `Half-time · ${formatMatchClock(elapsed)}`
      : timeComplete ? `90 minutes · ${formatMatchClock(elapsed)}`
      : `Paused · ${formatMatchClock(elapsed)}`;
    const scorerLines = (teamNumber: 1 | 2) => Object.entries(match.ev.filter((goal) => (goal.team || 1) === teamNumber).reduce<Record<string, (number | null)[]>>((result, goal) => { (result[goal.s] ||= []).push(goal.m); return result; }, {}));
    const balancedTeamFor = (teamNumber: 1 | 2) => teamNumber === 1 ? state.balancedTeams?.team1 : state.balancedTeams?.team2;
    const rosterIdsFor = (teamNumber: 1 | 2) => teamNumber === 1 ? state.team?.ids || [] : state.balancedTeams?.team2.ids || [];
    const substituteIdsFor = (teamNumber: 1 | 2) => balancedTeamFor(teamNumber)?.substitutes || [];
    const onFieldIdsFor = (teamNumber: 1 | 2) => rosterIdsFor(teamNumber).filter((id) => !substituteIdsFor(teamNumber).includes(id));
    const scoringIds = onFieldIdsFor(goalTeam);
    const matchEventPlayerIds = onFieldIdsFor(matchEventTeam);
    const yellowCountForPlayer = (id: string) => (state.match.incidents || []).filter((incident) => incident.type === "yellow" && incident.playerId === id).length;
    const yellowCardPlayerIds = matchEventPlayerIds.filter((id) => yellowCountForPlayer(id) < 3);
    const matchEventSubstituteIds = substituteIdsFor(matchEventTeam);
    const anySubstitutes = substituteIdsFor(1).length > 0 || substituteIdsFor(2).length > 0;
    const startMatchClock = () => {
      if (scheduled && !kickoffDue) return;
      const now = Date.now();
      setClockNow(now);
      setState((current) => ({ ...current, match: { ...current.match, startedAt: now, timerStartedAt: now, elapsedSeconds: 0, halfTimeTaken: false, pauseReason: "" } }));
    };
    const pauseMatchClock = (reason: MatchPauseReason) => setState((current) => {
      if (!current.match.startedAt) return current;
      const seconds = elapsedMatchSeconds(current.match);
      return { ...current, match: { ...current.match, elapsedSeconds: seconds, timerStartedAt: undefined, pauseReason: seconds >= MATCH_DURATION_SECONDS ? "time" : reason } };
    });
    const resumeMatchClock = () => {
      const now = Date.now();
      setClockNow(now);
      setState((current) => current.match.startedAt && elapsedMatchSeconds(current.match) < MATCH_DURATION_SECONDS
        ? { ...current, match: { ...current.match, elapsedSeconds: elapsedMatchSeconds(current.match), timerStartedAt: now, pauseReason: "" } }
        : current);
    };
    const takeHalfTime = () => setState((current) => {
      if (!current.match.startedAt || current.match.halfTimeTaken) return current;
      const seconds = elapsedMatchSeconds(current.match);
      if (seconds < HALF_TIME_SECONDS || seconds >= MATCH_DURATION_SECONDS) return current;
      return { ...current, match: { ...current.match, elapsedSeconds: seconds, timerStartedAt: undefined, halfTimeTaken: true, pauseReason: "half-time" } };
    });
    const addGoal = () => {
      if (!started) return;
      const scorer = (document.getElementById("gs") as HTMLSelectElement).value;
      const assist = (document.getElementById("ga") as HTMLSelectElement).value;
      const minute = Number.parseInt((document.getElementById("gm") as HTMLInputElement).value);
      const kind = (document.getElementById("goal-kind") as HTMLSelectElement)?.value === "penalty" ? "penalty" : "goal";
      if (assist && assist === scorer) { window.alert("Scorer and assist must be different players."); return; }
      setState((current) => ({ ...current, match: { ...current.match, ev: [...current.match.ev, { s: scorer, a: assist, m: minute >= 0 && minute <= 130 ? minute : null, team: goalTeam, kind, message: Math.floor(Math.random() * GOAL_MESSAGES.length) }] } })); setShowGoal(false);
    };
    const eventMinute = () => {
      const value = Number.parseInt((document.getElementById("match-event-minute") as HTMLInputElement)?.value || "");
      return value >= 0 && value <= 130 ? value : null;
    };
    const addYellowCard = () => {
      const playerId = (document.getElementById("match-event-player") as HTMLSelectElement)?.value;
      if (!playerId) return;
      const incident: MatchIncident = { id: `y${Date.now()}${Math.random().toString(36).slice(2, 5)}`, type: "yellow", playerId, team: matchEventTeam, m: eventMinute(), message: Math.floor(Math.random() * INCIDENT_MESSAGE_STYLES.length) };
      setState((current) => {
        const existingCards = (current.match.incidents || []).filter((item) => item.type === "yellow" && item.playerId === playerId).length;
        if (existingCards >= 3) return current;
        return { ...current, match: { ...current.match, incidents: [...(current.match.incidents || []), incident] } };
      });
      setMatchEventEditor("");
    };
    const addSubstitution = () => {
      const playerOutId = (document.getElementById("sub-player-out") as HTMLSelectElement)?.value;
      const playerInId = (document.getElementById("sub-player-in") as HTMLSelectElement)?.value;
      if (!playerOutId || !playerInId || playerOutId === playerInId) return;
      const incident: MatchIncident = { id: `s${Date.now()}${Math.random().toString(36).slice(2, 5)}`, type: "substitution", playerOutId, playerInId, team: matchEventTeam, m: eventMinute(), message: Math.floor(Math.random() * INCIDENT_MESSAGE_STYLES.length) };
      setState((current) => {
        if (!current.balancedTeams) return current;
        const key = matchEventTeam === 1 ? "team1" : "team2";
        const selected = current.balancedTeams[key];
        if (!(selected.substitutes || []).includes(playerInId) || (selected.substitutes || []).includes(playerOutId)) return current;
        const positions = { ...selected.positions, [playerInId]: selected.positions[playerOutId] || defaultPosition(current.players.find((item) => item.id === playerOutId)!) };
        const substitutes = [...(selected.substitutes || []).filter((id) => id !== playerInId), playerOutId];
        return { ...current, balancedTeams: { ...current.balancedTeams, [key]: { ...selected, positions, substitutes } }, match: { ...current.match, incidents: [...(current.match.incidents || []), incident] } };
      });
      setMatchEventEditor("");
    };
    return <>
      <div className="hd"><div className="lg"><span>{scheduled ? "Scheduled match" : "Hosted match"}</span><b className={running ? "live" : ""}>{statusText}</b></div><div className="sb"><div className="tm"><TeamMark name={match.us} flag={state.balancedTeams?.team1.flag} /><div className="tn">{match.us}</div></div><div className="score-clock"><div className="sc"><span>{team1Goals}</span><i>-</i><span>{team2Goals}</span></div><div className={`match-clock${running ? " is-running" : ""}`}>{started ? formatMatchClock(elapsed) : scheduled ? kickoffDue ? kickoffDelay : formatKickoff(match.scheduledFor) : "Not started"}</div></div><div className="tm"><TeamMark name={match.opp} flag={state.balancedTeams?.team2.flag} /><div className="tn">{match.opp}</div></div></div>
        <div className="gl"><div>{scorerLines(1).map(([id, minutes]) => { const who = player(id); const sorted = minutes.filter((m): m is number => m !== null).sort((a, b) => a - b); const suffix = sorted.length ? sorted.map((m) => `${m}'`).join(", ") : minutes.length > 1 ? `(${minutes.length})` : ""; return who ? <div key={id}>{who.name} {suffix}</div> : null; })}</div><div className="bl">{match.ev.length ? <MatchEventBadge kind="goal" /> : null}</div><div>{scorerLines(2).map(([id, minutes]) => { const who = player(id); const sorted = minutes.filter((m): m is number => m !== null).sort((a, b) => a - b); const suffix = sorted.length ? sorted.map((m) => `${m}'`).join(", ") : minutes.length > 1 ? `(${minutes.length})` : ""; return who ? <div key={id}>{who.name} {suffix}</div> : null; })}</div></div>
      </div>
      {unlocked ? (!started ? <div className="bar match-control-bar"><span className="match-control-copy">{scheduled ? kickoffDue ? <>Kickoff was <strong>{formatKickoff(match.scheduledFor)}</strong>. It is <strong>{kickoffDelay}</strong>, but the 90-minute clock is still waiting for you.</> : <>Kickoff is scheduled for <strong>{formatKickoff(match.scheduledFor)}</strong>. The timer will wait for the admin.</> : <>Teams are ready. Start the match to begin the 90-minute clock.</>}</span><button className="b pri" disabled={!kickoffDue} onClick={startMatchClock}>{kickoffDue ? "Start match" : "Waiting for kickoff"}</button></div> : <div className="bar match-control-bar"><span className="clock-pill">{statusText}</span>{running ? <button className="b line" onClick={() => pauseMatchClock("break")}>Pause</button> : !timeComplete && <button className="b pri" onClick={resumeMatchClock}>{match.pauseReason === "half-time" ? "Start second half" : "Resume"}</button>} {!match.halfTimeTaken && !timeComplete && <button className="b line" disabled={elapsed < HALF_TIME_SECONDS} title={elapsed < HALF_TIME_SECONDS ? "Available when the clock reaches 45:00" : "Pause for half-time"} onClick={takeHalfTime}>Half-time</button>}<button className="b pri" onClick={() => { setMatchEventEditor(""); setGoalTeam(1); setShowGoal(true); }}>⚽ {match.us} goal</button><button className="b pri" onClick={() => { setMatchEventEditor(""); setGoalTeam(2); setShowGoal(true); }}>⚽ {match.opp} goal</button><button className="b line" onClick={() => { setShowGoal(false); setMatchEventTeam(1); setMatchEventEditor("yellow"); }}>Yellow card</button><button className="b line" disabled={!anySubstitutes} onClick={() => { setShowGoal(false); const team = substituteIdsFor(1).length ? 1 : 2; setMatchEventTeam(team); setMatchEventEditor("substitution"); }}>Substitution</button><button className="b line" disabled={!match.ev.length} onClick={() => setState((current) => ({ ...current, match: { ...current.match, ev: current.match.ev.slice(0, -1) } }))}>Undo last goal</button><button className="b line" onClick={endCurrentMatch}>End & save</button></div>) : <div className="bar spectator-bar"><span className="note">{scheduled ? kickoffDue ? `Kickoff is ${kickoffDelay}. Waiting for the admin to start the match.` : `Scheduled for ${formatKickoff(match.scheduledFor)}. The timer has not started.` : !started ? "Waiting for the admin to start the match." : `${statusText} · View only.`}</span></div>}
      {unlocked && showGoal && started && <div className="card" style={{ marginTop: 16 }}><h2>{goalTeam === 1 ? match.us : match.opp} goal</h2><div className="row2"><div><label htmlFor="gs">Scored by</label><select id="gs">{scoringIds.map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div><div><label htmlFor="ga">Assist by</label><select id="ga"><option value="">No assist</option>{scoringIds.map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div></div><div className="row2"><div><label htmlFor="goal-kind">Goal type</label><select id="goal-kind"><option value="goal">Normal goal</option><option value="penalty">Penalty goal</option></select></div><div><label htmlFor="gm">Minute</label><input id="gm" type="number" min="0" max="130" inputMode="numeric" defaultValue={Math.max(1, Math.min(90, Math.ceil(elapsed / 60)))} /></div></div><div className="button-row"><button className="b pri" onClick={addGoal}>Save goal</button><button className="b line" onClick={() => setShowGoal(false)}>Cancel</button></div></div>}
      {unlocked && matchEventEditor && started && <div className="card match-event-editor" style={{ marginTop: 16 }}><h2>{matchEventEditor === "yellow" ? "Record yellow card" : "Record substitution"}</h2><label htmlFor="match-event-team">Team</label><select id="match-event-team" value={matchEventTeam} onChange={(event) => setMatchEventTeam(Number(event.target.value) === 2 ? 2 : 1)}><option value={1}>{match.us}</option><option value={2}>{match.opp}</option></select>{matchEventEditor === "yellow" ? <><label htmlFor="match-event-player">Player</label>{yellowCardPlayerIds.length ? <select id="match-event-player">{yellowCardPlayerIds.map((id) => { const cards = yellowCountForPlayer(id); return <option value={id} key={id}>{player(id)?.name}{cards ? ` · ${cards} yellow${cards === 1 ? "" : "s"}${cards === 2 ? " → next is red" : ""}` : ""}</option>; })}</select> : <p className="empty">No eligible on-field player. Players shown red cannot receive another card.</p>}</> : matchEventSubstituteIds.length ? <div className="row2"><div><label htmlFor="sub-player-out">Player off</label><select id="sub-player-out">{matchEventPlayerIds.map((id) => <option value={id} key={id}>{player(id)?.name}</option>)}</select></div><div><label htmlFor="sub-player-in">Player on</label><select id="sub-player-in">{matchEventSubstituteIds.map((id) => <option value={id} key={id}>{player(id)?.name}</option>)}</select></div></div> : <p className="empty">This team has no players on the substitute bench.</p>}<label htmlFor="match-event-minute">Minute</label><input id="match-event-minute" type="number" min="0" max="130" inputMode="numeric" defaultValue={Math.max(1, Math.min(90, Math.ceil(elapsed / 60)))} /><div className="button-row"><button className="b pri" disabled={matchEventEditor === "substitution" ? !matchEventPlayerIds.length || !matchEventSubstituteIds.length : !yellowCardPlayerIds.length} onClick={matchEventEditor === "yellow" ? addYellowCard : addSubstitution}>Save {matchEventEditor === "yellow" ? "yellow card" : "substitution"}</button><button className="b line" onClick={() => setMatchEventEditor("")}>Cancel</button></div></div>}
      <div className="tabs match-tabs">{(["timeline", "lineups", "stats", "history", ...(unlocked ? ["edit" as const] : [])] as MatchTab[]).map((tab) => <button key={tab} onClick={() => setSub(tab)} className={state.sub === tab ? "on" : ""}>{tab}</button>)}</div>
      {(state.sub === "timeline" || (!unlocked && state.sub === "edit")) && Timeline()}{state.sub === "lineups" && <><div className="sec">{FormationBoard(true)}</div>{Squad({ ids: onFieldIdsFor(1), title: `${match.us} starting lineup` })}{substituteIdsFor(1).length ? Squad({ ids: substituteIdsFor(1), title: `${match.us} substitutes` }) : null}{onFieldIdsFor(2).length ? Squad({ ids: onFieldIdsFor(2), title: `${match.opp} starting lineup` }) : null}{substituteIdsFor(2).length ? Squad({ ids: substituteIdsFor(2), title: `${match.opp} substitutes` }) : null}</>}{state.sub === "stats" && Stats()}{state.sub === "history" && HistoryView()}{unlocked && state.sub === "edit" && MatchSettings()}
      {state.sub !== "history" && state.history.length > 0 && HistoryView()}
    </>;
  }

  function GoalTimelineCard({ goal, team1Name, team2Name, team1Flag, team2Flag, scorer, assistName, onDelete }: {
    goal: Goal & { index: number; score1: number; score2: number };
    team1Name: string;
    team2Name: string;
    team1Flag?: string;
    team2Flag?: string;
    scorer?: { name: string; position?: string; flag?: string; image?: string };
    assistName?: string;
    onDelete?: () => void;
  }) {
    const teamNumber = goal.team || 1;
    const scoringTeam = teamNumber === 1 ? team1Name : team2Name;
    const opponent = teamNumber === 1 ? team2Name : team1Name;
    const scoringTeamFlag = teamNumber === 1 ? team1Flag : team2Flag;
    const scorerName = scorer?.name || "Player";
    const messageIndex = Number.isInteger(goal.message) ? Math.abs(goal.message || 0) % GOAL_MESSAGES.length : stableMessageIndex(`${goal.s}-${goal.m}-${goal.index}`, GOAL_MESSAGES.length);
    const description = GOAL_MESSAGES[messageIndex]({ scorer: scorerName, team: scoringTeam, opponent, score: `${goal.score1}–${goal.score2}`, assist: assistName, penalty: goal.kind === "penalty" });
    return <article className={`goal-event-card team-${teamNumber}`}>
      <div className="goal-event-banner"><MatchEventBadge kind="goal" className="goal-event-banner-icon" /><strong>GOOOAAALLL!!!</strong><b>{goal.m === null ? "Goal" : formatMatchMinute(goal.m)}</b></div>
      <div className="goal-event-score"><strong className={teamNumber === 1 ? "scoring-team" : ""}>{team1Name}</strong><span>{goal.score1} <i>–</i> {goal.score2}</span><strong className={teamNumber === 2 ? "scoring-team" : ""}>{team2Name}</strong></div>
      <div className="goal-event-player"><div><strong>{scorer?.name || "Player"}</strong><span>{scoringTeam}{scorer?.position ? ` · ${scorer.position}` : ""}</span>{goal.kind === "penalty" && <span className="goal-event-penalty">Penalty goal</span>}{assistName && <span className="goal-event-assist"><MatchEventBadge kind="assist" />Assist: {assistName}</span>}</div><TeamMark name={scoringTeam} flag={scoringTeamFlag} className="goal-event-flag" /></div>
      <p className="goal-event-description">{description}</p>
      {onDelete && <button className="b line sm goal-event-delete" onClick={onDelete}>Delete goal</button>}
    </article>;
  }

  function IncidentTimelineCard({ incident, teamName, teamFlag, playerInfo, yellowNumber = 1, onDelete }: {
    incident: MatchIncident;
    teamName: string;
    teamFlag?: string;
    playerInfo: (id: string) => { name: string; position?: string; flag?: string; image?: string } | undefined;
    yellowNumber?: number;
    onDelete?: () => void;
  }) {
    if (incident.type === "yellow") {
      const booked = playerInfo(incident.playerId);
      const messageIndex = Number.isInteger(incident.message) ? Math.abs(incident.message || 0) % INCIDENT_MESSAGE_STYLES.length : stableMessageIndex(incident.id, INCIDENT_MESSAGE_STYLES.length);
      const redCard = yellowNumber >= 3;
      const yellowDescription = INCIDENT_MESSAGE_STYLES[messageIndex].yellow({ player: booked?.name || "Player", team: teamName });
      const description = redCard ? `${yellowDescription} It is the third yellow, so ${booked?.name || "the player"} is shown a red card.` : yellowDescription;
      return <article className={`incident-event-card ${redCard ? "is-red" : "is-yellow"}`}><div className="incident-event-head"><MatchEventBadge kind={redCard ? "red-card" : "yellow-card"} /><strong>{redCard ? "RED CARD" : "YELLOW CARD"}</strong><b>{formatMatchMinute(incident.m)}</b></div><div className="incident-player"><span className="roster-avatar">{booked?.image ? <img src={booked.image} alt="" /> : initials(booked?.name || "P")}</span><div><strong>{booked?.name || "Player"}</strong><small>{teamName}{booked?.position ? ` · ${booked.position}` : ""}</small><span className={redCard ? "booking-count is-red" : "booking-count"}>{redCard ? "Third yellow · red card" : `Yellow card ${yellowNumber} of 3`}</span></div></div><p>{description}</p>{onDelete && <button className="b line sm goal-event-delete" onClick={onDelete}>Delete event</button>}</article>;
    }
    const playerOut = playerInfo(incident.playerOutId);
    const playerIn = playerInfo(incident.playerInId);
    const messageIndex = Number.isInteger(incident.message) ? Math.abs(incident.message || 0) % INCIDENT_MESSAGE_STYLES.length : stableMessageIndex(incident.id, INCIDENT_MESSAGE_STYLES.length);
    const description = INCIDENT_MESSAGE_STYLES[messageIndex].substitution({ playerIn: playerIn?.name || "Player", playerOut: playerOut?.name || "Player", team: teamName });
    return <article className="incident-event-card is-substitution"><div className="incident-event-head"><span className="substitution-icon"><i>↑</i><i>↓</i></span><strong>SUBSTITUTION</strong><b>{formatMatchMinute(incident.m)}</b></div><div className="substitution-body"><div className="substitution-players"><div><span className="sub-label is-in">IN</span><p><strong>{playerIn?.name || "Player"}</strong><small>{teamName}{playerIn?.position ? ` · ${playerIn.position}` : ""}</small></p></div><div><span className="sub-label is-out">OUT</span><p><strong>{playerOut?.name || "Player"}</strong><small>{teamName}{playerOut?.position ? ` · ${playerOut.position}` : ""}</small></p></div></div><TeamMark name={teamName} flag={teamFlag} className="substitution-flag" /></div><p>{description}</p>{onDelete && <button className="b line sm goal-event-delete" onClick={onDelete}>Delete event</button>}</article>;
  }

  function Timeline() {
    const goals = scoredGoalTimeline(state.match.ev, state.match.them);
    const rows = [
      ...goals.map((goal) => ({ type: "goal" as const, minute: goal.m ?? 999, order: goal.index, goal })),
      ...(state.match.incidents || []).map((incident, index) => ({ type: "incident" as const, minute: incident.m ?? 999, order: state.match.ev.length + index, incident })),
    ].sort((a, b) => a.minute - b.minute || a.order - b.order);
    const livePlayerInfo = (id: string) => { const item = player(id); if (!item) return undefined; const lineup = state.balancedTeams?.team1.ids.includes(id) ? state.balancedTeams.team1 : state.balancedTeams?.team2; return { name: item.name, position: lineup?.positions[id] || defaultPosition(item), flag: item.flag, image: item.image }; };
    return <div className="sec"><h2>Timeline</h2><div className="goal-event-list">{rows.length ? rows.map((row) => {
      if (row.type === "incident") return <IncidentTimelineCard key={row.incident.id} incident={row.incident} teamName={row.incident.team === 1 ? state.match.us : state.match.opp} teamFlag={row.incident.team === 1 ? state.balancedTeams?.team1.flag : state.balancedTeams?.team2.flag} playerInfo={livePlayerInfo} yellowNumber={row.incident.type === "yellow" ? yellowCardNumber(state.match.incidents || [], row.incident) : undefined} onDelete={unlocked && state.match.st === "Live" && row.incident.type === "yellow" ? () => setState((current) => ({ ...current, match: { ...current.match, incidents: (current.match.incidents || []).filter((incident) => incident.id !== row.incident.id) } })) : undefined} />;
      const goal = row.goal;
      return <GoalTimelineCard key={`goal-${goal.index}`} goal={goal} team1Name={state.match.us} team2Name={state.match.opp} team1Flag={state.balancedTeams?.team1.flag} team2Flag={state.balancedTeams?.team2.flag} scorer={livePlayerInfo(goal.s)} assistName={goal.a ? player(goal.a)?.name : undefined} onDelete={unlocked && state.match.st === "Live" ? () => setState((current) => ({ ...current, match: { ...current.match, ev: current.match.ev.filter((_, index) => index !== goal.index) } })) : undefined} />;
    }) : <div className="empty">No match events yet. Record a goal, card or substitution during the match.</div>}</div></div>;
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
      const yellowCount = (id: string) => (entry.incidents || []).filter((incident) => incident.type === "yellow" && incident.playerId === id).length;
      const recordedTeam2Goals = entry.goals.filter((goal) => goal.team === 2).length;
      const historyTimeline = scoredGoalTimeline(entry.goals, Math.max(0, entry.score2 - recordedTeam2Goals));
      const historyRows = [
        ...historyTimeline.map((goal) => ({ type: "goal" as const, minute: goal.m ?? 999, order: goal.index, goal })),
        ...(entry.incidents || []).map((incident, index) => ({ type: "incident" as const, minute: incident.m ?? 999, order: entry.goals.length + index, incident })),
      ].sort((a, b) => a.minute - b.minute || a.order - b.order);
      const historyStatsPanel = (team: MatchHistoryEntry["team1"]) => <section className="history-team-stat-panel"><h3><TeamMark name={team.name} flag={team.flag} className="history-stat-flag" />{team.name}</h3><table><thead><tr><th>Player</th><th>G</th><th>A</th><th>YC</th><th>RC</th></tr></thead><tbody>{team.players.map((item) => { const yellows = yellowCount(item.id); return <tr key={item.id}><td>{item.name}{item.id === team.captain && <span className="cp"> (C)</span>}{team.substitutes?.includes(item.id) && <small> SUB</small>}</td><td>{goalCount(item.id)}</td><td>{assistCount(item.id)}</td><td>{yellows}</td><td>{yellows >= 3 ? 1 : 0}</td></tr>; })}</tbody></table></section>;
      return <div className="history-detail">
        <div className="history-fulltime">Full-time · {new Date(entry.endedAt).toLocaleString()}{entry.durationSeconds !== undefined ? ` · ${formatMatchClock(entry.durationSeconds)} played` : ""}</div>
        <div className="history-detail-score"><div><TeamMark name={entry.team1.name} flag={entry.team1.flag} /><span>{entry.team1.name}</span></div><strong>{entry.score1} <i>–</i> {entry.score2}</strong><div><TeamMark name={entry.team2.name} flag={entry.team2.flag} /><span>{entry.team2.name}</span></div></div>
        <div className="history-scorers"><div>{entry.goals.filter((goal) => goal.team !== 2).map((goal, index) => <span key={`h1-${index}`}>{historyPlayer(entry, goal.s)?.name || "Player"}{goal.m !== null ? ` ${goal.m}'` : ""}</span>)}</div><MatchEventBadge kind="goal" /><div>{entry.goals.filter((goal) => goal.team === 2).map((goal, index) => <span key={`h2-${index}`}>{historyPlayer(entry, goal.s)?.name || "Player"}{goal.m !== null ? ` ${goal.m}'` : ""}</span>)}</div></div>
        <div className="tabs history-tabs">{(["timeline", "lineups", "stats"] as HistoryDetailTab[]).map((tab) => <button key={tab} className={historyDetailTab === tab ? "on" : ""} onClick={() => setHistoryDetailTab(tab)}>{tab}</button>)}</div>
        {historyDetailTab === "timeline" && <div className="history-detail-body"><div className="goal-event-list">{historyRows.length ? historyRows.map((row) => row.type === "goal" ? <GoalTimelineCard key={`${entry.id}-goal-${row.goal.index}`} goal={row.goal} team1Name={entry.team1.name} team2Name={entry.team2.name} team1Flag={entry.team1.flag} team2Flag={entry.team2.flag} scorer={historyPlayer(entry, row.goal.s)} assistName={row.goal.a ? historyPlayer(entry, row.goal.a)?.name : undefined} /> : <IncidentTimelineCard key={`${entry.id}-${row.incident.id}`} incident={row.incident} teamName={row.incident.team === 1 ? entry.team1.name : entry.team2.name} teamFlag={row.incident.team === 1 ? entry.team1.flag : entry.team2.flag} playerInfo={(id) => historyPlayer(entry, id)} yellowNumber={row.incident.type === "yellow" ? yellowCardNumber(entry.incidents || [], row.incident) : undefined} />) : <div className="empty">No match events were recorded.</div>}</div></div>}
        {historyDetailTab === "lineups" && <div className="history-lineups"><div><h3>{entry.team1.name}</h3>{entry.team1.players.map((item) => <div className="history-player" key={item.id}><span className="history-position">{entry.team1.substitutes?.includes(item.id) ? "SUB" : item.position || "—"}</span><span className="history-player-name">{item.name}</span>{item.id === entry.team1.captain && <span>Captain</span>}</div>)}</div><div><h3>{entry.team2.name}</h3>{entry.team2.players.map((item) => <div className="history-player" key={item.id}><span className="history-position">{entry.team2.substitutes?.includes(item.id) ? "SUB" : item.position || "—"}</span><span className="history-player-name">{item.name}</span>{item.id === entry.team2.captain && <span>Captain</span>}</div>)}</div></div>}
        {historyDetailTab === "stats" && <div className="history-detail-body"><div className="sr"><span>{entry.score1}</span><span>Goals</span><span>{entry.score2}</span></div><div className="history-team-stats">{historyStatsPanel(entry.team1)}{historyStatsPanel(entry.team2)}</div>{entry.motm && <p className="history-motm">Player of the match: <strong>{historyPlayer(entry, entry.motm)?.name || "Player"}</strong></p>}</div>}
      </div>;
    };
    return <div className="sec match-history"><h2>Match history</h2>{state.history.length ? state.history.map((entry) => { const open = openHistoryId === entry.id; return <article className={`history-card${open ? " is-open" : ""}`} key={entry.id}>
      <button className="history-summary" aria-expanded={open} onClick={() => { setOpenHistoryId(open ? "" : entry.id); setHistoryDetailTab("timeline"); }}><span className="history-date">{new Date(entry.endedAt).toLocaleDateString()}</span><span className="history-score"><span className="history-team-label"><TeamMark name={entry.team1.name} flag={entry.team1.flag} className="history-mini-flag" />{entry.team1.name}</span><strong>{entry.score1} – {entry.score2}</strong><span className="history-team-label"><TeamMark name={entry.team2.name} flag={entry.team2.flag} className="history-mini-flag" />{entry.team2.name}</span></span><span className="history-result">Full-time <b>{open ? "⌃" : "⌄"}</b></span></button>
      {open && detail(entry)}
      {unlocked && <button className="b line sm history-delete" onClick={() => removeHistory(entry.id)}>Delete match</button>}
    </article>; }) : <div className="empty">Ended matches will be saved here.</div>}</div>;
  }

  function endCurrentMatch() {
    if (!state.team || state.match.st !== "Live" || !state.match.startedAt) return;
    if (!window.confirm("End this match and save it to history?")) return;
    const second = state.balancedTeams?.team2;
    const firstPlayers = state.team.ids.map((id) => player(id)).filter((item): item is Player => Boolean(item)).map((item) => ({ id: item.id, name: item.name, position: state.balancedTeams?.team1.positions[item.id] || defaultPosition(item), flag: item.flag, image: item.image }));
    const secondPlayers = (second?.ids || []).map((id) => player(id)).filter((item): item is Player => Boolean(item)).map((item) => ({ id: item.id, name: item.name, position: second?.positions[item.id] || defaultPosition(item), flag: item.flag, image: item.image }));
    const entry: MatchHistoryEntry = {
      id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      endedAt: new Date().toISOString(),
      scheduledFor: state.match.scheduledFor,
      startedAt: new Date(state.match.startedAt).toISOString(),
      durationSeconds: elapsedMatchSeconds(state.match),
      team1: { name: state.match.us, flag: state.balancedTeams?.team1.flag, captain: state.team.captain, substitutes: state.balancedTeams?.team1.substitutes || [], players: firstPlayers },
      team2: { name: state.match.opp, flag: second?.flag, captain: second?.captain || "", substitutes: second?.substitutes || [], players: secondPlayers },
      score1: state.match.ev.filter((goal) => goal.team !== 2).length,
      score2: state.match.them + state.match.ev.filter((goal) => goal.team === 2).length,
      goals: state.match.ev,
      incidents: state.match.incidents || [],
      motm: state.match.motm || automaticMotm(),
    };
    setShowGoal(false);
    setMatchEventEditor("");
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
    const yellowCards = (id: string) => (state.match.incidents || []).filter((incident) => incident.type === "yellow" && incident.playerId === id).length;
    return <><div className="sec"><div className="team-stat-head"><span>{state.match.us}</span><span>TEAM STATS</span><span>{state.match.opp}</span></div><div className="sr"><span>{team1Goals > team2Goals && team1Goals > 0 ? <span className="pill l">{team1Goals}</span> : team1Goals}</span><span>Goals</span><span>{team2Goals > team1Goals && team2Goals > 0 ? <span className="pill r">{team2Goals}</span> : team2Goals}</span></div><div className="sr"><span>{team1Assists}</span><span>Assists</span><span>{team2Assists}</span></div></div>
      <div className="card motm"><div className="note" style={{ margin: "0 0 4px" }}>Man of the match</div>{motm && player(motm) ? <><div className="big">{player(motm)?.name}</div><p className="note">{stats(motm).g} goals, {stats(motm).a} assists. {state.match.motm ? "Chosen by you." : "Picked from goals, assists and rating."}</p></> : <div className="empty">Appears after the first goal.</div>}</div>
      <div className="sec stats-table"><table><thead><tr><th>Player</th><th>Team</th><th>Goals</th><th>Assists</th><th>YC</th><th>RC</th></tr></thead><tbody>{ids.map((id) => { const item = player(id); const totals = stats(id); const yellows = yellowCards(id); const isTeam1 = team1Ids.includes(id); const isCaptain = (isTeam1 ? state.team?.captain : state.balancedTeams?.team2.captain) === id; return <tr key={id}><td>{item?.name}{isCaptain && <span className="cp"> (C)</span>}</td><td>{isTeam1 ? state.match.us : state.match.opp}</td><td>{totals.g > 0 && totals.g === max("g") ? <span className="pill l">{totals.g}</span> : totals.g}</td><td>{totals.a > 0 && totals.a === max("a") ? <span className="pill l">{totals.a}</span> : totals.a}</td><td>{yellows}</td><td>{yellows >= 3 ? 1 : 0}</td></tr>; })}</tbody></table></div></>;
  }

  function MatchSettings() {
    if (!unlocked || !state.team) return null;
    const updateMatch = (patch: Partial<Match>) => setState((current) => ({ ...current, match: { ...current.match, ...patch } }));
    const allIds = [...new Set([...state.team.ids, ...(state.balancedTeams?.team2.ids || [])])];
    return <div className="sec"><h2>Match settings</h2><div className="row2"><div><label htmlFor="tn">Team 1 name</label><input id="tn" value={state.match.us} onChange={(e) => updateMatch({ us: e.target.value })} /></div><div><label htmlFor="on">Team 2 name</label><input id="on" value={state.match.opp} onChange={(e) => updateMatch({ opp: e.target.value })} /></div></div><label htmlFor="mo">Man of the match</label><select id="mo" value={state.match.motm} onChange={(e) => updateMatch({ motm: e.target.value })}><option value="">Automatic</option>{allIds.map((id) => <option value={id} key={id}>{player(id)?.name}</option>)}</select>
      {!state.match.startedAt && <><label htmlFor="edit-kickoff">Scheduled kickoff (leave empty for ready now)</label><input id="edit-kickoff" type="datetime-local" value={datetimeLocalValue(state.match.scheduledFor)} onChange={(event) => updateMatch({ scheduledFor: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></>}
      <div className="button-row">{state.match.st === "Live" && state.match.startedAt && <button className="b pri" onClick={endCurrentMatch}>End & save match</button>}<button className="b line" onClick={() => { if (!window.confirm("Delete the current match? Saved history will be kept.")) return; setShowGoal(false); setMatchEventEditor(""); setState((current) => ({ ...current, team: null, match: newMatch(), tab: "team", sub: "timeline" })); }}>Delete current match</button></div></div>;
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
  const switchSportMode = () => {
    if (!unlocked) return;
    setState((current) => ({ ...current, sportMode: current.sportMode === "cricket" ? "football" : "cricket" }));
  };
  if (!accessChecked || !hydrated.current) return <div className="app access-screen"><div className="access-card"><img src="/badges/squad-sheet-fc.png" alt="Squad Sheet FC" /><p className="access-kicker">SQUAD SHEET</p><h1>Loading…</h1></div></div>;

  const cricketMode = state.sportMode === "cricket";
  const syncText = !unlocked
    ? syncStatus === "loading" ? "Loading public view…" : syncStatus === "reconnecting" ? "View only · Reconnecting…" : syncStatus === "offline" ? "View only · Supabase offline" : "View only · Live data"
    : syncStatus === "loading" ? "Loading Supabase…" : syncStatus === "saving" ? "Saving…" : syncStatus === "saved" ? "Saved to Supabase" : syncStatus === "reconnecting" ? "Reconnecting to Supabase…" : "Saved locally · Supabase offline";
  return <div className={`app sport-${state.sportMode}${unlocked ? " is-admin" : " is-view-only"}`}>
    {cricketMode
      ? <nav className="tabs cricket-tabs" aria-label="Cricket navigation">{(["match", "team", "players"] as CricketTab[]).map((tab) => <button type="button" key={tab} className={state.cricket.tab === tab ? "on" : ""} onClick={() => setState((current) => ({ ...current, cricket: { ...current.cricket, tab } }))}>{tab}</button>)}</nav>
      : <nav className="tabs" aria-label="Main navigation">{(["match", "team", "players"] as MainTab[]).map((tab) => <button key={tab} onClick={() => setTab(tab)} className={state.tab === tab ? "on" : ""}>{tab}</button>)}</nav>}
    <div className={`sync-status is-${syncStatus}`}>
      {unlocked && <button className="sport-switch" type="button" onClick={switchSportMode}>{cricketMode ? "Switch to football" : "Switch to cricket"}</button>}
      <span className="sync-message" role="status" aria-live="polite"><i className="sync-dot" />{syncText}</span>
      <button className="admin-session-button" type="button" onClick={() => unlocked ? void lock() : setShowAdminLogin(true)}>{unlocked ? "Exit admin" : "Admin login"}</button>
    </div>
    <main>{cricketMode ? <CricketWorkspace value={state.cricket} unlocked={unlocked} uploadPlayerImage={preparePlayerImage} uploadTeamFlag={uploadTeamFlag} onChange={(updater) => setState((current) => ({ ...current, cricket: updater(current.cricket) }))} /> : state.tab === "players" ? PlayersView() : state.tab === "team" ? TeamView() : MatchView()}</main>
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
