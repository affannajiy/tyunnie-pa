import { describe, it, expect } from "vitest";
import { type Tile, type Seat, kindOf, sortTiles } from "./tiles";
import { type Meld, score, decompose, isComplete, waitingOn, payouts, MIN_FAN, LIMIT, type WinContext } from "./scoring";
import { claimOptions, chowSets, bestChow, dangerOf, threatOf, chooseDiscard, chooseClaim, type BotView } from "./bot";
import * as E from "./engine";

// ── Helpers ────────────────────────────────────────────────────────────────

let nextId = 1000;
/** "m1 m2 m3 w1 w1" → tiles with unique ids. */
function tiles(spec: string): Tile[] {
  return spec.trim().split(/\s+/).map((k) => ({ id: nextId++, suit: k[0] as Tile["suit"], rank: Number(k.slice(1)) }));
}
const t1 = (k: string) => tiles(k)[0];
function meld(kind: Meld["kind"], spec: string, concealed?: boolean): Meld {
  return { kind, tiles: tiles(spec), ...(concealed ? { concealed } : {}) };
}
const ctx = (over: Partial<WinContext> = {}): WinContext => ({
  seat: 0, roundWind: 0, isDealer: true, selfDrawn: false, firstTurn: false, lastTile: false,
  afterKong: false, robbedKong: false, flowers: [t1("f2")], ...over,
});
const fanNames = (r: ReturnType<typeof score>) => r!.fans.map((f) => f.zh);

/** A game with rigged hands and wall, human to act in `phase`. */
function rig(opts: {
  hands: string[]; melds?: Meld[][]; wall?: string; turn?: Seat; dealer?: Seat; phase?: E.Phase;
  difficulty?: E.Game["difficulty"]; roundWind?: Seat; discards?: string[];
}): E.Game {
  const g = E.newGame(opts.difficulty ?? "normal");
  return {
    ...g,
    phase: opts.phase ?? "discard",
    turn: opts.turn ?? 0,
    dealer: opts.dealer ?? 0,
    roundWind: opts.roundWind ?? 0,
    wall: opts.wall ? tiles(opts.wall) : tiles("p5 p6 p7 s5 s6 s7 m5 m6 m7 p2 p3 p4 s2 s3 s4"),
    players: g.players.map((p, i) => ({
      ...p,
      hand: sortTiles(tiles(opts.hands[i])),
      melds: opts.melds?.[i] ?? [],
      flowers: [],
      discards: opts.discards?.[i] ? tiles(opts.discards[i]) : [],
    })),
    discardCount: 5,
  };
}
const kinds = (ts: Tile[]) => sortTiles(ts).map(kindOf);

// ── Scoring ────────────────────────────────────────────────────────────────

describe("decompose / isComplete", () => {
  it("finds 4 sets + pair", () => {
    expect(isComplete(tiles("m1 m2 m3 p4 p5 p6 s7 s8 s9 w1 w1 w1 d1 d1"), [])).toBe(true);
    expect(isComplete(tiles("m1 m2 m3 p4 p5 p6 s7 s8 s9 w1 w1 w2 d1 d1"), [])).toBe(false);
  });
  it("counts melds toward the 14", () => {
    expect(isComplete(tiles("m1 m2 m3 d1 d1"), [meld("pung", "w1 w1 w1"), meld("chow", "p1 p2 p3"), meld("kong", "s9 s9 s9 s9")])).toBe(true);
    expect(isComplete(tiles("m1 m2 m3 d1 d1 s5"), [meld("pung", "w1 w1 w1"), meld("chow", "p1 p2 p3"), meld("kong", "s9 s9 s9 s9")])).toBe(false);
  });
  it("thirteen orphans", () => {
    expect(isComplete(tiles("m1 m9 p1 p9 s1 s9 w1 w2 w3 w4 d1 d2 d3 d3"), [])).toBe(true);
    expect(decompose(tiles("m1 m9 p1 p9 s1 s9 w1 w2 w3 w4 d1 d2 d3 d3")).length).toBe(0);
  });
  it("ambiguous hands give several decompositions", () => {
    // 111 222 333 can be 3 pungs or 3 chows
    expect(decompose(tiles("m1 m1 m1 m2 m2 m2 m3 m3 m3 p5 p6 p7 d1 d1")).length).toBeGreaterThan(1);
  });
  it("waitingOn lists every completing kind", () => {
    expect(waitingOn(tiles("m1 m2 m3 p4 p5 p6 s7 s8 s9 w1 w1 w1 d1"), [])).toEqual(["d1"]);
    expect(waitingOn(tiles("m1 m2 m3 p4 p5 p6 s7 s8 w1 w1 w1 d1 d1"), []).sort()).toEqual(["s6", "s9"]);
    expect(waitingOn(tiles("m1 m2"), [])).toEqual([]);
  });
});

