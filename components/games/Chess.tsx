"use client";

import { useState, useEffect, useRef } from "react";

// ── TYPES ──
type Color = "w" | "b";
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
type Piece = { type: PieceType; color: Color };
type Board = (Piece | null)[][];
type Square = { row: number; col: number };
type GameMode = "vs-bot" | "2-player";
type Difficulty = "easy" | "medium" | "hard";
type TimeControl =
  | "none"
  | "bullet1"
  | "bullet2"
  | "blitz3"
  | "blitz5"
  | "rapid10"
  | "rapid15"
  | "classical30";

const TIME_CONTROLS: Record<
  TimeControl,
  { label: string; seconds: number; desc: string }
> = {
  none: { label: "No Timer", seconds: 0, desc: "Unlimited time" },
  bullet1: { label: "1 min", seconds: 60, desc: "Bullet" },
  bullet2: { label: "2 min", seconds: 120, desc: "Bullet" },
  blitz3: { label: "3 min", seconds: 180, desc: "Blitz" },
  blitz5: { label: "5 min", seconds: 300, desc: "Blitz" },
  rapid10: { label: "10 min", seconds: 600, desc: "Rapid" },
  rapid15: { label: "15 min", seconds: 900, desc: "Rapid" },
  classical30: { label: "30 min", seconds: 1800, desc: "Classical" },
};
type GameStatus = "playing" | "check" | "checkmate" | "stalemate" | "draw";
type PromotionState = { from: Square; to: Square } | null;

// ── PIECE VALUES ──
const PIECE_VALUES: Record<PieceType, number> = {
  K: 20000,
  Q: 900,
  R: 500,
  B: 330,
  N: 320,
  P: 100,
};

// ── PIECE SYMBOLS ──
const UNICODE: Record<string, string> = {
  wK: "♚",
  wQ: "♛",
  wR: "♜",
  wB: "♝",
  wN: "♞",
  wP: "♟",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

// ── INITIAL BOARD ──
function initBoard(): Board {
  const b: Board = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));
  const order: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  order.forEach((t, c) => {
    b[0][c] = { type: t, color: "b" };
    b[7][c] = { type: t, color: "w" };
  });
  for (let c = 0; c < 8; c++) {
    b[1][c] = { type: "P", color: "b" };
    b[6][c] = { type: "P", color: "w" };
  }
  return b;
}

// ── COPY BOARD ──
function copyBoard(b: Board): Board {
  return b.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

// ── CASTLE RIGHTS ──
type CastleRights = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };

// ── APPLY MOVE ──
function applyMove(
  board: Board,
  from: Square,
  to: Square,
  enPassant: Square | null,
  castleRights: CastleRights,
  promoteTo: PieceType = "Q",
): { board: Board; enPassant: Square | null; castleRights: CastleRights } {
  const b = copyBoard(board);
  const piece = b[from.row][from.col]!;
  let newEP: Square | null = null;
  const cr = { ...castleRights };

  // En passant capture
  if (
    piece.type === "P" &&
    enPassant &&
    to.row === enPassant.row &&
    to.col === enPassant.col
  ) {
    const capRow = piece.color === "w" ? to.row + 1 : to.row - 1;
    b[capRow][to.col] = null;
  }

  // Castling
  if (piece.type === "K") {
    if (piece.color === "w") {
      cr.wK = false;
      cr.wQ = false;
    } else {
      cr.bK = false;
      cr.bQ = false;
    }
    const colDiff = to.col - from.col;
    if (Math.abs(colDiff) === 2) {
      if (colDiff > 0) {
        b[from.row][5] = b[from.row][7];
        b[from.row][7] = null;
      } else {
        b[from.row][3] = b[from.row][0];
        b[from.row][0] = null;
      }
    }
  }

  // Update castle rights for rook moves
  if (piece.type === "R") {
    if (from.row === 7 && from.col === 0) cr.wQ = false;
    if (from.row === 7 && from.col === 7) cr.wK = false;
    if (from.row === 0 && from.col === 0) cr.bQ = false;
    if (from.row === 0 && from.col === 7) cr.bK = false;
  }

  // Pawn double push → set en passant
  if (piece.type === "P" && Math.abs(to.row - from.row) === 2) {
    newEP = { row: (from.row + to.row) / 2, col: from.col };
  }

  b[to.row][to.col] = b[from.row][from.col];
  b[from.row][from.col] = null;

  // Promotion
  if (piece.type === "P" && (to.row === 0 || to.row === 7)) {
    b[to.row][to.col] = { type: promoteTo, color: piece.color };
  }

  return { board: b, enPassant: newEP, castleRights: cr };
}

