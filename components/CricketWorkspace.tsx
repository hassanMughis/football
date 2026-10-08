"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CRICKET_CARD_STYLES,
  CRICKET_ROLES,
  CricketCardStyle,
  CricketDeliveryKind,
  CricketInnings,
  CricketPlayer,
  CricketState,
  cricketOverall,
  cricketOvers,
  cricketStats,
  emptyCricketMatch,
  makeBalancedCricketTeams,
} from "@/lib/cricket";

const CARD_DESIGNS: Record<CricketCardStyle, { name: string; frame: string; clean: string }> = {
  classic: { name: "Classic Gold", frame: "/card-templates/classic-gold.png", clean: "/card-templates/classic-gold-clean.png" },
  royal: { name: "Royal Gold", frame: "/card-templates/royal-gold.png", clean: "/card-templates/royal-gold-clean.png" },
  electric: { name: "Electric Blue", frame: "/card-templates/electric-blue.png", clean: "/card-templates/electric-blue-clean.png" },
  crimson: { name: "Crimson", frame: "/card-templates/crimson-obsidian.png", clean: "/card-templates/crimson-obsidian-clean.png" },
  eclipse: { name: "Amethyst Eclipse", frame: "/card-templates/eclipse-amethyst.png", clean: "/card-templates/eclipse-amethyst-clean.png" },
  inferno: { name: "Crimson Inferno", frame: "/card-templates/inferno-crimson.png", clean: "/card-templates/inferno-crimson-clean.png" },
  aurora: { name: "Emerald Aurora", frame: "/card-templates/aurora-emerald.png", clean: "/card-templates/aurora-emerald-clean.png" },
  prism: { name: "Holographic Prism", frame: "/card-templates/prism-holographic.png", clean: "/card-templates/prism-holographic-clean.png" },
};

const ROLE_SHORT: Record<CricketPlayer["role"], string> = { Batter: "BAT", Bowler: "BWL", "All-rounder": "AR", Wicketkeeper: "WK" };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase() || "?";
const flagCode = (value?: string) => /^[a-z]{2}$/i.test(value || "") ? value!.toLowerCase() : "";
const flagSource = (value?: string) => flagCode(value) === "pk" ? "/flags/pk.svg" : flagCode(value) ? `https://flagcdn.com/w80/${flagCode(value)}.png` : value && /^(https?:|data:image\/|blob:)/i.test(value) ? value : "";
const datetimeLocalValue = (value?: string) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const formatKickoff = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";

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
};

function CricketPlayerCard({ player, children }: { player: CricketPlayer; children?: React.ReactNode }) {
  const design = CARD_DESIGNS[player.cardStyle];
  const flag = flagSource(player.flag);
  const overall = cricketOverall(player) || "–";
  return <article className={`player-card cricket-player-card${player.active ? "" : " is-inactive"}`}>
    <div className={`player-card__visual card-theme-${player.cardStyle}`}>
      <img className="player-card__frame" src={player.image ? design.clean : design.frame} alt="" aria-hidden="true" />
      <div className="player-card__strip"><strong>{overall}</strong><span>{ROLE_SHORT[player.role]}</span><span className="player-card__flag">{flag ? <img src={flag} alt={`${player.name} flag`} /> : player.flag || ""}</span><span className="cricket-card-ball" aria-hidden="true" /></div>
      <div className="player-card__photo">{player.image && <img className="is-portrait" src={player.image} alt={`${player.name} portrait`} />}</div>
      <div className="player-card__identity"><h3 className={player.name.length > 18 ? "is-long" : player.name.length > 13 ? "is-medium" : ""}>{player.name}</h3><p>{player.role} · {player.batting}</p></div>
      <div className="player-card__stats">{cricketStats(player).map(([label, stat]) => <div key={label}><strong>{stat}</strong><span>{label}</span></div>)}</div>
    </div>
    <div className="player-card__meta"><span>{player.customOverall ? `${player.customOverall} custom OVR` : player.rating ? `${player.rating}/10 rating` : "Not rated"}</span><span>{player.active ? "Active" : "Inactive"}</span></div>
    {children && <div className="player-card__actions">{children}</div>}
  </article>;
}

