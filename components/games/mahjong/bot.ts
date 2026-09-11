// components/games/mahjong/bot.ts
// Bot decisions and the hand-efficiency evaluator the hints reuse. Pure.
//
// The evaluator is a small search: count how close 13 tiles are to "4 sets +
// pair" by greedily extracting sets, then partial sets (pairs, adjacent and
// gapped pairs), and score the remainder. Not full shanten, but on a 13-tile
// hand it agrees with it almost always and runs in microseconds.

import { type Tile, type Kind, kindOf, isHonour, isSuited, countKinds } from "./tiles";
import { type Meld, isComplete, waitingOn } from "./scoring";

export type Difficulty = "easy" | "normal" | "hard";

// ── Efficiency ─────────────────────────────────────────────────────────────

const memo = new Map<string, number>();

/**
 * Higher = closer to a complete hand. Counts each full set as 4, partial as
 * 2, pair as 2 (one pair may be "eyes"), so a finished hand scores 4·sets+2.
 */
export function efficiency(tiles: Tile[], meldCount: number): number {
  const counts = countKinds(tiles);
  const key = [...counts.entries()].sort().map(([k, c]) => k + c).join("") + "|" + meldCount;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const kinds = [...counts.keys()].sort();
  const setsNeeded = 4 - meldCount;

  let best = -Infinity;
  function rec(i: number, sets: number, partials: number, pair: boolean) {
    while (i < kinds.length && (counts.get(kinds[i]) ?? 0) === 0) i++;
    if (i === kinds.length) {
      // partials beyond what can still become sets are worth less
      const usefulPartials = Math.min(partials, setsNeeded - sets);
      const v = sets * 4 + usefulPartials * 2 + (pair ? 2 : 0) + (partials - usefulPartials) * 0.5;
      if (v > best) best = v;
      return;
    }
    const k = kinds[i];
    const c = counts.get(k)!;
    const s = k[0], r = Number(k.slice(1));
    const suited = s === "m" || s === "p" || s === "s";
    const k2 = `${s}${r + 1}`, k3 = `${s}${r + 2}`;
    const c2 = suited && r <= 8 ? counts.get(k2) ?? 0 : 0;
    const c3 = suited && r <= 7 ? counts.get(k3) ?? 0 : 0;

    if (c >= 3 && sets < setsNeeded) { counts.set(k, c - 3); rec(i, sets + 1, partials, pair); counts.set(k, c); }
    if (suited && c2 && c3 && sets < setsNeeded) {
      counts.set(k, c - 1); counts.set(k2, c2 - 1); counts.set(k3, c3 - 1);
      rec(i, sets + 1, partials, pair);
      counts.set(k, c); counts.set(k2, c2); counts.set(k3, c3);
    }
    if (c >= 2) {
      counts.set(k, c - 2);
      if (!pair) rec(i, sets, partials, true);
      rec(i, sets, partials + 1, pair);
      counts.set(k, c);
    }
    if (suited && c2) { counts.set(k, c - 1); counts.set(k2, c2 - 1); rec(i, sets, partials + 1, pair); counts.set(k, c); counts.set(k2, c2); }
    if (suited && c3) { counts.set(k, c - 1); counts.set(k3, c3 - 1); rec(i, sets, partials + 1, pair); counts.set(k, c); counts.set(k3, c3); }
    // leave it isolated
    counts.set(k, c - 1); rec(i, sets, partials, pair); counts.set(k, c);
  }
  rec(0, 0, 0, false);
  if (memo.size > 20000) memo.clear();
  memo.set(key, best);
  return best;
}

export type FanCtx = {
  /** Fan already banked from flowers (none = 1, else seat flowers). */
  banked: number;
  seatWind: number;
  roundWind: number;
};

/**
 * Rough ceiling on the fan this shape can reach. Not a score — a steering
 * signal so the bot builds toward a legal (≥3 fan) hand instead of the
 * fastest chicken hand, which under HK rules it can never declare.
 */
