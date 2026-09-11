// components/games/cards.tsx
// Shared playing-card primitives for the card games (Solitaire, Blackjack).
// One deck, one shuffle, one card face — a second card game must not redraw
// the card, or the two drift the first time someone retunes a border colour.
"use client";

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Color = "black" | "red";

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const VALUES = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
export const SUIT_COLOR: Record<Suit, Color> = {
  "♠": "black",
  "♣": "black",
  "♥": "red",
  "♦": "red",
};

export type Card = { suit: Suit; value: string; faceUp: boolean };

export function valueIdx(v: string) {
  return VALUES.indexOf(v);
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    VALUES.map((value) => ({ suit, value, faceUp: false })),
  );
}

export function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── Card face ──
// The suit glyphs are typographic, not icons — one of the three standing
// lucide exemptions in CLAUDE.md.
export function CardView({ card, selected }: { card: Card; selected?: boolean }) {
  const red = SUIT_COLOR[card.suit] === "red";
  if (!card.faceUp)
    return (
      <div
        className={`w-full h-full rounded border-2 ${selected ? "border-yellow-400" : "border-[#c2500f]"} bg-[#f97316] flex items-center justify-center`}
      >
        <div className="w-3/4 h-3/4 border border-[#c2500f]/40 rounded" />
      </div>
    );
  return (
    <div
      className={`w-full h-full rounded border-2 bg-white flex flex-col px-0.5 pt-0.5 overflow-hidden transition-all
      ${selected ? "border-[#f97316] shadow-lg" : "border-[#e8e2d8] hover:border-[#f97316]"}`}
    >
      <div
        className={`text-[11px] font-bold leading-tight ${red ? "text-red-600" : "text-[#111010]"}`}
      >
        {card.value}
        {card.suit}
      </div>
      <div
        className={`flex-1 flex items-center justify-center text-2xl font-bold ${red ? "text-red-600" : "text-[#6f6455]"}`}
      >
        {card.suit}
      </div>
    </div>
  );
}
