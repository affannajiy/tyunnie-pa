// components/games/mahjong/scoring.ts
// Hong Kong (Cantonese) scoring. Pure: hand in, fan list + points out.
//
// The fan table follows the common "old style" HK set with a 3-fan minimum
// and a 13-fan limit. Where tables disagree (little three dragons 5 vs 4,
// all honours 10 vs limit) the value used is the one most beginner guides
// print, since the in-game guide shows this same table.

import {
  type Tile,
  type Seat,
  type Kind,
  kindOf,
  isSuited,
  isHonour,
  isTerminal,
  countKinds,
} from "./tiles";

export type MeldKind = "chow" | "pung" | "kong";
export type Meld = {
  kind: MeldKind;
  tiles: Tile[];
  /** Concealed kong (declared from hand, never claimed). Counts as concealed. */
  concealed?: boolean;
};

export type WinContext = {
  seat: Seat;
  roundWind: Seat;
  isDealer: boolean;
  selfDrawn: boolean;
  /** Won on the very first draw/discard of the hand. */
  firstTurn: boolean;
  /** Wall was down to the dead wall when this tile came out. */
  lastTile: boolean;
  /** Winning tile was the replacement drawn after declaring a kong. */
  afterKong: boolean;
  /** Won by claiming the tile another player was adding to a pung. */
  robbedKong: boolean;
  flowers: Tile[];
};

export type Fan = { name: string; zh: string; fan: number };
export type ScoreResult = {
  fans: Fan[];
  /** Capped at LIMIT. */
  total: number;
  /** Chicken hand under the minimum — a complete hand that cannot be declared. */
  legal: boolean;
};

export const MIN_FAN = 3;
export const LIMIT = 13;

/** fan → base points one loser pays. Doubles per fan until 9, then eases off. */
export const POINTS: Record<number, number> = {
  3: 8, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96, 10: 128, 11: 192, 12: 256, 13: 384,
};

// ── Decomposition ──────────────────────────────────────────────────────────

type Set = { kind: "chow" | "pung"; tiles: Kind[] };
type Decomp = { sets: Set[]; pair: Kind };

function kindSuit(k: Kind) { return k[0]; }
function kindRank(k: Kind) { return Number(k.slice(1)); }

/** Every way to split `counts` into (n) sets + 1 pair. Empty if the hand is not complete. */
export function decompose(tiles: Tile[]): Decomp[] {
  const counts = countKinds(tiles);
  const kinds = [...counts.keys()].sort();
  const out: Decomp[] = [];

  function rec(i: number, sets: Set[], pair: Kind | null) {
    // skip exhausted kinds
    while (i < kinds.length && (counts.get(kinds[i]) ?? 0) === 0) i++;
    if (i === kinds.length) {
      if (pair) out.push({ sets: [...sets], pair });
      return;
    }
    const k = kinds[i];
    const c = counts.get(k)!;
    // pair
    if (!pair && c >= 2) {
      counts.set(k, c - 2);
      rec(i, sets, k);
      counts.set(k, c);
    }
    // pung
    if (c >= 3) {
      counts.set(k, c - 3);
      sets.push({ kind: "pung", tiles: [k, k, k] });
      rec(i, sets, pair);
      sets.pop();
      counts.set(k, c);
    }
    // chow (suited only, rank ≤ 7)
    const s = kindSuit(k), r = kindRank(k);
    if ((s === "m" || s === "p" || s === "s") && r <= 7) {
      const k2 = `${s}${r + 1}`, k3 = `${s}${r + 2}`;
      const c2 = counts.get(k2) ?? 0, c3 = counts.get(k3) ?? 0;
      if (c2 > 0 && c3 > 0) {
        counts.set(k, c - 1); counts.set(k2, c2 - 1); counts.set(k3, c3 - 1);
        sets.push({ kind: "chow", tiles: [k, k2, k3] });
        rec(i, sets, pair);
        sets.pop();
        counts.set(k, c); counts.set(k2, c2); counts.set(k3, c3);
      }
    }
  }
  rec(0, [], null);
  return out;
}

