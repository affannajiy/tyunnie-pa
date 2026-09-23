// components/games/blackjack/engine.ts
// Blackjack rules as pure state transitions. The component only schedules
// these (dealer draws on a timer) and renders the result; a throwaway script
// or a vitest file can drive a whole shoe without a DOM.
//
// Table: 6-deck shoe, dealer stands on soft 17, blackjack pays 3:2, double on
// any first two, double after split, split to four hands, split aces get one
// card and no resplit, dealer peeks on an ace or ten, insurance at 2:1, no
// surrender. Everything the rules drawer lists is implemented here and
// nothing else — RULES is what the drawer renders from.

import { type Card, createDeck, shuffle } from "../cards";

export const RULES = {
  decks: 6,
  dealerHitsSoft17: false,
  blackjackPays: 1.5,
  minBet: 10,
  maxBet: 500,
  maxHands: 4,
  /** Fraction of the shoe dealt before the cut card calls a reshuffle. */
  penetration: 0.75,
  startBankroll: 500,
  chips: [5, 10, 25, 50, 100],
} as const;

export type Phase =
  | "betting"    // stacking chips; `wager` is the pending bet
  | "insurance"  // dealer shows an ace; take or decline before the peek
  | "player"     // `hands[active]` is acting
  | "dealer"     // dealer draws one card per `dealerStep`
  | "settled";   // results and payouts applied; `nextRound` returns to betting

export type HandStatus = "playing" | "stood" | "busted" | "blackjack";
export type Result = "win" | "blackjack" | "lose" | "push";

export type Hand = {
  cards: Card[];
  bet: number;
  status: HandStatus;
  doubled: boolean;
  fromSplit: boolean;
  /** Split aces: one card each, no further action. */
  splitAces: boolean;
  result: Result | null;
  /** Chips returned to the bankroll at settlement (bet + winnings, or 0). */
  payout: number;
};

/** What just happened — the UI turns these into animation and sound. Replaced on every transition. */
export type GameEvent =
  | { type: "chip"; amount: number }
  | { type: "clear" }
  | { type: "shuffle" }
  | { type: "card"; to: "dealer" | "hand"; hand: number; faceUp: boolean }
  | { type: "reveal" }
  | { type: "bust"; hand: number }
  | { type: "blackjack"; hand: number }
  | { type: "split"; hand: number }
  | { type: "double"; hand: number }
  | { type: "insurance"; taken: boolean }
  | { type: "settle"; net: number }
  | { type: "rebuy" };

export type Stats = {
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  busts: number;
  doubles: number;
  splits: number;
  insurances: number;
  biggestWin: number;
  /** Current run of hand wins (negative = losing run). */
  streak: number;
  longestStreak: number;
  rebuys: number;
};

export const EMPTY_STATS: Stats = {
  hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0, doubles: 0,
  splits: 0, insurances: 0, biggestWin: 0, streak: 0, longestStreak: 0, rebuys: 0,
};

export type Game = {
  phase: Phase;
  shoe: Card[];
  /** Cards dealt since the last shuffle — the cut card is a count, not a position. */
  dealt: number;
  /** Set when the cut card came out; the next deal reshuffles first. */
  needsShuffle: boolean;
  bankroll: number;
  /** Pending bet while `phase === "betting"`. */
  wager: number;
  lastWager: number;
  hands: Hand[];
  active: number;
  dealer: Card[];
  /** Insurance side bet, 0 when none. */
  insurance: number;
  insuranceWon: boolean | null;
  /** Net chips this round vs. the bankroll before the deal. */
  roundNet: number;
  stats: Stats;
  events: GameEvent[];
  /** Bumps on every transition so effects re-fire even if phase repeats. */
  tick: number;
};

export type Rng = () => number;

// ── Cards ──────────────────────────────────────────────────────────────────

function cardPoints(value: string) {
  if (value === "A") return 11;
  if (value === "K" || value === "Q" || value === "J") return 10;
  return Number(value);
}

