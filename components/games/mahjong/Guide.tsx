// components/games/mahjong/Guide.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { MIN_FAN, LIMIT, POINTS } from "./scoring";

// The fan table shown here must match what scoring.ts awards — same names,
// same values. If one changes, change both.
const FAN_TABLE: { name: string; zh: string; fan: number | "limit"; how: string }[] = [
  { name: "No flowers", zh: "無花", fan: 1, how: "You drew no flower or season tiles." },
  { name: "Seat flower", zh: "正花", fan: 1, how: "A flower matching your seat wind (1 fan each)." },
  { name: "Self-drawn", zh: "自摸", fan: 1, how: "You won on a tile you drew from the wall." },
  { name: "Concealed hand", zh: "門前清", fan: 1, how: "No exposed melds; won on a discard." },
  { name: "Concealed self-draw", zh: "門清自摸", fan: 1, how: "No exposed melds and self-drawn (stacks with Self-drawn)." },
  { name: "Seat wind pung", zh: "門風", fan: 1, how: "A pung or kong of your seat wind." },
  { name: "Round wind pung", zh: "圈風", fan: 1, how: "A pung or kong of the round wind." },
  { name: "Dragon pung", zh: "三元牌", fan: 1, how: "A pung or kong of 中, 發 or 白 (1 each)." },
  { name: "All chows", zh: "平糊", fan: 1, how: "Four chows and a pair; no honours." },
  { name: "Last tile", zh: "海底撈月", fan: 1, how: "Won on the last tile of the wall." },
  { name: "Win off a kong", zh: "槓上開花", fan: 1, how: "Won on the replacement tile after declaring a kong." },
  { name: "Robbing the kong", zh: "搶槓", fan: 1, how: "Won on the tile someone added to their pung." },
  { name: "Mixed one suit", zh: "混一色", fan: 3, how: "One suit plus honours." },
  { name: "All pungs", zh: "對對糊", fan: 3, how: "Four pungs/kongs and a pair." },
  { name: "Little three dragons", zh: "小三元", fan: 5, how: "Two dragon pungs and a pair of the third." },
  { name: "Little four winds", zh: "小四喜", fan: 6, how: "Three wind pungs and a pair of the fourth." },
  { name: "Pure one suit", zh: "清一色", fan: 7, how: "Every tile in one suit, no honours." },
  { name: "Big three dragons", zh: "大三元", fan: 8, how: "Pungs of all three dragons." },
  { name: "All honours", zh: "字一色", fan: 10, how: "Only winds and dragons." },
  { name: "All terminals", zh: "清么九", fan: 10, how: "Only 1s and 9s." },
  { name: "Thirteen orphans", zh: "十三么", fan: "limit", how: "One of every 1, 9, wind and dragon, plus a pair of any." },
  { name: "Big four winds", zh: "大四喜", fan: "limit", how: "Pungs of all four winds." },
  { name: "Four kongs", zh: "十八羅漢", fan: "limit", how: "Four kongs." },
  { name: "Nine gates", zh: "九蓮寶燈", fan: "limit", how: "1112345678999 of one suit, concealed, waiting on any of the nine." },
  { name: "All flowers", zh: "八仙過海", fan: "limit", how: "All eight flowers and seasons." },
  { name: "Heavenly hand", zh: "天糊", fan: "limit", how: "Dealer wins on the opening 14." },
  { name: "Earthly hand", zh: "地糊", fan: "limit", how: "Non-dealer wins on the dealer's first discard." },
];

type Tab = "play" | "fan" | "tips";

