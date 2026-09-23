// components/games/minesweeper/engine.ts
// Pure Minesweeper. Mines are placed on the first reveal, never under the
// clicked cell or its eight neighbours, so the opening always cascades — the
// generator is the referee and this is the one fairness rule it enforces.
// No solver-guaranteed boards: a 50/50 late in the game is the real game.

export type Preset = "beginner" | "intermediate" | "expert" | "custom";
export type Config = { rows: number; cols: number; mines: number };
export type Status = "idle" | "playing" | "won" | "lost";

export const PRESETS: Record<Exclude<Preset, "custom">, Config> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

export const LIMITS = { minRows: 5, maxRows: 30, minCols: 5, maxCols: 40, minMines: 1 };

export type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number };

export type Game = {
  preset: Preset;
  rows: number;
  cols: number;
  mines: number;
  cells: Cell[];
  status: Status;
  flags: number;
  /** Elapsed play time; the component increments it once a second while playing. */
  seconds: number;
  /** Set when the player hit a mine — the cell that went off. */
  boom: number | null;
  tick: number;
};

export type PresetStats = { games: number; wins: number; best: number };
export type Stats = {
  games: number;
  wins: number;
  streak: number;
  bestStreak: number;
  beginner: PresetStats;
  intermediate: PresetStats;
  expert: PresetStats;
};
const P0: PresetStats = { games: 0, wins: 0, best: 0 };
export const EMPTY_STATS: Stats = { games: 0, wins: 0, streak: 0, bestStreak: 0, beginner: { ...P0 }, intermediate: { ...P0 }, expert: { ...P0 } };

/** Clamp a custom config into a board that can always open: at least 9 safe cells. */
export function clampConfig(c: Config): Config {
  const rows = Math.min(LIMITS.maxRows, Math.max(LIMITS.minRows, Math.floor(c.rows) || LIMITS.minRows));
  const cols = Math.min(LIMITS.maxCols, Math.max(LIMITS.minCols, Math.floor(c.cols) || LIMITS.minCols));
  const mines = Math.min(rows * cols - 9, Math.max(LIMITS.minMines, Math.floor(c.mines) || LIMITS.minMines));
  return { rows, cols, mines };
}

export function neighbours(rows: number, cols: number, i: number): number[] {
  const r = Math.floor(i / cols), c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
  }
  return out;
}

function emptyCells(n: number): Cell[] {
  return Array.from({ length: n }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }));
}

export function newGame(preset: Preset, custom?: Config): Game {
  const cfg = preset === "custom" ? clampConfig(custom ?? PRESETS.beginner) : PRESETS[preset];
  return {
    preset, ...cfg,
    cells: emptyCells(cfg.rows * cfg.cols),
    status: "idle", flags: 0, seconds: 0, boom: null, tick: 0,
  };
}

/** Lay mines avoiding `safe` and its neighbours (falls back to just `safe` on tiny boards), then count adjacents. */
export function placeMines(g: Game, safe: number, rng: () => number = Math.random): Cell[] {
  const cells = emptyCells(g.rows * g.cols);
  const excluded = new Set<number>([safe, ...neighbours(g.rows, g.cols, safe)]);
  if (g.rows * g.cols - excluded.size < g.mines) { excluded.clear(); excluded.add(safe); }
  const pool: number[] = [];
  for (let i = 0; i < cells.length; i++) if (!excluded.has(i)) pool.push(i);
  // Partial Fisher–Yates: pick `mines` distinct cells.
  for (let k = 0; k < g.mines; k++) {
    const j = k + Math.floor(rng() * (pool.length - k));
    [pool[k], pool[j]] = [pool[j], pool[k]];
    cells[pool[k]].mine = true;
  }
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].mine) continue;
    cells[i].adjacent = neighbours(g.rows, g.cols, i).filter((n) => cells[n].mine).length;
  }
  return cells;
}

