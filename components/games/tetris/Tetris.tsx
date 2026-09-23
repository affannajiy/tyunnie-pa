// components/games/tetris/Tetris.tsx
// Presentation + timing over engine.ts. The engine is discrete; this file
// runs the clock: gravity by level, a 500ms lock delay with the 15-reset cap,
// engine-paced DAS/ARR for held keys and soft drop, and the Sprint stopwatch.
// A single `apply()` funnel keeps the ref as the source of truth so the rAF
// loop and key handlers never race a stale React state.
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { BarChart3, Settings2, Pause, Play, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronsDown, RotateCw, Archive } from "lucide-react";
import * as E from "./engine";
import { GameSheet, GameSettingsBody, StatRows, SectionLabel, HeaderButton, Segmented, ignoreGameKey } from "../ui";
import { readStore, writeStore, useGameSettings } from "@/lib/gameStore";
import { play, setAudioEnabled } from "@/lib/gameAudio";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { Kbd } from "@/components/ui/Kbd";

const PREFS_KEY = "tetris";
const STATS_KEY = "tetris_stats";
type Prefs = { mode: string };
const PREFS_DEFAULT: Prefs = { mode: "marathon" };
const asMode = (v: string): E.Mode => (v === "sprint" ? "sprint" : "marathon");

const COLORS: Record<E.Type, string> = { I: "#06b6d4", O: "#eab308", T: "#a855f7", S: "#22c55e", Z: "#ef4444", J: "#3b82f6", L: "#f97316" };

const QUIPS = {
  over: ["The stack always wins eventually. Again?", "That was a respectable pile 🧡", "Blame the I-piece. Everyone does."],
  done: ["Forty lines. Clean. 🧡", "Sprint done. Hands shaking yet?", "That's a time I'd brag about."],
};
const pick = (a: string[], seed: number) => a[seed % a.length];
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;

