// components/games/mahjong/Mahjong.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BookOpen, RotateCcw, Smartphone } from "lucide-react";
import { type Tile, type Seat, WIND_NAMES, WIND_EN, tileName } from "./tiles";
import { waitingOn, isComplete, MIN_FAN } from "./scoring";
import { type Difficulty, type ClaimKind, rankDiscards } from "./bot";
import * as E from "./engine";
import TileView from "./TileView";
import Guide from "./Guide";

// Hong Kong mahjong vs three bots. All rules live in engine.ts / scoring.ts;
// this file schedules bot turns on a timer and draws the table. The board
// is a 3×3 grid in landscape (you at the bottom, Tyunnie opposite) and
// collapses to a stack in portrait with a rotate nudge — never a hard block,
// since some phones lock rotation.

const BOT_DELAY_MS = 650;
const DRAW_DELAY_MS = 250;
const HINTS_KEY = "tyunnie_mahjong_hints";

const QUIPS = {
  humanWin: [
    "Okay that was clean. Don't let it go to your head 🧡",
    "You actually read the table. Proud of you.",
    "Fan counted twice. It's real. Nice.",
  ],
  humanShot: [
    "You fed that one. We've all done it.",
    "That discard was… brave.",
    "Next time, look at what they've thrown first.",
  ],
  tyunWin: [
    "Mine. Sorry. Not sorry.",
    "Told you I don't count tiles. I lied.",
    "House wins. The house is me again.",
  ],
  otherWin: [
    "Not me this time. Still, someone at this table can play.",
    "Watch how they built that — pairs first.",
    "Slow round. Reset and go again.",
  ],
  draw: [
    "Wall's gone. Nobody made three fan.",
    "Draw. Honestly, that's normal at a 3-fan table.",
    "Nothing this time. Same dealer, new wall.",
  ],
};
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

