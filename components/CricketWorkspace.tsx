"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CRICKET_CARD_STYLES,
  CRICKET_ROLES,
  CRICKET_STAT_NAMES,
  CricketCardStyle,
  CricketDeliveryKind,
  CricketHistoryEntry,
  CricketInnings,
  CricketPlayer,
  CricketState,
  cricketOverall,
  cricketOvers,
  cricketStats,
  emptyCricketMatch,
  makeBalancedCricketTeams,
} from "@/lib/cricket";

const CARD_DESIGNS: Record<CricketCardStyle, { name: string; tier: string; image: string; placeholder: string }> = {
  electric: { name: "Super Rare Blue", tier: "SUPER RARE", image: "/card-templates/cricket-electric.png", placeholder: "/card-templates/cricket-electric-placeholder.png" },
  classic: { name: "Legendary Gold", tier: "LEGENDARY", image: "/card-templates/cricket-gold.png", placeholder: "/card-templates/cricket-gold-placeholder.png" },
  eclipse: { name: "Iconic Purple", tier: "ICONIC", image: "/card-templates/cricket-purple.png", placeholder: "/card-templates/cricket-purple-placeholder.png" },
  crimson: { name: "Elite Red", tier: "ELITE", image: "/card-templates/cricket-red.png", placeholder: "/card-templates/cricket-red-placeholder.png" },
};

const emptyStatDraft = () => Object.fromEntries(CRICKET_STAT_NAMES.map((label) => [label, ""])) as Record<typeof CRICKET_STAT_NAMES[number], string>;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase() || "?";
const flagCode = (value?: string) => /^[a-z]{2}$/i.test(value || "") ? value!.toLowerCase() : "";
const flagSource = (value?: string) => flagCode(value) === "pk" ? "/flags/pk.svg" : flagCode(value) ? `https://flagcdn.com/w80/${flagCode(value)}.png` : value && /^(https?:|data:image\/|blob:)/i.test(value) ? value : "";
const datetimeLocalValue = (value?: string) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const formatKickoff = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";

function CricketTeamMark({ name, flag, className = "" }: { name: string; flag?: string; className?: string }) {
  const source = flagSource(flag);
  return <span className={className || "team-name-flag"}>{source ? <img src={source} alt={`${name} flag`} /> : initials(name)}</span>;
}

const COMMENTARY: Record<CricketDeliveryKind, Array<(batter: string, bowler: string, runs: number) => string>> = {
  dot: [
    (batter, bowler) => `${bowler} keeps it tight and ${batter} cannot find a gap. A disciplined dot ball builds the pressure.`,
    (batter, bowler) => `${batter} watches it closely but the field closes in quickly. Nothing added from ${bowler}'s delivery.`,
  ],
  run: [
    (batter, bowler, runs) => `${batter} works ${bowler} into the open space and they come back for ${runs} run${runs === 1 ? "" : "s"}. Smart placement and sharp running.`,
    (batter, bowler, runs) => `${runs} run${runs === 1 ? "" : "s"} added as ${batter} places the ball safely away from the fielders off ${bowler}.`,
  ],
  four: [
    (batter, bowler) => `FOUR! ${batter} times it beautifully and sends ${bowler} racing to the boundary. The field had no chance of cutting that off.`,
    (batter, bowler) => `Cracking boundary from ${batter}! The ball pierces the field and ${bowler} concedes four runs.`,
  ],
  six: [
    (batter, bowler) => `SIX! ${batter} gets underneath it and launches ${bowler} cleanly beyond the rope. A commanding strike.`,
    (batter, bowler) => `That has gone all the way! ${batter} takes on ${bowler} and clears the boundary for six.`,
  ],
  wicket: [
    (batter, bowler) => `WICKET! ${bowler} wins the contest and ${batter} has to go. The fielding side celebrates a vital breakthrough.`,
    (batter, bowler) => `${bowler} strikes! ${batter}'s innings is over and the batting side must rebuild after losing a wicket.`,
  ],
  wide: [
    (_batter, bowler) => `Wide ball from ${bowler}. One extra is added and the delivery must be bowled again.`,
    (_batter, bowler) => `${bowler} misses the legal line, giving away a wide and an extra delivery.`,
  ],
  "no-ball": [
    (_batter, bowler) => `No-ball called against ${bowler}. The batting side receives an extra and this delivery does not count in the over.`,
    (_batter, bowler) => `${bowler} oversteps and the umpire signals no-ball. One run is added with another delivery still to come.`,
  ],
};

type Props = {
  value: CricketState;
  unlocked: boolean;
  onChange: (updater: (current: CricketState) => CricketState) => void;
  uploadPlayerImage: (file: File) => Promise<string>;
  uploadTeamFlag: (file: File) => Promise<string>;
};

type CricketMatchTab = "timeline" | "lineups" | "stats" | "history" | "edit";

function CricketRatingPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const previewRating = hoverRating ?? value;
  const ratingFromPointer = (number: number, button: HTMLButtonElement, clientX: number) => {
    const bounds = button.getBoundingClientRect();
    return number - (clientX - bounds.left < bounds.width / 2 ? 0.5 : 0);
  };
  return <div className="rating-picker" onPointerLeave={() => setHoverRating(null)}><div className="rating-buttons" role="radiogroup" aria-label="Player rating out of 10">{Array.from({ length: 10 }, (_, index) => index + 1).map((number) => {
    const fill = previewRating >= number ? 100 : previewRating === number - 0.5 ? 50 : 0;
    return <button type="button" key={number} className={`rating-step${fill === 100 ? " is-full" : fill === 50 ? " is-half" : ""}`} style={{ "--rating-fill": `${fill}%` } as React.CSSProperties} aria-label={`${number - 0.5} on the left half or ${number} on the right half`} aria-checked={value === number || value === number - 0.5} role="radio" onPointerMove={(event) => setHoverRating(ratingFromPointer(number, event.currentTarget, event.clientX))} onFocus={() => setHoverRating(null)} onClick={(event) => { const selected = event.detail === 0 ? number : ratingFromPointer(number, event.currentTarget, event.clientX); onChange(value === selected ? 0 : selected); }} onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); onChange(number - (event.key === "ArrowLeft" ? 0.5 : 0)); }}>{number}</button>;
  })}</div><output className="rating-value" aria-live="polite">{hoverRating === null ? (value ? `${value}/10 selected` : "Not rated") : `${hoverRating}/10 preview`}</output></div>;
}