const ORPHANS = ["m1", "m9", "p1", "p9", "s1", "s9", "w1", "w2", "w3", "w4", "d1", "d2", "d3"];

export function isThirteenOrphans(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = countKinds(tiles);
  if (counts.size !== 13) return false;
  return ORPHANS.every((k) => (counts.get(k) ?? 0) >= 1);
}

/** 1112345678999 of one suit + any tile of that suit, fully concealed. */
function isNineGates(tiles: Tile[], melds: Meld[]): boolean {
  if (melds.length || tiles.length !== 14) return false;
  const suit = tiles[0].suit;
  if (!isSuited(tiles[0]) || tiles.some((t) => t.suit !== suit)) return false;
  const counts = countKinds(tiles);
  const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
  let extra = 0;
  for (let r = 1; r <= 9; r++) {
    const c = counts.get(`${suit}${r}`) ?? 0;
    if (c < need[r - 1]) return false;
    extra += c - need[r - 1];
  }
  return extra === 1;
}

/** True if `tiles` (concealed part incl. the winning tile) + melds form a complete hand. */
export function isComplete(tiles: Tile[], melds: Meld[]): boolean {
  if (tiles.length + melds.length * 3 !== 14) return false;
  return isThirteenOrphans(tiles) || decompose(tiles).length > 0;
}

// ── Scoring ────────────────────────────────────────────────────────────────

export function score(concealed: Tile[], melds: Meld[], ctx: WinContext): ScoreResult | null {
  if (concealed.length + melds.length * 3 !== 14) return null;

  const fans: Fan[] = [];
  const add = (name: string, zh: string, fan: number) => fans.push({ name, zh, fan });
  const allTiles = [...concealed, ...melds.flatMap((m) => m.tiles)];
  const fullyConcealed = melds.every((m) => m.concealed);

  // Flowers first — they apply to every hand shape.
  const seatFlowers = ctx.flowers.filter((f) => (f.rank - 1) % 4 === ctx.seat).length;
  if (ctx.flowers.length === 0) add("No flowers", "無花", 1);
  else if (ctx.flowers.length === 8) add("All flowers", "八仙過海", LIMIT);
  else if (seatFlowers) add(`Seat flower${seatFlowers > 1 ? "s" : ""}`, "正花", seatFlowers);

  // Situational
  if (ctx.firstTurn && ctx.isDealer && ctx.selfDrawn) add("Heavenly hand", "天糊", LIMIT);
  else if (ctx.firstTurn && !ctx.isDealer) add("Earthly hand", "地糊", LIMIT);
  if (ctx.selfDrawn) add("Self-drawn", "自摸", 1);
  if (fullyConcealed && !ctx.selfDrawn) add("Concealed hand", "門前清", 1);
  if (fullyConcealed && ctx.selfDrawn) add("Concealed self-draw", "門清自摸", 1);
  if (ctx.lastTile) add("Last tile", "海底撈月", 1);
  if (ctx.afterKong) add("Win off a kong", "槓上開花", 1);
  if (ctx.robbedKong) add("Robbing the kong", "搶槓", 1);

  // Limit hands that don't decompose normally
  if (isThirteenOrphans(concealed)) {
    add("Thirteen orphans", "十三么", LIMIT);
    return finish(fans);
  }
  if (isNineGates(concealed, melds)) {
    add("Nine gates", "九蓮寶燈", LIMIT);
    return finish(fans);
  }

  const decomps = decompose(concealed);
  if (!decomps.length) return null;

  // Pick the decomposition that scores best.
  let best: Fan[] | null = null;
  for (const d of decomps) {
    const f = scoreDecomp(d, melds, allTiles, ctx);
    if (!best || sum(f) > sum(best)) best = f;
  }
  return finish([...fans, ...best!]);
}