/** Flood-open from `start` in place. Flagged cells stay closed. */
function flood(g: Game, cells: Cell[], start: number) {
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const c = cells[i];
    if (c.revealed || c.flagged || c.mine) continue;
    c.revealed = true;
    if (c.adjacent === 0) for (const n of neighbours(g.rows, g.cols, i)) if (!cells[n].revealed) stack.push(n);
  }
}

function settle(g: Game, cells: Cell[], boom: number | null): Game {
  if (boom !== null) {
    for (const c of cells) if (c.mine && !c.flagged) c.revealed = true;
    return { ...g, cells, status: "lost", boom, tick: g.tick + 1 };
  }
  const won = cells.every((c) => c.mine || c.revealed);
  if (won) {
    // Classic courtesy: the remaining mines flag themselves.
    for (const c of cells) if (c.mine) c.flagged = true;
    return { ...g, cells, status: "won", flags: g.mines, tick: g.tick + 1 };
  }
  return { ...g, cells, status: "playing", tick: g.tick + 1 };
}

export function reveal(g: Game, i: number, rng: () => number = Math.random): Game {
  if (g.status === "won" || g.status === "lost") return g;
  const cur = g.cells[i];
  if (cur.flagged || cur.revealed) return g;
  const cells = g.status === "idle" ? placeMines(g, i, rng) : g.cells.map((c) => ({ ...c }));
  if (cells[i].mine) return settle(g, cells, i);
  flood(g, cells, i);
  return settle(g, cells, null);
}

export function toggleFlag(g: Game, i: number): Game {
  if (g.status === "won" || g.status === "lost") return g;
  if (g.cells[i].revealed) return g;
  const cells = g.cells.map((c) => ({ ...c }));
  cells[i].flagged = !cells[i].flagged;
  return { ...g, cells, flags: g.flags + (cells[i].flagged ? 1 : -1), status: g.status === "idle" ? "idle" : g.status, tick: g.tick + 1 };
}

/** Open every unflagged neighbour of a satisfied number. A wrong flag means a mine goes off. */
export function chord(g: Game, i: number): Game {
  if (g.status !== "playing") return g;
  const c = g.cells[i];
  if (!c.revealed || c.adjacent === 0) return g;
  const ns = neighbours(g.rows, g.cols, i);
  const flagged = ns.filter((n) => g.cells[n].flagged).length;
  if (flagged !== c.adjacent) return g;
  const targets = ns.filter((n) => !g.cells[n].flagged && !g.cells[n].revealed);
  if (!targets.length) return g;
  const cells = g.cells.map((x) => ({ ...x }));
  const mine = targets.find((n) => cells[n].mine);
  if (mine !== undefined) return settle(g, cells, mine);
  for (const n of targets) flood(g, cells, n);
  return settle(g, cells, null);
}

/** Reveal on a closed cell, chord on an open number — the single left-click. */
export function tap(g: Game, i: number, rng?: () => number): Game {
  return g.cells[i].revealed ? chord(g, i) : reveal(g, i, rng);
}

export function tickSecond(g: Game): Game {
  return g.status === "playing" ? { ...g, seconds: g.seconds + 1 } : g;
}

export function minesLeft(g: Game): number {
  return g.mines - g.flags;
}

/** Fold a finished game into the record. Only preset boards keep a best time. */
export function recordResult(s: Stats, g: Game): Stats {
  if (g.status !== "won" && g.status !== "lost") return s;
  const won = g.status === "won";
  const next: Stats = { ...s, games: s.games + 1, wins: s.wins + (won ? 1 : 0), streak: won ? s.streak + 1 : 0 };
  next.bestStreak = Math.max(next.bestStreak, next.streak);
  if (g.preset !== "custom") {
    const p = { ...s[g.preset] };
    p.games++;
    if (won) { p.wins++; p.best = p.best ? Math.min(p.best, g.seconds) : g.seconds; }
    next[g.preset] = p;
  }
  return next;
}