/** Best total ≤ 21 where possible; aces drop from 11 to 1 as needed. */
export function handTotal(cards: Card[]) {
  let total = cards.reduce((s, c) => s + cardPoints(c.value), 0);
  let aces = cards.filter((c) => c.value === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

/** A soft hand still counts an ace as 11. */
export function isSoft(cards: Card[]) {
  const hard = cards.reduce((s, c) => s + (c.value === "A" ? 1 : cardPoints(c.value)), 0);
  return cards.some((c) => c.value === "A") && hard + 10 <= 21;
}

export function isBlackjack(cards: Card[]) {
  return cards.length === 2 && handTotal(cards) === 21;
}

export function buildShoe(rng: Rng = Math.random): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < RULES.decks; i++) cards.push(...createDeck());
  return shuffle(cards, rng);
}

export const SHOE_SIZE = RULES.decks * 52;
const CUT = Math.floor(SHOE_SIZE * RULES.penetration);

/** 0–1 fraction of the shoe still to be dealt. Coarse on purpose — the UI shows a bar, never a count. */
export function shoeRemaining(g: Game) {
  return Math.max(0, 1 - g.dealt / CUT);
}

// ── Construction ───────────────────────────────────────────────────────────

const bump = (g: Game, events: GameEvent[]): Game => ({ ...g, events, tick: g.tick + 1 });

export function newTable(opts: { bankroll?: number; lastWager?: number; stats?: Stats; rng?: Rng } = {}): Game {
  return {
    phase: "betting",
    shoe: buildShoe(opts.rng),
    dealt: 0,
    needsShuffle: false,
    bankroll: opts.bankroll ?? RULES.startBankroll,
    wager: 0,
    lastWager: opts.lastWager ?? 0,
    hands: [],
    active: 0,
    dealer: [],
    insurance: 0,
    insuranceWon: null,
    roundNet: 0,
    stats: opts.stats ?? { ...EMPTY_STATS },
    events: [],
    tick: 0,
  };
}

function makeHand(cards: Card[], bet: number, fromSplit = false, splitAces = false): Hand {
  return { cards, bet, status: "playing", doubled: false, fromSplit, splitAces, result: null, payout: 0 };
}

// ── Betting ────────────────────────────────────────────────────────────────

/** Largest wager the table and the bankroll allow right now. */
export function maxWager(g: Game) {
  return Math.min(RULES.maxBet, g.bankroll);
}

export function canDeal(g: Game) {
  return g.phase === "betting" && g.wager >= RULES.minBet && g.wager <= maxWager(g);
}

export function addChip(g: Game, amount: number): Game {
  if (g.phase !== "betting") return g;
  if (!(RULES.chips as readonly number[]).includes(amount)) return g;
  const next = g.wager + amount;
  if (next > maxWager(g)) return g;
  return bump({ ...g, wager: next }, [{ type: "chip", amount }]);
}

export function clearBet(g: Game): Game {
  if (g.phase !== "betting" || g.wager === 0) return g;
  return bump({ ...g, wager: 0 }, [{ type: "clear" }]);
}

/** Restore the previous round's wager, capped to what the bankroll allows. */
export function rebet(g: Game): Game {
  if (g.phase !== "betting" || g.lastWager === 0) return g;
  const w = Math.min(g.lastWager, maxWager(g));
  if (w < RULES.minBet) return g;
  return bump({ ...g, wager: w }, [{ type: "chip", amount: w }]);
}

export function doubleBet(g: Game): Game {
  if (g.phase !== "betting" || g.wager === 0) return g;
  const w = Math.min(g.wager * 2, maxWager(g));
  if (w === g.wager) return g;
  return bump({ ...g, wager: w }, [{ type: "chip", amount: w - g.wager }]);
}

/** Broke below the table minimum: top the bankroll back up. Fictional chips, tracked as a rebuy. */
export function rebuy(g: Game): Game {
  if (g.phase !== "betting" && g.phase !== "settled") return g;
  if (g.bankroll >= RULES.minBet) return g;
  return bump(
    { ...g, phase: "betting", bankroll: RULES.startBankroll, wager: 0, hands: [], dealer: [], stats: { ...g.stats, rebuys: g.stats.rebuys + 1 } },
    [{ type: "rebuy" }],
  );
}

