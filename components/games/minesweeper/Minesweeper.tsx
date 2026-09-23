// components/games/minesweeper/Minesweeper.tsx
// Presentation over engine.ts: board sizing, the second-hand, keyboard cursor,
// long-press flagging, a resume banner and the record sheet. Rules live in
// the engine; this file never inspects a mine.
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { Flag, Bomb, X, BarChart3, Settings2, RotateCcw, Timer, Sparkles } from "lucide-react";
import * as E from "./engine";
import { GameSheet, GameSettingsBody, StatRows, SectionLabel, HeaderButton, Segmented, ignoreGameKey } from "../ui";
import { readStore, writeStore, clearStore, useGameSettings } from "@/lib/gameStore";
import { play, setAudioEnabled } from "@/lib/gameAudio";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { Kbd } from "@/components/ui/Kbd";

const PREFS_KEY = "minesweeper";
const STATS_KEY = "minesweeper_stats";
const SAVE_KEY = "minesweeper_save";
const LONG_PRESS_MS = 400;

type Prefs = { preset: string; custom: E.Config };
const PREFS_DEFAULT: Prefs = { preset: "beginner", custom: { rows: 12, cols: 12, mines: 25 } };
type Save = { game: E.Game | null };

const asPreset = (v: string): E.Preset =>
  v === "intermediate" || v === "expert" || v === "custom" ? v : v === "medium" ? "intermediate" : v === "hard" ? "expert" : "beginner";

const PRESET_LABEL: Record<E.Preset, string> = { beginner: "Beginner", intermediate: "Intermediate", expert: "Expert", custom: "Custom" };

const QUIPS = {
  won: ["You survived! I'm impressed 🧡", "No explosions. That's my person.", "Flawless minesweeping 🧡", "Okay you're actually really good at this."],
  lost: ["...that was the mine.", "BOOM. Try again 🧡", "I told you to think first.", "That one had mine written all over it."],
};
const pick = (a: string[], seed: number) => a[seed % a.length];
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const NUM_COLORS: Record<number, string> = {
  1: "#2563eb", 2: "#15803d", 3: "#dc2626", 4: "#1e3a8a", 5: "#7f1d1d", 6: "#0f766e", 7: "#111010", 8: "#6f6455",
};