function CricketPlayerCard({ player, children }: { player: CricketPlayer; children?: React.ReactNode }) {
  const design = CARD_DESIGNS[player.cardStyle];
  const flag = flagSource(player.flag);
  const overall = cricketOverall(player) || "–";
  const stats = Object.fromEntries(cricketStats(player));
  return <article className={`player-card cricket-player-card${player.active ? "" : " is-inactive"}`}>
    <div className={`cricket-card-art cricket-card-${player.cardStyle} ${player.image ? "has-photo" : "is-placeholder"}`}>
      <img className="cricket-card-template" src={player.image ? design.image : design.placeholder} alt="" aria-hidden="true" />
      <div className="cricket-card-overall"><strong>{overall}</strong><span>OVR</span></div>
      <div className="cricket-card-side-stats">
        {(["BAT", "BWL", "FLD"] as const).map((label) => <div key={label}><span>{label}</span><strong>{stats[label]}</strong></div>)}
      </div>
      {player.image && <div className="cricket-card-portrait"><img src={player.image} alt={`${player.name} portrait`} /></div>}
      <div className="cricket-card-flag">{flag ? <img src={flag} alt={`${player.name} flag`} /> : player.flag || ""}</div>
      <div className="cricket-card-name"><h3 className={player.name.length > 15 ? "is-long" : player.name.length > 10 ? "is-medium" : ""}>{player.name}</h3><span>{player.batting === "Right hand" ? "RH" : "LH"} BAT · {player.bowling === "Does not bowl" ? "DNB" : player.bowling}</span></div>
      <div className="cricket-card-bottom-stats">
        {(["PWR", "SPD", "TEC"] as const).map((label) => <div key={label}><span>{label}</span><strong>{stats[label]}</strong></div>)}
      </div>
      <div className="cricket-card-tier">{design.tier}</div>
    </div>
    <div className="player-card__meta"><span>{player.customOverall ? `${player.customOverall} custom OVR` : player.rating ? `${player.rating}/10 rating` : "Not rated"}</span><span>{player.active ? "Active" : "Inactive"}</span></div>
    {children && <div className="player-card__actions">{children}</div>}
  </article>;
}

