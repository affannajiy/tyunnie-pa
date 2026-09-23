// components/games/blackjack/Blackjack.tsx
// Casino-table presentation over engine.ts. This file owns no rules: it
// stacks chips, schedules the dealer's draws on a timer, turns engine events
// into sound and entrance animations, and persists the bankroll + stats.
//
// Table object: a dark felt (`FELT`) holding the dealer row, the shoe bar,
// the player's hands and the bet circle. Actions sit on cream below it.
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BookOpen, BarChart3, Settings2, RotateCcw, Layers } from "lucide-react";
import { type Card, CardView } from "../cards";
import * as E from "./engine";
import { FELT, FeltVignette, GameSheet, GameSettingsBody, StatRows, SectionLabel, HeaderButton, ignoreGameKey } from "../ui";
import { readStore, writeStore, useGameSettings, scaleDelay } from "@/lib/gameStore";
import { play, setAudioEnabled } from "@/lib/gameAudio";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { Kbd } from "@/components/ui/Kbd";

const DEALER_DELAY_MS = 550;
const STORE_KEY = "blackjack";
const BJ_KEYS = new Set(["h", "s", "d", "p", "y", "n", "r", "enter", "escape"]);

type Saved = { bankroll: number; lastWager: number; stats: E.Stats };
const SAVED_DEFAULT: Saved = { bankroll: E.RULES.startBankroll, lastWager: 0, stats: { ...E.EMPTY_STATS } };

const QUIPS: Record<E.Result | "mixed", string[]> = {
  blackjack: ["Blackjack?? Okay show-off 🧡", "Natural 21. I saw nothing, I'm not counting."],
  win: ["You beat the house. The house is me. Rude.", "Nice hand. Don't get greedy.", "Called it. Well, you called it."],
  push: ["Push. Nobody wins, nobody cries.", "Tie. We both keep our dignity."],
  lose: ["Dealer takes it. Sorry, rules are rules.", "House wins. Want to go again? I'll pretend to shuffle badly.", "Greedy. Loveable, but greedy."],
  mixed: ["Split decision. Literally.", "One up, one down. That's blackjack."],
};

const CHIP_STYLE: Record<number, string> = {
  5: "bg-[#f3f0ea] text-[#111010] border-[#c9c0b4]",
  10: "bg-[#2a5db0] text-white border-[#1c3f7a]",
  25: "bg-[#1f7a3e] text-white border-[#155a2c]",
  50: "bg-(--accent) text-(--accent-on) border-(--accent-dim)",
  100: "bg-[#111010] text-white border-[#3a3530]",
};

// ── Small pieces ───────────────────────────────────────────────────────────

function Chip({ value, size = 44, onClick, disabled, className = "" }: { value: number; size?: number; onClick?: () => void; disabled?: boolean; className?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      aria-label={onClick ? `Add ${value} chip` : undefined}
      className={`no-tap shrink-0 rounded-full border-[3px] border-dashed font-mono font-bold flex items-center justify-center shadow-[0_2px_0_rgba(0,0,0,0.35)] select-none ${CHIP_STYLE[value]} ${
        onClick ? "transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0" : ""
      } ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      {value}
    </Tag>
  );
}

/** Greedy chip breakdown, largest first, capped so a 500 bet is not 5 black chips in a tower. */
function chipStack(amount: number): number[] {
  const out: number[] = [];
  let left = amount;
  for (const c of [100, 50, 25, 10, 5]) while (left >= c && out.length < 8) { out.push(c); left -= c; }
  return out.reverse();
}

function BetStack({ amount, size = 40 }: { amount: number; size?: number }) {
  const stack = chipStack(amount);
  if (!stack.length) return null;
  return (
    <div className="relative" style={{ width: size, height: size + (stack.length - 1) * 5 }} aria-hidden>
      {stack.map((c, i) => (
        <div key={i} className="absolute left-0 animate-chip-in" style={{ bottom: i * 5, animationDelay: `${i * 30}ms` }}>
          <Chip value={c} size={size} />
        </div>
      ))}
    </div>
  );
}

function CardRow({ cards, cardH, animateFrom = 0, dim }: { cards: Card[]; cardH: number; animateFrom?: number; dim?: boolean }) {
  const cardW = Math.round(cardH / 1.5);
  // Overlap once a hand grows past 4 so seven cards still fit a phone.
  const overlap = cards.length > 4 ? Math.round(cardW * 0.45) : Math.round(cardW * 0.15);
  return (
    <div className={`flex ${dim ? "opacity-50" : ""}`} style={{ height: cardH }}>
      {cards.map((c, i) => (
        <div
          key={`${c.value}${c.suit}${i}`}
          className={i >= animateFrom ? "animate-card-in" : ""}
          style={{ width: cardW, height: cardH, marginLeft: i === 0 ? 0 : -overlap, zIndex: i, animationDelay: `${(i - animateFrom) * 90}ms` }}
        >
          <CardView card={c} />
        </div>
      ))}
    </div>
  );
}

function TotalBadge({ cards, hidden, status }: { cards: Card[]; hidden?: boolean; status?: E.HandStatus }) {
  if (!cards.length) return null;
  const shown = hidden ? cards.filter((c) => c.faceUp) : cards;
  const t = E.handTotal(shown);
  const natural = !hidden && (status === "blackjack" || (status === undefined && E.isBlackjack(cards)));
  const soft = !hidden && !natural && E.isSoft(cards) && t <= 21 && cards.length >= 2;
  const bust = status === "busted";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${bust ? "bg-[#7f1d1d] text-white" : natural ? "bg-(--accent) text-(--accent-on)" : "bg-black/40 text-[#e8ddd0]"}`}>
      {natural ? "Blackjack" : t}{hidden ? " + ?" : ""}
      {soft && <span className="opacity-70 font-normal">soft</span>}
    </span>
  );
}

