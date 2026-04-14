// components/Games.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Each game is a large independent bundle — load only when selected
const TicTacToe  = dynamic(() => import("./games/TicTacToe"),  { ssr: false });
const Sudoku     = dynamic(() => import("./games/Sudoku"),     { ssr: false });
const Minesweeper = dynamic(() => import("./games/Minesweeper"), { ssr: false });
const Solitaire  = dynamic(() => import("./games/Solitaire"),  { ssr: false });
const Chess      = dynamic(() => import("./games/Chess"),      { ssr: false });
const Tetris     = dynamic(() => import("./games/Tetris"),     { ssr: false });

type Game =
  | "tictactoe"
  | "sudoku"
  | "minesweeper"
  | "solitaire"
  | "chess"
  | "tetris"
  | null;

const GAME_CARDS = [
  {
    id: "tictactoe" as Game,
    title: "Tic Tac Toe",
    desc: "Play against Tyunnie. She's better than she looks.",
    icon: "⊞",
    available: true,
  },
  {
    id: "sudoku" as Game,
    title: "Sudoku",
    desc: "Fill the grid. Tyunnie believes in you.",
    icon: "🔢",
    available: true,
  },
  {
    id: "minesweeper" as Game,
    title: "Minesweeper",
    desc: "Don't blow up. Tyunnie is watching nervously.",
    icon: "💣",
    available: true,
  },
  {
    id: "solitaire" as Game,
    title: "Solitaire",
    desc: "Klondike. Tyunnie will judge your card choices.",
    icon: "🃏",
    available: true,
  },
  {
    id: "chess" as Game,
    title: "Chess",
    desc: "Full chess vs Tyunnie or a friend. He plays dirty on Hard.",
    icon: "♟️",
    available: true,
  },
  {
    id: "tetris" as Game,
    title: "Tetris",
    desc: "Clear lines. Tyunnie watches nervously as the stack grows.",
    icon: "🟦",
    available: true,
  },
];

export default function Games() {
  const [activeGame, setActiveGame] = useState<Game>(null);

  if (activeGame === "tictactoe") {
    return (
      <div>
        <button
          onClick={() => setActiveGame(null)}
          className="flex items-center gap-2 text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest mb-6"
        >
          ← Back to Games
        </button>
        <div className="flex items-center gap-3 mb-6">
          <span className="font-serif italic text-2xl text-[#111010]">
            Tic Tac Toe
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#f97316] bg-[#fff0e6] border border-[#fed7aa] px-3 py-1 rounded-full">
            vs Tyunnie
          </span>
        </div>
        <TicTacToe />
      </div>
    );
  }

  if (activeGame === "sudoku") {
    return (
      <div>
        <button
          onClick={() => setActiveGame(null)}
          className="flex items-center gap-2 text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest mb-6"
        >
          ← Back to Games
        </button>
        <div className="flex items-center gap-3 mb-6">
          <span className="font-serif italic text-2xl text-[#111010]">
            Sudoku
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#f97316] bg-[#fff0e6] border border-[#fed7aa] px-3 py-1 rounded-full">
            3 mistakes allowed
          </span>
        </div>
        <Sudoku />
      </div>
    );
  }

  if (activeGame === "minesweeper") {
    return (
      <div>
        <button
          onClick={() => setActiveGame(null)}
          className="flex items-center gap-2 text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest mb-6"
        >
          ← Back to Games
        </button>
        <div className="flex items-center gap-3 mb-6">
          <span className="font-serif italic text-2xl text-[#111010]">
            Minesweeper
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#f97316] bg-[#fff0e6] border border-[#fed7aa] px-3 py-1 rounded-full">
            Don't blow up
          </span>
        </div>
        <Minesweeper />
      </div>
    );
  }

  if (activeGame === "solitaire") {
    return (
      <div>
        <button
          onClick={() => setActiveGame(null)}
          className="flex items-center gap-2 text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest mb-6"
        >
          ← Back to Games
        </button>
        <div className="flex items-center gap-3 mb-6">
          <span className="font-serif italic text-2xl text-[#111010]">
            Solitaire
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#f97316] bg-[#fff0e6] border border-[#fed7aa] px-3 py-1 rounded-full">
            Klondike
          </span>
        </div>
        <Solitaire />
      </div>
    );
  }

  if (activeGame === "chess") {
    return (
      <div>
        <Chess onBack={() => setActiveGame(null)} />
      </div>
    );
  }

  if (activeGame === "tetris") {
    return (
      <div>
        <button
          onClick={() => setActiveGame(null)}
          className="flex items-center gap-2 text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest mb-6"
        >
          ← Back to Games
        </button>
        <Tetris />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif italic text-2xl text-[#111010] mb-1">
          Games
        </h1>
        <p className="text-sm text-[#9a8f7e]">
          Take a break. Challenge Tyunnie.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAME_CARDS.map((game, i) => (
          <button
            key={i}
            onClick={() => game.available && game.id && setActiveGame(game.id)}
            disabled={!game.available}
            className={`text-left bg-white border rounded-2xl p-5 transition-all group ${
              game.available
                ? "border-[#e8e2d8] hover:border-[#f97316] hover:-translate-y-1 hover:shadow-md cursor-pointer"
                : "border-[#e8e2d8] opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="text-3xl mb-3">{game.icon}</div>
            <div className="font-bold text-[#111010] mb-1 group-hover:text-[#f97316] transition-colors">
              {game.title}
            </div>
            <div className="text-xs text-[#9a8f7e]">{game.desc}</div>
            {!game.available && (
              <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-[#c5bdb0] font-mono">
                Coming Soon
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
