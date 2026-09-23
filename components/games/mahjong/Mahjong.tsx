// components/games/mahjong/Mahjong.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BookOpen, RotateCcw, Smartphone, Trophy, BarChart3, Settings2 } from "lucide-react";
import { type Tile, type Seat, WIND_NAMES, WIND_EN, tileName } from "./tiles";
import { waitingOn, isComplete, MIN_FAN, LIMIT } from "./scoring";
import { type Difficulty, type ClaimKind, rankDiscards, fanPotential } from "./bot";
import * as E from "./engine";
import TileView from "./TileView";
import Guide from "./Guide";
import { FELT, FeltVignette, GameSheet, GameSettingsBody, StatRows, SectionLabel, Segmented, HeaderButton, ignoreGameKey } from "../ui";
import { readStore, writeStore, useGameSettings, scaleDelay } from "@/lib/gameStore";
import { play, setAudioEnabled } from "@/lib/gameAudio";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { Kbd } from "@/components/ui/Kbd";

// Hong Kong mahjong vs three bots. All rules live in engine.ts / scoring.ts /
// bot.ts; this file schedules bot turns on a timer and draws the table. In
// landscape (board ≥ 560px) it is a real four-sided table — side seats hold
// their tiles sideways, discards pool in front of each seat, the wall runs
// round the edge. Portrait collapses to a stack with a rotate nudge — never a
// hard block, since some phones lock rotation.

const BOT_DELAY_MS = 650;
const DRAW_DELAY_MS = 250;
const CLAIM_SPOTLIGHT_MS = 900;

type HintLevel = "off" | "basic" | "full";
type Prefs = { difficulty: Difficulty; hints: HintLevel };
const PREFS_DEFAULT: Prefs = { difficulty: "normal", hints: "basic" };

type Stats = {
  hands: number; wins: number; selfDraws: number; discardWins: number; shot: number;
  highestFan: number; totalFan: number; pongs: number; chows: number; kongs: number;
  games: number; gamesWon: number;
};
const STATS_DEFAULT: Stats = { hands: 0, wins: 0, selfDraws: 0, discardWins: 0, shot: 0, highestFan: 0, totalFan: 0, pongs: 0, chows: 0, kongs: 0, games: 0, gamesWon: 0 };

const QUIPS = {
  humanWin: ["Okay that was clean. Don't let it go to your head 🧡", "You actually read the table. Proud of you.", "Fan counted twice. It's real. Nice."],
  humanShot: ["You fed that one. We've all done it.", "That discard was… brave.", "Next time, look at what they've thrown first."],
  tyunWin: ["Mine. Sorry. Not sorry.", "Told you I don't count tiles. I lied.", "House wins. The house is me again."],
  otherWin: ["Not me this time. Still, someone at this table can play.", "Watch how they built that — pairs first.", "Slow round. Reset and go again."],
  draw: ["Wall's gone. Nobody made three fan.", "Draw. Honestly, that's normal at a 3-fan table.", "Nothing this time. Same dealer, new wall."],
};
const pick = (a: string[], seed: number) => a[seed % a.length];
const kindTile = (k: string): Tile => ({ id: -1, suit: k[0] as Tile["suit"], rank: Number(k.slice(1)) });

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: "easy", label: "Easy", hint: "plays like a beginner" },
  { value: "normal", label: "Normal", hint: "builds for fan" },
  { value: "hard", label: "Hard", hint: "reads your discards" },
  { value: "expert", label: "Expert", hint: "defends the table" },
];
const HINT_LEVELS: { value: HintLevel; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "no help" },
  { value: "basic", label: "Basic", hint: "suggested discard" },
  { value: "full", label: "Full", hint: "+ waits and fan" },
];