export default function Mahjong() {
  const [g, setG] = useState<E.Game | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  // Lazy init — this component is dynamic({ ssr:false }), so storage is safe here.
  const [hints, setHints] = useState(() => {
    try {
      return localStorage.getItem(HINTS_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [guide, setGuide] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveHints = (v: boolean) => {
    setHints(v);
    try {
      localStorage.setItem(HINTS_KEY, v ? "1" : "0");
    } catch {}
  };

  // ── Bot / auto scheduling ──
  // Every transition bumps `tick`, so this runs once per state and never
  // twice for the same one. The timer is cleared on unmount and on every
  // re-run, so a stale bot turn can't land on a new hand.
  useEffect(() => {
    if (!g) return;
    if (timer.current) clearTimeout(timer.current);
    const later = (ms: number, fn: (x: E.Game) => E.Game) => {
      timer.current = setTimeout(
        () => setG((cur) => (cur && cur.tick === g.tick ? fn(cur) : cur)),
        ms,
      );
    };
    if (g.phase === "draw") later(DRAW_DELAY_MS, E.draw);
    else if (g.phase === "discard" && g.turn !== E.HUMAN)
      later(BOT_DELAY_MS, E.botAct);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [g]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // One quip per result object — the result is a new object each hand, and
  // the same object across re-renders, so the random pick stays put.
  const result = g?.result ?? null;
  const quip = useMemo(() => {
    if (!result) return "";
    if (result.kind === "draw") return pick(QUIPS.draw);
    if (result.winner === E.HUMAN) return pick(QUIPS.humanWin);
    if (result.shooter === E.HUMAN) return pick(QUIPS.humanShot);
    return pick(result.winner === 2 ? QUIPS.tyunWin : QUIPS.otherWin);
  }, [result]);

  // ── Board measurement ──
  // 14 hand tiles + up to 4 melds must fit one row; width drives the tile
  // size. Below 560px we treat the board as portrait and stack it. The
  // threshold is the board, not the viewport: <main> takes 32px of padding,
  // so a 640-wide phone held sideways measures 608 — 640 here put the
  // "rotate your phone" banner on a phone that was already rotated.
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardW, setBoardW] = useState(720);
  const tableMounted = g !== null;
  useEffect(() => {
    // The ref only exists once the setup screen is gone — re-run on that
    // switch, or the observer attaches to nothing and the board never measures.
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoardW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableMounted]);
  const landscape = boardW >= 560;
  const tileW = Math.round(
    Math.min(40, Math.max(24, (boardW - (landscape ? 200 : 16) - 17 * 3) / 18)),
  );
  const miniW = Math.round(tileW * 0.6);

  // ── Human actions ──
  const me = g?.players[E.HUMAN];
  const myTurn = !!g && g.phase === "discard" && g.turn === E.HUMAN;
  const canWin = g && myTurn ? E.selfWinScore(g, E.HUMAN) : null;
  const kongs = g && myTurn ? E.kongOptions(g, E.HUMAN) : [];

  const onTile = useCallback(
    (id: number) => {
      if (!myTurn) return;
      setSelected((s) => (s === id ? null : id));
    },
    [myTurn],
  );

  const doDiscard = (id: number) => {
    if (!g || !myTurn) return;
    setSelected(null);
    setG(E.discard(g, E.HUMAN, id));
  };

  // Hints — computed only when it's the human's move.
  let hintDiscard: number | null = null;
  let waits: string[] = [];
  let underMin = false;
  if (g && me && hints && myTurn) {
    const visible = g.players.flatMap((q) => [
      ...q.discards,
      ...q.melds.flatMap((m) => m.tiles),
    ]);
    hintDiscard =
      rankDiscards(me.hand, me.melds, visible, E.fanCtx(g, E.HUMAN))[0]?.id ??
      null;
    if (isComplete(me.hand, me.melds) && !canWin) underMin = true;
  }
  if (
    g &&
    me &&
    hints &&
    (g.phase === "draw" ||
      g.phase === "claim" ||
      (g.phase === "discard" && !myTurn))
  ) {
    waits = waitingOn(me.hand, me.melds);
  }

  // ── Setup screen ──
  if (!g) {
    return (
      <div className="max-w-md mx-auto select-none">
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <p className="text-sm text-[#111010] mb-4">
            Hong Kong rules. Four sets and a pair, three fan minimum. Tyunnie
            sits across from you and claims to be bad at it.
          </p>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#6f6455] mb-2">
            Bots
          </div>
          <div
            className="grid grid-cols-3 gap-2 mb-4"
            role="group"
            aria-label="Difficulty"
          >
            {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                aria-pressed={difficulty === d}
                className={`py-2 rounded-xl text-xs font-bold uppercase tracking-widest border-2 transition-all ${
                  difficulty === d
                    ? "bg-[#f97316] border-[#f97316] text-white"
                    : "border-[#e8e2d8] text-[#111010] hover:border-[#f97316]"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 mb-5 cursor-pointer text-sm text-[#111010]">
            <input
              type="checkbox"
              checked={hints}
              onChange={(e) => saveHints(e.target.checked)}
              className="accent-[#f97316] w-4 h-4"
            />
            Show hints while I learn
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setG(E.newGame(difficulty))}
              className="flex-1 py-2.5 rounded-xl bg-[#f97316] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#c2500f] transition-all"
            >
              Deal
            </button>
            <button
              onClick={() => setGuide(true)}
              className="px-4 py-2.5 rounded-xl border-2 border-[#e8e2d8] text-[#111010] text-xs font-bold uppercase tracking-widest hover:border-[#f97316] transition-all flex items-center gap-2"
            >
              <BookOpen size={16} strokeWidth={1.75} /> How to play
            </button>
          </div>
        </div>
        <Guide
          open={guide}
          onClose={() => setGuide(false)}
          hints={hints}
          onHints={saveHints}
        />
      </div>
    );
  }

  // ── Table ──
  const seatWindOf = (s: Seat) => WIND_NAMES[(((s - g.dealer) % 4) + 4) % 4];
  const bot = (s: Seat, vertical: boolean) => {
    const p = g.players[s];
    const active =
      g.turn === s && (g.phase === "discard" || g.phase === "draw");
    return (
      <div
        className={`flex ${vertical ? "flex-col items-center" : "flex-row items-center"} gap-2 ${vertical ? "" : "justify-center"}`}
      >
        <div
          className={`font-mono text-[10px] uppercase tracking-widest ${active ? "text-[#f97316] font-bold" : "text-[#6f6455]"} ${vertical ? "[writing-mode:vertical-rl]" : ""}`}
        >
          {E.NAMES[s]} <span className="text-[#c2500f]">{seatWindOf(s)}</span>
          {g.dealer === s ? " · dealer" : ""} · {p.score}
        </div>
        {!landscape && s !== 2 ? (
          // Portrait: the two side seats share a row — a count beats 13 wrapping backs.
          <span className="font-mono text-[10px] text-[#6f6455] bg-[#f3f0ea] rounded-full px-2 py-0.5">
            {p.hand.length} tiles
          </span>
        ) : (
          <div
            className={`flex ${vertical ? "flex-col" : "flex-row flex-wrap"} gap-[2px]`}
            aria-label={`${p.hand.length} tiles`}
          >
            {p.hand.map((t) =>
              vertical ? (
                // Side seats hold their tiles sideways — a bar the height of a
                // tile edge, so 14 of them stack without wrapping.
                <div
                  key={t.id}
                  className="rounded-[2px] bg-[#f97316] border border-[#c2500f]"
                  style={{
                    width: Math.round(miniW * 1.35),
                    height: Math.round(miniW * 0.45),
                  }}
                  aria-hidden
                />
              ) : (
                <TileView key={t.id} width={miniW} faceDown />
              ),
            )}
          </div>
        )}
        <div
          className={`flex ${vertical ? "flex-col" : "flex-row"} gap-1 flex-wrap justify-center`}
        >
          {p.melds.map((m, i) => (
            <div key={i} className="flex gap-px">
              {m.tiles.map((t, j) => (
                <TileView
                  key={t.id}
                  tile={t}
                  width={miniW}
                  faceDown={!!m.concealed && j > 0}
                />
              ))}
            </div>
          ))}
          {p.flowers.length > 0 && (
            <div className="flex gap-px">
              {p.flowers.map((t) => (
                <TileView key={t.id} tile={t} width={miniW} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const pool = (s: Seat) => {
    const p = g.players[s];
    const isLast = g.lastDiscard?.seat === s;
    return (
      <div className="min-h-[1.5rem]">
        <div className="font-mono text-[10px] md:text-[9px] uppercase tracking-widest text-[#756a5a] mb-0.5">
          {E.NAMES[s]}
        </div>
        <div className="flex flex-wrap gap-[2px]">
          {p.discards.map((t, i) => (
            <div
              key={t.id}
              className={
                isLast && i === p.discards.length - 1
                  ? "ring-2 ring-[#f97316] rounded-[3px]"
                  : ""
              }
            >
              <TileView tile={t} width={miniW} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const status = (() => {
    if (g.phase === "claim")
      return `${E.NAMES[g.lastDiscard!.seat]} threw ${tileName(g.lastDiscard!.tile)}. Take it?`;
    if (g.phase === "rob")
      return `${E.NAMES[g.pendingKong!.seat]} is adding to a pung — you can rob it and win.`;
    if (myTurn)
      return canWin
        ? "You can win."
        : selected !== null
          ? "Tap Discard, or pick another tile."
          : "Your turn — pick a tile to discard.";
    if (g.phase === "discard" || g.phase === "draw")
      return `${E.NAMES[g.turn]} is thinking…`;
    return "";
  })();

  return (
    <div ref={boardRef} className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="font-mono text-xs text-[#6f6455]">
          <span className="font-bold text-[#111010]">
            {WIND_EN[g.roundWind]} round
          </span>
          <span className="mx-2 text-[#e8e2d8]">·</span>hand {g.handNo + 1}/
          {E.HANDS_PER_GAME}
          <span className="mx-2 text-[#e8e2d8]">·</span>
          {Math.max(0, g.wall.length - E.DEAD_WALL)} left
          <span className="mx-2 text-[#e8e2d8]">·</span>
          <span className="capitalize">{g.difficulty}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGuide(true)}
            aria-label="How to play"
            className="tap-target w-8 h-8 rounded-xl border-2 border-[#e8e2d8] hover:border-[#f97316] flex items-center justify-center text-[#111010] transition-all"
          >
            <BookOpen size={16} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setG(null);
              setSelected(null);
            }}
            className="px-4 py-1.5 rounded-xl bg-[#f97316] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#c2500f] transition-all flex items-center gap-1.5"
          >
            <RotateCcw size={14} strokeWidth={2} /> New game
          </button>
        </div>
      </div>

      {!landscape && (
        <div className="flex items-center gap-2 text-xs text-[#6f6455] bg-[#fff0e6] border border-[#fed7aa] rounded-xl px-3 py-2 mb-3">
          <Smartphone
            size={16}
            strokeWidth={1.75}
            className="shrink-0 rotate-90"
          />
          Rotate your phone for the full table. Portrait works — it&apos;s just
          cosier.
        </div>
      )}

      {/* Table */}
      <div
        className={landscape ? "grid gap-3" : "flex flex-col gap-3"}
        style={
          landscape
            ? {
                gridTemplateColumns: "auto 1fr auto",
                gridTemplateRows: "auto 1fr auto",
              }
            : undefined
        }
      >
        {landscape ? (
          <>
            <div />
            <div>{bot(2, false)}</div>
            <div />
            <div className="flex items-center">{bot(3, true)}</div>
            <div className="bg-[#f3f0ea] rounded-2xl p-3 grid grid-cols-2 gap-x-3 gap-y-2 content-start min-h-[180px]">
              <div className="col-span-2">{pool(2)}</div>
              {pool(3)}
              {pool(1)}
              <div className="col-span-2">{pool(0)}</div>
            </div>
            <div className="flex items-center">{bot(1, true)}</div>
            <div />
          </>
        ) : (
          <>
            {bot(2, false)}
            <div className="grid grid-cols-2 gap-2">
              {bot(3, false)}
              {bot(1, false)}
            </div>
            <div className="bg-[#f3f0ea] rounded-2xl p-3 grid grid-cols-2 gap-x-3 gap-y-2">
              <div className="col-span-2">{pool(2)}</div>
              {pool(3)}
              {pool(1)}
              <div className="col-span-2">{pool(0)}</div>
            </div>
          </>
        )}

        {/* You */}
        <div className={landscape ? "col-span-3" : ""}>
          <div className="flex items-baseline justify-between mb-1.5 flex-wrap gap-2">
            <div
              className={`font-mono text-[10px] uppercase tracking-widest ${myTurn ? "text-[#f97316] font-bold" : "text-[#6f6455]"}`}
            >
              You <span className="text-[#c2500f]">{seatWindOf(E.HUMAN)}</span>
              {g.dealer === E.HUMAN ? " · dealer" : ""} · {me!.score}
            </div>
            <div
              className="font-mono text-xs text-[#111010]"
              role="status"
              aria-live="polite"
            >
              {status}
            </div>
          </div>

          {(me!.melds.length > 0 || me!.flowers.length > 0) && (
            <div className="flex gap-2 flex-wrap mb-2">
              {me!.melds.map((m, i) => (
                <div key={i} className="flex gap-px">
                  {m.tiles.map((t) => (
                    <TileView key={t.id} tile={t} width={miniW} />
                  ))}
                </div>
              ))}
              {me!.flowers.length > 0 && (
                <div className="flex gap-px opacity-80">
                  {me!.flowers.map((t) => (
                    <TileView key={t.id} tile={t} width={miniW} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            className={`flex gap-[3px] items-end ${landscape ? "flex-wrap" : "overflow-x-auto pb-2"}`}
          >
            {me!.hand.map((t) => {
              const drawn = t.id === g.drawnId;
              return (
                <div key={t.id} className={drawn ? "ml-3" : ""}>
                  <TileView
                    tile={t}
                    width={tileW}
                    selected={selected === t.id}
                    hint={hints && hintDiscard === t.id}
                    onClick={() => onTile(t.id)}
                    label={`${tileName(t)}${drawn ? ", just drawn" : ""}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Hints */}
          {hints && (waits.length > 0 || underMin) && (
            <p className="font-mono text-[10px] text-[#6f6455] mt-1.5">
              {underMin
                ? `Complete hand, but under ${MIN_FAN} fan — you can't declare it yet.`
                : `Waiting on: ${waits.map((k) => tileName({ id: -1, suit: k[0] as Tile["suit"], rank: Number(k.slice(1)) })).join(", ")}`}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {myTurn && (
              <>
                {canWin && (
                  <Btn
                    primary
                    onClick={() => setG(E.declareWin(g, E.HUMAN))}
                    pulse={hints}
                  >
                    Win · {canWin.total} fan
                  </Btn>
                )}
                {kongs.map((k) => (
                  <Btn
                    key={k}
                    onClick={() => {
                      setSelected(null);
                      setG(E.declareKong(g, E.HUMAN, k));
                    }}
                  >
                    Kong{" "}
                    {tileName({
                      id: -1,
                      suit: k[0] as Tile["suit"],
                      rank: Number(k.slice(1)),
                    })}
                  </Btn>
                ))}
                <Btn
                  primary={!canWin}
                  disabled={selected === null}
                  onClick={() => selected !== null && doDiscard(selected)}
                >
                  Discard
                </Btn>
              </>
            )}
            {g.phase === "claim" && (
              <>
                {g.humanClaims.map((c) => (
                  <Btn
                    key={c}
                    primary={c === "win"}
                    pulse={hints}
                    onClick={() =>
                      setG(E.resolveClaims(g, c as ClaimKind | "win"))
                    }
                  >
                    {c === "win" ? "Win" : c[0].toUpperCase() + c.slice(1)}
                  </Btn>
                ))}
                <Btn onClick={() => setG(E.resolveClaims(g, null))}>Pass</Btn>
              </>
            )}
            {g.phase === "rob" && (
              <>
                <Btn
                  primary
                  pulse={hints}
                  onClick={() => setG(E.robKong(g, E.HUMAN))}
                >
                  Rob the kong · Win
                </Btn>
                <Btn onClick={() => setG(E.declineRob(g))}>Pass</Btn>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hand over / game over */}
      {(g.phase === "handOver" || g.phase === "gameOver") && (
        <div
          className="mt-4 bg-white border border-[#e8e2d8] rounded-2xl p-4"
          role="status"
          aria-live="polite"
        >
          {g.phase === "gameOver" ? (
            <>
              <p className="font-bold text-[#111010] text-sm mb-2">
                Game over — 16 hands
              </p>
              <ScoreRows g={g} />
              <div className="mt-3">
                <Btn primary onClick={() => setG(null)}>
                  New game
                </Btn>
              </div>
            </>
          ) : result?.kind === "draw" ? (
            <>
              <p className="font-bold text-[#111010] text-sm">
                Draw — wall exhausted
              </p>
              <p className="text-xs text-[#6f6455] mt-0.5 mb-3">{quip}</p>
              <Btn primary onClick={() => setG(E.nextHand(g))}>
                Next hand
              </Btn>
            </>
          ) : result ? (
            <>
              <p className="font-bold text-[#111010] text-sm">
                {E.NAMES[result.winner]}{" "}
                {result.winner === E.HUMAN ? "win" : "wins"} ·{" "}
                {result.score.total} fan
                {result.shooter !== null
                  ? ` · off ${E.NAMES[result.shooter]}`
                  : " · self-drawn"}
              </p>
              <p className="text-xs text-[#6f6455] mt-0.5 mb-3">{quip}</p>
              <div className="flex gap-[2px] flex-wrap mb-3">
                {g.players[result.winner].melds.map((m, i) => (
                  <div key={i} className="flex gap-px mr-2">
                    {m.tiles.map((t) => (
                      <TileView key={t.id} tile={t} width={miniW} />
                    ))}
                  </div>
                ))}
                {g.players[result.winner].hand.map((t) => (
                  <div
                    key={t.id}
                    className={
                      t.id === result.winningTile.id
                        ? "ring-2 ring-[#f97316] rounded-[3px]"
                        : ""
                    }
                  >
                    <TileView tile={t} width={miniW} />
                  </div>
                ))}
              </div>
              <ul className="text-xs text-[#111010] divide-y divide-[#e8e2d8] mb-3">
                {result.score.fans.map((f, i) => (
                  <li key={i} className="flex justify-between py-1">
                    <span>
                      {f.name} <span className="text-[#6f6455]">{f.zh}</span>
                    </span>
                    <span className="font-mono font-bold">{f.fan}</span>
                  </li>
                ))}
              </ul>
              <ScoreRows g={g} deltas={result.deltas} />
              <div className="mt-3">
                <Btn primary onClick={() => setG(E.nextHand(g))}>
                  Next hand
                </Btn>
              </div>
            </>
          ) : null}
        </div>
      )}

      <p className="text-center text-[10px] text-[#756a5a] font-mono mt-6">
        Hong Kong rules · {MIN_FAN} fan minimum · Chow only from the left · Tap
        a tile, then Discard
      </p>

      <Guide
        open={guide}
        onClose={() => setGuide(false)}
        hints={hints}
        onHints={saveHints}
      />
    </div>
  );
}

function ScoreRows({ g, deltas }: { g: E.Game; deltas?: number[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {g.players.map((p, i) => (
        <div key={i} className="bg-[#f3f0ea] rounded-xl py-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#6f6455]">
            {E.NAMES[i]}
          </div>
          <div className="font-mono text-sm font-bold text-[#111010]">
            {p.score}
          </div>
          {deltas && deltas[i] !== 0 && (
            <div
              className={`font-mono text-[10px] ${deltas[i] > 0 ? "text-[#15803d]" : "text-[#c2500f]"}`}
            >
              {deltas[i] > 0 ? "+" : "−"}
              {Math.abs(deltas[i])}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Btn({
  children,
  onClick,
  primary,
  disabled,
  pulse,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  pulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        primary
          ? "bg-[#f97316] text-white hover:bg-[#c2500f]"
          : "border-2 border-[#e8e2d8] text-[#111010] hover:border-[#f97316]"
      } ${pulse ? "motion-safe:animate-pulse" : ""}`}
    >
      {children}
    </button>
  );
}
