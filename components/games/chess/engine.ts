// components/games/chess/engine.ts
// Pure chess rules and game state. Board is a 64-slot array, index = row*8+col
// with row 0 = rank 8 (Black's back rank), so a1 is index 56.
//
// Position = board + side to move + castling rights + en-passant square +
// clocks. Game = a Position plus its move history, repetition table, result
// and the draw-offer / resignation bookkeeping. Everything here is immutable
// and synchronous; the bot lives in bot.ts and the clock in the component.

export type Color = "w" | "b";
export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
export type Piece = { type: PieceType; color: Color };
export type Board = (Piece | null)[];
export type Castle = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };

export type Position = {
  board: Board;
  turn: Color;
  castle: Castle;
  /** En-passant target square, or -1. */
  ep: number;
  /** Plies since the last capture or pawn move. */
  halfmove: number;
  fullmove: number;
};

export type Move = {
  from: number;
  to: number;
  promo?: PieceType;
  capture?: PieceType;
  castle?: "K" | "Q";
  ep?: boolean;
};

export type Status = "playing" | "check" | "checkmate" | "stalemate" | "draw" | "resigned" | "timeout";
export type Result = "1-0" | "0-1" | "1/2-1/2" | "*";
export type DrawReason = "stalemate" | "repetition" | "fifty" | "material" | "agreement" | null;
export type Mode = "bot" | "2p";
export type Difficulty = "easy" | "normal" | "hard" | "expert";

export type HistoryEntry = { move: Move; san: string; key: string; piece: PieceType };

export type Game = {
  mode: Mode;
  difficulty: Difficulty;
  human: Color;
  pos: Position;
  history: HistoryEntry[];
  /** Position key → times seen (for threefold). */
  seen: Record<string, number>;
  status: Status;
  result: Result;
  drawReason: DrawReason;
  /** Colour that has an offer on the table. */
  drawOffer: Color | null;
  /** Seconds per side; 0 = no clock. */
  control: number;
  clock: { w: number; b: number };
  tick: number;
};

export type Stats = { games: number; wins: number; losses: number; draws: number; twoPlayer: number; byDifficulty: Record<Difficulty, { games: number; wins: number }> };
export const EMPTY_STATS: Stats = {
  games: 0, wins: 0, losses: 0, draws: 0, twoPlayer: 0,
  byDifficulty: { easy: { games: 0, wins: 0 }, normal: { games: 0, wins: 0 }, hard: { games: 0, wins: 0 }, expert: { games: 0, wins: 0 } },
};

export const FILES = "abcdefgh";
export const sq = (row: number, col: number) => row * 8 + col;
export const rowOf = (i: number) => i >> 3;
export const colOf = (i: number) => i & 7;
export const name = (i: number) => FILES[colOf(i)] + (8 - rowOf(i));
export const other = (c: Color): Color => (c === "w" ? "b" : "w");
export const PIECE_VALUE: Record<PieceType, number> = { K: 0, Q: 900, R: 500, B: 330, N: 320, P: 100 };

export function initialBoard(): Board {
  const b: Board = new Array(64).fill(null);
  const order: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  order.forEach((t, c) => { b[sq(0, c)] = { type: t, color: "b" }; b[sq(7, c)] = { type: t, color: "w" }; });
  for (let c = 0; c < 8; c++) { b[sq(1, c)] = { type: "P", color: "b" }; b[sq(6, c)] = { type: "P", color: "w" }; }
  return b;
}

export function initialPosition(): Position {
  return { board: initialBoard(), turn: "w", castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1, halfmove: 0, fullmove: 1 };
}

// ── FEN (tests, sharing) ──────────────────────────────────────────────────

export function fromFen(fen: string): Position {
  const [placement, turn, castle, ep, half, full] = fen.trim().split(" ");
  const board: Board = new Array(64).fill(null);
  let i = 0;
  for (const ch of placement) {
    if (ch === "/") continue;
    if (ch >= "1" && ch <= "8") { i += Number(ch); continue; }
    const color: Color = ch === ch.toUpperCase() ? "w" : "b";
    board[i++] = { type: ch.toUpperCase() as PieceType, color };
  }
  const epSq = ep && ep !== "-" ? sq(8 - Number(ep[1]), FILES.indexOf(ep[0])) : -1;
  return {
    board, turn: turn === "b" ? "b" : "w",
    castle: { wK: castle.includes("K"), wQ: castle.includes("Q"), bK: castle.includes("k"), bQ: castle.includes("q") },
    ep: epSq, halfmove: Number(half ?? 0) || 0, fullmove: Number(full ?? 1) || 1,
  };
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = "", empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = pos.board[sq(r, c)];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.color === "w" ? p.type : p.type.toLowerCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const c = pos.castle;
  const castle = `${c.wK ? "K" : ""}${c.wQ ? "Q" : ""}${c.bK ? "k" : ""}${c.bQ ? "q" : ""}` || "-";
  return `${rows.join("/")} ${pos.turn} ${castle} ${pos.ep >= 0 ? name(pos.ep) : "-"} ${pos.halfmove} ${pos.fullmove}`;
}

