"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SPECIALITIES = ["Passing", "Scoring", "Shooting", "Dribbling", "Teamwork"] as const;
const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"] as const;
const CARD_STYLES = [
  { id: "classic", name: "Classic Gold", src: "/card-templates/classic-gold.png", cleanSrc: "/card-templates/classic-gold-clean.png" },
  { id: "royal", name: "Royal Gold", src: "/card-templates/royal-gold.png", cleanSrc: "/card-templates/royal-gold-clean.png" },
  { id: "electric", name: "Electric Blue", src: "/card-templates/electric-blue.png", cleanSrc: "/card-templates/electric-blue-clean.png" },
  { id: "crimson", name: "Crimson", src: "/card-templates/crimson-obsidian.png", cleanSrc: "/card-templates/crimson-obsidian-clean.png" },
] as const;
const SEED = ["Abdul Rafay", "Faiq Ali Khan", "Hamza Yildirim", "Hassan", "Ali", "Atif Rajpoot", "Saad Naseer", "Tariq Azeez", "Zian", "Wahid Bux", "Zubair", "Hasnain", "Waris", "Muhammad Saad"];

type MainTab = "match" | "team" | "players";
type MatchTab = "timeline" | "lineups" | "stats" | "edit";
type CardStyleId = typeof CARD_STYLES[number]["id"];
type Player = { id: string; name: string; rating: number; spec: string; image?: string; cardStyle?: CardStyleId; position?: string; flag?: string; on?: boolean };
type Goal = { s: string; a: string; m: number | null };
type Team = { ids: string[]; captain: string };
type BalancedTeams = {
  team1: { name: string; ids: string[] };
  team2: { name: string; ids: string[] };
  seed: number;
  cost: number;
};
type Match = { opp: string; us: string; them: number; ev: Goal[]; motm: string; st: "Live" | "Full-time" };
type AppState = {
  players: Player[];
  want: number;
  team: Team | null;
  balancedTeams: BalancedTeams | null;
  pool: Player[] | null;
  tab: MainTab;
  sub: MatchTab;
  match: Match;
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
  opp: previous?.opp || "Opponents",
  us: previous?.us || "My Team",
  them: 0,
  ev: [],
  motm: "",
  st: "Live",
});

const initialState = (): AppState => ({
  players: SEED.map((name, i) => ({ id: `s${i}`, name, rating: 0, spec: "", cardStyle: "classic" })),
  want: 0,
  team: null,
  balancedTeams: null,
  pool: null,
  tab: "match",
  sub: "timeline",
  match: newMatch(),
  seeded: true,
});

const legacyRatingToStars = (rating: number) => Math.max(1, Math.min(10, Math.round((rating - 42.5) / 5)));