export default function Guide({
  open,
  onClose,
  hints,
  onHints,
}: {
  open: boolean;
  onClose: () => void;
  hints: boolean;
  onHints: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("play");
  const ref = useFocusTrap<HTMLDivElement>(open);
  if (!open) return null;

  // Portalled to <body>: the dashboard's panel wrapper keeps a transform from
  // its entrance animation (fill-mode both), which makes it the containing
  // block for any `fixed` descendant — inside it the sheet sat below the
  // header, ran 100dvh past the viewport bottom, and lost to the z-50 dock.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <button className="absolute inset-0 bg-black/30 no-tap" aria-label="Close guide" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mj-guide-title"
        tabIndex={-1}
        className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
        style={{ height: "100dvh" }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#e8e2d8]">
          <h2 id="mj-guide-title" className="font-serif italic text-xl text-[#111010]">How to win at Mahjong</h2>
          <button onClick={onClose} aria-label="Close" className="tap-target text-[#6f6455] hover:text-[#111010]">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-3">
          {(["play", "fan", "tips"] as Tab[]).map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                tab === t ? "bg-[#f97316] text-white" : "text-[#6f6455] hover:bg-[#fff0e6]"
              }`}
            >
              {t === "play" ? "How to play" : t === "fan" ? "Fan table" : "Tips"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-[#111010] space-y-4">
          {tab === "play" && (
            <>
              <Section title="The goal">
                Build a hand of <b>14 tiles</b>: <b>four sets</b> and <b>one pair</b>. Then declare a win (糊). You start with 13; each turn you draw one and discard one.
              </Section>
              <Section title="Sets">
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>Chow</b> (上) — three in a row, one suit: 4·5·6 筒.</li>
                  <li><b>Pung</b> (碰) — three identical tiles.</li>
                  <li><b>Kong</b> (槓) — four identical tiles. Still counts as one set; you draw a replacement.</li>
                </ul>
              </Section>
              <Section title="Tiles">
                Three suits of 1–9 (萬 characters, 筒 dots, 條 bamboo), four winds (東南西北), three dragons (中 發 白), and eight flowers. Flowers aren&apos;t played — they&apos;re set aside for bonus fan and you draw again.
              </Section>
              <Section title="Claiming discards">
                When someone discards a tile you need, you can take it — but the set goes face-up on the table. <b>Pung/Kong</b> from anyone. <b>Chow</b> only from the player on your left. <b>Win</b> from anyone. A win beats a pung, a pung beats a chow.
              </Section>
              <Section title="The 3-fan minimum">
                A complete hand isn&apos;t enough — it must score at least <b>{MIN_FAN} fan</b>. The Fan table tab lists every way to earn them. The easiest: no flowers (1) + self-drawn (1) + concealed (1). Or build toward one suit or all pungs.
              </Section>
              <Section title="Scoring">
                Fan converts to points: {Object.entries(POINTS).map(([f, p]) => `${f}→${p}`).join(", ")}. Limit is {LIMIT}. Self-draw: all three pay full. Discard: the shooter pays full, the other two pay half.
              </Section>
              <Section title="Rounds">
                The dealer keeps the deal after winning or a draw; otherwise it passes right. After four dealers the round wind changes. A game is 16 hands.
              </Section>
            </>
          )}

          {tab === "fan" && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-[#6f6455]">
                  <th className="pb-2">Hand</th>
                  <th className="pb-2 text-right">Fan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e2d8]">
                {FAN_TABLE.map((f) => (
                  <tr key={f.name}>
                    <td className="py-2 pr-3">
                      <div className="font-bold">{f.name} <span className="text-[#6f6455] font-normal">{f.zh}</span></div>
                      <div className="text-[#6f6455]">{f.how}</div>
                    </td>
                    <td className="py-2 text-right font-mono font-bold whitespace-nowrap align-top">
                      {f.fan === "limit" ? `${LIMIT} · limit` : f.fan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "tips" && (
            <>
              <Section title="Start here">
                Don&apos;t chase everything. Look at your 13 tiles: which suit do you have most of? Keep that suit and the honours, throw the rest. You&apos;re aiming for <b>Mixed one suit</b> (3 fan) — the most reachable hand.
              </Section>
              <Section title="Throw early">
                Lone winds and dragons that aren&apos;t your seat or round wind are dead weight. Lone 1s and 9s next — they only fit one chow.
              </Section>
              <Section title="Pairs are gold">
                Two pairs can become two pungs. Three pairs plus anything is an <b>All pungs</b> hand in the making (3 fan). Don&apos;t break pairs to make chows.
              </Section>
              <Section title="Claim with a plan">
                Every claim exposes a set and loses the concealed-hand fan. Pung only if it moves you toward 3 fan. Chow almost never — unless it finishes the hand.
              </Section>
              <Section title="Watch the shooter">
                If you discard the tile someone wins on, you pay double. Late in the hand, throw tiles others have already thrown.
              </Section>
              <Section title="Hints">
                <label className="flex items-center gap-3 mt-1 cursor-pointer">
                  <input type="checkbox" checked={hints} onChange={(e) => onHints(e.target.checked)} className="accent-[#f97316] w-4 h-4" />
                  <span>Show hints — suggested discard, what you&apos;re waiting on, and whether your hand clears 3 fan.</span>
                </label>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#6f6455] mb-1">{title}</h3>
      <div className="leading-relaxed">{children}</div>
    </section>
  );
}
