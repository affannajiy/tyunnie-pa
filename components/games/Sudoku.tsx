// components/games/Sudoku.tsx
"use client";

import { useState, useEffect, useCallback } from "react";

type Difficulty = "easy" | "medium" | "hard";
type Cell = { value: number; given: boolean; notes: Set<number> };

// Pre-made puzzles — 0 = empty
const PUZZLES: Record<Difficulty, { puzzle: number[]; solution: number[] }[]> =
  {
    easy: [
      {
        puzzle: [
          5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0,
          0, 0, 6, 0, 8, 0, 0, 0, 6, 0, 0, 0, 3, 4, 0, 0, 8, 0, 3, 0, 0, 1, 7,
          0, 0, 0, 2, 0, 0, 0, 6, 0, 6, 0, 0, 0, 0, 2, 8, 0, 0, 0, 0, 4, 1, 9,
          0, 0, 5, 0, 0, 0, 0, 8, 0, 0, 7, 9,
        ],
        solution: [
          5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4,
          2, 5, 6, 7, 8, 5, 9, 7, 6, 1, 4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7,
          1, 3, 9, 2, 4, 8, 5, 6, 9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7, 4, 1, 9,
          6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9,
        ],
      },
      {
        puzzle: [
          0, 0, 0, 2, 6, 0, 7, 0, 1, 6, 8, 0, 0, 7, 0, 0, 9, 0, 1, 9, 0, 0, 0,
          4, 5, 0, 0, 8, 2, 0, 1, 0, 0, 0, 4, 0, 0, 0, 4, 6, 0, 2, 9, 0, 0, 0,
          5, 0, 0, 0, 3, 0, 2, 8, 0, 0, 9, 3, 0, 0, 0, 7, 4, 0, 4, 0, 0, 5, 0,
          0, 3, 6, 7, 0, 3, 0, 1, 8, 0, 0, 0,
        ],
        solution: [
          4, 3, 5, 2, 6, 9, 7, 8, 1, 6, 8, 2, 5, 7, 1, 4, 9, 3, 1, 9, 7, 8, 3,
          4, 5, 6, 2, 8, 2, 6, 1, 9, 5, 3, 4, 7, 3, 7, 4, 6, 8, 2, 9, 1, 5, 9,
          5, 1, 7, 4, 3, 6, 2, 8, 5, 1, 9, 3, 2, 6, 8, 7, 4, 2, 4, 8, 9, 5, 7,
          1, 3, 6, 7, 6, 3, 4, 1, 8, 2, 5, 9,
        ],
      },
    ],
    medium: [
      {
        puzzle: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 8, 5, 0, 0, 1, 0, 2,
          0, 0, 0, 0, 0, 0, 0, 5, 0, 7, 0, 0, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0,
          9, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 7, 3, 0, 0, 2, 0, 1, 0,
          0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 9,
        ],
        solution: [
          9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 4, 6, 1, 7, 3, 9, 8, 5, 3, 5, 1, 9, 2,
          8, 7, 4, 6, 1, 2, 8, 5, 3, 7, 6, 9, 4, 6, 3, 4, 8, 9, 2, 1, 5, 7, 7,
          9, 5, 4, 6, 1, 8, 3, 2, 5, 1, 9, 2, 8, 6, 4, 7, 3, 4, 7, 2, 3, 1, 9,
          5, 6, 8, 8, 6, 3, 7, 4, 5, 2, 1, 9,
        ],
      },
    ],
    hard: [
      {
        puzzle: [
          8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 6, 0, 0, 0, 0, 0, 0, 7, 0, 0, 9,
          0, 2, 0, 0, 0, 5, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 4, 5, 7, 0, 0, 0,
          0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 0, 6, 8, 0, 0, 8, 5, 0, 0,
          0, 1, 0, 0, 9, 0, 0, 0, 0, 4, 0, 0,
        ],
        solution: [
          8, 1, 2, 7, 5, 3, 6, 4, 9, 9, 4, 3, 6, 8, 2, 1, 7, 5, 6, 7, 5, 4, 9,
          1, 2, 8, 3, 1, 5, 4, 2, 3, 7, 8, 9, 6, 3, 6, 9, 8, 4, 5, 7, 2, 1, 2,
          8, 7, 1, 6, 9, 5, 3, 4, 5, 2, 1, 9, 7, 4, 3, 6, 8, 4, 3, 8, 5, 2, 6,
          9, 1, 7, 7, 9, 6, 3, 1, 8, 4, 5, 2,
        ],
      },
    ],
  };

