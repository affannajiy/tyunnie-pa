// components/games/sudoku/solver.ts
// Two solvers. `countSolutions` is a bitmask backtracker used by the
// generator to guarantee uniqueness. `stepLogic` is a human-technique solver:
// it finds the next deduction a person could make and names it, which is
// what grades a puzzle (hardest technique needed) and what powers hints.
//
// Grid = 81 numbers, 0 = empty, row-major. Candidates are 9-bit masks where
// bit (d-1) means digit d is still possible.

export type Grid = number[];

export const ALL = 0x1ff;
export const bit = (d: number) => 1 << (d - 1);
export const popcount = (m: number) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
export const digitsOf = (m: number): number[] => { const out: number[] = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d); return out; };

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** The 27 units: rows 0–8, cols 9–17, boxes 18–26. */
export const UNITS: number[][] = (() => {
  const u: number[][] = [];
  for (let r = 0; r < 9; r++) u.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) u.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3;
    const cells: number[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((r0 + r) * 9 + c0 + c);
    u.push(cells);
  }
  return u;
})();

/** Every cell that shares a unit with `i`, excluding `i`. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (const u of [UNITS[rowOf(i)], UNITS[9 + colOf(i)], UNITS[18 + boxOf(i)]]) for (const c of u) if (c !== i) s.add(c);
  return [...s];
});

export function unitName(u: number): string {
  return u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`;
}
export const cellName = (i: number) => `r${rowOf(i) + 1}c${colOf(i) + 1}`;

/** Candidate masks for a grid, or null on a direct contradiction. */
export function candidates(grid: Grid): number[] | null {
  const cand = new Array<number>(81).fill(ALL);
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (!v) continue;
    cand[i] = bit(v);
    for (const p of PEERS[i]) {
      if (grid[p] === v) return null;
      if (!grid[p]) cand[p] &= ~bit(v);
    }
  }
  for (let i = 0; i < 81; i++) if (!grid[i] && !cand[i]) return null;
  return cand;
}

/** Cells whose digit clashes with a peer — for "conflicts only" checking. */
export function conflicts(grid: Grid): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (!grid[i]) continue;
    for (const p of PEERS[i]) if (grid[p] === grid[i]) { out.add(i); out.add(p); }
  }
  return out;
}

// ── Backtracking (uniqueness + fallback solve) ────────────────────────────

/** Count solutions up to `limit` (2 is enough to prove uniqueness). Fills `first` with the first found. */
export function countSolutions(grid: Grid, limit = 2, first?: Grid): number {
  const g = grid.slice();
  const cand = candidates(g);
  if (!cand) return 0;
  let count = 0;
  const rec = (): boolean => {
    // MRV: pick the empty cell with fewest candidates.
    let best = -1, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let m = ALL;
      for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
      const n = popcount(m);
      if (n === 0) return false;
      if (n < bestN) { bestN = n; best = i; if (n === 1) break; }
    }
    if (best < 0) {
      count++;
      if (first && count === 1) for (let i = 0; i < 81; i++) first[i] = g[i];
      return count >= limit;
    }
    let m = ALL;
    for (const p of PEERS[best]) if (g[p]) m &= ~bit(g[p]);
    for (const d of digitsOf(m)) {
      g[best] = d;
      if (rec()) { g[best] = 0; return true; }
      g[best] = 0;
    }
    return false;
  };
  rec();
  return count;
}

export function solve(grid: Grid): Grid | null {
  const out = new Array<number>(81).fill(0);
  return countSolutions(grid, 1, out) >= 1 ? out : null;
}

// ── Human techniques ──────────────────────────────────────────────────────

export type Technique =
  | "naked single" | "hidden single"
  | "naked pair" | "pointing pair" | "box-line reduction"
  | "naked triple" | "hidden pair"
  | "x-wing";

/** Ordered by difficulty; index = level. */
export const TECHNIQUES: Technique[] = ["naked single", "hidden single", "naked pair", "pointing pair", "box-line reduction", "naked triple", "hidden pair", "x-wing"];
export const levelOf = (t: Technique) => TECHNIQUES.indexOf(t);

export type Step =
  | { kind: "place"; technique: Technique; cell: number; digit: number; why: string }
  | { kind: "eliminate"; technique: Technique; cells: number[]; digits: number; why: string; focus: number[] };

