// components/Games.tsx
// The games hub: eight cards, each with a one-line record read from its
// localStorage store, and a shared back-button frame around the chosen game.
// Store shapes are owned by each game's component; the readers below only
// know the few fields they print, and default to nothing when absent.
"use client";

import { Hash, Grid3x3, Bomb, Spade, Crown, Blocks, Diamond, LayoutGrid, type LucideIcon } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { readStore } from "@/lib/gameStore";

// Each game is a large independent bundle — load only when selected
const TicTacToe   = dynamic(() => import("./games/tictactoe/TicTacToe"),     { ssr: false });
const Sudoku      = dynamic(() => import("./games/sudoku/Sudoku"),           { ssr: false });
const Minesweeper = dynamic(() => import("./games/minesweeper/Minesweeper"), { ssr: false });
const Solitaire   = dynamic(() => import("./games/solitaire/Solitaire"),     { ssr: false });
const Blackjack   = dynamic(() => import("./games/blackjack/Blackjack"),     { ssr: false });
const Mahjong     = dynamic(() => import("./games/mahjong/Mahjong"),         { ssr: false });
const Chess       = dynamic(() => import("./games/chess/Chess"),             { ssr: false });
const Tetris      = dynamic(() => import("./games/tetris/Tetris"),           { ssr: false });

type GameId = "tictactoe" | "sudoku" | "minesweeper" | "solitaire" | "blackjack" | "mahjong" | "chess" | "tetris";

type Card = {
  id: GameId;
  title: string;
  tag: string;
  desc: string;
  icon: LucideIcon;
  Component: React.ComponentType;
  /** One-line record for the hub card, or null before the first game. */
  record: () => string | null;
};

const mmss = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

const CARDS: Card[] = [
  {
    id: "tictactoe", title: "Tic Tac Toe", tag: "vs Tyunnie", icon: Hash, Component: TicTacToe,
    desc: "Play against Tyunnie. Unbeatable on Hard, forkable on Normal.",
    record: () => {
      const s = readStore("tictactoe", { stats: { games: 0, you: 0, bestStreak: 0 } }).stats;
      return s.games ? `${plural(s.games, "game")} · ${plural(s.you, "win")} · best streak ${s.bestStreak}` : null;
    },
  },
  {
    id: "sudoku", title: "Sudoku", tag: "Generated · unique", icon: Grid3x3, Component: Sudoku,
    desc: "Fresh puzzles every time, graded by the logic they need. A daily one too.",
    record: () => {
      const s = readStore("sudoku_stats", { solved: 0, bestTime: 0, dailyStreak: 0 });
      if (!s.solved) return null;
      return `${plural(s.solved, "solve")}${s.bestTime ? ` · best ${mmss(s.bestTime)}` : ""}${s.dailyStreak ? ` · daily streak ${s.dailyStreak}` : ""}`;
    },
  },
  {
    id: "minesweeper", title: "Minesweeper", tag: "Don't blow up", icon: Bomb, Component: Minesweeper,
    desc: "Classic boards, first click always opens. Tyunnie is watching nervously.",
    record: () => {
      const s = readStore("minesweeper_stats", { games: 0, wins: 0, beginner: { best: 0 } });
      if (!s.games) return null;
      const best = s.beginner.best ? ` · best ${mmss(s.beginner.best)}` : "";
      return `${plural(s.games, "game")} · ${plural(s.wins, "win")}${best}`;
    },
  },
  {
    id: "solitaire", title: "Solitaire", tag: "Klondike", icon: Spade, Component: Solitaire,
    desc: "Draw one or three. Drag, undo, auto-finish. Tyunnie will judge your card choices.",
    record: () => {
      const s = readStore("solitaire_stats", { games: 0, wins: 0, bestTime: 0 });
      if (!s.games) return null;
      return `${plural(s.games, "deal")} · ${plural(s.wins, "win")}${s.bestTime ? ` · best ${mmss(s.bestTime)}` : ""}`;
    },
  },
  {
    id: "blackjack", title: "Blackjack", tag: "21", icon: Diamond, Component: Blackjack,
    desc: "Six-deck table. Split, double, insure. Tyunnie deals and pretends not to count.",
    record: () => {
      const s = readStore("blackjack", { bankroll: 0, stats: { hands: 0, wins: 0 } });
      return s.stats.hands ? `bankroll ${s.bankroll} · ${plural(s.stats.hands, "hand")} · ${plural(s.stats.wins, "win")}` : null;
    },
  },
  {
    id: "mahjong", title: "Mahjong", tag: "Hong Kong · 3 fan", icon: LayoutGrid, Component: Mahjong,
    desc: "Hong Kong rules vs three bots. Tyunnie sits opposite and swears he isn't counting.",
    record: () => {
      const s = readStore("mahjong_stats", { hands: 0, wins: 0, highestFan: 0 });
      return s.hands ? `${plural(s.hands, "hand")} · ${plural(s.wins, "win")} · best ${s.highestFan} fan` : null;
    },
  },
  {
    id: "chess", title: "Chess", tag: "Full rules", icon: Crown, Component: Chess,
    desc: "Full chess vs Tyunnie or a friend. Four bot levels, PGN export. He plays dirty on Expert.",
    record: () => {
      const s = readStore("chess_stats", { games: 0, wins: 0, draws: 0 });
      return s.games ? `${plural(s.games, "game")} · ${plural(s.wins, "win")} · ${plural(s.draws, "draw")}` : null;
    },
  },
  {
    id: "tetris", title: "Tetris", tag: "Marathon · Sprint", icon: Blocks, Component: Tetris,
    desc: "7-bag, SRS, T-spins, hold. Tyunnie watches nervously as the stack grows.",
    record: () => {
      const s = readStore("tetris_stats", { bestScore: 0, sprintBest: 0 });
      if (!s.bestScore && !s.sprintBest) return null;
      return [s.bestScore ? `best ${s.bestScore.toLocaleString()}` : "", s.sprintBest ? `sprint ${mmss(Math.round(s.sprintBest / 1000))}` : ""].filter(Boolean).join(" · ");
    },
  },
];

