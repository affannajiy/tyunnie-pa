import { describe, it, expect } from "vitest";
import * as E from "./engine";
import * as B from "./bot";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const POS3 = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
const POS4 = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";

function perft(pos: E.Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = E.legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(E.makeMove(pos, m), depth - 1);
  return n;
}

const mv = (from: string, to: string, promo?: E.PieceType): E.Move => {
  const idx = (s: string) => E.sq(8 - Number(s[1]), E.FILES.indexOf(s[0]));
  return { from: idx(from), to: idx(to), promo };
};

describe("move generation (perft)", () => {
  it("start position: 20 / 400 / 8902", () => {
    const p = E.fromFen(START);
    expect(perft(p, 1)).toBe(20);
    expect(perft(p, 2)).toBe(400);
    expect(perft(p, 3)).toBe(8902);
  });
  it("kiwipete (castling, en passant, promotions): 48 / 2039", () => {
    const p = E.fromFen(KIWIPETE);
    expect(perft(p, 1)).toBe(48);
    expect(perft(p, 2)).toBe(2039);
  });
  it("position 3 (en passant + pins): 14 / 191 / 2812", () => {
    const p = E.fromFen(POS3);
    expect(perft(p, 1)).toBe(14);
    expect(perft(p, 2)).toBe(191);
    expect(perft(p, 3)).toBe(2812);
  });
  it("position 4 (promotions + castling through check): 6 / 264", () => {
    const p = E.fromFen(POS4);
    expect(perft(p, 1)).toBe(6);
    expect(perft(p, 2)).toBe(264);
  });
  it("FEN round-trips", () => {
    for (const f of [START, KIWIPETE, POS3, POS4]) expect(E.toFen(E.fromFen(f))).toBe(f);
  });
});

describe("rules", () => {
  it("castling moves the rook and clears rights", () => {
    const p = E.fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const k = E.legalMoves(p).find((m) => m.castle === "K")!;
    const n = E.makeMove(p, k);
    expect(n.board[E.sq(7, 6)]?.type).toBe("K");
    expect(n.board[E.sq(7, 5)]?.type).toBe("R");
    expect(n.board[E.sq(7, 7)]).toBeNull();
    expect(n.castle.wK).toBe(false);
    expect(n.castle.wQ).toBe(false);
    expect(E.san(p, k)).toBe("O-O");
  });
  it("cannot castle through or out of check", () => {
    const through = E.fromFen("4k3/8/8/8/8/8/5r2/4K2R w K - 0 1");
    expect(E.legalMoves(through).some((m) => m.castle)).toBe(false);
    const out = E.fromFen("4k3/8/8/8/8/8/4r3/4K2R w K - 0 1");
    expect(E.legalMoves(out).some((m) => m.castle)).toBe(false);
  });
  it("en passant captures the passed pawn", () => {
    let g = E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 0 });
    g = E.play(g, mv("e2", "e4"));
    g = E.play(g, mv("a7", "a6"));
    g = E.play(g, mv("e4", "e5"));
    g = E.play(g, mv("d7", "d5"));
    expect(g.pos.ep).toBe(E.sq(2, 3));
    const ep = E.legalMoves(g.pos).find((m) => m.ep)!;
    expect(ep).toBeDefined();
    expect(E.san(g.pos, ep)).toBe("exd6");
    g = E.play(g, ep);
    expect(g.pos.board[E.sq(3, 3)]).toBeNull();
    expect(g.pos.board[E.sq(2, 3)]?.type).toBe("P");
  });
  it("promotion needs a piece and is written =Q", () => {
    const p = E.fromFen("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    const promos = E.legalMoves(p).filter((m) => m.promo);
    expect(promos.length).toBe(4);
    const q = promos.find((m) => m.promo === "Q")!;
    expect(E.san(p, q)).toBe("a8=Q");
    expect(E.makeMove(p, q).board[E.sq(0, 0)]?.type).toBe("Q");
  });
  it("SAN disambiguates and marks check and mate", () => {
    const p = E.fromFen("k7/8/8/8/8/8/R6R/K7 w - - 0 1");
    const a = E.legalMoves(p).find((m) => m.from === E.sq(6, 0) && m.to === E.sq(6, 3))!;
    expect(E.san(p, a)).toBe("Rad2");
    const mate = E.fromFen("k7/8/1K6/8/8/8/8/7R w - - 0 1");
    const h8 = E.legalMoves(mate).find((m) => m.to === E.sq(0, 7))!;
    expect(E.san(mate, h8)).toBe("Rh8#");
    const chk = E.fromFen("k7/8/8/8/8/8/8/K6R w - - 0 1");
    const h8c = E.legalMoves(chk).find((m) => m.to === E.sq(0, 7))!;
    expect(E.san(chk, h8c)).toBe("Rh8+");
  });
});