export default function CricketWorkspace({ value, unlocked, onChange, uploadPlayerImage, uploadTeamFlag }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [captain1, setCaptain1] = useState("");
  const [captain2, setCaptain2] = useState("");
  const [editingId, setEditingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [teamFlagUploading, setTeamFlagUploading] = useState<"" | "team1" | "team2">("");
  const [scheduleInput, setScheduleInput] = useState("");
  const [matchTab, setMatchTab] = useState<CricketMatchTab>("timeline");
  const [openHistoryId, setOpenHistoryId] = useState("");
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState({ name: "", rating: 0, customOverall: "", role: "All-rounder" as CricketPlayer["role"], batting: "Right hand" as CricketPlayer["batting"], bowling: "Right-arm medium", image: "", flag: "PK", cardStyle: "electric" as CricketCardStyle, stats: emptyStatDraft() });
  const activePlayers = useMemo(() => value.players.filter((item) => item.active), [value.players]);
  const player = (id: string) => value.players.find((item) => item.id === id);
  const update = onChange;
  const reconcileTeams = (teams: CricketState["teams"], players: CricketPlayer[]) => {
    if (!teams) return null;
    const activeIds = new Set(players.filter((item) => item.active).map((item) => item.id));
    const clean = (team: typeof teams.team1) => {
      const ids = team.ids.filter((id) => activeIds.has(id));
      return { ...team, ids, captain: ids.includes(team.captain) ? team.captain : ids[0] || "", substitutes: (team.substitutes || []).filter((id) => ids.includes(id)) };
    };
    const team1 = clean(teams.team1); const team2 = clean(teams.team2);
    return team1.ids.length && team2.ids.length ? { ...teams, team1, team2, cost: -1 } : null;
  };

  useEffect(() => {
    if (value.match.status !== "scheduled") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [value.match.status]);

  const resetDraft = () => {
    setDraft({ name: "", rating: 0, customOverall: "", role: "All-rounder", batting: "Right hand", bowling: "Right-arm medium", image: "", flag: "PK", cardStyle: "electric", stats: emptyStatDraft() });
    setFormError("");
  };

  const savePlayer = () => {
    const name = draft.name.trim();
    const customOverall = draft.customOverall ? Number(draft.customOverall) : undefined;
    if (!name) { setFormError("Enter the player's name."); return; }
    if (customOverall !== undefined && (!Number.isInteger(customOverall) || customOverall < 1 || customOverall > 99)) { setFormError("Custom OVR must be a whole number from 1 to 99."); return; }
    if (CRICKET_STAT_NAMES.some((label) => draft.stats[label] && (!Number.isInteger(Number(draft.stats[label])) || Number(draft.stats[label]) < 1 || Number(draft.stats[label]) > 99))) { setFormError("Cricket attributes must be whole numbers from 1 to 99, or left blank for automatic values."); return; }
    const saved: CricketPlayer = {
      id: globalThis.crypto?.randomUUID?.() || `cricket-${Date.now()}`,
      name,
      rating: customOverall ? 0 : Math.max(0, Math.min(10, Math.round(draft.rating * 2) / 2)),
      customOverall,
      role: draft.role,
      batting: draft.batting,
      bowling: draft.bowling.trim() || "Does not bowl",
      image: draft.image || undefined,
      flag: draft.flag.trim() || "PK",
      cardStyle: draft.cardStyle,
      stats: Object.fromEntries(CRICKET_STAT_NAMES.flatMap((label) => {
        const value = Number(draft.stats[label]);
        return Number.isInteger(value) && value >= 1 && value <= 99 ? [[label, value]] : [];
      })),
      active: true,
    };
    update((current) => ({ ...current, players: [...current.players, saved] }));
    resetDraft();
  };

  const editPlayer = (item: CricketPlayer) => {
    setEditingId((current) => current === item.id ? "" : item.id);
  };

  const updatePlayer = (id: string, patch: Partial<CricketPlayer>) => update((current) => ({ ...current, players: current.players.map((item) => item.id === id ? { ...item, ...patch } : item), teams: current.teams ? { ...current.teams, cost: -1 } : null }));

  const togglePlayer = (id: string) => update((current) => {
    const players = current.players.map((item) => item.id === id ? { ...item, active: !item.active } : item);
    return { ...current, players, teams: current.match.status === "setup" ? reconcileTeams(current.teams, players) : current.teams };
  });

  const deletePlayer = (id: string) => {
    const selected = player(id);
    if (!selected || !window.confirm(`Delete ${selected.name}? Their saved match-history records will be kept.`)) return;
    update((current) => {
      const players = current.players.filter((item) => item.id !== id);
      return { ...current, players, teams: current.match.status === "setup" ? reconcileTeams(current.teams, players) : current.teams };
    });
    if (editingId === id) setEditingId("");
  };

  const generateTeams = (shuffle = false) => {
    try {
      const first = captain1 || value.teams?.team1.captain || activePlayers[0]?.id || "";
      const second = captain2 || value.teams?.team2.captain || activePlayers.find((item) => item.id !== first)?.id || "";
      const generated = makeBalancedCricketTeams(value.players, first, second, shuffle ? Date.now() : 1);
      if (value.teams) {
        generated.team1.name = value.teams.team1.name;
        generated.team2.name = value.teams.team2.name;
        generated.team1.flag = value.teams.team1.flag;
        generated.team2.flag = value.teams.team2.flag;
      }
      update((current) => ({ ...current, teams: generated, match: emptyCricketMatch() }));
      setCaptain1(first); setCaptain2(second); setFormError("");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Could not generate teams."); }
  };

  const teamFor = (number: 1 | 2) => number === 1 ? value.teams?.team1 : value.teams?.team2;
  const starterIds = (number: 1 | 2) => {
    const team = teamFor(number);
    return team ? team.ids.filter((id) => !(team.substitutes || []).includes(id)) : [];
  };
  const roleOptionsForBowling = (ids: string[]) => {
    const preferred = ids.filter((id) => ["Bowler", "All-rounder"].includes(player(id)?.role || ""));
    return preferred.length ? preferred : ids;
  };
  const firstAvailableBatter = (teamNumber: 1 | 2, dismissed: string[] = []) => starterIds(teamNumber).find((id) => !dismissed.includes(id)) || "";
  const firstAvailableBowler = (teamNumber: 1 | 2) => roleOptionsForBowling(starterIds(teamNumber))[0] || "";

  const hostMatch = () => {
    if (!value.teams) return;
    const batting = value.match.battingFirst;
    const bowling = batting === 1 ? 2 : 1;
    const battingIds = starterIds(batting);
    update((current) => ({ ...current, tab: "match", match: { ...current.match, status: "live", inningsNumber: 1, innings: [{ battingTeam: batting, runs: 0, wickets: 0, balls: 0, deliveries: [] }], strikerId: battingIds[0] || "", nonStrikerId: battingIds[1] || "", bowlerId: firstAvailableBowler(bowling), startedAt: new Date().toISOString(), completedAt: undefined, result: undefined } }));
    setMatchTab("timeline");
  };

  const scheduleMatch = (scheduledFor = value.match.scheduledFor) => {
    const kickoff = scheduledFor;
    if (!kickoff || !Number.isFinite(Date.parse(kickoff)) || Date.parse(kickoff) <= Date.now()) { setFormError("Choose a kickoff time in the future, or host the match now."); return; }
    update((current) => ({ ...current, tab: "match", match: { ...current.match, status: "scheduled", scheduledFor: kickoff, innings: [], strikerId: "", nonStrikerId: "", bowlerId: "", startedAt: undefined, completedAt: undefined, result: undefined } }));
    setMatchTab("timeline");
    setFormError("");
  };

  const resultFor = (innings: CricketInnings[], battingTeam: 1 | 2, score: number, wickets: number) => {
    if (!value.teams || innings.length < 2) return "Match complete";
    const first = innings[0];
    const target = first.runs + 1;
    const battingName = teamFor(battingTeam)?.name || `Team ${battingTeam}`;
    const defendingTeam = battingTeam === 1 ? 2 : 1;
    const defendingName = teamFor(defendingTeam)?.name || `Team ${defendingTeam}`;
    if (score >= target) {
      const wicketsAvailable = Math.max(1, (teamFor(battingTeam)?.ids.length || 11) - 1);
      const margin = Math.max(1, wicketsAvailable - wickets);
      return `${battingName} won by ${margin} wicket${margin === 1 ? "" : "s"}`;
    }
    if (score === first.runs) return "Match tied";
    const margin = first.runs - score;
    return `${defendingName} won by ${margin} run${margin === 1 ? "" : "s"}`;
  };

  const recordDelivery = (kind: CricketDeliveryKind, runs: number, legal: boolean) => {
    if (!unlocked || value.match.status !== "live" || !value.teams) return;
    update((current) => {
      if (!current.teams || current.match.status !== "live") return current;
      const index = current.match.inningsNumber - 1;
      const innings = current.match.innings[index];
      if (!innings) return current;
      const batter = current.players.find((item) => item.id === current.match.strikerId);
      const bowler = current.players.find((item) => item.id === current.match.bowlerId);
      const nextRuns = innings.runs + runs;
      const nextWickets = innings.wickets + (kind === "wicket" ? 1 : 0);
      const nextBalls = innings.balls + (legal ? 1 : 0);
      const templateList = COMMENTARY[kind];
      const commentary = templateList[innings.deliveries.length % templateList.length](batter?.name || "The batter", bowler?.name || "The bowler", runs);
      const delivery = {
        id: globalThis.crypto?.randomUUID?.() || `ball-${Date.now()}-${innings.deliveries.length}`,
        innings: current.match.inningsNumber,
        over: Math.floor(innings.balls / 6),
        ball: innings.balls % 6 + 1,
        legal,
        kind,
        runs,
        batterId: current.match.strikerId,
        nonStrikerId: current.match.nonStrikerId,
        bowlerId: current.match.bowlerId,
        commentary,
      } as const;
      const updatedInnings = { ...innings, runs: nextRuns, wickets: nextWickets, balls: nextBalls, deliveries: [...innings.deliveries, delivery] };
      const updatedInningsList = current.match.innings.map((item, itemIndex) => itemIndex === index ? updatedInnings : item);
      const battingTeam = current.teams[innings.battingTeam === 1 ? "team1" : "team2"];
      const battingIds = battingTeam.ids.filter((id) => !(battingTeam.substitutes || []).includes(id));
      const allOutAt = Math.max(1, battingIds.length - 1);
      const target = current.match.inningsNumber === 2 ? (current.match.innings[0]?.runs || 0) + 1 : Number.POSITIVE_INFINITY;
      const finished = nextBalls >= current.match.overs * 6 || nextWickets >= allOutAt || nextRuns >= target;
      let strikerId = current.match.strikerId;
      let nonStrikerId = current.match.nonStrikerId;
      if (kind === "wicket") {
        const dismissed = updatedInnings.deliveries.filter((item) => item.kind === "wicket").map((item) => item.batterId);
        strikerId = battingIds.find((id) => id !== nonStrikerId && !dismissed.includes(id)) || strikerId;
      } else if (runs % 2 === 1 && nonStrikerId) {
        [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
      }
      let bowlerId = current.match.bowlerId;
      if (legal && nextBalls % 6 === 0) {
        if (nonStrikerId) [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
        const bowlingTeam = innings.battingTeam === 1 ? current.teams.team2 : current.teams.team1;
        const options = roleOptionsForBowling(bowlingTeam.ids.filter((id) => !(bowlingTeam.substitutes || []).includes(id)));
        const currentIndex = Math.max(0, options.indexOf(bowlerId));
        bowlerId = options[(currentIndex + 1) % Math.max(1, options.length)] || bowlerId;
      }
      if (!finished) return { ...current, match: { ...current.match, innings: updatedInningsList, strikerId, nonStrikerId, bowlerId } };
      if (current.match.inningsNumber === 1) return { ...current, match: { ...current.match, status: "innings-break", innings: updatedInningsList, strikerId: "", nonStrikerId: "", bowlerId: "" } };
      return { ...current, match: { ...current.match, status: "complete", innings: updatedInningsList, strikerId: "", nonStrikerId: "", bowlerId: "", completedAt: new Date().toISOString(), result: resultFor(updatedInningsList, innings.battingTeam, nextRuns, nextWickets) } };
    });
  };

  const startSecondInnings = () => {
    if (!value.teams || value.match.status !== "innings-break") return;
    const batting = value.match.battingFirst === 1 ? 2 : 1;
    const bowling = batting === 1 ? 2 : 1;
    const battingIds = starterIds(batting);
    update((current) => ({ ...current, match: { ...current.match, status: "live", inningsNumber: 2, innings: [...current.match.innings.slice(0, 1), { battingTeam: batting, runs: 0, wickets: 0, balls: 0, deliveries: [] }], strikerId: battingIds[0] || "", nonStrikerId: battingIds[1] || "", bowlerId: firstAvailableBowler(bowling) } }));
  };

  const endInnings = () => {
    if (value.match.status !== "live") return;
    if (value.match.inningsNumber === 1) update((current) => ({ ...current, match: { ...current.match, status: "innings-break", strikerId: "", nonStrikerId: "", bowlerId: "" } }));
    else {
      const innings = value.match.innings[1];
      update((current) => ({ ...current, match: { ...current.match, status: "complete", completedAt: new Date().toISOString(), strikerId: "", nonStrikerId: "", bowlerId: "", result: resultFor(current.match.innings, innings.battingTeam, innings.runs, innings.wickets) } }));
    }
  };

  const undoDelivery = () => update((current) => {
    const index = current.match.inningsNumber - 1;
    const innings = current.match.innings[index];
    if (!innings?.deliveries.length) return current;
    const removed = innings.deliveries.at(-1)!;
    const deliveries = innings.deliveries.slice(0, -1);
    const rebuilt = deliveries.reduce((result, item) => ({ runs: result.runs + item.runs, wickets: result.wickets + (item.kind === "wicket" ? 1 : 0), balls: result.balls + (item.legal ? 1 : 0) }), { runs: 0, wickets: 0, balls: 0 });
    const updated = { ...innings, ...rebuilt, deliveries };
    const inningsList = current.match.innings.map((item, itemIndex) => itemIndex === index ? updated : item);
    return { ...current, match: { ...current.match, status: "live", innings: inningsList, completedAt: undefined, result: undefined, strikerId: removed.batterId, nonStrikerId: removed.nonStrikerId, bowlerId: removed.bowlerId } };
  });

  const PlayersView = () => <>
    {unlocked && <section className="sec cricket-player-form"><h2>Add a cricket player</h2>
      <label>Name</label><input value={draft.name} maxLength={60} autoComplete="off" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Player name" />
      <label>Rating, 0.5–10 (optional)</label><CricketRatingPicker value={draft.rating} onChange={(rating) => setDraft((current) => ({ ...current, rating, customOverall: rating ? "" : current.customOverall }))} />
      <label>Custom OVR (optional)</label><input type="number" inputMode="numeric" min="1" max="99" step="1" value={draft.customOverall} onChange={(event) => setDraft((current) => ({ ...current, customOverall: event.target.value, rating: event.target.value ? 0 : current.rating }))} placeholder="Auto calculated" /><p className="note">A custom OVR replaces the rating. Leave both blank for an unrated player.</p>
      <div className="row2"><div><label>Primary role</label><select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as CricketPlayer["role"] }))}>{CRICKET_ROLES.map((role) => <option key={role}>{role}</option>)}</select></div><div><label>Batting hand</label><select value={draft.batting} onChange={(event) => setDraft((current) => ({ ...current, batting: event.target.value as CricketPlayer["batting"] }))}><option>Right hand</option><option>Left hand</option></select></div></div>
      <div className="row2"><div><label>Bowling style</label><input value={draft.bowling} maxLength={50} onChange={(event) => setDraft((current) => ({ ...current, bowling: event.target.value }))} placeholder="Right-arm fast, left-arm spin…" /></div><div><label>Flag or country code</label><input value={draft.flag} maxLength={200} onChange={(event) => setDraft((current) => ({ ...current, flag: event.target.value }))} placeholder="PK" /></div></div>
      <label>Cricket attributes <small className="label-note">Changing these recalculates OVR</small></label><div className="cricket-attribute-inputs">{CRICKET_STAT_NAMES.map((label) => <div key={label}><span>{label}</span><input type="number" min="1" max="99" step="1" value={draft.stats[label]} onChange={(event) => { const statValue = event.target.value; setDraft((current) => ({ ...current, stats: { ...current.stats, [label]: statValue } })); }} placeholder="Auto" /></div>)}</div><p className="note">Blank attributes use role-based values. Custom OVR, when entered, remains the final override.</p>
      <label>Card design</label><div className="design-picker cricket-design-picker">{CRICKET_CARD_STYLES.map((style) => <button type="button" key={style} className={draft.cardStyle === style ? "on" : ""} onClick={() => setDraft((current) => ({ ...current, cardStyle: style }))}><img src={CARD_DESIGNS[style].image} alt="" /><span>{CARD_DESIGNS[style].name}</span></button>)}</div>
      <label>Player photo (optional)</label><div className="photo-field">{draft.image ? <img src={draft.image} alt="New player preview" /> : <span className="mini-silhouette"><span /></span>}<label className="b line photo-button">{uploading ? "Uploading…" : draft.image ? "Change photo" : "Add photo"}<input type="file" accept="image/*" disabled={uploading} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); setFormError(""); try { const image = await uploadPlayerImage(file); setDraft((current) => ({ ...current, image })); } catch (error) { setFormError(error instanceof Error ? error.message : "Upload failed."); } finally { setUploading(false); event.target.value = ""; } }} /></label>{draft.image && <button className="b line sm" type="button" onClick={() => setDraft((current) => ({ ...current, image: "" }))}>Remove</button>}</div>
      <p className="note" aria-live="polite">{formError}</p><button className="b pri" type="button" disabled={uploading} onClick={savePlayer}>Add player</button>
    </section>}
    <section className="sec top-rule"><h2>Cricket squad · {activePlayers.length} active of {value.players.length}</h2><p className="note">{unlocked ? "Tap Active to switch off an unavailable player. Inactive players are skipped when teams are made." : "View-only player cards. Admin login is required to add, rate or edit players."}</p>
      {!value.players.length ? <div className="empty">No cricket players yet.</div> : <div className="player-grid">{value.players.map((item) => <div className="player-card-wrap" key={item.id}><CricketPlayerCard player={item}>{unlocked && <><button className="b sm line" onClick={() => editPlayer(item)}>{editingId === item.id ? "Done" : "Rate"}</button><button className={`b sm ${item.active ? "" : "line"}`} onClick={() => togglePlayer(item.id)}>{item.active ? "Active" : "Set active"}</button><button className="b sm danger line" onClick={() => deletePlayer(item.id)}>Delete</button></>}</CricketPlayerCard>
        {unlocked && editingId === item.id && <div className="edit-block card-editor">
          <label>Player name</label><input defaultValue={item.name} maxLength={60} autoComplete="off" onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (!name) { event.currentTarget.value = item.name; window.alert("Player name cannot be empty."); return; } if (name !== item.name) updatePlayer(item.id, { name }); }} />
          <label>Rating, 0.5–10</label><CricketRatingPicker value={item.rating} onChange={(rating) => updatePlayer(item.id, { rating, ...(rating ? { customOverall: undefined } : {}) })} />
          <label>Custom OVR (optional)</label><input key={`${item.id}-${item.customOverall || "auto"}`} type="number" inputMode="numeric" min="1" max="99" step="1" defaultValue={item.customOverall || ""} placeholder="Auto calculated" onChange={(event) => { if (event.currentTarget.value && item.rating) updatePlayer(item.id, { rating: 0 }); }} onBlur={(event) => { const raw = event.currentTarget.value.trim(); const customOverall = raw ? Number(raw) : undefined; if (raw && (!Number.isInteger(customOverall) || customOverall! < 1 || customOverall! > 99)) { event.currentTarget.value = item.customOverall ? String(item.customOverall) : ""; window.alert("Custom OVR must be a whole number from 1 to 99."); return; } updatePlayer(item.id, { customOverall, ...(customOverall ? { rating: 0 } : {}) }); }} />
          <div className="row2"><div><label>Primary role</label><select value={item.role} onChange={(event) => updatePlayer(item.id, { role: event.target.value as CricketPlayer["role"] })}>{CRICKET_ROLES.map((role) => <option key={role}>{role}</option>)}</select></div><div><label>Batting hand</label><select value={item.batting} onChange={(event) => updatePlayer(item.id, { batting: event.target.value as CricketPlayer["batting"] })}><option>Right hand</option><option>Left hand</option></select></div></div>
          <div className="row2"><div><label>Bowling style</label><input value={item.bowling} maxLength={50} onChange={(event) => updatePlayer(item.id, { bowling: event.target.value })} /></div><div><label>Flag or country code</label><input value={item.flag || "PK"} maxLength={200} onChange={(event) => updatePlayer(item.id, { flag: event.target.value })} /></div></div>
          <label>Cricket attributes <small className="label-note">Changing these recalculates OVR</small></label><div className="cricket-attribute-inputs">{CRICKET_STAT_NAMES.map((label) => <div key={label}><span>{label}</span><input type="number" min="1" max="99" step="1" value={item.stats?.[label] || ""} placeholder="Auto" onChange={(event) => { const number = Number(event.target.value); updatePlayer(item.id, { stats: { ...item.stats, [label]: Number.isInteger(number) && number >= 1 && number <= 99 ? number : undefined } }); }} /></div>)}</div><p className="note">Blank attributes use role-based values. Custom OVR, when entered, remains the final override.</p>
          <label>Card design</label><div className="design-picker is-small cricket-design-picker">{CRICKET_CARD_STYLES.map((style) => <button type="button" key={style} className={item.cardStyle === style ? "on" : ""} onClick={() => updatePlayer(item.id, { cardStyle: style })}><img src={CARD_DESIGNS[style].image} alt="" /><span>{CARD_DESIGNS[style].name}</span></button>)}</div>
          <label>Player photo</label><div className="photo-edit-row"><label className="b line sm photo-button">{item.image ? "Change photo" : "Add photo"}<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { updatePlayer(item.id, { image: await uploadPlayerImage(file) }); } catch (error) { window.alert(error instanceof Error ? error.message : "Could not add that image."); } event.target.value = ""; }} /></label>{item.image && <button className="b line sm" onClick={() => updatePlayer(item.id, { image: undefined })}>Remove photo</button>}</div>
        </div>}
      </div>)}</div>}
    </section>
  </>;

  const TeamView = () => {
    const saved = value.teams;
    const firstCaptain = saved?.team1.captain || captain1;
    const secondCaptain = saved?.team2.captain || captain2;
    const assigned = new Set(saved ? [...saved.team1.ids, ...saved.team2.ids] : []);
    const unassigned = activePlayers.filter((item) => !assigned.has(item.id)).sort((a, b) => cricketOverall(b) - cricketOverall(a));
    const draftTeam: "team1" | "team2" = saved && Math.max(0, saved.team1.ids.length + saved.team2.ids.length - 2) % 2 === 1 ? "team2" : "team1";
    const captainsReady = () => {
      if (!firstCaptain || !secondCaptain) { window.alert("Choose both captains first."); return false; }
      if (firstCaptain === secondCaptain) { window.alert("Choose two different captains."); return false; }
      return true;
    };
    const updateTeam = (key: "team1" | "team2", patch: Partial<NonNullable<CricketState["teams"]>["team1"]>) => update((current) => current.teams ? { ...current, teams: { ...current.teams, cost: -1, [key]: { ...current.teams[key], ...patch } } } : current);
    const startManualPick = () => {
      if (!captainsReady()) return;
      update((current) => ({ ...current, teams: { team1: { name: current.teams?.team1.name || "Team 1", flag: current.teams?.team1.flag, ids: [firstCaptain], captain: firstCaptain, substitutes: [] }, team2: { name: current.teams?.team2.name || "Team 2", flag: current.teams?.team2.flag, ids: [secondCaptain], captain: secondCaptain, substitutes: [] }, seed: Date.now(), cost: -1 }, match: emptyCricketMatch() }));
    };
    const assignPlayer = (id: string, destination: "team1" | "team2") => update((current) => {
      if (!current.teams) return current;
      const source: "team1" | "team2" = current.teams.team1.ids.includes(id) ? "team1" : "team2";
      if (current.teams[source].ids.includes(id) && current.teams[source].captain === id) return current;
      const sourceIds = current.teams[source].ids.filter((playerId) => playerId !== id);
      const destinationIds = [...new Set([...current.teams[destination].ids, id])];
      return { ...current, teams: { ...current.teams, cost: -1, [source]: { ...current.teams[source], ids: sourceIds, substitutes: (current.teams[source].substitutes || []).filter((playerId) => playerId !== id) }, [destination]: { ...current.teams[destination], ids: destinationIds, substitutes: (current.teams[destination].substitutes || []).filter((playerId) => playerId !== id) } } };
    });
    const pickUnassigned = (id: string) => update((current) => current.teams ? { ...current, teams: { ...current.teams, cost: -1, [draftTeam]: { ...current.teams[draftTeam], ids: [...current.teams[draftTeam].ids, id] } } } : current);
    const toggleSubstitute = (key: "team1" | "team2", id: string) => {
      if (!saved) return;
      const team = saved[key]; const substitutes = team.substitutes || []; const isSubstitute = substitutes.includes(id);
      if (!isSubstitute && team.captain === id) { window.alert("Choose another captain before moving this player to the bench."); return; }
      if (isSubstitute && team.ids.length - substitutes.length >= 11) { window.alert("A cricket lineup can have at most 11 starters."); return; }
      updateTeam(key, { substitutes: isSubstitute ? substitutes.filter((playerId) => playerId !== id) : [...substitutes, id] });
    };
    const changeFlag = async (key: "team1" | "team2", file?: File) => {
      if (!file) return;
      setTeamFlagUploading(key);
      try { updateTeam(key, { flag: await uploadTeamFlag(file) }); } catch (error) { window.alert(error instanceof Error ? error.message : "The team flag could not be uploaded."); } finally { setTeamFlagUploading(""); }
    };
    const deleteTeams = () => {
      if (!window.confirm("Delete both generated teams? Players and saved match history will be kept.")) return;
      update((current) => ({ ...current, teams: null, match: emptyCricketMatch() })); setCaptain1(""); setCaptain2("");
    };
    const teamCard = (key: "team1" | "team2") => {
      if (!saved) return null;
      const team = saved[key]; const other = key === "team1" ? "team2" : "team1"; const number = key === "team1" ? 1 : 2;
      const roster = team.ids.map((id) => player(id)).filter((item): item is CricketPlayer => Boolean(item));
      const substitutes = team.substitutes || []; const average = roster.length ? Math.round(roster.reduce((sum, item) => sum + cricketOverall(item), 0) / roster.length * 10) / 10 : 0;
      const flag = flagSource(team.flag);
      return <article className="card balanced-team-card">{unlocked ? <div className="team-identity-fields"><div><label>Team {number} name</label><input value={team.name} onChange={(event) => updateTeam(key, { name: event.target.value })} /></div><div><label>Team flag</label><div className="team-flag-field"><span className="team-flag-preview">{flag ? <img src={flag} alt={`${team.name} flag`} /> : initials(team.name)}</span><div className="team-flag-actions"><label className="b line sm photo-button">{teamFlagUploading === key ? "Uploading…" : team.flag ? "Replace PNG" : "Upload PNG"}<input type="file" accept="image/png,.png" disabled={Boolean(teamFlagUploading)} onChange={(event) => { const file = event.target.files?.[0]; void changeFlag(key, file); event.target.value = ""; }} /></label>{team.flag && <button className="b line sm" onClick={() => updateTeam(key, { flag: undefined })}>Remove</button>}</div></div></div></div> : <h3 className="public-team-name"><span className="team-name-flag">{flag ? <img src={flag} alt="" /> : initials(team.name)}</span>{team.name}</h3>}
        <p className="note">{roster.length} players · Avg {average} OVR</p><p className="formation-label">Playing XI: {team.ids.length - substitutes.length}{substitutes.length ? ` · ${substitutes.length} substitute${substitutes.length === 1 ? "" : "s"}` : ""}</p>
        <div className="roster-list">{roster.map((item) => { const isSub = substitutes.includes(item.id); return <div className="roster-entry" key={item.id}><div className="roster-row"><span className="roster-player-button"><span className="roster-avatar">{item.image ? <img src={item.image} alt="" /> : initials(item.name)}</span><span className="roster-copy"><strong>{item.name}{team.captain === item.id && <span className="cp"> (C)</span>}</strong><small>{item.role} · {cricketOverall(item) || "–"} OVR · {item.batting}</small></span></span>{unlocked && <div className="roster-actions"><span className={`lineup-role${isSub ? " is-sub" : ""}`}>{isSub ? "SUB" : "XI"}</span><select aria-label={`${item.name} captain status`} value={team.captain === item.id ? item.id : ""} onChange={() => updateTeam(key, { captain: item.id })}><option value="">Player</option><option value={item.id}>Captain</option></select>{value.match.status === "setup" && <button className="b line sm" onClick={() => toggleSubstitute(key, item.id)}>{isSub ? "Make starter" : "Move to bench"}</button>}{value.match.status === "setup" && team.captain !== item.id && <button className="b line sm" onClick={() => assignPlayer(item.id, other)}>Move</button>}</div>}</div></div>; })}</div>
      </article>;
    };
    return <>
      {unlocked ? <section className="sec"><h2>Set up two cricket teams</h2><p className="note">Choose two captains, then balance every active player by OVR and cricket role coverage.</p><div className="row2 captain-selects"><div><label>Team 1 captain</label><select value={firstCaptain} disabled={Boolean(saved)} onChange={(event) => setCaptain1(event.target.value)}><option value="">Choose captain…</option>{activePlayers.filter((item) => item.id !== secondCaptain).map((item) => <option key={item.id} value={item.id}>{item.name} ({cricketOverall(item) || "unrated"})</option>)}</select></div><div><label>Team 2 captain</label><select value={secondCaptain} disabled={Boolean(saved)} onChange={(event) => setCaptain2(event.target.value)}><option value="">Choose captain…</option>{activePlayers.filter((item) => item.id !== firstCaptain).map((item) => <option key={item.id} value={item.id}>{item.name} ({cricketOverall(item) || "unrated"})</option>)}</select></div></div>
        {!saved ? <div className="button-row"><button className="b pri" disabled={activePlayers.length < 2} onClick={() => generateTeams(false)}>Auto-pick balanced teams</button><button className="b line" disabled={activePlayers.length < 2} onClick={startManualPick}>Pick manually</button></div> : <div className="button-row"><button className="b" onClick={() => generateTeams(true)}>Shuffle again</button><button className="b line" onClick={deleteTeams}>Delete generated teams</button></div>}{formError && <p className="access-error">{formError}</p>}
      </section> : !saved && <section className="sec"><h2>No teams yet</h2><p className="empty">An admin can log in and create the next two teams.</p></section>}
      {saved && <section className="sec top-rule"><h2>{unlocked ? "Edit teams and playing XI" : "Teams"}</h2><p className="note">{unlocked ? "Move players between sides, choose captains, upload team flags, and set the playing XI or bench before hosting." : "View the current cricket squads and playing XIs."}</p>
        <div className="row2 balanced-team-grid">{teamCard("team1")}{teamCard("team2")}</div>
        {unassigned.length > 0 && <div className="unassigned-card"><h2>Players waiting to be picked · {unassigned.length}</h2><p className="note">Captains take turns. Pick one player for the highlighted side.</p><div className="roster-list">{unassigned.map((item) => <div className="roster-entry" key={item.id}><div className="roster-row"><span className="roster-player-button"><span className="roster-avatar">{item.image ? <img src={item.image} alt="" /> : initials(item.name)}</span><span className="roster-copy"><strong>{item.name}</strong><small>{item.role} · {cricketOverall(item) || "–"} OVR</small></span></span>{unlocked && <div className="roster-actions"><button className="b sm pri" onClick={() => pickUnassigned(item.id)}>Pick for {saved[draftTeam].name}</button></div>}</div></div>)}</div></div>}
        {unlocked && value.match.status === "setup" && !unassigned.length && <div className="match-host-card"><h3>Host this cricket match</h3><p className="note">Start now or schedule a kickoff. A scheduled match waits for an admin to start it.</p><div className="row2"><div><label>Overs per innings</label><select value={value.match.overs} onChange={(event) => update((current) => ({ ...current, match: { ...current.match, overs: Number(event.target.value) } }))}>{[1, 2, 5, 10, 20, 50].map((overs) => <option key={overs} value={overs}>{overs} overs</option>)}</select></div><div><label>Batting first</label><select value={value.match.battingFirst} onChange={(event) => update((current) => ({ ...current, match: { ...current.match, battingFirst: Number(event.target.value) === 2 ? 2 : 1 } }))}><option value={1}>{saved.team1.name}</option><option value={2}>{saved.team2.name}</option></select></div></div><div className="button-row"><button className="b pri" disabled={!starterIds(1).length || !starterIds(2).length} onClick={hostMatch}>Host now</button></div><label>Schedule kickoff</label><div className="schedule-row"><input type="datetime-local" value={scheduleInput} onChange={(event) => setScheduleInput(event.target.value)} /><button className="b line" disabled={!scheduleInput} onClick={() => { const kickoff = new Date(scheduleInput); if (!Number.isFinite(kickoff.getTime())) return; scheduleMatch(kickoff.toISOString()); }}>Schedule match</button></div></div>}
        {unlocked && value.match.status !== "setup" && <div className="match-host-card"><h3>Match already hosted</h3><p className="note">Finish or delete the current match before hosting another one.</p><button className="b pri" onClick={() => update((current) => ({ ...current, tab: "match" }))}>Open current match</button></div>}
      </section>}
    </>;
  };

  const historyPlayer = (entry: CricketHistoryEntry, id: string) => [...entry.team1.players, ...entry.team2.players].find((item) => item.id === id);

  const HistoryView = () => <section className="sec match-history"><h2>Match history</h2>{value.history.length ? value.history.map((entry) => {
    const open = openHistoryId === entry.id;
    const first = entry.innings.find((innings) => innings.battingTeam === 1);
    const second = entry.innings.find((innings) => innings.battingTeam === 2);
    return <article className={`history-card${open ? " is-open" : ""}`} key={entry.id}><button className="history-summary" aria-expanded={open} onClick={() => setOpenHistoryId(open ? "" : entry.id)}><span className="history-date">{new Date(entry.endedAt).toLocaleDateString()}</span><span className="history-score"><span className="history-team-label"><CricketTeamMark name={entry.team1.name} flag={entry.team1.flag} className="history-mini-flag" />{entry.team1.name}</span><strong>{first?.runs || 0}/{first?.wickets || 0} – {second?.runs || 0}/{second?.wickets || 0}</strong><span className="history-team-label"><CricketTeamMark name={entry.team2.name} flag={entry.team2.flag} className="history-mini-flag" />{entry.team2.name}</span></span><span className="history-result">Complete <b>{open ? "⌃" : "⌄"}</b></span></button>
      {open && <div className="history-detail"><div className="history-fulltime">Match complete · {new Date(entry.endedAt).toLocaleString()} · {entry.overs} overs</div><div className="history-detail-score"><div><CricketTeamMark name={entry.team1.name} flag={entry.team1.flag} /><span>{entry.team1.name}</span></div><strong>{first?.runs || 0}/{first?.wickets || 0} <i>–</i> {second?.runs || 0}/{second?.wickets || 0}</strong><div><CricketTeamMark name={entry.team2.name} flag={entry.team2.flag} /><span>{entry.team2.name}</span></div></div><p className="history-motm"><strong>{entry.result}</strong></p><div className="history-lineups"><div><h3>{entry.team1.name}</h3>{entry.team1.players.map((item) => <div className="history-player" key={item.id}><span className="history-position">{entry.team1.substitutes.includes(item.id) ? "SUB" : "XI"}</span><span className="history-player-name">{item.name}</span>{item.id === entry.team1.captain && <span>Captain</span>}</div>)}</div><div><h3>{entry.team2.name}</h3>{entry.team2.players.map((item) => <div className="history-player" key={item.id}><span className="history-position">{entry.team2.substitutes.includes(item.id) ? "SUB" : "XI"}</span><span className="history-player-name">{item.name}</span>{item.id === entry.team2.captain && <span>Captain</span>}</div>)}</div></div><div className="cricket-commentary">{entry.innings.flatMap((innings) => innings.deliveries).slice().reverse().map((delivery) => <article className={`cricket-commentary-card is-${delivery.kind}`} key={delivery.id}><div><strong>{delivery.over}.{delivery.ball}</strong><span>{delivery.kind.toUpperCase()}</span><b>Innings {delivery.innings}</b></div><p>{delivery.commentary}</p><small>{historyPlayer(entry, delivery.batterId)?.name || "Batter"} facing {historyPlayer(entry, delivery.bowlerId)?.name || "Bowler"}</small></article>)}</div></div>}
      {unlocked && <button className="b line sm history-delete" onClick={() => { if (!window.confirm("Delete this cricket match from history?")) return; update((current) => ({ ...current, history: current.history.filter((item) => item.id !== entry.id) })); }}>Delete match</button>}
    </article>;
  }) : <div className="empty">Ended cricket matches will be saved here.</div>}</section>;

  const saveCompletedMatch = () => {
    if (!value.teams || value.match.status !== "complete") return;
    if (!window.confirm("Save this completed cricket match to history?")) return;
    const snapshot = (number: 1 | 2) => {
      const team = teamFor(number)!;
      return { name: team.name, flag: team.flag, captain: team.captain, substitutes: team.substitutes || [], players: team.ids.map((id) => player(id)).filter((item): item is CricketPlayer => Boolean(item)).map((item) => ({ id: item.id, name: item.name, role: item.role, batting: item.batting, bowling: item.bowling, image: item.image, flag: item.flag })) };
    };
    const entry: CricketHistoryEntry = { id: globalThis.crypto?.randomUUID?.() || `cricket-match-${Date.now()}`, endedAt: value.match.completedAt || new Date().toISOString(), scheduledFor: value.match.scheduledFor, overs: value.match.overs, result: value.match.result || "Match complete", team1: snapshot(1), team2: snapshot(2), innings: value.match.innings };
    update((current) => ({ ...current, match: emptyCricketMatch(), history: [entry, ...current.history].slice(0, 100) }));
    setMatchTab("history");
  };

  const CurrentLineups = () => <section className="sec"><div className="history-lineups">{([1, 2] as const).map((number) => { const team = teamFor(number)!; return <div key={number}><h3><CricketTeamMark name={team.name} flag={team.flag} />{team.name}</h3>{team.ids.map((id) => { const item = player(id); if (!item) return null; return <div className="history-player" key={id}><span className="history-position">{(team.substitutes || []).includes(id) ? "SUB" : "XI"}</span><span className="history-player-name">{item.name}</span><span>{team.captain === id ? "Captain" : item.role}</span></div>; })}</div>; })}</div></section>;

  const CurrentStats = () => {
    const deliveries = value.match.innings.flatMap((innings) => innings.deliveries);
    const ids = value.teams ? [...value.teams.team1.ids, ...value.teams.team2.ids] : [];
    return <section className="sec stats-table"><table><thead><tr><th>Player</th><th>Runs</th><th>Balls</th><th>Wickets</th><th>Conceded</th></tr></thead><tbody>{ids.map((id) => { const item = player(id); const faced = deliveries.filter((delivery) => delivery.batterId === id); const bowled = deliveries.filter((delivery) => delivery.bowlerId === id); return <tr key={id}><td>{item?.name}</td><td>{faced.reduce((sum, delivery) => sum + delivery.runs, 0)}</td><td>{faced.filter((delivery) => delivery.legal).length}</td><td>{bowled.filter((delivery) => delivery.kind === "wicket").length}</td><td>{bowled.reduce((sum, delivery) => sum + delivery.runs, 0)}</td></tr>; })}</tbody></table></section>;
  };

  const MatchView = () => {
    if (!value.teams) return <><section className="cricket-panel"><div className="cricket-hero"><div className="cricket-hero-copy"><p className="cricket-kicker"><span /> Shared cricket mode</p><h1>Cricket match centre</h1><p>Generate the two cricket teams before hosting a match.</p><div className="cricket-mode-note">{unlocked ? "Open the Team tab to create balanced sides." : "Waiting for the administrator to prepare the teams."}</div></div><div className="cricket-emblem" aria-hidden="true"><span className="cricket-ball" /><span className="cricket-bat" /><span className="cricket-wickets"><i /><i /><i /></span></div></div></section>{HistoryView()}</>;
    if (value.match.status === "setup") return <><section className="sec"><h2>No active cricket match</h2><p className="empty">Your teams are ready. Host a match from the Team tab when everyone is ready to play.</p><button className="b pri" onClick={() => update((current) => ({ ...current, tab: "team" }))}>Review teams and host match</button></section>{HistoryView()}</>;
    if (value.match.status === "scheduled") {
      const due = Boolean(value.match.scheduledFor && Date.parse(value.match.scheduledFor) <= now);
      return <><section className="sec"><div className="cricket-score-preview"><div><small>Team 1</small><strong>{value.teams.team1.name}</strong></div><span><b>VS</b><small>{due ? "Kickoff due" : "Scheduled"}</small></span><div><small>Team 2</small><strong>{value.teams.team2.name}</strong></div></div><div className="card cricket-scheduled-card"><p className="cricket-kicker"><span /> Scheduled cricket match</p><h2>{formatKickoff(value.match.scheduledFor)}</h2><p className="note">The innings will not begin automatically. {due ? "Kickoff time has arrived; the match is delayed until the administrator starts it." : "The administrator can start play when kickoff arrives."}</p>{unlocked && <div className="button-row"><button className="b pri" disabled={!due} onClick={hostMatch}>{due ? "Start match" : "Waiting for kickoff"}</button><button className="b line" onClick={() => update((current) => ({ ...current, tab: "team", match: { ...current.match, status: "setup" } }))}>Edit schedule</button><button className="b line danger" onClick={() => { if (window.confirm("Delete this scheduled match?")) update((current) => ({ ...current, match: emptyCricketMatch() })); }}>Delete match</button></div>}</div></section>{HistoryView()}</>;
    }

    const current = value.match.innings[value.match.inningsNumber - 1] || value.match.innings.at(-1);
    const first = value.match.innings[0];
    const battingName = current ? teamFor(current.battingTeam)?.name : "";
    const bowlingTeam = current?.battingTeam === 1 ? 2 : 1;
    const target = value.match.inningsNumber === 2 && first ? first.runs + 1 : null;
    const allDeliveries = value.match.innings.flatMap((innings) => innings.deliveries).slice().reverse();
    const scoreAfterDelivery = new Map<string, string>();
    value.match.innings.forEach((innings) => {
      let runs = 0; let wickets = 0;
      innings.deliveries.forEach((delivery) => {
        runs += delivery.runs;
        if (delivery.kind === "wicket") wickets += 1;
        scoreAfterDelivery.set(delivery.id, `${runs}/${wickets}`);
      });
    });
    return <>
      <section className="cricket-live-head">
        <p>{value.match.status === "complete" ? "MATCH COMPLETE" : value.match.status === "innings-break" ? "INNINGS BREAK" : `LIVE · ${value.match.overs} OVERS`}</p>
        <h1>{current?.runs || 0}<small>/{current?.wickets || 0}</small></h1>
        <strong>{battingName} · {cricketOvers(current?.balls || 0)} overs{target ? ` · Target ${target}` : ""}</strong>
        {value.match.result && <div className="cricket-result">{value.match.result}</div>}
      </section>
      {unlocked && value.match.status === "live" && <section className="cricket-scoring-controls">
        <div className="cricket-player-selects"><div><label>Striker</label><select value={value.match.strikerId} onChange={(event) => update((state) => ({ ...state, match: { ...state.match, strikerId: event.target.value } }))}>{starterIds(current.battingTeam).map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div><div><label>Non-striker</label><select value={value.match.nonStrikerId} onChange={(event) => update((state) => ({ ...state, match: { ...state.match, nonStrikerId: event.target.value } }))}><option value="">None</option>{starterIds(current.battingTeam).filter((id) => id !== value.match.strikerId).map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div><div><label>Bowler</label><select value={value.match.bowlerId} onChange={(event) => update((state) => ({ ...state, match: { ...state.match, bowlerId: event.target.value } }))}>{roleOptionsForBowling(starterIds(bowlingTeam)).map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div></div>
        <div className="cricket-run-buttons"><button onClick={() => recordDelivery("dot", 0, true)}>0</button><button onClick={() => recordDelivery("run", 1, true)}>1</button><button onClick={() => recordDelivery("run", 2, true)}>2</button><button onClick={() => recordDelivery("run", 3, true)}>3</button><button className="is-boundary" onClick={() => recordDelivery("four", 4, true)}>4</button><button className="is-six" onClick={() => recordDelivery("six", 6, true)}>6</button><button className="is-wicket" onClick={() => recordDelivery("wicket", 0, true)}>W</button><button className="is-extra" onClick={() => recordDelivery("wide", 1, false)}>Wide</button><button className="is-extra" onClick={() => recordDelivery("no-ball", 1, false)}>No-ball</button></div>
        <div className="button-row"><button className="b line" disabled={!current.deliveries.length} onClick={undoDelivery}>Undo delivery</button><button className="b line" onClick={endInnings}>End innings</button></div>
      </section>}
      {unlocked && value.match.status === "innings-break" && <div className="bar"><button className="b pri" onClick={startSecondInnings}>Start second innings · Target {(first?.runs || 0) + 1}</button><button className="b line" onClick={undoDelivery}>Undo last delivery</button></div>}
      {unlocked && value.match.status === "complete" && <div className="bar"><button className="b pri" onClick={saveCompletedMatch}>End &amp; save match</button><button className="b line" onClick={undoDelivery}>Reopen and undo last delivery</button></div>}
      <nav className="tabs match-tabs">{(["timeline", "lineups", "stats", "history", ...(unlocked ? ["edit" as const] : [])] as CricketMatchTab[]).map((tab) => <button key={tab} className={matchTab === tab ? "on" : ""} onClick={() => setMatchTab(tab)}>{tab}</button>)}</nav>
      {(matchTab === "timeline" || (!unlocked && matchTab === "edit")) && <section className="sec"><h2>Ball-by-ball commentary</h2>{!allDeliveries.length ? <p className="note">No deliveries recorded yet.</p> : <div className="cricket-commentary">{allDeliveries.map((delivery) => <article className={`cricket-commentary-card is-${delivery.kind}`} key={delivery.id}><div><strong>{delivery.over}.{delivery.ball}</strong><span>{delivery.kind === "wicket" ? "WICKET" : delivery.kind === "wide" ? "WIDE" : delivery.kind === "no-ball" ? "NO-BALL" : delivery.runs ? `${delivery.runs} RUN${delivery.runs === 1 ? "" : "S"}` : "DOT BALL"}</span><b>{scoreAfterDelivery.get(delivery.id)}</b></div><p>{delivery.commentary}</p><small>{player(delivery.batterId)?.name || "Batter"} facing {player(delivery.bowlerId)?.name || "Bowler"} · Innings {delivery.innings}</small></article>)}</div>}</section>}
      {matchTab === "lineups" && <CurrentLineups />}
      {matchTab === "stats" && <CurrentStats />}
      {matchTab === "history" && <HistoryView />}
      {unlocked && matchTab === "edit" && <section className="sec"><h2>Match settings</h2><div className="row2"><div><label>Team 1 name</label><input value={value.teams.team1.name} onChange={(event) => { const name = event.target.value; update((state) => state.teams ? { ...state, teams: { ...state.teams, team1: { ...state.teams.team1, name } } } : state); }} /></div><div><label>Team 2 name</label><input value={value.teams.team2.name} onChange={(event) => { const name = event.target.value; update((state) => state.teams ? { ...state, teams: { ...state.teams, team2: { ...state.teams.team2, name } } } : state); }} /></div></div><div className="button-row">{value.match.status === "complete" && <button className="b pri" onClick={saveCompletedMatch}>End &amp; save match</button>}<button className="b line danger" onClick={() => { if (!window.confirm("Delete the current cricket match? Saved history will be kept.")) return; update((state) => ({ ...state, tab: "team", match: emptyCricketMatch() })); setMatchTab("timeline"); }}>Delete current match</button></div></section>}
      {matchTab !== "history" && value.history.length > 0 && <HistoryView />}
    </>;
  };

  return value.tab === "players" ? <PlayersView /> : value.tab === "team" ? <TeamView /> : <MatchView />;
}