// ── RAW MOVES (no check filtering) ──
function rawMoves(
  board: Board,
  sq: Square,
  enPassant: Square | null,
  castleRights: CastleRights,
): Square[] {
  const piece = board[sq.row][sq.col];
  if (!piece) return [];
  const moves: Square[] = [];
  const { row, col } = sq;
  const c = piece.color;
  const opp = c === "w" ? "b" : "w";

  const inBounds = (r: number, cc: number) =>
    r >= 0 && r < 8 && cc >= 0 && cc < 8;
  const isEmpty = (r: number, cc: number) =>
    inBounds(r, cc) && board[r][cc] === null;
  const isOpp = (r: number, cc: number) =>
    inBounds(r, cc) && board[r][cc]?.color === opp;
  const canGo = (r: number, cc: number) => isEmpty(r, cc) || isOpp(r, cc);

  const slide = (dirs: [number, number][]) => {
    for (const [dr, dc] of dirs) {
      let r = row + dr,
        cc = col + dc;
      while (inBounds(r, cc)) {
        if (board[r][cc]) {
          if (board[r][cc]!.color === opp) moves.push({ row: r, col: cc });
          break;
        }
        moves.push({ row: r, col: cc });
        r += dr;
        cc += dc;
      }
    }
  };

  switch (piece.type) {
    case "P": {
      const dir = c === "w" ? -1 : 1;
      const startRow = c === "w" ? 6 : 1;
      if (isEmpty(row + dir, col)) {
        moves.push({ row: row + dir, col });
        if (row === startRow && isEmpty(row + 2 * dir, col))
          moves.push({ row: row + 2 * dir, col });
      }
      for (const dc of [-1, 1]) {
        if (isOpp(row + dir, col + dc))
          moves.push({ row: row + dir, col: col + dc });
        if (
          enPassant &&
          row + dir === enPassant.row &&
          col + dc === enPassant.col
        )
          moves.push({ row: row + dir, col: col + dc });
      }
      break;
    }
    case "N":
      for (const [dr, dc] of [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ])
        if (canGo(row + dr, col + dc))
          moves.push({ row: row + dr, col: col + dc });
      break;
    case "B":
      slide([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]);
      break;
    case "R":
      slide([
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);
      break;
    case "Q":
      slide([
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);
      break;
    case "K":
      for (const [dr, dc] of [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ])
        if (canGo(row + dr, col + dc))
          moves.push({ row: row + dr, col: col + dc });
      // Castling
      if (c === "w" && row === 7) {
        if (castleRights.wK && isEmpty(7, 5) && isEmpty(7, 6))
          moves.push({ row: 7, col: 6 });
        if (castleRights.wQ && isEmpty(7, 3) && isEmpty(7, 2) && isEmpty(7, 1))
          moves.push({ row: 7, col: 2 });
      }
      if (c === "b" && row === 0) {
        if (castleRights.bK && isEmpty(0, 5) && isEmpty(0, 6))
          moves.push({ row: 0, col: 6 });
        if (castleRights.bQ && isEmpty(0, 3) && isEmpty(0, 2) && isEmpty(0, 1))
          moves.push({ row: 0, col: 2 });
      }
      break;
  }
  return moves;
}

// ── IS SQUARE ATTACKED ──
function isAttacked(board: Board, sq: Square, byColor: Color): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === byColor) {
        const ms = rawMoves(board, { row: r, col: c }, null, {
          wK: false,
          wQ: false,
          bK: false,
          bQ: false,
        });
        if (ms.some((m) => m.row === sq.row && m.col === sq.col)) return true;
      }
    }
  return false;
}

// ── FIND KING ──
function findKing(board: Board, color: Color): Square | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === "K" && board[r][c]?.color === color)
        return { row: r, col: c };
  return null;
}

