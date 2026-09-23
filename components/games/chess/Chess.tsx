// components/games/chess/Chess.tsx
// Presentation over engine.ts + bot.ts. Owns: the setup screen, the board
// (selection, legal dots, last move, check, keyboard cursor, flip), clocks,
// the bot's pause + search call, promotion choice, draw-offer / resign flow,
// the moves sheet with PGN export, persistence and the record sheet. No rule
// lives here — legality, SAN and results all come from the engine.
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { BarChart3, Settings2, Undo2, Flag, Handshake, ScrollText, Copy, Check, RefreshCw, Sparkles, Play } from "lucide-react";
import * as E from "./engine";
import { bestMove, acceptsDraw } from "./bot";
import { GameSheet, GameSettingsBody, StatRows, SectionLabel, HeaderButton, Segmented, ignoreGameKey } from "../ui";
import { readStore, writeStore, clearStore, useGameSettings, scaleDelay } from "@/lib/gameStore";
import { play as cue, setAudioEnabled } from "@/lib/gameAudio";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { Kbd } from "@/components/ui/Kbd";
import { todayKey } from "@/lib/dayKey";

const PREFS_KEY = "chess";
const STATS_KEY = "chess_stats";
const SAVE_KEY = "chess_save";
const BOT_PAUSE_MS = 450;
const BOT_BUDGET_MS = 1500;

type Prefs = { mode: string; difficulty: string; color: string; control: number };
const PREFS_DEFAULT: Prefs = { mode: "bot", difficulty: "normal", color: "w", control: 0 };
type Save = { game: E.Game | null };

const asMode = (v: string): E.Mode => (v === "2p" ? "2p" : "bot");
const asDifficulty = (v: string): E.Difficulty => (v === "easy" || v === "hard" || v === "expert" ? v : "normal"); // "medium" → normal
const asColor = (v: string): E.Color => (v === "b" ? "b" : "w");

const CONTROLS: { value: number; label: string; hint: string }[] = [
  { value: 0, label: "None", hint: "no clock" },
  { value: 60, label: "1 min", hint: "bullet" },
  { value: 180, label: "3 min", hint: "blitz" },
  { value: 300, label: "5 min", hint: "blitz" },
  { value: 600, label: "10 min", hint: "rapid" },
  { value: 900, label: "15 min", hint: "rapid" },
  { value: 1800, label: "30 min", hint: "classical" },
];

const GLYPH: Record<E.PieceType, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const PIECE_NAME: Record<E.PieceType, string> = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight", P: "Pawn" };
const DIFF_LABEL: Record<E.Difficulty, string> = { easy: "Easy", normal: "Normal", hard: "Hard", expert: "Expert" };