// ── Dealing ────────────────────────────────────────────────────────────────

type Draw = { shoe: Card[]; dealt: number };

function take(d: Draw, faceUp: boolean): Card {
  const c = d.shoe[d.shoe.length - 1];
  d.shoe = d.shoe.slice(0, -1);
  d.dealt++;
  return { ...c, faceUp };
}

export function deal(g: Game, rng: Rng = Math.random): Game {
  if (!canDeal(g)) return g;
  const events: GameEvent[] = [];
  let shoe = g.shoe, dealt = g.dealt;
  // Cut card came out last round, or (belt and braces) the shoe can't cover a
  // worst-case round of four split hands.
  if (g.needsShuffle || shoe.length < 40) {
    shoe = buildShoe(rng);
    dealt = 0;
    events.push({ type: "shuffle" });
  }
  const d: Draw = { shoe, dealt };
  const bet = g.wager;
  const hand = makeHand([take(d, true)], bet);
  const dealer: Card[] = [take(d, true)];
  hand.cards.push(take(d, true));
  dealer.push(take(d, false));
  events.push(
    { type: "card", to: "hand", hand: 0, faceUp: true },
    { type: "card", to: "dealer", hand: 0, faceUp: true },
    { type: "card", to: "hand", hand: 0, faceUp: true },
    { type: "card", to: "dealer", hand: 0, faceUp: false },
  );

  const base: Game = {
    ...g,
    shoe: d.shoe,
    dealt: d.dealt,
    needsShuffle: d.dealt >= CUT,
    bankroll: g.bankroll - bet,
    wager: 0,
    lastWager: bet,
    hands: [hand],
    active: 0,
    dealer,
    insurance: 0,
    insuranceWon: null,
    roundNet: -bet,
    phase: "player",
  };

  if (dealer[0].value === "A") return bump({ ...base, phase: "insurance" }, events);
  return afterPeek(base, events);
}

/**
 * Dealer peeks for blackjack on an ace or a ten-value upcard. If the dealer has
 * it the round settles here; otherwise a natural on the player's side pays out
 * immediately and anything else goes to the player phase.
 */
function afterPeek(g: Game, events: GameEvent[]): Game {
  const up = g.dealer[0];
  const dealerBJ = (up.value === "A" || cardPoints(up.value) === 10) && isBlackjack(g.dealer);
  const hands = cloneHands(g);
  if (isBlackjack(hands[0].cards)) {
    hands[0].status = "blackjack";
    events = [...events, { type: "blackjack", hand: 0 }];
  }
  if (dealerBJ || hands[0].status === "blackjack") return settle({ ...g, hands }, events);
  return bump({ ...g, hands }, events);
}

export function takeInsurance(g: Game): Game {
  if (g.phase !== "insurance") return g;
  const amount = Math.floor(g.hands[0].bet / 2);
  if (amount > g.bankroll) return declineInsurance(g);
  const next: Game = { ...g, bankroll: g.bankroll - amount, insurance: amount, roundNet: g.roundNet - amount, phase: "player", stats: { ...g.stats, insurances: g.stats.insurances + 1 } };
  return afterPeek(next, [{ type: "insurance", taken: true }]);
}

export function declineInsurance(g: Game): Game {
  if (g.phase !== "insurance") return g;
  return afterPeek({ ...g, phase: "player" }, [{ type: "insurance", taken: false }]);
}

// ── Player actions ─────────────────────────────────────────────────────────

function cloneHands(g: Game): Hand[] {
  return g.hands.map((h) => ({ ...h, cards: [...h.cards] }));
}

export function canHit(g: Game) {
  const h = g.hands[g.active];
  return g.phase === "player" && !!h && h.status === "playing" && !h.splitAces;
}

export function canDouble(g: Game) {
  const h = g.hands[g.active];
  return g.phase === "player" && !!h && h.status === "playing" && h.cards.length === 2 && !h.splitAces && g.bankroll >= h.bet;
}