export default function Mahjong() {
  const [settings] = useGameSettings();
  useEffect(() => setAudioEnabled(settings.sound), [settings.sound]);

  // Lazy init — this component is dynamic({ ssr:false }), so storage is safe here.
  const [prefs, setPrefs] = useState<Prefs>(() => readStore("mahjong", PREFS_DEFAULT));
  const savePrefs = (patch: Partial<Prefs>) => setPrefs((p) => { const n = { ...p, ...patch }; writeStore("mahjong", n); return n; });
  const [stats, setStats] = useState<Stats>(() => readStore("mahjong_stats", STATS_DEFAULT));
  const bumpStats = useCallback((patch: (s: Stats) => Stats) => setStats((s) => { const n = patch(s); writeStore("mahjong_stats", n); return n; }), []);

  const [g, setG] = useState<E.Game | null>(null);
  const [sheet, setSheet] = useState<"guide" | "scores" | "stats" | "settings" | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [chowPick, setChowPick] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hints = prefs.hints;

  // ── Bot / auto scheduling ──
  // Every transition bumps `tick`, so this runs once per state and never
  // twice for the same one. A claim by a bot holds the spotlight briefly so
  // the human sees what was taken; the timer is cleared on unmount and on
  // every re-run, so a stale bot turn can't land on a new hand.
  useEffect(() => {
    if (!g) return;
    if (timer.current) clearTimeout(timer.current);
    const later = (ms: number, fn: (x: E.Game) => E.Game) => {
      timer.current = setTimeout(() => setG((cur) => (cur && cur.tick === g.tick ? fn(cur) : cur)), scaleDelay(ms, settings));
    };
    if (g.phase === "draw") later(DRAW_DELAY_MS, E.draw);
    else if (g.phase === "discard" && g.turn !== E.HUMAN) later(g.lastDiscard === null && g.drawnId === null ? BOT_DELAY_MS + CLAIM_SPOTLIGHT_MS : BOT_DELAY_MS, E.botAct);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [g, settings]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // ── Sound + stats, once per transition ──
  const prev = useRef<E.Game | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = g;
    if (!g || !p || p === g) return;
    if (g.phase === "discard" && g.drawnId !== null && g.drawnId !== p.drawnId) play("draw");
    if (g.lastDiscard && g.lastDiscard !== p.lastDiscard) play("tile");
    // A meld appeared on someone → claim
    const meldsNow = g.players.reduce((s, q) => s + q.melds.length, 0);
    const meldsThen = p.players.reduce((s, q) => s + q.melds.length, 0);
    if (meldsNow > meldsThen) {
      play("claim");
      const who = g.players.findIndex((q, i) => q.melds.length > p.players[i].melds.length);
      if (who === E.HUMAN) {
        const m = g.players[E.HUMAN].melds[g.players[E.HUMAN].melds.length - 1];
        const key = ({ pung: "pongs", chow: "chows", kong: "kongs" } as const)[m.kind];
        bumpStats((s) => ({ ...s, [key]: s[key] + 1 }));
      }
    }
    if (g.phase === "handOver" && p.phase !== "handOver" && g.result) {
      const r = g.result;
      if (r.kind === "draw") play("push");
      else if (r.winner === E.HUMAN) play("win");
      else play(r.shooter === E.HUMAN ? "lose" : "push");
      bumpStats((s) => {
        const n = { ...s, hands: s.hands + 1 };
        if (r.kind === "win") {
          if (r.winner === E.HUMAN) {
            n.wins++;
            if (r.shooter === null) n.selfDraws++; else n.discardWins++;
            n.highestFan = Math.max(n.highestFan, r.score.total);
            n.totalFan += r.score.total;
          } else if (r.shooter === E.HUMAN) n.shot++;
        }
        return n;
      });
    }
    if (g.phase === "gameOver" && p.phase !== "gameOver") {
      const top = Math.max(...g.players.map((q) => q.score));
      bumpStats((s) => ({ ...s, games: s.games + 1, gamesWon: s.gamesWon + (g.players[E.HUMAN].score === top ? 1 : 0) }));
    }
  }, [g, bumpStats]);

  // One quip per result object — the result is a new object each hand, and
  // the same object across re-renders, so the random pick stays put.
  const result = g?.result ?? null;
  const seed = g?.handNo ?? 0;
  const quip = useMemo(() => {
    if (!result) return "";
    if (result.kind === "draw") return pick(QUIPS.draw, seed);
    if (result.winner === E.HUMAN) return pick(QUIPS.humanWin, seed);
    if (result.shooter === E.HUMAN) return pick(QUIPS.humanShot, seed);
    return pick(result.winner === 2 ? QUIPS.tyunWin : QUIPS.otherWin, seed);
  }, [result, seed]);

  // ── Board measurement ──
  // 14 hand tiles + up to 4 melds must fit one row; width drives the tile
  // size. Below 560px we treat the board as portrait and stack it. The
  // threshold is the board, not the viewport: <main> takes 32px of padding,
  // so a 640-wide phone held sideways measures 608.
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardW, setBoardW] = useState(720);
  const tableMounted = g !== null;
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoardW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableMounted]);
  const landscape = boardW >= 560;
  const tileW = Math.round(Math.min(40, Math.max(24, (boardW - (landscape ? 48 : 16) - 17 * 3) / 18)));
  const miniW = Math.round(tileW * 0.58);
  const sideW = Math.round(miniW * 0.9);

  // ── Human actions ──
  const me = g?.players[E.HUMAN];
  const myTurn = !!g && g.phase === "discard" && g.turn === E.HUMAN;
  const canWin = g && myTurn ? E.selfWinScore(g, E.HUMAN) : null;
  const kongs = g && myTurn ? E.kongOptions(g, E.HUMAN) : [];
  const chowSets = g && g.phase === "claim" ? E.humanChowSets(g) : [];

  const onTile = useCallback((id: number) => { if (!myTurn) return; setSelected((s) => (s === id ? null : id)); }, [myTurn]);
  const doDiscard = (id: number) => { if (!g || !myTurn) return; setSelected(null); setG(E.discard(g, E.HUMAN, id)); };
  const claim = (c: ClaimKind | "win" | null, chowIdx = 0) => { if (!g) return; setChowPick(false); setG(E.resolveClaims(g, c, chowIdx)); };

  // Hints — computed only when it's the human's move.
  let hintDiscard: number | null = null;
  let waits: string[] = [];
  let underMin = false;
  let potential: number | null = null;
  if (g && me && hints !== "off" && myTurn) {
    const visible = g.players.flatMap((q) => [...q.discards, ...q.melds.flatMap((m) => m.tiles)]);
    hintDiscard = rankDiscards(me.hand, me.melds, visible, E.fanCtx(g, E.HUMAN))[0]?.id ?? null;
    if (isComplete(me.hand, me.melds) && !canWin) underMin = true;
  }
  if (g && me && hints === "full" && (g.phase === "draw" || g.phase === "claim" || g.phase === "discard")) {
    const thirteen = me.hand.length + me.melds.length * 3 === 13 ? me.hand : null;
    if (thirteen) waits = waitingOn(thirteen, me.melds);
    if (myTurn) potential = Math.round(fanPotential(me.hand.filter((t) => t.id !== hintDiscard), me.melds, E.fanCtx(g, E.HUMAN)));
  }

  // ── Keyboard: ← → pick a tile, Enter discard, Esc pass ──
  useEffect(() => {
    if (!g || sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (ignoreGameKey(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (myTurn && me) {
        const ids = me.hand.map((x) => x.id);
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          setSelected((s) => {
            const i = s === null ? (e.key === "ArrowLeft" ? ids.length - 1 : 0) : (ids.indexOf(s) + (e.key === "ArrowLeft" ? -1 : 1) + ids.length) % ids.length;
            return ids[i];
          });
        } else if (e.key === "Enter" && selected !== null) { e.preventDefault(); doDiscard(selected); }
        else if (e.key === "Escape") setSelected(null);
      } else if (g.phase === "claim" && e.key === "Escape") { e.preventDefault(); claim(null); }
      else if (g.phase === "rob" && e.key === "Escape") { e.preventDefault(); setG(E.declineRob(g)); }
      else if ((g.phase === "handOver") && e.key === "Enter") { e.preventDefault(); setG(E.nextHand(g)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, sheet, myTurn, selected]);

  const newGame = async () => {
    if (g && g.phase !== "gameOver" && g.handNo > 0) {
      const ok = await confirmDialog({ title: "Leave this game?", message: `${g.handNo} hands of scores are lost. Stats already counted stay.`, confirmLabel: "New game" });
      if (!ok) return;
    }
    if (timer.current) clearTimeout(timer.current);
    setG(null);
    setSelected(null);
  };
  const resetStats = async () => {
    const ok = await confirmDialog({ title: "Reset statistics?", message: "Hands, wins, fan records and claim counts go back to zero.", confirmLabel: "Reset stats" });
    if (ok) { setStats(STATS_DEFAULT); writeStore("mahjong_stats", STATS_DEFAULT); }
  };

  const statRows = [
    { label: "Games / won", value: `${stats.games} / ${stats.gamesWon}` },
    { label: "Hands played", value: stats.hands },
    { label: "Hands won", value: stats.wins },
    { label: "Self-drawn / off a discard", value: `${stats.selfDraws} / ${stats.discardWins}` },
    { label: "Paid out (dealt in)", value: stats.shot },
    { label: "Highest fan", value: stats.highestFan || "—" },
    { label: "Average fan", value: stats.wins ? (stats.totalFan / stats.wins).toFixed(1) : "—" },
    { label: "Pongs / chows / kongs", value: `${stats.pongs} / ${stats.chows} / ${stats.kongs}` },
  ];

  const sheets = (
    <>
      <Guide open={sheet === "guide"} onClose={() => setSheet(null)} hints={hints !== "off"} onHints={(v) => savePrefs({ hints: v ? "basic" : "off" })} />
      <GameSheet open={sheet === "stats"} onClose={() => setSheet(null)} title="Record">
        <StatRows rows={statRows} />
        <SectionLabel>Reset</SectionLabel>
        <button onClick={resetStats} className="px-3 py-2 rounded-lg border border-[#e8e2d8] dark:border-[#3a3530] text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:border-(--accent) hover:text-(--accent) transition-colors">Reset stats</button>
      </GameSheet>
      <GameSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Settings">
        <GameSettingsBody>
          <Segmented<HintLevel> label="Hints" value={hints} onChange={(v) => savePrefs({ hints: v })} options={HINT_LEVELS} />
          <p className="text-[11px] text-[#6f6455] -mt-1 pb-2">Basic glows the tile a bot would throw. Full also lists your waits and the fan the hand is heading for.</p>
        </GameSettingsBody>
      </GameSheet>
      {g && (
        <GameSheet open={sheet === "scores"} onClose={() => setSheet(null)} title="Scores">
          <Scoreboard g={g} />
        </GameSheet>
      )}
    </>
  );

  // ── Setup screen ──
  if (!g) {
    return (
      <div ref={boardRef} className="max-w-md mx-auto select-none">
        <div className="bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#2a2520] rounded-2xl p-5">
          <p className="text-sm text-[#111010] dark:text-[#e8ddd0] mb-4">
            Hong Kong rules. Four sets and a pair, three fan minimum, four winds to a game. Tyunnie sits across from you and claims to be bad at it.
          </p>
          <Segmented<Difficulty> label="Bots" value={prefs.difficulty} onChange={(v) => savePrefs({ difficulty: v })} options={DIFFICULTIES} />
          <Segmented<HintLevel> label="Hints" value={hints} onChange={(v) => savePrefs({ hints: v })} options={HINT_LEVELS} />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setG(E.newGame(prefs.difficulty))} className="flex-1 py-2.5 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest hover:bg-(--accent-dim) transition-colors">
              Deal
            </button>
            <button onClick={() => setSheet("guide")} className="px-4 py-2.5 rounded-xl border-2 border-[#e8e2d8] dark:border-[#3a3530] text-[#111010] dark:text-[#e8ddd0] text-xs font-bold uppercase tracking-widest hover:border-(--accent) transition-colors flex items-center gap-2">
              <BookOpen size={16} strokeWidth={1.75} /> How to play
            </button>
            <button onClick={() => setSheet("settings")} aria-label="Settings" className="tap-target px-3 rounded-xl border-2 border-[#e8e2d8] dark:border-[#3a3530] text-[#111010] dark:text-[#e8ddd0] hover:border-(--accent) transition-colors">
              <Settings2 size={16} strokeWidth={1.75} />
            </button>
          </div>
          {stats.hands > 0 && (
            <p className="font-mono text-[10px] text-[#756a5a] mt-4">
              {stats.hands} hands · {stats.wins} won · best {stats.highestFan} fan
              <button onClick={() => setSheet("stats")} className="tap-target ml-2 underline hover:text-(--accent)">record</button>
            </p>
          )}
        </div>
        {sheets}
      </div>
    );
  }

  // ── Table ──
  const seatWindOf = (s: Seat) => WIND_NAMES[(((s - g.dealer) % 4) + 4) % 4];
  const isActive = (s: Seat) => g.turn === s && (g.phase === "discard" || g.phase === "draw");
  const lastDiscardOf = (s: Seat) => (g.lastDiscard?.seat === s ? g.lastDiscard.tile.id : -1);

  const nameTag = (s: Seat, vertical = false) => (
    <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest whitespace-nowrap ${isActive(s) ? "text-[#fbd38d] font-bold" : "text-[#b0a090]"} ${vertical ? "[writing-mode:vertical-rl]" : ""}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive(s) ? "bg-(--accent) motion-safe:animate-pulse" : "bg-white/15"}`} aria-hidden />
      <span>{E.NAMES[s]}</span>
      <span className="text-[#e8ddd0]">{seatWindOf(s)}</span>
      {g.dealer === s && <span className="rounded px-1 bg-white/10 text-[#e8ddd0] normal-case tracking-normal">dealer</span>}
      <span className="tabular-nums">{g.players[s].score}</span>
    </div>
  );

  /** A bot's tiles: hidden backs, exposed melds, flowers. Side seats lay sideways. */
  const seat = (s: Seat, side: "top" | "left" | "right" | "row") => {
    const p = g.players[s];
    const vertical = side === "left" || side === "right";
    const backs = vertical ? (
      <div className="flex flex-col gap-[2px]" aria-label={`${p.hand.length} tiles`}>
        {p.hand.map((t) => (
          <div key={t.id} className="rounded-[2px] bg-(--accent) border border-(--accent-dim) shadow-[1px_1px_0_rgba(0,0,0,0.4)]" style={{ width: Math.round(sideW * 1.35), height: sideW }} aria-hidden />
        ))}
      </div>
    ) : side === "row" ? (
      <span className="font-mono text-[10px] text-[#b0a090] bg-white/10 rounded-full px-2 py-0.5">{p.hand.length} tiles</span>
    ) : (
      <div className="flex flex-wrap gap-[2px]" aria-label={`${p.hand.length} tiles`}>
        {p.hand.map((t) => <TileView key={t.id} width={miniW} faceDown />)}
      </div>
    );
    const melds = (
      <div className={`flex ${vertical ? "flex-col" : "flex-row flex-wrap"} gap-1.5`}>
        {p.melds.map((m, i) => (
          <div key={i} className={`flex ${vertical ? "flex-col" : "flex-row"} gap-px`}>
            {m.tiles.map((t, j) => (
              <RotatedTile key={t.id} tile={t} width={miniW} faceDown={!!m.concealed && j > 0} rotate={vertical ? (side === "left" ? 90 : -90) : 0} />
            ))}
          </div>
        ))}
        {p.flowers.length > 0 && (
          <div className={`flex ${vertical ? "flex-col" : "flex-row"} gap-px opacity-80`}>
            {p.flowers.map((t) => <RotatedTile key={t.id} tile={t} width={miniW} rotate={vertical ? (side === "left" ? 90 : -90) : 0} />)}
          </div>
        )}
      </div>
    );
    if (vertical) {
      return (
        <div className={`flex items-start gap-2 ${side === "left" ? "flex-row" : "flex-row-reverse"}`}>
          {nameTag(s, true)}
          <div className="flex flex-col gap-2">{backs}{melds}</div>
        </div>
      );
    }
    const align = side === "row" && s === 3 ? "items-start" : side === "row" && s === 1 ? "items-end" : "items-center";
    return (
      <div className={`flex flex-col ${align} gap-1.5`}>
        {nameTag(s)}
        <div className="flex flex-wrap items-center justify-center gap-2">{backs}{melds}</div>
      </div>
    );
  };

  /** A seat's discard pool, laid toward the table centre. */
  const pool = (s: Seat, vertical: boolean) => {
    const p = g.players[s];
    const last = lastDiscardOf(s);
    return (
      <div className={`flex ${vertical ? "flex-col flex-wrap max-h-full content-start" : "flex-row flex-wrap"} gap-[2px] ${vertical ? "" : "justify-center"}`} aria-label={`${E.NAMES[s]} discards`} style={vertical ? { maxHeight: 6 * (Math.round(miniW * 1.35) + 2) } : undefined}>
        {p.discards.map((t) => (
          <div key={t.id} className={`animate-tile-in ${t.id === last ? "ring-2 ring-(--accent) rounded-[3px]" : ""}`}>
            <TileView tile={t} width={miniW} />
          </div>
        ))}
      </div>
    );
  };

  // Wall: four edge strips, each a quarter of the 144. The head (the live
  // draw) empties from the seat about to draw round the table; replacements
  // and flower swaps come off the tail, the far end of the last strip.
  const wallLeft = g.wall.length;
  const strip = (idx: number, vertical: boolean) => {
    const seg = Math.max(0, Math.min(36, wallLeft - 36 * idx));
    const pct = (seg / 36) * 100;
    const size = 5;
    return (
      <div aria-hidden className={vertical ? "w-[7px] h-full flex flex-col justify-end" : "h-[7px] w-full flex"}>
        <div
          className="rounded-[1px]"
          style={{
            [vertical ? "height" : "width"]: `${pct}%`,
            [vertical ? "width" : "height"]: "100%",
            background: `repeating-linear-gradient(${vertical ? "180deg" : "90deg"}, var(--accent) 0 ${size}px, var(--accent-dim) ${size}px ${size + 1}px)`,
            opacity: 0.85,
          }}
        />
      </div>
    );
  };

  const centreHub = (
    <div className="flex flex-col items-center justify-center text-center gap-1 min-h-[72px]">
      {g.phase === "claim" && g.lastDiscard ? (
        <div className="animate-spotlight-in flex flex-col items-center gap-1">
          <TileView tile={g.lastDiscard.tile} width={Math.round(tileW * 1.2)} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#fbd38d]">{E.NAMES[g.lastDiscard.seat]} discarded</span>
        </div>
      ) : g.phase === "rob" && g.pendingKong ? (
        <div className="animate-spotlight-in flex flex-col items-center gap-1">
          <TileView tile={g.pendingKong.tile} width={Math.round(tileW * 1.2)} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#fbd38d]">{E.NAMES[g.pendingKong.seat]} adds to a pung</span>
        </div>
      ) : (
        <>
          <span className="font-serif text-3xl leading-none text-[#e8ddd0]" aria-label={`${WIND_EN[g.roundWind]} round`}>{WIND_NAMES[g.roundWind]}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#b0a090]">
            {WIND_EN[g.roundWind]} {g.dealer + 1}{g.streak > 0 ? ` · 連${g.streak}` : ""} · {wallLeft} in wall
          </span>
          {myTurn && <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#fbd38d] motion-safe:animate-pulse">Your turn</span>}
          {!myTurn && (g.phase === "discard" || g.phase === "draw") && <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#b0a090]">{E.NAMES[g.turn]} thinking…</span>}
        </>
      )}
    </div>
  );

  const status = (() => {
    if (g.phase === "claim") return `${E.NAMES[g.lastDiscard!.seat]} threw ${tileName(g.lastDiscard!.tile)}. Take it?`;
    if (g.phase === "rob") return `${E.NAMES[g.pendingKong!.seat]} is adding to a pung — you can rob it and win.`;
    if (myTurn) return canWin ? "You can win." : selected !== null ? "Tap Discard, or pick another tile." : "Your turn — pick a tile to discard.";
    if (g.phase === "discard" || g.phase === "draw") return `${E.NAMES[g.turn]} is thinking…`;
    return "";
  })();

  const poolH = 2 * (Math.round(miniW * 1.35) + 2);

  return (
    <div ref={boardRef} className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="font-mono text-xs text-[#6f6455] min-w-0 truncate">
          <span className="font-bold text-[#111010] dark:text-[#e8ddd0]">{WIND_EN[g.roundWind]} {g.dealer + 1}</span>
          <span className="mx-2 text-[#e8e2d8] dark:text-[#3a3530]">·</span>hand {g.handNo + 1}
          <span className="mx-2 text-[#e8e2d8] dark:text-[#3a3530]">·</span><span className="capitalize">{g.difficulty}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderButton onClick={() => setSheet("scores")} label="Scores" icon={<Trophy size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("guide")} label="Guide" icon={<BookOpen size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("stats")} label="Record" icon={<BarChart3 size={16} strokeWidth={1.75} />} showLabel={false} />
          <HeaderButton onClick={() => setSheet("settings")} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} showLabel={false} />
          <HeaderButton onClick={newGame} label="New game" icon={<RotateCcw size={16} strokeWidth={1.75} />} showLabel={false} />
        </div>
      </div>

      {!landscape && (
        <div className="flex items-center gap-2 text-xs text-[#6f6455] bg-(--accent-soft) border border-(--accent-mid) rounded-xl px-3 py-2 mb-3">
          <Smartphone size={16} strokeWidth={1.75} className="shrink-0 rotate-90" />
          Rotate your phone for the full table. Portrait works — it&apos;s just cosier.
        </div>
      )}

      {/* Table */}
      <div className={`${FELT} p-3 sm:p-4`}>
        <FeltVignette />
        {landscape ? (
          <div className="relative grid gap-2" style={{ gridTemplateColumns: "auto 1fr auto", gridTemplateRows: "auto 1fr auto" }}>
            <div />
            <div className="flex justify-center">{seat(2, "top")}</div>
            <div />
            <div className="flex items-center">{seat(3, "left")}</div>
            {/* Centre: wall strips round a 3×3 of pools with the hub in the middle */}
            <div className="relative rounded-2xl bg-black/25 p-2 flex flex-col gap-1.5 min-h-[220px]">
              {strip(2, false)}
              <div className="flex-1 flex gap-1.5 min-h-0">
                {strip(3, true)}
                <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: "auto 1fr auto", gridTemplateRows: "auto 1fr auto" }}>
                  <div />
                  <div className="flex justify-center" style={{ minHeight: poolH }}>{pool(2, false)}</div>
                  <div />
                  <div className="flex items-start">{pool(3, true)}</div>
                  <div className="flex items-center justify-center">{centreHub}</div>
                  <div className="flex items-start justify-end">{pool(1, true)}</div>
                  <div />
                  <div className="flex justify-center" style={{ minHeight: poolH }}>{pool(0, false)}</div>
                  <div />
                </div>
                {strip(1, true)}
              </div>
              {strip(0, false)}
            </div>
            <div className="flex items-center justify-end">{seat(1, "right")}</div>
            <div />
            <div className="col-span-3">{myArea()}</div>
          </div>
        ) : (
          <div className="relative flex flex-col gap-3">
            {seat(2, "top")}
            <div className="flex justify-between gap-2">
              <div className="flex flex-col items-start gap-1">{seat(3, "row")}</div>
              <div className="flex flex-col items-end gap-1">{seat(1, "row")}</div>
            </div>
            <div className="rounded-2xl bg-black/25 p-2 flex flex-col gap-1.5">
              {strip(2, false)}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="col-span-2 flex justify-center" style={{ minHeight: poolH }}>{pool(2, false)}</div>
                <div>{pool(3, false)}</div>
                <div>{pool(1, false)}</div>
                <div className="col-span-2">{centreHub}</div>
                <div className="col-span-2 flex justify-center" style={{ minHeight: poolH }}>{pool(0, false)}</div>
              </div>
              {strip(0, false)}
            </div>
            {myArea()}
          </div>
        )}

        {/* Hand over / game over — the winning hand is the star */}
        {(g.phase === "handOver" || g.phase === "gameOver") && (
          <div className="absolute inset-0 z-10 rounded-3xl bg-[#1f1b17]/95 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 flex flex-col items-center text-center animate-spotlight-in" role="status" aria-live="polite">
            {g.phase === "gameOver" ? (
              <>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#b0a090]">Game over · {g.handNo + 1} hands</p>
                <p className="font-serif italic text-3xl text-[#e8ddd0] mt-1 mb-4">
                  {(() => { const top = Math.max(...g.players.map((p) => p.score)); const w = g.players.map((p, i) => (p.score === top ? i : -1)).filter((i) => i >= 0); return w.length === 1 ? `${E.NAMES[w[0]]} ${w[0] === E.HUMAN ? "win" : "wins"} the table` : "Shared table"; })()}
                </p>
                <div className="w-full max-w-sm text-left"><Scoreboard g={g} dark /></div>
                <button onClick={() => setG(null)} className="mt-5 px-5 py-2.5 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest hover:bg-(--accent-dim) transition-colors">New game</button>
              </>
            ) : result?.kind === "draw" ? (
              <>
                <p className="font-serif italic text-3xl text-[#e8ddd0] mt-6">Draw</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#b0a090] mt-1">Wall exhausted · {E.NAMES[g.dealer]} keeps the deal</p>
                <p className="text-xs text-[#b0a090] mt-3 mb-5">{quip}</p>
                <button onClick={() => setG(E.nextHand(g))} className="px-5 py-2.5 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest hover:bg-(--accent-dim) transition-colors">Next hand <Kbd>Enter</Kbd></button>
              </>
            ) : result ? (
              <>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#b0a090]">{result.shooter !== null ? `off ${E.NAMES[result.shooter]}'s discard` : "self-drawn"}</p>
                <p className="font-serif italic text-3xl text-[#e8ddd0] mt-1">{E.NAMES[result.winner]} {result.winner === E.HUMAN ? "win" : "wins"}</p>
                <p className="font-mono text-sm text-[#fbd38d] mt-1 mb-4">{result.score.total} fan{result.score.total >= LIMIT ? " · limit" : ""}</p>
                <div className="flex gap-[3px] flex-wrap justify-center mb-4">
                  {g.players[result.winner].melds.map((m, i) => (
                    <div key={i} className="flex gap-px mr-2">
                      {m.tiles.map((t) => <TileView key={t.id} tile={t} width={tileW} />)}
                    </div>
                  ))}
                  {g.players[result.winner].hand.map((t) => (
                    <div key={t.id} className={t.id === result.winningTile.id ? "ring-2 ring-(--accent) rounded-[3px] -translate-y-1" : ""}>
                      <TileView tile={t} width={tileW} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#b0a090] mb-4">{quip}</p>
                <div className="w-full max-w-sm grid sm:grid-cols-2 gap-4 text-left">
                  <ul className="text-xs text-[#e8ddd0] divide-y divide-white/10">
                    {result.score.fans.map((f, i) => (
                      <li key={i} className="flex justify-between py-1 gap-3">
                        <span>{f.name} <span className="text-[#b0a090]">{f.zh}</span></span>
                        <span className="font-mono font-bold tabular-nums">{f.fan >= LIMIT ? "limit" : f.fan}</span>
                      </li>
                    ))}
                  </ul>
                  <Scoreboard g={g} deltas={result.deltas} dark />
                </div>
                <button onClick={() => setG(E.nextHand(g))} className="mt-5 px-5 py-2.5 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest hover:bg-(--accent-dim) transition-colors">Next hand <Kbd>Enter</Kbd></button>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 min-h-[60px]">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="font-mono text-xs text-[#111010] dark:text-[#e8ddd0]" role="status" aria-live="polite">{status}</div>
          {hints === "full" && (waits.length > 0 || underMin || potential !== null) && (
            <p className="font-mono text-[10px] text-[#6f6455]">
              {underMin ? `Complete, but under ${MIN_FAN} fan — can't declare yet.` : waits.length ? `Waiting on: ${waits.map((k) => tileName(kindTile(k))).join(", ")}` : potential !== null ? `Shape heads for ~${potential} fan` : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {myTurn && (
            <>
              {canWin && <Btn primary onClick={() => setG(E.declareWin(g, E.HUMAN))} pulse={hints !== "off"}>Win · {canWin.total} fan</Btn>}
              {kongs.map((k) => (
                <Btn key={k} onClick={() => { setSelected(null); setG(E.declareKong(g, E.HUMAN, k)); }}>Kong {tileName(kindTile(k))}</Btn>
              ))}
              <Btn primary={!canWin} disabled={selected === null} onClick={() => selected !== null && doDiscard(selected)}>Discard <Kbd>Enter</Kbd></Btn>
            </>
          )}
          {g.phase === "claim" && !chowPick && (
            <>
              {g.humanClaims.map((c) => (
                <Btn key={c} primary={c === "win"} pulse={hints !== "off" && c === "win"} onClick={() => (c === "chow" && chowSets.length > 1 ? setChowPick(true) : claim(c))}>
                  {c === "win" ? "Win" : c[0].toUpperCase() + c.slice(1)}
                </Btn>
              ))}
              <Btn onClick={() => claim(null)}>Pass <Kbd>Esc</Kbd></Btn>
            </>
          )}
          {g.phase === "claim" && chowPick && g.lastDiscard && (
            <>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#6f6455] w-full">Which run?</span>
              {chowSets.map(([a, b], i) => (
                <button key={i} onClick={() => claim("chow", i)} className="flex gap-px p-1.5 rounded-lg border-2 border-[#e8e2d8] dark:border-[#3a3530] hover:border-(--accent) transition-colors" aria-label={`Chow ${tileName(a)}, ${tileName(b)}, ${tileName(g.lastDiscard!.tile)}`}>
                  <TileView tile={a} width={miniW} /><TileView tile={b} width={miniW} />
                  <span className="ring-2 ring-(--accent) rounded-[3px]"><TileView tile={g.lastDiscard!.tile} width={miniW} /></span>
                </button>
              ))}
              <Btn onClick={() => setChowPick(false)}>Back</Btn>
            </>
          )}
          {g.phase === "rob" && (
            <>
              <Btn primary pulse={hints !== "off"} onClick={() => setG(E.robKong(g, E.HUMAN))}>Rob the kong · Win</Btn>
              <Btn onClick={() => setG(E.declineRob(g))}>Pass <Kbd>Esc</Kbd></Btn>
            </>
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-[#756a5a] font-mono mt-5">
        Hong Kong rules · {MIN_FAN} fan minimum · Chow only from the left · <Kbd>←</Kbd> <Kbd>→</Kbd> pick, <Kbd>Enter</Kbd> discard
      </p>

      {sheets}
    </div>
  );

  function myArea() {
    if (!g || !me) return null;
    return (
      <div className="pt-2">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          {nameTag(E.HUMAN)}
          {me.melds.length > 0 || me.flowers.length > 0 ? (
            <div className="flex gap-2 flex-wrap justify-end">
              {me.melds.map((m, i) => (
                <div key={i} className="flex gap-px">
                  {m.tiles.map((t, j) => <TileView key={t.id} tile={t} width={miniW} faceDown={!!m.concealed && j > 0} />)}
                </div>
              ))}
              {me.flowers.length > 0 && <div className="flex gap-px opacity-80">{me.flowers.map((t) => <TileView key={t.id} tile={t} width={miniW} />)}</div>}
            </div>
          ) : null}
        </div>
        <div className={`flex gap-[3px] items-end ${landscape ? "flex-wrap" : "overflow-x-auto pb-2"}`} role="group" aria-label="Your hand">
          {me.hand.map((t) => {
            const drawn = t.id === g.drawnId;
            return (
              <div key={t.id} className={`${drawn ? "ml-3 animate-tile-in" : ""}`}>
                <TileView tile={t} width={tileW} selected={selected === t.id} hint={hints !== "off" && hintDiscard === t.id} onClick={() => onTile(t.id)} label={`${tileName(t)}${drawn ? ", just drawn" : ""}`} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

/** A tile turned to lie sideways for the left/right seats — wrapper takes the rotated box so flex layout stays honest. */
function RotatedTile({ tile, width, faceDown, rotate }: { tile: Tile; width: number; faceDown?: boolean; rotate: 0 | 90 | -90 }) {
  const h = Math.round(width * 1.35);
  if (!rotate) return <TileView tile={tile} width={width} faceDown={faceDown} />;
  return (
    <div style={{ width: h, height: width }} className="relative shrink-0">
      <div className="absolute left-1/2 top-1/2" style={{ width, height: h, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}>
        <TileView tile={tile} width={width} faceDown={faceDown} />
      </div>
    </div>
  );
}

function Scoreboard({ g, deltas, dark }: { g: E.Game; deltas?: number[]; dark?: boolean }) {
  const order = [0, 1, 2, 3].sort((a, b) => g.players[b].score - g.players[a].score);
  const text = dark ? "text-[#e8ddd0]" : "text-[#111010] dark:text-[#e8ddd0]";
  const muted = dark ? "text-[#b0a090]" : "text-[#6f6455]";
  return (
    <div>
      <table className={`w-full text-sm ${text}`}>
        <thead>
          <tr className={`font-mono text-[10px] uppercase tracking-widest ${muted}`}>
            <th className="text-left font-normal pb-1">Seat</th>
            <th className="text-right font-normal pb-1">Total</th>
            {deltas && <th className="text-right font-normal pb-1">This hand</th>}
          </tr>
        </thead>
        <tbody>
          {order.map((i) => (
            <tr key={i} className={`border-t ${dark ? "border-white/10" : "border-[#e8e2d8] dark:border-[#2a2520]"}`}>
              <td className="py-1.5">
                {E.NAMES[i]} <span className={`font-mono text-[10px] ${muted}`}>{WIND_NAMES[(((i - g.dealer) % 4) + 4) % 4]}{g.dealer === i ? " · dealer" : ""}</span>
              </td>
              <td className="py-1.5 text-right font-mono font-bold tabular-nums">{g.players[i].score}</td>
              {deltas && (
                <td className={`py-1.5 text-right font-mono tabular-nums ${deltas[i] > 0 ? "text-[#4ade80]" : deltas[i] < 0 ? "text-[#f5a5a5]" : muted}`}>
                  {deltas[i] > 0 ? `+${deltas[i]}` : deltas[i] < 0 ? `−${-deltas[i]}` : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`font-mono text-[10px] mt-2 ${muted}`}>
        {WIND_EN[g.roundWind]} round · dealer {E.NAMES[g.dealer]}{g.streak > 0 ? ` (連莊 ${g.streak})` : ""} · hand {g.handNo + 1} · {g.difficulty}
      </p>
    </div>
  );
}

function Btn({ children, onClick, primary, disabled, pulse }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; pulse?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
        primary ? "bg-(--accent) text-(--accent-on) hover:bg-(--accent-dim)" : "border-2 border-[#e8e2d8] dark:border-[#3a3530] text-[#111010] dark:text-[#e8ddd0] hover:border-(--accent)"
      } ${pulse ? "motion-safe:animate-pulse" : ""}`}
    >
      {children}
    </button>
  );
}
