import { describe, it, expect } from "vitest";
import * as E from "./engine";

const lcg = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

/** Build a grid from strings, bottom rows last; "." empty, any other char a block. */
function gridOf(rows: string[]): E.Grid {
  const g = E.emptyGrid();
  rows.forEach((r, i) => {
    const y = E.ROWS - rows.length + i;
    r.split("").forEach((c, x) => { if (c !== ".") g[y][x] = "J"; });
  });
  return g;
}

const started = (seed = 1) => E.start(E.newGame("marathon", lcg(seed)), lcg(seed));

describe("shapes + bag", () => {
  it("every piece has four cells in every rotation", () => {
    for (const t of E.TYPES) for (let r = 0; r < 4; r++) expect(E.SHAPES[t][r].length).toBe(4);
  });
  it("7-bag: every 7 pieces contain one of each", () => {
    let g = started(3);
    const seen: E.Type[] = [];
    for (let i = 0; i < 28; i++) { seen.push(g.cur!.type); g = E.hardDrop(g, lcg(3 + i)); if (g.status !== "playing") break; }
    for (let b = 0; b + 7 <= seen.length; b += 7) expect(new Set(seen.slice(b, b + 7)).size).toBe(7);
  });
  it("shows a 3-piece preview", () => {
    expect(started().queue.length).toBe(E.PREVIEW);
  });
});

describe("movement + rotation", () => {
  it("moves within the walls", () => {
    let g = started();
    for (let i = 0; i < 12; i++) g = E.move(g, -1);
    expect(Math.min(...E.cells(g.cur!).map(([x]) => x))).toBe(0);
    for (let i = 0; i < 12; i++) g = E.move(g, 1);
    expect(Math.max(...E.cells(g.cur!).map(([x]) => x))).toBe(E.COLS - 1);
  });
  it("O never rotates, others cycle through four states", () => {
    const g = started();
    const o: E.Game = { ...g, cur: { type: "O", rot: 0, x: 3, y: 2 } };
    expect(E.rotate(o, 1)).toBe(o);
    let t: E.Game = { ...g, cur: { type: "T", rot: 0, x: 3, y: 2 } };
    for (let i = 0; i < 4; i++) t = E.rotate(t, 1);
    expect(t.cur!.rot).toBe(0);
    expect(E.rotate(t, -1).cur!.rot).toBe(3);
  });
  it("SRS wall kick: an I against the left wall still rotates", () => {
    const g = started();
    const i: E.Game = { ...g, cur: { type: "I", rot: 1, x: -2, y: 5 } }; // vertical I in column 0
    expect(E.fits(g.grid, i.cur!)).toBe(true);
    const r = E.rotate(i, 1);
    expect(r).not.toBe(i);
    expect(E.fits(g.grid, r.cur!)).toBe(true);
    expect(r.lastKick).toBeGreaterThan(0);
  });
  it("ghost lands on the floor and hard drop scores 2 per cell", () => {
    const g = started();
    const gh = E.ghost(g)!;
    expect(E.fits(g.grid, { ...gh, y: gh.y + 1 })).toBe(false);
    const fell = gh.y - g.cur!.y;
    const d = E.hardDrop(g, lcg(9));
    expect(d.score).toBe(fell * 2);
    expect(d.pieces).toBe(2);
  });
  it("soft drop scores 1 per cell", () => {
    const g = E.softDrop(started());
    expect(g.score).toBe(1);
  });
});

describe("hold", () => {
  it("holds once per piece and swaps back", () => {
    let g = started();
    const first = g.cur!.type;
    g = E.hold(g, lcg(2));
    expect(g.hold).toBe(first);
    expect(g.canHold).toBe(false);
    expect(E.hold(g, lcg(2))).toBe(g);
    g = E.hardDrop(g, lcg(2));
    expect(g.canHold).toBe(true);
    const second = g.cur!.type;
    g = E.hold(g, lcg(2));
    expect(g.cur!.type).toBe(first);
    expect(g.hold).toBe(second);
  });
});

describe("lock delay bookkeeping", () => {
  it("counts resets only while grounded", () => {
    let g = started();
    g = E.move(g, 1);
    expect(g.lockResets).toBe(0);
    g = { ...g, cur: E.ghost(g)! };
    expect(E.isGrounded(g)).toBe(true);
    g = E.move(g, -1);
    g = E.rotate(g, 1);
    expect(g.lockResets).toBe(2);
  });
});