export function canSplit(g: Game) {
  const h = g.hands[g.active];
  if (g.phase !== "player" || !h || h.status !== "playing" || h.cards.length !== 2) return false;
  if (h.splitAces) return false;
  if (cardPoints(h.cards[0].value) !== cardPoints(h.cards[1].value)) return false;
  return g.hands.length < RULES.maxHands && g.bankroll >= h.bet;
}

/**
 * Move to the next hand still to act, or hand the round to the dealer. When
 * every hand busted the dealer only reveals — no draw — and the round settles.
 */
function advance(g: Game, events: GameEvent[]): Game {
  const next = g.hands.findIndex((h, i) => i > g.active && h.status === "playing");
  if (next >= 0) return prepareHand({ ...g, active: next }, events);
  const anyLive = g.hands.some((h) => h.status === "stood");
  if (!anyLive) return settle(revealDealer(g), events);
  return bump({ ...revealDealer(g), phase: "dealer" }, events);
}

function revealDealer(g: Game): Game {
  return { ...g, dealer: g.dealer.map((c) => ({ ...c, faceUp: true })) };
}

/** A freshly split hand holds one card; deal its second the moment it becomes active. */
function prepareHand(g: Game, events: GameEvent[]): Game {
  const h = g.hands[g.active];
  if (h.cards.length !== 1) return bump(g, events);
  const d: Draw = { shoe: g.shoe, dealt: g.dealt };
  const hands = cloneHands(g);
  hands[g.active].cards.push(take(d, true));
  events = [...events, { type: "card", to: "hand", hand: g.active, faceUp: true }];
  const g2: Game = { ...g, hands, shoe: d.shoe, dealt: d.dealt, needsShuffle: g.needsShuffle || d.dealt >= CUT };
  // Split aces stand on their one card; a split 21 is not a natural.
  if (hands[g.active].splitAces) {
    hands[g.active].status = "stood";
    return advance(g2, events);
  }
  return bump(g2, events);
}

export function hit(g: Game): Game {
  if (!canHit(g)) return g;
  const d: Draw = { shoe: g.shoe, dealt: g.dealt };
  const hands = cloneHands(g);
  const h = hands[g.active];
  h.cards.push(take(d, true));
  const events: GameEvent[] = [{ type: "card", to: "hand", hand: g.active, faceUp: true }];
  const g2: Game = { ...g, hands, shoe: d.shoe, dealt: d.dealt, needsShuffle: g.needsShuffle || d.dealt >= CUT };
  const total = handTotal(h.cards);
  if (total > 21) {
    h.status = "busted";
    events.push({ type: "bust", hand: g.active });
    return advance(g2, events);
  }
  if (total === 21) {
    h.status = "stood";
    return advance(g2, events);
  }
  return bump(g2, events);
}

export function stand(g: Game): Game {
  if (g.phase !== "player" || g.hands[g.active]?.status !== "playing") return g;
  const hands = cloneHands(g);
  hands[g.active].status = "stood";
  return advance({ ...g, hands }, []);
}

export function double(g: Game): Game {
  if (!canDouble(g)) return g;
  const d: Draw = { shoe: g.shoe, dealt: g.dealt };
  const hands = cloneHands(g);
  const h = hands[g.active];
  h.cards.push(take(d, true));
  h.bet *= 2;
  h.doubled = true;
  const bet = h.bet / 2;
  const events: GameEvent[] = [{ type: "double", hand: g.active }, { type: "card", to: "hand", hand: g.active, faceUp: true }];
  const g2: Game = {
    ...g, hands, shoe: d.shoe, dealt: d.dealt, needsShuffle: g.needsShuffle || d.dealt >= CUT,
    bankroll: g.bankroll - bet, roundNet: g.roundNet - bet,
    stats: { ...g.stats, doubles: g.stats.doubles + 1 },
  };
  if (handTotal(h.cards) > 21) {
    h.status = "busted";
    events.push({ type: "bust", hand: g.active });
  } else h.status = "stood";
  return advance(g2, events);
}