function Mini({ type, cell = 14 }: { type: E.Type | null; cell?: number }) {
  const box = type === "I" ? 4 : 3;
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${box}, ${cell}px)`, gridTemplateRows: `repeat(${type === "I" ? 2 : 2}, ${cell}px)`, gap: 1 }} aria-label={type ?? "empty"}>
      {Array.from({ length: box * 2 }, (_, i) => {
        const x = i % box, y = Math.floor(i / box);
        const on = type ? E.SHAPES[type][0].some(([dx, dy]) => dx === x && dy === y + (type === "I" ? 1 : 0)) : false;
        return <div key={i} style={{ width: cell, height: cell, borderRadius: 2, backgroundColor: on && type ? COLORS[type] : "transparent" }} />;
      })}
    </div>
  );
}

function PadBtn({ label, onDown, onUp, children }: { label: string; onDown: () => void; onUp?: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className="no-tap h-14 rounded-2xl bg-white dark:bg-[#26221e] border border-[#e8e2d8] dark:border-[#3a3530] text-[#111010] dark:text-[#e8ddd0] flex items-center justify-center active:bg-[#f0ece8] dark:active:bg-[#3a3530] touch-none select-none"
    >
      {children}
    </button>
  );
}

export default function Tetris() {
  const [settings] = useGameSettings();
  useEffect(() => setAudioEnabled(settings.sound), [settings.sound]);

  const [prefs, setPrefs] = useState<Prefs>(() => readStore(PREFS_KEY, PREFS_DEFAULT));
  const [stats, setStats] = useState<E.Stats>(() => ({ ...E.EMPTY_STATS, ...readStore(STATS_KEY, E.EMPTY_STATS) }));
  const [g, setG] = useState<E.Game>(() => E.newGame(asMode(readStore(PREFS_KEY, PREFS_DEFAULT).mode)));
  const [sheet, setSheet] = useState<"stats" | "settings" | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => writeStore(PREFS_KEY, prefs), [prefs]);
  useEffect(() => writeStore(STATS_KEY, stats), [stats]);

  // ── Single funnel: the ref is truth, state mirrors it for rendering ──
  const gRef = useRef(g);
  const apply = useCallback((fn: (cur: E.Game) => E.Game) => {
    const next = fn(gRef.current);
    if (next === gRef.current) return;
    gRef.current = next;
    setG(next);
  }, []);

  // Timing accumulators (ms).
  const clock = useRef({ last: 0, grav: 0, lock: 0, soft: 0, das: 0, arr: 0, dasArmed: false, elapsed: 0, lastTick: -1 });
  const keys = useRef({ left: false, right: false, down: false, dir: 0 as -1 | 0 | 1 });
  const raf = useRef<number | null>(null);

  // Run the loop only while playing; pausing simply stops it (and the clock).
  useEffect(() => {
    if (g.status !== "playing") return;
    const loop = (now: number) => {
    const c = clock.current;
    const dt = c.last ? Math.min(100, now - c.last) : 0;
    c.last = now;
    let cur = gRef.current;
    if (cur.status !== "playing") { raf.current = null; return; }
    c.elapsed += dt;

    // Any transition since the last frame restarts the lock delay, up to the cap.
    if (cur.tick !== c.lastTick) { c.lastTick = cur.tick; if (cur.lockResets < E.MAX_LOCK_RESETS) c.lock = 0; }

    // Held horizontal: DAS then ARR.
    const k = keys.current;
    if (k.dir) {
      c.das += dt;
      if (!c.dasArmed && c.das >= E.DAS_MS) { c.dasArmed = true; c.arr = 0; cur = E.move(cur, k.dir); }
      else if (c.dasArmed) { c.arr += dt; while (c.arr >= E.ARR_MS) { c.arr -= E.ARR_MS; cur = E.move(cur, k.dir); } }
    }
    // Soft drop repeats at its own rate; gravity runs underneath.
    if (k.down) { c.soft += dt; while (c.soft >= E.SOFT_DROP_MS) { c.soft -= E.SOFT_DROP_MS; cur = E.softDrop(cur); } }
    else c.soft = 0;
    c.grav += dt;
    const interval = E.gravityMs(cur.level);
    while (c.grav >= interval) { c.grav -= interval; cur = E.gravity(cur); }

    if (E.isGrounded(cur)) {
      c.lock += dt;
      if (c.lock >= E.LOCK_DELAY_MS || cur.lockResets >= E.MAX_LOCK_RESETS) { c.lock = 0; cur = E.lock(cur); c.grav = 0; }
    } else c.lock = 0;

    if (cur !== gRef.current) { gRef.current = cur; setG(cur); }
    if (Math.floor(c.elapsed / 100) !== Math.floor((c.elapsed - dt) / 100)) setElapsed(c.elapsed);
    raf.current = requestAnimationFrame(loop);
    };
    clock.current.last = 0;
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; };
  }, [g.status]);

  // Record once at the end.
  const recorded = useRef(false);
  useEffect(() => {
    if ((g.status === "over" || g.status === "done") && !recorded.current) {
      recorded.current = true;
      setStats((s) => E.recordResult(s, g, Math.round(clock.current.elapsed)));
      setElapsed(clock.current.elapsed);
    }
  }, [g]);

  // Sound from diffs.
  const prev = useRef(g);
  useEffect(() => {
    const p = prev.current;
    prev.current = g;
    if (p === g) return;
    if (g.status === "over") play("lose");
    else if (g.status === "done") play("win");
    else if (g.lastClear && g.pieces !== p.pieces && g.lastClear !== p.lastClear) play(g.lastClear.lines === 4 || g.lastClear.tspin !== "none" ? "win" : "clear");
    else if (g.pieces !== p.pieces) play("lock");
  }, [g]);

  const fresh = useCallback((mode: E.Mode) => {
    recorded.current = false;
    clock.current = { last: 0, grav: 0, lock: 0, soft: 0, das: 0, arr: 0, dasArmed: false, elapsed: 0, lastTick: -1 };
    keys.current = { left: false, right: false, down: false, dir: 0 };
    setElapsed(0);
    const next = E.start(E.newGame(mode));
    gRef.current = next;
    setG(next);
  }, []);

  const restart = useCallback(async () => {
    const cur = gRef.current;
    if (cur.status === "playing" || cur.status === "paused") {
      apply(E.pause);
      const ok = await confirmDialog({ title: "Restart?", message: `${cur.score.toLocaleString()} points and ${cur.lines} lines are thrown away.`, confirmLabel: "Restart" });
      if (!ok) { apply(E.resume); return; }
    }
    fresh(cur.mode);
  }, [apply, fresh]);

  const setMode = async (m: E.Mode) => {
    const cur = gRef.current;
    if (m === cur.mode) return;
    if (cur.status === "playing" || cur.status === "paused") {
      apply(E.pause);
      const ok = await confirmDialog({ title: "Switch mode?", message: "The current game is abandoned.", confirmLabel: "Switch" });
      if (!ok) { apply(E.resume); return; }
    }
    setPrefs({ mode: m });
    recorded.current = false;
    const next = E.newGame(m);
    gRef.current = next;
    setG(next);
    setElapsed(0);
  };

  // ── Input ──
  const press = useCallback((dir: -1 | 1) => {
    const k = keys.current, c = clock.current;
    if (dir < 0) k.left = true; else k.right = true;
    k.dir = dir;
    c.das = 0; c.dasArmed = false;
    apply((cur) => E.move(cur, dir));
  }, [apply]);
  const release = useCallback((dir: -1 | 1) => {
    const k = keys.current, c = clock.current;
    if (dir < 0) k.left = false; else k.right = false;
    const other = dir < 0 ? (k.right ? 1 : 0) : (k.left ? -1 : 0);
    k.dir = other as -1 | 0 | 1;
    if (other) { c.das = 0; c.dasArmed = false; }
  }, []);
  const softStart = useCallback(() => { keys.current.down = true; clock.current.soft = 0; apply(E.softDrop); }, [apply]);
  const softEnd = useCallback(() => { keys.current.down = false; }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (sheet) return;
      if (ignoreGameKey(e, { buttons: false })) return;
      const cur = gRef.current;
      if (e.key === "Enter" && cur.status === "ready") { e.preventDefault(); fresh(cur.mode); return; }
      if ((e.key === "r" || e.key === "R") && !e.repeat) { e.preventDefault(); void restart(); return; }
      if ((e.key === "p" || e.key === "P" || e.key === "Escape") && !e.repeat) { e.preventDefault(); apply((c) => (c.status === "playing" ? E.pause(c) : E.resume(c))); return; }
      if (cur.status !== "playing") return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); if (!e.repeat) press(-1); break;
        case "ArrowRight": e.preventDefault(); if (!e.repeat) press(1); break;
        case "ArrowDown": e.preventDefault(); if (!e.repeat) softStart(); break;
        case "ArrowUp": case "x": case "X": e.preventDefault(); if (!e.repeat) apply((c) => E.rotate(c, 1)); break;
        case "z": case "Z": case "Control": e.preventDefault(); if (!e.repeat) apply((c) => E.rotate(c, -1)); break;
        case " ": e.preventDefault(); if (!e.repeat) apply((c) => E.hardDrop(c)); break;
        case "c": case "C": case "Shift": e.preventDefault(); if (!e.repeat) apply((c) => E.hold(c)); break;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") release(-1);
      else if (e.key === "ArrowRight") release(1);
      else if (e.key === "ArrowDown") softEnd();
    };
    const onBlur = () => { keys.current = { left: false, right: false, down: false, dir: 0 }; apply(E.pause); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("blur", onBlur); };
  }, [sheet, apply, fresh, restart, press, release, softStart, softEnd]);

  // Swipe on the board: left/right one cell, down = hard drop, up = rotate, tap = rotate.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onBoardDown = (e: React.PointerEvent) => { if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY }; };
  const onBoardUp = (e: React.PointerEvent) => {
    const s = swipe.current; swipe.current = null;
    if (!s || gRef.current.status !== "playing") return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { apply((c) => E.rotate(c, 1)); return; }
    if (Math.abs(dx) > Math.abs(dy)) apply((c) => E.move(c, dx > 0 ? 1 : -1));
    else if (dy > 30) apply((c) => E.hardDrop(c));
    else if (dy < -30) apply((c) => E.rotate(c, 1));
  };

  // ── Sizing ──
  const wrap = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);
  const [wide, setWide] = useState(false); // sm: side columns grow from w-14 to w-20
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => { setWrapW(el.clientWidth); setWide(window.matchMedia("(min-width: 640px)").matches); };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  // Floor 12, not 18: at 320px the two side columns leave ~160px for the well.
  const cell = Math.max(12, Math.min(30, Math.floor((wrapW - 4) / E.COLS)));
  const mini = wide ? (cell > 24 ? 14 : 11) : 9; // 9px I-piece fits the 56px column

  const field = useMemo(() => E.render(g), [g]);
  const quip = useMemo(() => (g.status === "over" || g.status === "done" ? pick(QUIPS[g.status], stats.games) : null), [g.status, stats.games]);
  const resetStats = async () => {
    const ok = await confirmDialog({ title: "Reset the record?", message: "Best score, best sprint and every count are erased.", confirmLabel: "Reset" });
    if (ok) setStats({ ...E.EMPTY_STATS });
  };

  return (
    <div className="max-w-xl mx-auto select-none">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="font-mono text-xs text-[#6f6455] min-w-0 truncate">
          {g.mode === "sprint" ? (
            <><span className="uppercase tracking-widest text-[10px]">Sprint</span> <span className="font-bold text-[#111010] dark:text-[#e8ddd0] text-sm tabular-nums">{fmt(elapsed)}</span><span className="mx-2 text-[#e8e2d8] dark:text-[#3a3530]">·</span>{Math.max(0, E.SPRINT_LINES - g.lines)} to go</>
          ) : (
            <><span className="uppercase tracking-widest text-[10px]">Score</span> <span className="font-bold text-[#111010] dark:text-[#e8ddd0] text-sm tabular-nums">{g.score.toLocaleString()}</span><span className="mx-2 text-[#e8e2d8] dark:text-[#3a3530]">·</span>L{g.level} · {g.lines} lines</>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(g.status === "playing" || g.status === "paused") && (
            <HeaderButton onClick={() => apply((c) => (c.status === "playing" ? E.pause(c) : E.resume(c)))} label={g.status === "paused" ? "Resume" : "Pause"} icon={g.status === "paused" ? <Play size={16} strokeWidth={1.75} /> : <Pause size={16} strokeWidth={1.75} />} showLabel={false} />
          )}
          <HeaderButton onClick={() => void restart()} label="Restart" icon={<RotateCcw size={16} strokeWidth={1.75} />} showLabel={false} />
          <HeaderButton onClick={() => { apply(E.pause); setSheet("stats"); }} label="Record" icon={<BarChart3 size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => { apply(E.pause); setSheet("settings"); }} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} />
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3 items-start justify-center">
        {/* Hold */}
        <div className="w-14 sm:w-20 shrink-0 flex flex-col gap-3">
          <div className="bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-1.5 sm:p-2 flex flex-col items-center gap-1.5">
            <p className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest text-[#6f6455]">Hold</p>
            <div className={g.canHold ? "" : "opacity-40"}><Mini type={g.hold} cell={mini} /></div>
          </div>
          <div className="hidden sm:block bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-2 font-mono text-[10px] text-[#6f6455] space-y-1">
            <div><span className="uppercase tracking-widest text-[9px]">Combo</span><br /><b className="text-[#111010] dark:text-[#e8ddd0]">{g.combo > 0 ? g.combo : "—"}</b></div>
            <div><span className="uppercase tracking-widest text-[9px]">B2B</span><br /><b className="text-[#111010] dark:text-[#e8ddd0]">{g.b2b ? "on" : "—"}</b></div>
          </div>
        </div>

        {/* Board */}
        <div ref={wrap} className="flex-1 min-w-0 max-w-[320px]">
          <div
            className="on-dark relative mx-auto rounded-xl overflow-hidden bg-[#141210] border-2 border-[#2a2520] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] touch-none"
            style={{ width: E.COLS * cell + 4, height: E.ROWS * cell + 4 }}
            onPointerDown={onBoardDown}
            onPointerUp={onBoardUp}
            role="img"
            aria-label={`Tetris field, ${g.lines} lines cleared`}
          >
            <div className="absolute inset-0.5 grid" style={{ gridTemplateColumns: `repeat(${E.COLS}, ${cell}px)`, gridTemplateRows: `repeat(${E.ROWS}, ${cell}px)` }}>
              {field.map((row, y) => row.map((c, x) => {
                if (!c) return <div key={`${y}-${x}`} className="border-r border-b border-white/[0.04]" />;
                if (c === "ghost") {
                  const color = g.cur ? COLORS[g.cur.type] : "#fff";
                  return <div key={`${y}-${x}`} style={{ borderRadius: 3, border: `2px solid ${color}`, opacity: 0.35, margin: 1 }} />;
                }
                return <div key={`${y}-${x}`} style={{ borderRadius: 3, backgroundColor: COLORS[c], margin: 1, boxShadow: "inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.25)" }} />;
              }))}
            </div>

            {g.lastClear && g.status === "playing" && (
              <div key={g.pieces} className="absolute inset-x-0 top-1/3 text-center pointer-events-none animate-toast-up">
                <div className="inline-block bg-black/70 text-white rounded-xl px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest">
                  {E.clearLabel(g.lastClear)}<br /><span className="text-(--accent-text) text-sm">+{g.lastClear.points.toLocaleString()}</span>
                </div>
              </div>
            )}

            {g.status === "ready" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center p-4">
                <p className="font-serif italic text-2xl text-white mb-1">{g.mode === "sprint" ? "40 lines" : "Marathon"}</p>
                <p className="text-[11px] text-white/60 font-mono mb-5">{g.mode === "sprint" ? "Clear forty as fast as you can." : "Level up every ten lines. Survive."}</p>
                <button onClick={() => fresh(g.mode)} className="px-8 py-3 rounded-2xl bg-(--accent) text-(--accent-on) font-bold text-sm uppercase tracking-widest">Start</button>
              </div>
            )}
            {g.status === "paused" && !sheet && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center p-4">
                <p className="font-serif italic text-2xl text-white mb-4">Paused</p>
                <button onClick={() => apply(E.resume)} className="px-8 py-3 rounded-2xl bg-(--accent) text-(--accent-on) font-bold text-sm uppercase tracking-widest inline-flex items-center gap-2"><Play size={16} strokeWidth={2} />Resume</button>
              </div>
            )}
            {(g.status === "over" || g.status === "done") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-center p-4 animate-fade-in">
                <p className={`font-serif italic text-2xl mb-1 ${g.status === "done" ? "text-[#4ade80]" : "text-white"}`}>{g.status === "done" ? "Done" : "Topped out"}</p>
                <p className="text-[11px] text-white/70 font-mono tabular-nums">
                  {g.mode === "sprint" ? `${fmt(elapsed)} · ${g.pieces} pieces` : `${g.score.toLocaleString()} · L${g.level} · ${g.lines} lines`}
                </p>
                {g.mode === "marathon" && g.score > 0 && g.score >= stats.bestScore && <p className="text-[10px] font-mono uppercase tracking-widest text-(--accent-text) mt-1">New best</p>}
                {g.mode === "sprint" && g.status === "done" && Math.round(elapsed) <= stats.sprintBest && <p className="text-[10px] font-mono uppercase tracking-widest text-(--accent-text) mt-1">New best</p>}
                {quip && <p className="text-xs text-white/60 mt-2 italic">&ldquo;{quip}&rdquo;</p>}
                <button onClick={() => fresh(g.mode)} className="mt-5 px-8 py-3 rounded-2xl bg-(--accent) text-(--accent-on) font-bold text-sm uppercase tracking-widest inline-flex items-center gap-2"><RotateCcw size={16} strokeWidth={2} />Again</button>
              </div>
            )}
          </div>
        </div>

        {/* Next */}
        <div className="w-14 sm:w-20 shrink-0 flex flex-col gap-3">
          <div className="bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-1.5 sm:p-2 flex flex-col items-center gap-2">
            <p className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest text-[#6f6455]">Next</p>
            {g.queue.slice(0, E.PREVIEW).map((t, i) => <div key={i} className={i ? "opacity-70" : ""}><Mini type={t} cell={mini} /></div>)}
          </div>
          <div className="hidden sm:block bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-2 font-mono text-[9px] text-[#6f6455] space-y-1">
            {[["←→", "move"], ["↑ X", "cw"], ["Z", "ccw"], ["↓", "soft"], ["␣", "hard"], ["C", "hold"], ["P", "pause"]].map(([k, l]) => (
              <div key={k} className="flex justify-between gap-1"><span className="bg-[#f0ece8] dark:bg-[#3a3530] rounded px-1 text-[#111010] dark:text-[#e8ddd0]">{k}</span><span>{l}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Touch pad */}
      <div className="hidden pointer-coarse:grid grid-cols-5 gap-2 mt-4 max-w-sm mx-auto">
        <PadBtn label="Move left" onDown={() => press(-1)} onUp={() => release(-1)}><ChevronLeft size={22} strokeWidth={2} /></PadBtn>
        <PadBtn label="Rotate" onDown={() => apply((c) => E.rotate(c, 1))}><RotateCw size={20} strokeWidth={2} /></PadBtn>
        <PadBtn label="Move right" onDown={() => press(1)} onUp={() => release(1)}><ChevronRight size={22} strokeWidth={2} /></PadBtn>
        <PadBtn label="Soft drop" onDown={softStart} onUp={softEnd}><ChevronDown size={22} strokeWidth={2} /></PadBtn>
        <PadBtn label="Hard drop" onDown={() => apply((c) => E.hardDrop(c))}><ChevronsDown size={22} strokeWidth={2} /></PadBtn>
        <button onPointerDown={(e) => { e.preventDefault(); apply((c) => E.hold(c)); }} aria-label="Hold" className="no-tap col-span-5 h-11 rounded-2xl border border-[#e8e2d8] dark:border-[#3a3530] text-[#6f6455] font-mono text-[10px] font-bold uppercase tracking-widest inline-flex items-center justify-center gap-2 touch-none select-none"><Archive size={14} strokeWidth={2} />Hold</button>
      </div>
      <p className="hidden sm:block text-center text-[10px] text-[#756a5a] font-mono mt-3">
        <Kbd>Enter</Kbd> start · <Kbd>P</Kbd> pause · <Kbd>R</Kbd> restart
      </p>

      <GameSheet open={sheet === "stats"} onClose={() => setSheet(null)} title="Record">
        <SectionLabel>Marathon</SectionLabel>
        <StatRows rows={[
          { label: "Best score", value: stats.bestScore.toLocaleString() },
          { label: "Best level", value: stats.bestLevel || "—" },
          { label: "Most lines", value: stats.bestLines },
        ]} />
        <SectionLabel>Sprint · 40 lines</SectionLabel>
        <StatRows rows={[
          { label: "Best time", value: stats.sprintBest ? fmt(stats.sprintBest) : "—" },
          { label: "Finished", value: stats.sprintFinished },
        ]} />
        <SectionLabel>All time</SectionLabel>
        <StatRows rows={[
          { label: "Games", value: stats.games },
          { label: "Lines", value: stats.totalLines },
          { label: "Tetrises", value: stats.tetrises },
          { label: "T-spins", value: stats.tspins },
        ]} />
        <button onClick={resetStats} className="mt-4 text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:text-(--accent-text) transition-colors">Reset record</button>
      </GameSheet>
      <GameSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Settings">
        <GameSettingsBody>
          <div className="pt-1">
            <SectionLabel>Tetris</SectionLabel>
            <Segmented<E.Mode>
              label="Mode"
              value={g.mode}
              onChange={(m) => void setMode(m)}
              options={[{ value: "marathon", label: "Marathon", hint: "level up per 10" }, { value: "sprint", label: "Sprint", hint: "40 lines, timed" }]}
            />
            <p className="text-[11px] text-[#6f6455] -mt-1 pb-2">7-bag, SRS kicks, 500ms lock delay, DAS 170 / ARR 50. Guideline scoring with T-spins, back-to-back and combos.</p>
          </div>
        </GameSettingsBody>
      </GameSheet>
    </div>
  );
}