const restoreState = (value: unknown): AppState => {
  const base = initialState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const parsed = value as Partial<AppState>;
  const hasSavedPlayers = Array.isArray(parsed.players);
  const players = (hasSavedPlayers ? parsed.players || [] : base.players)
    .filter((item): item is Player => Boolean(item && typeof item.name === "string" && (typeof item.id === "string" || typeof item.id === "number")))
    .map((item) => {
      const legacy = item as Player & { id: string | number; available?: boolean; imageUrl?: string | null };
      const rawRating = Number(legacy.rating) || 0;
      return {
        id: String(legacy.id),
        name: legacy.name.trim() || "Player",
        rating: rawRating > 10 ? legacyRatingToStars(rawRating) : Math.max(0, Math.min(10, Math.round(rawRating))),
        spec: typeof legacy.spec === "string" ? legacy.spec : "",
        image: typeof legacy.image === "string" ? legacy.image : typeof legacy.imageUrl === "string" ? legacy.imageUrl : undefined,
        cardStyle: CARD_STYLES.some((style) => style.id === legacy.cardStyle) ? legacy.cardStyle : "classic",
        position: typeof legacy.position === "string" ? legacy.position : undefined,
        flag: typeof legacy.flag === "string" ? legacy.flag : undefined,
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
      team1: { name: savedBalance.team1.name || "Team 1", ids: savedBalance.team1.ids.map(String).filter((id) => playerIds.has(id)) },
      team2: { name: savedBalance.team2.name || "Team 2", ids: savedBalance.team2.ids.map(String).filter((id) => playerIds.has(id)) },
      seed: Number(savedBalance.seed) || 0,
      cost: Number(savedBalance.cost) || 0,
    }
    : null;
  return {
    ...base,
    ...parsed,
    players,
    want: Number.isFinite(Number(parsed.want)) ? Math.max(0, Number(parsed.want)) : 0,
    team: savedTeam?.ids.length ? { ...savedTeam, captain: playerIds.has(savedTeam.captain) ? savedTeam.captain : savedTeam.ids[0] } : null,
    balancedTeams,
    pool: Array.isArray(parsed.pool) ? parsed.pool.filter((item) => item && playerIds.has(String(item.id))).map((item) => players.find((player) => player.id === String(item.id))!).filter(Boolean) : null,
    tab: parsed.tab === "team" || parsed.tab === "players" ? parsed.tab : "match",
    sub: parsed.sub === "lineups" || parsed.sub === "stats" || parsed.sub === "edit" ? parsed.sub : "timeline",
    match: { ...base.match, ...(parsed.match && typeof parsed.match === "object" ? parsed.match : {}) },
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
      team1: { name: legacy.team1Name || "Team 1", ids: team1Ids },
      team2: { name: legacy.team2Name || "Team 2", ids: team2Ids },
      seed: 0,
      cost: 0,
    } : null,
  };
};

const ratingLabel = (player: Player) => player.rating ? `${player.rating}/10` : "Not rated";
const specialityLabel = (player: Player) => player.spec || "No speciality";
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase() || "?";
const sortPlayers = (players: Player[]) => [...players].sort((a, b) => b.rating - a.rating || Number(b.spec === "Teamwork") - Number(a.spec === "Teamwork") || a.name.localeCompare(b.name));
const defaultPosition = (player: Player) => player.position || ({ Scoring: "ST", Shooting: "ST", Dribbling: "LW", Passing: "CM", Teamwork: "CDM" }[player.spec] || "CM");
const generatedCardStats = (player: Player) => {
  if (!player.rating) return [["PAC", "–"], ["SHO", "–"], ["PAS", "–"], ["DRI", "–"], ["DEF", "–"], ["PHY", "–"]];
  const base = 44 + player.rating * 5;
  const boost = (label: string) => {
    if ((player.spec === "Scoring" || player.spec === "Shooting") && label === "SHO") return 6;
    if (player.spec === "Passing" && label === "PAS") return 6;
    if (player.spec === "Dribbling" && label === "DRI") return 6;
    if (player.spec === "Teamwork" && (label === "PAS" || label === "PHY")) return 4;
    return 0;
  };
  const value = (label: string, offset: number) => String(Math.max(1, Math.min(99, base + offset + boost(label))));
  return [["PAC", value("PAC", 1)], ["SHO", value("SHO", -1)], ["PAS", value("PAS", 0)], ["DRI", value("DRI", 2)], ["DEF", value("DEF", -8)], ["PHY", value("PHY", -3)]];
};

type BalanceVector = [number, number, number, number, number, number, number];
type BalanceItem = { player: Player; values: BalanceVector };
type BalanceCandidate = { first: BalanceItem[]; second: BalanceItem[]; cost: number; signature: string };

const BALANCE_WEIGHTS: BalanceVector = [2, 1, 1, 1, 1, 1, 1];
const BALANCE_SCALES: BalanceVector = [1, 5, 5, 5, 5, 5, 5];
const FALLBACK_BALANCE_VECTOR: BalanceVector = [5.5, 75, 73, 74, 76, 66, 71];

const numericBalanceVector = (player: Player): BalanceVector | null => {
  if (!player.rating) return null;
  const values = generatedCardStats(player).map(([, value]) => Number(value));
  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) return null;
  return [player.rating, values[0], values[1], values[2], values[3], values[4], values[5]];
};

