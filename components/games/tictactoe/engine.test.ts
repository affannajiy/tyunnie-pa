import { describe, it, expect } from "vitest";
import * as E from "./engine";

const b = (s: string): E.Board => s.split("").map((c) => (c === "." ? null : (c as E.Mark)));

describe("winner", () => {
  it("detects rows, columns, diagonals", () => {
    expect(E.winner(b("XXX......"))?.line).toEqual([0, 1, 2]);
    expect(E.winner(b("O..O..O.."))?.mark).toBe("O");
    expect(E.winner(b("X...X...X"))?.line).toEqual([0, 4, 8]);
    expect(E.winner(b("XOXOXOOXO"))).toBeNull();
  });
});

describe("bot", () => {
  it("hard takes an immediate win", () => {
    expect(E.botMove(b("OO.XX...."), "hard")).toBe(2);
  });
  it("hard blocks an immediate loss", () => {
    expect(E.botMove(b("XX..O...."), "hard")).toBe(2);
  });
  it("hard is deterministic", () => {
    const board = b("X...O....");
    expect(E.botMove(board, "hard")).toBe(E.botMove(board, "hard"));
  });
  it("hard never loses against every possible human line", () => {
    let losses = 0;
    const walk = (board: E.Board, turn: E.Mark) => {
      const w = E.winner(board);
      if (w) { if (w.mark === E.HUMAN) losses++; return; }
      if (E.isFull(board)) return;
      if (turn === E.BOT) {
        const i = E.botMove(board, "hard");
        const nb = [...board]; nb[i] = E.BOT;
        walk(nb, E.HUMAN);
      } else {
        for (const i of E.empties(board)) { const nb = [...board]; nb[i] = E.HUMAN; walk(nb, E.BOT); }
      }
    };
    walk(Array(9).fill(null), E.HUMAN);
    walk(Array(9).fill(null), E.BOT);
    expect(losses).toBe(0);
  });
  it("normal wins, blocks, then prefers centre", () => {
    expect(E.botMove(b("OO.XX...."), "normal")).toBe(2);
    expect(E.botMove(b("XX......."), "normal")).toBe(2);
    expect(E.botMove(b("X........"), "normal")).toBe(4);
  });
  it("easy uses the injected rng", () => {
    expect(E.botMove(b("X........"), "easy", "O", () => 0)).toBe(1);
    expect(E.botMove(b("X........"), "easy", "O", () => 0.99)).toBe(8);
  });
});

describe("game flow", () => {
  it("alternates opener", () => {
    const g1 = E.newGame({ difficulty: "hard", first: "alternate" });
    expect(g1.opener).toBe("you");
    const g2 = E.newGame({ difficulty: "hard", first: "alternate", prevOpener: g1.opener });
    expect(g2.opener).toBe("tyunnie");
    expect(g2.turn).toBe(E.BOT);
  });
  it("scores a human win with streak", () => {
    let g = E.newGame({ difficulty: "easy", first: "you" });
    g = { ...g, board: b("XX.OO....") };
    g = E.humanMove(g, 2);
    expect(g.status).toBe("won");
    expect(g.line).toEqual([0, 1, 2]);
    expect(g.stats).toMatchObject({ games: 1, you: 1, streak: 1, bestStreak: 1 });
  });
  it("draw counts and keeps the streak", () => {
    let g = E.newGame({ difficulty: "easy", first: "you", stats: { ...E.EMPTY_STATS, streak: 2, bestStreak: 2 } });
    g = { ...g, board: b("XOXXOOOX.") };
    g = E.humanMove(g, 8);
    expect(g.status).toBe("draw");
    expect(g.stats.draw).toBe(1);
    expect(g.stats.streak).toBe(2);
  });
  it("bot win resets streak, keeps best", () => {
    let g = E.newGame({ difficulty: "hard", first: "tyunnie", stats: { ...E.EMPTY_STATS, streak: 3, bestStreak: 3 } });
    g = { ...g, board: b("OO.XX...."), turn: E.BOT };
    g = E.botTurn(g);
    expect(g.status).toBe("lost");
    expect(g.stats.streak).toBe(0);
    expect(g.stats.bestStreak).toBe(3);
  });
  it("ignores clicks out of turn and on filled cells", () => {
    const g = E.newGame({ difficulty: "hard", first: "tyunnie" });
    expect(E.humanMove(g, 0)).toBe(g);
    const h = E.humanMove(E.newGame({ difficulty: "hard", first: "you" }), 4);
    expect(h.turn).toBe(E.BOT);
    expect(E.canPlace(h, 0)).toBe(false);
    expect(E.place(h, 4)).toBe(h);
  });
});
