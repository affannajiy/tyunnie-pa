// components/games/solitaire/Solitaire.tsx
// Klondike table over engine.ts. Owns: card sizing, click-to-move selection,
// pointer drag with a ghost stack, double-tap to foundation, the clock,
// auto-complete pacing and persistence. Every legality question goes to the
// engine — this file never compares two cards.
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { BookOpen, BarChart3, Settings2, RotateCcw, Timer, Undo2, Sparkles, Layers, ChevronsUp } from "lucide-react";
import * as E from "./engine";
import { type Card, SUITS, CardView } from "../cards";
import { FELT, FeltVignette, GameSheet, GameSettingsBody, StatRows, SectionLabel, HeaderButton, Segmented, ignoreGameKey } from "../ui";
import { readStore, writeStore, clearStore, useGameSettings, scaleDelay } from "@/lib/gameStore";
import { play, setAudioEnabled } from "@/lib/gameAudio";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { Kbd } from "@/components/ui/Kbd";

const PREFS_KEY = "solitaire";
const STATS_KEY = "solitaire_stats";
const SAVE_KEY = "solitaire_save";
const DRAG_THRESHOLD = 5;
const DOUBLE_TAP_MS = 350;
const AUTO_STEP_MS = 140;

type Prefs = { draw: number };
const PREFS_DEFAULT: Prefs = { draw: 1 };
type Save = { game: E.Game | null };
const asDraw = (n: number): E.Draw => (n === 3 ? 3 : 1);

const QUIPS = ["You actually won?? Respect 🧡", "Solitaire master. I'm telling everyone.", "That's my person 🧡", "Okay I'm genuinely impressed."];
const pick = (a: string[], seed: number) => a[seed % a.length];
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const fromKey = (f: E.From) => (f.pile === "waste" ? "w" : f.pile === "foundation" ? `f${f.index}` : `t${f.index}-${f.card}`);
const sameFrom = (a: E.From | null, b: E.From) => !!a && fromKey(a) === fromKey(b);

function parseDrop(el: Element | null): E.To | null {
  const t = el?.closest<HTMLElement>("[data-drop]")?.dataset.drop;
  if (!t) return null;
  const [pile, idx] = t.split("-");
  if (pile !== "foundation" && pile !== "tableau") return null;
  return { pile, index: Number(idx) };
}

function Slot({ label, dashed = true }: { label?: string; dashed?: boolean }) {
  return (
    <div className={`w-full h-full rounded border-2 ${dashed ? "border-dashed" : ""} border-white/15 flex items-center justify-center text-white/25 text-lg font-serif`}>
      {label}
    </div>
  );
}

