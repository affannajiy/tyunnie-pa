import { describe, it, expect } from "vitest";
import * as E from "./engine";
import { bit } from "./solver";

const game = (autoCheck = true) => E.newGame("easy", autoCheck, 5);
const firstEmpty = (g: E.Game) => g.cells.findIndex((c) => !c.value);

describe("entries", () => {
  it("places, undoes and redoes", () => {
    let g = game();
    const i = firstEmpty(g);
    const v = g.solution[i];
    g = E.setValue(g, i, v);
    expect(g.cells[i].value).toBe(v);
    g = E.undo(g);
    expect(g.cells[i].value).toBe(0);
    g = E.redo(g);
    expect(g.cells[i].value).toBe(v);
    expect(g.undo.length).toBe(1);
  });
  it("never touches a given", () => {
    const g = game();
    const i = g.cells.findIndex((c) => c.given);
    expect(E.setValue(g, i, 1)).toBe(g);
    expect(E.erase(g, i)).toBe(g);
    expect(E.toggleNote(g, i, 1)).toBe(g);
  });
  it("counts mistakes under auto-check and loses at three", () => {
    let g = game(true);
    const empties = g.cells.map((c, i) => (c.value ? -1 : i)).filter((i) => i >= 0);
    for (let k = 0; k < 3; k++) {
      const i = empties[k];
      const wrong = (g.solution[i] % 9) + 1;
      g = E.setValue(g, i, wrong);
    }
    expect(g.mistakes).toBe(3);
    expect(g.status).toBe("lost");
    expect(E.setValue(g, empties[3], 1)).toBe(g);
  });
  it("without auto-check, only clashes are errors and nothing is counted", () => {
    let g = game(false);
    const i = firstEmpty(g);
    const wrong = (g.solution[i] % 9) + 1;
    g = E.setValue(g, i, wrong);
    expect(g.mistakes).toBe(0);
    const errs = E.errors(g);
    // A wrong digit that happens not to clash is invisible; one that clashes is marked.
    const clashes = g.cells.some((c, p) => p !== i && c.value === wrong && E.isPeer(i, p));
    expect(errs.has(i)).toBe(clashes);
  });
  it("notes toggle and are cleared from peers by a placed digit", () => {
    let g = game();
    const i = firstEmpty(g);
    const p = g.cells.findIndex((c, k) => !c.value && E.isPeer(i, k));
    g = E.toggleNote(g, p, 4);
    g = E.toggleNote(g, p, 7);
    expect(g.cells[p].notes).toBe(bit(4) | bit(7));
    g = E.setValue(g, i, 4);
    expect(g.cells[p].notes).toBe(bit(7));
  });
  it("auto-notes fills candidates", () => {
    const g = E.autoNotes(game());
    const i = firstEmpty(g);
    expect(g.cells[i].notes & bit(g.solution[i])).not.toBe(0);
  });
  it("solves when the grid matches the solution", () => {
    let g = game();
    for (let i = 0; i < 81; i++) if (!g.cells[i].value) g = E.setValue(g, i, g.solution[i]);
    expect(g.status).toBe("solved");
    expect(E.tickSecond(g).seconds).toBe(0);
  });
});

describe("hints", () => {
  it("names a technique and applying it places the right digit", () => {
    let g = E.hint(game());
    expect(g.hint?.step?.kind).toBe("place");
    expect(g.hintsUsed).toBe(1);
    const cell = g.hint!.step!.cell;
    g = E.applyHint(g);
    expect(g.cells[cell].value).toBe(g.solution[cell]);
    expect(g.hint).toBeNull();
  });
  it("points at a wrong entry first under auto-check", () => {
    let g = game(true);
    const i = firstEmpty(g);
    g = E.setValue(g, i, (g.solution[i] % 9) + 1);
    g = E.hint(g);
    expect(g.hint?.step).toBeNull();
    expect((g.hint as { reveal: number }).reveal).toBe(i);
    g = E.applyHint(g);
    expect(g.cells[i].value).toBe(0);
  });
  it("hints on every difficulty always agree with the solution", () => {
    for (const d of ["easy", "normal", "hard", "expert"] as const) {
      let g = E.newGame(d, true, 77);
      for (let n = 0; n < 81 && g.status === "playing"; n++) {
        g = E.hint(g);
        const before = g.cells.map((c) => c.value);
        g = E.applyHint(g);
        for (let i = 0; i < 81; i++) if (g.cells[i].value && !before[i]) expect(g.cells[i].value).toBe(g.solution[i]);
      }
      expect(g.status).toBe("solved");
      expect(g.mistakes).toBe(0);
    }
  });
});

describe("daily + stats", () => {
  it("daily is deterministic per day and normal", () => {
    const a = E.dailyGame("2026-09-20", true), b = E.dailyGame("2026-09-20", true);
    expect(a.id).toBe(b.id);
    expect(a.difficulty).toBe(E.DAILY_DIFFICULTY);
    expect(E.dailyGame("2026-09-21", true).id).not.toBe(a.id);
  });
  it("previousDay crosses months", () => {
    expect(E.previousDay("2026-03-01")).toBe("2026-02-28");
    expect(E.previousDay("2026-01-01")).toBe("2025-12-31");
  });
  it("records best times per difficulty and daily streaks", () => {
    let s = E.EMPTY_STATS;
    const solved = (g: E.Game, seconds: number): E.Game => ({ ...g, status: "solved", seconds });
    s = E.recordResult(s, solved(E.newGame("hard", true, 1), 300));
    s = E.recordResult(s, solved(E.newGame("hard", true, 2), 200));
    expect(s.hard).toEqual({ solved: 2, best: 200 });
    expect(s.bestTime).toBe(200);
    s = E.recordResult(s, solved(E.dailyGame("2026-09-20", true), 100));
    expect(s.dailyStreak).toBe(1);
    s = E.recordResult(s, solved(E.dailyGame("2026-09-20", true), 90)); // same day again: no double count
    expect(s.dailyStreak).toBe(1);
    s = E.recordResult(s, solved(E.dailyGame("2026-09-21", true), 100));
    expect(s.dailyStreak).toBe(2);
    s = E.recordResult(s, solved(E.dailyGame("2026-09-25", true), 100));
    expect(s.dailyStreak).toBe(1);
    expect(s.bestDailyStreak).toBe(2);
    s = E.recordResult(s, solved(E.newGame("easy", false, 3), 50));
    expect(s.unchecked).toBe(1);
  });
  it("ID round-trips", () => {
    const g = E.newGame("normal", true, 9);
    const h = E.gameFromId(g.id, true)!;
    expect(h.cells.map((c) => c.value)).toEqual(g.cells.map((c) => c.value));
    expect(E.gameFromId("nope", true)).toBeNull();
  });
});
