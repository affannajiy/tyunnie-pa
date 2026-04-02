// components/games/TicTacToe.tsx
"use client";

import { useState, useEffect } from "react";

type Cell = "X" | "O" | null;
type Difficulty = "easy" | "medium" | "hard";

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board: Cell[]): { winner: Cell; line: number[] } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return null;
}

function minimax(board: Cell[], isMaximizing: boolean): number {
  const result = checkWinner(board);
  if (result?.winner === "O") return 10;
  if (result?.winner === "X") return -10;
  if (board.every(Boolean)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    board.forEach((cell, i) => {
      if (!cell) {
        board[i] = "O";
        best = Math.max(best, minimax(board, false));
        board[i] = null;
      }
    });
    return best;
  } else {
    let best = Infinity;
    board.forEach((cell, i) => {
      if (!cell) {
        board[i] = "X";
        best = Math.min(best, minimax(board, true));
        board[i] = null;
      }
    });
    return best;
  }
}

function getBotMove(board: Cell[], difficulty: Difficulty): number {
  const empty = board
    .map((c, i) => (c ? null : i))
    .filter((i) => i !== null) as number[];

  if (difficulty === "easy") {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // Medium: 25% chance of random mistake
  if (difficulty === "medium" && Math.random() < 0.25) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // Hard / medium fallback: minimax
  let bestScore = -Infinity;
  let bestMove = empty[0];
  empty.forEach((i) => {
    board[i] = "O";
    const score = minimax(board, false);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  });
  return bestMove;
}

const WIN_QUIPS = [
  "Did you really just let me win? 😏",
  "I told you I was good at this 🧡",
  "Not even close. Try again?",
  "Flawless. I'm built different.",
  "I wasn't even trying that hard 😌",
];

const LOSE_QUIPS = [
  "Okay okay, that was impressive 🧡",
  "...I let you win. Obviously.",
  "Rematch. Right now.",
  "Fine. You got me this time.",
  "I was distracted by the music 🎵",
];

const DRAW_QUIPS = [
  "A tie? I'll take it.",
  "We're equally matched 🧡",
  "Nobody wins, nobody loses. Poetic.",
  "Draw. You got lucky.",
];

export default function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [playerTurn, setPlayerTurn] = useState(true);
  const [scores, setScores] = useState({ you: 0, tyun: 0, draw: 0 });
  const [status, setStatus] = useState<"playing" | "won" | "lost" | "draw">(
    "playing",
  );
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [quip, setQuip] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [botThinking, setBotThinking] = useState(false);

  // Bot move
  useEffect(() => {
    if (playerTurn || status !== "playing") return;

    setBotThinking(true);
    const timeout = setTimeout(() => {
      setBoard((prev) => {
        const copy = [...prev];
        const move = getBotMove(copy, difficulty);
        copy[move] = "O";

        const result = checkWinner(copy);
        if (result) {
          setWinLine(result.line);
          setStatus("lost");
          setQuip(WIN_QUIPS[Math.floor(Math.random() * WIN_QUIPS.length)]);
          setScores((s) => ({ ...s, tyun: s.tyun + 1 }));
        } else if (copy.every(Boolean)) {
          setStatus("draw");
          setQuip(DRAW_QUIPS[Math.floor(Math.random() * DRAW_QUIPS.length)]);
          setScores((s) => ({ ...s, draw: s.draw + 1 }));
        } else {
          setPlayerTurn(true);
        }

        return copy;
      });
      setBotThinking(false);
    }, 600);

    return () => clearTimeout(timeout);
  }, [playerTurn, status, difficulty]);

  function handleClick(i: number) {
    if (!playerTurn || board[i] || status !== "playing" || botThinking) return;

    const copy = [...board];
    copy[i] = "X";
    setBoard(copy);

    const result = checkWinner(copy);
    if (result) {
      setWinLine(result.line);
      setStatus("won");
      setQuip(LOSE_QUIPS[Math.floor(Math.random() * LOSE_QUIPS.length)]);
      setScores((s) => ({ ...s, you: s.you + 1 }));
    } else if (copy.every(Boolean)) {
      setStatus("draw");
      setQuip(DRAW_QUIPS[Math.floor(Math.random() * DRAW_QUIPS.length)]);
      setScores((s) => ({ ...s, draw: s.draw + 1 }));
    } else {
      setPlayerTurn(false);
    }
  }

  function reset() {
    setBoard(Array(9).fill(null));
    setPlayerTurn(true);
    setStatus("playing");
    setWinLine(null);
    setQuip(null);
    setBotThinking(false);
  }

  const statusText = () => {
    if (status === "won") return "You win! 🎉";
    if (status === "lost") return "Tyunnie wins! 🧡";
    if (status === "draw") return "It's a draw!";
    if (botThinking) return "Tyunnie is thinking...";
    return playerTurn ? "Your turn — place ✕" : "Tyunnie's turn...";
  };

  const statusColor = () => {
    if (status === "won") return "#16a34a";
    if (status === "lost") return "#f97316";
    return "#9a8f7e";
  };

  return (
    <div className="max-w-sm mx-auto">
      {/* Difficulty */}
      <div className="flex gap-2 mb-5">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => {
              setDifficulty(d);
              reset();
            }}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              difficulty === d
                ? "bg-[#f97316] text-white"
                : "bg-white border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Score */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-3 text-center">
          <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#9a8f7e] mb-1">
            You
          </div>
          <div className="font-serif italic text-3xl text-[#16a34a]">
            {scores.you}
          </div>
        </div>
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-3 text-center">
          <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#9a8f7e] mb-1">
            Draw
          </div>
          <div className="font-serif italic text-3xl text-[#9a8f7e]">
            {scores.draw}
          </div>
        </div>
        <div className="bg-[#f97316] border border-[#f97316] rounded-2xl p-3 text-center">
          <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-white/70 mb-1">
            Tyunnie
          </div>
          <div className="font-serif italic text-3xl text-white">
            {scores.tyun}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="text-center mb-4">
        <p
          className="text-sm font-bold font-mono"
          style={{ color: statusColor() }}
        >
          {statusText()}
        </p>
        {quip && <p className="text-xs text-[#9a8f7e] mt-1 italic">"{quip}"</p>}
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {board.map((cell, i) => {
          const isWinCell = winLine?.includes(i);
          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`
                aspect-square rounded-2xl flex items-center justify-center text-4xl font-bold
                transition-all duration-200 border-2
                ${
                  !cell && status === "playing" && playerTurn && !botThinking
                    ? "bg-white border-[#e8e2d8] hover:border-[#f97316] hover:bg-[#fff0e6] cursor-pointer"
                    : "cursor-default"
                }
                ${isWinCell ? "border-[#f97316] bg-[#fff0e6]" : !cell ? "" : "bg-white border-[#e8e2d8]"}
              `}
            >
              {cell && (
                <span
                  style={{
                    color: cell === "X" ? "#111010" : "#f97316",
                    animation: "popIn 0.15s ease",
                  }}
                >
                  {cell === "X" ? "✕" : "○"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex-1 py-3 rounded-2xl bg-[#f97316] text-white font-bold text-sm uppercase tracking-widest hover:bg-[#c2500f] transition-all hover:-translate-y-px"
        >
          {status !== "playing" ? "Play Again" : "Reset"}
        </button>
        <button
          onClick={() => setScores({ you: 0, tyun: 0, draw: 0 })}
          className="px-4 py-3 rounded-2xl border border-[#e8e2d8] text-[#9a8f7e] text-sm font-bold hover:border-[#f97316] hover:text-[#f97316] transition-all"
        >
          Clear
        </button>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