const QUIPS = {
  win: ["Okay. That one's on me. Rematch? 🧡", "You saw that three moves before I did.", "Fine. You win. Don't be smug about it."],
  lose: ["Checkmate. I did warn you about Expert 🧡", "Good game. Genuinely. Again?", "I play dirty. I said so on the card."],
  draw: ["A draw. Peace in our time.", "Neither of us blinked 🧡", "Split the point. Split the snacks."],
};
const pick = (a: string[], seed: number) => a[seed % a.length];
const mmss = (secs: number) => { const s = Math.ceil(secs); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

function Glyph({ piece, size }: { piece: E.Piece; size: number }) {
  return (
    <span
      aria-hidden
      className="leading-none pointer-events-none select-none"
      style={{
        fontSize: size,
        color: piece.color === "w" ? "#ffffff" : "#1a1208",
        WebkitTextStroke: piece.color === "w" ? "1px #7a5c3a" : "1px rgba(255,255,255,0.18)",
        filter: piece.color === "w" ? "drop-shadow(0 1px 2px rgba(0,0,0,0.35))" : "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
      }}
    >
      {GLYPH[piece.type]}
    </span>
  );
}

export default function Chess() {
  const [settings] = useGameSettings();
  useEffect(() => setAudioEnabled(settings.sound), [settings.sound]);

  const [prefs, setPrefs] = useState<Prefs>(() => readStore(PREFS_KEY, PREFS_DEFAULT));
  const [stats, setStats] = useState<E.Stats>(() => {
    const s = readStore(STATS_KEY, E.EMPTY_STATS);
    return { ...E.EMPTY_STATS, ...s, byDifficulty: { ...E.EMPTY_STATS.byDifficulty, ...s.byDifficulty } };
  });
  const [g, setG] = useState<E.Game | null>(null);
  const [resumable, setResumable] = useState<E.Game | null>(() => {
    const sv = readStore<Save>(SAVE_KEY, { game: null }).game;
    return sv && sv.result === "*" && Array.isArray(sv.history) && sv.pos?.board?.length === 64 ? sv : null;
  });
  const [sheet, setSheet] = useState<"moves" | "stats" | "settings" | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // Keyboard cursor; the ring only shows while the keyboard is driving.
  const [cursor, setCursor] = useState<number | null>(null);
  const [kbNav, setKbNav] = useState(false);
  const [promotion, setPromotion] = useState<E.Move[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [drawNote, setDrawNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const promoTrap = useFocusTrap<HTMLDivElement>(!!promotion);

  useEffect(() => writeStore(PREFS_KEY, prefs), [prefs]);
  useEffect(() => writeStore(STATS_KEY, stats), [stats]);

  // ── Persistence: the game is replayable from its move list, so that is what is saved ──
  const gRef = useRef(g);
  useEffect(() => { gRef.current = g; }, [g]);
  const tick = g?.tick ?? -1, result = g?.result ?? "*";
  useEffect(() => {
    const cur = gRef.current;
    if (!cur || tick < 0) return;
    if (result === "*" && cur.history.length) writeStore<Save>(SAVE_KEY, { game: cur });
    else clearStore(SAVE_KEY);
  }, [tick, result]);
  useEffect(() => () => { const cur = gRef.current; if (cur && cur.result === "*" && cur.history.length) writeStore<Save>(SAVE_KEY, { game: cur }); }, []);

  // Record once.
  const recorded = useRef(false);
  useEffect(() => {
    if (g && g.result !== "*" && !recorded.current) { recorded.current = true; setStats((s) => E.recordResult(s, g)); }
  }, [g]);

  // Sound from diffs.
  const prev = useRef<E.Game | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = g;
    if (!g || !p || p.tick === g.tick) return;
    if (g.result !== "*") {
      const humanWon = g.mode === "bot" && ((g.result === "1-0" && g.human === "w") || (g.result === "0-1" && g.human === "b"));
      cue(g.result === "1/2-1/2" ? "push" : g.mode === "2p" ? "win" : humanWon ? "win" : "lose");
    } else if (g.history.length > p.history.length) {
      const last = g.history[g.history.length - 1];
      cue(g.status === "check" ? "check" : last.move.capture ? "capture" : "move");
    } else if (g.history.length < p.history.length) cue("undo");
  }, [g]);

  // Clock. Charges wall-clock deltas, not one second per interval: the effect
  // must not restart on every move (a sub-second move would be free), and the
  // bot's synchronous search blocks the interval — the next delta bills it.
  const clockRunning = !!g && g.result === "*" && g.control > 0;
  useEffect(() => {
    if (!clockRunning) return;
    let last = Date.now();
    const t = setInterval(() => {
      const now = Date.now(), dt = (now - last) / 1000;
      last = now;
      setG((cur) => (cur ? E.tickClock(cur, dt) : cur));
    }, 250);
    return () => clearInterval(t);
  }, [clockRunning]);

  // Bot reply: a short pause for pacing, then a synchronous search under budget.
  // "Thinking" is simply "it is the bot's turn" — no separate state to drift.
  const thinking = !!g && g.mode === "bot" && g.result === "*" && g.pos.turn !== g.human;
  useEffect(() => {
    if (!thinking) return;
    const t = setTimeout(() => {
      // Search outside the updater: it is slow and updaters must stay pure.
      const cur = gRef.current;
      if (!cur || cur.tick !== tick) return;
      const r = bestMove(cur.pos, cur.difficulty, BOT_BUDGET_MS);
      if (r.move) setG((c) => (c && c.tick === tick ? E.play(c, r.move!) : c));
    }, scaleDelay(BOT_PAUSE_MS, settings));
    return () => clearTimeout(t);
  }, [thinking, tick, settings]);

  // ── Setup ──
  const start = useCallback(() => {
    recorded.current = false;
    const next = E.newGame({ mode: asMode(prefs.mode), difficulty: asDifficulty(prefs.difficulty), human: asColor(prefs.color), control: prefs.control });
    setG(next);
    setSelected(null); setCursor(null); setPromotion(null); setDrawNote(null);
    setFlipped(next.mode === "bot" && next.human === "b");
    clearStore(SAVE_KEY);
    setResumable(null);
  }, [prefs]);

  const resume = () => {
    if (!resumable) return;
    recorded.current = false;
    setG({ ...resumable, tick: resumable.tick + 1 });
    setFlipped(resumable.mode === "bot" && resumable.human === "b");
    setResumable(null);
  };

  const backToSetup = useCallback(async () => {
    if (g && g.result === "*" && g.history.length) {
      const ok = await confirmDialog({ title: "Leave this game?", message: "It is kept — you can resume it from the setup screen.", confirmLabel: "Leave" });
      if (!ok) return;
    }
    if (g && g.result === "*" && g.history.length) setResumable(g);
    setG(null);
    setSheet(null);
  }, [g]);

  // ── Moves ──
  const humanCanMove = !!g && g.result === "*" && !promotion && (g.mode === "2p" || g.pos.turn === g.human) && !thinking;
  const legal = useMemo(() => (g && selected !== null ? E.legalMoves(g.pos, selected) : []), [g, selected]);

  const tapSquare = useCallback((i: number) => {
    if (!g || !humanCanMove) return;
    const piece = g.pos.board[i];
    if (selected !== null) {
      const targets = legal.filter((m) => m.to === i);
      if (targets.length) {
        if (targets[0].promo) { setPromotion(targets); setSelected(null); return; }
        setG((cur) => (cur ? E.play(cur, targets[0]) : cur));
        setSelected(null);
        return;
      }
      if (piece && piece.color === g.pos.turn && i !== selected) { setSelected(i); return; }
      setSelected(null);
      return;
    }
    if (piece && piece.color === g.pos.turn) setSelected(i);
  }, [g, humanCanMove, selected, legal]);

  const promote = (t: E.PieceType) => {
    const m = promotion?.find((x) => x.promo === t);
    if (m) setG((cur) => (cur ? E.play(cur, m) : cur));
    setPromotion(null);
  };

  const doUndo = useCallback(() => { setG((cur) => (cur ? E.undo(cur) : cur)); setSelected(null); setPromotion(null); }, []);

  const doResign = useCallback(async () => {
    const cur = gRef.current;
    if (!cur || cur.result !== "*") return;
    const who: E.Color = cur.mode === "bot" ? cur.human : cur.pos.turn;
    const ok = await confirmDialog({ title: `Resign as ${who === "w" ? "White" : "Black"}?`, message: "The game ends and counts as a loss.", confirmLabel: "Resign" });
    if (ok) setG((c) => (c ? E.resign(c, who) : c));
  }, []);

  const doOfferDraw = useCallback(() => {
    const cur = gRef.current;
    if (!cur || cur.result !== "*" || cur.drawOffer) return;
    if (cur.mode === "bot") {
      if (acceptsDraw(cur.pos, E.other(cur.human))) { setG((c) => (c ? E.acceptDraw(E.offerDraw(c, c.human)) : c)); setDrawNote(null); }
      else setDrawNote("Tyunnie declines. He thinks he's winning.");
      return;
    }
    setG((c) => (c ? E.offerDraw(c, c.pos.turn) : c));
  }, []);

  // ── Keys ──
  useEffect(() => {
    if (!g) return;
    const onKey = (e: KeyboardEvent) => {
      if (promotion && e.key === "Escape") { e.preventDefault(); setPromotion(null); return; }
      if (sheet || promotion) return;
      if (ignoreGameKey(e)) return;
      const c = cursor ?? (flipped ? 0 : 60);
      const step = (dr: number, dc: number) => {
        e.preventDefault();
        setKbNav(true);
        const r = E.rowOf(c) + (flipped ? -dr : dr), col = E.colOf(c) + (flipped ? -dc : dc);
        if (r >= 0 && r < 8 && col >= 0 && col < 8) setCursor(E.sq(r, col));
      };
      switch (e.key) {
        case "ArrowUp": step(-1, 0); break;
        case "ArrowDown": step(1, 0); break;
        case "ArrowLeft": step(0, -1); break;
        case "ArrowRight": step(0, 1); break;
        case "Enter": case " ": e.preventDefault(); setKbNav(true); if (cursor !== null) tapSquare(cursor); else setCursor(c); break;
        case "Escape": setSelected(null); setCursor(null); setKbNav(false); break;
        case "u": case "U": e.preventDefault(); doUndo(); break;
        case "f": case "F": e.preventDefault(); setFlipped((v) => !v); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [g, sheet, promotion, cursor, flipped, tapSquare, doUndo]);

  // ── Sizing ──
  const wrap = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);
  const inGame = g !== null;
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth));
    ro.observe(el);
    setWrapW(el.clientWidth);
    return () => ro.disconnect();
  }, [inGame]);
  const size = Math.max(240, Math.min(440, wrapW - 24));
  const cell = size / 8;

  const copyPgn = async () => {
    if (!g) return;
    const names = g.mode === "bot" ? (g.human === "w" ? { w: "You", b: `Tyunnie (${DIFF_LABEL[g.difficulty]})` } : { w: `Tyunnie (${DIFF_LABEL[g.difficulty]})`, b: "You" }) : { w: "White", b: "Black" };
    try { await navigator.clipboard.writeText(E.pgn(g, names, todayKey())); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };
  const resetStats = async () => {
    const ok = await confirmDialog({ title: "Reset the record?", message: `${stats.games} games are erased.`, confirmLabel: "Reset" });
    if (ok) setStats({ ...E.EMPTY_STATS, byDifficulty: { easy: { games: 0, wins: 0 }, normal: { games: 0, wins: 0 }, hard: { games: 0, wins: 0 }, expert: { games: 0, wins: 0 } } });
  };

  const settingsSheet = (
    <GameSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Settings">
      <GameSettingsBody>
        <p className="text-[11px] text-[#6f6455] pt-3">Mode, level, colour and clock are chosen on the setup screen for each game.</p>
      </GameSettingsBody>
    </GameSheet>
  );
  const statsSheet = (
    <GameSheet open={sheet === "stats"} onClose={() => setSheet(null)} title="Record">
      <StatRows rows={[
        { label: "Games vs Tyunnie", value: stats.games - stats.twoPlayer },
        { label: "Wins", value: stats.wins },
        { label: "Losses", value: stats.losses },
        { label: "Draws", value: stats.draws },
        { label: "Two-player games", value: stats.twoPlayer },
      ]} />
      <SectionLabel>By level</SectionLabel>
      <StatRows rows={(["easy", "normal", "hard", "expert"] as E.Difficulty[]).map((d) => ({ label: DIFF_LABEL[d], value: `${stats.byDifficulty[d].wins} / ${stats.byDifficulty[d].games}` }))} />
      <button onClick={resetStats} className="mt-4 text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:text-(--accent-text) transition-colors">Reset record</button>
    </GameSheet>
  );

  // ── Setup screen ──
  if (!g) {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-sm text-[#6f6455]">Set the table.</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <HeaderButton onClick={() => setSheet("stats")} label="Record" icon={<BarChart3 size={16} strokeWidth={1.75} />} />
            <HeaderButton onClick={() => setSheet("settings")} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} />
          </div>
        </div>
        {resumable && (
          <div className="mb-4 rounded-2xl border border-(--accent-mid) bg-(--accent-soft) px-4 py-3 flex items-center gap-3 animate-spotlight-in">
            <Sparkles size={18} strokeWidth={1.75} className="text-(--accent-text) shrink-0" />
            <div className="flex-1 min-w-0 text-xs text-[#111010]">
              <b>A game is waiting.</b> {resumable.mode === "bot" ? `vs Tyunnie · ${DIFF_LABEL[resumable.difficulty]}` : "Two-player"} · move {Math.ceil(resumable.history.length / 2)}
            </div>
            <button onClick={resume} className="shrink-0 px-3 py-2 rounded-xl bg-(--accent) text-(--accent-on) text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5"><Play size={12} strokeWidth={2} />Resume</button>
            <button onClick={() => { clearStore(SAVE_KEY); setResumable(null); }} className="tap-target shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#6f6455]">Discard</button>
          </div>
        )}
        <Segmented<E.Mode> label="Opponent" value={asMode(prefs.mode)} onChange={(v) => setPrefs((p) => ({ ...p, mode: v }))} options={[{ value: "bot", label: "Tyunnie", hint: "vs bot" }, { value: "2p", label: "Two player", hint: "pass the board" }]} />
        {asMode(prefs.mode) === "bot" && (
          <>
            <Segmented<E.Difficulty> label="Level" value={asDifficulty(prefs.difficulty)} onChange={(v) => setPrefs((p) => ({ ...p, difficulty: v }))} options={[
              { value: "easy", label: "Easy", hint: "1 ply" }, { value: "normal", label: "Normal", hint: "2 ply" }, { value: "hard", label: "Hard", hint: "3 ply" }, { value: "expert", label: "Expert", hint: "4 ply + q" },
            ]} />
            <Segmented<E.Color> label="You play" value={asColor(prefs.color)} onChange={(v) => setPrefs((p) => ({ ...p, color: v }))} options={[{ value: "w", label: "White", hint: "moves first" }, { value: "b", label: "Black", hint: "Tyunnie opens" }]} />
          </>
        )}
        <div className="py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#6f6455] mb-2">Clock</div>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Clock">
            {CONTROLS.map((c) => (
              <button key={c.value} role="radio" aria-checked={prefs.control === c.value} onClick={() => setPrefs((p) => ({ ...p, control: c.value }))}
                className={`min-h-11 px-2 py-1.5 rounded-xl border-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${prefs.control === c.value ? "border-(--accent) bg-(--accent) text-(--accent-on)" : "border-[#e8e2d8] dark:border-[#3a3530] text-[#111010] dark:text-[#e8ddd0] hover:border-(--accent)"}`}>
                <span className="block">{c.label}</span>
                <span className={`block font-mono text-[9px] normal-case tracking-normal font-normal mt-0.5 ${prefs.control === c.value ? "opacity-80" : "text-[#6f6455]"}`}>{c.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <button onClick={start} className="mt-3 w-full py-4 rounded-2xl bg-(--accent) text-(--accent-on) font-bold text-sm uppercase tracking-widest hover:bg-(--accent-dim) transition-colors">Start game</button>
        <p className="text-[11px] text-[#6f6455] mt-3 text-center">Full rules: castling, en passant, promotion, threefold, fifty-move, insufficient material. Undo, resign, draw offers, PGN export.</p>
        {statsSheet}
        {settingsSheet}
      </div>
    );
  }

  // ── Game screen ──
  const over = g.result !== "*";
  const turnName = g.pos.turn === "w" ? "White" : "Black";
  const you = (c: E.Color) => (g.mode === "bot" ? (c === g.human ? "You" : "Tyunnie") : c === "w" ? "White" : "Black");
  const resultLine = (() => {
    if (!over) return null;
    if (g.result === "1/2-1/2") {
      const why = { stalemate: "Stalemate", repetition: "Threefold repetition", fifty: "Fifty-move rule", material: "Insufficient material", agreement: "Draw agreed" }[g.drawReason ?? "agreement"];
      return `Draw — ${why}`;
    }
    const winner: E.Color = g.result === "1-0" ? "w" : "b";
    const how = g.status === "checkmate" ? "checkmate" : g.status === "resigned" ? "resignation" : "on time";
    return `${you(winner)} ${g.mode === "bot" ? (winner === g.human ? "win" : "wins") : "wins"} by ${how}`;
  })();
  const statusLine = over ? resultLine : thinking ? "Tyunnie is thinking…" : g.drawOffer && g.mode === "2p" ? `${g.drawOffer === "w" ? "White" : "Black"} offers a draw` : g.status === "check" ? `${turnName} is in check` : `${turnName} to move`;
  const quip = over && g.mode === "bot" ? pick(QUIPS[g.result === "1/2-1/2" ? "draw" : (g.result === "1-0") === (g.human === "w") ? "win" : "lose"], stats.games) : null;

  const cap = E.captured(g.pos.board);
  const lastMove = g.history.length ? g.history[g.history.length - 1].move : null;
  const kingInCheck = g.status === "check" || g.status === "checkmate" ? E.kingSquare(g.pos.board, g.pos.turn) : -1;
  const order = flipped ? [...Array(64).keys()].map((i) => 63 - i) : [...Array(64).keys()];
  const pairs = Array.from({ length: Math.ceil(g.history.length / 2) }, (_, i) => [g.history[i * 2]?.san, g.history[i * 2 + 1]?.san]);

  const clockBox = (c: E.Color) => (
    <div className={`flex-1 rounded-2xl px-3 py-2 flex items-center justify-between ${g.pos.turn === c && !over ? "bg-(--accent) text-(--accent-on)" : "bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] text-[#6f6455]"}`}>
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-70">{you(c)}</span>
      <span className={`font-mono font-bold text-lg tabular-nums ${g.clock[c] <= 10 && g.pos.turn === c && !over ? "text-[#dc2626] animate-pulse" : ""}`}>{mmss(g.clock[c])}</span>
    </div>
  );

  return (
    <div className="max-w-md mx-auto select-none">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={() => void backToSetup()} className="tap-target text-[10px] font-mono font-bold uppercase tracking-widest text-[#6f6455] hover:text-(--accent-text) transition-colors shrink-0">← Setup</button>
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderButton onClick={doUndo} label="Undo" icon={<Undo2 size={16} strokeWidth={1.75} />} showLabel={false} />
          <HeaderButton onClick={() => setFlipped((v) => !v)} label="Flip board" icon={<RefreshCw size={16} strokeWidth={1.75} />} showLabel={false} active={flipped} />
          <HeaderButton onClick={() => setSheet("moves")} label="Moves" icon={<ScrollText size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("stats")} label="Record" icon={<BarChart3 size={16} strokeWidth={1.75} />} showLabel={false} />
          <HeaderButton onClick={() => setSheet("settings")} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} showLabel={false} />
        </div>
      </div>

      {/* Status */}
      <div className="text-center mb-3 min-h-[2.5rem]" aria-live="polite">
        <p className={`text-sm font-bold font-mono ${over ? (g.result === "1/2-1/2" ? "text-[#6f6455]" : "text-(--accent-text)") : g.status === "check" ? "text-[#dc2626]" : "text-[#6f6455]"}`}>{statusLine}</p>
        {quip && <p className="text-xs text-[#6f6455] mt-1 italic">&ldquo;{quip}&rdquo;</p>}
        {drawNote && !over && <p className="text-xs text-[#6f6455] mt-1 italic">{drawNote}</p>}
        {g.drawOffer && g.mode === "2p" && !over && (
          <div className="flex justify-center gap-2 mt-2">
            <button onClick={() => setG((c) => (c ? E.acceptDraw(c) : c))} className="px-3 py-1.5 rounded-xl bg-(--accent) text-(--accent-on) text-[10px] font-bold uppercase tracking-widest">Accept</button>
            <button onClick={() => setG((c) => (c ? E.declineDraw(c) : c))} className="px-3 py-1.5 rounded-xl border border-[#e8e2d8] dark:border-[#3a3530] text-[10px] font-bold uppercase tracking-widest text-[#6f6455]">Decline</button>
          </div>
        )}
      </div>

      {g.control > 0 && <div className="flex gap-2 mb-3">{clockBox(flipped ? "w" : "b")}{clockBox(flipped ? "b" : "w")}</div>}

      {/* Captured (top = opponent of the bottom side) */}
      <div className="flex items-center justify-between px-1 mb-1 min-h-5 font-mono text-[10px] text-[#6f6455]">
        <span className="text-base leading-none tracking-tight">{(flipped ? cap.w : cap.b).map((t, i) => <span key={i} style={{ color: flipped ? "#1a1208" : "#f5ede4", WebkitTextStroke: flipped ? "1px #b58863" : "1px #7a5c3a" }}>{GLYPH[t]}</span>)}</span>
        {((flipped ? 1 : -1) * cap.diff) > 0 && <span>+{Math.round(Math.abs(cap.diff) / 100)}</span>}
      </div>

      {/* Board */}
      <div ref={wrap} className="relative flex justify-center">
        <div className="relative" style={{ width: size + 18, paddingLeft: 18, paddingBottom: 16 }}>
          <div className="absolute left-0 top-0 flex flex-col" style={{ height: size }} aria-hidden>
            {(flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]).map((n) => <span key={n} className="flex-1 flex items-center justify-center text-[9px] font-mono text-[#6f6455] w-4">{n}</span>)}
          </div>
          <div className="absolute bottom-0 flex" style={{ width: size, left: 18 }} aria-hidden>
            {(flipped ? "hgfedcba" : "abcdefgh").split("").map((l) => <span key={l} className="flex-1 text-center text-[9px] font-mono text-[#6f6455]">{l}</span>)}
          </div>
          <div role="grid" aria-label="Chess board" className="grid grid-cols-8 rounded-xl overflow-hidden border-2 border-[#8b6b47] shadow-md" style={{ width: size, height: size }}>
            {order.map((i) => {
              const r = E.rowOf(i), c = E.colOf(i);
              const light = (r + c) % 2 === 0;
              const piece = g.pos.board[i];
              const isSel = selected === i;
              const isLegal = legal.some((m) => m.to === i);
              const isLast = !!lastMove && (lastMove.from === i || lastMove.to === i);
              const isCheck = kingInCheck === i;
              const isCur = kbNav && cursor === i;
              let bg = light ? "#f0e2cf" : "#b58863";
              if (isLast) bg = light ? "#f6d99a" : "#d9a85c";
              if (isSel) bg = "var(--accent)";
              if (isCheck) bg = "#f26b6b";
              return (
                <button
                  key={i}
                  role="gridcell"
                  tabIndex={-1}
                  aria-label={`${E.name(i)}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${PIECE_NAME[piece.type].toLowerCase()}` : ""}`}
                  aria-selected={isSel}
                  onClick={() => { setCursor(i); setKbNav(false); tapSquare(i); }}
                  className={`no-tap relative flex items-center justify-center ${humanCanMove ? "cursor-pointer" : "cursor-default"} ${isCur ? "ring-2 ring-inset ring-[#2563eb]" : ""}`}
                  style={{ backgroundColor: bg, width: cell, height: cell }}
                >
                  {isLegal && (piece ? <span className="absolute inset-0 border-4 rounded-sm opacity-70" style={{ borderColor: "var(--accent)" }} /> : <span className="absolute rounded-full opacity-60" style={{ width: cell * 0.28, height: cell * 0.28, backgroundColor: "var(--accent)" }} />)}
                  {piece && <span className="relative z-10"><Glyph piece={piece} size={cell * 0.74} /></span>}
                </button>
              );
            })}
          </div>

          {promotion && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" style={{ left: 18, bottom: 16 }} onClick={(e) => { if (e.target === e.currentTarget) setPromotion(null); }}>
              <div ref={promoTrap} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Promote pawn" className="bg-white dark:bg-[#1c1917] rounded-2xl p-3 border border-[#e8e2d8] dark:border-[#3a3530] shadow-2xl animate-spotlight-in">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#6f6455] mb-2 text-center">Promote to</p>
                <div className="flex gap-2">
                  {(["Q", "R", "B", "N"] as E.PieceType[]).map((t) => (
                    <button key={t} onClick={() => promote(t)} aria-label={PIECE_NAME[t]} className="w-12 h-12 rounded-xl border border-[#e8e2d8] dark:border-[#3a3530] hover:border-(--accent) flex items-center justify-center bg-[#b58863]">
                      <Glyph piece={{ type: t, color: g.pos.turn }} size={30} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-1 mt-1 min-h-5 font-mono text-[10px] text-[#6f6455]">
        <span className="text-base leading-none tracking-tight">{(flipped ? cap.b : cap.w).map((t, i) => <span key={i} style={{ color: flipped ? "#f5ede4" : "#1a1208", WebkitTextStroke: flipped ? "1px #7a5c3a" : "1px #b58863" }}>{GLYPH[t]}</span>)}</span>
        {((flipped ? -1 : 1) * cap.diff) > 0 && <span>+{Math.round(Math.abs(cap.diff) / 100)}</span>}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {over ? (
          <button onClick={start} className="flex-1 py-3 rounded-2xl bg-(--accent) text-(--accent-on) font-bold text-sm uppercase tracking-widest hover:bg-(--accent-dim) transition-colors">Play again</button>
        ) : (
          <>
            <button onClick={doOfferDraw} disabled={!!g.drawOffer || thinking} className="flex-1 py-2.5 rounded-2xl border border-[#e8e2d8] dark:border-[#3a3530] text-[#6f6455] text-xs font-bold uppercase tracking-widest hover:border-(--accent) transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-40"><Handshake size={14} strokeWidth={2} />Offer draw</button>
            <button onClick={() => void doResign()} className="flex-1 py-2.5 rounded-2xl border border-[#e8e2d8] dark:border-[#3a3530] text-[#6f6455] text-xs font-bold uppercase tracking-widest hover:border-[#dc2626] hover:text-[#dc2626] transition-colors inline-flex items-center justify-center gap-2"><Flag size={14} strokeWidth={2} />Resign</button>
          </>
        )}
      </div>

      {/* Last moves */}
      {pairs.length > 0 && (
        <button onClick={() => setSheet("moves")} className="mt-3 w-full text-left font-mono text-[11px] text-[#6f6455] truncate">
          {pairs.slice(-3).map((p, i) => { const n = pairs.length - Math.min(3, pairs.length) + i + 1; return <span key={n} className="mr-3"><span className="text-[#756a5a]">{n}.</span> {p[0]} {p[1] ?? ""}</span>; })}
        </button>
      )}
      <p className="hidden sm:block text-center text-[10px] text-[#756a5a] font-mono mt-3">
        <Kbd>↑↓←→</Kbd> <Kbd>Enter</Kbd> move · <Kbd>U</Kbd> undo · <Kbd>F</Kbd> flip
      </p>

      <GameSheet open={sheet === "moves"} onClose={() => setSheet(null)} title="Moves">
        {pairs.length ? (
          <div className="grid grid-cols-[2rem_1fr_1fr] gap-x-3 gap-y-1 font-mono text-sm text-[#111010] dark:text-[#e8ddd0] max-h-[50dvh] overflow-y-auto">
            {pairs.map((p, i) => (<div key={i} className="contents"><span className="text-[#756a5a]">{i + 1}.</span><span>{p[0]}</span><span>{p[1] ?? ""}</span></div>))}
          </div>
        ) : <p className="text-sm text-[#6f6455]">No moves yet.</p>}
        <div className="flex items-center gap-3 mt-4">
          <button onClick={copyPgn} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e8e2d8] dark:border-[#3a3530] text-[10px] font-bold uppercase tracking-widest text-[#6f6455] hover:border-(--accent) transition-colors">
            {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}{copied ? "Copied" : "Copy PGN"}
          </button>
          <span className="text-[11px] text-[#6f6455]">Standard PGN — paste into any chess app.</span>
        </div>
      </GameSheet>
      {statsSheet}
      {settingsSheet}
    </div>
  );
}
