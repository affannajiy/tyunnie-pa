// components/games/tetris/engine.ts
// Pure Tetris core: 7-bag randomiser, SRS rotation with the guideline kick
// tables, hold, ghost, guideline scoring (T-spins, back-to-back, combos,
// drop points), Marathon and 40-line Sprint. Every transition is a discrete
// function; timing (gravity, lock delay, DAS/ARR) lives in the component,
// which asks `isGrounded()` and calls `lock()` when the clock says so.
//
// Coordinates: x right, y DOWN. A piece spawns with y = -1, so part of it sits
// above the visible field; anything locked wholly above row 0 is a lock-out.

export type Type = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Cell = Type | null;
export type Grid = Cell[][];
export type Mode = "marathon" | "sprint";
export type Status = "ready" | "playing" | "paused" | "over" | "done";
export type Rot = 0 | 1 | 2 | 3;

export const COLS = 10;
export const ROWS = 20;
export const SPRINT_LINES = 40;
export const PREVIEW = 3;
export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
export const DAS_MS = 170;
export const ARR_MS = 50;
export const SOFT_DROP_MS = 50;

export const TYPES: Type[] = ["I", "O", "T", "S", "Z", "J", "L"];

const BOX: Record<Type, number[][]> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[0, 1, 1], [0, 1, 1], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

function rotateCW(m: number[][]): number[][] {
  const n = m.length;
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => m[n - 1 - c][r]));
}

/** SHAPES[type][rot] = list of [dx, dy] cells relative to the box origin. */
export const SHAPES: Record<Type, [number, number][][]> = (() => {
  const out = {} as Record<Type, [number, number][][]>;
  for (const t of TYPES) {
    const states: [number, number][][] = [];
    let m = BOX[t];
    for (let r = 0; r < 4; r++) {
      const cells: [number, number][] = [];
      m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
      states.push(cells);
      m = rotateCW(m);
    }
    out[t] = states;
  }
  return out;
})();

// Guideline kick tables, written with y up as published; negated on use.
type Kick = [number, number];
const KICKS_JLSTZ: Record<string, Kick[]> = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I: Record<string, Kick[]> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

export type Piece = { type: Type; rot: Rot; x: number; y: number };

export type Clear = {
  lines: number;
  tspin: "none" | "mini" | "full";
  b2b: boolean;
  combo: number;
  points: number;
  /** Set for a "perfect clear" — the field emptied. */
  perfect: boolean;
};

export type Game = {
  mode: Mode;
  grid: Grid;
  cur: Piece | null;
  queue: Type[];
  bag: Type[];
  hold: Type | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  combo: number;
  b2b: boolean;
  /** Last successful action — rotation is what makes a lock a T-spin. */
  lastAction: "rotate" | "move" | "drop" | null;
  /** Which SRS kick the last rotation used; index 4 is the "full" T-spin kick. */
  lastKick: number;
  lockResets: number;
  lastClear: Clear | null;
  status: Status;
  pieces: number;
  tetrises: number;
  tspins: number;
  tick: number;
};

export type Stats = {
  games: number;
  bestScore: number;
  bestLines: number;
  bestLevel: number;
  totalLines: number;
  tetrises: number;
  tspins: number;
  /** Sprint best in milliseconds. */
  sprintBest: number;
  sprintFinished: number;
};
export const EMPTY_STATS: Stats = { games: 0, bestScore: 0, bestLines: 0, bestLevel: 0, totalLines: 0, tetrises: 0, tspins: 0, sprintBest: 0, sprintFinished: 0 };

export const emptyGrid = (): Grid => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));

/** Gravity interval for a level, guideline curve, floored so level 20+ is still playable. */
export function gravityMs(level: number): number {
  const l = Math.max(1, level) - 1;
  return Math.max(30, Math.round(Math.pow(0.8 - l * 0.007, l) * 1000));
}

function shuffled<T>(a: T[], rng: () => number): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Keep the queue topped up from the bag; a fresh bag is one of each piece. */
function refill(queue: Type[], bag: Type[], rng: () => number): { queue: Type[]; bag: Type[] } {
  const q = queue.slice(), b = bag.slice();
  while (q.length < PREVIEW + 1) {
    if (!b.length) b.push(...shuffled(TYPES, rng));
    q.push(b.shift()!);
  }
  return { queue: q, bag: b };
}

export function cells(p: Piece): [number, number][] {
  return SHAPES[p.type][p.rot].map(([dx, dy]) => [p.x + dx, p.y + dy]);
}

export function fits(grid: Grid, p: Piece): boolean {
  for (const [x, y] of cells(p)) {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y >= 0 && grid[y][x]) return false;
  }
  return true;
}

const spawnPiece = (type: Type): Piece => ({ type, rot: 0, x: 3, y: -1 });