/** The next deduction, cheapest technique first, or null when stuck. `cand` is mutated only by the caller. */
export function stepLogic(grid: Grid, cand: number[]): Step | null {
  // Naked single
  for (let i = 0; i < 81; i++) if (!grid[i] && popcount(cand[i]) === 1) {
    const d = digitsOf(cand[i])[0];
    return { kind: "place", technique: "naked single", cell: i, digit: d, why: `${cellName(i)} can only be ${d} — every other digit is already in its row, column or box.` };
  }
  // Hidden single
  for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) {
    const spots = UNITS[u].filter((i) => !grid[i] && cand[i] & bit(d));
    if (spots.length === 1 && !UNITS[u].some((i) => grid[i] === d)) {
      return { kind: "place", technique: "hidden single", cell: spots[0], digit: d, why: `${d} fits nowhere else in ${unitName(u)}, so ${cellName(spots[0])} is ${d}.` };
    }
  }
  // Naked pair
  for (let u = 0; u < 27; u++) {
    const open = UNITS[u].filter((i) => !grid[i]);
    for (let a = 0; a < open.length; a++) for (let b = a + 1; b < open.length; b++) {
      const m = cand[open[a]];
      if (popcount(m) !== 2 || cand[open[b]] !== m) continue;
      const victims = open.filter((i) => i !== open[a] && i !== open[b] && cand[i] & m);
      if (victims.length) return { kind: "eliminate", technique: "naked pair", cells: victims, digits: m, focus: [open[a], open[b]], why: `${cellName(open[a])} and ${cellName(open[b])} share exactly ${digitsOf(m).join(" and ")}, so no other cell in ${unitName(u)} can hold them.` };
    }
  }
  // Pointing pair/triple: digit confined to one row/col within a box → remove from rest of that line.
  for (let b = 0; b < 9; b++) for (let d = 1; d <= 9; d++) {
    const spots = UNITS[18 + b].filter((i) => !grid[i] && cand[i] & bit(d));
    if (spots.length < 2 || spots.length > 3) continue;
    for (const line of [rowOf, colOf] as const) {
      const l = line(spots[0]);
      if (!spots.every((i) => line(i) === l)) continue;
      const lineUnit = line === rowOf ? UNITS[l] : UNITS[9 + l];
      const victims = lineUnit.filter((i) => !grid[i] && boxOf(i) !== b && cand[i] & bit(d));
      if (victims.length) return { kind: "eliminate", technique: "pointing pair", cells: victims, digits: bit(d), focus: spots, why: `In box ${b + 1}, ${d} can only sit in ${line === rowOf ? "row" : "column"} ${l + 1}, so it leaves the rest of that ${line === rowOf ? "row" : "column"}.` };
    }
  }
  // Box-line reduction: digit confined to one box within a row/col → remove from rest of that box.
  for (let u = 0; u < 18; u++) for (let d = 1; d <= 9; d++) {
    const spots = UNITS[u].filter((i) => !grid[i] && cand[i] & bit(d));
    if (spots.length < 2 || spots.length > 3) continue;
    const b = boxOf(spots[0]);
    if (!spots.every((i) => boxOf(i) === b)) continue;
    const victims = UNITS[18 + b].filter((i) => !grid[i] && !spots.includes(i) && cand[i] & bit(d));
    if (victims.length) return { kind: "eliminate", technique: "box-line reduction", cells: victims, digits: bit(d), focus: spots, why: `${d} in ${unitName(u)} must be inside box ${b + 1}, so the rest of that box loses ${d}.` };
  }
  // Naked triple
  for (let u = 0; u < 27; u++) {
    const open = UNITS[u].filter((i) => !grid[i] && popcount(cand[i]) <= 3);
    for (let a = 0; a < open.length; a++) for (let b = a + 1; b < open.length; b++) for (let c = b + 1; c < open.length; c++) {
      const m = cand[open[a]] | cand[open[b]] | cand[open[c]];
      if (popcount(m) !== 3) continue;
      const trio = [open[a], open[b], open[c]];
      const victims = UNITS[u].filter((i) => !grid[i] && !trio.includes(i) && cand[i] & m);
      if (victims.length) return { kind: "eliminate", technique: "naked triple", cells: victims, digits: m, focus: trio, why: `Three cells in ${unitName(u)} share only ${digitsOf(m).join(", ")}, so those digits leave the rest of the unit.` };
    }
  }
  // Hidden pair
  for (let u = 0; u < 27; u++) {
    const open = UNITS[u].filter((i) => !grid[i]);
    for (let d1 = 1; d1 <= 9; d1++) for (let d2 = d1 + 1; d2 <= 9; d2++) {
      const m = bit(d1) | bit(d2);
      const spots = open.filter((i) => cand[i] & m);
      if (spots.length !== 2) continue;
      if (!spots.every((i) => (cand[i] & bit(d1)) && (cand[i] & bit(d2)))) continue;
      if (!open.filter((i) => cand[i] & bit(d1)).every((i) => spots.includes(i))) continue;
      if (!open.filter((i) => cand[i] & bit(d2)).every((i) => spots.includes(i))) continue;
      if (spots.some((i) => cand[i] & ~m)) return { kind: "eliminate", technique: "hidden pair", cells: spots, digits: ~m & ALL, focus: spots, why: `${d1} and ${d2} only fit in ${cellName(spots[0])} and ${cellName(spots[1])} within ${unitName(u)}, so those two cells hold nothing else.` };
    }
  }
  // X-wing
  for (let d = 1; d <= 9; d++) for (const [lines, cross, crossOf] of [[0, 9, colOf], [9, 0, rowOf]] as const) {
    const pairs: { l: number; at: number[] }[] = [];
    for (let l = 0; l < 9; l++) {
      const spots = UNITS[lines + l].filter((i) => !grid[i] && cand[i] & bit(d));
      if (spots.length === 2) pairs.push({ l, at: spots.map(crossOf) });
    }
    for (let a = 0; a < pairs.length; a++) for (let b = a + 1; b < pairs.length; b++) {
      if (pairs[a].at[0] !== pairs[b].at[0] || pairs[a].at[1] !== pairs[b].at[1]) continue;
      const focus = [pairs[a].l, pairs[b].l].flatMap((l) => UNITS[lines + l].filter((i) => !grid[i] && cand[i] & bit(d)));
      const victims: number[] = [];
      for (const x of pairs[a].at) for (const i of UNITS[cross + x]) if (!grid[i] && !focus.includes(i) && cand[i] & bit(d)) victims.push(i);
      if (victims.length) return { kind: "eliminate", technique: "x-wing", cells: victims, digits: bit(d), focus, why: `${d} forms an X-wing across ${lines === 0 ? "rows" : "columns"} ${pairs[a].l + 1} and ${pairs[b].l + 1}, so it leaves the other cells of those ${lines === 0 ? "columns" : "rows"}.` };
    }
  }
  return null;
}

