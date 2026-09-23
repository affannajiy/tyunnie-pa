// components/games/sudoku/Sudoku.tsx
// Presentation over engine.ts: the grid, selection + peer/same-digit
// highlighting, the number pad, hint copy, the clock and persistence. Puzzles
// come from the seeded generator, so a "puzzle ID" in the settings sheet
// reloads the exact same grid.
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { BarChart3, Settings2, RotateCcw, Timer, Sparkles, Undo2, Redo2, Eraser, PencilLine, Lightbulb, ListChecks, CalendarDays, Copy, Check } from "lucide-react";
import * as E from "./engine";
import { digitsOf } from "./solver";
import { GameSheet, GameSettingsBody, StatRows, SectionLabel, HeaderButton, Segmented, Switch, ignoreGameKey } from "../ui";
import { readStore, writeStore, clearStore, useGameSettings } from "@/lib/gameStore";
import { play, setAudioEnabled } from "@/lib/gameAudio";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { Kbd } from "@/components/ui/Kbd";
import { todayKey } from "@/lib/dayKey";

const PREFS_KEY = "sudoku";
const STATS_KEY = "sudoku_stats";
const SAVE_KEY = "sudoku_save";

type Mode = E.Difficulty | "daily";
type Prefs = { difficulty: string; autoCheck: boolean };
const PREFS_DEFAULT: Prefs = { difficulty: "easy", autoCheck: true };
type Save = { game: E.Game | null };

const asDifficulty = (v: string): E.Difficulty => (v === "normal" || v === "hard" || v === "expert" ? v : v === "medium" ? "normal" : "easy");
const LABEL: Record<E.Difficulty, string> = { easy: "Easy", normal: "Normal", hard: "Hard", expert: "Expert" };

const QUIPS = {
  solved: ["You actually did it 🧡 I'm proud.", "Flawless. I knew you could.", "That's my person 🧡", "Sudoku master right here."],
  lost: ["Three strikes. The grid wins this one.", "Okay, that one bit back. Again?", "Even I mis-count sometimes. Rarely. But sometimes."],
};
const pick = (a: string[], seed: number) => a[seed % a.length];
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function mergeStats(s: E.Stats): E.Stats {
  const d = E.EMPTY_STATS;
  return { ...d, ...s, easy: { ...d.easy, ...s.easy }, normal: { ...d.normal, ...s.normal }, hard: { ...d.hard, ...s.hard }, expert: { ...d.expert, ...s.expert } };
}