function scoreDecomp(d: Decomp, melds: Meld[], allTiles: Tile[], ctx: WinContext): Fan[] {
  const fans: Fan[] = [];
  const add = (name: string, zh: string, fan: number) => fans.push({ name, zh, fan });

  // Normalise every set into {kind, firstKind}
  const sets: { kind: MeldKind; k: Kind }[] = [
    ...d.sets.map((s) => ({ kind: s.kind, k: s.tiles[0] })),
    ...melds.map((m) => ({ kind: m.kind, k: kindOf(m.tiles[0]) })),
  ];
  const pungLike = sets.filter((s) => s.kind !== "chow");
  const kongs = sets.filter((s) => s.kind === "kong");
  const chows = sets.filter((s) => s.kind === "chow");

  const suits = new Set(allTiles.filter(isSuited).map((t) => t.suit));
  const honours = allTiles.some(isHonour);

  const dragonPungs = pungLike.filter((s) => kindSuit(s.k) === "d");
  const windPungs = pungLike.filter((s) => kindSuit(s.k) === "w");
  const pairSuit = kindSuit(d.pair);

  // Big hands first; each returns early where the small fan are subsumed.
  if (windPungs.length === 4) { add("Big four winds", "大四喜", LIMIT); return fans; }
  if (windPungs.length === 3 && pairSuit === "w") { add("Little four winds", "小四喜", 6); }
  if (dragonPungs.length === 3) { add("Big three dragons", "大三元", 8); }
  else if (dragonPungs.length === 2 && pairSuit === "d") { add("Little three dragons", "小三元", 5); }
  else {
    dragonPungs.forEach(() => add("Dragon pung", "三元牌", 1));
  }
  if (kongs.length === 4) { add("Four kongs", "十八羅漢", LIMIT); return fans; }

  if (suits.size === 0 && honours) { add("All honours", "字一色", 10); }
  else if (allTiles.every(isTerminal)) { add("All terminals", "清么九", 10); }
  else if (suits.size === 1 && !honours) { add("Pure one suit", "清一色", 7); }
  else if (suits.size === 1 && honours) { add("Mixed one suit", "混一色", 3); }

  if (pungLike.length === 4) add("All pungs", "對對糊", 3);
  else if (chows.length === 4 && !honours) add("All chows", "平糊", 1);

  // Seat / round wind pungs (a wind can be both → 2 fan)
  for (const s of windPungs) {
    const w = kindRank(s.k) - 1;
    if (w === ctx.seat) add("Seat wind", "門風", 1);
    if (w === ctx.roundWind) add("Round wind", "圈風", 1);
  }

  return fans;
}

function sum(f: Fan[]) { return f.reduce((s, x) => s + x.fan, 0); }

function finish(fans: Fan[]): ScoreResult {
  const total = Math.min(LIMIT, sum(fans));
  return { fans, total, legal: total >= MIN_FAN };
}

/**
 * Points each loser pays. Self-draw: all three pay full. Discard: the shooter
 * pays full, the other two pay half ("half-spicy" 半辣 — the common home rule).
 */
export function payouts(total: number, winner: Seat, shooter: Seat | null): number[] {
  const base = POINTS[Math.max(MIN_FAN, Math.min(LIMIT, total))];
  const delta = [0, 0, 0, 0];
  for (let s = 0; s < 4; s++) {
    if (s === winner) continue;
    const pay = shooter === null ? base : s === shooter ? base : base / 2;
    delta[s] -= pay;
    delta[winner] += pay;
  }
  return delta;
}

// ── Readiness (tenpai / 聽牌) — used by hints and the bots ─────────────────

const ALL_KINDS: Kind[] = [
  ...["m", "p", "s"].flatMap((s) => Array.from({ length: 9 }, (_, i) => `${s}${i + 1}`)),
  "w1", "w2", "w3", "w4", "d1", "d2", "d3",
];

/** Kinds that would complete `concealed` (13 tiles) + melds. */
export function waitingOn(concealed: Tile[], melds: Meld[]): Kind[] {
  if (concealed.length + melds.length * 3 !== 13) return [];
  const out: Kind[] = [];
  for (const k of ALL_KINDS) {
    const probe: Tile = { id: -1, suit: k[0] as Tile["suit"], rank: Number(k.slice(1)) };
    if (isComplete([...concealed, probe], melds)) out.push(k);
  }
  return out;
}
