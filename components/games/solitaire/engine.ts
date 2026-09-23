// components/games/solitaire/engine.ts
// Pure Klondike. Draw-1 or draw-3, unlimited passes through the stock,
// unlimited undo (each undo counts as a move), auto-complete once nothing is
// face-down and the stock is spent. Deals are random and not checked for
// solvability — the rules sheet says so; a stuck deal is part of the game.

import { type Card, SUIT_COLOR, valueIdx, createDeck, shuffle } from "../cards";

export type Draw = 1 | 3;
export type Pile = "stock" | "waste" | "foundation" | "tableau";
export type Status = "playing" | "won";

export type Piles = { stock: Card[]; waste: Card[]; foundation: Card[][]; tableau: Card[][] };

export type Game = Piles & {
  draw: Draw;
  moves: number;
  seconds: number;
  /** Times the stock has been turned over. */
  passes: number;
  status: Status;
  undo: Piles[];
  tick: number;
};

export type ModeStats = { games: number; wins: number; bestTime: number; fewestMoves: number };
export type Stats = { games: number; wins: number; bestTime: number; streak: number; bestStreak: number; draw1: ModeStats; draw3: ModeStats };
const M0: ModeStats = { games: 0, wins: 0, bestTime: 0, fewestMoves: 0 };
export const EMPTY_STATS: Stats = { games: 0, wins: 0, bestTime: 0, streak: 0, bestStreak: 0, draw1: { ...M0 }, draw3: { ...M0 } };

export function deal(draw: Draw, rng: () => number = Math.random): Game {
  const deck = shuffle(createDeck(), rng);
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let idx = 0;
  for (let col = 0; col < 7; col++) for (let row = 0; row <= col; row++) tableau[col].push({ ...deck[idx++], faceUp: row === col });
  return {
    draw, tableau,
    stock: deck.slice(idx).map((c) => ({ ...c, faceUp: false })),
    waste: [], foundation: [[], [], [], []],
    moves: 0, seconds: 0, passes: 0, status: "playing", undo: [], tick: 0,
  };
}

const piles = (g: Game): Piles => ({ stock: g.stock, waste: g.waste, foundation: g.foundation, tableau: g.tableau });

function commit(g: Game, next: Partial<Piles>, countMove = true): Game {
  const out: Game = { ...g, ...next, undo: [...g.undo, piles(g)], moves: g.moves + (countMove ? 1 : 0), tick: g.tick + 1 };
  if (out.foundation.every((f) => f.length === 13)) out.status = "won";
  return out;
}

export function canToFoundation(card: Card, pile: Card[]): boolean {
  if (!pile.length) return card.value === "A";
  const top = pile[pile.length - 1];
  return top.suit === card.suit && valueIdx(card.value) === valueIdx(top.value) + 1;
}

export function canToTableau(card: Card, pile: Card[]): boolean {
  if (!pile.length) return card.value === "K";
  const top = pile[pile.length - 1];
  return top.faceUp && SUIT_COLOR[card.suit] !== SUIT_COLOR[top.suit] && valueIdx(card.value) === valueIdx(top.value) - 1;
}

/** Turn `draw` cards from the stock, or recycle the waste when the stock is out. */
export function drawStock(g: Game): Game {
  if (g.status !== "playing") return g;
  if (!g.stock.length) {
    if (!g.waste.length) return g;
    return { ...commit(g, { stock: g.waste.map((c) => ({ ...c, faceUp: false })).reverse(), waste: [] }), passes: g.passes + 1 };
  }
  const n = Math.min(g.draw, g.stock.length);
  const stock = g.stock.slice(0, g.stock.length - n);
  const drawn = g.stock.slice(g.stock.length - n).reverse().map((c) => ({ ...c, faceUp: true }));
  return commit(g, { stock, waste: [...g.waste, ...drawn] });
}

export type From = { pile: "waste" } | { pile: "foundation"; index: number } | { pile: "tableau"; index: number; card: number };
export type To = { pile: "foundation"; index: number } | { pile: "tableau"; index: number };

/** The cards a grab at `from` would lift, or null when nothing can be lifted there. */
export function liftable(g: Game, from: From): Card[] | null {
  if (from.pile === "waste") return g.waste.length ? [g.waste[g.waste.length - 1]] : null;
  if (from.pile === "foundation") { const f = g.foundation[from.index]; return f.length ? [f[f.length - 1]] : null; }
  const col = g.tableau[from.index];
  if (from.card < 0 || from.card >= col.length || !col[from.card].faceUp) return null;
  return col.slice(from.card);
}

