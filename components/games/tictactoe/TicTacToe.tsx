// components/games/tictactoe/TicTacToe.tsx
// Presentation over engine.ts. Deliberately small: difficulty, who opens,
// a persisted scoreline and a drawn win line. No pause, no history.
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BarChart3, Settings2, RotateCcw } from "lucide-react";
import * as E from "./engine";
import { GameSheet, GameSettingsBody, StatRows, SectionLabel, HeaderButton, Segmented, ignoreGameKey } from "../ui";
import { readStore, writeStore, useGameSettings, scaleDelay } from "@/lib/gameStore";
import { play, setAudioEnabled } from "@/lib/gameAudio";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { Kbd } from "@/components/ui/Kbd";

const STORE_KEY = "tictactoe";
const BOT_DELAY_MS = 600;

type Saved = { difficulty: string; first: string; stats: E.Stats };
const SAVED_DEFAULT: Saved = { difficulty: "normal", first: "alternate", stats: { ...E.EMPTY_STATS } };

function asDifficulty(v: string): E.Difficulty {
  if (v === "easy" || v === "hard") return v;
  return "normal"; // includes the pre-3.29 "medium"
}
function asFirst(v: string): E.First {
  return v === "you" || v === "tyunnie" ? v : "alternate";
}

const QUIPS: Record<Exclude<E.Status, "playing">, string[]> = {
  lost: ["Did you really just let me win?", "I told you I was good at this 🧡", "Not even close. Try again?", "I wasn't even trying that hard."],
  won: ["Okay okay, that was impressive 🧡", "...I let you win. Obviously.", "Rematch. Right now.", "I was distracted by the music."],
  draw: ["A tie? I'll take it.", "We're equally matched 🧡", "Nobody wins, nobody loses. Poetic."],
};
const pick = (a: string[], seed: number) => a[seed % a.length];

/** Cell centre in a 0–100 viewBox for the win-line overlay. */
const centre = (i: number) => ({ x: (i % 3) * 33.33 + 16.67, y: Math.floor(i / 3) * 33.33 + 16.67 });

