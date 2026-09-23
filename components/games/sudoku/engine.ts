// components/games/sudoku/engine.ts
// Pure game state over solver.ts + generator.ts: entries, notes, undo/redo,
// mistakes, hints and the clock. The component renders and owns selection.
//
// Auto-check on (default): a wrong entry is marked and counted, three end the
// game. Off: only clashes with visible digits are marked, the solution is
// never consulted, and the finished game is recorded as "unchecked".

import { type Grid, type Difficulty, type Step, candidates, conflicts, stepLogic, bit, digitsOf } from "./solver";
import { generate, fromId, hashSeed, type Generated } from "./generator";

export type { Difficulty, Step };

export type Cell = { value: number; given: boolean; notes: number };
export type Status = "playing" | "solved" | "lost";
export const MAX_MISTAKES = 3;

export type PlaceStep = Extract<Step, { kind: "place" }>;
export type Hint = { step: PlaceStep; text: string } | { step: null; text: string; reveal: number };

export type Game = {
  id: string;
  difficulty: Difficulty;
  /** Day key when this is the daily puzzle. */
  daily: string | null;
  cells: Cell[];
  solution: Grid;
  autoCheck: boolean;
  mistakes: number;
  hintsUsed: number;
  seconds: number;
  status: Status;
  undo: Cell[][];
  redo: Cell[][];
  /** Last hint, shown until the next entry. */
  hint: Hint | null;
  tick: number;
};

export type PerDifficulty = { solved: number; best: number };
export type Stats = {
  solved: number;
  bestTime: number;
  hintsUsed: number;
  unchecked: number;
  easy: PerDifficulty; normal: PerDifficulty; hard: PerDifficulty; expert: PerDifficulty;
  dailyStreak: number;
  bestDailyStreak: number;
  lastDaily: string;
};
const D0: PerDifficulty = { solved: 0, best: 0 };
export const EMPTY_STATS: Stats = { solved: 0, bestTime: 0, hintsUsed: 0, unchecked: 0, easy: { ...D0 }, normal: { ...D0 }, hard: { ...D0 }, expert: { ...D0 }, dailyStreak: 0, bestDailyStreak: 0, lastDaily: "" };

export const DAILY_DIFFICULTY: Difficulty = "normal";

function fromGenerated(gen: Generated, autoCheck: boolean, daily: string | null): Game {
  return {
    id: gen.id, difficulty: gen.difficulty, daily,
    cells: gen.puzzle.map((v) => ({ value: v, given: v !== 0, notes: 0 })),
    solution: gen.solution,
    autoCheck, mistakes: 0, hintsUsed: 0, seconds: 0, status: "playing",
    undo: [], redo: [], hint: null, tick: 0,
  };
}

export function newGame(difficulty: Difficulty, autoCheck: boolean, seed = Math.floor(Math.random() * 1e9)): Game {
  return fromGenerated(generate(difficulty, seed), autoCheck, null);
}

export function dailyGame(dayKey: string, autoCheck: boolean): Game {
  return fromGenerated(generate(DAILY_DIFFICULTY, hashSeed(dayKey)), autoCheck, dayKey);
}

export function gameFromId(id: string, autoCheck: boolean): Game | null {
  const gen = fromId(id);
  return gen ? fromGenerated(gen, autoCheck, null) : null;
}

export const grid = (g: Game): Grid => g.cells.map((c) => c.value);

export function isPeer(a: number, b: number): boolean {
  if (a === b) return false;
  return Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 ||
    (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3));
}

/** Cells to mark red: wrong entries under auto-check, otherwise clashes only. */
export function errors(g: Game): Set<number> {
  if (g.autoCheck) {
    const out = new Set<number>();
    g.cells.forEach((c, i) => { if (c.value && !c.given && c.value !== g.solution[i]) out.add(i); });
    return out;
  }
  return conflicts(grid(g));
}

/** How many of each digit are placed — a digit is "done" at 9. */
export function digitCounts(g: Game): number[] {
  const n = new Array<number>(10).fill(0);
  for (const c of g.cells) n[c.value]++;
  return n;
}

function snapshot(g: Game): Game {
  return { ...g, undo: [...g.undo.slice(-200), g.cells], redo: [], hint: null, tick: g.tick + 1 };
}

function settle(g: Game): Game {
  const full = g.cells.every((c) => c.value);
  if (full && g.cells.every((c, i) => c.value === g.solution[i])) return { ...g, status: "solved" };
  return g;
}

export function setValue(g: Game, i: number, v: number): Game {
  if (g.status !== "playing" || g.cells[i].given || v < 1 || v > 9) return g;
  if (g.cells[i].value === v) return g;
  const next = snapshot(g);
  const cells = g.cells.map((c) => ({ ...c }));
  cells[i] = { ...cells[i], value: v, notes: 0 };
  // A placed digit clears that note from its peers, the way a pencil would.
  for (let p = 0; p < 81; p++) if (isPeer(i, p) && !cells[p].value) cells[p].notes &= ~bit(v);
  let mistakes = g.mistakes;
  if (g.autoCheck && v !== g.solution[i]) mistakes++;
  const out = settle({ ...next, cells, mistakes });
  if (g.autoCheck && mistakes >= MAX_MISTAKES) return { ...out, status: "lost" };
  return out;
}

export function toggleNote(g: Game, i: number, v: number): Game {
  if (g.status !== "playing" || g.cells[i].given || g.cells[i].value || v < 1 || v > 9) return g;
  const next = snapshot(g);
  const cells = g.cells.map((c) => ({ ...c }));
  cells[i] = { ...cells[i], notes: cells[i].notes ^ bit(v) };
  return { ...next, cells };
}

