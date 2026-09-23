import { describe, it, expect } from "vitest";
import * as E from "./engine";
import { type Card, type Suit, createDeck } from "../cards";

const card = (value: string, suit: Suit, faceUp = true): Card => ({ value, suit, faceUp });
const lcg = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

describe("deal", () => {
  it("lays 28 on the tableau, 24 in the stock, only column tops face up", () => {
    const g = E.deal(1, lcg(1));
    expect(g.tableau.map((t) => t.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(g.stock.length).toBe(24);
    for (const col of g.tableau) col.forEach((c, i) => expect(c.faceUp).toBe(i === col.length - 1));
    const all = [...g.stock, ...g.tableau.flat()];
    expect(new Set(all.map((c) => c.value + c.suit)).size).toBe(52);
  });
});

describe("stock", () => {
  it("draw-1 turns one card; draw-3 turns three, then the remainder", () => {
    let g = E.deal(1, lcg(2));
    g = E.drawStock(g);
    expect(g.waste.length).toBe(1);
    expect(g.waste[0].faceUp).toBe(true);
    let h = E.deal(3, lcg(2));
    for (let i = 0; i < 8; i++) h = E.drawStock(h);
    expect(h.waste.length).toBe(24);
    expect(h.stock.length).toBe(0);
  });
  it("recycles the waste face down in original order and counts a pass", () => {
    let g = E.deal(1, lcg(3));
    const order = g.stock.map((c) => c.value + c.suit);
    for (let i = 0; i < 24; i++) g = E.drawStock(g);
    g = E.drawStock(g);
    expect(g.passes).toBe(1);
    expect(g.waste.length).toBe(0);
    expect(g.stock.map((c) => c.value + c.suit)).toEqual(order);
    expect(g.stock.every((c) => !c.faceUp)).toBe(true);
  });
  it("does nothing when both are empty", () => {
    const g = { ...E.deal(1, lcg(3)), stock: [], waste: [] };
    expect(E.drawStock(g)).toBe(g);
  });
});

/** A small rigged position for movement rules. */
function rig(): E.Game {
  const g = E.deal(1, lcg(4));
  return {
    ...g,
    tableau: [
      [card("K", "♠")],
      [card("7", "♥", false), card("6", "♠")],
      [card("5", "♦")],
      [],
      [card("Q", "♥")],
      [card("A", "♣")],
      [card("2", "♣")],
    ],
    waste: [card("J", "♣")],
    foundation: [[], [], [], []],
  };
}

describe("moves", () => {
  it("alternates colour, descends by one", () => {
    const g = rig();
    expect(E.canMove(g, { pile: "tableau", index: 2, card: 0 }, { pile: "tableau", index: 1 })).toBe(true);  // 5♦ on 6♠
    expect(E.canMove(g, { pile: "tableau", index: 1, card: 1 }, { pile: "tableau", index: 2 })).toBe(false); // 6♠ on 5♦
    expect(E.canMove(g, { pile: "waste" }, { pile: "tableau", index: 4 })).toBe(true);                       // J♣ on Q♥
    expect(E.canMove(g, { pile: "waste" }, { pile: "tableau", index: 0 })).toBe(false);                      // J♣ on K♠
  });
  it("only a king goes to an empty column", () => {
    const g = rig();
    expect(E.canMove(g, { pile: "tableau", index: 0, card: 0 }, { pile: "tableau", index: 3 })).toBe(true);
    expect(E.canMove(g, { pile: "tableau", index: 2, card: 0 }, { pile: "tableau", index: 3 })).toBe(false);
  });
  it("foundations take an ace, then the same suit ascending, one card at a time", () => {
    let g = rig();
    expect(E.canMove(g, { pile: "tableau", index: 6, card: 0 }, { pile: "foundation", index: 0 })).toBe(false);
    g = E.move(g, { pile: "tableau", index: 5, card: 0 }, { pile: "foundation", index: 0 });
    expect(g.foundation[0].map((c) => c.value)).toEqual(["A"]);
    g = E.move(g, { pile: "tableau", index: 6, card: 0 }, { pile: "foundation", index: 0 });
    expect(g.foundation[0].map((c) => c.value)).toEqual(["A", "2"]);
    expect(g.moves).toBe(2);
  });
  it("moving from a column exposes the card beneath", () => {
    const g0 = rig();
    g0.tableau[2] = [card("8", "♣", false), card("5", "♦")];
    const g = E.move(g0, { pile: "tableau", index: 2, card: 1 }, { pile: "tableau", index: 1 });
    expect(g.tableau[2].length).toBe(1);
    expect(g.tableau[2][0].faceUp).toBe(true);
    expect(g.tableau[1].map((c) => c.value)).toEqual(["7", "6", "5"]);
  });
  it("lifts a run, never a face-down card", () => {
    const g = rig();
    g.tableau[2] = [card("9", "♣", false), card("8", "♦"), card("7", "♣")];
    expect(E.liftable(g, { pile: "tableau", index: 2, card: 1 })?.length).toBe(2);
    expect(E.liftable(g, { pile: "tableau", index: 2, card: 0 })).toBeNull();
  });
  it("cards can come back off a foundation", () => {
    let g = rig();
    g = E.move(g, { pile: "tableau", index: 5, card: 0 }, { pile: "foundation", index: 0 });
    g.tableau[6] = [card("2", "♥")];
    expect(E.canMove(g, { pile: "foundation", index: 0 }, { pile: "tableau", index: 6 })).toBe(true);
  });
  it("double-click finds the right foundation", () => {
    let g = rig();
    g = E.toFoundation(g, { pile: "tableau", index: 5, card: 0 });
    expect(g.foundation.some((f) => f[0]?.value === "A")).toBe(true);
    expect(E.toFoundation(g, { pile: "waste" })).toBe(g);
  });
});

describe("undo + finish", () => {
  it("undo restores piles and counts as a move", () => {
    const g0 = rig();
    const g1 = E.move(g0, { pile: "waste" }, { pile: "tableau", index: 4 });
    const g2 = E.undo(g1);
    expect(g2.waste).toEqual(g0.waste);
    expect(g2.tableau).toEqual(g0.tableau);
    expect(g2.moves).toBe(2);
    expect(E.undo(g0)).toBe(g0);
  });
  it("auto-complete is offered only when nothing is hidden and finishes the game", () => {
    // All four suits laid as full descending runs is not needed: put everything on foundations but the kings.
    const deck = createDeck();
    const foundation: Card[][] = ["♠", "♥", "♦", "♣"].map((s) => deck.filter((c) => c.suit === s && c.value !== "K").map((c) => ({ ...c, faceUp: true })));
    const tableau: Card[][] = [[card("K", "♠")], [card("K", "♥")], [card("K", "♦")], [card("K", "♣")], [], [], []];
    let g: E.Game = { ...E.deal(1, lcg(5)), stock: [], waste: [], foundation, tableau };
    expect(E.canAutoComplete(g)).toBe(true);
    for (let i = 0; i < 4; i++) g = E.autoCompleteStep(g);
    expect(g.status).toBe("won");
    expect(E.canAutoComplete(g)).toBe(false);
    expect(E.tickSecond(g).seconds).toBe(0);
  });
  it("auto-complete waits while a card is face down", () => {
    const g = rig();
    expect(E.canAutoComplete({ ...g, stock: [], waste: [] })).toBe(false);
  });
});

describe("stats", () => {
  it("splits by draw mode and tracks best time / fewest moves", () => {
    let s = E.EMPTY_STATS;
    const won = { ...E.deal(3, lcg(6)), status: "won" as const, seconds: 240, moves: 120 };
    s = E.recordResult(s, won);
    s = E.recordResult(s, { ...won, seconds: 200, moves: 150 });
    expect(s.draw3).toEqual({ games: 2, wins: 2, bestTime: 200, fewestMoves: 120 });
    expect(s.draw1.games).toBe(0);
    expect(s.streak).toBe(2);
    s = E.recordResult(s, { ...E.deal(1, lcg(7)) }, true);
    expect(s.streak).toBe(0);
    expect(s.draw1.games).toBe(1);
    expect(s.bestTime).toBe(200);
  });
});