describe("score: fan table", () => {
  it("chicken hand is complete but illegal", () => {
    const r = score(tiles("m1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 d1 d1"), [], ctx({ flowers: [t1("f2")] }));
    expect(r).not.toBeNull();
    expect(r!.total).toBe(1); // 門前清 only
    expect(r!.legal).toBe(false);
  });
  it("no flowers + self-drawn concealed = 3, legal", () => {
    const r = score(tiles("m1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 d1 d1"), [], ctx({ flowers: [], selfDrawn: true }));
    expect(fanNames(r)).toEqual(["無花", "自摸", "門清自摸"]);
    expect(r!.total).toBe(3);
    expect(r!.legal).toBe(true);
  });
  it("all chows only without honours", () => {
    expect(fanNames(score(tiles("m1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 p1 p1"), [], ctx()))).toContain("平糊");
    expect(fanNames(score(tiles("m1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 d1 d1"), [], ctx()))).not.toContain("平糊");
  });
  it("all pungs 3, dragon pung 1, seat + round wind each 1", () => {
    const r = score(tiles("m1 m1 m1 p4 p4 p4 w1 w1 w1 d1 d1 d1 s2 s2"), [], ctx());
    expect(fanNames(r)).toEqual(expect.arrayContaining(["對對糊", "三元牌", "門風", "圈風", "門前清"]));
    expect(r!.total).toBe(7);
  });
  it("pure one suit 7, mixed one suit 3", () => {
    expect(score(tiles("m1 m2 m3 m4 m5 m6 m7 m8 m9 m2 m3 m4 m5 m5"), [], ctx())!.fans.find((f) => f.zh === "清一色")!.fan).toBe(7);
    expect(score(tiles("m1 m2 m3 m4 m5 m6 m7 m8 m9 d1 d1 d1 m5 m5"), [], ctx())!.fans.find((f) => f.zh === "混一色")!.fan).toBe(3);
  });
  it("mixed terminals 4 replaces all pungs", () => {
    const r = score(tiles("m1 m1 m1 p9 p9 p9 w1 w1 w1 d1 d1 d1 s1 s1"), [], ctx());
    expect(fanNames(r)).toContain("混么九");
    expect(fanNames(r)).not.toContain("對對糊");
    expect(r!.fans.find((f) => f.zh === "混么九")!.fan).toBe(4);
  });
  it("mixed terminals needs an honour and a terminal pair", () => {
    expect(fanNames(score(tiles("m1 m1 m1 p9 p9 p9 s1 s1 s1 m9 m9 m9 s9 s9"), [], ctx()))).not.toContain("混么九"); // 清么九
    expect(fanNames(score(tiles("m1 m1 m1 p9 p9 p9 w1 w1 w1 d1 d1 d1 s5 s5"), [], ctx()))).not.toContain("混么九");
  });
  it("four concealed pungs self-drawn = limit; on a discard it is just all pungs", () => {
    const hand = tiles("m2 m2 m2 p4 p4 p4 s6 s6 s6 p7 p7 p7 s2 s2");
    expect(score(hand, [], ctx({ selfDrawn: true }))!.total).toBe(LIMIT);
    expect(fanNames(score(hand, [], ctx({ selfDrawn: true })))).toContain("坎坎糊");
    const open = score(hand, [], ctx());
    expect(fanNames(open)).not.toContain("坎坎糊");
    expect(fanNames(open)).toContain("對對糊");
  });
  it("a concealed kong still counts as concealed for 坎坎糊", () => {
    const r = score(tiles("m2 m2 m2 p4 p4 p4 s6 s6 s6 s2 s2"), [meld("kong", "p7 p7 p7 p7", true)], ctx({ selfDrawn: true }));
    expect(fanNames(r)).toContain("坎坎糊");
  });
  it("big three dragons 8, little three dragons 5", () => {
    expect(score(tiles("d1 d1 d1 d2 d2 d2 d3 d3 d3 m1 m2 m3 s5 s5"), [], ctx())!.fans.find((f) => f.zh === "大三元")!.fan).toBe(8);
    expect(score(tiles("d1 d1 d1 d2 d2 d2 d3 d3 m1 m2 m3 s5 s6 s7"), [], ctx())!.fans.find((f) => f.zh === "小三元")!.fan).toBe(5);
  });
  it("limit hands cap at 13", () => {
    expect(score(tiles("m1 m9 p1 p9 s1 s9 w1 w2 w3 w4 d1 d2 d3 d3"), [], ctx({ selfDrawn: true, flowers: [] }))!.total).toBe(LIMIT);
    expect(score(tiles("m1 m1 m1 m2 m3 m4 m5 m6 m7 m8 m9 m9 m9 m5"), [], ctx())!.fans.map((f) => f.zh)).toContain("九蓮寶燈");
    expect(score(tiles("w1 w1 w1 w2 w2 w2 w3 w3 w3 w4 w4 w4 d1 d1"), [], ctx())!.total).toBe(LIMIT);
  });
  it("situational fan: last tile, after kong, robbing, heavenly, earthly", () => {
    const hand = tiles("m1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 d1 d1");
    expect(fanNames(score(hand, [], ctx({ lastTile: true })))).toContain("海底撈月");
    expect(fanNames(score(hand, [], ctx({ afterKong: true, selfDrawn: true })))).toContain("槓上開花");
    expect(fanNames(score(hand, [], ctx({ robbedKong: true })))).toContain("搶槓");
    expect(fanNames(score(hand, [], ctx({ firstTurn: true, isDealer: true, selfDrawn: true })))).toContain("天糊");
    expect(fanNames(score(hand, [], ctx({ firstTurn: true, isDealer: false })))).toContain("地糊");
  });
  it("picks the best decomposition", () => {
    // 111222333 + 555 as pungs → 對對糊 3; as chows 123 123 123 + 555 → nothing. Must choose pungs.
    const r = score(tiles("m1 m1 m1 m2 m2 m2 m3 m3 m3 p5 p5 p5 d1 d1"), [], ctx());
    expect(fanNames(r)).toContain("對對糊");
  });
  it("wrong tile count returns null", () => {
    expect(score(tiles("m1 m2 m3"), [], ctx())).toBeNull();
  });
});