export default function Sudoku() {
  const [settings] = useGameSettings();
  useEffect(() => setAudioEnabled(settings.sound), [settings.sound]);

  const [prefs, setPrefs] = useState<Prefs>(() => readStore(PREFS_KEY, PREFS_DEFAULT));
  const [stats, setStats] = useState<E.Stats>(() => mergeStats(readStore(STATS_KEY, E.EMPTY_STATS)));
  const [g, setG] = useState<E.Game>(() => {
    const p = readStore(PREFS_KEY, PREFS_DEFAULT);
    return E.newGame(asDifficulty(p.difficulty), p.autoCheck);
  });
  const [resumable, setResumable] = useState<E.Game | null>(() => {
    const s = readStore<Save>(SAVE_KEY, { game: null });
    const sv = s.game;
    return sv && sv.status === "playing" && Array.isArray(sv.cells) && sv.cells.length === 81 && Array.isArray(sv.solution) ? { ...sv, undo: sv.undo ?? [], redo: sv.redo ?? [], hint: null } : null;
  });
  const [sheet, setSheet] = useState<"stats" | "settings" | null>(null);
  const [explicitSel, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState(false);
  const [idDraft, setIdDraft] = useState("");
  const [idError, setIdError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => writeStore(PREFS_KEY, prefs), [prefs]);
  useEffect(() => writeStore(STATS_KEY, stats), [stats]);

  const gRef = useRef(g);
  useEffect(() => { gRef.current = g; }, [g]);
  useEffect(() => {
    const cur = gRef.current;
    if (cur.status === "playing" && cur.undo.length + (cur.cells.filter((c) => !c.given && c.value).length) > 0) {
      writeStore<Save>(SAVE_KEY, { game: { ...cur, undo: cur.undo.slice(-40), redo: [] } });
    } else if (cur.status !== "playing") clearStore(SAVE_KEY);
  }, [g.tick, g.status]);
  useEffect(() => () => { const cur = gRef.current; if (cur.status === "playing") writeStore<Save>(SAVE_KEY, { game: { ...cur, undo: cur.undo.slice(-40), redo: [] } }); }, []);

  useEffect(() => {
    if (g.status !== "playing" || resumable) return;
    const t = setInterval(() => setG((cur) => E.tickSecond(cur)), 1000);
    return () => clearInterval(t);
  }, [g.status, resumable]);

  const recordedId = useRef("");
  useEffect(() => {
    if (g.status === "playing" || recordedId.current === g.id + g.tick) return;
    recordedId.current = g.id + g.tick;
    setStats((s) => E.recordResult(s, g));
  }, [g]);

  // Sound: diff the previous state rather than playing inside an updater
  // (updaters must stay pure — StrictMode runs them twice).
  const prev = useRef<E.Game | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = g;
    if (!p || p.id !== g.id || p.tick === g.tick) return;
    if (g.status === "solved") play("win");
    else if (g.status === "lost") play("boom");
    else if (g.hint && !p.hint) play("claim");
    else if (E.errors(g).size > E.errors(p).size) play("lose");
    else if (g.undo.length < p.undo.length) play("undo");
    else play("place");
  }, [g]);

  const mode: Mode = g.daily ? "daily" : g.difficulty;

  const start = useCallback((m: Mode) => {
    const auto = prefs.autoCheck;
    clearStore(SAVE_KEY); // an empty new grid never writes, so the left puzzle's save would linger
    setG(m === "daily" ? E.dailyGame(todayKey(), auto) : E.newGame(m, auto));
    setSelected(null);
    setNotes(false);
    if (m !== "daily") setPrefs((p) => ({ ...p, difficulty: m }));
  }, [prefs.autoCheck]);

  const guarded = useCallback(async (fn: () => void) => {
    const entered = g.cells.some((c) => !c.given && c.value);
    if (g.status === "playing" && entered) {
      const ok = await confirmDialog({ title: "Leave this puzzle?", message: `${mmss(g.seconds)} and every entry are lost. It doesn't count as a solve.`, confirmLabel: "Leave" });
      if (!ok) return;
    }
    fn();
  }, [g.cells, g.status, g.seconds]);

  const choose = (m: Mode) => { if (m !== mode) void guarded(() => start(m)); };

  const hintTarget = g.hint ? (g.hint.step ? g.hint.step.cell : g.hint.reveal) : -1;
  const selected = explicitSel !== null ? explicitSel : hintTarget >= 0 ? hintTarget : null;

  // ── Actions ──
  const act = useCallback((fn: (cur: E.Game) => E.Game) => setG(fn), []);

  const enter = useCallback((v: number) => {
    if (selected === null) return;
    act((cur) => (notes ? E.toggleNote(cur, selected, v) : E.setValue(cur, selected, v)));
  }, [selected, notes, act]);

  const eraseSel = useCallback(() => { if (selected !== null) act((cur) => E.erase(cur, selected)); }, [selected, act]);
  const doUndo = useCallback(() => act(E.undo), [act]);
  const doRedo = useCallback(() => act(E.redo), [act]);
  // A hint moves the selection onto its cell: with no explicit selection the
  // hint target is the selection (see `selected` above), so clearing it here
  // is what makes the hint cell active.
  const doHint = useCallback(() => { act(E.hint); setSelected(null); }, [act]);
  const applyHint = useCallback(() => act(E.applyHint), [act]);

  // ── Keys ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || resumable) return;
      if (ignoreGameKey(e)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); doRedo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key >= "1" && e.key <= "9") { e.preventDefault(); enter(Number(e.key)); return; }
      const sel = selected ?? 0;
      const move = (d: number) => { e.preventDefault(); setSelected(Math.max(0, Math.min(80, sel + d))); };
      switch (e.key) {
        case "ArrowLeft": if (sel % 9 > 0) move(-1); else e.preventDefault(); break;
        case "ArrowRight": if (sel % 9 < 8) move(1); else e.preventDefault(); break;
        case "ArrowUp": move(-9); break;
        case "ArrowDown": move(9); break;
        case "Backspace": case "Delete": case "0": e.preventDefault(); eraseSel(); break;
        case "n": case "N": e.preventDefault(); setNotes((n) => !n); break;
        case "z": case "Z": e.preventDefault(); doUndo(); break;
        case "y": case "Y": e.preventDefault(); doRedo(); break;
        case "h": case "H": e.preventDefault(); if (g.hint) applyHint(); else doHint(); break;
        case "Escape": setSelected(null); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, resumable, selected, enter, eraseSel, doUndo, doRedo, doHint, applyHint, g.hint]);

  // ── Layout ──
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
  // 9 cells + 8 hairline gaps + 2 thick box lines + the outer border.
  const cell = Math.max(28, Math.min(52, Math.floor((wrapW - 8 - 4 - 4) / 9)));
  // Columns 3 and 6 are 2px wider so the cells' box-line margin has room — a
  // fixed `repeat(9, cell)` swallowed it and the vertical box lines vanished.
  const columns = Array.from({ length: 9 }, (_, c) => `${cell + (c === 2 || c === 5 ? 2 : 0)}px`).join(" ");

  const errs = useMemo(() => E.errors(g), [g]);
  const counts = useMemo(() => E.digitCounts(g), [g]);
  const selValue = selected !== null ? g.cells[selected].value : 0;

  const over = g.status !== "playing";
  const quip = useMemo(() => (over ? pick(QUIPS[g.status as "solved" | "lost"], stats.solved) : null), [over, g.status, stats.solved]);

  const copyId = async () => {
    try { await navigator.clipboard.writeText(g.id); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };
  const loadId = () => {
    const loaded = E.gameFromId(idDraft, prefs.autoCheck);
    if (!loaded) { setIdError("That doesn't look like a puzzle ID — try something like N-4821."); return; }
    setIdError(null);
    setSheet(null);
    void guarded(() => { setG(loaded); setSelected(null); setNotes(false); });
  };
  const resetStats = async () => {
    const ok = await confirmDialog({ title: "Reset the record?", message: `${stats.solved} solves, every best time and the daily streak are erased.`, confirmLabel: "Reset" });
    if (ok) setStats({ ...E.EMPTY_STATS });
  };

  const perRows = (d: E.Difficulty) => [{ label: `${LABEL[d]} solved`, value: stats[d].solved }, { label: "Best", value: stats[d].best ? mmss(stats[d].best) : "—" }];

  return (
    <div className="max-w-md mx-auto select-none">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 font-mono text-sm text-[#111010] dark:text-[#e8ddd0] min-w-0">
          <span className="inline-flex items-center gap-1.5 tabular-nums" aria-label={`Time ${mmss(g.seconds)}`}>
            <Timer size={14} strokeWidth={2} className="text-[#6f6455]" /><b>{mmss(g.seconds)}</b>
          </span>
          {g.autoCheck && (
            <span className="text-xs text-[#6f6455] tabular-nums" aria-label={`${g.mistakes} of ${E.MAX_MISTAKES} mistakes`}>
              ✕ <b className={g.mistakes ? "text-[#dc2626]" : ""}>{g.mistakes}</b>/{E.MAX_MISTAKES}
            </span>
          )}
          <button onClick={copyId} className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[#756a5a] hover:text-(--accent-text) transition-colors" aria-label={`Copy puzzle ID ${g.id}`}>
            {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}{g.id}
          </button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderButton onClick={() => setSheet("stats")} label="Record" icon={<BarChart3 size={16} strokeWidth={1.75} />} />
          <HeaderButton onClick={() => setSheet("settings")} label="Settings" icon={<Settings2 size={16} strokeWidth={1.75} />} />
        </div>
      </div>

      <Segmented<Mode>
        label="Puzzle"
        value={mode}
        onChange={choose}
        options={[
          { value: "easy", label: "Easy", hint: "singles" },
          { value: "normal", label: "Normal", hint: "pairs" },
          { value: "hard", label: "Hard", hint: "triples" },
          { value: "expert", label: "Expert", hint: "x-wing+" },
          { value: "daily", label: "Daily", hint: todayKey().slice(5) },
        ]}
      />

      {/* Board */}
      <div ref={wrap} className="relative my-4 flex justify-center">
        <div
          role="grid"
          aria-label="Sudoku grid"
          className="inline-grid border-2 border-[#111010] dark:border-[#e8ddd0] bg-[#111010] dark:bg-[#e8ddd0] gap-px"
          style={{ gridTemplateColumns: columns }}
        >
          {g.cells.map((c, i) => {
            const r = Math.floor(i / 9), col = i % 9;
            const isSel = selected === i;
            const peer = selected !== null && E.isPeer(selected, i);
            const same = !!selValue && c.value === selValue && !isSel;
            const err = errs.has(i);
            const target = hintTarget === i;
            let bg = "bg-white dark:bg-[#1c1917]";
            if (peer) bg = "bg-[#faf8f5] dark:bg-[#26221e]";
            if (same) bg = "bg-[#fff0e6] dark:bg-[#3a2a1c]";
            if (target) bg = "bg-[#dcfce7] dark:bg-[#14532d]";
            if (isSel) bg = "bg-(--accent-soft) dark:bg-[#4a3218]";
            if (err) bg = "bg-[#fee2e2] dark:bg-[#5a2222]";
            const thickR = col === 2 || col === 5 ? "mr-[2px]" : "";
            const thickB = r === 2 || r === 5 ? "mb-[2px]" : "";
            return (
              <button
                key={i}
                role="gridcell"
                tabIndex={-1}
                aria-selected={isSel}
                aria-label={`Row ${r + 1} column ${col + 1}${c.value ? `, ${c.value}${c.given ? " given" : ""}` : c.notes ? `, notes ${digitsOf(c.notes).join(" ")}` : ", empty"}`}
                onClick={() => setSelected(i)}
                className={`no-tap relative flex items-center justify-center font-mono transition-colors ${bg} ${thickR} ${thickB} ${isSel ? "ring-2 ring-inset ring-(--accent)" : ""}`}
                style={{ width: cell, height: cell, fontSize: Math.round(cell * 0.5) }}
              >
                {c.value ? (
                  <span className={`${c.given ? "font-bold text-[#111010] dark:text-[#e8ddd0]" : err ? "text-[#dc2626]" : "text-(--accent-text)"} ${!c.given ? "animate-mark-in" : ""}`}>{c.value}</span>
                ) : c.notes ? (
                  <span className="grid grid-cols-3 w-full h-full p-[2px] leading-none" aria-hidden>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                      <span key={d} className={`flex items-center justify-center text-[#6f6455] ${selValue === d ? "font-bold text-(--accent-text)" : ""}`} style={{ fontSize: Math.max(8, Math.round(cell * 0.22)) }}>
                        {digitsOf(c.notes).includes(d) ? d : ""}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {resumable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 p-4 rounded-xl">
            <div className="bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-4 max-w-xs w-full text-center shadow-xl animate-spotlight-in">
              <Sparkles size={20} strokeWidth={1.75} className="mx-auto mb-2 text-(--accent-text)" />
              <p className="text-sm font-bold text-[#111010] dark:text-[#e8ddd0]">A puzzle is waiting</p>
              <p className="text-xs text-[#6f6455] mt-1">{resumable.daily ? `Daily ${resumable.daily}` : LABEL[resumable.difficulty]} · {mmss(resumable.seconds)} in</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setG(resumable); setResumable(null); }} className="flex-1 py-2 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest">Resume</button>
                <button onClick={() => { clearStore(SAVE_KEY); setResumable(null); }} className="flex-1 py-2 rounded-xl border border-[#e8e2d8] dark:border-[#3a3530] text-xs font-bold uppercase tracking-widest text-[#6f6455]">Discard</button>
              </div>
            </div>
          </div>
        )}

        {over && !resumable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-4 rounded-xl">
            <div className="bg-white dark:bg-[#1c1917] border border-[#e8e2d8] dark:border-[#3a3530] rounded-2xl p-5 max-w-xs w-full text-center shadow-xl animate-spotlight-in">
              <p className={`font-serif italic text-2xl ${g.status === "solved" ? "text-[#15803d]" : "text-[#dc2626]"}`}>{g.status === "solved" ? "Solved" : "Three mistakes"}</p>
              <p className="font-mono text-xs text-[#6f6455] mt-1 tabular-nums">
                {mmss(g.seconds)} · {g.hintsUsed} {g.hintsUsed === 1 ? "hint" : "hints"}{g.autoCheck ? ` · ${g.mistakes} ${g.mistakes === 1 ? "mistake" : "mistakes"}` : " · unchecked"}
              </p>
              {quip && <p className="text-xs text-[#6f6455] mt-2 italic">&ldquo;{quip}&rdquo;</p>}
              <button onClick={() => start(mode === "daily" ? asDifficulty(prefs.difficulty) : mode)} className="mt-4 w-full py-2.5 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest inline-flex items-center justify-center gap-2">
                <RotateCcw size={14} strokeWidth={2} />{mode === "daily" ? `New ${LABEL[asDifficulty(prefs.difficulty)]}` : "New puzzle"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      {g.hint && !over && (
        <div className="mb-3 rounded-2xl border border-[#bfdbfe] dark:border-[#1e3a5f] bg-[#eff6ff] dark:bg-[#0f1f33] px-4 py-3 text-xs text-[#111010] dark:text-[#e8ddd0] flex items-start gap-3 animate-fade-in">
          <Lightbulb size={16} strokeWidth={1.75} className="shrink-0 mt-0.5 text-[#2563eb]" />
          <p className="flex-1 leading-snug">{g.hint.text}</p>
          <button onClick={applyHint} className="tap-target shrink-0 font-bold uppercase tracking-widest text-[10px] text-[#2563eb] hover:underline">Apply</button>
        </div>
      )}

      {/* Tools */}
      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {[
          { label: "Undo", icon: <Undo2 size={16} strokeWidth={1.75} />, on: doUndo, off: !g.undo.length || over },
          { label: "Redo", icon: <Redo2 size={16} strokeWidth={1.75} />, on: doRedo, off: !g.redo.length || over },
          { label: "Erase", icon: <Eraser size={16} strokeWidth={1.75} />, on: eraseSel, off: selected === null || over },
          { label: "Notes", icon: <PencilLine size={16} strokeWidth={1.75} />, on: () => setNotes((n) => !n), off: over, active: notes },
          { label: "Fill notes", icon: <ListChecks size={16} strokeWidth={1.75} />, on: () => act(E.autoNotes), off: over },
          { label: "Hint", icon: <Lightbulb size={16} strokeWidth={1.75} />, on: doHint, off: over },
        ].map((t) => (
          <button
            key={t.label}
            onClick={t.on}
            disabled={t.off}
            aria-label={t.label}
            aria-pressed={t.active}
            className={`tap-target flex flex-col items-center justify-center gap-1 py-2 rounded-xl border text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-30 ${
              t.active ? "border-(--accent) text-(--accent-text) bg-(--accent-soft)" : "border-[#e8e2d8] dark:border-[#3a3530] text-[#6f6455] hover:border-(--accent)"
            }`}
          >
            {t.icon}<span className="leading-none">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Pad */}
      <div className="grid grid-cols-9 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
          const done = counts[d] >= 9;
          return (
            <button
              key={d}
              onClick={() => enter(d)}
              disabled={over || selected === null || (done && !notes)}
              aria-label={`${notes ? "Note" : "Enter"} ${d}${done ? ", complete" : ""}`}
              className={`no-tap min-h-11 rounded-xl border font-mono font-bold text-lg transition-colors disabled:opacity-30 ${
                notes ? "border-(--accent) text-(--accent-text) bg-(--accent-soft)/40" : "border-[#e8e2d8] dark:border-[#3a3530] bg-white dark:bg-[#26221e] text-[#111010] dark:text-[#e8ddd0] hover:border-(--accent)"
              } ${selValue === d ? "ring-2 ring-(--accent)" : ""}`}
            >
              {d}
              <span className="block text-[9px] font-normal text-[#756a5a] leading-none -mt-0.5">{done ? "✓" : 9 - counts[d]}</span>
            </button>
          );
        })}
      </div>

      <p className="hidden sm:block text-center text-[10px] text-[#756a5a] font-mono mt-3">
        <Kbd>1</Kbd>–<Kbd>9</Kbd> enter · <Kbd>N</Kbd> notes · <Kbd>⌫</Kbd> erase · <Kbd>Z</Kbd>/<Kbd>Y</Kbd> undo/redo · <Kbd>H</Kbd> hint
      </p>

      <GameSheet open={sheet === "stats"} onClose={() => setSheet(null)} title="Record">
        <StatRows rows={[
          { label: "Solved", value: stats.solved },
          { label: "Best time", value: stats.bestTime ? mmss(stats.bestTime) : "—" },
          { label: "Hints used", value: stats.hintsUsed },
          { label: "Unchecked solves", value: stats.unchecked },
        ]} />
        <SectionLabel>Daily</SectionLabel>
        <StatRows rows={[
          { label: "Current streak", value: stats.dailyStreak },
          { label: "Best streak", value: stats.bestDailyStreak },
          { label: "Last daily", value: stats.lastDaily || "—" },
        ]} />
        <SectionLabel>By difficulty</SectionLabel>
        <StatRows rows={[...perRows("easy"), ...perRows("normal"), ...perRows("hard"), ...perRows("expert")]} />
        <button onClick={resetStats} className="mt-4 text-xs font-bold uppercase tracking-widest text-[#6f6455] hover:text-(--accent-text) transition-colors">Reset record</button>
      </GameSheet>
      <GameSheet open={sheet === "settings"} onClose={() => setSheet(null)} title="Settings">
        <GameSettingsBody>
          <div className="pt-1">
            <SectionLabel>Sudoku</SectionLabel>
            <Switch
              label="Auto-check"
              hint="Wrong digits turn red and count; three end the game. Off: only clashes are marked and the solve is recorded as unchecked."
              checked={prefs.autoCheck}
              onChange={(v) => { setPrefs((p) => ({ ...p, autoCheck: v })); setG((cur) => E.setAutoCheck(cur, v)); }}
            />
            <SectionLabel>Load a puzzle by ID</SectionLabel>
            <div className="flex gap-2">
              <input
                value={idDraft}
                onChange={(e) => { setIdDraft(e.target.value); setIdError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") loadId(); }}
                placeholder={g.id}
                aria-label="Puzzle ID"
                className="flex-1 min-w-0 rounded-xl border border-[#e8e2d8] dark:border-[#3a3530] bg-white dark:bg-[#26221e] px-3 py-2 text-base font-mono text-[#111010] dark:text-[#e8ddd0]"
              />
              <button onClick={loadId} className="px-4 rounded-xl bg-(--accent) text-(--accent-on) text-xs font-bold uppercase tracking-widest">Load</button>
            </div>
            {idError && <p className="text-[11px] text-[#dc2626] mt-2">{idError}</p>}
            <p className="text-[11px] text-[#6f6455] mt-2 inline-flex items-center gap-1.5"><CalendarDays size={12} strokeWidth={2} /> This puzzle is <b className="font-mono">{g.id}</b>. Same ID, same grid, anywhere.</p>
          </div>
        </GameSettingsBody>
      </GameSheet>
    </div>
  );
}