export function fanPotential(hand: Tile[], melds: Meld[], ctx: FanCtx): number {
  const all = [...hand, ...melds.flatMap((m) => m.tiles)];
  const counts = countKinds(hand);
  let fan = ctx.banked;
  // concealed self-draw path
  if (melds.length === 0) fan += 2;
  // flush
  const bySuit = { m: 0, p: 0, s: 0 };
  let honours = 0;
  for (const t of all) { if (isSuited(t)) bySuit[t.suit as "m" | "p" | "s"]++; else honours++; }
  const dom = Math.max(bySuit.m, bySuit.p, bySuit.s);
  const offSuit = all.length - dom - honours;
  if (offSuit === 0 && dom >= 9) fan += honours ? 3 : 7;
  else if (offSuit <= 2 && dom >= 8) fan += honours ? 1.5 : 3;
  else if (offSuit <= 4 && dom >= 7) fan += honours ? 0.75 : 1.5;
  // pungs
  // All-pungs is only live while every hand tile sits in a pair or better,
  // bar one single (the eventual pair wait) — a run partial kills it.
  const pungLike = melds.filter((m) => m.kind !== "chow").length + [...counts.values()].filter((c) => c >= 2).length;
  const singles = [...counts.values()].filter((c) => c === 1).length;
  const chows = melds.filter((m) => m.kind === "chow").length;
  if (chows === 0 && singles <= 1 && pungLike >= 4) fan += 3;
  else if (chows === 0 && singles <= 2 && pungLike >= 3) fan += 1.5;
  // honour sets
  for (const [k, c] of counts) {
    if (c < 2) continue;
    if (k[0] === "d") fan += 1;
    if (k[0] === "w") { const w = Number(k[1]) - 1; if (w === ctx.seatWind) fan += 1; if (w === ctx.roundWind) fan += 1; }
  }
  for (const m of melds) {
    if (m.kind === "chow") continue;
    const t = m.tiles[0];
    if (t.suit === "d") fan += 1;
    if (t.suit === "w") { if (t.rank - 1 === ctx.seatWind) fan += 1; if (t.rank - 1 === ctx.roundWind) fan += 1; }
  }
  return fan;
}

/** Efficiency + fan steering. Below the 3-fan floor the slope is steep so the
 *  bot actively reshapes; above it, more fan is nice but speed wins. */
export function handValue(tiles: Tile[], melds: Meld[], ctx: FanCtx): number {
  const fp = fanPotential(tiles, melds, ctx);
  return efficiency(tiles, melds.length) + (fp >= 3 ? Math.min(fp, 8) * 0.6 : (fp - 3) * 4);
}

/** Rank every tile in a 14-tile hand by how good the hand is without it. Best discard first. */
export function rankDiscards(hand: Tile[], melds: Meld[], visible: Tile[], fanCtx?: FanCtx): Tile[] {
  const seen = countKinds(visible);
  const inHand = countKinds(hand);
  const scored = hand.map((t) => {
    const rest = hand.filter((x) => x.id !== t.id);
    let v = fanCtx ? handValue(rest, melds, fanCtx) : efficiency(rest, melds.length);
    // Tie-breakers: prefer throwing isolated honours and terminals, and tiles
    // whose partners are already dead (3+ visible elsewhere).
    const k = kindOf(t);
    const c = inHand.get(k) ?? 0;
    const copiesLeft = 4 - (seen.get(k) ?? 0) - c;
    if (isHonour(t) && c === 1) v += 0.4 + (copiesLeft <= 1 ? 0.3 : 0);
    if (isSuited(t) && (t.rank === 1 || t.rank === 9)) v += 0.2;
    return { t, v };
  });
  scored.sort((a, b) => b.v - a.v);
  return scored.map((s) => s.t);
}

// ── Decisions ──────────────────────────────────────────────────────────────

export type BotView = {
  hand: Tile[];
  melds: Meld[];
  /** Everything on the table the bot can see: all discards + exposed melds. */
  visible: Tile[];
  /** The human's own discards — Hard reads these as "safe to throw". */
  humanDiscards: Tile[];
  difficulty: Difficulty;
  fanCtx: FanCtx;
};

export function chooseDiscard(v: BotView): Tile {
  const ranked = rankDiscards(v.hand, v.melds, v.visible, v.fanCtx);
  if (v.difficulty === "easy") {
    // Easy plays like a beginner: right idea half the time, random the rest.
    if (Math.random() < 0.5) return ranked[Math.floor(Math.random() * ranked.length)];
    return ranked[0];
  }
  if (v.difficulty === "hard") {
    // Among the top few candidates, prefer one the human already threw
    // (they can't be waiting on it under HK rules if they discarded it recently
    // enough to matter — close enough for a bot).
    const safe = new Set(v.humanDiscards.map(kindOf));
    const top = ranked.slice(0, 3);
    const s = top.find((t) => safe.has(kindOf(t)));
    if (s) return s;
  }
  return ranked[0];
}