export default function Minesweeper() {
  const [settings] = useGameSettings();
  useEffect(() => setAudioEnabled(settings.sound), [settings.sound]);

  const [prefs, setPrefs] = useState<Prefs>(() => readStore(PREFS_KEY, PREFS_DEFAULT));
  const [stats, setStats] = useState<E.Stats>(() => {
    const s = readStore(STATS_KEY, E.EMPTY_STATS);
    return { ...E.EMPTY_STATS, ...s, beginner: { ...E.EMPTY_STATS.beginner, ...s.beginner }, intermediate: { ...E.EMPTY_STATS.intermediate, ...s.intermediate }, expert: { ...E.EMPTY_STATS.expert, ...s.expert } };
  });
  const [g, setG] = useState<E.Game>(() => E.newGame(asPreset(readStore(PREFS_KEY, PREFS_DEFAULT).preset), readStore(PREFS_KEY, PREFS_DEFAULT).custom));
  // A board left mid-game: offered back once, then either restored or dropped.
  const [resumable, setResumable] = useState<E.Game | null>(() => {
    const s = readStore<Save>(SAVE_KEY, { game: null });
    return s.game && s.game.status === "playing" && Array.isArray(s.game.cells) ? s.game : null;
  });
  const [sheet, setSheet] = useState<"stats" | "settings" | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [customDraft, setCustomDraft] = useState<E.Config>(prefs.custom);

  useEffect(() => writeStore(PREFS_KEY, prefs), [prefs]);
  useEffect(() => writeStore(STATS_KEY, stats), [stats]);

  // Persist the board on every transition while playing; drop it at rest.
  const gRef = useRef(g);
  useEffect(() => { gRef.current = g; }, [g]);
  useEffect(() => {
    const cur = gRef.current;
    if (cur.status === "playing") writeStore<Save>(SAVE_KEY, { game: cur });
    else clearStore(SAVE_KEY);
  }, [g.tick, g.status]);
  useEffect(() => () => { const cur = gRef.current; if (cur.status === "playing") writeStore<Save>(SAVE_KEY, { game: cur }); }, []);

  // Second hand.
  useEffect(() => {
    if (g.status !== "playing") return;
    const t = setInterval(() => setG((cur) => E.tickSecond(cur)), 1000);
    return () => clearInterval(t);
  }, [g.status]);

  // Record a finished game exactly once.
  const recordedTick = useRef(-1);
  useEffect(() => {
    if ((g.status === "won" || g.status === "lost") && recordedTick.current !== g.tick) {
      recordedTick.current = g.tick;
      setStats((s) => E.recordResult(s, g));
    }
  }, [g]);

  const fresh = useCallback((preset: E.Preset, custom: E.Config) => {
    recordedTick.current = -1;
    setG(E.newGame(preset, custom));
    setCursor(null);
  }, []);

  const newGame = useCallback(async () => {
    if (g.status === "playing") {
      const ok = await confirmDialog({ title: "Abandon this board?", message: `${mmss(g.seconds)} on the clock is lost. It counts as nothing.`, confirmLabel: "New board" });
      if (!ok) return;
    }
    fresh(g.preset, prefs.custom);
  }, [g.status, g.seconds, g.preset, prefs.custom, fresh]);

  const choosePreset = useCallback(async (p: E.Preset) => {
    if (p === g.preset) return;
    if (g.status === "playing") {
      const ok = await confirmDialog({ title: "Switch boards?", message: "The current game is abandoned.", confirmLabel: "Switch" });
      if (!ok) return;
    }
    setPrefs((cur) => ({ ...cur, preset: p }));
    fresh(p, prefs.custom);
  }, [g.preset, g.status, prefs.custom, fresh]);

  const applyCustom = () => {
    const c = E.clampConfig(customDraft);
    setCustomDraft(c);
    setPrefs((cur) => ({ ...cur, preset: "custom", custom: c }));
    fresh("custom", c);
  };

  const act = useCallback((i: number, flag: boolean) => {
    setG((cur) => (flag ? E.toggleFlag(cur, i) : E.tap(cur, i)));
  }, []);

  // Sound from state diffs — updaters stay pure.
  const prev = useRef(g);
  useEffect(() => {
    const p = prev.current;
    prev.current = g;
    if (p.tick === g.tick || g.tick === 0) return;
    if (g.status === "lost") play("boom");
    else if (g.status === "won") play("win");
    else if (g.flags !== p.flags) play("place");
    else play("reveal");
  }, [g]);

  // Long-press = flag on touch; right-click = flag with a mouse.
  const press = useRef<{ i: number; timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0) return;
    if (press.current) clearTimeout(press.current.timer);
    const timer = setTimeout(() => { if (press.current?.i === i) { press.current.fired = true; act(i, true); } }, LONG_PRESS_MS);
    press.current = { i, timer, fired: false };
  };
  const onPointerUp = (e: React.PointerEvent, i: number) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.fired || p.i !== i || e.button !== 0) return;
    act(i, flagMode);
  };
  const onPointerCancel = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; };
  useEffect(() => () => { if (press.current) clearTimeout(press.current.timer); }, []);

  // Keyboard: arrows move, Space/Enter open, F flags.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || resumable) return;
      if (ignoreGameKey(e)) return;
      const cols = g.cols, n = g.rows * g.cols;
      const c = cursor ?? 0;
      const move = (d: number) => { e.preventDefault(); setCursor(Math.max(0, Math.min(n - 1, c + d))); };
      switch (e.key) {
        case "ArrowLeft": if (c % cols > 0) move(-1); else e.preventDefault(); break;
        case "ArrowRight": if (c % cols < cols - 1) move(1); else e.preventDefault(); break;
        case "ArrowUp": move(-cols); break;
        case "ArrowDown": move(cols); break;
        case " ": case "Enter": if (cursor !== null) { e.preventDefault(); act(cursor, false); } break;
        case "f": case "F": if (cursor !== null) { e.preventDefault(); act(cursor, true); } break;
        case "n": case "N": if (g.status !== "playing") { e.preventDefault(); fresh(g.preset, prefs.custom); } break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, resumable, cursor, g.cols, g.rows, g.status, g.preset, prefs.custom, act, fresh]);

  // Cell size from the container: Expert scrolls sideways inside the board.
  const wrap = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth));
    ro.observe(el);
    setWrapW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const cell = useMemo(() => Math.max(24, Math.min(36, Math.floor((wrapW - 2) / g.cols))), [wrapW, g.cols]);

  const resetStats = async () => {
    const ok = await confirmDialog({ title: "Reset the record?", message: `${stats.games} games and every best time are erased.`, confirmLabel: "Reset" });
    if (ok) setStats({ ...E.EMPTY_STATS });
  };

  const quip = useMemo(() => (g.status === "won" || g.status === "lost" ? pick(QUIPS[g.status], stats.games) : null), [g.status, stats.games]);
  const over = g.status === "won" || g.status === "lost";

  const presetRows = (p: Exclude<E.Preset, "custom">) => {
    const s = stats[p];
    return [
      { label: `${PRESET_LABEL[p]} games`, value: s.games },
      { label: "Wins", value: s.games ? `${s.wins} (${Math.round((s.wins / s.games) * 100)}%)` : 0 },
      { label: "Best time", value: s.best ? mmss(s.best) : "—" },
    ];
  };

  return (
    <div className="max-w-2xl mx-auto select-none">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 font-mono text-sm text-[#111010] dark:text-[#e8ddd0] min-w-0">
          <span className="inline-flex items-center gap-1.5 tabular-nums" aria-label={`${E.minesLeft(g)} mines left`}>
            <Flag size={14} strokeWidth={2} className="text-[#6f6455]" /><b>{E.minesLeft(g)}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums" aria-label={`Time ${mmss(g.seconds)}`}>
            <Timer size={14} strokeWidth={2} className="text-[#6f6455]" /><b>{mmss(g.seconds)}</b>
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderButton onClick={() => setFlagMode((f) => !f)} label="Flag mode" icon={<Flag size={16} strokeWidth={1.75} />} active={flagMode} showLabel={false} />
          <HeaderButton onClick={() => setSheet("stats")} label="Record" icon={<BarChart3 size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("settings")} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} />
        </div>
      </div>

      <Segmented<E.Preset>
        label="Board"
        value={g.preset}
        onChange={choosePreset}
        options={[
          { value: "beginner", label: "Beginner", hint: "9×9 · 10" },
          { value: "intermediate", label: "Intermed.", hint: "16×16 · 40" },
          { value: "expert", label: "Expert", hint: "30×16 · 99" },
          { value: "custom", label: "Custom", hint: `${prefs.custom.cols}×${prefs.custom.rows} · ${prefs.custom.mines}` },
        ]}
      />

      {/* Result / status line */}
      <div className="text-center my-3 min-h-[2.5rem]" aria-live="polite">
        {over ? (
          <>
            <p className={`text-sm font-bold font-mono ${g.status === "won" ? "text-[#15803d]" : "text-[#dc2626]"}`}>
              {g.status === "won" ? `Cleared in ${mmss(g.seconds)}` : "BOOM."}
            </p>
            {quip && <p className="text-xs text-[#6f6455] mt-1 italic">&ldquo;{quip}&rdquo;</p>}
          </>
        ) : (
          <p className="text-xs text-[#6f6455] italic">{g.status === "idle" ? "First click always opens. Promise." : flagMode ? "Flag mode — tap to flag." : "Think before you click."}</p>
        )}
      </div>

      {/* Board */}
      <div ref={wrap} className="relative mb-4 w-full overflow-x-auto rounded-2xl border border-[#e8e2d8] bg-[#f3f0ea] dark:bg-[#1c1917]">
        <div
          role="grid"
          aria-label={`Minesweeper board, ${g.cols} by ${g.rows}`}
          className={`grid mx-auto ${g.status === "lost" ? "animate-shake-x" : ""}`}
          style={{ gridTemplateColumns: `repeat(${g.cols}, ${cell}px)`, width: cell * g.cols }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {g.cells.map((c, i) => {
            const wrongFlag = g.status === "lost" && c.flagged && !c.mine;
            const boom = g.boom === i;
            let bg = "bg-[#e8e2d8] hover:bg-[#ddd6cb] dark:bg-[#3a3530] dark:hover:bg-[#443e38]";
            if (c.revealed) bg = c.mine ? (boom ? "bg-[#dc2626]" : "bg-[#f3c4c4] dark:bg-[#5a2222]") : "bg-white dark:bg-[#26221e]";
            return (
              <button
                key={i}
                role="gridcell"
                tabIndex={-1}
                aria-label={c.revealed ? (c.mine ? "mine" : c.adjacent ? `${c.adjacent}` : "open") : c.flagged ? "flag" : "closed"}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerUp={(e) => onPointerUp(e, i)}
                onPointerCancel={onPointerCancel}
                onPointerLeave={onPointerCancel}
                onContextMenu={(e) => { e.preventDefault(); if (!press.current?.fired) act(i, true); }}
                onFocus={() => setCursor(i)}
                disabled={over}
                className={`no-tap flex items-center justify-center font-mono font-bold border border-[#f3f0ea] dark:border-[#1c1917] transition-colors touch-manipulation ${bg} ${
                  !c.revealed && !over ? "cursor-pointer" : "cursor-default"
                } ${cursor === i && !over ? "ring-2 ring-inset ring-(--accent)" : ""}`}
                style={{ width: cell, height: cell, fontSize: Math.round(cell * 0.5) }}
              >
                {c.flagged && !c.revealed ? (
                  wrongFlag ? <X size={cell * 0.5} strokeWidth={2.5} className="text-[#dc2626]" /> : <Flag size={cell * 0.45} strokeWidth={2.5} className="text-(--accent-text)" />
                ) : c.revealed ? (
                  c.mine ? <Bomb size={cell * 0.5} strokeWidth={2} className={boom ? "text-white" : "text-[#111010] dark:text-[#e8ddd0]"} />
                  : c.adjacent > 0 ? <span className="animate-mark-in" style={{ color: NUM_COLORS[c.adjacent] }}>{c.adjacent}</span>
                  : null
                ) : null}
              </button>
            );
          })}
        </div>

        {resumable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 p-4">
            <div className="bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-4 max-w-xs w-full text-center shadow-xl animate-spotlight-in">
              <Sparkles size={20} strokeWidth={1.75} className="mx-auto mb-2 text-(--accent-text)" />
              <p className="text-sm font-bold text-[#111010] dark:text-[#e8ddd0]">A board is waiting</p>
              <p className="text-xs text-[#6f6455] mt-1">{PRESET_LABEL[resumable.preset]} · {mmss(resumable.seconds)} on the clock</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { recordedTick.current = -1; setG(resumable); setPrefs((p) => ({ ...p, preset: resumable.preset })); setResumable(null); }} className="flex-1 py-2 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest">Resume</button>
                <button onClick={() => { clearStore(SAVE_KEY); setResumable(null); }} className="flex-1 py-2 rounded-xl border border-[#e8e2d8] dark:border-[#3a3530] text-xs font-bold uppercase tracking-widest text-[#6f6455]">Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={over ? () => fresh(g.preset, prefs.custom) : newGame}
        className="w-full py-3 rounded-2xl bg-(--accent) text-(--accent-on) font-bold text-sm uppercase tracking-widest hover:bg-(--accent-dim) transition-colors inline-flex items-center justify-center gap-2"
      >
        <RotateCcw size={16} strokeWidth={2} />
        {g.status === "idle" ? "Shuffle board" : over ? "Play again" : "New board"}
      </button>

      <p className="text-center text-[10px] text-[#756a5a] font-mono mt-3">
        <span className="sm:hidden">Tap to open · hold to flag · tap a number to chord</span>
        <span className="hidden sm:inline">Click to open · right-click or hold to flag · click a number to chord · <Kbd>↑↓←→</Kbd> <Kbd>Space</Kbd> <Kbd>F</Kbd></span>
      </p>

      <GameSheet open={sheet === "stats"} onClose={() => setSheet(null)} title="Record">
        <StatRows rows={[
          { label: "Games", value: stats.games },
          { label: "Wins", value: stats.games ? `${stats.wins} (${Math.round((stats.wins / stats.games) * 100)}%)` : 0 },
          { label: "Current streak", value: stats.streak },
          { label: "Best streak", value: stats.bestStreak },
        ]} />
        <SectionLabel>By board</SectionLabel>
        <StatRows rows={[...presetRows("beginner"), ...presetRows("intermediate"), ...presetRows("expert")]} />
        <button onClick={resetStats} className="mt-4 text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:text-(--accent-text) transition-colors">Reset record</button>
      </GameSheet>
      <GameSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Settings">
        <GameSettingsBody>
          <div className="pt-1">
            <SectionLabel>Custom board</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {([["cols", "Width", E.LIMITS.minCols, E.LIMITS.maxCols], ["rows", "Height", E.LIMITS.minRows, E.LIMITS.maxRows], ["mines", "Mines", 1, 999]] as const).map(([k, label, min, max]) => (
                <label key={k} className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-widest text-[#6f6455] mb-1">{label}</span>
                  <input
                    type="number" inputMode="numeric" min={min} max={max}
                    value={customDraft[k]}
                    onChange={(e) => setCustomDraft((d) => ({ ...d, [k]: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-[#e8e2d8] dark:border-[#3a3530] bg-white dark:bg-[#26221e] px-3 py-2 text-base font-mono text-[#111010] dark:text-[#e8ddd0]"
                  />
                </label>
              ))}
            </div>
            <p className="text-[11px] text-[#6f6455] mt-2">Width {E.LIMITS.minCols}–{E.LIMITS.maxCols}, height {E.LIMITS.minRows}–{E.LIMITS.maxRows}, mines up to the board minus nine. Custom boards keep no best time.</p>
            <button onClick={() => { applyCustom(); setSheet(null); }} className="mt-3 w-full py-2.5 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest">Start custom board</button>
          </div>
        </GameSettingsBody>
      </GameSheet>
    </div>
  );
}