// ── LEGAL MOVES ──
function legalMoves(
  board: Board,
  sq: Square,
  enPassant: Square | null,
  castleRights: CastleRights,
): Square[] {
  const piece = board[sq.row][sq.col];
  if (!piece) return [];
  const raw = rawMoves(board, sq, enPassant, castleRights);
  const legal: Square[] = [];

  for (const to of raw) {
    const { board: nb } = applyMove(board, sq, to, enPassant, castleRights);
    const king = findKing(nb, piece.color);
    if (king && !isAttacked(nb, king, piece.color === "w" ? "b" : "w")) {
      // Extra castling check — can't castle through check
      if (piece.type === "K" && Math.abs(to.col - sq.col) === 2) {
        const midCol = (sq.col + to.col) / 2;
        const mid = { row: sq.row, col: midCol };
        const opp = piece.color === "w" ? "b" : "w";
        const kingOrig = { row: sq.row, col: sq.col };
        if (isAttacked(board, kingOrig, opp) || isAttacked(board, mid, opp))
          continue;
      }
      legal.push(to);
    }
  }
  return legal;
}

// ── ALL LEGAL MOVES FOR COLOR ──
function allLegalMoves(
  board: Board,
  color: Color,
  enPassant: Square | null,
  castleRights: CastleRights,
) {
  const moves: { from: Square; to: Square }[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color)
        for (const to of legalMoves(
          board,
          { row: r, col: c },
          enPassant,
          castleRights,
        ))
          moves.push({ from: { row: r, col: c }, to });
  return moves;
}

// ── GAME STATUS ──
function getStatus(
  board: Board,
  turn: Color,
  enPassant: Square | null,
  castleRights: CastleRights,
): GameStatus {
  const moves = allLegalMoves(board, turn, enPassant, castleRights);
  const king = findKing(board, turn);
  const inCheck = king
    ? isAttacked(board, king, turn === "w" ? "b" : "w")
    : false;
  if (moves.length === 0) return inCheck ? "checkmate" : "stalemate";
  if (inCheck) return "check";
  return "playing";
}

// ── EVALUATION ──
// Piece-square tables for positional evaluation
const PST: Record<PieceType, number[][]> = {
  P: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  N: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  B: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  R: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  Q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  K: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
};

function evaluate(board: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const pstRow = p.color === "w" ? r : 7 - r;
      const val = PIECE_VALUES[p.type] + PST[p.type][pstRow][c];
      score += p.color === "w" ? val : -val;
    }
  return score;
}