export default function Solitaire() {
  const [settings] = useGameSettings();
  useEffect(() => setAudioEnabled(settings.sound), [settings.sound]);

  const [prefs, setPrefs] = useState<Prefs>(() => readStore(PREFS_KEY, PREFS_DEFAULT));
  const [stats, setStats] = useState<E.Stats>(() => {
    const s = readStore(STATS_KEY, E.EMPTY_STATS);
    return { ...E.EMPTY_STATS, ...s, draw1: { ...E.EMPTY_STATS.draw1, ...s.draw1 }, draw3: { ...E.EMPTY_STATS.draw3, ...s.draw3 } };
  });
  const [g, setG] = useState<E.Game>(() => E.deal(asDraw(readStore(PREFS_KEY, PREFS_DEFAULT).draw)));
  const [resumable, setResumable] = useState<E.Game | null>(() => {
    const sv = readStore<Save>(SAVE_KEY, { game: null }).game;
    return sv && sv.status === "playing" && Array.isArray(sv.tableau) && sv.tableau.length === 7 && Array.isArray(sv.stock) ? { ...sv, undo: sv.undo ?? [] } : null;
  });
  const [sheet, setSheet] = useState<"rules" | "stats" | "settings" | null>(null);
  const [sel, setSel] = useState<E.From | null>(null);
  const [dragFrom, setDragFrom] = useState<E.From | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);

  useEffect(() => writeStore(PREFS_KEY, prefs), [prefs]);
  useEffect(() => writeStore(STATS_KEY, stats), [stats]);

  const gRef = useRef(g);
  useEffect(() => { gRef.current = g; }, [g]);
  useEffect(() => {
    const cur = gRef.current;
    if (cur.status === "playing" && cur.moves > 0) writeStore<Save>(SAVE_KEY, { game: { ...cur, undo: cur.undo.slice(-60) } });
    else if (cur.status !== "playing") clearStore(SAVE_KEY);
  }, [g.tick, g.status]);
  useEffect(() => () => { const cur = gRef.current; if (cur.status === "playing" && cur.moves > 0) writeStore<Save>(SAVE_KEY, { game: { ...cur, undo: cur.undo.slice(-60) } }); }, []);

  useEffect(() => {
    if (g.status !== "playing" || resumable || g.moves === 0) return;
    const t = setInterval(() => setG((cur) => E.tickSecond(cur)), 1000);
    return () => clearInterval(t);
  }, [g.status, resumable, g.moves]);

  const recorded = useRef(false);
  useEffect(() => {
    if (g.status === "won" && !recorded.current) { recorded.current = true; setStats((s) => E.recordResult(s, g)); }
  }, [g]);

  // Sound from diffs.
  const prev = useRef(g);
  useEffect(() => {
    const p = prev.current;
    prev.current = g;
    if (p.tick === g.tick || g.tick === 0) return;
    if (g.status === "won") play("win");
    else if (g.moves > p.moves && g.undo.length < p.undo.length) play("undo");
    else if (g.passes > p.passes) play("shuffle");
    else play("card");
  }, [g]);

  const fresh = useCallback((draw: E.Draw) => {
    recorded.current = false;
    // A fresh deal has 0 moves, so the save effect neither writes nor clears —
    // drop the old save here or an abandoned (already-scored) deal is offered back.
    clearStore(SAVE_KEY);
    setG(E.deal(draw));
    setSel(null);
    setAutoRunning(false);
  }, []);

  const newDeal = useCallback(async (draw: E.Draw = g.draw) => {
    if (g.status === "playing" && g.moves > 0) {
      const ok = await confirmDialog({ title: "Deal again?", message: `${g.moves} moves and ${mmss(g.seconds)} are abandoned. It counts as a loss.`, confirmLabel: "New deal" });
      if (!ok) return;
      setStats((s) => E.recordResult(s, g, true));
    }
    fresh(draw);
  }, [g, fresh]);

  const setDraw = (d: E.Draw) => { if (d !== g.draw) { setPrefs({ draw: d }); void newDeal(d); } };

  // ── Interaction ──
  const attempt = useCallback((from: E.From, to: E.To) => {
    setG((cur) => E.move(cur, from, to));
    setSel(null);
  }, []);

  const tapCard = useCallback((from: E.From) => {
    const cur = gRef.current;
    if (!E.liftable(cur, from)) {
      // A face-down top card left by an undo: flip it.
      if (from.pile === "tableau") setG((c) => E.flipTop(c, from.index));
      setSel(null);
      return;
    }
    if (sel && !sameFrom(sel, from)) {
      const to: E.To | null = from.pile === "tableau" ? { pile: "tableau", index: from.index } : from.pile === "foundation" ? { pile: "foundation", index: from.index } : null;
      if (to && E.canMove(cur, sel, to)) { attempt(sel, to); return; }
    }
    setSel(sameFrom(sel, from) ? null : from);
  }, [sel, attempt]);

  const tapTarget = useCallback((to: E.To) => {
    if (sel) attempt(sel, to);
  }, [sel, attempt]);

  // ── Sizing ──
  const board = useRef<HTMLDivElement>(null);
  const [boardW, setBoardW] = useState(0);
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoardW(el.clientWidth));
    ro.observe(el);
    setBoardW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const gap = 4;
  const cardW = Math.max(34, Math.floor((boardW - 6 * gap) / 7));
  const cardH = Math.min(100, Math.round(cardW * 1.45));
  const downOff = Math.round(cardH * 0.14);
  const upOff = Math.round(cardH * 0.28);

  const ghost = useRef<HTMLDivElement>(null);
  const moveGhost = useCallback((x: number, y: number) => {
    const b = board.current?.getBoundingClientRect();
    const el = ghost.current;
    if (!b || !el) return;
    el.style.transform = `translate(${x - b.left - cardW / 2}px, ${y - b.top - 16}px)`;
  }, [cardW]);

  // Pointer: press → maybe drag → release. A short press with no movement is a
  // tap; two taps on the same card inside DOUBLE_TAP_MS send it up.
  const press = useRef<{ from: E.From; x: number; y: number; dragging: boolean; el: HTMLElement } | null>(null);
  const lastTap = useRef<{ key: string; at: number } | null>(null);
  const dragCards = useMemo(() => (dragFrom ? E.liftable(g, dragFrom) ?? [] : []), [dragFrom, g]);


  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>, from: E.From) => {
    if (e.button !== 0 || gRef.current.status !== "playing" || autoRunning) return;
    press.current = { from, x: e.clientX, y: e.clientY, dragging: false, el: e.currentTarget };
  }, [autoRunning]);
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p) return;
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD) return;
      if (!E.liftable(gRef.current, p.from)) { press.current = null; return; }
      p.dragging = true;
      try { p.el.setPointerCapture(e.pointerId); } catch {}
      setDragFrom(p.from);
      setSel(null);
    }
    moveGhost(e.clientX, e.clientY);
  }, [moveGhost]);
  const endPress = useCallback((e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (p.dragging) {
      try { p.el.releasePointerCapture(e.pointerId); } catch {}
      setDragFrom(null);
      if (cancelled) return;
      const to = parseDrop(document.elementFromPoint(e.clientX, e.clientY));
      if (to) attempt(p.from, to);
      return;
    }
    if (cancelled) return;
    const key = fromKey(p.from), now = Date.now();
    if (lastTap.current && lastTap.current.key === key && now - lastTap.current.at < DOUBLE_TAP_MS) {
      lastTap.current = null;
      setG((cur) => E.toFoundation(cur, p.from));
      setSel(null);
      return;
    }
    lastTap.current = { key, at: now };
    tapCard(p.from);
  }, [attempt, tapCard]);
  // Place the ghost on the frame it appears, before paint.
  useLayoutEffect(() => { if (dragFrom && press.current) moveGhost(press.current.x, press.current.y); }, [dragFrom, moveGhost]);

  const drawOne = useCallback(() => { setG(E.drawStock); setSel(null); }, []);
  const doUndo = useCallback(() => { setG(E.undo); setSel(null); }, []);

  // Auto-complete: one card per beat until the engine says it is done.
  const canAuto = E.canAutoComplete(g);
  useEffect(() => {
    if (!autoRunning || !E.canAutoComplete(g)) return;
    const t = setTimeout(() => setG((cur) => E.autoCompleteStep(cur)), scaleDelay(AUTO_STEP_MS, settings));
    return () => clearTimeout(t);
  }, [autoRunning, g, settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || resumable) return;
      if (ignoreGameKey(e)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); doUndo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case " ": case "d": case "D": e.preventDefault(); drawOne(); break;
        case "u": case "U": case "z": case "Z": e.preventDefault(); doUndo(); break;
        case "a": case "A": if (canAuto) { e.preventDefault(); setAutoRunning(true); } break;
        case "n": case "N": e.preventDefault(); void newDeal(); break;
        case "Escape": setSel(null); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, resumable, drawOne, doUndo, canAuto, newDeal]);

  const resetStats = async () => {
    const ok = await confirmDialog({ title: "Reset the record?", message: `${stats.games} deals and every best are erased.`, confirmLabel: "Reset" });
    if (ok) setStats({ ...E.EMPTY_STATS });
  };

  const quip = useMemo(() => (g.status === "won" ? pick(QUIPS, stats.wins) : null), [g.status, stats.wins]);
  const won = g.status === "won";
  const hidden = (from: E.From) => sameFrom(dragFrom, from) || (dragFrom?.pile === "tableau" && from.pile === "tableau" && dragFrom.index === from.index && from.card >= dragFrom.card);
  const modeRows = (k: "draw1" | "draw3") => {
    const m = stats[k];
    return [
      { label: `${k === "draw1" ? "Draw 1" : "Draw 3"} deals`, value: m.games },
      { label: "Wins", value: m.games ? `${m.wins} (${Math.round((m.wins / m.games) * 100)}%)` : 0 },
      { label: "Best time", value: m.bestTime ? mmss(m.bestTime) : "—" },
      { label: "Fewest moves", value: m.fewestMoves || "—" },
    ];
  };

  const cardEl = (c: Card, from: E.From, selected: boolean, extra?: React.CSSProperties) => (
    <div
      role="button"
      tabIndex={-1}
      aria-label={c.faceUp ? `${c.value}${c.suit}` : "face-down card"}
      onPointerDown={(e) => onPointerDown(e, from)}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPress(e, false)}
      onPointerCancel={(e) => endPress(e, true)}
      className={`absolute left-0 w-full cursor-pointer touch-none select-none ${hidden(from) ? "opacity-0" : ""}`}
      style={{ height: cardH, ...extra }}
    >
      <CardView card={c} selected={selected} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto select-none">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 font-mono text-sm text-[#111010] dark:text-[#e8ddd0] min-w-0">
          <span className="inline-flex items-center gap-1.5 tabular-nums" aria-label={`Time ${mmss(g.seconds)}`}>
            <Timer size={14} strokeWidth={2} className="text-[#6f6455]" /><b>{mmss(g.seconds)}</b>
          </span>
          <span className="text-xs text-[#6f6455] tabular-nums"><b className="text-[#111010] dark:text-[#e8ddd0]">{g.moves}</b> moves</span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-[#756a5a]">Draw {g.draw}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderButton onClick={doUndo} label="Undo" icon={<Undo2 size={16} strokeWidth={1.75} />} showLabel={false} />
          <HeaderButton onClick={() => setSheet("rules")} label="Rules" icon={<BookOpen size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("stats")} label="Record" icon={<BarChart3 size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("settings")} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} />
        </div>
      </div>

      {/* Table */}
      <div className={`${FELT} p-2 sm:p-4`}>
        <FeltVignette />
        <div ref={board} className="relative">
          {/* Top row */}
          <div className="grid grid-cols-7 mb-3" style={{ gap, height: cardH }}>
            <button
              onClick={drawOne}
              aria-label={g.stock.length ? `Draw from stock, ${g.stock.length} left` : "Turn the waste over"}
              className="no-tap relative w-full h-full"
            >
              {g.stock.length ? (
                <>
                  <CardView card={{ suit: "♠", value: "A", faceUp: false }} />
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-black/70 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">{g.stock.length}</span>
                </>
              ) : (
                <Slot label="↺" />
              )}
            </button>
            <div className="relative w-full h-full">
              {g.waste.length ? (
                g.waste.slice(-(g.draw === 3 ? 3 : 1)).map((c, i, arr) => {
                  const top = i === arr.length - 1;
                  const from: E.From = { pile: "waste" };
                  return top
                    ? <div key={c.value + c.suit}>{cardEl(c, from, sameFrom(sel, from), { left: i * Math.round(cardW * 0.22) })}</div>
                    : <div key={c.value + c.suit} className="absolute top-0 w-full pointer-events-none" style={{ left: i * Math.round(cardW * 0.22), height: cardH }}><CardView card={c} /></div>;
                })
              ) : <Slot dashed={false} />}
            </div>
            <div />
            {g.foundation.map((f, fi) => {
              const from: E.From = { pile: "foundation", index: fi };
              return (
                <div key={fi} data-drop={`foundation-${fi}`} className="relative w-full h-full" onClick={() => { if (!f.length) tapTarget({ pile: "foundation", index: fi }); }}>
                  {f.length ? cardEl(f[f.length - 1], from, sameFrom(sel, from)) : <Slot label={SUITS[fi]} />}
                </div>
              );
            })}
          </div>

          {/* Tableau */}
          <div className="grid grid-cols-7" style={{ gap }}>
            {g.tableau.map((col, ci) => {
              let h = cardH;
              col.slice(0, -1).forEach((c) => { h += c.faceUp ? upOff : downOff; });
              return (
                <div
                  key={ci}
                  data-drop={`tableau-${ci}`}
                  className="relative"
                  style={{ height: Math.max(h, cardH * 2.2) }}
                  onClick={(e) => { if (e.target === e.currentTarget) tapTarget({ pile: "tableau", index: ci }); }}
                >
                  {col.length === 0 && <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: cardH }}><Slot /></div>}
                  {col.map((c, ri) => {
                    let top = 0;
                    for (let k = 0; k < ri; k++) top += col[k].faceUp ? upOff : downOff;
                    const from: E.From = { pile: "tableau", index: ci, card: ri };
                    const selected = sel?.pile === "tableau" && sel.index === ci && ri >= sel.card;
                    return <div key={`${c.value}${c.suit}`} className="absolute inset-x-0" style={{ top, zIndex: ri, height: cardH }}>{cardEl(c, from, selected)}</div>;
                  })}
                </div>
              );
            })}
          </div>

          {/* Drag ghost */}
          {dragFrom && dragCards.length > 0 && (
            <div ref={ghost} className="absolute left-0 top-0 pointer-events-none z-50 will-change-transform" style={{ width: cardW }} aria-hidden>
              {dragCards.map((c, i) => (
                <div key={`${c.value}${c.suit}`} className="absolute inset-x-0" style={{ top: i * upOff, height: cardH }}><CardView card={c} selected /></div>
              ))}
            </div>
          )}

          {/* Overlays */}
          {resumable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-4 rounded-2xl z-[60]">
              <div className="bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-4 max-w-xs w-full text-center shadow-xl animate-spotlight-in text-[#111010] dark:text-[#e8ddd0]">
                <Sparkles size={20} strokeWidth={1.75} className="mx-auto mb-2 text-(--accent-text)" />
                <p className="text-sm font-bold">A deal is waiting</p>
                <p className="text-xs text-[#6f6455] mt-1">Draw {resumable.draw} · {resumable.moves} moves · {mmss(resumable.seconds)}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { recorded.current = false; setG(resumable); setPrefs({ draw: resumable.draw }); setResumable(null); }} className="flex-1 py-2 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest">Resume</button>
                  <button onClick={() => { clearStore(SAVE_KEY); setResumable(null); }} className="flex-1 py-2 rounded-xl border border-[#e8e2d8] dark:border-[#3a3530] text-xs font-bold uppercase tracking-widest text-[#6f6455]">Discard</button>
                </div>
              </div>
            </div>
          )}
          {won && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-4 rounded-2xl z-[60]">
              <div className="bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-5 max-w-xs w-full text-center shadow-xl animate-spotlight-in text-[#111010] dark:text-[#e8ddd0]">
                <p className="font-serif italic text-2xl text-[#15803d]">Cleared</p>
                <p className="font-mono text-xs text-[#6f6455] mt-1 tabular-nums">{mmss(g.seconds)} · {g.moves} moves · draw {g.draw}</p>
                {quip && <p className="text-xs text-[#6f6455] mt-2 italic">&ldquo;{quip}&rdquo;</p>}
                <button onClick={() => fresh(g.draw)} className="mt-4 w-full py-2.5 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest inline-flex items-center justify-center gap-2"><RotateCcw size={14} strokeWidth={2} />Deal again</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {canAuto && !autoRunning ? (
          <button onClick={() => setAutoRunning(true)} className="flex-1 py-3 rounded-2xl bg-[#15803d] text-white font-bold text-sm uppercase tracking-widest inline-flex items-center justify-center gap-2 animate-spotlight-in">
            <ChevronsUp size={16} strokeWidth={2} />Auto-complete
          </button>
        ) : (
          <button onClick={() => void newDeal()} className="flex-1 py-3 rounded-2xl bg-(--accent) text-(--accent-on) font-bold text-sm uppercase tracking-widest hover:bg-(--accent-dim) transition-colors inline-flex items-center justify-center gap-2">
            <Layers size={16} strokeWidth={2} />New deal
          </button>
        )}
      </div>
      <p className="text-center text-[10px] text-[#756a5a] font-mono mt-3">
        <span className="sm:hidden">Tap or drag · double-tap sends a card up</span>
        <span className="hidden sm:inline">Click or drag · double-click sends a card up · <Kbd>Space</Kbd> draw · <Kbd>Z</Kbd> undo · <Kbd>A</Kbd> auto</span>
      </p>

      <GameSheet open={sheet === "rules"} onClose={() => setSheet(null)} title="Klondike">
        <ul className="text-sm text-[#111010] dark:text-[#e8ddd0] space-y-2 list-disc pl-5">
          <li>Build the four foundations from ace to king, one suit each.</li>
          <li>On the tableau, stack downward in alternating colours. Only a king starts an empty column.</li>
          <li>Draw {g.draw} from the stock at a time; turn the waste over as often as you like.</li>
          <li>Undo is unlimited and counts as a move. Auto-complete appears once every card is face up and the stock is spent.</li>
          <li>Deals are random and not checked for solvability — some cannot be won. That is Klondike.</li>
        </ul>
      </GameSheet>
      <GameSheet open={sheet === "stats"} onClose={() => setSheet(null)} title="Record">
        <StatRows rows={[
          { label: "Deals", value: stats.games },
          { label: "Wins", value: stats.games ? `${stats.wins} (${Math.round((stats.wins / stats.games) * 100)}%)` : 0 },
          { label: "Best time", value: stats.bestTime ? mmss(stats.bestTime) : "—" },
          { label: "Current streak", value: stats.streak },
          { label: "Best streak", value: stats.bestStreak },
        ]} />
        <SectionLabel>By mode</SectionLabel>
        <StatRows rows={[...modeRows("draw1"), ...modeRows("draw3")]} />
        <button onClick={resetStats} className="mt-4 text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:text-(--accent-text) transition-colors">Reset record</button>
      </GameSheet>
      <GameSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Settings">
        <GameSettingsBody>
          <div className="pt-1">
            <SectionLabel>Klondike</SectionLabel>
            <Segmented<E.Draw>
              label="Draw"
              value={g.draw}
              onChange={setDraw}
              options={[{ value: 1, label: "Draw 1", hint: "easier" }, { value: 3, label: "Draw 3", hint: "classic" }]}
            />
            <p className="text-[11px] text-[#6f6455] -mt-1 pb-2">Changing it deals a new game. Records are kept per mode.</p>
          </div>
        </GameSettingsBody>
      </GameSheet>
    </div>
  );
}