const createBalanceItems = (players: Player[]) => {
  const known = players.map(numericBalanceVector).filter((values): values is BalanceVector => values !== null);
  const fallback = [...FALLBACK_BALANCE_VECTOR] as BalanceVector;
  if (known.length) {
    for (let feature = 0; feature < fallback.length; feature++) {
      fallback[feature] = known.reduce((sum, values) => sum + values[feature], 0) / known.length;
    }
  }
  return players.map((player) => ({ player, values: numericBalanceVector(player) || [...fallback] as BalanceVector }));
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
  const total: BalanceVector = [0, 0, 0, 0, 0, 0, 0];
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

const improveBalance = (firstSeed: BalanceItem[], secondSeed: BalanceItem[]): BalanceCandidate => {
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
      for (let secondIndex = 0; secondIndex < second.length; secondIndex++) {
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

  if (first.length === second.length) {
    const firstKey = first.map(({ player }) => player.id).sort().join("|");
    const secondKey = second.map(({ player }) => player.id).sort().join("|");
    if (secondKey < firstKey) [first, second] = [second, first];
  }
  return { first, second, cost, signature: balanceSignature(first, second) };
};

const rosterBalanceSeed = (players: Player[]) => {
  const fingerprint = [...players]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}:${item.rating}:${item.spec}:${defaultPosition(item)}`)
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

const makeBalancedTeams = (players: Player[], seed: number, previousSignature = "") => {
  if (players.length < 2) throw new Error("At least two active players are required.");
  const items = createBalanceItems(players);
  const firstSize = Math.ceil(items.length / 2);
  const random = balanceRng(seed);
  const restarts = Math.max(32, Math.min(72, items.length * 3));
  const candidates = new Map<string, BalanceCandidate>();

  for (let restart = 0; restart < restarts; restart++) {
    let first: BalanceItem[];
    let second: BalanceItem[];
    if (restart === 0) {
      const strength = (item: BalanceItem) => item.values.reduce((sum, value, feature) => sum + value / BALANCE_SCALES[feature] * BALANCE_WEIGHTS[feature], 0);
      const ordered = [...items].sort((a, b) => strength(b) - strength(a) || a.player.name.localeCompare(b.player.name));
      first = [];
      second = [];
      ordered.forEach((item, index) => {
        const preferFirst = index % 4 === 0 || index % 4 === 3;
        if ((preferFirst && first.length < firstSize) || second.length >= items.length - firstSize) first.push(item);
        else second.push(item);
      });
    } else {
      const ordered = shuffled(items, random);
      first = ordered.slice(0, firstSize);
      second = ordered.slice(firstSize);
    }
    const candidate = improveBalance(first, second);
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
  const [draft, setDraft] = useState<{ rating: number; spec: string; name: string; image: string; cardStyle: CardStyleId; position: string; flag: string }>({ rating: 0, spec: "", name: "", image: "", cardStyle: "classic", position: "CM", flag: "🇵🇰" });
  const [pickCaptain, setPickCaptain] = useState("");
  const [showGoal, setShowGoal] = useState(false);
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [accessChecked, setAccessChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const hydrated = useRef(false);
  const saveSequence = useRef(0);

  useEffect(() => {
    try { setUnlocked(sessionStorage.getItem("squad-sheet-unlocked") === "yes"); } catch { /* Session storage can be unavailable. */ }
    setAccessChecked(true);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
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
      const savedValue = remoteValue && (!localValue || remoteTime >= localTime) ? remoteValue : localValue;
      const restored = savedValue ? restoreState(savedValue) : legacySquadState(legacyValue) || initialState();
      if (cancelled) return;
      hydrated.current = true;
      setState(restored);
      setSyncStatus(supabaseAvailable ? "saved" : "offline");
    };
    void load();
    return () => { cancelled = true; };
  }, [unlocked]);

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
    return [...state.team.ids].sort((a, b) => {
      const aa = stats(a); const bb = stats(b);
      return (bb.g * 3 + bb.a * 2 + (player(b)?.rating || 0) / 10) - (aa.g * 3 + aa.a * 2 + (player(a)?.rating || 0) / 10);
    })[0];
  };

  function PlayerCard({ item, children, compact = false }: { item: Player; children?: React.ReactNode; compact?: boolean }) {
    const design = CARD_STYLES.find((style) => style.id === item.cardStyle) || CARD_STYLES[0];
    const cardStats = generatedCardStats(item);
    const numericStats = cardStats.map(([, value]) => Number(value)).filter(Number.isFinite);
    const overall = numericStats.length ? Math.round(numericStats.reduce((sum, value) => sum + value, 0) / numericStats.length) : "–";
    return <article className={`player-card${item.on === false ? " is-inactive" : ""}${compact ? " is-compact" : ""}`}>
      <div className={`player-card__visual card-theme-${design.id}`}>
        <img className="player-card__frame" src={item.image ? design.cleanSrc : design.src} alt="" aria-hidden="true" />
        <div className="player-card__strip"><strong>{overall}</strong><span>{defaultPosition(item)}</span><span className="player-card__flag" aria-label="Country flag">{item.flag || "🇵🇰"}</span><img src="/badges/squad-sheet-fc.png" alt="Squad Sheet FC badge" /></div>
        <div className="player-card__photo">
          {item.image && <img src={item.image} alt={`${item.name} portrait`} />}
        </div>
        <div className="player-card__identity"><h3 className={item.name.length > 18 ? "is-long" : item.name.length > 13 ? "is-medium" : ""} title={item.name}>{item.name}</h3><p>{item.spec || "Footballer"}</p></div>
        <div className="player-card__stats">{cardStats.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      </div>
      <div className="player-card__meta"><span>{item.rating ? `${item.rating}/10 rating` : "Not rated"}</span><span>{item.on === false ? "Inactive" : "Active"}</span></div>
      {children && <div className="player-card__actions">{children}</div>}
    </article>;
  }

  function Squad({ ids, title }: { ids: string[]; title: string }) {
    return <div className="sec"><h2>{title}</h2><div className="player-grid">{ids.map((id) => {
      const item = player(id); if (!item) return null;
      return <div className="player-card-wrap" key={id}><PlayerCard item={item} compact />{state.team?.captain === id && <span className="captain-badge">C</span>}</div>;
    })}</div></div>;
  }

  function PlayersView() {
    const addPlayer = () => {
      const name = draft.name.trim();
      if (!name) { setError("Enter a name."); return; }
      setState((current) => ({ ...current, balancedTeams: null, players: [...current.players, { id: `p${Date.now()}${Math.random().toString(36).slice(2, 5)}`, name, rating: draft.rating, spec: draft.spec, image: draft.image, cardStyle: draft.cardStyle, position: draft.position, flag: draft.flag }] }));
      setDraft({ rating: 0, spec: "", name: "", image: "", cardStyle: "classic", position: "CM", flag: "🇵🇰" }); setError("");
    };
    const updatePlayer = (id: string, patch: Partial<Player>) => setState((current) => ({ ...current, balancedTeams: null, players: current.players.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    const togglePlayer = (id: string) => setState((current) => {
      const players = current.players.map((item) => item.id === id ? { ...item, on: item.on === false } : item);
      const madeInactive = players.find((item) => item.id === id)?.on === false;
      const reset = madeInactive && current.team?.ids.includes(id);
      return { ...current, balancedTeams: null, players, ...(reset ? { team: null, pool: null, match: newMatch(current.match) } : {}) };
    });
    const deletePlayer = (id: string) => setState((current) => {
      const reset = current.team?.ids.includes(id);
      return { ...current, balancedTeams: null, players: current.players.filter((item) => item.id !== id), pool: reset ? null : current.pool?.filter((item) => item.id !== id) || null, ...(reset ? { team: null, match: newMatch(current.match) } : {}) };
    });
    return <>
      <div className="sec"><h2>Add a player</h2>
        <label htmlFor="pn">Name</label><input id="pn" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Player name" autoComplete="off" />
        <label>Rating, 1–10 stars (optional)</label><div className="cl n">{Array.from({ length: 10 }, (_, i) => i + 1).map((number) => <button key={number} onClick={() => setDraft({ ...draft, rating: number })} className={draft.rating >= number ? "on" : ""} aria-label={`${number} stars`}>{number}</button>)}</div>
        <label>Speciality (optional)</label><div className="cl">{SPECIALITIES.map((spec) => <button key={spec} onClick={() => setDraft({ ...draft, spec })} className={draft.spec === spec ? "on" : ""}>{spec}</button>)}</div>
        <div className="player-details-row"><div><label htmlFor="position">Position</label><select id="position" value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></div><div><label htmlFor="flag">Country flag</label><input id="flag" value={draft.flag} maxLength={8} onChange={(e) => setDraft({ ...draft, flag: e.target.value })} placeholder="🇵🇰" /></div></div>
        <label>Card design</label><div className="design-picker">{CARD_STYLES.map((style) => <button type="button" key={style.id} className={draft.cardStyle === style.id ? "on" : ""} onClick={() => setDraft({ ...draft, cardStyle: style.id })}><img src={style.src} alt="" /><span>{style.name}</span></button>)}</div>
        <label>Player photo (optional)</label><div className="photo-field">{draft.image ? <img src={draft.image} alt="New player preview" /> : <div className="mini-silhouette"><span /></div>}<label className="b line photo-button">{draft.image ? "Change photo" : "Add photo"}<input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { setDraft({ ...draft, image: await preparePlayerImage(file) }); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add that image."); } e.target.value = ""; }} /></label>{draft.image && <button className="b line sm" onClick={() => setDraft({ ...draft, image: "" })}>Remove</button>}</div>
        <p className="note" aria-live="polite">{error}</p><button className="b pri" onClick={addPlayer}>Add player</button>
      </div>
      <div className="sec top-rule"><h2>Squad · {active.length} active of {state.players.length}</h2><p className="note">Tap Active to switch off a player who is not available. Inactive players are skipped when the team is made.</p>
        {state.players.length ? <div className="player-grid">{state.players.map((item) => <div key={item.id} className="player-card-wrap">
          <PlayerCard item={item}>
            <button className="b sm line" onClick={() => setEditId(editId === item.id ? "" : item.id)}>{editId === item.id ? "Done" : "Rate"}</button>
            <button className={`b sm ${item.on === false ? "line" : ""}`} onClick={() => togglePlayer(item.id)}>{item.on === false ? "Set active" : "Active"}</button>
            <button className="b sm line" onClick={() => deletePlayer(item.id)} aria-label={`Remove ${item.name}`}>✕</button>
          </PlayerCard>
          {editId === item.id && <div className="edit-block card-editor"><label>Rating</label><div className="cl n">{Array.from({ length: 10 }, (_, i) => i + 1).map((number) => <button key={number} onClick={() => updatePlayer(item.id, { rating: number })} className={item.rating >= number ? "on" : ""}>{number}</button>)}</div><label>Speciality</label><div className="cl edit-specialities">{SPECIALITIES.map((spec) => <button key={spec} onClick={() => updatePlayer(item.id, { spec })} className={item.spec === spec ? "on" : ""}>{spec}</button>)}</div><div className="player-details-row"><div><label>Position</label><select value={defaultPosition(item)} onChange={(e) => updatePlayer(item.id, { position: e.target.value })}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></div><div><label>Country flag</label><input value={item.flag || "🇵🇰"} maxLength={8} onChange={(e) => updatePlayer(item.id, { flag: e.target.value })} /></div></div><label>Card design</label><div className="design-picker is-small">{CARD_STYLES.map((style) => <button type="button" key={style.id} className={(item.cardStyle || "classic") === style.id ? "on" : ""} onClick={() => updatePlayer(item.id, { cardStyle: style.id })}><img src={style.src} alt="" /><span>{style.name}</span></button>)}</div><label>Player photo</label><div className="photo-edit-row"><label className="b line sm photo-button">{item.image ? "Change photo" : "Add photo"}<input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { updatePlayer(item.id, { image: await preparePlayerImage(file) }); } catch (reason) { window.alert(reason instanceof Error ? reason.message : "Could not add that image."); } e.target.value = ""; }} /></label>{item.image && <button className="b line sm" onClick={() => updatePlayer(item.id, { image: "" })}>Remove photo</button>}</div></div>}
        </div>)}</div> : <div className="empty">No players yet.</div>}
      </div>
    </>;
  }

  function TeamView() {
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
      const result = makeBalancedTeams(active, seed, shuffleTeams ? previousBalanceSignature : "");
      setState((current) => ({
        ...current,
        balancedTeams: {
          team1: { name: current.balancedTeams?.team1.name || "Team 1", ids: result.first },
          team2: { name: current.balancedTeams?.team2.name || "Team 2", ids: result.second },
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

  function MatchView() {
    if (!state.team?.ids.length) return <div className="sec"><h2>No team yet</h2><p className="empty">Make a team first, then track the match here.</p><button className="b pri" onClick={() => setTab("team")}>Make a team</button></div>;
    const match = state.match; const ourGoals = match.ev.length; const live = match.st === "Live";
    const scorerLines = Object.entries(match.ev.reduce<Record<string, (number | null)[]>>((result, goal) => { (result[goal.s] ||= []).push(goal.m); return result; }, {}));
    const addGoal = () => {
      const scorer = (document.getElementById("gs") as HTMLSelectElement).value;
      const assist = (document.getElementById("ga") as HTMLSelectElement).value;
      const minute = Number.parseInt((document.getElementById("gm") as HTMLInputElement).value);
      if (assist && assist === scorer) { window.alert("Scorer and assist must be different players."); return; }
      setState((current) => ({ ...current, match: { ...current.match, ev: [...current.match.ev, { s: scorer, a: assist, m: minute >= 0 && minute <= 130 ? minute : null }] } })); setShowGoal(false);
    };
    return <>
      <div className="hd"><div className="lg"><span>Friendly · Today</span><b className={live ? "live" : ""}>{live ? "Live" : "Full-time"}</b></div><div className="sb"><div className="tm"><div className="crest">{initials(match.us)}</div><div className="tn">{match.us}</div></div><div className="sc"><span>{ourGoals}</span><i>-</i><span>{match.them}</span></div><div className="tm"><div className="crest">{initials(match.opp)}</div><div className="tn">{match.opp}</div></div></div>
        <div className="gl"><div>{scorerLines.map(([id, minutes]) => { const who = player(id); const sorted = minutes.filter((m): m is number => m !== null).sort((a, b) => a - b); const suffix = sorted.length ? sorted.map((m) => `${m}'`).join(", ") : minutes.length > 1 ? `(${minutes.length})` : ""; return who ? <div key={id}>{who.name} {suffix}</div> : null; })}</div><div className="bl">{ourGoals ? "⚽" : ""}</div><div /></div>
      </div>
      <div className="bar"><button className="b pri" onClick={() => setShowGoal(true)}>⚽ Our goal</button><button className="b" onClick={() => setState((current) => ({ ...current, match: { ...current.match, them: current.match.them + 1 } }))}>Opponent +1</button><button className="b line" onClick={() => setState((current) => ({ ...current, match: { ...current.match, ev: current.match.ev.slice(0, -1) } }))}>Undo goal</button></div>
      {showGoal && <div className="card" style={{ marginTop: 16 }}><div className="row2"><div><label htmlFor="gs">Scored by</label><select id="gs">{state.team.ids.map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div><div><label htmlFor="ga">Assist by</label><select id="ga"><option value="">No assist</option>{state.team.ids.map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div></div><label htmlFor="gm">Minute (optional)</label><input id="gm" type="number" min="0" max="130" inputMode="numeric" placeholder="e.g. 23" /><div className="button-row"><button className="b pri" onClick={addGoal}>Save goal</button><button className="b line" onClick={() => setShowGoal(false)}>Cancel</button></div></div>}
      <div className="tabs">{(["timeline", "lineups", "stats", "edit"] as MatchTab[]).map((tab) => <button key={tab} onClick={() => setSub(tab)} className={state.sub === tab ? "on" : ""}>{tab}</button>)}</div>
      {state.sub === "timeline" && <Timeline />}{state.sub === "lineups" && <Squad ids={state.team.ids} title={`${match.us} lineup`} />}{state.sub === "stats" && <Stats />}{state.sub === "edit" && <MatchSettings />}
    </>;
  }

  function Timeline() {
    const events = state.match.ev.map((goal, index) => ({ ...goal, index })).sort((a, b) => (a.m ?? 999) - (b.m ?? 999) || a.index - b.index);
    return <div className="sec"><h2>Timeline</h2>{events.length ? events.map((goal) => <div className="tl" key={goal.index}><div className="mn">{goal.m !== null ? `${goal.m}'` : "⚽"}</div><div><div>⚽ {player(goal.s)?.name || "?"}</div>{goal.a && player(goal.a) && <small style={{ color: "var(--mu)" }}>Assist: {player(goal.a)?.name}</small>}</div></div>) : <div className="empty">No goals yet. Tap Our goal to add one.</div>}{state.match.them > 0 && <p className="note">{state.match.opp} goals: {state.match.them}</p>}</div>;
  }

  function Stats() {
    if (!state.team) return null;
    const ids = state.team.ids; const assists = state.match.ev.filter((goal) => goal.a).length; const motm = state.match.motm || automaticMotm();
    const max = (key: "g" | "a") => Math.max(0, ...ids.map((id) => stats(id)[key]));
    return <><div className="sec"><div className="ttl">TEAM STATS</div><div className="sr"><span>{state.match.ev.length > state.match.them && state.match.ev.length > 0 ? <span className="pill l">{state.match.ev.length}</span> : state.match.ev.length}</span><span>Goals</span><span>{state.match.them > state.match.ev.length && state.match.them > 0 ? <span className="pill r">{state.match.them}</span> : state.match.them}</span></div><div className="sr"><span>{assists}</span><span>Assists</span><span>–</span></div></div>
      <div className="card motm"><div className="note" style={{ margin: "0 0 4px" }}>Man of the match</div>{motm && player(motm) ? <><div className="big">{player(motm)?.name}</div><p className="note">{stats(motm).g} goals, {stats(motm).a} assists. {state.match.motm ? "Chosen by you." : "Picked from goals, assists and rating."}</p></> : <div className="empty">Appears after the first goal.</div>}</div>
      <div className="sec stats-table"><table><thead><tr><th>Player</th><th>Goals</th><th>Assists</th></tr></thead><tbody>{ids.map((id) => { const item = player(id); const totals = stats(id); return <tr key={id}><td>{item?.name}{state.team?.captain === id && <span className="cp"> (C)</span>}</td><td>{totals.g > 0 && totals.g === max("g") ? <span className="pill l">{totals.g}</span> : totals.g}</td><td>{totals.a > 0 && totals.a === max("a") ? <span className="pill l">{totals.a}</span> : totals.a}</td></tr>; })}</tbody></table></div></>;
  }

  function MatchSettings() {
    if (!state.team) return null;
    const updateMatch = (patch: Partial<Match>) => setState((current) => ({ ...current, match: { ...current.match, ...patch } }));
    return <div className="sec"><h2>Match settings</h2><div className="row2"><div><label htmlFor="tn">Your team name</label><input id="tn" value={state.match.us} onChange={(e) => updateMatch({ us: e.target.value })} /></div><div><label htmlFor="on">Opponent name</label><input id="on" value={state.match.opp} onChange={(e) => updateMatch({ opp: e.target.value })} /></div></div><label htmlFor="mo">Man of the match</label><select id="mo" value={state.match.motm} onChange={(e) => updateMatch({ motm: e.target.value })}><option value="">Automatic</option>{state.team.ids.map((id) => <option value={id} key={id}>{player(id)?.name}</option>)}</select>
      <div className="button-row"><button className="b" onClick={() => updateMatch({ st: state.match.st === "Live" ? "Full-time" : "Live" })}>{state.match.st === "Live" ? "Mark as full-time" : "Back to live"}</button><button className="b line" onClick={() => updateMatch({ them: Math.max(0, state.match.them - 1) })}>Opponent −1</button><button className="b line" onClick={() => { if (window.confirm("Start a new match? Score and stats reset.")) updateMatch(newMatch(state.match)); }}>New match</button></div></div>;
  }

  if (!accessChecked || !unlocked) {
    const unlock = (event: React.FormEvent) => {
      event.preventDefault();
      if (password !== "3456") { setPasswordError("Incorrect password. Try again."); return; }
      try { sessionStorage.setItem("squad-sheet-unlocked", "yes"); } catch { /* The app can still unlock for this page. */ }
      setPassword("");
      setPasswordError("");
      setUnlocked(true);
    };
    return <div className="app access-screen"><form className="access-card" onSubmit={unlock}>
      <img src="/badges/squad-sheet-fc.png" alt="Squad Sheet FC" />
      <p className="access-kicker">SQUAD SHEET</p>
      <h1>Enter password</h1>
      <p className="note">Unlock the team builder to manage players, teams and matches.</p>
      <label htmlFor="app-password">Password</label>
      <input id="app-password" type="password" inputMode="numeric" autoComplete="current-password" autoFocus={accessChecked} value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(""); }} />
      {passwordError && <p className="access-error" role="alert">{passwordError}</p>}
      <button className="b pri" type="submit" disabled={!accessChecked}>Unlock</button>
    </form></div>;
  }

  const syncText = syncStatus === "loading" ? "Loading Supabase…" : syncStatus === "saving" ? "Saving…" : syncStatus === "saved" ? "Saved to Supabase" : "Saved locally · Supabase offline";
  const lock = () => {
    try { sessionStorage.removeItem("squad-sheet-unlocked"); } catch { /* Ignore unavailable session storage. */ }
    hydrated.current = false;
    setUnlocked(false);
  };
  return <div className="app"><nav className="tabs" aria-label="Main navigation">{(["match", "team", "players"] as MainTab[]).map((tab) => <button key={tab} onClick={() => setTab(tab)} className={state.tab === tab ? "on" : ""}>{tab}</button>)}</nav><div className={`sync-status is-${syncStatus}`} role="status" aria-live="polite"><span />{syncText}<button type="button" onClick={lock}>Lock</button></div><main>{state.tab === "players" ? <PlayersView /> : state.tab === "team" ? <TeamView /> : <MatchView />}</main></div>;
}