// ── Attacks ───────────────────────────────────────────────────────────────

const KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Is `target` attacked by `by`? */
export function attacked(board: Board, target: number, by: Color): boolean {
  const r = rowOf(target), c = colOf(target);
  const pawnDir = by === "w" ? 1 : -1; // a white pawn attacks upward (toward row 0), so it sits one row BELOW the target
  for (const dc of [-1, 1]) {
    const pr = r + pawnDir, pc = c + dc;
    if (pr >= 0 && pr < 8 && pc >= 0 && pc < 8) { const p = board[sq(pr, pc)]; if (p && p.color === by && p.type === "P") return true; }
  }
  for (const [dr, dc] of KNIGHT_D) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) { const p = board[sq(nr, nc)]; if (p && p.color === by && p.type === "N") return true; }
  }
  for (const [dr, dc] of KING_D) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) { const p = board[sq(nr, nc)]; if (p && p.color === by && p.type === "K") return true; }
  }
  for (const [dr, dc] of ROOK_D) {
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[sq(nr, nc)];
      if (p) { if (p.color === by && (p.type === "R" || p.type === "Q")) return true; break; }
      nr += dr; nc += dc;
    }
  }
  for (const [dr, dc] of BISHOP_D) {
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[sq(nr, nc)];
      if (p) { if (p.color === by && (p.type === "B" || p.type === "Q")) return true; break; }
      nr += dr; nc += dc;
    }
  }
  return false;
}

export function kingSquare(board: Board, color: Color): number {
  for (let i = 0; i < 64; i++) { const p = board[i]; if (p && p.type === "K" && p.color === color) return i; }
  return -1;
}

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  const k = kingSquare(pos.board, color);
  return k >= 0 && attacked(pos.board, k, other(color));
}

// ── Move generation ───────────────────────────────────────────────────────

function pseudoMoves(pos: Position, from: number, out: Move[]) {
  const { board, turn } = pos;
  const p = board[from];
  if (!p || p.color !== turn) return;
  const r = rowOf(from), c = colOf(from);
  const push = (to: number, extra: Partial<Move> = {}) => {
    const t = board[to];
    out.push({ from, to, capture: t?.type, ...extra });
  };
  if (p.type === "P") {
    const dir = turn === "w" ? -1 : 1;
    const startRow = turn === "w" ? 6 : 1;
    const promoRow = turn === "w" ? 0 : 7;
    const one = r + dir;
    if (one >= 0 && one < 8 && !board[sq(one, c)]) {
      if (one === promoRow) for (const promo of ["Q", "R", "B", "N"] as PieceType[]) push(sq(one, c), { promo });
      else push(sq(one, c));
      if (r === startRow && !board[sq(r + 2 * dir, c)]) push(sq(r + 2 * dir, c));
    }
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (nc < 0 || nc > 7 || one < 0 || one > 7) continue;
      const to = sq(one, nc);
      const t = board[to];
      if (t && t.color !== turn) {
        if (one === promoRow) for (const promo of ["Q", "R", "B", "N"] as PieceType[]) push(to, { promo });
        else push(to);
      } else if (to === pos.ep) out.push({ from, to, capture: "P", ep: true });
    }
    return;
  }
  if (p.type === "N" || p.type === "K") {
    for (const [dr, dc] of p.type === "N" ? KNIGHT_D : KING_D) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
      const t = board[sq(nr, nc)];
      if (!t || t.color !== turn) push(sq(nr, nc));
    }
    if (p.type === "K") {
      const home = turn === "w" ? 7 : 0;
      if (r === home && c === 4 && !attacked(board, from, other(turn))) {
        const rights = pos.castle;
        if ((turn === "w" ? rights.wK : rights.bK) && !board[sq(home, 5)] && !board[sq(home, 6)] &&
          board[sq(home, 7)]?.type === "R" && board[sq(home, 7)]?.color === turn &&
          !attacked(board, sq(home, 5), other(turn)) && !attacked(board, sq(home, 6), other(turn))) {
          out.push({ from, to: sq(home, 6), castle: "K" });
        }
        if ((turn === "w" ? rights.wQ : rights.bQ) && !board[sq(home, 3)] && !board[sq(home, 2)] && !board[sq(home, 1)] &&
          board[sq(home, 0)]?.type === "R" && board[sq(home, 0)]?.color === turn &&
          !attacked(board, sq(home, 3), other(turn)) && !attacked(board, sq(home, 2), other(turn))) {
          out.push({ from, to: sq(home, 2), castle: "Q" });
        }
      }
    }
    return;
  }
  const dirs = p.type === "R" ? ROOK_D : p.type === "B" ? BISHOP_D : [...ROOK_D, ...BISHOP_D];
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const t = board[sq(nr, nc)];
      if (!t) push(sq(nr, nc));
      else { if (t.color !== turn) push(sq(nr, nc)); break; }
      nr += dr; nc += dc;
    }
  }
}