export function split(g: Game): Game {
  if (!canSplit(g)) return g;
  const hands = cloneHands(g);
  const h = hands[g.active];
  const aces = h.cards[0].value === "A";
  const second = makeHand([h.cards[1]], h.bet, true, aces);
  h.cards = [h.cards[0]];
  h.fromSplit = true;
  h.splitAces = aces;
  hands.splice(g.active + 1, 0, second);
  const g2: Game = {
    ...g, hands,
    bankroll: g.bankroll - h.bet, roundNet: g.roundNet - h.bet,
    stats: { ...g.stats, splits: g.stats.splits + 1 },
  };
  return prepareHand(g2, [{ type: "split", hand: g.active }]);
}

// ── Dealer ─────────────────────────────────────────────────────────────────

export function dealerMustDraw(cards: Card[]) {
  const t = handTotal(cards);
  if (t < 17) return true;
  return t === 17 && RULES.dealerHitsSoft17 && isSoft(cards);
}

/** One dealer card, or settlement once the dealer stands. The UI calls this on a timer. */
export function dealerStep(g: Game): Game {
  if (g.phase !== "dealer") return g;
  if (!dealerMustDraw(g.dealer)) return settle(g, []);
  const d: Draw = { shoe: g.shoe, dealt: g.dealt };
  const dealer = [...g.dealer, take(d, true)];
  return bump(
    { ...g, dealer, shoe: d.shoe, dealt: d.dealt, needsShuffle: g.needsShuffle || d.dealt >= CUT },
    [{ type: "card", to: "dealer", hand: 0, faceUp: true }],
  );
}

// ── Settlement ─────────────────────────────────────────────────────────────

function settle(g: Game, events: GameEvent[]): Game {
  const dealer = g.dealer.map((c) => ({ ...c, faceUp: true }));
  const dt = handTotal(dealer);
  const dealerBJ = isBlackjack(dealer);
  const dealerBust = dt > 21;
  let credit = 0;
  const hands = g.hands.map((h): Hand => {
    let result: Result;
    if (h.status === "busted") result = "lose";
    else if (h.status === "blackjack") result = dealerBJ ? "push" : "blackjack";
    else if (dealerBJ) result = "lose";
    else {
      const pt = handTotal(h.cards);
      result = dealerBust || pt > dt ? "win" : pt === dt ? "push" : "lose";
    }
    const payout =
      result === "blackjack" ? h.bet + Math.floor(h.bet * RULES.blackjackPays)
      : result === "win" ? h.bet * 2
      : result === "push" ? h.bet
      : 0;
    credit += payout;
    return { ...h, result, payout };
  });
  let insuranceWon: boolean | null = null;
  if (g.insurance > 0) {
    insuranceWon = dealerBJ;
    if (dealerBJ) credit += g.insurance * 3;
  }
  const roundNet = g.roundNet + credit;

  // Stats: each hand counts; the streak follows the round's net.
  const s = { ...g.stats };
  for (const h of hands) {
    s.hands++;
    if (h.result === "win" || h.result === "blackjack") s.wins++;
    else if (h.result === "push") s.pushes++;
    else s.losses++;
    if (h.result === "blackjack") s.blackjacks++;
    if (h.status === "busted") s.busts++;
  }
  if (roundNet > 0) {
    s.streak = s.streak > 0 ? s.streak + 1 : 1;
    s.longestStreak = Math.max(s.longestStreak, s.streak);
    s.biggestWin = Math.max(s.biggestWin, roundNet);
  } else if (roundNet < 0) s.streak = s.streak < 0 ? s.streak - 1 : -1;

  return bump(
    { ...g, phase: "settled", dealer, hands, bankroll: g.bankroll + credit, roundNet, insuranceWon, stats: s },
    [...events, { type: "reveal" }, { type: "settle", net: roundNet }],
  );
}

/** Clear the table for the next bet. Bankroll and stats carry over. */
export function nextRound(g: Game): Game {
  if (g.phase !== "settled") return g;
  return bump({ ...g, phase: "betting", hands: [], dealer: [], active: 0, insurance: 0, insuranceWon: null, roundNet: 0, wager: 0 }, []);
}