describe("payouts", () => {
  it("self-draw: everyone pays full", () => {
    expect(payouts(3, 0, null)).toEqual([24, -8, -8, -8]);
  });
  it("discard: shooter full, others half", () => {
    expect(payouts(3, 0, 2)).toEqual([16, -4, -8, -4]);
  });
  it("clamps to the table", () => {
    expect(payouts(20, 1, null)[1]).toBe(384 * 3);
  });
});

// ── Claims ─────────────────────────────────────────────────────────────────

describe("claimOptions / chowSets", () => {
  it("chow only from the left", () => {
    const hand = tiles("m1 m2 p5 p5 s9");
    expect(claimOptions(hand, t1("m3"), true)).toEqual(["chow"]);
    expect(claimOptions(hand, t1("m3"), false)).toEqual([]);
    expect(claimOptions(hand, t1("p5"), false)).toEqual(["pung"]);
  });
  it("kong needs three in hand", () => {
    expect(claimOptions(tiles("p5 p5 p5"), t1("p5"), false)).toEqual(["kong", "pung"]);
  });
  it("honours never chow", () => {
    expect(chowSets(tiles("w1 w2"), t1("w3"))).toEqual([]);
  });
  it("lists every chow shape and bestChow keeps the strongest rest", () => {
    const hand = tiles("m1 m2 m4 m5 m6 m6 m7");
    const sets = chowSets(hand, t1("m3"));
    expect(sets.length).toBe(3);
    const idx = bestChow(hand, t1("m3"), []);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(3);
  });
});