// ── MINIMAX WITH ALPHA-BETA ──
function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  enPassant: Square | null,
  castleRights: CastleRights,
): number {
  const color: Color = maximizing ? "w" : "b";
  const moves = allLegalMoves(board, color, enPassant, castleRights);

  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) {
      const king = findKing(board, color);
      if (king && isAttacked(board, king, maximizing ? "b" : "w"))
        return maximizing ? -99999 : 99999;
      return 0;
    }
    return evaluate(board);
  }

  if (maximizing) {
    let best = -Infinity;
    for (const { from, to } of moves) {
      const {
        board: nb,
        enPassant: nep,
        castleRights: ncr,
      } = applyMove(board, from, to, enPassant, castleRights);
      best = Math.max(
        best,
        minimax(nb, depth - 1, alpha, beta, false, nep, ncr),
      );
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const { from, to } of moves) {
      const {
        board: nb,
        enPassant: nep,
        castleRights: ncr,
      } = applyMove(board, from, to, enPassant, castleRights);
      best = Math.min(
        best,
        minimax(nb, depth - 1, alpha, beta, true, nep, ncr),
      );
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ── BOT MOVE ──
function getBotMove(
  board: Board,
  color: Color,
  difficulty: Difficulty,
  enPassant: Square | null,
  castleRights: CastleRights,
): { from: Square; to: Square } | null {
  const moves = allLegalMoves(board, color, enPassant, castleRights);
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (difficulty === "medium") {
    // 40% random, 60% 2-ply
    if (Math.random() < 0.4)
      return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = difficulty === "hard" ? 3 : 2;
  const maximizing = color === "w";
  let bestScore = maximizing ? -Infinity : Infinity;
  let bestMove = moves[0];

  for (const { from, to } of moves) {
    const {
      board: nb,
      enPassant: nep,
      castleRights: ncr,
    } = applyMove(board, from, to, enPassant, castleRights);
    const score = minimax(
      nb,
      depth - 1,
      -Infinity,
      Infinity,
      !maximizing,
      nep,
      ncr,
    );
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = { from, to };
    }
  }
  return bestMove;
}

// ── COMPONENT ──
type Props = { onBack?: () => void };

export default function Chess({ onBack }: Props) {
  const [screen, setScreen] = useState<"setup" | "game">("setup");
  const [gameMode, setGameMode] = useState<GameMode>("vs-bot");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<Color>("w");

  const [board, setBoard] = useState<Board>(initBoard);
  const [turn, setTurn] = useState<Color>("w");
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalSquares, setLegalSquares] = useState<Square[]>([]);
  const [enPassant, setEnPassant] = useState<Square | null>(null);
  const [castleRights, setCastleRights] = useState<CastleRights>({
    wK: true,
    wQ: true,
    bK: true,
    bQ: true,
  });
  const [status, setStatus] = useState<GameStatus>("playing");
  const [promotion, setPromotion] = useState<PromotionState>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null,
  );
  const [thinking, setThinking] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [moveLog, setMoveLog] = useState<string[]>([]);
  const [captured, setCaptured] = useState<{ w: string[]; b: string[] }>({
    w: [],
    b: [],
  });
  const [timeControl, setTimeControl] = useState<TimeControl>("none");
  const [timeLeft, setTimeLeft] = useState<{ w: number; b: number }>({
    w: 0,
    b: 0,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flipped = gameMode === "vs-bot" && playerColor === "b";

  function startGame() {
    setBoard(initBoard());
    setTurn("w");
    setSelected(null);
    setLegalSquares([]);
    setEnPassant(null);
    setCastleRights({ wK: true, wQ: true, bK: true, bQ: true });
    setStatus("playing");
    setPromotion(null);
    setLastMove(null);
    setMoveCount(0);
    setMoveLog([]);
    setCaptured({ w: [], b: [] });
    const secs = TIME_CONTROLS[timeControl].seconds;
    setTimeLeft({ w: secs, b: secs });
    setThinking(false);
    setScreen("game");
  }

  function handleSquareClick(row: number, col: number) {
    if (status === "checkmate" || status === "stalemate") return;
    if (promotion) return;
    if (thinking) return;

    // In vs-bot, only allow player's color
    if (gameMode === "vs-bot" && turn !== playerColor) return;

    const sq: Square = { row, col };
    const piece = board[row][col];

    if (selected) {
      const isLegal = legalSquares.some((m) => m.row === row && m.col === col);
      if (isLegal) {
        // Check for pawn promotion
        const movingPiece = board[selected.row][selected.col]!;
        if (movingPiece.type === "P" && (row === 0 || row === 7)) {
          setPromotion({ from: selected, to: sq });
          setSelected(null);
          setLegalSquares([]);
          return;
        }
        executeMove(selected, sq);
        return;
      }
      // Clicking own piece → select it
      if (piece && piece.color === turn) {
        setSelected(sq);
        setLegalSquares(legalMoves(board, sq, enPassant, castleRights));
        return;
      }
      setSelected(null);
      setLegalSquares([]);
      return;
    }

    if (piece && piece.color === turn) {
      setSelected(sq);
      setLegalSquares(legalMoves(board, sq, enPassant, castleRights));
    }
  }

  function executeMove(from: Square, to: Square, promoteTo: PieceType = "Q") {
    const {
      board: nb,
      enPassant: nep,
      castleRights: ncr,
    } = applyMove(board, from, to, enPassant, castleRights, promoteTo);
    const nextTurn: Color = turn === "w" ? "b" : "w";
    const newStatus = getStatus(nb, nextTurn, nep, ncr);

    // Track captured piece
    const capturedPiece = board[to.row][to.col];
    // En passant capture
    const movingPiece = board[from.row][from.col]!;
    let epCaptured: Piece | null = null;
    if (
      movingPiece.type === "P" &&
      enPassant &&
      to.row === enPassant.row &&
      to.col === enPassant.col
    ) {
      const capRow = movingPiece.color === "w" ? to.row + 1 : to.row - 1;
      epCaptured = board[capRow][to.col];
    }
    const actualCaptured = capturedPiece || epCaptured;
    if (actualCaptured) {
      setCaptured((prev) => ({
        ...prev,
        [turn]: [
          ...prev[turn],
          UNICODE[`${actualCaptured.color}${actualCaptured.type}`],
        ],
      }));
    }

    // Move log
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
    const fromNotation = files[from.col] + ranks[from.row];
    const toNotation = files[to.col] + ranks[to.row];
    const pieceSymbol = movingPiece.type === "P" ? "" : movingPiece.type;
    const captureSymbol = actualCaptured ? "x" : "";
    const checkSymbol =
      newStatus === "checkmate" ? "#" : newStatus === "check" ? "+" : "";
    const notation = `${pieceSymbol}${fromNotation}${captureSymbol}${toNotation}${checkSymbol}`;
    setMoveLog((prev) => [...prev, notation]);

    setBoard(nb);
    setTurn(nextTurn);
    setEnPassant(nep);
    setCastleRights(ncr);
    setStatus(newStatus);
    setLastMove({ from, to });
    setSelected(null);
    setLegalSquares([]);
    setMoveCount((c) => c + 1);
  }

  function handlePromotion(pieceType: PieceType) {
    if (!promotion) return;
    executeMove(promotion.from, promotion.to, pieceType);
    setPromotion(null);
  }

  // Bot move effect
  useEffect(() => {
    if (screen !== "game") return;
    if (gameMode !== "vs-bot") return;
    if (turn === playerColor) return;
    if (status === "checkmate" || status === "stalemate") return;

    setThinking(true);
    const timer = setTimeout(
      () => {
        const move = getBotMove(
          board,
          turn,
          difficulty,
          enPassant,
          castleRights,
        );
        if (move) {
          // Check for bot pawn promotion (always queen)
          const piece = board[move.from.row][move.from.col];
          if (piece?.type === "P" && (move.to.row === 0 || move.to.row === 7)) {
            executeMove(move.from, move.to, "Q");
          } else {
            executeMove(move.from, move.to);
          }
        }
        setThinking(false);
      },
      difficulty === "hard" ? 800 : 400,
    );

    return () => clearTimeout(timer);
  }, [turn, screen, gameMode]);

  // Timer tick
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (screen !== "game") return;
    if (TIME_CONTROLS[timeControl].seconds === 0) return;
    if (status === "checkmate" || status === "stalemate") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = { ...prev, [turn]: prev[turn] - 1 };
        if (next[turn] <= 0) {
          clearInterval(timerRef.current!);
          setStatus("checkmate"); // flag as loss on timeout
          return { ...prev, [turn]: 0 };
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [turn, screen, status, timeControl, thinking]);

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const displayBoard = flipped
    ? [...board].reverse().map((row) => [...row].reverse())
    : board;

  const toDisplayCoords = (row: number, col: number) =>
    flipped ? { row: 7 - row, col: 7 - col } : { row, col };

  const isSelected = (row: number, col: number) => {
    if (!selected) return false;
    const { row: dr, col: dc } = toDisplayCoords(row, col);
    return selected.row === dr && selected.col === dc;
  };

  const isLegalTarget = (row: number, col: number) => {
    const { row: dr, col: dc } = toDisplayCoords(row, col);
    return legalSquares.some((m) => m.row === dr && m.col === dc);
  };

  const isLastMove = (row: number, col: number) => {
    if (!lastMove) return false;
    const { row: dr, col: dc } = toDisplayCoords(row, col);
    return (
      (lastMove.from.row === dr && lastMove.from.col === dc) ||
      (lastMove.to.row === dr && lastMove.to.col === dc)
    );
  };

  const isInCheck = (row: number, col: number) => {
    const { row: dr, col: dc } = toDisplayCoords(row, col);
    const piece = board[dr][dc];
    if (!piece || piece.type !== "K") return false;
    if (status !== "check" && status !== "checkmate") return false;
    return piece.color === turn;
  };

  // ── SETUP SCREEN ──
  if (screen === "setup") {
    return (
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <h1 className="font-serif italic text-2xl text-[#111010] mb-1">
            Chess
          </h1>
          <p className="text-sm text-[#9a8f7e]">Set up your game.</p>
        </div>

        <div className="bg-white rounded-3xl border border-[#f0ece8] p-6 flex flex-col gap-6">
          {/* Game mode */}
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#b09880] mb-3">
              Game Mode
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["vs-bot", "🤖 vs Tyunnie"],
                  ["2-player", "👥 2 Players"],
                ] as [GameMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setGameMode(mode)}
                  className={`py-3 rounded-2xl text-sm font-bold transition-all ${gameMode === mode ? "bg-[#f97316] text-white" : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty — only for vs-bot */}
          {gameMode === "vs-bot" && (
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#b09880] mb-3">
                Difficulty
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["easy", "Easy"],
                    ["medium", "Medium"],
                    ["hard", "Hard"],
                  ] as [Difficulty, string][]
                ).map(([d, label]) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-3 rounded-2xl text-sm font-bold transition-all ${difficulty === d ? "bg-[#f97316] text-white" : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color — only for vs-bot */}
          {gameMode === "vs-bot" && (
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#b09880] mb-3">
                Play As
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["w", "♔ White"],
                    ["b", "♚ Black"],
                  ] as [Color, string][]
                ).map(([color, label]) => (
                  <button
                    key={color}
                    onClick={() => setPlayerColor(color)}
                    className={`py-3 rounded-2xl text-sm font-bold transition-all ${playerColor === color ? "bg-[#f97316] text-white" : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time Control */}
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#b09880] mb-3">
              Time Control
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                Object.entries(TIME_CONTROLS) as [
                  TimeControl,
                  (typeof TIME_CONTROLS)[TimeControl],
                ][]
              ).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setTimeControl(key)}
                  className={`py-2.5 px-3 rounded-2xl text-left transition-all ${timeControl === key ? "bg-[#f97316] text-white" : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]"}`}
                >
                  <div className="text-xs font-bold">{val.label}</div>
                  <div
                    className={`text-[9px] font-mono ${timeControl === key ? "text-white/70" : "text-[#c5bdb0]"}`}
                  >
                    {val.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 rounded-2xl bg-[#f97316] text-white font-bold text-sm hover:bg-[#c2500f] transition-all shadow-sm"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ──
  const statusMsg = () => {
    if (status === "checkmate") {
      const winner =
        turn === "w"
          ? gameMode === "vs-bot"
            ? "Tyunnie wins! 🤖"
            : "Black wins!"
          : gameMode === "vs-bot"
            ? "You win! 🎉"
            : "White wins!";
      return winner;
    }
    if (status === "stalemate") return "Stalemate — Draw!";
    if (status === "check")
      return `${turn === "w" ? "White" : "Black"} is in check!`;
    if (thinking) return "Tyunnie is thinking...";
    return `${turn === "w" ? "White" : "Black"} to move`;
  };

  return (
    <div className="flex flex-col items-center gap-4 pb-8">
      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between">
        <button
          onClick={() => setScreen("setup")}
          className="flex items-center gap-2 text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest"
        >
          ← New Game
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#b09880]">
            Move {moveCount}
          </span>
          {gameMode === "vs-bot" && (
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#f97316] bg-[#fff0e6] border border-[#fed7aa] px-2 py-0.5 rounded-full">
              {difficulty}
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <div
        className={`px-4 py-2 rounded-2xl text-xs font-bold font-mono transition-all ${
          status === "checkmate"
            ? "bg-red-50 border border-red-200 text-red-600"
            : status === "stalemate"
              ? "bg-[#f0ece8] border border-[#e8e2d8] text-[#9a8f7e]"
              : status === "check"
                ? "bg-orange-50 border border-orange-200 text-[#f97316]"
                : thinking
                  ? "bg-[#fff0e6] border border-[#fed7aa] text-[#f97316]"
                  : "bg-white border border-[#f0ece8] text-[#9a8f7e]"
        }`}
      >
        {statusMsg()}
      </div>

      {/* Clocks */}
      {TIME_CONTROLS[timeControl].seconds > 0 && (
        <div className="w-full max-w-sm flex gap-3">
          {(["b", "w"] as Color[]).map((c) => (
            <div
              key={c}
              className={`flex-1 rounded-2xl px-4 py-2.5 flex items-center justify-between transition-all ${
                turn === c && status !== "checkmate" && status !== "stalemate"
                  ? "bg-[#f97316] text-white"
                  : "bg-white border border-[#f0ece8] text-[#9a8f7e]"
              }`}
            >
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-70">
                {c === "w" ? "White" : "Black"}
              </span>
              <span
                className={`font-mono font-bold text-lg tabular-nums ${
                  timeLeft[c] <= 10 && turn === c
                    ? "text-red-400 animate-pulse"
                    : ""
                }`}
              >
                {formatTime(timeLeft[c])}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Board */}
      <div className="relative select-none touch-none">
        {/* Rank labels */}
        <div className="absolute -left-5 top-0 h-full flex flex-col justify-around">
          {(flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]).map(
            (n) => (
              <span
                key={n}
                className="text-[9px] font-mono text-[#b09880] w-4 text-center"
              >
                {n}
              </span>
            ),
          )}
        </div>
        {/* File labels */}
        <div className="absolute -bottom-5 left-0 w-full flex justify-around">
          {(flipped
            ? ["h", "g", "f", "e", "d", "c", "b", "a"]
            : ["a", "b", "c", "d", "e", "f", "g", "h"]
          ).map((l) => (
            <span
              key={l}
              className="text-[9px] font-mono text-[#b09880] w-8 text-center"
            >
              {l}
            </span>
          ))}
        </div>

        <div
          className="border-2 border-[#e8e2d8] rounded-xl overflow-hidden shadow-md"
          style={{ width: "min(80vw, 400px)", height: "min(80vw, 400px)" }}
        >
          {displayBoard.map((rowPieces, displayRow) => (
            <div key={displayRow} className="flex" style={{ height: "12.5%" }}>
              {rowPieces.map((piece, displayCol) => {
                const isLight = (displayRow + displayCol) % 2 === 0;
                const sel = isSelected(displayRow, displayCol);
                const legal = isLegalTarget(displayRow, displayCol);
                const lm = isLastMove(displayRow, displayCol);
                const check = isInCheck(displayRow, displayCol);
                const { row: actualRow, col: actualCol } = toDisplayCoords(
                  displayRow,
                  displayCol,
                );

                return (
                  <div
                    key={displayCol}
                    onClick={() => handleSquareClick(actualRow, actualCol)}
                    className="relative flex items-center justify-center cursor-pointer transition-colors"
                    style={{
                      width: "12.5%",
                      backgroundColor: check
                        ? "#ff6b6b"
                        : sel
                          ? "#f97316"
                          : lm
                            ? isLight
                              ? "#f9d8a8"
                              : "#e8a855"
                            : isLight
                              ? "#f5ede4"
                              : "#c8a47e",
                    }}
                  >
                    {/* Legal move indicator */}
                    {legal && (
                      <div
                        className={`absolute inset-0 flex items-center justify-center pointer-events-none`}
                      >
                        {piece ? (
                          <div className="absolute inset-0 border-4 border-[#f97316] rounded-sm opacity-60" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-[#f97316] opacity-50" />
                        )}
                      </div>
                    )}
                    {/* Piece */}
                    {piece && (
                      <span
                        className="z-10 leading-none pointer-events-none select-none"
                        style={{
                          fontSize: "min(7vw, 36px)",
                          filter:
                            piece.color === "w"
                              ? "drop-shadow(0 1px 2px rgba(0,0,0,0.3))"
                              : "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                          color: piece.color === "w" ? "#ffffff" : "#1a1208",
                          WebkitTextStroke:
                            piece.color === "w"
                              ? "1px #7a5c3a"
                              : "1px rgba(255,255,255,0.2)",
                        }}
                      >
                        {UNICODE[`${piece.color}${piece.type}`]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Promotion modal */}
      {promotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 border border-[#f0ece8] shadow-2xl">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#b09880] mb-4 text-center">
              Promote Pawn
            </p>
            <div className="flex gap-3">
              {(["Q", "R", "B", "N"] as PieceType[]).map((pt) => (
                <button
                  key={pt}
                  onClick={() => handlePromotion(pt)}
                  className="w-14 h-14 rounded-2xl border border-[#e8e2d8] hover:border-[#f97316] hover:bg-orange-50 transition-all flex items-center justify-center text-3xl"
                >
                  {UNICODE[`${turn}${pt}`]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Captured pieces + move log */}
      <div className="w-full max-w-sm flex flex-col gap-3 mt-2">
        {/* Captured by White */}
        <div className="bg-white rounded-2xl border border-[#f0ece8] px-4 py-3">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880] mb-1.5">
            White captured
          </p>
          <div className="flex flex-wrap gap-0.5 min-h-5">
            {captured.w.length === 0 ? (
              <span className="text-[10px] text-[#c5bdb0] font-mono">—</span>
            ) : (
              captured.w.map((p, i) => (
                <span
                  key={i}
                  className="text-lg leading-none"
                  style={{ color: "#1a1208" }}
                >
                  {p}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Captured by Black */}
        <div className="bg-white rounded-2xl border border-[#f0ece8] px-4 py-3">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880] mb-1.5">
            Black captured
          </p>
          <div className="flex flex-wrap gap-0.5 min-h-5">
            {captured.b.length === 0 ? (
              <span className="text-[10px] text-[#c5bdb0] font-mono">—</span>
            ) : (
              captured.b.map((p, i) => (
                <span
                  key={i}
                  className="text-lg leading-none"
                  style={{ color: "#ffffff", WebkitTextStroke: "1px #7a5c3a" }}
                >
                  {p}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Move log */}
        {moveLog.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#f0ece8] px-4 py-3">
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880] mb-2">
              Move Log
            </p>
            {/* Last 3 moves visible, rest scrollable */}
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: Math.ceil(moveLog.length / 2) })
                .slice(-3)
                .map((_, idx) => {
                  const i =
                    Math.max(0, Math.ceil(moveLog.length / 2) - 3) + idx;
                  return (
                    <div key={i} className="flex gap-4 text-[11px] font-mono">
                      <span className="text-[#c5bdb0] w-6 shrink-0">
                        {i + 1}.
                      </span>
                      <span className="text-[#9a8f7e] flex-1">
                        {moveLog[i * 2]}
                      </span>
                      <span className="text-[#9a8f7e] flex-1">
                        {moveLog[i * 2 + 1] ?? ""}
                      </span>
                    </div>
                  );
                })}
            </div>
            {/* Full scrollable history */}
            {moveLog.length > 6 && (
              <details className="mt-2">
                <summary className="text-[9px] font-mono text-[#c5bdb0] cursor-pointer hover:text-[#f97316] transition-colors">
                  Show all {Math.ceil(moveLog.length / 2)} moves
                </summary>
                <div
                  className="mt-2 max-h-40 overflow-y-auto"
                  style={{ scrollbarWidth: "thin" }}
                >
                  <div className="flex flex-col gap-0.5">
                    {Array.from({ length: Math.ceil(moveLog.length / 2) }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className="flex gap-4 text-[11px] font-mono"
                        >
                          <span className="text-[#c5bdb0] w-6 shrink-0">
                            {i + 1}.
                          </span>
                          <span className="text-[#9a8f7e] flex-1">
                            {moveLog[i * 2]}
                          </span>
                          <span className="text-[#9a8f7e] flex-1">
                            {moveLog[i * 2 + 1] ?? ""}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Game over buttons — spaced below */}
      {(status === "checkmate" || status === "stalemate") && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={startGame}
            className="px-6 py-3 rounded-2xl bg-[#f97316] text-white font-bold text-sm hover:bg-[#c2500f] transition-all"
          >
            Play Again
          </button>
          <button
            onClick={() => setScreen("setup")}
            className="px-6 py-3 rounded-2xl border border-[#e8e2d8] text-[#9a8f7e] font-bold text-sm hover:border-[#f97316] hover:text-[#f97316] transition-all"
          >
            Change Settings
          </button>
        </div>
      )}
    </div>
  );
}
