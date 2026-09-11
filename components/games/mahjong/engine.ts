// components/games/mahjong/engine.ts
// Game state + pure transitions. The React component only schedules these
// and renders the result; every rule lives here so a throwaway script can
// drive a whole hand without a DOM.

import {
  type Tile,
  type Seat,
  type Kind,
  buildWall,
  kindOf,
  isFlower,
  nextSeat,
  prevSeat,
  sortTiles,
} from "./tiles";
import {
  type Meld,
  type ScoreResult,
  type WinContext,
  score,
  payouts,
} from "./scoring";
import {
  type Difficulty,
  type ClaimKind,
  type FanCtx,
  chooseDiscard,
  chooseClaim,
  claimOptions,
  chowSets,
  concealedKongs,
} from "./bot";

export const HUMAN: Seat = 0;
export { fanCtx };
/** Bottom → right → top → left, turn order. Tyunnie sits opposite. */
export const NAMES = ["You", "Beomgyu", "Tyunnie", "Yeonjun"];
/** HK plays the wall to the last tile — no dead wall. Kept as a constant so a
 *  variant with one is a one-line change. */
export const DEAD_WALL = 0;
export const HANDS_PER_GAME = 16;

export type Player = {
  hand: Tile[];
  melds: Meld[];
  flowers: Tile[];
  discards: Tile[];
  score: number;
};

export type Phase =
  | "setup"
  | "draw"      // `turn` is about to draw
  | "discard"   // `turn` holds 14 and must act (win / kong / discard)
  | "claim"     // human may claim `lastDiscard`; bots' answers precomputed
  | "rob"       // human may rob the kong `turn` is declaring
  | "handOver"
  | "gameOver";

export type Claim = { seat: Seat; kind: ClaimKind | "win" };

export type HandResult =
  | { kind: "draw" }
  | {
      kind: "win";
      winner: Seat;
      shooter: Seat | null;
      score: ScoreResult;
      deltas: number[];
      winningTile: Tile;
    };

export type Game = {
  phase: Phase;
  difficulty: Difficulty;
  wall: Tile[];
  players: Player[];
  dealer: Seat;
  roundWind: Seat;
  handNo: number;
  turn: Seat;
  /** Tile just drawn by `turn` — rendered apart from the sorted hand. */
  drawnId: number | null;
  lastDiscard: { tile: Tile; seat: Seat } | null;
  /** Human's legal claims on `lastDiscard` (phase "claim"). */
  humanClaims: (ClaimKind | "win")[];
  /** Bots' claims on `lastDiscard`, already decided. */
  botClaims: Claim[];
  /** Kong being declared (phase "rob"): tile + who. */
  pendingKong: { tile: Tile; seat: Seat } | null;
  discardCount: number;
  /** Set when the last live wall tile was drawn. */
  lastLive: boolean;
  afterKong: boolean;
  result: HandResult | null;
  /** Bumps on every transition so effects re-fire even if phase repeats. */
  tick: number;
};

export function newGame(difficulty: Difficulty): Game {
  return startHand({
    phase: "setup",
    difficulty,
    wall: [],
    players: Array.from({ length: 4 }, () => ({ hand: [], melds: [], flowers: [], discards: [], score: 0 })),
    dealer: 0,
    roundWind: 0,
    handNo: 0,
    turn: 0,
    drawnId: null,
    lastDiscard: null,
    humanClaims: [],
    botClaims: [],
    pendingKong: null,
    discardCount: 0,
    lastLive: false,
    afterKong: false,
    result: null,
    tick: 0,
  });
}

const bump = (g: Game): Game => ({ ...g, tick: g.tick + 1 });
const seatWind = (g: Game, s: Seat): Seat => (((s - g.dealer) % 4 + 4) % 4) as Seat;

function fanCtx(g: Game, s: Seat): FanCtx {
  const sw = seatWind(g, s);
  const fl = g.players[s].flowers;
  const banked = fl.length === 0 ? 1 : fl.filter((f) => (f.rank - 1) % 4 === sw).length;
  return { banked, seatWind: sw, roundWind: g.roundWind };
}

function clonePlayers(g: Game): Player[] {
  return g.players.map((p) => ({ ...p, hand: [...p.hand], melds: [...p.melds], flowers: [...p.flowers], discards: [...p.discards] }));
}

