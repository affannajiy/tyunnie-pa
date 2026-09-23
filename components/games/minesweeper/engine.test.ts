import { describe, it, expect } from "vitest";
import * as E from "./engine";

/** Deterministic LCG so a board can be reproduced in a failing test. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

describe("config", () => {
  it("presets match the classic boards", () => {
    expect(E.PRESETS.beginner).toEqual({ rows: 9, cols: 9, mines: 10 });
    expect(E.PRESETS.intermediate).toEqual({ rows: 16, cols: 16, mines: 40 });
    expect(E.PRESETS.expert).toEqual({ rows: 16, cols: 30, mines: 99 });
  });
  it("clamps custom boards so an opening is always possible", () => {
    expect(E.clampConfig({ rows: 2, cols: 100, mines: 5000 })).toEqual({ rows: 5, cols: 40, mines: 191 });
    expect(E.clampConfig({ rows: 10, cols: 10, mines: 0 })).toEqual({ rows: 10, cols: 10, mines: 1 });
    expect(E.clampConfig({ rows: NaN, cols: 8, mines: 3 })).toEqual({ rows: 5, cols: 8, mines: 3 });
  });
});

describe("first click", () => {
  it("never places a mine on or around the first cell, on every preset, across many seeds", () => {
    for (const preset of ["beginner", "intermediate", "expert"] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const g0 = E.newGame(preset);
        const start = Math.floor(lcg(seed * 7)() * g0.cells.length);
        const g = E.reveal(g0, start, lcg(seed));
        expect(g.status).toBe("playing");
        expect(g.cells[start].mine).toBe(false);
        expect(g.cells[start].adjacent).toBe(0);
        for (const n of E.neighbours(g.rows, g.cols, start)) expect(g.cells[n].mine).toBe(false);
        expect(g.cells.filter((c) => c.mine).length).toBe(g.mines);
      }
    }
  });
  it("always cascades: the opening reveals more than one cell", () => {
    const g = E.reveal(E.newGame("beginner"), 40, lcg(3));
    expect(g.cells.filter((c) => c.revealed).length).toBeGreaterThan(1);
  });
  it("falls back to excluding only the clicked cell when the board is nearly full", () => {
    const g0 = E.newGame("custom", { rows: 5, cols: 5, mines: 16 });
    const g = E.reveal(g0, 12, lcg(1));
    expect(g.cells[12].mine).toBe(false);
    expect(g.cells.filter((c) => c.mine).length).toBe(16);
  });
});

/** A hand-laid 4×4 board: mines at 0 and 15. */
function fixed(): E.Game {
  const g = E.newGame("custom", { rows: 4, cols: 4, mines: 2 });
  const cells = g.cells.map((c) => ({ ...c }));
  cells[0].mine = true; cells[15].mine = true;
  for (let i = 0; i < 16; i++) if (!cells[i].mine) cells[i].adjacent = E.neighbours(4, 4, i).filter((n) => cells[n].mine).length;
  return { ...g, cells, status: "playing" };
}

describe("play", () => {
  it("adjacent counts are right", () => {
    const g = fixed();
    expect(g.cells[1].adjacent).toBe(1);
    expect(g.cells[5].adjacent).toBe(1);
    expect(g.cells[10].adjacent).toBe(1);
    expect(g.cells[6].adjacent).toBe(0);
  });
  it("flood stops at numbers and flags", () => {
    let g = fixed();
    g = E.toggleFlag(g, 3);
    g = E.reveal(g, 12);
    expect(g.cells[12].revealed).toBe(true);
    expect(g.cells[3].revealed).toBe(false);
    expect(g.cells[15].revealed).toBe(false);
    expect(g.cells[1].revealed).toBe(true); // number reached, but not beyond
    expect(g.cells[0].revealed).toBe(false);
  });
  it("hitting a mine loses and shows every mine", () => {
    const g = E.reveal(fixed(), 0);
    expect(g.status).toBe("lost");
    expect(g.boom).toBe(0);
    expect(g.cells[15].revealed).toBe(true);
  });
  it("wins when every safe cell is open and auto-flags the rest", () => {
    let g = fixed();
    for (let i = 1; i < 15; i++) if (!g.cells[i].revealed) g = E.reveal(g, i);
    expect(g.status).toBe("won");
    expect(g.cells[0].flagged).toBe(true);
    expect(E.minesLeft(g)).toBe(0);
  });
  it("flags count toward the mine counter and cannot be revealed", () => {
    let g = fixed();
    g = E.toggleFlag(g, 0);
    expect(E.minesLeft(g)).toBe(1);
    expect(E.reveal(g, 0)).toBe(g);
    g = E.toggleFlag(g, 0);
    expect(E.minesLeft(g)).toBe(2);
  });
  it("chord opens neighbours when flags satisfy the number", () => {
    let g = fixed();
    g = E.reveal(g, 5); // number 1 next to mine at 0
    g = E.toggleFlag(g, 0);
    g = E.chord(g, 5);
    for (const n of [1, 4, 6, 8, 9, 10]) expect(g.cells[n].revealed).toBe(true);
    // 6 is a zero, so the chord cascades through the whole safe region.
    expect(g.status).toBe("won");
  });
  it("chord on a wrong flag hits the mine", () => {
    let g = fixed();
    g = E.reveal(g, 5);
    g = E.toggleFlag(g, 1); // wrong — the mine is at 0
    g = E.chord(g, 5);
    expect(g.status).toBe("lost");
    expect(g.boom).toBe(0);
  });
  it("chord does nothing when flags don't match", () => {
    let g = fixed();
    g = E.reveal(g, 5);
    expect(E.chord(g, 5)).toBe(g);
  });
  it("timer only runs while playing", () => {
    expect(E.tickSecond(E.newGame("beginner")).seconds).toBe(0);
    expect(E.tickSecond(fixed()).seconds).toBe(1);
  });
});

describe("stats", () => {
  it("records best time per preset and streaks", () => {
    let s = E.EMPTY_STATS;
    const won = { ...E.newGame("beginner"), status: "won" as const, seconds: 42 };
    s = E.recordResult(s, won);
    s = E.recordResult(s, { ...won, seconds: 30 });
    s = E.recordResult(s, { ...won, seconds: 50 });
    expect(s.beginner).toEqual({ games: 3, wins: 3, best: 30 });
    expect(s.streak).toBe(3);
    s = E.recordResult(s, { ...E.newGame("beginner"), status: "lost" });
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(3);
    expect(s.games).toBe(4);
  });
  it("custom boards count globally but keep no best", () => {
    const s = E.recordResult(E.EMPTY_STATS, { ...E.newGame("custom", { rows: 8, cols: 8, mines: 5 }), status: "won", seconds: 9 });
    expect(s.games).toBe(1);
    expect(s.beginner.games).toBe(0);
  });
});