export default function CricketWorkspace({ value, unlocked, onChange, uploadPlayerImage }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [captain1, setCaptain1] = useState("");
  const [captain2, setCaptain2] = useState("");
  const [editingId, setEditingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState({ name: "", rating: 0, customOverall: "", role: "All-rounder" as CricketPlayer["role"], batting: "Right hand" as CricketPlayer["batting"], bowling: "Right-arm medium", image: "", flag: "PK", cardStyle: "classic" as CricketCardStyle });
  const activePlayers = useMemo(() => value.players.filter((item) => item.active), [value.players]);
  const player = (id: string) => value.players.find((item) => item.id === id);
  const update = onChange;

  useEffect(() => {
    if (value.match.status !== "scheduled") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [value.match.status]);

  const resetDraft = () => {
    setEditingId("");
    setDraft({ name: "", rating: 0, customOverall: "", role: "All-rounder", batting: "Right hand", bowling: "Right-arm medium", image: "", flag: "PK", cardStyle: "classic" });
    setFormError("");
  };

  const savePlayer = () => {
    const name = draft.name.trim();
    const customOverall = draft.customOverall ? Number(draft.customOverall) : undefined;
    if (!name) { setFormError("Enter the player's name."); return; }
    if (customOverall !== undefined && (!Number.isInteger(customOverall) || customOverall < 1 || customOverall > 99)) { setFormError("Custom OVR must be a whole number from 1 to 99."); return; }
    const saved: CricketPlayer = {
      id: editingId || (globalThis.crypto?.randomUUID?.() || `cricket-${Date.now()}`),
      name,
      rating: customOverall ? 0 : Math.max(0, Math.min(10, Math.round(draft.rating * 2) / 2)),
      customOverall,
      role: draft.role,
      batting: draft.batting,
      bowling: draft.bowling.trim() || "Does not bowl",
      image: draft.image || undefined,
      flag: draft.flag.trim() || "PK",
      cardStyle: draft.cardStyle,
      active: editingId ? player(editingId)?.active !== false : true,
    };
    update((current) => ({ ...current, players: editingId ? current.players.map((item) => item.id === editingId ? saved : item) : [...current.players, saved], teams: editingId ? current.teams : null, match: editingId ? current.match : emptyCricketMatch() }));
    resetDraft();
  };

  const editPlayer = (item: CricketPlayer) => {
    setEditingId(item.id);
    setDraft({ name: item.name, rating: item.rating, customOverall: item.customOverall ? String(item.customOverall) : "", role: item.role, batting: item.batting, bowling: item.bowling, image: item.image || "", flag: item.flag || "PK", cardStyle: item.cardStyle });
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const generateTeams = (shuffle = false) => {
    try {
      const first = captain1 || value.teams?.team1.captain || activePlayers[0]?.id || "";
      const second = captain2 || value.teams?.team2.captain || activePlayers.find((item) => item.id !== first)?.id || "";
      const generated = makeBalancedCricketTeams(value.players, first, second, shuffle ? Date.now() : 1);
      if (value.teams) {
        generated.team1.name = value.teams.team1.name;
        generated.team2.name = value.teams.team2.name;
      }
      update((current) => ({ ...current, teams: generated, match: emptyCricketMatch() }));
      setCaptain1(first); setCaptain2(second); setFormError("");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Could not generate teams."); }
  };

  const teamFor = (number: 1 | 2) => number === 1 ? value.teams?.team1 : value.teams?.team2;
  const roleOptionsForBowling = (ids: string[]) => {
    const preferred = ids.filter((id) => ["Bowler", "All-rounder"].includes(player(id)?.role || ""));
    return preferred.length ? preferred : ids;
  };
  const firstAvailableBatter = (teamNumber: 1 | 2, dismissed: string[] = []) => teamFor(teamNumber)?.ids.find((id) => !dismissed.includes(id)) || "";
  const firstAvailableBowler = (teamNumber: 1 | 2) => roleOptionsForBowling(teamFor(teamNumber)?.ids || [])[0] || "";

  const hostMatch = () => {
    if (!value.teams) return;
    const batting = value.match.battingFirst;
    const bowling = batting === 1 ? 2 : 1;
    const battingIds = teamFor(batting)?.ids || [];
    update((current) => ({ ...current, match: { ...current.match, status: "live", inningsNumber: 1, innings: [{ battingTeam: batting, runs: 0, wickets: 0, balls: 0, deliveries: [] }], strikerId: battingIds[0] || "", nonStrikerId: battingIds[1] || "", bowlerId: firstAvailableBowler(bowling), startedAt: new Date().toISOString(), completedAt: undefined, result: undefined } }));
  };

  const scheduleMatch = () => {
    const kickoff = value.match.scheduledFor;
    if (!kickoff || !Number.isFinite(Date.parse(kickoff)) || Date.parse(kickoff) <= Date.now()) { setFormError("Choose a kickoff time in the future, or host the match now."); return; }
    update((current) => ({ ...current, match: { ...current.match, status: "scheduled", innings: [], strikerId: "", nonStrikerId: "", bowlerId: "", startedAt: undefined, completedAt: undefined, result: undefined } }));
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
      const battingIds = current.teams[innings.battingTeam === 1 ? "team1" : "team2"].ids;
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
        const options = roleOptionsForBowling(bowlingTeam.ids);
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
    const battingIds = teamFor(batting)?.ids || [];
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
    {unlocked && <section className="card cricket-player-form">
      <h2>{editingId ? "Edit cricket player" : "Add cricket player"}</h2>
      <div className="row2"><div><label>Name</label><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Player name" /></div><div><label>Country code</label><input value={draft.flag} maxLength={2} onChange={(event) => setDraft((current) => ({ ...current, flag: event.target.value.toUpperCase() }))} placeholder="PK" /></div></div>
      <div className="row2"><div><label>Rating (0–10)</label><input type="number" min="0" max="10" step="0.5" value={draft.rating || ""} disabled={Boolean(draft.customOverall)} onChange={(event) => setDraft((current) => ({ ...current, rating: Number(event.target.value) }))} /></div><div><label>Custom OVR</label><input type="number" min="1" max="99" step="1" value={draft.customOverall} onChange={(event) => setDraft((current) => ({ ...current, customOverall: event.target.value, rating: event.target.value ? 0 : current.rating }))} placeholder="Auto calculated" /></div></div>
      <div className="row2"><div><label>Primary role</label><select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as CricketPlayer["role"] }))}>{CRICKET_ROLES.map((role) => <option key={role}>{role}</option>)}</select></div><div><label>Batting</label><select value={draft.batting} onChange={(event) => setDraft((current) => ({ ...current, batting: event.target.value as CricketPlayer["batting"] }))}><option>Right hand</option><option>Left hand</option></select></div></div>
      <label>Bowling style</label><input value={draft.bowling} onChange={(event) => setDraft((current) => ({ ...current, bowling: event.target.value }))} placeholder="Right-arm fast, left-arm spin…" />
      <label>Player photo</label><div className="photo-field">{draft.image ? <img src={draft.image} alt="Player preview" /> : <span className="mini-silhouette"><span /></span>}<label className="b line photo-button">{uploading ? "Uploading…" : "Upload photo"}<input type="file" accept="image/*" disabled={uploading} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); setFormError(""); try { const image = await uploadPlayerImage(file); setDraft((current) => ({ ...current, image })); } catch (error) { setFormError(error instanceof Error ? error.message : "Upload failed."); } finally { setUploading(false); event.target.value = ""; } }} /></label>{draft.image && <button className="b line" type="button" onClick={() => setDraft((current) => ({ ...current, image: "" }))}>Remove</button>}</div>
      <label>Card design</label><div className="design-picker is-small">{CRICKET_CARD_STYLES.map((style) => <button type="button" key={style} className={draft.cardStyle === style ? "on" : ""} onClick={() => setDraft((current) => ({ ...current, cardStyle: style }))}><img src={CARD_DESIGNS[style].frame} alt="" /><span>{CARD_DESIGNS[style].name}</span></button>)}</div>
      {formError && <p className="access-error" role="alert">{formError}</p>}
      <div className="button-row"><button className="b pri" type="button" disabled={uploading} onClick={savePlayer}>{editingId ? "Save player" : "Add player"}</button>{editingId && <button className="b line" type="button" onClick={resetDraft}>Cancel</button>}</div>
    </section>}
    <section className="sec"><h2>Cricket squad · {activePlayers.length} active of {value.players.length}</h2>{!value.players.length ? <p className="note">{unlocked ? "Add the first cricket player above." : "The administrator has not added cricket players yet."}</p> : <div className="player-grid">{value.players.map((item) => <div className="player-card-wrap" key={item.id}><CricketPlayerCard player={item}>{unlocked && <><button className="b line" onClick={() => editPlayer(item)}>Edit</button><button className="b" onClick={() => update((current) => ({ ...current, players: current.players.map((candidate) => candidate.id === item.id ? { ...candidate, active: !candidate.active } : candidate), teams: null, match: emptyCricketMatch() }))}>{item.active ? "Deactivate" : "Activate"}</button><button className="b danger line" onClick={() => { if (!window.confirm(`Delete ${item.name}?`)) return; update((current) => ({ ...current, players: current.players.filter((candidate) => candidate.id !== item.id), teams: null, match: emptyCricketMatch() })); }}>Delete</button></>}</CricketPlayerCard></div>)}</div>}</section>
  </>;

  const TeamView = () => <section className="sec cricket-team-view">
    <h2>Cricket teams</h2><p className="note">Teams are balanced by OVR and cricket role coverage, including wicketkeeping and bowling options.</p>
    {!value.teams ? <div className="card cricket-balance-card">{unlocked ? <><div className="row2"><div><label>Team 1 captain</label><select value={captain1} onChange={(event) => setCaptain1(event.target.value)}><option value="">Select captain</option>{activePlayers.map((item) => <option key={item.id} value={item.id} disabled={item.id === captain2}>{item.name} · {item.role} · {cricketOverall(item) || "–"}</option>)}</select></div><div><label>Team 2 captain</label><select value={captain2} onChange={(event) => setCaptain2(event.target.value)}><option value="">Select captain</option>{activePlayers.map((item) => <option key={item.id} value={item.id} disabled={item.id === captain1}>{item.name} · {item.role} · {cricketOverall(item) || "–"}</option>)}</select></div></div>{formError && <p className="access-error">{formError}</p>}<button className="b pri" disabled={activePlayers.length < 2} onClick={() => generateTeams(false)}>Generate balanced teams</button></> : <p className="note">Waiting for the administrator to generate cricket teams.</p>}</div> : <>
      {unlocked && <div className="bar cricket-team-actions"><button className="b pri" onClick={() => generateTeams(true)}>Rebalance teams</button><button className="b danger line" onClick={() => update((current) => ({ ...current, teams: null, match: emptyCricketMatch() }))}>Delete teams</button></div>}
      <div className="cricket-team-grid">{([1, 2] as const).map((number) => { const team = teamFor(number)!; const roster = team.ids.map((id) => player(id)).filter((item): item is CricketPlayer => Boolean(item)); const average = roster.length ? Math.round(roster.reduce((sum, item) => sum + cricketOverall(item), 0) / roster.length) : 0; return <article className="card" key={number}>{unlocked ? <input className="cricket-team-name" value={team.name} onChange={(event) => { const name = event.target.value; update((current) => current.teams ? { ...current, teams: { ...current.teams, [number === 1 ? "team1" : "team2"]: { ...current.teams[number === 1 ? "team1" : "team2"], name } } } : current); }} /> : <h3>{team.name}</h3>}<p className="formation-label">{roster.length} players · Avg {average} OVR</p><div className="cricket-roster-list">{roster.map((item) => <div className="cricket-roster-row" key={item.id}><span className="roster-avatar">{item.image ? <img src={item.image} alt="" /> : initials(item.name)}</span><span><strong>{item.name}{team.captain === item.id ? " (C)" : ""}</strong><small>{item.role} · {cricketOverall(item) || "–"} OVR</small></span></div>)}</div></article>; })}</div>
    </>}
  </section>;

  const MatchView = () => {
    if (!value.teams) return <section className="cricket-panel"><div className="cricket-hero"><div className="cricket-hero-copy"><p className="cricket-kicker"><span /> Shared cricket mode</p><h1>Cricket match centre</h1><p>Generate the two cricket teams before hosting a match.</p><div className="cricket-mode-note">{unlocked ? "Open the Team tab to create balanced sides." : "Waiting for the administrator to prepare the teams."}</div></div><div className="cricket-emblem" aria-hidden="true"><span className="cricket-ball" /><span className="cricket-bat" /><span className="cricket-wickets"><i /><i /><i /></span></div></div></section>;
    if (value.match.status === "setup") return <section className="sec">
      <div className="cricket-score-preview"><div><small>Team 1</small><strong>{value.teams.team1.name}</strong></div><span><b>VS</b><small>Ready to host</small></span><div><small>Team 2</small><strong>{value.teams.team2.name}</strong></div></div>
      {unlocked ? <div className="card cricket-host-card"><h2>Host cricket match</h2>
        <div className="row2"><div><label>Overs per innings</label><select value={value.match.overs} onChange={(event) => update((current) => ({ ...current, match: { ...current.match, overs: Number(event.target.value) } }))}>{[1, 2, 5, 10, 20, 50].map((overs) => <option key={overs} value={overs}>{overs} overs</option>)}</select></div><div><label>Batting first</label><select value={value.match.battingFirst} onChange={(event) => update((current) => ({ ...current, match: { ...current.match, battingFirst: Number(event.target.value) === 2 ? 2 : 1 } }))}><option value={1}>{value.teams.team1.name}</option><option value={2}>{value.teams.team2.name}</option></select></div></div>
        <label>Schedule kickoff (optional)</label><input type="datetime-local" value={datetimeLocalValue(value.match.scheduledFor)} onChange={(event) => update((current) => ({ ...current, match: { ...current.match, scheduledFor: event.target.value ? new Date(event.target.value).toISOString() : undefined } }))} />
        {formError && <p className="access-error" role="alert">{formError}</p>}
        <div className="button-row"><button className="b pri" onClick={hostMatch}>Host now</button><button className="b line" disabled={!value.match.scheduledFor} onClick={scheduleMatch}>Schedule match</button></div>
      </div> : <div className="card"><p className="note">Waiting for the administrator to start or schedule the cricket match.</p></div>}
    </section>;
    if (value.match.status === "scheduled") {
      const due = Boolean(value.match.scheduledFor && Date.parse(value.match.scheduledFor) <= now);
      return <section className="sec"><div className="cricket-score-preview"><div><small>Team 1</small><strong>{value.teams.team1.name}</strong></div><span><b>VS</b><small>{due ? "Kickoff due" : "Scheduled"}</small></span><div><small>Team 2</small><strong>{value.teams.team2.name}</strong></div></div><div className="card cricket-scheduled-card"><p className="cricket-kicker"><span /> Scheduled cricket match</p><h2>{formatKickoff(value.match.scheduledFor)}</h2><p className="note">The innings will not begin automatically. {due ? "Kickoff time has arrived; the clock is waiting for the administrator." : "The administrator can start play when kickoff arrives."}</p>{unlocked && <div className="button-row"><button className="b pri" disabled={!due} onClick={hostMatch}>{due ? "Start match" : "Waiting for kickoff"}</button><button className="b line" onClick={() => update((current) => ({ ...current, match: { ...current.match, status: "setup" } }))}>Edit schedule</button></div>}</div></section>;
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
        <div className="cricket-player-selects"><div><label>Striker</label><select value={value.match.strikerId} onChange={(event) => update((state) => ({ ...state, match: { ...state.match, strikerId: event.target.value } }))}>{teamFor(current.battingTeam)?.ids.map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div><div><label>Non-striker</label><select value={value.match.nonStrikerId} onChange={(event) => update((state) => ({ ...state, match: { ...state.match, nonStrikerId: event.target.value } }))}><option value="">None</option>{teamFor(current.battingTeam)?.ids.filter((id) => id !== value.match.strikerId).map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div><div><label>Bowler</label><select value={value.match.bowlerId} onChange={(event) => update((state) => ({ ...state, match: { ...state.match, bowlerId: event.target.value } }))}>{roleOptionsForBowling(teamFor(bowlingTeam)?.ids || []).map((id) => <option key={id} value={id}>{player(id)?.name}</option>)}</select></div></div>
        <div className="cricket-run-buttons"><button onClick={() => recordDelivery("dot", 0, true)}>0</button><button onClick={() => recordDelivery("run", 1, true)}>1</button><button onClick={() => recordDelivery("run", 2, true)}>2</button><button onClick={() => recordDelivery("run", 3, true)}>3</button><button className="is-boundary" onClick={() => recordDelivery("four", 4, true)}>4</button><button className="is-six" onClick={() => recordDelivery("six", 6, true)}>6</button><button className="is-wicket" onClick={() => recordDelivery("wicket", 0, true)}>W</button><button className="is-extra" onClick={() => recordDelivery("wide", 1, false)}>Wide</button><button className="is-extra" onClick={() => recordDelivery("no-ball", 1, false)}>No-ball</button></div>
        <div className="button-row"><button className="b line" disabled={!current.deliveries.length} onClick={undoDelivery}>Undo delivery</button><button className="b line" onClick={endInnings}>End innings</button></div>
      </section>}
      {unlocked && value.match.status === "innings-break" && <div className="bar"><button className="b pri" onClick={startSecondInnings}>Start second innings · Target {(first?.runs || 0) + 1}</button><button className="b line" onClick={undoDelivery}>Undo last delivery</button></div>}
      {unlocked && value.match.status === "complete" && <div className="bar"><button className="b pri" onClick={() => update((state) => ({ ...state, match: emptyCricketMatch() }))}>Set up another match</button><button className="b line" onClick={undoDelivery}>Reopen and undo last delivery</button></div>}
      <section className="sec"><h2>Ball-by-ball commentary</h2>{!allDeliveries.length ? <p className="note">No deliveries recorded yet.</p> : <div className="cricket-commentary">{allDeliveries.map((delivery) => <article className={`cricket-commentary-card is-${delivery.kind}`} key={delivery.id}><div><strong>{delivery.over}.{delivery.ball}</strong><span>{delivery.kind === "wicket" ? "WICKET" : delivery.kind === "wide" ? "WIDE" : delivery.kind === "no-ball" ? "NO-BALL" : delivery.runs ? `${delivery.runs} RUN${delivery.runs === 1 ? "" : "S"}` : "DOT BALL"}</span><b>{scoreAfterDelivery.get(delivery.id)}</b></div><p>{delivery.commentary}</p><small>{player(delivery.batterId)?.name || "Batter"} facing {player(delivery.bowlerId)?.name || "Bowler"} · Innings {delivery.innings}</small></article>)}</div>}</section>
    </>;
  };

  return value.tab === "players" ? <PlayersView /> : value.tab === "team" ? <TeamView /> : <MatchView />;
}
