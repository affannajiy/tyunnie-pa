// components/games/Solitaire.tsx
"use client";

import { useState, useCallback } from "react";

type Suit = "♠" | "♥" | "♦" | "♣";
type Color = "black" | "red";

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const VALUES = [
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
const SUIT_COLOR: Record<Suit, Color> = {
  "♠": "black",
  "♣": "black",
  "♥": "red",
  "♦": "red",
};

type Card = { suit: Suit; value: string; faceUp: boolean };
type Source = "waste" | "tableau" | "foundation";
type Selection = {
  source: Source;
  tableauIndex?: number;
  cardIndex?: number;
  cards: Card[];
};

function valueIdx(v: string) {
  return VALUES.indexOf(v);
}

function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    VALUES.map((value) => ({ suit, value, faceUp: false })),
  );
}

function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function deal() {
  const deck = shuffle(createDeck());
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      tableau[col].push({ ...deck[idx++], faceUp: row === col });
    }
  }
  return {
    tableau,
    stock: deck.slice(idx).map((c) => ({ ...c, faceUp: false })),
    waste: [] as Card[],
    foundation: [[], [], [], []] as Card[][],
  };
}

function canToFoundation(card: Card, pile: Card[]) {
  if (!pile.length) return card.value === "A";
  const top = pile[pile.length - 1];
  return (
    top.suit === card.suit && valueIdx(card.value) === valueIdx(top.value) + 1
  );
}

function canToTableau(card: Card, pile: Card[]) {
  if (!pile.length) return card.value === "K";
  const top = pile[pile.length - 1];
  return (
    top.faceUp &&
    SUIT_COLOR[card.suit] !== SUIT_COLOR[top.suit] &&
    valueIdx(card.value) === valueIdx(top.value) - 1
  );
}

const WIN_QUIPS = [
  "You actually won?? Respect 🧡",
  "Solitaire master. I'm telling everyone.",
  "That's my person 🧡",
  "Okay I'm genuinely impressed.",
];

// ── Card component ──
function CardView({ card, selected }: { card: Card; selected?: boolean }) {
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
        className={`text-[11px] font-bold leading-tight ${red ? "text-red-500" : "text-[#111010]"}`}
      >
        {card.value}
        {card.suit}
      </div>
      <div
        className={`flex-1 flex items-center justify-center text-2xl font-bold ${red ? "text-red-400" : "text-[#9a8f7e]"}`}
      >
        {card.suit}
      </div>
    </div>
  );
}

// ── Placeholder slot ──
function Slot({ onClick, label }: { onClick?: () => void; label?: string }) {
  return (
    <div
      onClick={onClick}
      className="w-full aspect-5/8 rounded border-2 border-dashed border-[#e8e2d8] hover:border-[#f97316] transition-colors flex items-center justify-center cursor-pointer text-[#e8e2d8] text-lg"
    >
      {label}
    </div>
  );
}