export default function TicTacToe() {
  const [settings] = useGameSettings();
  useEffect(() => setAudioEnabled(settings.sound), [settings.sound]);

  const [g, setG] = useState<E.Game>(() => {
    const s = readStore<Saved>(STORE_KEY, SAVED_DEFAULT);
    return E.newGame({ difficulty: asDifficulty(s.difficulty), first: asFirst(s.first), stats: { ...E.EMPTY_STATS, ...s.stats } });
  });
  const [sheet, setSheet] = useState<"stats" | "settings" | null>(null);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinking = g.status === "playing" && g.turn === E.BOT;

  useEffect(() => {
    writeStore<Saved>(STORE_KEY, { difficulty: g.difficulty, first: g.first, stats: g.stats });
  }, [g.difficulty, g.first, g.stats]);

  // Bot reply: keyed on tick so a reset mid-pause never lands on the new board.
  useEffect(() => {
    if (!thinking) return;
    const tick = g.tick;
    botTimer.current = setTimeout(() => {
      setG((cur) => (cur.tick !== tick ? cur : E.botTurn(cur)));
    }, scaleDelay(BOT_DELAY_MS, settings));
    return () => { if (botTimer.current) clearTimeout(botTimer.current); };
  }, [g.tick, thinking, settings]);

  const tap = useCallback((i: number) => setG((cur) => E.humanMove(cur, i)), []);

  // Sound from state diffs — updaters stay pure.
  const prevTick = useRef(g.tick);
  useEffect(() => {
    if (prevTick.current === g.tick) return;
    prevTick.current = g.tick;
    if (g.tick === 0) return;
    play(g.status === "won" ? "win" : g.status === "lost" ? "lose" : g.status === "draw" ? "push" : "place");
  }, [g.tick, g.status]);

  const again = useCallback(() => {
    setG((cur) => E.newGame({ difficulty: cur.difficulty, first: cur.first, stats: cur.stats, prevOpener: cur.opener }));
  }, []);

  const restart = useCallback(async () => {
    if (g.status === "playing" && g.board.some(Boolean)) {
      const ok = await confirmDialog({ title: "Abandon this game?", message: "The board is cleared. Nothing is scored.", confirmLabel: "Clear board" });
      if (!ok) return;
    }
    again();
  }, [g.status, g.board, again]);

  const setDifficulty = (d: E.Difficulty) => setG((cur) => ({ ...E.newGame({ difficulty: d, first: cur.first, stats: cur.stats, prevOpener: cur.opener }) }));
  const setFirst = (f: E.First) => setG((cur) => ({ ...cur, first: f }));

  const resetStats = async () => {
    const ok = await confirmDialog({ title: "Reset the scoreline?", message: `${g.stats.games} games and your best streak of ${g.stats.bestStreak} are erased.`, confirmLabel: "Reset" });
    if (ok) setG((cur) => ({ ...cur, stats: { ...E.EMPTY_STATS } }));
  };

  // Keys 1–9 in reading order, Enter/R for again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      if (ignoreGameKey(e)) return;
      if (e.key >= "1" && e.key <= "9") { tap(Number(e.key) - 1); return; }
      if ((e.key === "Enter" || e.key === "r" || e.key === "R") && g.status !== "playing") { e.preventDefault(); again(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, tap, again, g.status]);

  const quip = useMemo(() => (g.status === "playing" ? null : pick(QUIPS[g.status], g.stats.games)), [g.status, g.stats.games]);

  const statusText =
    g.status === "won" ? "You win!" :
    g.status === "lost" ? "Tyunnie wins 🧡" :
    g.status === "draw" ? "Draw." :
    thinking ? "Tyunnie is thinking…" :
    g.turn === E.HUMAN ? "Your turn — place ✕" : "Tyunnie's turn…";

  const winLine = g.line ? { a: centre(g.line[0]), b: centre(g.line[2]) } : null;
  const s = g.stats;

  return (
    <div className="max-w-sm mx-auto select-none">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="font-mono text-xs text-[#6f6455] min-w-0 truncate">
          <span className="uppercase tracking-widest text-[10px]">Streak</span>{" "}
          <span className="font-bold text-[#111010] dark:text-[#e8ddd0] text-sm tabular-nums">{s.streak}</span>
          <span className="mx-2 text-[#e8e2d8] dark:text-[#3a3530]">·</span>
          {s.games} {s.games === 1 ? "game" : "games"}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderButton onClick={() => setSheet("stats")} label="Stats" icon={<BarChart3 size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("settings")} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} />
        </div>
      </div>

      <Segmented<E.Difficulty>
        label="Difficulty"
        value={g.difficulty}
        onChange={setDifficulty}
        options={[
          { value: "easy", label: "Easy", hint: "random" },
          { value: "normal", label: "Normal", hint: "forkable" },
          { value: "hard", label: "Hard", hint: "unbeatable" },
        ]}
      />

      {/* Score */}
      <div className="grid grid-cols-3 gap-3 my-4">
        {[
          { label: "You", value: s.you, cls: "bg-white border-[#e8e2d8] text-[#15803d]" },
          { label: "Draw", value: s.draw, cls: "bg-white border-[#e8e2d8] text-[#6f6455]" },
          { label: "Tyunnie", value: s.tyun, cls: "bg-(--accent) border-(--accent) text-(--accent-on)" },
        ].map((c) => (
          <div key={c.label} className={`border rounded-2xl p-3 text-center ${c.cls}`}>
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-70 mb-1">{c.label}</div>
            <div className="font-serif italic text-3xl tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="text-center mb-4 min-h-[2.75rem]" aria-live="polite">
        <p className={`text-sm font-bold font-mono ${g.status === "won" ? "text-[#15803d]" : g.status === "lost" ? "text-(--accent-text)" : "text-[#6f6455]"}`}>{statusText}</p>
        {quip && <p className="text-xs text-[#6f6455] mt-1 italic">&ldquo;{quip}&rdquo;</p>}
      </div>

      {/* Board */}
      <div className="relative mb-5">
        <div className="grid grid-cols-3 gap-2" role="grid" aria-label="Tic-tac-toe board">
          {g.board.map((cell, i) => {
            const open = E.canPlace(g, i);
            const inLine = g.line?.includes(i);
            return (
              <button
                key={i}
                role="gridcell"
                onClick={() => tap(i)}
                disabled={!open}
                aria-label={`Cell ${i + 1}${cell ? `, ${cell === "X" ? "you" : "Tyunnie"}` : ", empty"}`}
                className={`aspect-square rounded-2xl flex items-center justify-center text-4xl font-bold border-2 transition-colors bg-white border-[#e8e2d8] ${
                  open ? "hover:border-(--accent) hover:bg-[#fff0e6] cursor-pointer" : "cursor-default no-tap"
                } ${inLine ? "border-(--accent) bg-[#fff0e6]" : ""}`}
              >
                {cell && (
                  <span className={`animate-mark-in ${cell === "X" ? "text-[#111010] dark:text-[#e8ddd0]" : "text-(--accent-text)"}`}>
                    {cell === "X" ? "✕" : "○"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {winLine && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line
              x1={winLine.a.x} y1={winLine.a.y} x2={winLine.b.x} y2={winLine.b.y}
              pathLength={1}
              stroke="var(--accent)" strokeWidth={3} strokeLinecap="round"
              className="animate-line-draw"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={g.status === "playing" ? restart : again}
          className="flex-1 py-3 rounded-2xl bg-(--accent) text-(--accent-on) font-bold text-sm uppercase tracking-widest hover:bg-(--accent-dim) transition-colors inline-flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} strokeWidth={2} />
          {g.status !== "playing" ? "Play again" : "Clear board"}
        </button>
      </div>
      <p className="hidden sm:block text-center text-[10px] font-mono text-[#756a5a] mt-3">
        <Kbd>1</Kbd>–<Kbd>9</Kbd> place · <Kbd>Enter</Kbd> again
      </p>

      <GameSheet open={sheet === "stats"} onClose={() => setSheet(null)} title="Scoreline">
        <StatRows rows={[
          { label: "Games", value: s.games },
          { label: "You", value: s.you },
          { label: "Tyunnie", value: s.tyun },
          { label: "Draws", value: s.draw },
          { label: "Win rate", value: s.games ? `${Math.round((s.you / s.games) * 100)}%` : "—" },
          { label: "Current streak", value: s.streak },
          { label: "Best streak", value: s.bestStreak },
        ]} />
        <button onClick={resetStats} className="mt-4 text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:text-(--accent-text) transition-colors">Reset scoreline</button>
      </GameSheet>
      <GameSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Settings">
        <GameSettingsBody>
          <div className="pt-1">
            <SectionLabel>Tic-tac-toe</SectionLabel>
            <Segmented<E.First>
              label="Who opens"
              value={g.first}
              onChange={setFirst}
              options={[
                { value: "alternate", label: "Alternate", hint: "takes turns" },
                { value: "you", label: "You", hint: "always ✕ first" },
                { value: "tyunnie", label: "Tyunnie", hint: "always ○ first" },
              ]}
            />
            <p className="text-[11px] text-[#6f6455] -mt-1 pb-2">Applies from the next game.</p>
          </div>
        </GameSettingsBody>
      </GameSheet>
    </div>
  );
}