export function erase(g: Game, i: number): Game {
  if (g.status !== "playing" || g.cells[i].given) return g;
  if (!g.cells[i].value && !g.cells[i].notes) return g;
  const next = snapshot(g);
  const cells = g.cells.map((c) => ({ ...c }));
  cells[i] = { ...cells[i], value: 0, notes: 0 };
  return { ...next, cells };
}

export function undo(g: Game): Game {
  if (g.status !== "playing" || !g.undo.length) return g;
  const prev = g.undo[g.undo.length - 1];
  return { ...g, cells: prev, undo: g.undo.slice(0, -1), redo: [...g.redo, g.cells], hint: null, tick: g.tick + 1 };
}

export function redo(g: Game): Game {
  if (g.status !== "playing" || !g.redo.length) return g;
  const nxt = g.redo[g.redo.length - 1];
  return settle({ ...g, cells: nxt, redo: g.redo.slice(0, -1), undo: [...g.undo, g.cells], hint: null, tick: g.tick + 1 });
}

/** Fill every empty cell's notes with its candidates. */
export function autoNotes(g: Game): Game {
  if (g.status !== "playing") return g;
  const cand = candidates(grid(g));
  if (!cand) return g;
  const next = snapshot(g);
  const cells = g.cells.map((c, i) => (c.value ? { ...c } : { ...c, notes: cand[i] }));
  return { ...next, cells };
}

/**
 * The next thing a person could deduce from the visible digits. Wrong entries
 * block logic, so under auto-check a wrong cell is pointed out first; without
 * it, a clash is. When no technique applies, one cell is revealed instead.
 */
export function hint(g: Game): Game {
  if (g.status !== "playing") return g;
  const gr = grid(g);
  const wrong = [...errors(g)];
  if (wrong.length) {
    const i = wrong[0];
    const text = g.autoCheck ? `r${Math.floor(i / 9) + 1}c${(i % 9) + 1} is wrong — clear it before anything else follows.` : `r${Math.floor(i / 9) + 1}c${(i % 9) + 1} clashes with a digit it can see.`;
    return { ...g, hint: { step: null, text, reveal: i }, hintsUsed: g.hintsUsed + 1, tick: g.tick + 1 };
  }
  const cand = candidates(gr);
  if (!cand) return g;
  // Play the technique solver forward until it places something; eliminations
  // along the way are folded into the hint's explanation.
  const work = gr.slice();
  let step = stepLogic(work, cand);
  const first: Step | null = step;
  let guard = 0;
  while (step && step.kind === "eliminate" && guard++ < 20) {
    for (const c of step.cells) cand[c] &= ~step.digits;
    step = stepLogic(work, cand);
  }
  if (step && step.kind === "place") {
    const text = first && first !== step && first.kind === "eliminate"
      ? `${cap(first.technique)} first: ${first.why} Then ${step.technique}: ${step.why}`
      : `${cap(step.technique)}: ${step.why}`;
    return { ...g, hint: { step, text }, hintsUsed: g.hintsUsed + 1, tick: g.tick + 1 };
  }
  // Stuck: reveal the first empty cell with the fewest candidates.
  let best = -1, bestN = 10;
  for (let i = 0; i < 81; i++) if (!gr[i]) { const n = digitsOf(cand[i]).length; if (n < bestN) { bestN = n; best = i; } }
  return { ...g, hint: { step: null, text: `No simple logic here. r${Math.floor(best / 9) + 1}c${(best % 9) + 1} is ${g.solution[best]} — a guess or a chain gets it.`, reveal: best }, hintsUsed: g.hintsUsed + 1, tick: g.tick + 1 };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Apply the pending hint: place the digit, or clear the wrong cell / reveal the stuck one. */
export function applyHint(g: Game): Game {
  const h = g.hint;
  if (!h || g.status !== "playing") return g;
  if (h.step) return setValue(g, h.step.cell, h.step.digit);
  const i = h.reveal;
  if (g.cells[i].value && g.cells[i].value !== g.solution[i]) return erase(g, i);
  return setValue(g, i, g.solution[i]);
}

export function tickSecond(g: Game): Game {
  return g.status === "playing" ? { ...g, seconds: g.seconds + 1 } : g;
}

export function setAutoCheck(g: Game, on: boolean): Game {
  return { ...g, autoCheck: on };
}

/** Yesterday's key relative to `dayKey` (YYYY-MM-DD), in local calendar terms. */
export function previousDay(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function recordResult(s: Stats, g: Game): Stats {
  if (g.status !== "solved") return s;
  const next: Stats = { ...s, solved: s.solved + 1, hintsUsed: s.hintsUsed + g.hintsUsed };
  if (!g.autoCheck) next.unchecked = s.unchecked + 1;
  next.bestTime = s.bestTime ? Math.min(s.bestTime, g.seconds) : g.seconds;
  const d = { ...s[g.difficulty] };
  d.solved++;
  d.best = d.best ? Math.min(d.best, g.seconds) : g.seconds;
  next[g.difficulty] = d;
  if (g.daily && g.daily !== s.lastDaily) {
    next.dailyStreak = s.lastDaily === previousDay(g.daily) ? s.dailyStreak + 1 : 1;
    next.bestDailyStreak = Math.max(s.bestDailyStreak, next.dailyStreak);
    next.lastDaily = g.daily;
  }
  return next;
}
