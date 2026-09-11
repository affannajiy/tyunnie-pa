// components/games/Blackjack.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { type Card, createDeck, shuffle, CardView } from "./cards";

// Single deck, dealer stands on all 17s, blackjack pays 3:2, no splits or
// insurance — the casual-table rules. Chips are per-session only; a
// bankroll that persists would be a Finance-panel feature wearing a costume.
const START_CHIPS = 500;
const BETS = [10, 25, 50, 100];
const DEALER_DELAY_MS = 450;

type Phase = "bet" | "player" | "dealer" | "over";
type Outcome = "win" | "blackjack" | "lose" | "push" | "bust" | null;

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

function isBlackjack(cards: Card[]) {
  return cards.length === 2 && handTotal(cards) === 21;
}

const QUIPS: Record<Exclude<Outcome, null>, string[]> = {
  blackjack: ["Blackjack?? Okay show-off 🧡", "Natural 21. I saw nothing, I'm not counting."],
  win: ["You beat the house. The house is me. Rude.", "Nice hand. Don't get greedy.", "Called it. Well, you called it."],
  push: ["Push. Nobody wins, nobody cries.", "Tie. We both keep our dignity."],
  lose: ["Dealer takes it. Sorry, rules are rules.", "House wins. Want to go again? I'll pretend to shuffle badly.", "That one hurt to deal."],
  bust: ["Bust. You knew that hit was a bad idea.", "Over 21. I told you 16 was fine.", "Greedy. Loveable, but greedy."],
};

const OUTCOME_LABEL: Record<Exclude<Outcome, null>, string> = {
  blackjack: "Blackjack!",
  win: "You win",
  push: "Push",
  lose: "Dealer wins",
  bust: "Bust",
};