/** Pull from the back of the wall (dead-wall end) until a non-flower comes up. */
function replaceFlowers(wall: Tile[], p: Player) {
  for (;;) {
    const fi = p.hand.findIndex(isFlower);
    if (fi < 0) return;
    p.flowers.push(p.hand.splice(fi, 1)[0]);
    const r = wall.pop();
    if (!r) return;
    p.hand.push(r);
  }
}

export function startHand(g: Game): Game {
  const wall = buildWall();
  const players = g.players.map((p) => ({ ...p, hand: [] as Tile[], melds: [] as Meld[], flowers: [] as Tile[], discards: [] as Tile[] }));
  for (let i = 0; i < 13; i++) for (let s = 0; s < 4; s++) players[s].hand.push(wall.shift()!);
  for (const p of players) { replaceFlowers(wall, p); p.hand = sortTiles(p.hand); }
  return bump({
    ...g,
    phase: "draw",
    wall,
    players,
    turn: g.dealer,
    drawnId: null,
    lastDiscard: null,
    humanClaims: [],
    botClaims: [],
    pendingKong: null,
    discardCount: 0,
    lastLive: false,
    afterKong: false,
    result: null,
  });
}

export function nextHand(g: Game): Game {
  if (g.handNo + 1 >= HANDS_PER_GAME) return bump({ ...g, phase: "gameOver" });
  const dealerWon = g.result?.kind === "win" && g.result.winner === g.dealer;
  const keepDealer = dealerWon || g.result?.kind === "draw";
  let dealer = g.dealer, roundWind = g.roundWind;
  if (!keepDealer) {
    dealer = nextSeat(dealer);
    if (dealer === 0) roundWind = nextSeat(roundWind);
  }
  return startHand({ ...g, dealer, roundWind, handNo: g.handNo + 1 });
}

/** `turn` draws. Ends the hand as a draw when only the dead wall remains. */
export function draw(g: Game): Game {
  if (g.wall.length <= DEAD_WALL) {
    return bump({ ...g, phase: "handOver", result: { kind: "draw" } });
  }
  const wall = [...g.wall];
  const players = clonePlayers(g);
  const p = players[g.turn];
  let t = wall.shift()!;
  while (isFlower(t)) {
    p.flowers.push(t);
    const r = wall.pop();
    if (!r) return bump({ ...g, wall, players, phase: "handOver", result: { kind: "draw" } });
    t = r;
  }
  p.hand.push(t);
  return bump({ ...g, wall, players, phase: "discard", drawnId: t.id, lastLive: wall.length <= DEAD_WALL, lastDiscard: null });
}

function winCtx(g: Game, seat: Seat, selfDrawn: boolean, extra: Partial<WinContext> = {}): WinContext {
  return {
    seat: seatWind(g, seat),
    roundWind: g.roundWind,
    isDealer: seat === g.dealer,
    selfDrawn,
    firstTurn: selfDrawn ? g.discardCount === 0 : g.discardCount === 1 && seat !== g.dealer,
    lastTile: g.lastLive,
    afterKong: selfDrawn && g.afterKong,
    robbedKong: false,
    flowers: g.players[seat].flowers,
    ...extra,
  };
}

/** Score `seat`'s hand as it stands (14 tiles) — null if not a legal win. */
export function selfWinScore(g: Game, seat: Seat): ScoreResult | null {
  const p = g.players[seat];
  const r = score(p.hand, p.melds, winCtx(g, seat, true));
  return r && r.legal ? r : null;
}

/** Score `seat`'s hand + `tile` claimed from `shooter` — null if not a legal win. */
export function claimWinScore(g: Game, seat: Seat, tile: Tile, robbing = false): ScoreResult | null {
  const p = g.players[seat];
  const r = score([...p.hand, tile], p.melds, winCtx(g, seat, false, { robbedKong: robbing }));
  return r && r.legal ? r : null;
}

function finishWin(g: Game, winner: Seat, shooter: Seat | null, sc: ScoreResult, tile: Tile, extraTile?: Tile): Game {
  const players = clonePlayers(g);
  if (extraTile) players[winner].hand.push(extraTile);
  players[winner].hand = sortTiles(players[winner].hand);
  const deltas = payouts(sc.total, winner, shooter);
  deltas.forEach((d, i) => (players[i].score += d));
  return bump({
    ...g,
    players,
    phase: "handOver",
    drawnId: null,
    result: { kind: "win", winner, shooter, score: sc, deltas, winningTile: tile },
  });
}