describe("game state", () => {
  it("fool's mate ends 0-1", () => {
    let g = E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 0 });
    for (const [f, t] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) g = E.play(g, mv(f, t));
    expect(g.status).toBe("checkmate");
    expect(g.result).toBe("0-1");
    expect(g.history.map((h) => h.san)).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(E.play(g, mv("a2", "a3"))).toBe(g);
  });
  it("stalemate is a draw", () => {
    const g = { ...E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 0 }), pos: E.fromFen("k7/2Q5/8/8/8/8/8/K7 w - - 0 1") };
    const h = E.play(g, mv("c7", "b6"));
    expect(h.status).toBe("stalemate");
    expect(h.drawReason).toBe("stalemate");
  });
  it("threefold repetition is a draw", () => {
    let g = E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 0 });
    for (let i = 0; i < 2; i++) for (const [f, t] of [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]]) g = E.play(g, mv(f, t));
    expect(g.status).toBe("draw");
    expect(g.drawReason).toBe("repetition");
  });
  it("fifty-move rule is a draw", () => {
    const g = { ...E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 0 }), pos: E.fromFen("k7/8/8/8/8/8/8/K6R w - - 99 80") };
    const h = E.play(g, mv("h1", "h2"));
    expect(h.drawReason).toBe("fifty");
  });
  it("insufficient material: K+B v K and same-colour bishops", () => {
    expect(E.insufficientMaterial(E.fromFen("k7/8/8/8/8/8/8/KB6 w - - 0 1").board)).toBe(true);
    expect(E.insufficientMaterial(E.fromFen("kb6/8/8/8/8/8/8/KB6 w - - 0 1").board)).toBe(false); // a8 dark? b8 light, b1 dark → opposite → not drawn
    expect(E.insufficientMaterial(E.fromFen("k1b5/8/8/8/8/8/8/KB6 w - - 0 1").board)).toBe(true);  // c8 and b1 are both dark
    expect(E.insufficientMaterial(E.fromFen("k7/8/8/8/8/8/8/KR6 w - - 0 1").board)).toBe(false);
  });
  it("resign, flag, draw offers", () => {
    let g = E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 0 });
    expect(E.resign(g, "w").result).toBe("0-1");
    expect(E.flag(g, "b").result).toBe("1-0");
    g = E.offerDraw(g, "w");
    expect(g.drawOffer).toBe("w");
    expect(E.acceptDraw(g).drawReason).toBe("agreement");
    // Moving instead of answering lets the offer lapse.
    const moved = E.play(g, mv("e2", "e4"));
    expect(moved.drawOffer).toBe("w");
    const replied = E.play(moved, mv("e7", "e5"));
    expect(replied.drawOffer).toBeNull();
  });
  it("undo takes back a full turn against the bot, one ply in 2-player", () => {
    let g = E.newGame({ mode: "bot", difficulty: "easy", human: "w", control: 0 });
    g = E.play(g, mv("e2", "e4"));
    g = E.play(g, mv("e7", "e5"));
    g = E.undo(g);
    expect(g.history.length).toBe(0);
    expect(g.pos.turn).toBe("w");
    let t = E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 0 });
    t = E.play(t, mv("e2", "e4"));
    t = E.play(t, mv("e7", "e5"));
    t = E.undo(t);
    expect(t.history.length).toBe(1);
    expect(t.pos.turn).toBe("b");
  });
  it("clock flags the side to move at zero", () => {
    let g = E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 2 });
    g = E.tickClock(g);
    expect(g.clock.w).toBe(1);
    g = E.tickClock(g);
    expect(g.status).toBe("timeout");
    expect(g.result).toBe("0-1");
  });
  it("clock charges fractional wall-clock deltas to the side to move", () => {
    let g = E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 60 });
    g = E.tickClock(g, 0.25);
    g = E.tickClock(g, 1.5);
    expect(g.clock.w).toBeCloseTo(58.25);
    expect(g.clock.b).toBe(60);
    expect(E.tickClock(g, 59).status).toBe("timeout");
  });
  it("captured pieces and material diff", () => {
    const c = E.captured(E.fromFen("k7/8/8/8/8/8/8/KQ6 w - - 0 1").board);
    expect(c.w).toEqual(["Q", "R", "R", "B", "B", "N", "N", "P", "P", "P", "P", "P", "P", "P", "P"]);
    expect(c.diff).toBe(900);
  });
  it("PGN export lists moves and the result", () => {
    let g = E.newGame({ mode: "2p", difficulty: "easy", human: "w", control: 0 });
    for (const [f, t] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) g = E.play(g, mv(f, t));
    const text = E.pgn(g, { w: "You", b: "Friend" }, "2026-09-20");
    expect(text).toContain(`[Result "0-1"]`);
    expect(text).toContain("1. f3 e5 2. g4 Qh4# 0-1");
    expect(text).toContain(`[Date "2026.09.20"]`);
  });
  it("stats record wins from the human's side", () => {
    let g = E.newGame({ mode: "bot", difficulty: "hard", human: "b", control: 0 });
    for (const [f, t] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) g = E.play(g, mv(f, t));
    const s = E.recordResult(E.EMPTY_STATS, g);
    expect(s.wins).toBe(1);
    expect(s.byDifficulty.hard).toEqual({ games: 1, wins: 1 });
  });
});