function Hand({
  cards,
  label,
  total,
  hidden,
  cardH,
}: {
  cards: Card[];
  label: string;
  total: number | null;
  /** Dealer's hole card is still face down — show the visible total as "N + ?". */
  hidden?: boolean;
  cardH: number;
}) {
  const CARD_H = cardH;
  const CARD_W = Math.round(cardH / 1.5);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#6f6455]">{label}</span>
        {total !== null && cards.length > 0 && (
          <span className="font-mono text-xs font-bold text-[#111010]">
            {total}{hidden ? " + ?" : ""}
          </span>
        )}
      </div>
      <div className="flex gap-1.5" style={{ height: CARD_H }}>
        {cards.length === 0 ? (
          <div
            className="rounded border-2 border-dashed border-[#e8e2d8]"
            style={{ width: CARD_W, height: CARD_H }}
          />
        ) : (
          cards.map((c, i) => (
            <div key={i} style={{ width: CARD_W, height: CARD_H }}>
              <CardView card={c} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Blackjack() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [chips, setChips] = useState(START_CHIPS);
  const [bet, setBet] = useState(25);
  const [phase, setPhase] = useState<Phase>("bet");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [quip, setQuip] = useState("");
  const [rounds, setRounds] = useState(0);
  // Dealer draws on a timer so the reveal reads as play, not a state jump.
  // Kept in a ref so unmount mid-draw cancels it.
  const dealerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (dealerTimer.current) clearTimeout(dealerTimer.current); }, []);

  function settle(result: Exclude<Outcome, null>, p: Card[], d: Card[]) {
    setPlayer(p);
    setDealer(d.map((c) => ({ ...c, faceUp: true })));
    setOutcome(result);
    setQuip(QUIPS[result][Math.floor(Math.random() * QUIPS[result].length)]);
    setPhase("over");
    setRounds((r) => r + 1);
    if (result === "blackjack") setChips((c) => c + Math.floor(bet * 1.5));
    else if (result === "win") setChips((c) => c + bet);
    else if (result === "lose" || result === "bust") setChips((c) => c - bet);
  }

  function dealRound() {
    if (bet > chips) return;
    // Reshuffle when the shoe runs thin — a single deck can't finish a hand
    // on fewer than ~10 cards.
    const d = deck.length < 15 ? shuffle(createDeck()) : [...deck];
    const draw = (faceUp: boolean) => ({ ...d.pop()!, faceUp });
    const p = [draw(true), draw(true)];
    const dl = [draw(true), draw(false)];
    setDeck(d);
    setOutcome(null);
    setQuip("");
    setPlayer(p);
    setDealer(dl);

    const pBJ = isBlackjack(p);
    const dBJ = isBlackjack(dl);
    if (pBJ || dBJ) {
      settle(pBJ && dBJ ? "push" : pBJ ? "blackjack" : "lose", p, dl);
      return;
    }
    setPhase("player");
  }

  function hit() {
    if (phase !== "player") return;
    const d = [...deck];
    const p = [...player, { ...d.pop()!, faceUp: true }];
    setDeck(d);
    if (handTotal(p) > 21) {
      settle("bust", p, dealer);
      return;
    }
    setPlayer(p);
  }

  function stand() {
    if (phase !== "player") return;
    setPhase("dealer");
    const d = [...deck];
    let dl = dealer.map((c) => ({ ...c, faceUp: true }));
    setDealer(dl);

    const step = () => {
      if (handTotal(dl) < 17) {
        dl = [...dl, { ...d.pop()!, faceUp: true }];
        setDealer(dl);
        setDeck([...d]);
        dealerTimer.current = setTimeout(step, DEALER_DELAY_MS);
        return;
      }
      const dt = handTotal(dl);
      const pt = handTotal(player);
      settle(dt > 21 || pt > dt ? "win" : pt === dt ? "push" : "lose", player, dl);
    };
    dealerTimer.current = setTimeout(step, DEALER_DELAY_MS);
  }

  function reset() {
    if (dealerTimer.current) clearTimeout(dealerTimer.current);
    setDeck([]);
    setPlayer([]);
    setDealer([]);
    setChips(START_CHIPS);
    setPhase("bet");
    setOutcome(null);
    setQuip("");
    setRounds(0);
  }

  const broke = chips < BETS[0];
  const dealerTotal =
    phase === "player" ? handTotal(dealer.filter((c) => c.faceUp)) : handTotal(dealer);

  // Size cards to the board, same measurement Solitaire does. A hand can run
  // to 6+ cards on a 320px screen, so the card shrinks until 7 fit in a row
  // rather than the row scrolling off the page (320px reflow is a gate).
  const boardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(88);
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => {
      // 7 cards, 6 gaps of 6px (gap-1.5)
      const cardW = (el.clientWidth - 6 * 6) / 7;
      setCardH(Math.round(Math.min(88, Math.max(54, cardW * 1.5))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boardRef} className="max-w-md mx-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-xs text-[#6f6455]">
          <span className="font-bold text-[#111010]">{chips}</span> chips
          <span className="mx-2 text-[#e8e2d8]">·</span>
          {rounds} {rounds === 1 ? "hand" : "hands"}
        </div>
        <button
          onClick={reset}
          className="px-4 py-1.5 rounded-xl bg-[#f97316] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#c2500f] transition-all"
        >
          New Table
        </button>
      </div>

      {/* Outcome */}
      {phase === "over" && outcome && (
        <div
          className={`rounded-2xl px-4 py-3 text-center mb-4 ${
            outcome === "win" || outcome === "blackjack"
              ? "bg-[#15803d]"
              : outcome === "push"
                ? "bg-[#6f6455]"
                : "bg-[#c2500f]"
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="text-white font-bold text-sm">
            {OUTCOME_LABEL[outcome]}
            {outcome === "blackjack" ? ` +${Math.floor(bet * 1.5)}` : outcome === "win" ? ` +${bet}` : outcome === "push" ? "" : ` −${bet}`}
          </p>
          <p className="text-white/80 text-xs mt-0.5">{quip}</p>
        </div>
      )}

      <div className="space-y-5 mb-5">
        <Hand cards={dealer} label="Dealer" total={dealer.length ? dealerTotal : null} hidden={phase === "player"} cardH={cardH} />
        <Hand cards={player} label="You" total={player.length ? handTotal(player) : null} cardH={cardH} />
      </div>

      {/* Controls */}
      {phase === "player" ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={hit}
            className="py-3 rounded-xl bg-[#f97316] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#c2500f] transition-all"
          >
            Hit
          </button>
          <button
            onClick={stand}
            className="py-3 rounded-xl border-2 border-[#e8e2d8] text-[#111010] text-xs font-bold uppercase tracking-widest hover:border-[#f97316] transition-all"
          >
            Stand
          </button>
        </div>
      ) : phase === "dealer" ? (
        <p className="text-center font-mono text-xs text-[#6f6455] py-2.5">Dealer&apos;s turn…</p>
      ) : broke ? (
        <p className="text-center font-mono text-xs text-[#6f6455] py-2.5">
          Out of chips. Tyunnie says that&apos;s enough gambling for today — New Table to reset.
        </p>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3" role="group" aria-label="Bet size">
            {BETS.map((b) => (
              <button
                key={b}
                onClick={() => setBet(b)}
                disabled={b > chips}
                aria-pressed={bet === b}
                className={`w-14 py-2 rounded-full font-mono text-xs font-bold border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  bet === b
                    ? "bg-[#f97316] border-[#f97316] text-white"
                    : "border-[#e8e2d8] text-[#111010] hover:border-[#f97316]"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <button
            onClick={dealRound}
            disabled={bet > chips}
            className="w-full py-2.5 rounded-xl bg-[#f97316] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#c2500f] transition-all disabled:opacity-40"
          >
            {phase === "over" ? "Deal again" : "Deal"} · {bet}
          </button>
        </div>
      )}

      <p className="text-center text-[10px] text-[#756a5a] font-mono mt-6">
        Dealer stands on 17 · Blackjack pays 3:2 · Single deck
      </p>
    </div>
  );
}