export function declareWin(g: Game, seat: Seat): Game {
  const sc = selfWinScore(g, seat);
  if (!sc) return g;
  const tile = g.players[seat].hand.find((t) => t.id === g.drawnId) ?? g.players[seat].hand[g.players[seat].hand.length - 1];
  return finishWin(g, seat, null, sc, tile);
}

// ── Kongs ──────────────────────────────────────────────────────────────────

/** Kinds `seat` may declare a kong with right now: 4 in hand, or 1 in hand + exposed pung. */
export function kongOptions(g: Game, seat: Seat): Kind[] {
  const p = g.players[seat];
  const out = concealedKongs(p.hand);
  for (const m of p.melds) {
    if (m.kind !== "pung") continue;
    const k = kindOf(m.tiles[0]);
    if (p.hand.some((t) => kindOf(t) === k)) out.push(k);
  }
  return out;
}

/**
 * Declare a kong. A small kong (adding to a pung) can be robbed — if the
 * human can, pause in "rob"; bots rob if their hand says so.
 */
export function declareKong(g: Game, seat: Seat, kind: Kind): Game {
  const players = clonePlayers(g);
  const p = players[seat];
  const own = p.hand.filter((t) => kindOf(t) === kind);
  if (own.length === 4) {
    p.hand = p.hand.filter((t) => kindOf(t) !== kind);
    p.melds.push({ kind: "kong", tiles: own, concealed: true });
    return drawReplacement(bump({ ...g, players }), seat);
  }
  const mi = p.melds.findIndex((m) => m.kind === "pung" && kindOf(m.tiles[0]) === kind);
  if (mi < 0 || own.length !== 1) return g;
  const tile = own[0];
  p.hand = p.hand.filter((t) => t.id !== tile.id);
  p.melds[mi] = { kind: "kong", tiles: [...p.melds[mi].tiles, tile] };
  const g2 = bump({ ...g, players, pendingKong: { tile, seat } });

  // Robbing
  for (let i = 1; i < 4; i++) {
    const s = ((seat + i) % 4) as Seat;
    const sc = claimWinScore(g2, s, tile, true);
    if (!sc) continue;
    if (s === HUMAN) return bump({ ...g2, phase: "rob", turn: seat });
    return robKong(g2, s);
  }
  return drawReplacement(g2, seat);
}

export function robKong(g: Game, robber: Seat): Game {
  if (!g.pendingKong) return g;
  const { tile, seat } = g.pendingKong;
  const sc = claimWinScore(g, robber, tile, true);
  if (!sc) return g;
  const players = clonePlayers(g);
  // take the tile back off the kong
  const p = players[seat];
  const mi = p.melds.findIndex((m) => m.kind === "kong" && m.tiles.some((t) => t.id === tile.id));
  if (mi >= 0) p.melds[mi] = { kind: "pung", tiles: p.melds[mi].tiles.filter((t) => t.id !== tile.id) };
  return finishWin({ ...g, players, pendingKong: null }, robber, seat, sc, tile, tile);
}

export function declineRob(g: Game): Game {
  if (!g.pendingKong) return g;
  return drawReplacement(bump({ ...g, pendingKong: null, phase: "discard" }), g.pendingKong.seat);
}

function drawReplacement(g: Game, seat: Seat): Game {
  const g2 = draw({ ...g, turn: seat, pendingKong: null });
  return g2.phase === "discard" ? { ...g2, afterKong: true } : g2;
}

// ── Discard + claims ───────────────────────────────────────────────────────