/** Apply a move to a position. Assumes it is legal. */
export function makeMove(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const p = board[m.from]!;
  const castle = { ...pos.castle };
  let ep = -1;
  board[m.to] = m.promo ? { type: m.promo, color: p.color } : p;
  board[m.from] = null;
  if (m.ep) board[sq(rowOf(m.from), colOf(m.to))] = null;
  if (m.castle) {
    const home = rowOf(m.from);
    if (m.castle === "K") { board[sq(home, 5)] = board[sq(home, 7)]; board[sq(home, 7)] = null; }
    else { board[sq(home, 3)] = board[sq(home, 0)]; board[sq(home, 0)] = null; }
  }
  if (p.type === "K") { if (p.color === "w") { castle.wK = false; castle.wQ = false; } else { castle.bK = false; castle.bQ = false; } }
  if (p.type === "P" && Math.abs(rowOf(m.to) - rowOf(m.from)) === 2) ep = sq((rowOf(m.to) + rowOf(m.from)) / 2, colOf(m.from));
  // Rook moved or captured: that side's right is gone.
  for (const s of [m.from, m.to]) {
    if (s === 63) castle.wK = false; else if (s === 56) castle.wQ = false;
    else if (s === 7) castle.bK = false; else if (s === 0) castle.bQ = false;
  }
  const resets = p.type === "P" || !!m.capture;
  return { board, turn: other(pos.turn), castle, ep, halfmove: resets ? 0 : pos.halfmove + 1, fullmove: pos.turn === "b" ? pos.fullmove + 1 : pos.fullmove };
}

export function legalMoves(pos: Position, from?: number): Move[] {
  const pseudo: Move[] = [];
  if (from !== undefined) pseudoMoves(pos, from, pseudo);
  else for (let i = 0; i < 64; i++) pseudoMoves(pos, i, pseudo);
  const out: Move[] = [];
  for (const m of pseudo) {
    const next = makeMove(pos, m);
    if (!inCheck(next, pos.turn)) out.push(m);
  }
  return out;
}

export const sameMove = (a: Move, b: Move) => a.from === b.from && a.to === b.to && a.promo === b.promo;

// ── Draw rules ────────────────────────────────────────────────────────────

export function positionKey(pos: Position): string {
  let s = "";
  for (let i = 0; i < 64; i++) { const p = pos.board[i]; s += p ? (p.color === "w" ? p.type : p.type.toLowerCase()) : "."; }
  const c = pos.castle;
  return `${s}|${pos.turn}|${c.wK ? "K" : ""}${c.wQ ? "Q" : ""}${c.bK ? "k" : ""}${c.bQ ? "q" : ""}|${pos.ep}`;
}

/** K v K, K+minor v K, K+B v K+B on the same colour. */
export function insufficientMaterial(board: Board): boolean {
  const pieces: { p: Piece; i: number }[] = [];
  for (let i = 0; i < 64; i++) { const p = board[i]; if (p && p.type !== "K") pieces.push({ p, i }); }
  if (pieces.length === 0) return true;
  if (pieces.some(({ p }) => p.type === "P" || p.type === "R" || p.type === "Q")) return false;
  if (pieces.length === 1) return true;
  if (pieces.length === 2 && pieces.every(({ p }) => p.type === "B") && pieces[0].p.color !== pieces[1].p.color) {
    const shade = (i: number) => (rowOf(i) + colOf(i)) % 2;
    return shade(pieces[0].i) === shade(pieces[1].i);
  }
  return false;
}

