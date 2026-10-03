"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Dices, ImagePlus, Loader2, Pencil, Plus, RefreshCw, Sparkles, Trash2, UserRound, UsersRound, X } from "lucide-react";

type Player = { id: number; name: string; rating: number; available: boolean; team: 0 | 1 | 2; imageUrl?: string | null };
type SavedState = { players: Player[]; team1Name: string; team2Name: string };
const emptyState: SavedState = { players: [], team1Name: "Team 1", team2Name: "Team 2" };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => Promise<unknown>;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const average = (players: Player[]) => players.length ? Math.round(players.reduce((sum, player) => sum + player.rating, 0) / players.length) : 0;

function balance(players: Player[]) {
  const sorted = [...players].sort(() => Math.random() - .5).sort((a, b) => b.rating - a.rating);
  const first: number[] = [];
  const second: number[] = [];
  let firstScore = 0;
  let secondScore = 0;
  sorted.forEach((player) => {
    if (first.length < second.length || (first.length === second.length && firstScore <= secondScore)) {
      first.push(player.id); firstScore += player.rating;
    } else { second.push(player.id); secondScore += player.rating; }
  });
  return { first, second };
}

export default function Home() {
  const [state, setState] = useState<SavedState>(emptyState);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(75);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading your squad…");
  const [editing, setEditing] = useState<1 | 2 | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/squad", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load the squad.");
      setState(data); setMessage("Saved to the team database");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The database is unavailable."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (next: SavedState) => {
    setSaving(true); setMessage("Saving…");
    try {
      const response = await fetch("/api/squad", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save changes.");
      setState(data); setMessage("Saved to the team database");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save changes.");
      return false;
    }
    finally { setSaving(false); }
  }, []);

  const available = useMemo(() => state.players.filter((player) => player.available), [state.players]);
  const team1 = useMemo(() => available.filter((player) => player.team === 1), [available]);
  const team2 = useMemo(() => available.filter((player) => player.team === 2), [available]);
  const hasTeams = team1.length + team2.length > 0;

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "generate_balanced_teams",
      title: "Generate balanced teams",
      description: "Split all currently available players into two balanced teams and save the result.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute() {
        const currentAvailable = state.players.filter((player) => player.available);
        if (currentAvailable.length < 2) throw new Error("At least two available players are required.");
        const { first, second } = balance(currentAvailable);
        const next = { ...state, players: state.players.map((player) => ({ ...player, team: !player.available ? 0 as const : first.includes(player.id) ? 1 as const : second.includes(player.id) ? 2 as const : 0 as const })) };
        if (!await save(next)) throw new Error("Could not save the generated teams.");
        return { team1Name: next.team1Name, team2Name: next.team2Name, team1Players: first.length, team2Players: second.length };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [save, state]);

  async function addPlayer() {
    const cleanName = name.trim();
    if (!cleanName || saving) return;
    setSaving(true);
    let imageUrl: string | null = null;
    try {
      if (photo) {
        setMessage("Uploading player photo...");
        const form = new FormData();
        form.set("file", photo);
        const response = await fetch("/api/upload", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not upload the photo.");
        imageUrl = data.imageUrl;
      }
      if (await save({ ...state, players: [...state.players, { id: -Date.now(), name: cleanName, rating, available: true, team: 0, imageUrl }] })) {
        setName("");
        setPhoto(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add the player.");
      setSaving(false);
    }
  }

  function makeTeams() {
    if (available.length < 2) { setMessage("Add or enable at least two available players."); return; }
    const { first, second } = balance(available);
    void save({ ...state, players: state.players.map((player) => ({ ...player, team: !player.available ? 0 : first.includes(player.id) ? 1 : second.includes(player.id) ? 2 : 0 })) });
  }

  function togglePlayer(id: number) {
    if (saving) return;
    void save({ ...state, players: state.players.map((player) => player.id === id ? { ...player, available: !player.available, team: 0 } : player) });
  }

  function finishRename(team: 1 | 2) {
    const key = team === 1 ? "team1Name" : "team2Name";
    const next = { ...state, [key]: state[key].trim() || `Team ${team}` };
    setEditing(null); void save(next);
  }

  return <main className="min-h-screen bg-[#07130e] text-[#f4f8f5]">
    <div className="noise" />
    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-7 lg:px-10 lg:py-8">
      <header className="mb-7 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-[14px] border border-[#b9ff3d]/35 bg-[#b9ff3d] text-[#07130e] shadow-[0_0_30px_rgba(185,255,61,.16)]"><UsersRound size={23} strokeWidth={2.4} /></div><div><p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#b9ff3d]">Matchday utility</p><h1 className="text-xl font-black tracking-[-.03em] sm:text-2xl">Two Team Maker</h1></div></div>
        <div className="hidden items-center gap-2 text-sm text-white/55 sm:flex">{saving ? <Loader2 className="animate-spin" size={15} /> : <span className="size-2 rounded-full bg-[#b9ff3d]" />}<span>{message}</span></div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[24px] border border-white/10 bg-[#0d2017]/90 p-5 shadow-2xl shadow-black/20 lg:sticky lg:top-7">
          <div className="mb-5 flex items-start justify-between"><div><p className="eyebrow">Player pool</p><h2 className="mt-1 text-2xl font-black tracking-[-.04em]">Who&apos;s playing?</h2></div><span className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold text-white/70">{available.length} available</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <label className="sr-only" htmlFor="player-name">Player name</label>
            <div className="flex gap-2"><input id="player-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addPlayer(); }} placeholder="Add player name" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/7 px-3.5 py-3 text-base outline-none placeholder:text-white/35 focus:border-[#b9ff3d]/70" /><button type="button" onClick={() => void addPlayer()} disabled={!name.trim() || saving} className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#b9ff3d] text-[#07130e] hover:bg-[#caff69] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Add player"><Plus size={20} strokeWidth={3} /></button></div>
            <div className="mt-3 flex items-center gap-3"><label htmlFor="rating" className="text-xs font-bold uppercase tracking-[.12em] text-white/50">Rating</label><input id="rating" type="range" min="50" max="99" value={rating} onChange={(event) => setRating(Number(event.target.value))} className="rating-range min-w-0 flex-1" /><strong className="w-7 text-right text-sm text-[#b9ff3d]">{rating}</strong></div>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[.035] px-3 py-2.5 text-xs font-bold text-white/55 hover:border-[#b9ff3d]/40 hover:text-white"><ImagePlus size={16} />{photo ? photo.name : "Add player photo"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label>
          </div>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {loading ? <div className="grid place-items-center py-16 text-white/45"><Loader2 className="animate-spin" /></div> : state.players.map((player) => <article key={player.id} className={`group flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${player.available ? "border-white/8 bg-white/[.045]" : "border-transparent bg-black/15 opacity-45"}`}><div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#275b40] to-[#153323] text-xs font-black text-[#d9ffc0]">{player.imageUrl ? <img src={player.imageUrl} alt="" className="h-full w-full object-cover" /> : initials(player.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{player.name}</p><p className="text-xs text-white/40">Rating {player.rating}</p></div><button type="button" onClick={() => togglePlayer(player.id)} className={`grid size-8 place-items-center rounded-lg border ${player.available ? "border-[#b9ff3d]/30 bg-[#b9ff3d]/10 text-[#b9ff3d]" : "border-white/15 text-white/55"}`} aria-label={`${player.available ? "Mark unavailable" : "Mark available"}: ${player.name}`}>{player.available ? <Check size={15} /> : <X size={15} />}</button><button type="button" onClick={() => void save({ ...state, players: state.players.filter((item) => item.id !== player.id) })} className="grid size-8 place-items-center rounded-lg text-white/25 hover:bg-red-500/10 hover:text-red-300" aria-label={`Remove ${player.name}`}><Trash2 size={15} /></button></article>)}
          </div>
          <button type="button" onClick={makeTeams} disabled={available.length < 2 || saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b9ff3d] px-5 py-4 text-sm font-black uppercase tracking-[.1em] text-[#07130e] shadow-[0_12px_34px_rgba(185,255,61,.14)] hover:-translate-y-0.5 hover:bg-[#caff69] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35"><Sparkles size={18} /> {hasTeams ? "Balance again" : "Make two teams"}</button>
          <p className="mt-3 text-center text-xs leading-5 text-white/38">Teams are balanced by player rating and team size.</p>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-white/[.035] px-4 py-3"><div className="flex items-center gap-2 text-sm text-white/55"><Dices size={17} className="text-[#b9ff3d]" /><span>{hasTeams ? `${team1.length + team2.length} players split into two teams` : "Your balanced teams will appear here"}</span></div><button type="button" onClick={makeTeams} disabled={!hasTeams || saving} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70 hover:border-white/25 hover:text-white disabled:opacity-30"><RefreshCw size={14} /> Shuffle</button></div>
          {!hasTeams ? <div className="grid min-h-[560px] place-items-center rounded-[28px] border border-dashed border-white/15 bg-[#0a1912]/65 px-6 text-center"><div className="max-w-sm"><div className="mx-auto mb-5 grid size-20 place-items-center rounded-[24px] border border-[#b9ff3d]/20 bg-[#b9ff3d]/8 text-[#b9ff3d]"><UsersRound size={38} /></div><h2 className="text-3xl font-black tracking-[-.04em]">Ready for kickoff</h2><p className="mt-3 text-base leading-7 text-white/48">Choose who is available, then tap <strong className="text-white/75">Make two teams</strong>. We&apos;ll keep both sides as even as possible.</p></div></div> : <div className="grid gap-5 xl:grid-cols-2"><TeamPanel team={1} name={state.team1Name} players={team1} editing={editing === 1} onEdit={() => setEditing(1)} onName={(value) => setState((current) => ({ ...current, team1Name: value }))} onDone={() => finishRename(1)} accent="#b9ff3d" /><TeamPanel team={2} name={state.team2Name} players={team2} editing={editing === 2} onEdit={() => setEditing(2)} onName={(value) => setState((current) => ({ ...current, team2Name: value }))} onDone={() => finishRename(2)} accent="#70a7ff" /></div>}
        </div>
      </section>
      <p className="mt-5 text-center text-xs text-white/35 sm:hidden">{message}</p>
    </div>
  </main>;
}

function TeamPanel({ team, name, players, editing, onEdit, onName, onDone, accent }: { team: 1 | 2; name: string; players: Player[]; editing: boolean; onEdit: () => void; onName: (value: string) => void; onDone: () => void; accent: string }) {
  return <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d2017]/90 shadow-2xl shadow-black/20"><div className="relative border-b border-white/10 px-5 pb-5 pt-6" style={{ background: `radial-gradient(circle at 90% 0%, ${accent}20, transparent 42%)` }}><div className="mb-4 flex items-center justify-between"><p className="eyebrow" style={{ color: accent }}>Team {team}</p><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-white/55">AVG {average(players)}</span></div><div className="flex items-center gap-2">{editing ? <input autoFocus value={name} onChange={(event) => onName(event.target.value)} onBlur={onDone} onKeyDown={(event) => { if (event.key === "Enter") onDone(); }} className="min-w-0 flex-1 border-b bg-transparent text-3xl font-black tracking-[-.05em] outline-none" style={{ borderColor: accent }} aria-label={`Team ${team} name`} /> : <h2 className="min-w-0 flex-1 truncate text-3xl font-black tracking-[-.05em]">{name}</h2>}<button type="button" onClick={editing ? onDone : onEdit} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/55 hover:text-white" aria-label={editing ? "Save team name" : "Rename team"}>{editing ? <Check size={17} /> : <Pencil size={16} />}</button></div><p className="mt-2 text-sm text-white/40">{players.length} player{players.length === 1 ? "" : "s"}</p></div><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{players.map((player, index) => <PlayerCard key={player.id} player={player} number={index + 1} accent={accent} />)}</div></section>;
}

function PlayerCard({ player, number, accent }: { player: Player; number: number; accent: string }) {
  return <article className="relative min-h-[180px] overflow-hidden rounded-[20px] border border-white/10 bg-[#10271b] p-4">
    {player.imageUrl && <img src={player.imageUrl} alt={`${player.name} portrait`} className="absolute inset-0 h-full w-full object-cover opacity-50" />}
    <div className="absolute inset-0 bg-gradient-to-t from-[#10271b] via-[#10271b]/30 to-transparent" />
    <div className="relative flex min-h-[148px] flex-col justify-between">
      <div className="flex items-start justify-between"><span className="text-3xl font-black tracking-[-.06em]" style={{ color: accent }}>{player.rating}</span><span className="text-xs font-black text-white/60">#{String(number).padStart(2, "0")}</span></div>
      <div className="flex items-end gap-3">
        {!player.imageUrl && <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[.06]" style={{ color: accent }}><UserRound size={22} /></div>}
        <div className="min-w-0"><h3 className="truncate text-base font-black">{player.name}</h3><p className="mt-0.5 text-xs font-bold uppercase tracking-[.14em] text-white/60">Available</p></div>
      </div>
    </div>
  </article>;
}