export default function Solitaire() {
  const [state, setState] = useState(deal);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [winQuip] = useState(
    () => WIN_QUIPS[Math.floor(Math.random() * WIN_QUIPS.length)],
  );

  const checkWin = (f: Card[][]) => f.every((p) => p.length === 13);

  function restart() {
    setState(deal());
    setSelected(null);
    setMoves(0);
    setWon(false);
  }

  // ── Stock click ──
  const onStock = useCallback(() => {
    setSelected(null);
    setState((prev) => {
      const stock = [...prev.stock];
      const waste = [...prev.waste];
      if (!stock.length) {
        return {
          ...prev,
          stock: waste.map((c) => ({ ...c, faceUp: false })).reverse(),
          waste: [],
        };
      }
      waste.push({ ...stock.pop()!, faceUp: true });
      return { ...prev, stock, waste };
    });
  }, []);

  // ── Apply a move ──
  function applyMove(
    prev: ReturnType<typeof deal>,
    cards: Card[],
    source: Selection,
    destFoundation?: number,
    destTableau?: number,
  ) {
    const tableau = prev.tableau.map((t) => t.map((c) => ({ ...c })));
    const waste = [...prev.waste];
    const foundation = prev.foundation.map((f) => [...f]);

    // Remove from source
    if (source.source === "waste") {
      waste.pop();
    } else if (
      source.source === "tableau" &&
      source.tableauIndex !== undefined &&
      source.cardIndex !== undefined
    ) {
      tableau[source.tableauIndex].splice(source.cardIndex);
      const col = tableau[source.tableauIndex];
      if (col.length) col[col.length - 1].faceUp = true;
    }

    // Add to destination
    if (destFoundation !== undefined) {
      foundation[destFoundation].push({ ...cards[0] });
    } else if (destTableau !== undefined) {
      cards.forEach((c) => tableau[destTableau].push({ ...c, faceUp: true }));
    }

    setMoves((m) => m + 1);
    setSelected(null);
    const next = { ...prev, tableau, waste, foundation };
    if (checkWin(foundation)) setWon(true);
    return next;
  }

  // ── Waste click ──
  const onWaste = useCallback(() => {
    setState((prev) => {
      if (!prev.waste.length) return prev;
      const top = prev.waste[prev.waste.length - 1];

      // Try auto-move to foundation
      for (let fi = 0; fi < 4; fi++) {
        if (canToFoundation(top, prev.foundation[fi])) {
          const sel: Selection = { source: "waste", cards: [top] };
          return applyMove(prev, [top], sel, fi);
        }
      }

      if (selected?.source === "waste") {
        setSelected(null);
        return prev;
      }
      setSelected({ source: "waste", cards: [top] });
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // ── Foundation click ──
  const onFoundation = useCallback(
    (fi: number) => {
      if (!selected || selected.cards.length !== 1) {
        setSelected(null);
        return;
      }
      setState((prev) => {
        if (!canToFoundation(selected.cards[0], prev.foundation[fi])) {
          setSelected(null);
          return prev;
        }
        return applyMove(prev, selected.cards, selected, fi);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [selected],
  );

  // ── Tableau card click ──
  const onTableauCard = useCallback(
    (colIdx: number, cardIdx: number) => {
      setState((prev) => {
        const col = prev.tableau[colIdx];
        const card = col[cardIdx];

        // Flip face-down top card
        if (!card.faceUp) {
          if (cardIdx !== col.length - 1) return prev;
          const tableau = prev.tableau.map((t) => t.map((c) => ({ ...c })));
          tableau[colIdx][cardIdx].faceUp = true;
          setSelected(null);
          return { ...prev, tableau };
        }

        // Move selected cards here
        if (selected) {
          if (!canToTableau(selected.cards[0], col)) {
            setSelected(null);
            return prev;
          }
          return applyMove(prev, selected.cards, selected, undefined, colIdx);
        }

        // Select from this card down
        const cards = col.slice(cardIdx).map((c) => ({ ...c }));
        setSelected({
          source: "tableau",
          tableauIndex: colIdx,
          cardIndex: cardIdx,
          cards,
        });
        return prev;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [selected],
  );

  // ── Empty tableau click ──
  const onEmptyTableau = useCallback(
    (colIdx: number) => {
      if (!selected || selected.cards[0].value !== "K") {
        setSelected(null);
        return;
      }
      setState((prev) =>
        applyMove(prev, selected.cards, selected, undefined, colIdx),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [selected],
  );

  const isSelTableau = (ci: number, ri: number) =>
    selected?.source === "tableau" &&
    selected.tableauIndex === ci &&
    selected.cardIndex !== undefined &&
    ri >= selected.cardIndex;

  const { tableau, stock, waste, foundation } = state;
  const CARD_H = 100;
  const FACEDOWN_OFFSET = 16;
  const FACEUP_OFFSET = 26;

  return (
    <div className="max-w-2xl mx-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-[#9a8f7e]">{moves} moves</span>
        <button
          onClick={restart}
          className="px-4 py-1.5 rounded-xl bg-[#f97316] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#c2500f] transition-all"
        >
          New Game
        </button>
      </div>

      {/* Win banner */}
      {won && (
        <div className="bg-[#16a34a] rounded-2xl px-4 py-3 text-center mb-3">
          <p className="text-white font-bold text-sm">You won! 🧡</p>
          <p className="text-white/80 text-xs mt-0.5">{winQuip}</p>
        </div>
      )}

      {/* Top row */}
      <div className="grid grid-cols-7 gap-1 mb-3" style={{ height: CARD_H }}>
        {/* Stock */}
        <div
          onClick={onStock}
          className="cursor-pointer"
          style={{ height: CARD_H }}
        >
          {stock.length ? (
            <div className="w-full h-full rounded border-2 border-[#c2500f] bg-[#f97316] flex items-center justify-center text-white text-xl cursor-pointer hover:opacity-90 transition-opacity">
              🂠
            </div>
          ) : (
            <Slot onClick={onStock} label="↺" />
          )}
        </div>
        {/* Waste */}
        <div style={{ height: CARD_H }}>
          {waste.length ? (
            <div
              onClick={onWaste}
              className={`w-full h-full cursor-pointer rounded border-2 ${selected?.source === "waste" ? "border-[#f97316]" : "border-[#e8e2d8]"}`}
            >
              <CardView
                card={waste[waste.length - 1]}
                selected={selected?.source === "waste"}
              />
            </div>
          ) : (
            <Slot />
          )}
        </div>
        <div /> {/* spacer */}
        {/* Foundations */}
        {foundation.map((f, fi) => (
          <div
            key={fi}
            onClick={() => onFoundation(fi)}
            className="cursor-pointer"
            style={{ height: CARD_H }}
          >
            {f.length ? (
              <CardView card={f[f.length - 1]} />
            ) : (
              <Slot label={SUITS[fi]} />
            )}
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="grid grid-cols-7 gap-1">
        {tableau.map((col, ci) => {
          // compute column height
          let h = CARD_H;
          if (col.length > 1) {
            col.slice(0, -1).forEach((c) => {
              h += c.faceUp ? FACEUP_OFFSET : FACEDOWN_OFFSET;
            });
          }
          return (
            <div
              key={ci}
              className="relative"
              style={{ height: col.length ? h : CARD_H }}
            >
              {col.length === 0 ? (
                <Slot onClick={() => onEmptyTableau(ci)} />
              ) : (
                col.map((card, ri) => {
                  let top = 0;
                  for (let k = 0; k < ri; k++) {
                    top += col[k].faceUp ? FACEUP_OFFSET : FACEDOWN_OFFSET;
                  }
                  return (
                    <div
                      key={ri}
                      onClick={() => onTableauCard(ci, ri)}
                      className="absolute w-full cursor-pointer"
                      style={{ top, height: CARD_H, zIndex: ri }}
                    >
                      <CardView card={card} selected={isSelTableau(ci, ri)} />
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-[#c5bdb0] font-mono mt-6">
        Click to select · Click destination to move · Click stock to draw
      </p>
    </div>
  );
}