// ── SAN ───────────────────────────────────────────────────────────────────

export function san(pos: Position, m: Move): string {
  const p = pos.board[m.from]!;
  const next = makeMove(pos, m);
  const suffix = inCheck(next) ? (legalMoves(next).length ? "+" : "#") : "";
  if (m.castle) return (m.castle === "K" ? "O-O" : "O-O-O") + suffix;
  let s = "";
  if (p.type === "P") {
    if (m.capture) s += FILES[colOf(m.from)] + "x";
    s += name(m.to);
    if (m.promo) s += "=" + m.promo;
    return s + suffix;
  }
  s += p.type;
  // Disambiguate against other pieces of the same type that can reach `to`.
  const rivals = legalMoves(pos).filter((o) => o.to === m.to && o.from !== m.from && pos.board[o.from]?.type === p.type);
  if (rivals.length) {
    const sameFile = rivals.some((o) => colOf(o.from) === colOf(m.from));
    const sameRow = rivals.some((o) => rowOf(o.from) === rowOf(m.from));
    if (!sameFile) s += FILES[colOf(m.from)];
    else if (!sameRow) s += String(8 - rowOf(m.from));
    else s += name(m.from);
  }
  if (m.capture) s += "x";
  s += name(m.to);
  return s + suffix;
}

// ── Game ──────────────────────────────────────────────────────────────────

export function newGame(opts: { mode: Mode; difficulty: Difficulty; human: Color; control: number }): Game {
  const pos = initialPosition();
  return {
    mode: opts.mode, difficulty: opts.difficulty, human: opts.human, pos,
    history: [], seen: { [positionKey(pos)]: 1 },
    status: "playing", result: "*", drawReason: null, drawOffer: null,
    control: opts.control, clock: { w: opts.control, b: opts.control }, tick: 0,
  };
}

function settle(g: Game): Game {
  const moves = legalMoves(g.pos);
  const check = inCheck(g.pos);
  if (!moves.length) {
    if (check) return { ...g, status: "checkmate", result: g.pos.turn === "w" ? "0-1" : "1-0" };
    return { ...g, status: "stalemate", result: "1/2-1/2", drawReason: "stalemate" };
  }
  if (insufficientMaterial(g.pos.board)) return { ...g, status: "draw", result: "1/2-1/2", drawReason: "material" };
  if (g.pos.halfmove >= 100) return { ...g, status: "draw", result: "1/2-1/2", drawReason: "fifty" };
  if ((g.seen[positionKey(g.pos)] ?? 0) >= 3) return { ...g, status: "draw", result: "1/2-1/2", drawReason: "repetition" };
  return { ...g, status: check ? "check" : "playing" };
}

export const isOver = (g: Game) => g.result !== "*";

export function play(g: Game, m: Move): Game {
  if (isOver(g)) return g;
  const legal = legalMoves(g.pos, m.from).find((o) => sameMove(o, m));
  if (!legal) return g;
  const piece = g.pos.board[m.from]!.type;
  const s = san(g.pos, legal);
  const pos = makeMove(g.pos, legal);
  const key = positionKey(pos);
  const seen = { ...g.seen, [key]: (g.seen[key] ?? 0) + 1 };
  // An offer lapses the moment the other side moves instead of accepting.
  return settle({ ...g, pos, history: [...g.history, { move: legal, san: s, key, piece }], seen, drawOffer: g.drawOffer === g.pos.turn ? g.drawOffer : null, tick: g.tick + 1 });
}

/** Rebuild from history — used by undo and by resuming a saved game. */
export function replay(base: Game, moves: Move[]): Game {
  let g: Game = { ...newGame({ mode: base.mode, difficulty: base.difficulty, human: base.human, control: base.control }), clock: base.clock };
  for (const m of moves) g = play(g, m);
  return { ...g, tick: base.tick + 1 };
}

/** Take back a full turn: vs the bot that is your move and its reply. */
export function undo(g: Game): Game {
  if (isOver(g) || !g.history.length) return g;
  let n = 1;
  if (g.mode === "bot") {
    // Remove until it is the human's turn again with the human's last move gone.
    n = g.pos.turn === g.human ? 2 : 1;
  }
  n = Math.min(n, g.history.length);
  return replay(g, g.history.slice(0, -n).map((h) => h.move));
}

