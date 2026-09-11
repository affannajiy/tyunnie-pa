// components/games/mahjong/tiles.ts
// Tile definitions, wall construction and the small pure helpers every other
// mahjong module leans on. No React here — this file is what a throwaway
// script imports to sanity-check the scoring engine.

/** m = 萬 characters · p = 筒 dots · s = 條 bamboo · w = winds · d = dragons · f = flowers/seasons */
export type Suit = "m" | "p" | "s" | "w" | "d" | "f";

export type Tile = {
  /** Unique per physical tile (0–143) so React keys and "which copy" stay stable. */
  id: number;
  suit: Suit;
  /** 1–9 for suits · winds 1–4 = 東南西北 · dragons 1–3 = 中發白 · flowers 1–8 */
  rank: number;
};

/** "m3", "w1" … — identity of a tile *kind*, ignoring which of the 4 copies it is. */
export type Kind = string;

export const kindOf = (t: Tile): Kind => `${t.suit}${t.rank}`;
export const sameKind = (a: Tile, b: Tile) => a.suit === b.suit && a.rank === b.rank;
export const isSuited = (t: Tile) => t.suit === "m" || t.suit === "p" || t.suit === "s";
export const isHonour = (t: Tile) => t.suit === "w" || t.suit === "d";
export const isTerminal = (t: Tile) => isSuited(t) && (t.rank === 1 || t.rank === 9);
export const isFlower = (t: Tile) => t.suit === "f";

export const WIND_NAMES = ["東", "南", "西", "北"];
export const WIND_EN = ["East", "South", "West", "North"];
export const DRAGON_NAMES = ["中", "發", "白"];
export const FLOWER_NAMES = ["梅", "蘭", "菊", "竹", "春", "夏", "秋", "冬"];
export const SUIT_LABEL: Record<"m" | "p" | "s", string> = { m: "萬", p: "筒", s: "條" };

/** Seat 0 = East (dealer at game start), 1 = South, 2 = West, 3 = North. */
export type Seat = 0 | 1 | 2 | 3;
export const nextSeat = (s: Seat): Seat => ((s + 1) % 4) as Seat;
export const prevSeat = (s: Seat): Seat => ((s + 3) % 4) as Seat;

/** Sort order for display: 萬 → 筒 → 條 → winds → dragons, by rank within each. */
const SUIT_ORDER: Record<Suit, number> = { m: 0, p: 1, s: 2, w: 3, d: 4, f: 5 };
export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort(
    (a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.rank - b.rank || a.id - b.id,
  );
}

/** Full 144-tile set: 34 kinds × 4 + 8 flowers. */
export function buildWall(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (const suit of ["m", "p", "s"] as const)
    for (let rank = 1; rank <= 9; rank++)
      for (let c = 0; c < 4; c++) tiles.push({ id: id++, suit, rank });
  for (let rank = 1; rank <= 4; rank++)
    for (let c = 0; c < 4; c++) tiles.push({ id: id++, suit: "w", rank });
  for (let rank = 1; rank <= 3; rank++)
    for (let c = 0; c < 4; c++) tiles.push({ id: id++, suit: "d", rank });
  for (let rank = 1; rank <= 8; rank++) tiles.push({ id: id++, suit: "f", rank });
  // Fisher–Yates
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

/** Count of each kind in a tile list. */
export function countKinds(tiles: Tile[]): Map<Kind, number> {
  const m = new Map<Kind, number>();
  for (const t of tiles) m.set(kindOf(t), (m.get(kindOf(t)) ?? 0) + 1);
  return m;
}

/** Human-readable tile name for hints and the scoring sheet. */
export function tileName(t: Tile): string {
  if (t.suit === "w") return WIND_EN[t.rank - 1];
  if (t.suit === "d") return ["Red", "Green", "White"][t.rank - 1] + " dragon";
  if (t.suit === "f") return "Flower " + FLOWER_NAMES[t.rank - 1];
  return `${t.rank} ${{ m: "characters", p: "dots", s: "bamboo" }[t.suit]}`;
}
