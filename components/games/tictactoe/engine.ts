// components/games/tictactoe/engine.ts
// Pure rules for Tic-Tac-Toe. The component renders and schedules the bot's
// pause; nothing here touches React, storage or timers.
//
// Bot tiers are deterministic except Easy: Normal plays win / block / centre /
// corner / edge (beatable by a fork), Hard is full minimax with alpha-beta and
// a first-index tiebreak, so a given board always gets the same reply.

export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];
export type Difficulty = "easy" | "normal" | "hard";
export type First = "you" | "tyunnie" | "alternate";
export type Status = "playing" | "won" | "lost" | "draw";

export const HUMAN: Mark = "X";
export const BOT: Mark = "O";

export const LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export type Stats = { games: number; you: number; tyun: number; draw: number; streak: number; bestStreak: number };
export const EMPTY_STATS: Stats = { games: 0, you: 0, tyun: 0, draw: 0, streak: 0, bestStreak: 0 };

export type Game = {
  board: Board;
  turn: Mark;
  status: Status;
  line: number[] | null;
  difficulty: Difficulty;
  first: First;
  /** Who opened this game — "alternate" resolves to one of the other two. */
  opener: "you" | "tyunnie";
  stats: Stats;
  tick: number;
};

export function winner(board: Board): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const m = board[a];
    if (m && m === board[b] && m === board[c]) return { mark: m, line };
  }
  return null;
}

export function isFull(board: Board): boolean {
  return board.every(Boolean);
}

export function empties(board: Board): number[] {
  const out: number[] = [];
  board.forEach((c, i) => { if (!c) out.push(i); });
  return out;
}

// ── Bot ────────────────────────────────────────────────────────────────────

/** Minimax from `me`'s point of view; shallower wins score higher so the bot finishes. */
function minimax(board: Board, mark: Mark, me: Mark, alpha: number, beta: number, depth: number): number {
  const w = winner(board);
  if (w) return w.mark === me ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;
  const other: Mark = mark === "X" ? "O" : "X";
  const maximizing = mark === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const i of empties(board)) {
    board[i] = mark;
    const s = minimax(board, other, me, alpha, beta, depth + 1);
    board[i] = null;
    if (maximizing) {
      if (s > best) best = s;
      if (best > alpha) alpha = best;
    } else {
      if (s < best) best = s;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function perfectMove(board: Board, me: Mark): number {
  const other: Mark = me === "X" ? "O" : "X";
  let bestScore = -Infinity;
  let bestMove = -1;
  for (const i of empties(board)) {
    board[i] = me;
    const s = minimax(board, other, me, -Infinity, Infinity, 1);
    board[i] = null;
    if (s > bestScore) { bestScore = s; bestMove = i; }
  }
  return bestMove;
}

/** First empty cell that completes a line for `mark`, or -1. */
function completing(board: Board, mark: Mark): number {
  for (const [a, b, c] of LINES) {
    const cells = [a, b, c];
    const mine = cells.filter((i) => board[i] === mark).length;
    const open = cells.filter((i) => !board[i]);
    if (mine === 2 && open.length === 1) return open[0];
  }
  return -1;
}

const NORMAL_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7];

function normalMove(board: Board, me: Mark): number {
  const other: Mark = me === "X" ? "O" : "X";
  const win = completing(board, me);
  if (win >= 0) return win;
  const block = completing(board, other);
  if (block >= 0) return block;
  for (const i of NORMAL_ORDER) if (!board[i]) return i;
  return -1;
}

export function botMove(board: Board, difficulty: Difficulty, me: Mark = BOT, rng: () => number = Math.random): number {
  const open = empties(board);
  if (!open.length) return -1;
  if (difficulty === "easy") return open[Math.floor(rng() * open.length)];
  if (difficulty === "normal") return normalMove(board, me);
  return perfectMove(board, me);
}

// ── Game ───────────────────────────────────────────────────────────────────

export function newGame(opts: { difficulty: Difficulty; first: First; stats?: Stats; prevOpener?: "you" | "tyunnie" }): Game {
  const opener: "you" | "tyunnie" =
    opts.first === "alternate" ? (opts.prevOpener === "you" ? "tyunnie" : "you") : opts.first;
  return {
    board: Array(9).fill(null),
    turn: opener === "you" ? HUMAN : BOT,
    status: "playing",
    line: null,
    difficulty: opts.difficulty,
    first: opts.first,
    opener,
    stats: opts.stats ?? { ...EMPTY_STATS },
    tick: 0,
  };
}

function finish(g: Game, board: Board): Game {
  const w = winner(board);
  const s = { ...g.stats };
  if (w) {
    const won = w.mark === HUMAN;
    s.games++;
    if (won) { s.you++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); }
    else { s.tyun++; s.streak = 0; }
    return { ...g, board, status: won ? "won" : "lost", line: w.line, stats: s, tick: g.tick + 1 };
  }
  if (isFull(board)) {
    s.games++; s.draw++;
    return { ...g, board, status: "draw", line: null, stats: s, tick: g.tick + 1 };
  }
  return { ...g, board, turn: g.turn === "X" ? "O" : "X", tick: g.tick + 1 };
}

export function place(g: Game, i: number): Game {
  if (g.status !== "playing" || g.board[i]) return g;
  const board = [...g.board];
  board[i] = g.turn;
  return finish(g, board);
}

export function humanMove(g: Game, i: number): Game {
  if (g.turn !== HUMAN) return g;
  return place(g, i);
}

export function botTurn(g: Game, rng: () => number = Math.random): Game {
  if (g.status !== "playing" || g.turn !== BOT) return g;
  const i = botMove(g.board, g.difficulty, BOT, rng);
  return i < 0 ? g : place(g, i);
}

export function canPlace(g: Game, i: number): boolean {
  return g.status === "playing" && g.turn === HUMAN && !g.board[i];
}