function readRecords(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const c of CARDS) out[c.id] = c.record();
  return out;
}

export default function Games() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  // This component is dynamic({ ssr: false }), so storage is readable in the
  // lazy init. Re-read when a game closes so the card shows the game just played.
  const [records, setRecords] = useState(readRecords);
  const back = () => { setActiveGame(null); setRecords(readRecords()); };

  const active = CARDS.find((c) => c.id === activeGame);
  if (active) {
    return (
      <div>
        <button
          onClick={back}
          className="flex items-center gap-2 text-[#6f6455] hover:text-(--accent) transition-colors text-xs font-mono font-bold uppercase tracking-widest mb-6"
        >
          ← Back to Games
        </button>
        <div className="flex items-center gap-3 mb-6">
          <span className="font-serif italic text-2xl text-[#111010]">{active.title}</span>
          <span className="text-[9px] font-bold uppercase tracking-[2px] text-(--accent) bg-[#fff0e6] border border-[#fed7aa] px-3 py-1 rounded-full">
            {active.tag}
          </span>
        </div>
        <active.Component />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif italic text-2xl text-[#111010] mb-1">Games</h1>
        <p className="text-sm text-[#6f6455]">Take a break. Challenge Tyunnie.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((game) => (
          <button
            key={game.id}
            onClick={() => setActiveGame(game.id)}
            className="text-left bg-white border border-[#e8e2d8] rounded-2xl p-5 transition-all group hover:border-(--accent) hover:-translate-y-1 hover:shadow-md cursor-pointer flex flex-col"
          >
            <div className="mb-3" style={{ color: "var(--accent-text)" }}><game.icon size={26} strokeWidth={1.5} /></div>
            <div className="font-bold text-[#111010] mb-1 group-hover:text-(--accent) transition-colors">{game.title}</div>
            <div className="text-xs text-[#6f6455]">{game.desc}</div>
            <div className="mt-3 pt-2 border-t border-[#e8e2d8] font-mono text-[10px] text-[#756a5a] tabular-nums truncate">
              {records[game.id] ?? <span className="opacity-70">No games yet</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
