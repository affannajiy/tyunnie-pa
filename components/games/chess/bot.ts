// components/games/chess/bot.ts
// Deterministic alpha-beta search over engine.ts positions. No randomness at
// any tier — a position always gets the same reply — so a test can pin it.
//
//   easy    depth 1, material only
//   normal  depth 2, material + piece-square tables
//   hard    depth 3, + MVV-LVA move ordering
//   expert  depth 4, + quiescence search, iterative deepening under a time cap
//
// Scores are centipawns from the side to move's point of view (negamax).

import { type Position, type Move, type PieceType, type Difficulty, type Color, legalMoves, makeMove, inCheck, rowOf, PIECE_VALUE } from "./engine";

// Piece-square tables from White's side, row 0 = rank 8. Mirrored for Black.
const PST: Record<PieceType, number[]> = {
  P: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  N: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  B: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  R: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  Q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  K: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

const MATE = 100000;

/** Static evaluation from White's point of view. */
export function evaluate(pos: Position, pst: boolean): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    let v = PIECE_VALUE[p.type];
    if (pst) v += p.color === "w" ? PST[p.type][i] : PST[p.type][(7 - rowOf(i)) * 8 + (i & 7)];
    s += p.color === "w" ? v : -v;
  }
  return s;
}

const sideEval = (pos: Position, pst: boolean) => (pos.turn === "w" ? 1 : -1) * evaluate(pos, pst);

/** Captures first, most valuable victim / least valuable attacker; promotions next. Stable for determinism. */
function order(pos: Position, moves: Move[]): Move[] {
  const score = (m: Move) => {
    let s = 0;
    if (m.capture) s += 10 * PIECE_VALUE[m.capture] - PIECE_VALUE[pos.board[m.from]!.type] / 10;
    if (m.promo) s += 800;
    return s;
  };
  return moves.map((m, i) => ({ m, i, s: score(m) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.m);
}

type Ctx = { pst: boolean; ordering: boolean; quiescence: boolean; deadline: number; nodes: number; aborted: boolean };

function quiesce(pos: Position, alpha: number, beta: number, ctx: Ctx, depth: number): number {
  const stand = sideEval(pos, ctx.pst);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (depth <= 0) return alpha;
  const caps = legalMoves(pos).filter((m) => m.capture || m.promo);
  for (const m of order(pos, caps)) {
    ctx.nodes++;
    const s = -quiesce(makeMove(pos, m), -beta, -alpha, ctx, depth - 1);
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }
  return alpha;
}

function search(pos: Position, depth: number, alpha: number, beta: number, ctx: Ctx, ply: number): number {
  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;
  if (ctx.aborted) return 0;
  const moves = legalMoves(pos);
  if (!moves.length) return inCheck(pos) ? -MATE + ply : 0;
  if (pos.halfmove >= 100) return 0;
  if (depth <= 0) return ctx.quiescence ? quiesce(pos, alpha, beta, ctx, 6) : sideEval(pos, ctx.pst);
  const ordered = ctx.ordering ? order(pos, moves) : moves;
  let best = -Infinity;
  for (const m of ordered) {
    ctx.nodes++;
    const s = -search(makeMove(pos, m), depth - 1, -beta, -alpha, ctx, ply + 1);
    if (ctx.aborted) return 0;
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

const TIERS: Record<Difficulty, { depth: number; pst: boolean; ordering: boolean; quiescence: boolean }> = {
  easy: { depth: 1, pst: false, ordering: false, quiescence: false },
  normal: { depth: 2, pst: true, ordering: false, quiescence: false },
  hard: { depth: 3, pst: true, ordering: true, quiescence: false },
  expert: { depth: 4, pst: true, ordering: true, quiescence: true },
};

export type BotResult = { move: Move | null; score: number; depth: number; nodes: number };

/**
 * Best move for the side to move. Iterative deepening stops at the tier's
 * depth or the time budget, whichever first; the last completed depth wins.
 */
export function bestMove(pos: Position, difficulty: Difficulty, budgetMs = 1500): BotResult {
  const t = TIERS[difficulty];
  const root = legalMoves(pos);
  if (!root.length) return { move: null, score: 0, depth: 0, nodes: 0 };
  const ctx: Ctx = { ...t, deadline: Date.now() + budgetMs, nodes: 0, aborted: false };
  let best: Move = root[0], bestScore = -Infinity, doneDepth = 0;
  for (let d = 1; d <= t.depth; d++) {
    const ordered = t.ordering ? order(pos, root) : root;
    let dBest: Move | null = null, dScore = -Infinity, alpha = -Infinity;
    for (const m of ordered) {
      ctx.nodes++;
      const s = -search(makeMove(pos, m), d - 1, -Infinity, -alpha, ctx, 1);
      if (ctx.aborted) break;
      if (s > dScore) { dScore = s; dBest = m; }
      if (s > alpha) alpha = s;
    }
    if (ctx.aborted || !dBest) break;
    best = dBest; bestScore = dScore; doneDepth = d;
    if (bestScore >= MATE - 50) break;
  }
  return { move: best, score: bestScore, depth: doneDepth, nodes: ctx.nodes };
}

/** The bot accepts a draw when it isn't ahead: within ±30 centipawns for its colour. */
export function acceptsDraw(pos: Position, botColor: Color): boolean {
  const e = evaluate(pos, true) * (botColor === "w" ? 1 : -1);
  return e <= 30;
}