export type ClaimKind = "chow" | "pung" | "kong";

/** Which meld types this hand could make with `tile`. Chow only if `fromLeft`. */
export function claimOptions(hand: Tile[], tile: Tile, fromLeft: boolean): ClaimKind[] {
  const k = kindOf(tile);
  const same = hand.filter((t) => kindOf(t) === k).length;
  const out: ClaimKind[] = [];
  if (same >= 3) out.push("kong");
  if (same >= 2) out.push("pung");
  if (fromLeft && chowSets(hand, tile).length) out.push("chow");
  return out;
}

/** The distinct pairs of hand tiles that form a run with `tile`. */
export function chowSets(hand: Tile[], tile: Tile): [Tile, Tile][] {
  if (!isSuited(tile)) return [];
  const find = (r: number) => hand.find((t) => t.suit === tile.suit && t.rank === r);
  const out: [Tile, Tile][] = [];
  const a = find(tile.rank - 2), b = find(tile.rank - 1), c = find(tile.rank + 1), d = find(tile.rank + 2);
  if (a && b) out.push([a, b]);
  if (b && c) out.push([b, c]);
  if (c && d) out.push([c, d]);
  return out;
}

/**
 * Should the bot claim this discard? Returns the meld to make or null.
 * Easy never chows. Normal claims when it improves efficiency. Hard also
 * refuses to open a fully concealed hand for a small gain.
 */
export function chooseClaim(v: BotView, tile: Tile, fromLeft: boolean): ClaimKind | null {
  const opts = claimOptions(v.hand, tile, fromLeft);
  if (!opts.length) return null;
  const before = handValue(v.hand, v.melds, v.fanCtx);
  const k = kindOf(tile);

  const evalAfter = (kind: ClaimKind): number => {
    const { melds, after } = shapeAfter(kind);
    // Never open into a shape that cannot reach the 3-fan floor — the meld
    // is permanent, and a 2-fan hand can only ever draw.
    if (v.difficulty !== "easy" && fanPotential(after, melds, v.fanCtx) < 3) return -Infinity;
    return handValue(after, melds, v.fanCtx) + 4;
  };
  const shapeAfter = (kind: ClaimKind) => {
    let rest: Tile[];
    if (kind === "chow") {
      const [a, b] = chowSets(v.hand, tile)[0];
      rest = v.hand.filter((t) => t.id !== a.id && t.id !== b.id);
    } else {
      let n = kind === "kong" ? 3 : 2;
      rest = v.hand.filter((t) => { if (n > 0 && kindOf(t) === k) { n--; return false; } return true; });
    }
    // the bot will then discard one — take the best resulting 13
    const melds = [...v.melds, { kind, tiles: kind === "chow" ? [tile] : [tile, tile, tile] }];
    const ranked = rankDiscards(rest, melds, v.visible, v.fanCtx);
    return { melds, after: rest.filter((t) => t.id !== ranked[0].id) };
  };

  // Opening a concealed hand costs the 2 fan of 門清自摸, which is often the
  // difference between a legal win and a chicken hand. Demand a real gain
  // for the first claim; once open, anything that helps is fine.
  const threshold = v.melds.length === 0 ? (v.difficulty === "hard" ? 3 : 2) : 0;
  let best: ClaimKind | null = null, bestGain = threshold;
  for (const o of opts) {
    if (o === "chow" && v.difficulty === "easy") continue;
    const gain = evalAfter(o) - before;
    if (gain > bestGain) { bestGain = gain; best = o; }
  }
  // A pung is always worth it when already ready or nearly so
  if (!best && opts.includes("pung") && v.difficulty !== "easy" && waitingOn(v.hand, v.melds).length === 0 && before >= 12) best = "pung";
  return best;
}

/** Whether a 14-tile (hand + drawn/claimed tile) is a completed hand. */
export function canWin(hand14: Tile[], melds: Meld[]): boolean {
  return isComplete(hand14, melds);
}

/** Kinds in hand with 4 copies (concealed kong candidates). */
export function concealedKongs(hand: Tile[]): Kind[] {
  return [...countKinds(hand).entries()].filter(([, c]) => c === 4).map(([k]) => k);
}
