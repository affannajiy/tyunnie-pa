// components/games/Minesweeper.tsx
"use client";

import { useState, useEffect, useCallback } from "react";

type Difficulty = "easy" | "medium" | "hard";
type CellState = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

const CONFIG: Record<
  Difficulty,
  { rows: number; cols: number; mines: number }
> = {
  easy: { rows: 8, cols: 8, mines: 10 },
  medium: { rows: 10, cols: 10, mines: 20 },
  hard: { rows: 12, cols: 12, mines: 35 },
};

const QUIPS: Record<Difficulty, string> = {
  easy: "Easy mode. Don't blow up 🧡",
  medium: "Medium. Think before you click.",
  hard: "Hard mode?? Bold. Very bold. 🧡",
};

const WIN_QUIPS = [
  "You survived! I'm impressed 🧡",
  "No explosions. That's my person.",
  "Flawless minesweeping 🧡",
  "Okay you're actually really good at this.",
];

const LOSE_QUIPS = [
  "...that was the mine 😔",
  "BOOM. Try again 🧡",
  "I told you to think first.",
  "That one had mine written all over it.",
];

const NUM_COLORS: Record<number, string> = {
  1: "#3b82f6",
  2: "#16a34a",
  3: "#ef4444",
  4: "#1e3a8a",
  5: "#7f1d1d",
  6: "#0d9488",
  7: "#111010",
  8: "#9a8f7e",
};

function buildEmpty(rows: number, cols: number): CellState[] {
  return Array(rows * cols)
    .fill(null)
    .map(() => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    }));
}

function placeMines(
  cells: CellState[],
  rows: number,
  cols: number,
  mines: number,
  safeIdx: number,
): CellState[] {
  const next = cells.map((c) => ({ ...c }));
  let placed = 0;
  while (placed < mines) {
    const i = Math.floor(Math.random() * rows * cols);
    if (!next[i].mine && i !== safeIdx) {
      next[i].mine = true;
      placed++;
    }
  }
  // Compute adjacents
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (next[i].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr,
            nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (next[nr * cols + nc].mine) count++;
          }
        }
      }
      next[i].adjacent = count;
    }
  }
  return next;
}

function flood(
  cells: CellState[],
  idx: number,
  rows: number,
  cols: number,
): CellState[] {
  const next = cells.map((c) => ({ ...c }));
  const stack = [idx];
  const visited = new Set<number>();
  while (stack.length) {
    const i = stack.pop()!;
    if (visited.has(i)) continue;
    visited.add(i);
    if (next[i].mine || next[i].flagged) continue;
    next[i].revealed = true;
    if (next[i].adjacent === 0) {
      const r = Math.floor(i / cols),
        c = i % cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr,
            nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const ni = nr * cols + nc;
            if (!visited.has(ni) && !next[ni].revealed) stack.push(ni);
          }
        }
      }
    }
  }
  return next;
}