export function applyStep(grid: Grid, cand: number[], s: Step) {
  if (s.kind === "place") {
    grid[s.cell] = s.digit;
    cand[s.cell] = bit(s.digit);
    for (const p of PEERS[s.cell]) if (!grid[p]) cand[p] &= ~bit(s.digit);
  } else {
    for (const c of s.cells) cand[c] &= ~s.digits;
  }
}

export type Difficulty = "easy" | "normal" | "hard" | "expert";

/** Grade by the hardest technique needed; a puzzle the techniques can't finish is expert. */
export function grade(puzzle: Grid): { difficulty: Difficulty; hardest: Technique | null; stuck: boolean } {
  const grid = puzzle.slice();
  const cand = candidates(grid);
  if (!cand) return { difficulty: "expert", hardest: null, stuck: true };
  let level = -1;
  let hardest: Technique | null = null;
  for (;;) {
    if (grid.every(Boolean)) break;
    const s = stepLogic(grid, cand);
    if (!s) return { difficulty: "expert", hardest, stuck: true };
    const l = levelOf(s.technique);
    if (l > level) { level = l; hardest = s.technique; }
    applyStep(grid, cand, s);
  }
  const difficulty: Difficulty = level <= 1 ? "easy" : level <= 4 ? "normal" : level <= 6 ? "hard" : "expert";
  return { difficulty, hardest, stuck: false };
}