describe("scoring", () => {
  it("clears a single and a tetris with level multiplier", () => {
    const g0 = started();
    // Nine-wide floor of one row; drop a vertical I into column 9 for a single.
    // A stray block on top keeps these from being perfect clears.
    let g: E.Game = { ...g0, grid: gridOf(["J.........", "JJJJJJJJJ."]), cur: { type: "I", rot: 1, x: 7, y: 10 } };
    g = E.hardDrop(g, lcg(4));
    expect(g.lines).toBe(1);
    expect(g.score).toBeGreaterThanOrEqual(100);
    expect(g.lastClear?.lines).toBe(1);
    // Four rows with column 9 open; vertical I = tetris.
    let t: E.Game = { ...g0, grid: gridOf(["J.........", "JJJJJJJJJ.", "JJJJJJJJJ.", "JJJJJJJJJ.", "JJJJJJJJJ."]), cur: { type: "I", rot: 1, x: 7, y: 10 } };
    t = E.hardDrop(t, lcg(4));
    expect(t.lines).toBe(4);
    expect(t.lastClear?.lines).toBe(4);
    expect(t.tetrises).toBe(1);
    expect(t.b2b).toBe(true);
    expect(t.lastClear?.points).toBe(800);
  });
  it("back-to-back tetrises pay 1.5×", () => {
    const g0 = started();
    const eight = gridOf(["J.........", ...Array(8).fill("JJJJJJJJJ.")]);
    let g: E.Game = { ...g0, grid: eight, cur: { type: "I", rot: 1, x: 7, y: 8 }, score: 0 };
    g = E.hardDrop(g, lcg(5));
    const first = g.lastClear!.points;
    g = { ...g, cur: { type: "I", rot: 1, x: 7, y: 8 } };
    g = E.hardDrop(g, lcg(5));
    expect(g.lastClear!.b2b).toBe(true);
    // Second clear: 800*1.5 = 1200 plus a 1-combo bonus of 50.
    expect(g.lastClear!.points).toBe(1200 + 50);
    expect(first).toBe(800);
  });
  it("combo counts consecutive clearing pieces and breaks on a miss", () => {
    const g0 = started();
    let g: E.Game = { ...g0, grid: gridOf(["J.........", "JJJJJJJJJ.", "JJJJJJJJJ."]), cur: { type: "I", rot: 1, x: 7, y: 10 } };
    g = E.hardDrop(g, lcg(6));
    expect(g.combo).toBe(0);
    g = { ...g, grid: gridOf(["J.........", "JJJJJJJJJ."]), cur: { type: "I", rot: 1, x: 7, y: 10 } };
    g = E.hardDrop(g, lcg(6));
    expect(g.combo).toBe(1);
    expect(g.lastClear!.combo).toBe(1);
    g = { ...g, cur: { type: "O", rot: 0, x: 0, y: 5 } };
    g = E.hardDrop(g, lcg(6));
    expect(g.combo).toBe(-1);
  });
  it("detects a T-spin double: vertical T slides in, rotates, both rows go", () => {
    const g0 = started();
    // Classic TSD: the T rests pointing left beside the overhang at (5,17), then
    // rotates to point down and SRS test 3 (−1,−1) drops it into the slot.
    const slot = gridOf([
      "J.........",
      "JJJ..JJJJJ",
      "JJ...JJJJJ",
      "JJJ.JJJJJJ",
    ]);
    let g: E.Game = { ...g0, grid: slot, cur: { type: "T", rot: 3, x: 3, y: 8 } };
    g = { ...g, cur: E.ghost(g)! };
    expect(g.cur!.y).toBe(16);
    g = E.rotate(g, -1);
    expect(g.cur!.rot).toBe(2);
    expect(g.lastKick).toBe(2);
    expect(g.cur!.x).toBe(2);
    expect(g.cur!.y).toBe(17);
    expect(g.lastAction).toBe("rotate");
    g = E.lock(g, lcg(7));
    expect(g.lastClear?.tspin).toBe("full");
    expect(g.lastClear?.lines).toBe(2);
    expect(g.lastClear?.points).toBe(1200);
    expect(g.tspins).toBe(1);
    expect(g.b2b).toBe(true);
  });
  it("a T dropped straight in is not a T-spin", () => {
    const g0 = started();
    const open = gridOf(["J.........", "JJJ...JJJJ", "JJJJ.JJJJJ"]);
    let g: E.Game = { ...g0, grid: open, cur: { type: "T", rot: 2, x: 3, y: 5 } };
    g = E.hardDrop(g, lcg(7));
    expect(g.lastClear?.lines).toBe(2);
    expect(g.lastClear?.tspin).toBe("none");
  });
});

describe("game end", () => {
  it("blocks out when the spawn is occupied", () => {
    const g0 = started();
    const full = E.emptyGrid().map((r, y) => (y < 3 ? r.map((_, x) => (x === 9 ? null : ("J" as E.Cell))) : r));
    const g = E.hardDrop({ ...g0, grid: full, cur: { type: "O", rot: 0, x: 3, y: 3 } }, lcg(8));
    expect(g.status).toBe("over");
  });
  it("sprint finishes at 40 lines and records time", () => {
    let g = E.start(E.newGame("sprint", lcg(1)), lcg(1));
    g = { ...g, lines: 39, grid: gridOf(["J.........", "JJJJJJJJJ."]), cur: { type: "I", rot: 1, x: 7, y: 10 } };
    g = E.hardDrop(g, lcg(1));
    expect(g.status).toBe("done");
    expect(g.level).toBe(1);
    const s = E.recordResult(E.EMPTY_STATS, g, 65000);
    expect(s.sprintBest).toBe(65000);
    expect(s.sprintFinished).toBe(1);
  });
  it("marathon levels every 10 lines and gravity speeds up", () => {
    expect(E.gravityMs(1)).toBe(1000);
    expect(E.gravityMs(10)).toBeLessThan(E.gravityMs(5));
    expect(E.gravityMs(30)).toBeGreaterThanOrEqual(30);
    let g = started();
    g = { ...g, lines: 9, grid: gridOf(["J.........", "JJJJJJJJJ."]), cur: { type: "I", rot: 1, x: 7, y: 10 } };
    g = E.hardDrop(g, lcg(1));
    expect(g.level).toBe(2);
  });
  it("pause freezes input", () => {
    const g = E.pause(started());
    expect(g.status).toBe("paused");
    expect(E.move(g, 1)).toBe(g);
    expect(E.resume(g).status).toBe("playing");
  });
});
