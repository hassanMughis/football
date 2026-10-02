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
type Match = { opp: string; us: string; them: number; ev: Goal[]; motm: string; st: "Live" | "Full-time" };
type AppState = {
  players: Player[];
  want: number;
  team: Team | null;
  pool: Player[] | null;
  tab: MainTab;
  sub: MatchTab;
  match: Match;
  seeded: boolean;
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
  pool: null,
  tab: "match",
  sub: "timeline",
  match: newMatch(),
  seeded: true,
});

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

async function preparePlayerImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
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
  // WebP keeps transparent pixels while remaining small enough for localStorage.
  return canvas.toDataURL("image/webp", .86);
}

export default function SquadSheet() {
  const [state, setState] = useState<AppState>(initialState);
  const [draft, setDraft] = useState<{ rating: number; spec: string; name: string; image: string; cardStyle: CardStyleId; position: string; flag: string }>({ rating: 0, spec: "", name: "", image: "", cardStyle: "classic", position: "CM", flag: "🇵🇰" });
  const [pickCaptain, setPickCaptain] = useState("");
  const [showGoal, setShowGoal] = useState(false);
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sqs1");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        const base = initialState();
        const players = Array.isArray(parsed.players) ? parsed.players : base.players;
        for (const [i, name] of SEED.entries()) {
          if (!players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
            players.push({ id: `s${i}`, name, rating: 0, spec: "" });
          }
        }
        setState({ ...base, ...parsed, players, match: { ...base.match, ...parsed.match } });
      }
    } catch {
      // A damaged save should never prevent the app from starting.
    } finally {
      hydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem("sqs1", JSON.stringify(state)); } catch { /* Storage can be unavailable in private browsing. */ }
  }, [state]);

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
        <div className="player-card__identity"><h3>{item.name}</h3><p>{item.spec || "Footballer"}</p></div>
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
      setState((current) => ({ ...current, players: [...current.players, { id: `p${Date.now()}${Math.random().toString(36).slice(2, 5)}`, name, rating: draft.rating, spec: draft.spec, image: draft.image, cardStyle: draft.cardStyle, position: draft.position, flag: draft.flag }] }));
      setDraft({ rating: 0, spec: "", name: "", image: "", cardStyle: "classic", position: "CM", flag: "🇵🇰" }); setError("");
    };
    const updatePlayer = (id: string, patch: Partial<Player>) => setState((current) => ({ ...current, players: current.players.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    const togglePlayer = (id: string) => setState((current) => {
      const players = current.players.map((item) => item.id === id ? { ...item, on: item.on === false } : item);
      const madeInactive = players.find((item) => item.id === id)?.on === false;
      const reset = madeInactive && current.team?.ids.includes(id);
      return { ...current, players, ...(reset ? { team: null, pool: null, match: newMatch(current.match) } : {}) };
    });
    const deletePlayer = (id: string) => setState((current) => {
      const reset = current.team?.ids.includes(id);
      return { ...current, players: current.players.filter((item) => item.id !== id), pool: reset ? null : current.pool?.filter((item) => item.id !== id) || null, ...(reset ? { team: null, match: newMatch(current.match) } : {}) };
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
    if (state.pool && state.team) {
      const captain = player(state.team.captain); const full = state.team.ids.length >= teamSize || !state.pool.length;
      return <><div className="sec"><h2>Manual selection</h2><p className="note">Captain: {captain?.name}. Tap Pick to add a player; they leave the list. {state.team.ids.length}/{teamSize} picked.</p>
        {full ? <button className="b pri" onClick={() => setState((current) => ({ ...current, pool: null }))}>Finish team</button> : <div className="player-grid">{sortPlayers(state.pool).map((item) => <PlayerCard item={player(item.id) || item} compact key={item.id}><button className="b sm pri" onClick={() => setState((current) => ({ ...current, team: current.team ? { ...current.team, ids: [...current.team.ids, item.id] } : null, pool: current.pool?.filter((p) => p.id !== item.id) || null }))}>Pick player</button></PlayerCard>)}</div>}
        <div className="button-row"><button className="b line sm" onClick={resetTeam}>Cancel</button></div></div><Squad ids={state.team.ids} title="Picked so far" /></>;
    }
    if (state.team?.ids.length) return <><Squad ids={state.team.ids} title={`${state.match.us} squad`} /><div className="bar transparent-bar"><button className="b pri" onClick={() => setTab("match")}>Go to match</button><button className="b line" onClick={resetTeam}>Make a new team</button></div></>;
    return <><div className="sec"><h2>Make the team</h2><label htmlFor="sz">Players in the team (all available by default)</label><input id="sz" type="number" min="1" max="30" value={teamSize} disabled={!active.length} onChange={(e) => readSize(Number.parseInt(e.target.value) || 0)} />
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

  return <div className="app"><nav className="tabs" aria-label="Main navigation">{(["match", "team", "players"] as MainTab[]).map((tab) => <button key={tab} onClick={() => setTab(tab)} className={state.tab === tab ? "on" : ""}>{tab}</button>)}</nav><main>{state.tab === "players" ? <PlayersView /> : state.tab === "team" ? <TeamView /> : <MatchView />}</main></div>;
}
