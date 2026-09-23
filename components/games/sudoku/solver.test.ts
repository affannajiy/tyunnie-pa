import { describe, it, expect } from "vitest";
import * as S from "./solver";
import * as G from "./generator";

const parse = (s: string): S.Grid => s.replace(/[^0-9.]/g, "").split("").map((c) => (c === "." ? 0 : Number(c)));

// A well-known easy puzzle (Project Euler #96 grid 1) and its solution.
const EASY = parse("003020600900305001001806400008102900700000008006708200002609500800203009005010300");
const EASY_SOL = parse("483921657967345821251876493548132976729564138136798245372689514814253769695417382");

describe("backtracker", () => {
  it("solves and proves uniqueness", () => {
    expect(S.countSolutions(EASY, 2)).toBe(1);
    expect(S.solve(EASY)).toEqual(EASY_SOL);
  });
  it("counts multiple solutions", () => {
    const open = EASY.slice();
    for (let i = 0; i < 81; i++) if (i % 3 === 0) open[i] = 0;
    expect(S.countSolutions(open, 2)).toBe(2);
  });
  it("rejects a contradiction", () => {
    const bad = EASY.slice(); bad[0] = 4; bad[1] = 4;
    expect(S.countSolutions(bad)).toBe(0);
    expect(S.candidates(bad)).toBeNull();
  });
  it("finds conflicts", () => {
    const bad = EASY.slice(); bad[0] = 3; // row 1 already has a 3 at index 2
    expect([...S.conflicts(bad)].sort()).toEqual([0, 2]);
  });
});

describe("technique solver", () => {
  it("solves the easy puzzle with singles only and grades it easy", () => {
    const g = S.grade(EASY);
    expect(g.stuck).toBe(false);
    expect(g.difficulty).toBe("easy");
  });
  it("every step it takes agrees with the true solution", () => {
    const grid = EASY.slice();
    const cand = S.candidates(grid)!;
    for (let n = 0; n < 200 && !grid.every(Boolean); n++) {
      const s = S.stepLogic(grid, cand);
      expect(s).not.toBeNull();
      if (s!.kind === "place") expect(EASY_SOL[s!.cell]).toBe(s!.digit);
      else for (const c of s!.cells) expect(s!.digits & S.bit(EASY_SOL[c])).toBe(0);
      S.applyStep(grid, cand, s!);
    }
    expect(grid).toEqual(EASY_SOL);
  });
  it("reaches for hidden singles on a generated puzzle", () => {
    const grid = G.generate("normal", 1000).puzzle.slice();
    const cand = S.candidates(grid)!;
    let sawHidden = false;
    for (let n = 0; n < 200 && !grid.every(Boolean); n++) {
      const s = S.stepLogic(grid, cand)!;
      if (s.technique === "hidden single") sawHidden = true;
      S.applyStep(grid, cand, s);
    }
    expect(sawHidden).toBe(true);
  });
});

describe("generator", () => {
  it("is deterministic for a seed", () => {
    const a = G.attempt("normal", 42), b = G.attempt("normal", 42);
    expect(a.puzzle).toEqual(b.puzzle);
    expect(G.fromId(a.id)!.puzzle).toEqual(a.puzzle);
  });
  it("full grids are valid", () => {
    const g = G.fullGrid(G.seededRng(7));
    expect(g.every((v) => v >= 1 && v <= 9)).toBe(true);
    expect(S.conflicts(g).size).toBe(0);
  });
  it("puzzles are unique and symmetric", () => {
    const p = G.attempt("easy", 3).puzzle;
    expect(S.countSolutions(p, 2)).toBe(1);
    for (let i = 0; i < 81; i++) expect(!!p[i]).toBe(!!p[80 - i]);
  });
  it("hits the requested grade for every difficulty within budget", () => {
    for (const d of ["easy", "normal", "hard", "expert"] as const) {
      const t0 = performance.now();
      const g = G.generate(d, 1000);
      const ms = performance.now() - t0;
      expect(S.grade(g.puzzle).difficulty).toBe(d);
      expect(S.countSolutions(g.puzzle, 2)).toBe(1);
      expect(S.solve(g.puzzle)).toEqual(g.solution);
      expect(ms).toBeLessThan(4000);
    }
  });
  it("parses and rejects IDs", () => {
    expect(G.parseId("h-12")).toEqual({ difficulty: "hard", seed: 12 });
    expect(G.parseId("Q-1")).toBeNull();
    expect(G.parseId("")).toBeNull();
  });
});