const RESULT_LABEL: Record<E.Result, string> = { blackjack: "Blackjack", win: "Win", push: "Push", lose: "Lose" };

// ── Component ──────────────────────────────────────────────────────────────

export default function Blackjack() {
  const [settings] = useGameSettings();
  useEffect(() => setAudioEnabled(settings.sound), [settings.sound]);

  // Lazy init: this component is dynamic({ ssr:false }), so storage is safe here.
  const [g, setG] = useState<E.Game>(() => {
    const s = readStore<Saved>(STORE_KEY, SAVED_DEFAULT);
    return E.newTable({ bankroll: s.bankroll, lastWager: s.lastWager, stats: { ...E.EMPTY_STATS, ...s.stats } });
  });
  const [sheet, setSheet] = useState<"rules" | "stats" | "settings" | null>(null);
  const dealerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (dealerTimer.current) clearTimeout(dealerTimer.current); }, []);

  // Persist only at rest — a mid-hand unmount refunds the wager implicitly
  // (the saved bankroll predates the deal).
  useEffect(() => {
    if (g.phase === "betting" || g.phase === "settled") {
      writeStore<Saved>(STORE_KEY, { bankroll: g.bankroll, lastWager: g.lastWager, stats: g.stats });
    }
  }, [g.phase, g.bankroll, g.lastWager, g.stats]);

  // Dealer draws on a timer so the reveal reads as play, not a state jump.
  useEffect(() => {
    if (dealerTimer.current) clearTimeout(dealerTimer.current);
    if (g.phase !== "dealer") return;
    dealerTimer.current = setTimeout(
      () => setG((cur) => (cur.tick === g.tick ? E.dealerStep(cur) : cur)),
      scaleDelay(DEALER_DELAY_MS, settings),
    );
    return () => { if (dealerTimer.current) clearTimeout(dealerTimer.current); };
  }, [g.tick, g.phase, settings]);

  // Events → sound + quip. Runs once per transition (tick).
  useEffect(() => {
    for (const e of g.events) {
      if (e.type === "chip") play("chip");
      else if (e.type === "card") play("card");
      else if (e.type === "shuffle") play("shuffle");
      else if (e.type === "reveal") play("flip");
      else if (e.type === "settle") {
        if (e.net > 0) play("win"); else if (e.net < 0) play("lose"); else play("push");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.tick]);

  // One quip per settlement — the hands array is a new reference each round
  // and the same one across re-renders, so the random pick stays put.
  const settledHands = g.phase === "settled" ? g.hands : null;
  const quipSeed = g.stats.hands;
  const quip = useMemo(() => {
    if (!settledHands) return "";
    const results = new Set(settledHands.map((h) => h.result));
    const key: E.Result | "mixed" =
      results.size > 1 && !(results.size === 2 && results.has("blackjack") && results.has("win")) ? "mixed" : settledHands[0].result!;
    return QUIPS[key][quipSeed % QUIPS[key].length];
  }, [settledHands, quipSeed]);

  // ── Actions ──
  const act = useCallback((fn: (x: E.Game) => E.Game) => setG((cur) => fn(cur)), []);
  const deal = () => act((x) => E.deal(x));
  const rebetAndDeal = () => act((x) => E.deal(E.rebet(E.nextRound(x))));

  const resetBankroll = async () => {
    const ok = await confirmDialog({
      title: "Reset bankroll to 500?",
      message: `Your current ${g.bankroll} chips are gone. Stats stay.`,
      confirmLabel: "Reset",
    });
    if (!ok) return;
    act((x) => E.newTable({ bankroll: E.RULES.startBankroll, lastWager: 0, stats: x.stats }));
  };
  const resetStats = async () => {
    const ok = await confirmDialog({
      title: "Reset statistics?",
      message: "Hands, wins, streaks and biggest win go back to zero. Bankroll stays.",
      confirmLabel: "Reset stats",
    });
    if (!ok) return;
    act((x) => ({ ...x, stats: { ...E.EMPTY_STATS }, tick: x.tick + 1, events: [] }));
  };

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      if (ignoreGameKey(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // Decide preventDefault from the key alone: an updater is not guaranteed
      // to run before this handler returns, so a flag set inside it can't be read.
      if (!BJ_KEYS.has(k)) return;
      e.preventDefault();
      setG((cur) => {
        if (cur.phase === "player") {
          if (k === "h") return E.hit(cur);
          if (k === "s") return E.stand(cur);
          if (k === "d") return E.double(cur);
          if (k === "p") return E.split(cur);
        } else if (cur.phase === "insurance") {
          if (k === "y") return E.takeInsurance(cur);
          if (k === "n") return E.declineInsurance(cur);
        } else if (cur.phase === "betting") {
          if (k === "enter") return E.deal(cur);
          if (k === "escape") return E.clearBet(cur);
          if (k === "r") return E.rebet(cur);
        } else if (cur.phase === "settled") {
          if (k === "enter") return E.deal(E.rebet(E.nextRound(cur)));
          if (k === "escape") return E.nextRound(cur);
        }
        return cur;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  // ── Layout measurement ──
  // Card height follows board width so seven overlapped cards fit at 320px.
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardW, setBoardW] = useState(420);
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoardW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cardH = Math.round(Math.min(96, Math.max(60, (boardW - 48) / 4.2)));
  const compactSplits = boardW < 400 && g.hands.length > 1;

  // ── Derived ──
  const hideHole = g.phase === "player" || g.phase === "insurance";
  const broke = g.bankroll < E.RULES.minBet && (g.phase === "betting" || g.phase === "settled") && g.wager === 0;
  const shoeLeft = E.shoeRemaining(g);
  const activeHand = g.hands[g.active];
  const insuranceAmt = g.hands[0] ? Math.floor(g.hands[0].bet / 2) : 0;
  const evenMoney = g.phase === "insurance" && g.hands[0] && E.isBlackjack(g.hands[0].cards);
  const rulesRows = useMemo(
    () => [
      { label: "Decks in the shoe", value: E.RULES.decks },
      { label: "Dealer on soft 17", value: E.RULES.dealerHitsSoft17 ? "Hits" : "Stands" },
      { label: "Blackjack pays", value: "3 : 2" },
      { label: "Double", value: "Any first two cards" },
      { label: "Double after split", value: "Yes" },
      { label: "Split pairs", value: `Up to ${E.RULES.maxHands} hands` },
      { label: "Split aces", value: "One card each" },
      { label: "Dealer peeks", value: "On ace or ten" },
      { label: "Insurance", value: "2 : 1, up to half the bet" },
      { label: "Surrender", value: "No" },
      { label: "Table limits", value: `${E.RULES.minBet} – ${E.RULES.maxBet}` },
      { label: "Reshuffle", value: `at ${Math.round(E.RULES.penetration * 100)}% of the shoe` },
    ],
    [],
  );
  const s = g.stats;
  const statRows = [
    { label: "Hands played", value: s.hands },
    { label: "Won / lost / pushed", value: `${s.wins} / ${s.losses} / ${s.pushes}` },
    { label: "Win rate", value: s.hands ? `${Math.round((s.wins / s.hands) * 100)}%` : "—" },
    { label: "Blackjacks", value: s.blackjacks },
    { label: "Busts", value: s.busts },
    { label: "Doubles / splits", value: `${s.doubles} / ${s.splits}` },
    { label: "Insurance taken", value: s.insurances },
    { label: "Biggest win", value: s.biggestWin ? `+${s.biggestWin}` : "—" },
    { label: "Current streak", value: s.streak > 0 ? `${s.streak} won` : s.streak < 0 ? `${-s.streak} lost` : "—" },
    { label: "Longest win streak", value: s.longestStreak },
    { label: "Rebuys", value: s.rebuys },
  ];

  return (
    <div ref={boardRef} className="max-w-xl mx-auto select-none">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="font-mono text-xs text-[#6f6455] min-w-0 truncate">
          <span className="uppercase tracking-widest text-[10px]">Bankroll</span>{" "}
          <span className="font-bold text-[#111010] dark:text-[#e8ddd0] text-sm tabular-nums">{g.bankroll}</span>
          <span className="mx-2 text-[#e8e2d8] dark:text-[#3a3530]">·</span>
          {s.hands} {s.hands === 1 ? "hand" : "hands"}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderButton onClick={() => setSheet("rules")} label="Rules" icon={<BookOpen size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("stats")} label="Stats" icon={<BarChart3 size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("settings")} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} />
        </div>
      </div>

      {/* Table */}
      <div className={`${FELT} px-4 pt-4 pb-5 sm:px-6`}>
        <FeltVignette />
        {/* Shoe */}
        <div className="relative flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#b0a090]">Dealer</span>
          <div className="flex items-center gap-2" title="Shoe" aria-label={`Shoe ${Math.round(shoeLeft * 100)} percent remaining`}>
            <Layers size={14} strokeWidth={1.75} className="text-[#b0a090]" />
            <div className="w-16 h-1.5 rounded-full bg-black/40 overflow-hidden">
              <div className="h-full rounded-full bg-[#b0a090] transition-[width] duration-500" style={{ width: `${Math.round(shoeLeft * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Dealer */}
        <div className="relative flex items-center gap-3 min-h-[60px]" style={{ minHeight: cardH }}>
          {g.dealer.length ? (
            <>
              <CardRow cards={g.dealer} cardH={cardH} />
              <TotalBadge cards={g.dealer} hidden={hideHole} />
            </>
          ) : (
            <div className="rounded border-2 border-dashed border-white/15" style={{ width: Math.round(cardH / 1.5), height: cardH }} />
          )}
        </div>

        {/* Centre: message band */}
        <div className="relative my-4 min-h-[44px] flex items-center justify-center text-center">
          {g.phase === "settled" ? (
            <div className="animate-spotlight-in">
              <p className={`font-serif italic text-2xl leading-tight ${g.roundNet > 0 ? "text-[#fbd38d]" : g.roundNet < 0 ? "text-[#f5a5a5]" : "text-[#e8ddd0]"}`} role="status" aria-live="polite">
                {g.hands.length === 1 ? RESULT_LABEL[g.hands[0].result!] : g.roundNet > 0 ? "You're up" : g.roundNet < 0 ? "House takes it" : "Even"}
                <span className="font-mono not-italic text-base ml-2 tabular-nums">{g.roundNet > 0 ? `+${g.roundNet}` : g.roundNet < 0 ? `−${-g.roundNet}` : "±0"}</span>
              </p>
              {g.insuranceWon !== null && (
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#b0a090] mt-1">Insurance {g.insuranceWon ? `paid +${g.insurance * 2}` : `lost −${g.insurance}`}</p>
              )}
              <p className="text-xs text-[#b0a090] mt-1">{quip}</p>
            </div>
          ) : g.phase === "insurance" ? (
            <p className="font-mono text-xs text-[#e8ddd0]" role="status" aria-live="polite">
              Dealer shows an ace. {evenMoney ? "Take even money?" : `Insurance for ${insuranceAmt}?`}
            </p>
          ) : g.phase === "dealer" ? (
            <p className="font-mono text-xs text-[#b0a090]" role="status" aria-live="polite">Dealer&apos;s turn…</p>
          ) : g.phase === "betting" ? (
            <div className="flex flex-col items-center gap-1">
              <div
                className="flex items-center justify-center rounded-full border-2 border-dashed border-white/20"
                style={{ width: 84, height: 84 }}
                aria-label={g.wager ? `Bet ${g.wager}` : "No bet placed"}
              >
                {g.wager ? <BetStack amount={g.wager} size={44} /> : <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Bet</span>}
              </div>
              <span className="font-mono text-sm font-bold text-[#e8ddd0] tabular-nums">{g.wager || ""}</span>
            </div>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#b0a090]">
              {g.hands.length > 1 ? `Hand ${g.active + 1} of ${g.hands.length}` : "Your move"}
            </p>
          )}
        </div>

        {/* Player hands */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#b0a090]">You</span>
            {g.phase === "betting" && g.lastWager > 0 && (
              <span className="font-mono text-[10px] text-[#b0a090]">last bet {g.lastWager}</span>
            )}
          </div>
          {g.hands.length === 0 ? (
            <div className="rounded border-2 border-dashed border-white/15" style={{ width: Math.round(cardH / 1.5), height: cardH }} />
          ) : (
            <div className={`flex ${g.hands.length > 1 ? "flex-wrap" : ""} gap-x-5 gap-y-3 items-end`}>
              {g.hands.map((h, i) => {
                const isActive = i === g.active && g.phase === "player";
                if (compactSplits && !isActive && g.phase === "player") {
                  return (
                    <button
                      key={i}
                      disabled
                      className="no-tap w-full flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-[#e8ddd0]"
                      aria-label={`Hand ${i + 1}: ${h.cards.map((c) => c.value + c.suit).join(" ")}, total ${E.handTotal(h.cards)}, bet ${h.bet}`}
                    >
                      <span>{h.cards.map((c) => `${c.value}${c.suit}`).join(" ")}</span>
                      <span className="flex items-center gap-2">
                        <TotalBadge cards={h.cards} status={h.status} />
                        <span className="text-[#b0a090]">bet {h.bet}</span>
                      </span>
                    </button>
                  );
                }
                return (
                  <div key={i} className={`flex flex-col gap-1.5 rounded-xl p-1.5 -m-1.5 transition-shadow ${isActive && g.hands.length > 1 ? "ring-2 ring-(--accent)" : ""}`}>
                    <div className="flex items-end gap-3">
                      <CardRow cards={h.cards} cardH={cardH} dim={g.phase === "player" && !isActive && !compactSplits} />
                      <div className="flex flex-col items-start gap-1 pb-1">
                        <TotalBadge cards={h.cards} status={h.status} />
                        {h.result && (
                          <span className={`font-mono text-[10px] uppercase tracking-widest ${h.result === "lose" ? "text-[#f5a5a5]" : h.result === "push" ? "text-[#b0a090]" : "text-[#fbd38d]"}`}>
                            {RESULT_LABEL[h.result]}{h.payout > h.bet ? ` +${h.payout - h.bet}` : h.result === "lose" ? ` −${h.bet}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <BetStack amount={h.bet} size={26} />
                      <span className="font-mono text-[10px] text-[#b0a090]">{h.bet}{h.doubled ? " · doubled" : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 min-h-[92px]">
        {broke ? (
          <div className="text-center">
            <p className="font-mono text-xs text-[#6f6455] mb-3">Out of chips. Tyunnie says that&apos;s enough for one sitting — but the chips were never real.</p>
            <button onClick={() => act(E.rebuy)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest hover:bg-(--accent-dim) transition-colors">
              <RotateCcw size={14} strokeWidth={2} /> Rebuy {E.RULES.startBankroll}
            </button>
          </div>
        ) : g.phase === "betting" ? (
          <div>
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3" role="group" aria-label="Chips">
              {E.RULES.chips.map((c) => (
                <Chip key={c} value={c} size={boardW < 360 ? 40 : 46} onClick={() => act((x) => E.addChip(x, c))} disabled={g.wager + c > E.maxWager(g)} />
              ))}
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr_2fr] gap-2">
              <ActionButton onClick={() => act(E.clearBet)} disabled={!g.wager} secondary>Clear</ActionButton>
              <ActionButton onClick={() => act(E.rebet)} disabled={!g.lastWager || g.lastWager < E.RULES.minBet} secondary>Rebet</ActionButton>
              <ActionButton onClick={() => act(E.doubleBet)} disabled={!g.wager || g.wager * 2 > E.maxWager(g)} secondary>×2</ActionButton>
              <ActionButton onClick={deal} disabled={!E.canDeal(g)}>Deal{g.wager ? ` · ${g.wager}` : ""}</ActionButton>
            </div>
            <p className="text-center font-mono text-[10px] text-[#756a5a] mt-2">
              Table {E.RULES.minBet}–{E.RULES.maxBet} · <Kbd>Enter</Kbd> deal · <Kbd>R</Kbd> rebet · <Kbd>Esc</Kbd> clear
            </p>
          </div>
        ) : g.phase === "insurance" ? (
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={() => act(E.takeInsurance)} disabled={insuranceAmt > g.bankroll}>{evenMoney ? "Even money" : `Insure · ${insuranceAmt}`} <Kbd>Y</Kbd></ActionButton>
            <ActionButton onClick={() => act(E.declineInsurance)} secondary>No thanks <Kbd>N</Kbd></ActionButton>
          </div>
        ) : g.phase === "player" ? (
          <div className="grid grid-cols-4 gap-2">
            <ActionButton onClick={() => act(E.hit)} disabled={!E.canHit(g)}>Hit <Kbd>H</Kbd></ActionButton>
            <ActionButton onClick={() => act(E.stand)} secondary>Stand <Kbd>S</Kbd></ActionButton>
            <ActionButton onClick={() => act(E.double)} disabled={!E.canDouble(g)} secondary>Double <Kbd>D</Kbd></ActionButton>
            <ActionButton onClick={() => act(E.split)} disabled={!E.canSplit(g)} secondary>Split <Kbd>P</Kbd></ActionButton>
          </div>
        ) : g.phase === "settled" ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <ActionButton onClick={() => act(E.nextRound)} secondary>New bet <Kbd>Esc</Kbd></ActionButton>
            <ActionButton onClick={rebetAndDeal} disabled={Math.min(g.lastWager, E.maxWager(g)) < E.RULES.minBet}>
              Deal again · {Math.min(g.lastWager, E.maxWager(g))} <Kbd>Enter</Kbd>
            </ActionButton>
          </div>
        ) : (
          <div className="h-11" aria-hidden />
        )}
        {activeHand && g.phase === "player" && activeHand.splitAces && (
          <p className="text-center font-mono text-[10px] text-[#756a5a] mt-2">Split aces take one card each.</p>
        )}
      </div>

      {/* Sheets */}
      <GameSheet open={sheet === "rules"} onClose={() => setSheet(null)} title="Table rules">
        <p className="text-sm text-[#6f6455] mb-4">Every line here is what the dealer actually does — the engine is built from this table, not the other way round.</p>
        <StatRows rows={rulesRows} />
        <SectionLabel>Keys</SectionLabel>
        <p className="text-xs text-[#6f6455] leading-relaxed">
          <Kbd>H</Kbd> hit · <Kbd>S</Kbd> stand · <Kbd>D</Kbd> double · <Kbd>P</Kbd> split · <Kbd>Y</Kbd>/<Kbd>N</Kbd> insurance · <Kbd>Enter</Kbd> deal · <Kbd>R</Kbd> rebet · <Kbd>Esc</Kbd> clear
        </p>
      </GameSheet>
      <GameSheet open={sheet === "stats"} onClose={() => setSheet(null)} title="Session">
        <StatRows rows={statRows} />
        <SectionLabel>Reset</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <button onClick={resetStats} className="px-3 py-2 rounded-lg border border-[#e8e2d8] dark:border-[#3a3530] text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:border-(--accent) hover:text-(--accent) transition-colors">Reset stats</button>
          <button onClick={resetBankroll} className="px-3 py-2 rounded-lg border border-[#e8e2d8] dark:border-[#3a3530] text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:border-(--accent) hover:text-(--accent) transition-colors">Reset bankroll</button>
        </div>
        <p className="text-[11px] text-[#756a5a] mt-3">Chips are fictional and live only in this browser.</p>
      </GameSheet>
      <GameSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Settings">
        <GameSettingsBody />
      </GameSheet>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, secondary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 px-2 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-widest transition-colors inline-flex max-sm:[&_kbd]:hidden items-center justify-center gap-1.5 disabled:opacity-35 disabled:cursor-not-allowed ${
        secondary
          ? "border-2 border-[#e8e2d8] dark:border-[#3a3530] text-[#111010] dark:text-[#e8ddd0] hover:border-(--accent) disabled:hover:border-[#e8e2d8]"
          : "bg-(--accent) text-(--accent-on) hover:bg-(--accent-dim)"
      }`}
    >
      {children}
    </button>
  );
}