export function canMove(g: Game, from: From, to: To): boolean {
  const cards = liftable(g, from);
  if (!cards) return false;
  if (to.pile === "foundation") return cards.length === 1 && canToFoundation(cards[0], g.foundation[to.index]);
  if (from.pile === "tableau" && from.index === to.index) return false;
  return canToTableau(cards[0], g.tableau[to.index]);
}

export function move(g: Game, from: From, to: To): Game {
  if (g.status !== "playing" || !canMove(g, from, to)) return g;
  const cards = liftable(g, from)!;
  const next: Piles = { stock: g.stock, waste: g.waste, foundation: g.foundation.map((f) => f), tableau: g.tableau.map((t) => t) };
  if (from.pile === "waste") next.waste = g.waste.slice(0, -1);
  else if (from.pile === "foundation") next.foundation[from.index] = g.foundation[from.index].slice(0, -1);
  else {
    const col = g.tableau[from.index].slice(0, from.card);
    // Expose the card left on top.
    if (col.length && !col[col.length - 1].faceUp) col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
    next.tableau[from.index] = col;
  }
  if (to.pile === "foundation") next.foundation[to.index] = [...g.foundation[to.index], cards[0]];
  else next.tableau[to.index] = [...next.tableau[to.index], ...cards];
  return commit(g, next);
}

/** Flip a face-down top card (only happens after a partial undo). */
export function flipTop(g: Game, col: number): Game {
  const c = g.tableau[col];
  if (g.status !== "playing" || !c.length || c[c.length - 1].faceUp) return g;
  const tableau = g.tableau.map((t) => t);
  tableau[col] = [...c.slice(0, -1), { ...c[c.length - 1], faceUp: true }];
  return commit(g, { tableau }, false);
}

/** Send the card at `from` to whichever foundation takes it — the double-click. */
export function toFoundation(g: Game, from: From): Game {
  const cards = liftable(g, from);
  if (!cards || cards.length !== 1) return g;
  for (let i = 0; i < 4; i++) if (canToFoundation(cards[0], g.foundation[i])) return move(g, from, { pile: "foundation", index: i });
  return g;
}

export function undo(g: Game): Game {
  if (g.status !== "playing" || !g.undo.length) return g;
  const prev = g.undo[g.undo.length - 1];
  return { ...g, ...prev, undo: g.undo.slice(0, -1), moves: g.moves + 1, tick: g.tick + 1 };
}

/** Nothing hidden, nothing left to draw: the rest is mechanical. */
export function canAutoComplete(g: Game): boolean {
  return g.status === "playing" && !g.stock.length && g.waste.length <= 1 && g.tableau.every((t) => t.every((c) => c.faceUp)) && !g.foundation.every((f) => f.length === 13);
}

/** One card up to a foundation, lowest rank first so it always makes progress. */
export function autoCompleteStep(g: Game): Game {
  if (!canAutoComplete(g)) return g;
  let best: { from: From; rank: number } | null = null;
  const consider = (from: From, card: Card) => {
    const r = valueIdx(card.value);
    if (g.foundation.some((f) => canToFoundation(card, f)) && (!best || r < best.rank)) best = { from, rank: r };
  };
  if (g.waste.length) consider({ pile: "waste" }, g.waste[g.waste.length - 1]);
  g.tableau.forEach((t, i) => { if (t.length) consider({ pile: "tableau", index: i, card: t.length - 1 }, t[t.length - 1]); });
  return best ? toFoundation(g, (best as { from: From }).from) : g;
}

export function tickSecond(g: Game): Game {
  return g.status === "playing" ? { ...g, seconds: g.seconds + 1 } : g;
}

export function recordResult(s: Stats, g: Game, abandoned = false): Stats {
  const won = g.status === "won" && !abandoned;
  const next: Stats = { ...s, games: s.games + 1, wins: s.wins + (won ? 1 : 0), streak: won ? s.streak + 1 : 0 };
  next.bestStreak = Math.max(next.bestStreak, next.streak);
  const key = g.draw === 1 ? "draw1" : "draw3";
  const m = { ...s[key], games: s[key].games + 1 };
  if (won) {
    m.wins++;
    m.bestTime = m.bestTime ? Math.min(m.bestTime, g.seconds) : g.seconds;
    m.fewestMoves = m.fewestMoves ? Math.min(m.fewestMoves, g.moves) : g.moves;
    next.bestTime = s.bestTime ? Math.min(s.bestTime, g.seconds) : g.seconds;
  }
  next[key] = m;
  return next;
}
