// components/games/sudoku/generator.ts
// Seeded puzzle generation. The same (difficulty, seed) always yields the
// same puzzle, so a puzzle ID like "H-4821" is shareable and the daily is
// simply seed = the day. Uniqueness is proved by the backtracker; difficulty
// is what the technique solver says it is, never a count of blanks.

import { type Grid, type Difficulty, countSolutions, grade, PEERS, bit, digitsOf, ALL } from "./solver";

/** mulberry32 — small, fast, good enough for shuffles. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string — turns a day key into a seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** A full valid grid by randomised backtracking. */
export function fullGrid(rng: () => number): Grid {
  const g = new Array<number>(81).fill(0);
  const rec = (i: number): boolean => {
    if (i === 81) return true;
    let m = ALL;
    for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
    for (const d of shuffled(digitsOf(m), rng)) {
      g[i] = d;
      if (rec(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  rec(0);
  return g;
}

/** Target clue counts: fewer clues skews harder, but the grader has the last word. */
const TARGET_GIVENS: Record<Difficulty, number> = { easy: 40, normal: 33, hard: 28, expert: 24 };

/** Remove clues in 180° symmetric pairs while the puzzle stays unique, down to `target` givens. */
export function dig(full: Grid, target: number, rng: () => number): Grid {
  const puzzle = full.slice();
  let givens = 81;
  const order = shuffled(Array.from({ length: 41 }, (_, i) => i), rng); // one of each symmetric pair (40 is the centre)
  for (const i of order) {
    if (givens <= target) break;
    const j = 80 - i;
    const cells = i === j ? [i] : [i, j];
    const saved = cells.map((c) => puzzle[c]);
    for (const c of cells) puzzle[c] = 0;
    if (countSolutions(puzzle, 2) !== 1) { cells.forEach((c, k) => { puzzle[c] = saved[k]; }); continue; }
    givens -= cells.length;
  }
  return puzzle;
}

export type Generated = { puzzle: Grid; solution: Grid; difficulty: Difficulty; seed: number; id: string };

const CODE: Record<Difficulty, string> = { easy: "E", normal: "N", hard: "H", expert: "X" };
const FROM_CODE: Record<string, Difficulty> = { E: "easy", N: "normal", H: "hard", X: "expert" };

export const puzzleId = (d: Difficulty, seed: number) => `${CODE[d]}-${seed}`;
export function parseId(id: string): { difficulty: Difficulty; seed: number } | null {
  const m = /^([ENHX])-(\d{1,10})$/i.exec(id.trim());
  if (!m) return null;
  return { difficulty: FROM_CODE[m[1].toUpperCase()], seed: Number(m[2]) >>> 0 };
}

/** One deterministic attempt: the puzzle this seed makes, whatever its grade. */
export function attempt(difficulty: Difficulty, seed: number): Generated & { actual: Difficulty } {
  const rng = seededRng(seed ^ hashSeed(difficulty));
  const solution = fullGrid(rng);
  const puzzle = dig(solution, TARGET_GIVENS[difficulty], rng);
  const g = grade(puzzle);
  return { puzzle, solution, difficulty, seed, id: puzzleId(difficulty, seed), actual: g.difficulty };
}

/**
 * Walk seeds from `start` until one grades as asked. The returned seed is the
 * one that hit, so its ID regenerates this exact puzzle. Capped: a miss after
 * `maxTries` returns the closest attempt rather than spinning.
 */
export function generate(difficulty: Difficulty, start: number, maxTries = 80): Generated {
  const rank: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2, expert: 3 };
  let best: (Generated & { actual: Difficulty }) | null = null;
  for (let k = 0; k < maxTries; k++) {
    const a = attempt(difficulty, (start + k) >>> 0);
    if (a.actual === difficulty) return a;
    if (!best || Math.abs(rank[a.actual] - rank[difficulty]) < Math.abs(rank[best.actual] - rank[difficulty])) best = a;
  }
  return best!;
}

/** Regenerate from an ID — exact, no search, because the ID's seed already passed. */
export function fromId(id: string): Generated | null {
  const p = parseId(id);
  return p ? attempt(p.difficulty, p.seed) : null;
}