export function newGame(mode: Mode, rng: () => number = Math.random): Game {
  const { queue, bag } = refill([], [], rng);
  return {
    mode, grid: emptyGrid(), cur: null, queue, bag, hold: null, canHold: true,
    score: 0, lines: 0, level: 1, combo: -1, b2b: false,
    lastAction: null, lastKick: 0, lockResets: 0, lastClear: null,
    status: "ready", pieces: 0, tetrises: 0, tspins: 0, tick: 0,
  };
}

function spawn(g: Game, rng: () => number): Game {
  const { queue, bag } = refill(g.queue, g.bag, rng);
  const type = queue[0];
  const p = spawnPiece(type);
  const next: Game = { ...g, queue: queue.slice(1), bag, cur: p, lastAction: null, lastKick: 0, lockResets: 0, pieces: g.pieces + 1, tick: g.tick + 1 };
  if (!fits(g.grid, p)) return { ...next, status: "over" }; // block out
  return next;
}

export function start(g: Game, rng: () => number = Math.random): Game {
  if (g.status !== "ready") return g;
  return spawn({ ...g, status: "playing" }, rng);
}

export function pause(g: Game): Game {
  return g.status === "playing" ? { ...g, status: "paused", tick: g.tick + 1 } : g;
}
export function resume(g: Game): Game {
  return g.status === "paused" ? { ...g, status: "playing", tick: g.tick + 1 } : g;
}

const live = (g: Game): g is Game & { cur: Piece } => g.status === "playing" && g.cur !== null;

export function isGrounded(g: Game): boolean {
  return live(g) && !fits(g.grid, { ...g.cur, y: g.cur.y + 1 });
}

/** A successful move or rotation while grounded spends one lock reset. */
function touched(g: Game, p: Piece, action: "rotate" | "move", kick = 0): Game {
  const grounded = !fits(g.grid, { ...p, y: p.y + 1 });
  return { ...g, cur: p, lastAction: action, lastKick: kick, lockResets: grounded ? g.lockResets + 1 : g.lockResets, tick: g.tick + 1 };
}

export function move(g: Game, dx: -1 | 1): Game {
  if (!live(g)) return g;
  const p = { ...g.cur, x: g.cur.x + dx };
  return fits(g.grid, p) ? touched(g, p, "move") : g;
}

export function rotate(g: Game, dir: 1 | -1): Game {
  if (!live(g) || g.cur.type === "O") return g;
  const from = g.cur.rot, to = ((from + dir + 4) % 4) as Rot;
  const table = g.cur.type === "I" ? KICKS_I : KICKS_JLSTZ;
  const kicks = table[`${from}>${to}`];
  for (let k = 0; k < kicks.length; k++) {
    const [kx, ky] = kicks[k];
    const p: Piece = { ...g.cur, rot: to, x: g.cur.x + kx, y: g.cur.y - ky };
    if (fits(g.grid, p)) return touched(g, p, "rotate", k);
  }
  return g;
}

/** One cell down under gravity — no points, no action change. */
export function gravity(g: Game): Game {
  if (!live(g)) return g;
  const p = { ...g.cur, y: g.cur.y + 1 };
  return fits(g.grid, p) ? { ...g, cur: p, lastAction: "drop", tick: g.tick + 1 } : g;
}

/** Player soft drop: one cell, one point. */
export function softDrop(g: Game): Game {
  if (!live(g)) return g;
  const p = { ...g.cur, y: g.cur.y + 1 };
  return fits(g.grid, p) ? { ...g, cur: p, score: g.score + 1, lastAction: "drop", tick: g.tick + 1 } : g;
}

export function ghost(g: Game): Piece | null {
  if (!live(g)) return null;
  const p = { ...g.cur };
  while (fits(g.grid, { ...p, y: p.y + 1 })) p.y++;
  return p;
}

export function hardDrop(g: Game, rng: () => number = Math.random): Game {
  if (!live(g)) return g;
  const gh = ghost(g)!;
  const fell = gh.y - g.cur.y;
  return lock({ ...g, cur: gh, score: g.score + fell * 2, lastAction: fell ? "drop" : g.lastAction }, rng);
}

export function hold(g: Game, rng: () => number = Math.random): Game {
  if (!live(g) || !g.canHold) return g;
  const held = g.hold;
  const base: Game = { ...g, hold: g.cur.type, canHold: false, cur: null };
  if (held) {
    const p = spawnPiece(held);
    return { ...base, cur: p, lastAction: null, lastKick: 0, lockResets: 0, tick: g.tick + 1, status: fits(g.grid, p) ? "playing" : "over" };
  }
  return spawn(base, rng);
}