export default function Minesweeper() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [cells, setCells] = useState<CellState[]>(() => buildEmpty(8, 8));
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<"idle" | "playing" | "won" | "lost">(
    "idle",
  );
  const [seconds, setSeconds] = useState(0);
  const [quip, setQuip] = useState(QUIPS["easy"]);
  const [flagCount, setFlagCount] = useState(0);

  const { rows, cols, mines } = CONFIG[difficulty];

  // Timer
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  function newGame(diff: Difficulty) {
    setDifficulty(diff);
    setCells(buildEmpty(CONFIG[diff].rows, CONFIG[diff].cols));
    setStarted(false);
    setStatus("idle");
    setSeconds(0);
    setFlagCount(0);
    setQuip(QUIPS[diff]);
  }

  const handleReveal = useCallback(
    (i: number) => {
      if (status === "won" || status === "lost") return;
      if (cells[i].flagged || cells[i].revealed) return;

      let current = cells;

      // First click — place mines safely
      if (!started) {
        current = placeMines(buildEmpty(rows, cols), rows, cols, mines, i);
        setStarted(true);
        setStatus("playing");
      }

      if (current[i].mine) {
        // Reveal all mines
        const revealed = current.map((c) => ({
          ...c,
          revealed: c.mine ? true : c.revealed,
        }));
        setCells(revealed);
        setStatus("lost");
        setQuip(LOSE_QUIPS[Math.floor(Math.random() * LOSE_QUIPS.length)]);
        return;
      }

      const next = flood(current, i, rows, cols);

      // Check win — all non-mines revealed
      const won = next.every((c) => c.mine || c.revealed);
      if (won) {
        setStatus("won");
        setQuip(WIN_QUIPS[Math.floor(Math.random() * WIN_QUIPS.length)]);
      }

      setCells(next);
    },
    [cells, started, status, rows, cols, mines],
  );

  const handleFlag = useCallback(
    (e: React.MouseEvent, i: number) => {
      e.preventDefault();
      if (status === "won" || status === "lost" || cells[i].revealed) return;
      setCells((prev) => {
        const next = prev.map((c) => ({ ...c }));
        next[i].flagged = !next[i].flagged;
        setFlagCount((f) => (next[i].flagged ? f + 1 : f - 1));
        return next;
      });
    },
    [cells, status],
  );

  // Chord — reveal neighbours if flagged count matches adjacent
  const handleChord = useCallback(
    (i: number) => {
      if (!cells[i].revealed || cells[i].adjacent === 0) return;
      const r = Math.floor(i / cols),
        c = i % cols;
      const neighbours: number[] = [];
      let flagged = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr,
            nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const ni = nr * cols + nc;
            if (cells[ni].flagged) flagged++;
            else if (!cells[ni].revealed) neighbours.push(ni);
          }
        }
      }
      if (flagged !== cells[i].adjacent) return;
      // Reveal all — if any is a mine, game over
      let current = cells.map((c) => ({ ...c }));
      let boom = false;
      for (const ni of neighbours) {
        if (current[ni].mine) {
          boom = true;
          break;
        }
        current = flood(current, ni, rows, cols);
      }
      if (boom) {
        current = current.map((c) => ({
          ...c,
          revealed: c.mine ? true : c.revealed,
        }));
        setCells(current);
        setStatus("lost");
        setQuip(LOSE_QUIPS[Math.floor(Math.random() * LOSE_QUIPS.length)]);
        return;
      }
      const won = current.every((c) => c.mine || c.revealed);
      if (won) {
        setStatus("won");
        setQuip(WIN_QUIPS[Math.floor(Math.random() * WIN_QUIPS.length)]);
      }
      setCells(current);
    },
    [cells, rows, cols],
  );

  return (
    <div className="max-w-lg mx-auto select-none">
      {/* Difficulty */}
      <div className="flex gap-2 mb-4">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => newGame(d)}
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

      {/* Stats */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 bg-white border border-[#e8e2d8] rounded-xl px-3 py-1.5">
          <span className="text-sm">🚩</span>
          <span className="font-mono text-sm font-bold text-[#111010]">
            {mines - flagCount}
          </span>
        </div>
        <div className="text-center">
          <p className="text-[10px] italic text-[#9a8f7e]">🧡 {quip}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-[#e8e2d8] rounded-xl px-3 py-1.5">
          <span className="text-sm">⏱</span>
          <span className="font-mono text-sm font-bold text-[#111010]">
            {formatTime(seconds)}
          </span>
        </div>
      </div>

      {/* Status banner */}
      {status === "won" || status === "lost" ? (
        <div
          className={`rounded-2xl px-4 py-3 text-center mb-3 ${status === "won" ? "bg-[#16a34a]" : "bg-red-500"}`}
        >
          <p className="text-white font-bold text-sm">
            {status === "won"
              ? `Cleared! 🧡 ${formatTime(seconds)}`
              : "💥 BOOM!"}
          </p>
        </div>
      ) : null}

      {/* Board */}
      <div
        className="mb-4 w-full"
        style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {cells.map((cell, i) => {
          const isLostMine = status === "lost" && cell.mine && !cell.flagged;
          const isWrongFlag = status === "lost" && cell.flagged && !cell.mine;

          let bg = "bg-[#f3f0ea] hover:bg-[#e8e2d8]";
          if (cell.revealed) bg = cell.mine ? "bg-red-500" : "bg-white";
          if (isLostMine) bg = "bg-red-400";

          return (
            <button
              key={i}
              onClick={() => (cell.revealed ? handleChord(i) : handleReveal(i))}
              onContextMenu={(e) => handleFlag(e, i)}
              className={`aspect-square flex items-center justify-center font-bold transition-colors border border-[#e8e2d8] text-xs ${bg} ${
                !cell.revealed && status !== "lost" && status !== "won"
                  ? "cursor-pointer"
                  : ""
              }`}
            >
              {cell.flagged && !cell.revealed ? (
                <span>{isWrongFlag ? "✕" : "🚩"}</span>
              ) : cell.revealed ? (
                cell.mine ? (
                  "💣"
                ) : cell.adjacent > 0 ? (
                  <span style={{ color: NUM_COLORS[cell.adjacent] }}>
                    {cell.adjacent}
                  </span>
                ) : null
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => newGame(difficulty)}
          className="flex-1 py-2.5 rounded-2xl bg-[#f97316] text-white font-bold text-sm uppercase tracking-widest hover:bg-[#c2500f] transition-all hover:-translate-y-px"
        >
          {status === "idle"
            ? "New Game"
            : status === "playing"
              ? "Restart"
              : "Play Again"}
        </button>
      </div>

      <p className="text-center text-[10px] text-[#c5bdb0] font-mono mt-3">
        Left click to reveal · Right click to flag · Click revealed number to
        chord
      </p>
    </div>
  );
}