const QUIPS: Record<Difficulty, string[]> = {
  easy: [
    "Easy mode? Bold choice 😏",
    "I believe in you 🧡",
    "You've got this.",
  ],
  medium: [
    "Medium? Okay let's see it 🧡",
    "Focus. You can do this.",
    "Take your time.",
  ],
  hard: [
    "Hard mode?? Respect 🧡",
    "Okay I'm actually impressed.",
    "Don't give up on me.",
  ],
};

const WIN_QUIPS = [
  "You actually did it 🧡 I'm proud.",
  "Flawless. I knew you could.",
  "That's my person 🧡",
  "Sudoku master right here.",
];

function getRandomPuzzle(diff: Difficulty) {
  const list = PUZZLES[diff];
  return list[Math.floor(Math.random() * list.length)];
}

function initCells(puzzle: number[]): Cell[] {
  return puzzle.map((v) => ({ value: v, given: v !== 0, notes: new Set() }));
}

export default function Sudoku() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [puzzleData, setPuzzleData] = useState(() => getRandomPuzzle("easy"));
  const [cells, setCells] = useState<Cell[]>(() =>
    initCells(getRandomPuzzle("easy").puzzle),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [quip, setQuip] = useState(
    () => QUIPS["easy"][Math.floor(Math.random() * QUIPS["easy"].length)],
  );
  const [errors, setErrors] = useState<Set<number>>(new Set());

  // Timer
  useEffect(() => {
    if (status !== "playing" || !started) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status, started]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  function newGame(diff: Difficulty) {
    const data = getRandomPuzzle(diff);
    setPuzzleData(data);
    setCells(initCells(data.puzzle));
    setSelected(null);
    setMistakes(0);
    setStatus("playing");
    setSeconds(0);
    setErrors(new Set());
    setNoteMode(false);
    setStarted(false);
    setQuip(QUIPS[diff][Math.floor(Math.random() * QUIPS[diff].length)]);
  }

  const inputNumber = useCallback(
    (num: number) => {
      if (selected === null || status !== "playing") return;
      const cell = cells[selected];
      if (cell.given) return;
      if (!started) setStarted(true);

      setCells((prev) => {
        const next = prev.map((c) => ({ ...c, notes: new Set(c.notes) }));

        if (noteMode) {
          if (next[selected].notes.has(num)) {
            next[selected].notes.delete(num);
          } else {
            next[selected].notes.add(num);
          }
          return next;
        }

        next[selected].value = next[selected].value === num ? 0 : num;
        next[selected].notes = new Set();

        // Check correctness
        const correct = puzzleData.solution[selected];
        const newErrors = new Set(errors);

        if (num !== 0 && num !== correct) {
          newErrors.add(selected);
          const newMistakes = mistakes + 1;
          setMistakes(newMistakes);
          setErrors(newErrors);
          if (newMistakes >= 3) setStatus("lost");
        } else {
          newErrors.delete(selected);
          setErrors(newErrors);
        }

        // Check win
        const allCorrect = next.every(
          (c, i) => c.value === puzzleData.solution[i],
        );
        if (allCorrect) {
          setStatus("won");
          setQuip(WIN_QUIPS[Math.floor(Math.random() * WIN_QUIPS.length)]);
        }

        return next;
      });
    },
    [selected, status, cells, noteMode, puzzleData, errors, mistakes],
  );

  // Keyboard input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= "1" && e.key <= "9") inputNumber(parseInt(e.key));
      if (e.key === "Backspace" || e.key === "0" || e.key === "Delete")
        inputNumber(0);
      if (e.key === "n" || e.key === "N") setNoteMode((p) => !p);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputNumber]);

  // Highlighting — same row, col, box, same number
  const getHighlight = (i: number) => {
    if (selected === null) return "none";
    if (i === selected) return "selected";
    const sr = Math.floor(selected / 9),
      sc = selected % 9;
    const r = Math.floor(i / 9),
      c = i % 9;
    const sameGroup =
      r === sr ||
      c === sc ||
      (Math.floor(r / 3) === Math.floor(sr / 3) &&
        Math.floor(c / 3) === Math.floor(sc / 3));
    const sameNum =
      cells[selected].value !== 0 && cells[i].value === cells[selected].value;
    if (sameNum) return "samenum";
    if (sameGroup) return "group";
    return "none";
  };

  const hlClass = (i: number) => {
    const h = getHighlight(i);
    const isError = errors.has(i);
    if (isError) return "bg-red-50 border-red-300";
    if (h === "selected") return "bg-[#fff0e6] border-[#f97316]";
    if (h === "samenum") return "bg-[#fed7aa] border-[#f97316]/40";
    if (h === "group") return "bg-[#faf8f5] border-[#e8e2d8]";
    return "bg-white border-[#e8e2d8]";
  };

  return (
    <div className="max-w-sm mx-auto select-none">
      {/* Difficulty */}
      <div className="flex gap-2 mb-4">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => {
              setDifficulty(d);
              newGame(d);
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

      {/* Stats row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                i < mistakes
                  ? "bg-red-500 text-white"
                  : "bg-[#f3f0ea] text-[#c5bdb0]"
              }`}
            >
              ✕
            </div>
          ))}
        </div>
        <span className="font-mono text-sm font-bold text-[#9a8f7e]">
          {formatTime(seconds)}
        </span>
        <button
          onClick={() => setNoteMode((p) => !p)}
          className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
            noteMode
              ? "bg-[#f97316] text-white"
              : "bg-white border border-[#e8e2d8] text-[#9a8f7e]"
          }`}
        >
          ✏️ Notes
        </button>
      </div>

      {/* Quip */}
      <div className="h-6 mb-2 flex items-center justify-center">
        <p className="text-[11px] text-[#9a8f7e] italic text-center">
          🧡 {quip}
        </p>
      </div>

      {/* Status banner */}
      {status !== "playing" && (
        <div
          className={`rounded-2xl px-4 py-3 text-center mb-4 ${
            status === "won" ? "bg-[#16a34a]" : "bg-red-500"
          }`}
        >
          <p className="text-white font-bold text-sm">
            {status === "won" ? "Puzzle Solved! 🧡" : "3 Mistakes — Game Over!"}
          </p>
          <p className="text-white/80 text-xs mt-0.5">
            {status === "won"
              ? `Finished in ${formatTime(seconds)}`
              : "Try again?"}
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-9 gap-px bg-[#9a8f7e] border-2 border-[#9a8f7e] rounded-xl overflow-hidden mb-4">
        {cells.map((cell, i) => {
          const r = Math.floor(i / 9),
            c = i % 9;
          const borderR =
            r % 3 === 2 && r !== 8 ? "border-b-2 border-b-[#9a8f7e]" : "";
          const borderC =
            c % 3 === 2 && c !== 8 ? "border-r-2 border-r-[#9a8f7e]" : "";

          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`
                aspect-square flex items-center justify-center text-sm font-bold
                transition-colors border border-transparent relative
                ${hlClass(i)} ${borderR} ${borderC}
                ${cell.given ? "text-[#111010]" : errors.has(i) ? "text-red-500" : "text-[#f97316]"}
              `}
            >
              {cell.value !== 0 ? (
                cell.value
              ) : cell.notes.size > 0 ? (
                <div className="grid grid-cols-3 gap-0 w-full h-full p-px">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span
                      key={n}
                      className={`flex items-center justify-center text-[6px] font-bold ${
                        cell.notes.has(n)
                          ? "text-[#f97316]"
                          : "text-transparent"
                      }`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-9 gap-1.5 mb-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => inputNumber(n)}
            className="aspect-square rounded-xl bg-white border border-[#e8e2d8] text-[#111010] font-bold text-sm hover:border-[#f97316] hover:text-[#f97316] hover:bg-[#fff0e6] transition-all active:scale-95"
          >
            {n}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => inputNumber(0)}
          className="flex-1 py-2.5 rounded-xl border border-[#e8e2d8] text-[#9a8f7e] text-sm font-bold hover:border-[#f97316] hover:text-[#f97316] transition-all"
        >
          Erase
        </button>
        <button
          onClick={() => newGame(difficulty)}
          className="flex-1 py-2.5 rounded-xl bg-[#f97316] text-white font-bold text-sm hover:bg-[#c2500f] transition-all hover:-translate-y-px"
        >
          {status !== "playing" ? "New Game" : "Restart"}
        </button>
      </div>

      <p className="text-center text-[10px] text-[#c5bdb0] font-mono mt-3">
        Tap a cell then tap a number · N to toggle notes
      </p>
    </div>
  );
}