/** T-spin check at lock time: T, last action a rotation, three of four corners filled. */
function tspinKind(g: Game & { cur: Piece }): "none" | "mini" | "full" {
  const p = g.cur;
  if (p.type !== "T" || g.lastAction !== "rotate") return "none";
  const cx = p.x + 1, cy = p.y + 1;
  const filled = (x: number, y: number) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && !!g.grid[y][x]);
  // Corners in box order: top-left, top-right, bottom-right, bottom-left.
  const corners = [filled(cx - 1, cy - 1), filled(cx + 1, cy - 1), filled(cx + 1, cy + 1), filled(cx - 1, cy + 1)];
  if (corners.filter(Boolean).length < 3) return "none";
  // The two corners the T points toward, by rotation state (0 up, 1 right, 2 down, 3 left).
  const front = [[0, 1], [1, 2], [2, 3], [3, 0]][p.rot];
  const fullFront = corners[front[0]] && corners[front[1]];
  return fullFront || g.lastKick === 4 ? "full" : "mini";
}

const LINE_POINTS = [0, 100, 300, 500, 800];
const TSPIN_POINTS = { none: [0, 0, 0, 0, 0], mini: [100, 200, 400, 0, 0], full: [400, 800, 1200, 1600, 0] };

export function lock(g: Game, rng: () => number = Math.random): Game {
  if (!live(g)) return g;
  const tspin = tspinKind(g);
  const grid = g.grid.map((r) => r.slice());
  let above = true;
  for (const [x, y] of cells(g.cur)) { if (y >= 0) { grid[y][x] = g.cur.type; above = false; } }
  if (above) return { ...g, grid, cur: null, status: "over", tick: g.tick + 1 }; // lock out

  const kept = grid.filter((row) => row.some((c) => !c));
  const lines = ROWS - kept.length;
  const cleared: Grid = [...Array.from({ length: lines }, () => Array<Cell>(COLS).fill(null)), ...kept];

  let combo = g.combo, b2b = g.b2b, points = 0;
  let lastClear: Clear | null = null;
  if (lines || tspin !== "none") {
    const difficult = lines === 4 || (tspin !== "none" && lines > 0);
    const base = tspin === "none" ? LINE_POINTS[lines] : TSPIN_POINTS[tspin][lines];
    const b2bNow = difficult && b2b && lines > 0;
    points = Math.round(base * (b2bNow ? 1.5 : 1)) * g.level;
    if (lines) {
      combo = combo + 1;
      if (combo > 0) points += 50 * combo * g.level;
      b2b = difficult;
    }
    const perfect = lines > 0 && cleared.every((r) => r.every((c) => !c));
    if (perfect) points += [0, 800, 1200, 1800, 2000][lines] * g.level;
    lastClear = { lines, tspin, b2b: b2bNow, combo: lines ? combo : g.combo, points, perfect };
  } else {
    combo = -1;
  }

  const totalLines = g.lines + lines;
  const level = g.mode === "marathon" ? 1 + Math.floor(totalLines / 10) : 1;
  const next: Game = {
    ...g, grid: cleared, cur: null, canHold: true,
    score: g.score + points, lines: totalLines, level, combo, b2b,
    tetrises: g.tetrises + (lines === 4 ? 1 : 0), tspins: g.tspins + (tspin !== "none" ? 1 : 0),
    lastClear, lockResets: 0, lastAction: null, lastKick: 0, tick: g.tick + 1,
  };
  if (g.mode === "sprint" && totalLines >= SPRINT_LINES) return { ...next, status: "done" };
  return spawn(next, rng);
}

/** The field as drawn: locked cells, the ghost outline, then the live piece. */
export function render(g: Game): (Cell | "ghost")[][] {
  const out: (Cell | "ghost")[][] = g.grid.map((r) => r.slice());
  const gh = ghost(g);
  if (gh) for (const [x, y] of cells(gh)) if (y >= 0 && !out[y][x]) out[y][x] = "ghost";
  if (g.cur) for (const [x, y] of cells(g.cur)) if (y >= 0) out[y][x] = g.cur.type;
  return out;
}

export function clearLabel(c: Clear): string {
  const names = ["", "Single", "Double", "Triple", "Tetris"];
  let s = c.tspin === "full" ? `T-Spin ${names[c.lines] || ""}`.trim() : c.tspin === "mini" ? `Mini T-Spin ${names[c.lines] || ""}`.trim() : names[c.lines];
  if (c.perfect) s = `Perfect Clear · ${s}`;
  if (c.b2b) s = `Back-to-Back ${s}`;
  if (c.combo > 0) s += ` · ${c.combo} combo`;
  return s;
}

export function recordResult(s: Stats, g: Game, elapsedMs: number): Stats {
  if (g.status !== "over" && g.status !== "done") return s;
  const next: Stats = { ...s, games: s.games + 1, totalLines: s.totalLines + g.lines, tetrises: s.tetrises + g.tetrises, tspins: s.tspins + g.tspins };
  if (g.mode === "marathon") {
    next.bestScore = Math.max(s.bestScore, g.score);
    next.bestLines = Math.max(s.bestLines, g.lines);
    next.bestLevel = Math.max(s.bestLevel, g.level);
  } else if (g.status === "done") {
    next.sprintFinished = s.sprintFinished + 1;
    next.sprintBest = s.sprintBest ? Math.min(s.sprintBest, elapsedMs) : elapsedMs;
  }
  return next;
}