export function discard(g: Game, seat: Seat, tileId: number): Game {
  const players = clonePlayers(g);
  const p = players[seat];
  const idx = p.hand.findIndex((t) => t.id === tileId);
  if (idx < 0) return g;
  const tile = p.hand.splice(idx, 1)[0];
  p.hand = sortTiles(p.hand);
  p.discards.push(tile);
  const g2: Game = {
    ...g,
    players,
    drawnId: null,
    afterKong: false,
    lastDiscard: { tile, seat },
    discardCount: g.discardCount + 1,
  };

  // Work out every other seat's options.
  const visible = players.flatMap((q) => [...q.discards, ...q.melds.flatMap((m) => m.tiles)]);
  const botClaims: Claim[] = [];
  let humanClaims: (ClaimKind | "win")[] = [];
  for (let i = 1; i < 4; i++) {
    const s = ((seat + i) % 4) as Seat;
    const fromLeft = prevSeat(s) === seat;
    const q = players[s];
    if (s === HUMAN) {
      const opts: (ClaimKind | "win")[] = [];
      if (claimWinScore(g2, s, tile)) opts.push("win");
      opts.push(...claimOptions(q.hand, tile, fromLeft));
      humanClaims = opts;
    } else {
      if (claimWinScore(g2, s, tile)) { botClaims.push({ seat: s, kind: "win" }); continue; }
      const c = chooseClaim(
        { hand: q.hand, melds: q.melds, visible, humanDiscards: players[HUMAN].discards, difficulty: g.difficulty, fanCtx: fanCtx(g2, s) },
        tile,
        fromLeft,
      );
      if (c) botClaims.push({ seat: s, kind: c });
    }
  }

  if (humanClaims.length) return bump({ ...g2, phase: "claim", humanClaims, botClaims });
  return resolveClaims({ ...g2, humanClaims: [], botClaims }, null);
}

/**
 * Apply the winning claim by priority: win (closest to the discarder first)
 * > pung/kong > chow. `human` is the human's pick or null for pass.
 */
export function resolveClaims(g: Game, human: ClaimKind | "win" | null): Game {
  if (!g.lastDiscard) return g;
  const { tile, seat: shooter } = g.lastDiscard;
  const all: Claim[] = [...g.botClaims];
  if (human) all.push({ seat: HUMAN, kind: human });
  const rank = (c: Claim) => (c.kind === "win" ? 0 : c.kind === "chow" ? 2 : 1) * 10 + ((c.seat - shooter + 4) % 4);
  all.sort((a, b) => rank(a) - rank(b));
  const pick = all[0];
  const base = bump({ ...g, humanClaims: [], botClaims: [] });

  if (!pick) return { ...base, phase: "draw", turn: nextSeat(shooter) };

  if (pick.kind === "win") {
    const sc = claimWinScore(base, pick.seat, tile)!;
    const players = clonePlayers(base);
    players[shooter].discards.pop();
    return finishWin({ ...base, players }, pick.seat, shooter, sc, tile, tile);
  }

  const players = clonePlayers(base);
  players[shooter].discards.pop();
  const p = players[pick.seat];
  const k = kindOf(tile);
  if (pick.kind === "chow") {
    const [a, b] = chowSets(p.hand, tile)[0];
    p.hand = p.hand.filter((t) => t.id !== a.id && t.id !== b.id);
    p.melds.push({ kind: "chow", tiles: sortTiles([a, b, tile]) });
  } else {
    let n = pick.kind === "kong" ? 3 : 2;
    const used: Tile[] = [];
    p.hand = p.hand.filter((t) => { if (n > 0 && kindOf(t) === k) { n--; used.push(t); return false; } return true; });
    p.melds.push({ kind: pick.kind, tiles: [...used, tile] });
  }
  const g2: Game = { ...base, players, turn: pick.seat, lastDiscard: null };
  if (pick.kind === "kong") return drawReplacement(g2, pick.seat);
  return { ...g2, phase: "discard", drawnId: null };
}

// ── Bot turn ───────────────────────────────────────────────────────────────

/** A bot at `turn` in phase "discard" decides: win → kong → discard. */
export function botAct(g: Game): Game {
  const seat = g.turn;
  if (selfWinScore(g, seat)) return declareWin(g, seat);
  const kongs = kongOptions(g, seat);
  if (kongs.length && g.difficulty !== "easy") return declareKong(g, seat, kongs[0]);
  const p = g.players[seat];
  const visible = g.players.flatMap((q) => [...q.discards, ...q.melds.flatMap((m) => m.tiles)]);
  const t = chooseDiscard({
    hand: p.hand,
    melds: p.melds,
    visible,
    humanDiscards: g.players[HUMAN].discards,
    difficulty: g.difficulty,
    fanCtx: fanCtx(g, seat),
  });
  return discard(g, seat, t.id);
}