describe("engine: discard → claim → resolve", () => {
  it("chow from the left, and the human's chow pick is honoured", () => {
    const g = rig({
      hands: ["m1 m2 m4 m5 p5 p5 s9 s9 s9 w1 w2 w3 d1", "p1 p2 p3 s1 s2 s3 w4 w4 w4 d1 d1 m9 m9 m8", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d2", "m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3 m3 m3"],
      turn: 3,
    });
    const g2 = E.discard(g, 3, g.players[3].hand.find((x) => kindOf(x) === "m3")!.id);
    expect(g2.phase).toBe("claim");
    expect(g2.humanClaims).toEqual(["chow"]);
    const sets = E.humanChowSets(g2);
    expect(sets.length).toBe(3); // 1-2-[3], 2-[3]-4, [3]-4-5
    const g3 = E.resolveClaims(g2, "chow", 2);
    expect(g3.turn).toBe(0);
    expect(g3.phase).toBe("discard");
    expect(kinds(g3.players[0].melds[0].tiles)).toEqual(["m3", "m4", "m5"]);
    expect(g3.players[3].discards.length).toBe(0); // the tile left the pool
  });
  it("chow is not offered from across the table", () => {
    const g = rig({
      hands: ["m1 m2 m4 m5 p5 p5 s9 s9 s9 w1 w2 w3 d1", "p1 p2 p3 s1 s2 s3 w4 w4 w4 d1 d1 m9 m9 m8", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 m3 m3", "m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3 m3"],
      turn: 2,
    });
    const g2 = E.discard(g, 2, g.players[2].hand.find((x) => kindOf(x) === "m3")!.id);
    expect(g2.humanClaims).toEqual([]);
  });
  it("win beats pung beats chow; closest wins the race", () => {
    // seat 1 discards p5; seat 2 can pung; seat 3 can win. Win wins.
    const g = rig({
      hands: ["m1 m2 m4 m8 p9 p9 s9 s9 s9 w1 w2 w3 d1", "p1 p2 p3 s1 s2 s3 w4 w4 w4 d1 d1 m9 m9 p5", "p5 p5 m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2", "p5 m1 m2 m3 p1 p2 p3 s1 s1 s1 d2 d2 d2"],
      turn: 1, difficulty: "hard",
    });
    const g2 = E.discard(g, 1, g.players[1].hand.find((x) => kindOf(x) === "p5")!.id);
    expect(g2.phase).toBe("handOver");
    expect(g2.result!.kind).toBe("win");
    if (g2.result!.kind === "win") {
      expect(g2.result!.winner).toBe(3);
      expect(g2.result!.shooter).toBe(1);
      expect(g2.players[3].score).toBeGreaterThan(0);
      expect(g2.players[1].score).toBeLessThan(0);
      expect(g2.players[1].score).toBe(2 * g2.players[0].score);
    }
  });
  it("a chicken hand cannot be claimed as a win", () => {
    // seat 3 would complete with no fan (flowers present → no 無花)
    const g = rig({
      hands: ["m1 m2 m4 m8 p9 p9 s9 s9 s9 w1 w2 w3 d1", "p1 p2 p3 s1 s2 s3 w4 w4 w4 d1 d1 m9 m9 p5", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3", "p5 m1 m2 m3 p1 p2 p3 s2 s3 s4 m7 m8 m9"],
      turn: 1,
    });
    g.players[3].flowers = [t1("f6")];
    const g2 = E.discard(g, 1, g.players[1].hand.find((x) => kindOf(x) === "p5")!.id);
    expect(g2.phase).not.toBe("handOver");
    expect(g2.humanClaims).toEqual([]);
  });
  it("pass moves the turn to the next seat", () => {
    const g = rig({
      hands: ["m1 m2 m4 m5 p5 p5 s9 s9 s9 w1 w2 w3 d1", "p1 p2 p3 s1 s2 s3 w4 w4 w4 d1 d1 m9 m9 m8", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d2", "m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3 m3 m3"],
      turn: 3,
    });
    const g2 = E.discard(g, 3, g.players[3].hand.find((x) => kindOf(x) === "m3")!.id);
    const g3 = E.resolveClaims(g2, null);
    expect(g3.phase).toBe("draw");
    expect(g3.turn).toBe(0);
    expect(g3.players[3].discards.length).toBe(1);
  });
});

// ── Kongs ──────────────────────────────────────────────────────────────────

describe("kongs", () => {
  it("concealed kong draws a replacement from the wall tail and sets afterKong", () => {
    const g = rig({ hands: ["m1 m1 m1 m1 p5 p5 s9 s9 s9 w1 w2 w3 d1 d2", "m9 m9 p1 p2 p3 s1 s2 s3 w4 w4 w4 d1 d1", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d2", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3"], wall: "p2 p3 p4 s7" });
    expect(E.kongOptions(g, 0)).toEqual(["m1"]);
    const g2 = E.declareKong(g, 0, "m1");
    expect(g2.players[0].melds[0]).toMatchObject({ kind: "kong", concealed: true });
    expect(g2.players[0].hand.length).toBe(11);
    expect(kindOf(g2.players[0].hand.find((t) => t.id === g2.drawnId)!)).toBe("s7");
    expect(g2.wall.length).toBe(3);
    expect(g2.afterKong).toBe(true);
    expect(g2.phase).toBe("discard");
  });
  it("small kong can be robbed; human declining lets a later bot rob", () => {
    // seat 3 adds p5 to an exposed pung. Order round the table is 0 (human), 1, 2 —
    // the human is asked first; seat 1 also waits on p5 with fan.
    const g = rig({
      hands: ["m1 m2 m3 p1 p2 p3 s1 s1 s1 d1 d1 d1 p5", "m4 m5 m6 p7 p8 p9 s1 s2 s3 d3 d3 d3 p5", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3", "p5 m6 m7 m8 s2 s3 s4 w1 w2 w3 d2"],
      melds: [[], [], [], [meld("pung", "p5 p5 p5")]],
      turn: 3,
    });
    const g2 = E.declareKong(g, 3, "p5");
    expect(g2.phase).toBe("rob");
    expect(g2.pendingKong!.seat).toBe(3);
    const g3 = E.declineRob(g2);
    expect(g3.phase).toBe("handOver");
    expect(g3.result!.kind).toBe("win");
    if (g3.result!.kind === "win") {
      expect(g3.result!.winner).toBe(1);
      expect(g3.result!.shooter).toBe(3);
      expect(g3.result!.score.fans.map((f) => f.zh)).toContain("搶槓");
    }
    // the pung was restored on the kong declarer
    expect(g3.players[3].melds[0].kind).toBe("pung");
    expect(g3.players[3].melds[0].tiles.length).toBe(3);
  });
  it("a closer bot robs before the human is even asked", () => {
    const g = rig({
      hands: ["m1 m2 m3 p1 p2 p3 s1 s1 s1 d1 d1 d1 p5", "p5 m6 m7 m8 s2 s3 s4 w1 w2 w3 d2", "m4 m5 m6 p7 p8 p9 s1 s2 s3 d3 d3 d3 p5", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3"],
      melds: [[], [meld("pung", "p5 p5 p5")], [], []],
      turn: 1,
    });
    const g2 = E.declareKong(g, 1, "p5");
    expect(g2.phase).toBe("handOver");
    expect(g2.result!.kind === "win" && g2.result!.winner).toBe(2);
  });
  it("declining with nobody else able just draws the replacement", () => {
    const g = rig({
      hands: ["m1 m2 m3 p1 p2 p3 s1 s1 s1 d1 d1 d1 p5", "m4 m5 m6 p7 p8 p9 s1 s2 s3 d3 d3 w4 w4", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3", "p5 m6 m7 m8 s2 s3 s4 w1 w2 w3 d2"],
      melds: [[], [], [], [meld("pung", "p5 p5 p5")]],
      turn: 3,
    });
    const g3 = E.declineRob(E.declareKong(g, 3, "p5"));
    expect(g3.phase).toBe("discard");
    expect(g3.turn).toBe(3);
    expect(g3.players[3].melds[0].kind).toBe("kong");
    expect(g3.afterKong).toBe(true);
  });
  it("human robbing the kong wins", () => {
    const g = rig({
      hands: ["m1 m2 m3 p1 p2 p3 s1 s1 s1 d1 d1 d1 p5", "p5 m6 m7 m8 s2 s3 s4 w1 w2 w3 d2", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3"],
      melds: [[], [meld("pung", "p5 p5 p5")], [], []],
      turn: 1,
    });
    const g2 = E.declareKong(g, 1, "p5");
    expect(g2.phase).toBe("rob");
    const g3 = E.robKong(g2, 0);
    expect(g3.phase).toBe("handOver");
    expect(g3.result!.kind === "win" && g3.result!.winner).toBe(0);
  });
});

// ── Hand / round progression ───────────────────────────────────────────────

describe("dealer rotation and game end", () => {
  const won = (g: E.Game, winner: Seat): E.Game => ({
    ...g, phase: "handOver",
    result: { kind: "win", winner, shooter: null, score: { fans: [], total: 3, legal: true }, deltas: [0, 0, 0, 0], winningTile: t1("m1") },
  });
  const drawn = (g: E.Game): E.Game => ({ ...g, phase: "handOver", result: { kind: "draw" } });

  it("dealer keeps the deal on a win or a draw, streak counts", () => {
    let g = E.newGame("normal");
    g = E.nextHand(won(g, 0));
    expect(g.dealer).toBe(0);
    expect(g.streak).toBe(1);
    g = E.nextHand(drawn(g));
    expect(g.dealer).toBe(0);
    expect(g.streak).toBe(2);
    g = E.nextHand(won(g, 2));
    expect(g.dealer).toBe(1);
    expect(g.streak).toBe(0);
    expect(g.roundWind).toBe(0);
  });
  it("round wind advances when the deal returns to seat 0", () => {
    let g = E.newGame("normal");
    for (let i = 0; i < 4; i++) g = E.nextHand(won(g, ((g.dealer + 1) % 4) as Seat));
    expect(g.dealer).toBe(0);
    expect(g.roundWind).toBe(1);
  });
  it("game ends after North round's last dealer passes, not after 16 hands", () => {
    let g = E.newGame("normal");
    // 3 dealer wins first — 3 extra hands
    for (let i = 0; i < 3; i++) g = E.nextHand(won(g, 0));
    for (let i = 0; i < 15; i++) {
      g = E.nextHand(won(g, ((g.dealer + 1) % 4) as Seat));
      expect(g.phase).not.toBe("gameOver");
    }
    expect(g.dealer).toBe(3);
    expect(g.roundWind).toBe(3);
    expect(g.handNo).toBe(18);
    g = E.nextHand(drawn(g));
    expect(g.phase).not.toBe("gameOver"); // draw keeps the last dealer
    g = E.nextHand(won(g, 1));
    expect(g.phase).toBe("gameOver");
  });
  it("startHand deals 13 each, flowers replaced, dealer to act", () => {
    const g = E.newGame("easy");
    expect(g.phase).toBe("draw");
    expect(g.turn).toBe(0);
    for (const p of g.players) {
      expect(p.hand.length).toBe(13);
      expect(p.hand.some((t) => t.suit === "f")).toBe(false);
    }
    const total = g.wall.length + g.players.reduce((s, p) => s + p.hand.length + p.flowers.length, 0);
    expect(total).toBe(144);
  });
  it("draw on an empty wall ends the hand", () => {
    const g = { ...E.newGame("easy"), wall: [] as Tile[], phase: "draw" as const };
    const g2 = E.draw(g);
    expect(g2.phase).toBe("handOver");
    expect(g2.result).toEqual({ kind: "draw" });
  });
});

// ── Bots ───────────────────────────────────────────────────────────────────

describe("bots", () => {
  const view = (hand: string, difficulty: E.Game["difficulty"], opponents: BotView["opponents"] = [], visible = ""): BotView => ({
    hand: sortTiles(tiles(hand)), melds: [], visible: tiles(visible || "w4"), humanDiscards: [], opponents, difficulty,
    fanCtx: { banked: 1, seatWind: 1, roundWind: 0 },
  });
  it("never discards a tile it does not hold, on any difficulty", () => {
    for (const d of ["easy", "normal", "hard", "expert"] as const) {
      for (let i = 0; i < 20; i++) {
        const v = view("m1 m2 m3 p4 p5 p6 s7 s8 s9 w1 w1 d1 d2 m9", d);
        const t = chooseDiscard(v);
        expect(v.hand.some((x) => x.id === t.id)).toBe(true);
      }
    }
  });
  it("threat grows with melds and discards", () => {
    expect(threatOf({ discards: [], meldCount: 0 })).toBe(0);
    expect(threatOf({ discards: tiles("m1 m2 m3 m4 m5 m6 m7 m8 m9 p1"), meldCount: 3 })).toBeGreaterThan(1);
  });
  it("a tile the threat already discarded is safe; a fresh middle tile is not", () => {
    const opp = { discards: tiles("s5 m1 m9 p1 p9 w1 w2 w3 d1 d2"), meldCount: 3 };
    const v = view("m1 m2 m3 p4 p5 p6 s7 s8 s9 w1 w1 d1 d2 s5", "expert", [opp]);
    expect(dangerOf("s5", v)).toBe(0);
    expect(dangerOf("p5", v)).toBeGreaterThan(dangerOf("p1", v));
    expect(dangerOf("w4", v)).toBeLessThan(dangerOf("p5", v));
  });
  it("expert folds to a safe tile when far from ready and threatened", () => {
    // Hand is junk; p5 is the 'efficient' throw (isolated middle) but s5 was thrown by the threat.
    const opp = { discards: tiles("s5 m1 m9 p1 p9 w2 w3 d2 m2 p3 s8"), meldCount: 3 };
    const v = view("m1 m4 m7 p2 p5 p8 s3 s6 s9 w1 w4 d1 s5 d3", "expert", [opp, opp, opp]);
    const t = chooseDiscard(v);
    expect(dangerOf(kindOf(t), v)).toBe(0);
    // and the attack-only pick would have been a live tile
    const attack = chooseDiscard({ ...v, difficulty: "normal" });
    expect(dangerOf(kindOf(attack), v)).toBeGreaterThan(0);
  });
  it("expert is deterministic", () => {
    const v = view("m1 m2 m3 p4 p5 p6 s7 s8 s9 w1 w1 d1 d2 m9", "expert");
    const a = chooseDiscard(v).id;
    for (let i = 0; i < 10; i++) expect(chooseDiscard(v).id).toBe(a);
  });
  it("bots refuse a claim that leaves the hand under three fan", () => {
    // 2 chows + flowers banked 1: opening with a chow can't reach 3 fan
    const v: BotView = { ...view("m1 m2 p4 p5 p6 s7 s8 s9 w1 w2 d1 d2 m9", "normal"), fanCtx: { banked: 1, seatWind: 1, roundWind: 0 } };
    expect(chooseClaim(v, t1("m3"), true)).toBeNull();
  });
  it("easy never chows", () => {
    const v = view("m1 m2 p4 p5 p6 s7 s8 s9 w1 w1 w1 d1 d1", "easy");
    expect(chooseClaim(v, t1("m3"), true)).toBeNull();
  });
  it("selfWinScore refuses a chicken hand and accepts a legal one", () => {
    const g = rig({ hands: ["m1 m2 m3 p4 p5 p6 s7 s8 s9 m5 m6 m7 d1 d1", "m9 m9 p1 p2 p3 s1 s2 s3 w4 w4 w4 d2 d2", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3", "m5 m6 m7 p7 p8 p9 s4 s5 s6 w2 w2 d2 d3"] });
    g.players[0].flowers = [t1("f2")]; // not the seat flower → no fan from it
    expect(E.selfWinScore(g, 0)).toBeNull();
    g.players[0].flowers = [];
    expect(E.selfWinScore(g, 0)!.total).toBe(3);
  });
  it("a full game against bots always terminates and keeps 144 tiles", () => {
    let g = E.newGame("expert");
    let steps = 0;
    while (g.phase !== "gameOver" && steps++ < 20000) {
      if (g.phase === "draw") g = E.draw(g);
      else if (g.phase === "discard") {
        if (g.turn === E.HUMAN) {
          // human plays like a normal bot
          g = E.botAct({ ...g, difficulty: "normal" });
          g = { ...g, difficulty: "expert" };
        } else g = E.botAct(g);
      } else if (g.phase === "claim") g = E.resolveClaims(g, g.humanClaims.includes("win") ? "win" : null);
      else if (g.phase === "rob") g = E.robKong(g, E.HUMAN);
      else if (g.phase === "handOver") {
        const total = g.wall.length + g.players.reduce((s, p) => s + p.hand.length + p.flowers.length + p.discards.length + p.melds.reduce((m, x) => m + x.tiles.length, 0), 0);
        expect(total).toBe(144);
        expect(g.players.reduce((s, p) => s + p.score, 0)).toBe(0);
        g = E.nextHand(g);
      }
    }
    expect(g.phase).toBe("gameOver");
    expect(g.handNo).toBeGreaterThanOrEqual(15);
  }, 30_000); // a whole four-wind game — ~3.5s idle, past the 5s default on a busy runner
});

void MIN_FAN;