describe("bot", () => {
  // An unbounded budget so the depth cap, not the clock, ends the search —
  // with the real 1.5s budget a busy CI box can stop one run a ply early.
  it("is deterministic at every tier", () => {
    const p = E.fromFen(KIWIPETE);
    for (const d of ["easy", "normal", "hard", "expert"] as const) {
      const a = B.bestMove(p, d, 60_000), b = B.bestMove(p, d, 60_000);
      expect(a.move).toEqual(b.move);
      expect(a.move).not.toBeNull();
    }
  }, 30_000);
  it("takes a free queen on every tier", () => {
    const p = E.fromFen("k7/8/8/8/8/8/8/K1R2q2 w - - 0 1"); // Rc1xf1
    for (const d of ["easy", "normal", "hard", "expert"] as const) {
      const m = B.bestMove(p, d).move!;
      expect(m.to).toBe(E.sq(7, 5));
    }
  });
  it("finds mate in one from hard upward", () => {
    const p = E.fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"); // Ra8#
    for (const d of ["hard", "expert"] as const) {
      const m = B.bestMove(p, d).move!;
      expect(E.san(p, m)).toBe("Ra8#");
    }
  });
  it("expert avoids a two-ply blunder that normal makes tempting", () => {
    // White queen can take a pawn on h7 but gets captured by the king; expert sees it.
    const p = E.fromFen("6k1/6pp/8/8/8/8/6PP/4Q1K1 w - - 0 1");
    const m = B.bestMove(p, "expert").move!;
    expect(E.san(p, m)).not.toBe("Qxh7");
  });
  it("expert respects the time budget", () => {
    const t0 = Date.now();
    const r = B.bestMove(E.fromFen(KIWIPETE), "expert", 1500);
    expect(Date.now() - t0).toBeLessThan(2500);
    expect(r.depth).toBeGreaterThanOrEqual(1);
  });
  it("accepts a draw only when not ahead", () => {
    expect(B.acceptsDraw(E.fromFen("k7/8/8/8/8/8/8/KQ6 w - - 0 1"), "w")).toBe(false);
    expect(B.acceptsDraw(E.fromFen("k7/8/8/8/8/8/8/KQ6 w - - 0 1"), "b")).toBe(true);
    expect(B.acceptsDraw(E.fromFen(START), "w")).toBe(true);
  });
});