export function resign(g: Game, color: Color): Game {
  if (isOver(g)) return g;
  return { ...g, status: "resigned", result: color === "w" ? "0-1" : "1-0", tick: g.tick + 1 };
}

export function flag(g: Game, color: Color): Game {
  if (isOver(g)) return g;
  return { ...g, status: "timeout", result: color === "w" ? "0-1" : "1-0", clock: { ...g.clock, [color]: 0 }, tick: g.tick + 1 };
}

export function offerDraw(g: Game, color: Color): Game {
  if (isOver(g) || g.drawOffer) return g;
  return { ...g, drawOffer: color, tick: g.tick + 1 };
}

export function acceptDraw(g: Game): Game {
  if (isOver(g) || !g.drawOffer) return g;
  return { ...g, status: "draw", result: "1/2-1/2", drawReason: "agreement", drawOffer: null, tick: g.tick + 1 };
}

export function declineDraw(g: Game): Game {
  return g.drawOffer ? { ...g, drawOffer: null, tick: g.tick + 1 } : g;
}

/** Charge the side to move `secs` of real time (fractional; the component passes wall-clock deltas). */
export function tickClock(g: Game, secs = 1): Game {
  if (isOver(g) || !g.control) return g;
  const c = g.pos.turn;
  const left = g.clock[c] - secs;
  if (left <= 0) return flag(g, c);
  return { ...g, clock: { ...g.clock, [c]: left } };
}

/** Pieces missing from the board per side, for the captured row, plus the material lead. */
export function captured(board: Board): { w: PieceType[]; b: PieceType[]; diff: number } {
  const start: Record<PieceType, number> = { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };
  const count = (color: Color) => {
    const c: Record<PieceType, number> = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 };
    for (const p of board) if (p && p.color === color) c[p.type]++;
    return c;
  };
  const wc = count("w"), bc = count("b");
  const missing = (c: Record<PieceType, number>): PieceType[] => {
    const out: PieceType[] = [];
    for (const t of ["Q", "R", "B", "N", "P"] as PieceType[]) for (let i = 0; i < Math.max(0, start[t] - c[t]); i++) out.push(t);
    return out;
  };
  const material = (c: Record<PieceType, number>) => (Object.keys(c) as PieceType[]).reduce((s, t) => s + c[t] * PIECE_VALUE[t], 0);
  // "w" = pieces White has captured (i.e. Black's missing pieces).
  return { w: missing(bc), b: missing(wc), diff: material(wc) - material(bc) };
}

export function pgn(g: Game, names: { w: string; b: string }, date: string): string {
  const tags = [
    `[Event "Tyunnie PA"]`, `[Site "tyunnie"]`, `[Date "${date.replace(/-/g, ".")}"]`, `[Round "-"]`,
    `[White "${names.w}"]`, `[Black "${names.b}"]`, `[Result "${g.result}"]`,
  ];
  if (g.control) tags.push(`[TimeControl "${g.control}"]`);
  const body: string[] = [];
  g.history.forEach((h, i) => { if (i % 2 === 0) body.push(`${i / 2 + 1}.`); body.push(h.san); });
  body.push(g.result);
  // Wrap at ~80 columns as the spec asks.
  const lines: string[] = [];
  let cur = "";
  for (const tok of body) { if ((cur + " " + tok).trim().length > 79) { lines.push(cur.trim()); cur = tok; } else cur = (cur + " " + tok).trim(); }
  if (cur) lines.push(cur);
  return tags.join("\n") + "\n\n" + lines.join("\n") + "\n";
}

export function recordResult(s: Stats, g: Game): Stats {
  if (!isOver(g)) return s;
  const next: Stats = { ...s, games: s.games + 1, byDifficulty: { ...s.byDifficulty } };
  if (g.mode === "2p") { next.twoPlayer = s.twoPlayer + 1; return next; }
  const humanWon = (g.result === "1-0" && g.human === "w") || (g.result === "0-1" && g.human === "b");
  if (g.result === "1/2-1/2") next.draws = s.draws + 1;
  else if (humanWon) next.wins = s.wins + 1;
  else next.losses = s.losses + 1;
  const d = { ...s.byDifficulty[g.difficulty] };
  d.games++;
  if (humanWon) d.wins++;
  next.byDifficulty[g.difficulty] = d;
  return next;
}
