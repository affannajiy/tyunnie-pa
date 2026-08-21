"use client";

import {
  X,
  Music2,
  Shuffle,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Repeat1,
  RotateCcw,
} from "lucide-react";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";
import type { Todo, StickyNote as StickyNoteType } from "@/lib/database";
import StickyNote from "@/components/StickyNote";
import { updateStickyNote, deleteStickyNote } from "@/lib/database";
import { useAccentColor } from "@/lib/useAccentColor";

type PomSettings = { focusMins: number; shortMins: number };

type Preset = { label: string; focusMins: number; shortMins: number };

// ── Ambient glow tuning ──────────────────────────────────────────────────────
// Original bass window. Sampling fewer bins was tried and reverted.
const BASS_BINS = 12;
// Envelope fall per frame. Rise is instant (see tick) — fast attack, smooth
// decay. This is the ONLY smoothing; there is deliberately no CSS transition
// on the element, which used to smear every frame and caused the lag.
const DECAY = 0.86;

/**
 * The ambient glow, as one function so the idle branch and the animated branch
 * can never drift apart. `g` is 0–1.
 *
 * Geometry is the original low ellipse. Two alternatives were tried and both
 * reverted after looking at them: a wider `140% 120% at 50% 88%` sized ellipse,
 * and a tighter `22%→55%` footprint. The original wash is the look — don't
 * "improve" either number without asking.
 *
 * The static background in the JSX `style` must be kept in step with this.
 */
function glowCss(rgb: string, g: number): string {
  // Original footprint. A tighter 22→55 was tried and reverted — the wider wash
  // is the look. Don't shrink these without asking.
  const radius = Math.round(30 + g * 60);
  const opacity = (0.08 + g * 0.47).toFixed(3);
  return `radial-gradient(ellipse at 50% 80%, rgba(${rgb},${opacity}) 0%, transparent ${radius}%)`;
}

const PRESETS: Preset[] = [
  { label: "Classic",     focusMins: 25, shortMins: 5  },
  { label: "Extended",    focusMins: 45, shortMins: 10 },
  { label: "Short Sprint",focusMins: 15, shortMins: 3  },
  { label: "Deep Work",   focusMins: 90, shortMins: 20 },
];

type Props = {
  todos: Todo[];
  stickyNotes: StickyNoteType[];
  onStickyNotesChange: (notes: StickyNoteType[]) => void;
  onExit: () => void;
};

function readPomSettings(): PomSettings {
  try {
    const raw = localStorage.getItem("tyunnie_pomodoro_settings");
    if (!raw) return { focusMins: 25, shortMins: 5 };
    const p = JSON.parse(raw) as { focusMins?: number; shortMins?: number };
    return {
      focusMins: typeof p.focusMins === "number" ? p.focusMins : 25,
      shortMins: typeof p.shortMins === "number" ? p.shortMins : 5,
    };
  } catch {
    return { focusMins: 25, shortMins: 5 };
  }
}

function savePomSettings(s: PomSettings) {
  localStorage.setItem("tyunnie_pomodoro_settings", JSON.stringify(s));
  window.dispatchEvent(new Event("tyunnie-pomodoro-settings-changed"));
}

export default function FocusMode({
  todos,
  stickyNotes,
  onStickyNotesChange,
  onExit,
}: Props) {
  const music = useMusicContext();

  // ── Music-rhythm glow refs (never state — same rule as Music.tsx) ──
  const bgGlowRef = useRef<HTMLDivElement>(null);
  const glowRafRef = useRef<number | null>(null);
  // Envelope + running-max live in refs, not state: they update every frame and
  // must never trigger a React render (same rule as the glow itself).
  const envelopeRef = useRef(0);
  // Live accent — re-renders on tyunnie-accent-changed (Auto-Theme, picker).
  const accentRgb = useAccentColor();

  // ── Emphasis mode ──
  // Deliberately a mode INSIDE FocusMode rather than a second fullscreen
  // surface. A separate visualizer would need its own copy of the analyser rAF
  // loop, and duplicating that loop is exactly what caused the same stale-accent
  // bug to exist twice (Music.tsx + FocusMode.tsx) before v3.23.0.
  // Lazy initialiser, not a mount effect — matches Profile.tsx / MusicContext.tsx
  // and avoids react-hooks/set-state-in-effect.
  const [listenMode, setListenMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tyunnie_focus_listen") === "1";
  });
  function toggleListenMode() {
    setListenMode((prev) => {
      const next = !prev;
      if (next) localStorage.setItem("tyunnie_focus_listen", "1");
      else localStorage.removeItem("tyunnie_focus_listen");
      return next;
    });
  }

  // ── Task state ──
  const [linkedTask, setLinkedTask] = useState<string | null>(null);

  // ── Pomodoro state ──
  const [pomSettings, setPomSettings] = useState<PomSettings>(() => readPomSettings());
  const [pomRunning, setPomRunning] = useState(false);
  const [pomSeconds, setPomSeconds] = useState(() => readPomSettings().focusMins * 60);
  const [pomMode, setPomMode] = useState<"focus" | "break">("focus");
  const pomRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingTodos = todos.filter((t) => !t.done);
  const linkedTodo = pendingTodos.find((t) => t.id === linkedTask);

  // ── Esc to exit ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // ── Sync pomodoro settings from other panels ──
  useEffect(() => {
    function onSettingsChanged() {
      const s = readPomSettings();
      setPomSettings(s);
    }
    window.addEventListener("tyunnie-pomodoro-settings-changed", onSettingsChanged);
    return () => window.removeEventListener("tyunnie-pomodoro-settings-changed", onSettingsChanged);
  }, []);

  // ── Pomodoro timer ──
  useEffect(() => {
    if (pomRunning) {
      pomRef.current = setInterval(() => {
        setPomSeconds((s) => {
          if (s <= 1) {
            clearInterval(pomRef.current!);
            setPomRunning(false);
            // Alert beep
            try {
              const ctx = new AudioContext();
              const playBeep = (freq: number, start: number, dur: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = "sine";
                gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + dur);
              };
              playBeep(523, 0, 0.15);
              playBeep(659, 0.18, 0.15);
              playBeep(784, 0.36, 0.3);
            } catch {}
            const next = pomMode === "focus" ? "break" : "focus";
            setPomMode(next);
            const nextSecs = next === "focus" ? pomSettings.focusMins * 60 : pomSettings.shortMins * 60;
            setPomSeconds(nextSecs);
            return nextSecs;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (pomRef.current) clearInterval(pomRef.current);
    }
    return () => {
      if (pomRef.current) clearInterval(pomRef.current);
    };
  }, [pomRunning, pomMode, pomSettings]);

  // ── Apply preset ──
  const applyPreset = useCallback((preset: Preset) => {
    const s: PomSettings = { focusMins: preset.focusMins, shortMins: preset.shortMins };
    setPomSettings(s);
    savePomSettings(s);
    // Reset timer to new focus duration (only if not running)
    if (!pomRunning) {
      setPomMode("focus");
      setPomSeconds(preset.focusMins * 60);
    }
  }, [pomRunning]);

  // ── Music-rhythm background glow via analyser — direct DOM ref, NOT state ──
  useEffect(() => {
    // accentRgb comes from useAccentColor() and is in this effect's deps, so an
    // accent change (every track, with Auto-Theme on) tears the loop down and
    // restarts it with the new colour. Reading the CSS var here without that
    // dep captured it once at mount: the rAF loop then repainted the stale
    // colour 60x/sec AND, because it writes an inline style every frame, it
    // permanently clobbered the rgba(var(--accent-rgb),…) fallback in the JSX,
    // so the element could never recover on its own.
    const rgb = accentRgb;

    // A rAF loop writing inline styles is invisible to the global
    // prefers-reduced-motion block in globals.css, which only reaches CSS
    // transitions and animations. Honour it explicitly (§13): render the glow
    // at a calm fixed level and never start the loop.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      if (bgGlowRef.current) bgGlowRef.current.style.background = glowCss(rgb, 0.35);
      return;
    }

    if (!music.isPlaying || !music.analyser?.current) {
      if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current);
      glowRafRef.current = null;
      if (bgGlowRef.current) {
        envelopeRef.current = 0;
        bgGlowRef.current.style.background = glowCss(rgb, 0);
      }
      return;
    }

    const dataArray = new Uint8Array(music.analyser.current.frequencyBinCount);

    function tick() {
      if (!music.analyser?.current || !bgGlowRef.current) return;
      music.analyser.current.getByteFrequencyData(dataArray);

      // ABSOLUTE level, as it originally was — this is what actually rises and
      // falls with the music. An auto-normalise (raw / running-peak) was tried
      // here and it FLATTENED the glow: modern masters keep the bass near its
      // own maximum almost constantly, so the ratio pinned at ~1.0 and the glow
      // became a static blob. Do not reintroduce it.
      let sum = 0;
      for (let i = 0; i < BASS_BINS; i++) sum += dataArray[i];
      const target = sum / BASS_BINS / 255;

      // Fast attack, smooth decay: jump straight to a new peak on the frame it
      // lands, then ease down. Keeps the punch without the per-frame CSS smear.
      envelopeRef.current =
        target > envelopeRef.current
          ? target
          : envelopeRef.current * DECAY + target * (1 - DECAY);

      bgGlowRef.current.style.background = glowCss(rgb, envelopeRef.current);
      glowRafRef.current = requestAnimationFrame(tick);
    }

    glowRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current);
      glowRafRef.current = null;
    };
  }, [music.isPlaying, music.analyser, accentRgb]);

  // ── Timer display ──
  const pomMin = Math.floor(pomSeconds / 60).toString().padStart(2, "0");
  const pomSec = (pomSeconds % 60).toString().padStart(2, "0");
  const pomTotal = pomMode === "focus" ? pomSettings.focusMins * 60 : pomSettings.shortMins * 60;
  const pomPct = ((pomTotal - pomSeconds) / pomTotal) * 100;

  const r = 88;
  const circ = 2 * Math.PI * r;
  const dash = (pomPct / 100) * circ;
  const timerColor = pomMode === "focus" ? "var(--accent-text)" : "#16a34a";

  // ── Sticky note handlers ──
  async function handleStickyUpdate(id: string, patch: Partial<StickyNoteType>) {
    await updateStickyNote(id, patch);
    onStickyNotesChange(stickyNotes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  async function handleStickyDelete(id: string) {
    await deleteStickyNote(id);
    onStickyNotesChange(stickyNotes.filter((n) => n.id !== id));
  }

  return (
    <div
      className="on-dark fixed inset-0 z-100 flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0e0b08 0%, #111010 100%)" }}
    >
      {/* Music-reactive ambient glow — written directly via bgGlowRef */}
      <div
        ref={bgGlowRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          // Still NO CSS transition here, deliberately. The rAF loop writes this
          // every frame; the old 0.08s ease applied an 80ms smear to each write
          // and was the main reason the glow lagged the beat. Smoothing lives in
          // the attack/decay envelope in tick() instead.
          background:
            "radial-gradient(ellipse at 50% 80%, rgba(var(--accent-rgb),0.12) 0%, transparent 60%)",
        }}
      />

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "var(--accent)", color: "var(--accent-on)" }}
          />
          <span
            className="text-[10px] font-mono font-bold uppercase tracking-[3px] opacity-70"
            style={{ color: "var(--accent-text)" }}
          >
            {listenMode ? "Listening" : "Focus Mode"}
          </span>
        </div>

        {/* Timer / Listen emphasis toggle */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-xl border border-[#2a2520] ml-auto mr-3"
          role="group"
          aria-label="Focus Mode layout"
        >
          {([false, true] as const).map((mode) => (
            <button
              key={String(mode)}
              onClick={() => listenMode !== mode && toggleListenMode()}
              aria-pressed={listenMode === mode}
              className="px-3 py-1.5 rounded-[10px] text-[10px] font-mono uppercase tracking-widest transition-colors"
              style={{
                background:
                  listenMode === mode
                    ? "rgba(var(--accent-rgb),0.18)"
                    : "transparent",
                color: listenMode === mode ? "var(--accent-text)" : "#9a8f7e",
              }}
            >
              {mode ? "Listen" : "Timer"}
            </button>
          ))}
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2520] text-[#b0a090] transition-all text-xs font-mono"
          style={{}}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2a2520";
            e.currentTarget.style.color = "#9a8f7e";
          }}
        >
          <X size={13} strokeWidth={2} /> Exit <span className="opacity-50">Esc</span>
        </button>
      </div>

      {/* ── MAIN ── */}
      {/* Scroll container; inner m-auto block stays centred but remains reachable
          when content is taller than the viewport (justify-center would clip the top). */}
      <div className="flex-1 flex flex-col relative z-10 px-6 py-6 overflow-y-auto">
        <div className="m-auto w-full flex flex-col items-center gap-6">
        {/* Task selector */}
        {!listenMode && (
        <div className="w-full max-w-md">
          {linkedTodo ? (
            <div
              className="flex items-center gap-3 rounded-2xl px-5 py-3"
              style={{
                background: "#1a1410",
                border: "1px solid rgba(var(--accent-rgb),0.30)",
              }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: "var(--accent)", color: "var(--accent-on)" }}
              />
              <p className="flex-1 text-[#e8ddd0] text-sm font-medium truncate">
                {linkedTodo.text}
              </p>
              <button
                onClick={() => setLinkedTask(null)}
                aria-label="Unlink task from this session"
                className="text-[#8f8272] hover:text-[#b0a090] text-xs transition-colors shrink-0"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <select aria-label="Link a task to this session"
              value=""
              onChange={(e) => setLinkedTask(e.target.value)}
              className="w-full bg-[#1a1410] border border-[#2a2520] rounded-2xl px-5 py-3 text-sm text-[#8f8272] outline-none transition-colors appearance-none cursor-pointer"
              style={{}}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2520")}
            >
              <option value="" disabled>
                Pick a task to focus on...
              </option>
              {pendingTodos.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.tag}] {t.text}
                </option>
              ))}
            </select>
          )}
        </div>
        )}

        {/* ── LISTEN MODE: album art is the hero ──
            Reuses the same bass-reactive glow already painting the backdrop via
            bgGlowRef; no second render loop. */}
        {listenMode && music.currentTrack && (
          <div className="flex flex-col items-center gap-5 w-full">
            <div
              // No glow around the artwork on purpose — the background ambient
              // glow is the only light source in Listen mode. Removed on request
              // while chasing a band at the top of the screen.
              className="rounded-3xl overflow-hidden bg-[#2a2520] w-[min(70vw,340px)] aspect-square"
            >
              {music.currentTrack.cover ? (
                <Image
                  src={music.currentTrack.cover}
                  alt=""
                  width={340}
                  height={340}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl text-[#8f8272]">
                  <Music2 size={22} strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="text-center px-6 max-w-md">
              <h2 className="font-serif italic text-2xl text-white leading-snug">
                {music.currentTrack.title}
              </h2>
              <p className="text-sm text-[#b0a090] mt-1">
                {music.currentTrack.artist}
              </p>
            </div>

            {/* No timer here on purpose — Listen mode is just the music. Switch
                to Timer with the header toggle to run a Pomodoro. A completing
                session still chimes, so it isn't silently lost. */}
          </div>
        )}

        {/* Listen mode with no track loaded — say what this is and what to do,
            never a blank screen (contract §10). */}
        {listenMode && !music.currentTrack && (
          <div className="text-center px-6 max-w-sm">
            <div className="text-4xl mb-3" aria-hidden="true">
              <Music2 size={22} strokeWidth={1.5} />
            </div>
            <p className="text-sm text-[#b0a090] leading-relaxed">
              Nothing playing yet. Start a track from the Music panel and it&apos;ll
              fill the screen here, glowing along to the beat.
            </p>
            <button
              onClick={toggleListenMode}
              className="mt-4 px-4 py-2 rounded-xl border border-[#2a2520] text-[11px] font-mono text-[#b0a090] hover:border-(--accent) hover:text-(--accent) transition-colors"
            >
              Back to Timer
            </button>
          </div>
        )}

        {/* Timer circle */}
        {!listenMode && (
        <div className="relative">
          <svg className="-rotate-90" width="220" height="220" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={r} fill="none" stroke="#1e1b17" strokeWidth="8" />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={timerColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-4xl font-bold text-white tracking-tight leading-none">
              {pomMin}:{pomSec}
            </span>
            <span
              className="text-xs font-mono uppercase tracking-[3px] mt-2"
              style={{ color: timerColor }}
            >
              {pomMode === "focus" ? "Focus" : "Break"}
            </span>
            {/* Subtle duration info */}
            <span className="text-[10px] font-mono text-[#8f8272] mt-1">
              {pomSettings.focusMins}m focus · {pomSettings.shortMins}m break
            </span>
          </div>
        </div>
        )}

        {/* Timer controls */}
        {!listenMode && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              setPomRunning(false);
              setPomMode("focus");
              setPomSeconds(pomSettings.focusMins * 60);
            }}
            aria-label="Reset timer"
            className="w-12 h-12 rounded-2xl border border-[#2a2520] text-[#8f8272] transition-all flex items-center justify-center"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2520";
              e.currentTarget.style.color = "#4a4038";
            }}
          >
            <RotateCcw size={18} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setPomRunning((v) => !v)}
            className="px-12 h-12 rounded-2xl font-bold text-white text-sm uppercase tracking-widest transition-all hover:opacity-90"
            style={{ background: timerColor }}
          >
            {pomRunning
              ? "Pause"
              : pomSeconds === pomTotal
              ? "Start"
              : "Resume"}
          </button>
          <button
            onClick={() => {
              setPomRunning(false);
              const next = pomMode === "focus" ? "break" : "focus";
              setPomMode(next);
              setPomSeconds(next === "focus" ? pomSettings.focusMins * 60 : pomSettings.shortMins * 60);
            }}
            className="w-12 h-12 rounded-2xl border border-[#2a2520] text-[#8f8272] transition-all flex items-center justify-center"
            title="Skip"
            aria-label="Skip to next session"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2520";
              e.currentTarget.style.color = "#4a4038";
            }}
          >
            <SkipForward size={18} strokeWidth={1.75} fill="currentColor" />
          </button>
        </div>
        )}

        {/* Pomodoro presets — compact pills */}
        {!listenMode && (
        <div className="flex gap-2 flex-wrap justify-center">
          {PRESETS.map((preset) => {
            const isActive =
              pomSettings.focusMins === preset.focusMins &&
              pomSettings.shortMins === preset.shortMins;
            return (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className="px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all"
                style={{
                  background: isActive ? "rgba(var(--accent-rgb),0.18)" : "rgba(255,255,255,0.05)",
                  border: isActive ? "1px solid rgba(var(--accent-rgb),0.45)" : "1px solid rgba(255,255,255,0.08)",
                  color: isActive ? "var(--accent-text)" : "#9a8f7e",
                }}
              >
                {preset.label}
                <span className="ml-1.5 opacity-60">{preset.focusMins}m</span>
              </button>
            );
          })}
        </div>
        )}

        {/* Mini music player — in Listen mode the art above is the hero, so this
            stays purely as the transport strip. */}
        {music.currentTrack && (
          <div className="w-full max-w-lg bg-[#1a1410] border border-[#2a2520] rounded-2xl px-4 py-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[#2a2520]"
              style={{
                boxShadow: music.isPlaying
                  ? "0 0 12px rgba(var(--accent-rgb),0.4)"
                  : "none",
                transition: "box-shadow 0.3s",
              }}
            >
              {music.currentTrack.cover ? (
                <Image
                  src={music.currentTrack.cover}
                  alt=""
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#8f8272]">
                  <Music2 size={22} strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#e8ddd0] truncate leading-tight">
                {music.currentTrack.title}
              </p>
              <p className="text-[10px] text-[#8f8272] font-mono truncate">
                {music.currentTrack.artist}
              </p>
              {/* Seekable — was a plain div, so the bar showed progress but you
                  couldn't scrub. Same control MiniPlayer uses. */}
              <input
                type="range"
                min={0}
                max={music.duration || 100}
                step={0.5}
                value={music.progress}
                onChange={(e) => music.handleSeek(parseFloat(e.target.value))}
                aria-label="Seek"
                className="w-full h-0.5 rounded-full appearance-none cursor-pointer mt-1.5"
                style={{
                  background: `linear-gradient(to right, var(--accent) ${
                    music.duration > 0 ? (music.progress / music.duration) * 100 : 0
                  }%, #2a2520 ${
                    music.duration > 0 ? (music.progress / music.duration) * 100 : 0
                  }%)`,
                  accentColor: "var(--accent)",
                }}
              />
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] font-mono text-[#8f8272]">
                  {music.formatTime(music.progress)}
                </span>
                <span className="text-[9px] font-mono text-[#8f8272]">
                  {music.formatTime(music.duration)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={music.toggleShuffle}
                aria-label="Shuffle"
                aria-pressed={music.shuffle}
                title="Shuffle"
                className="w-7 h-7 flex items-center justify-center transition-colors"
                style={{ color: music.shuffle ? "var(--accent-text)" : "#4a4038" }}
              >
                <Shuffle size={16} strokeWidth={1.75} />
              </button>
              <button
                onClick={music.prevTrack}
                aria-label="Previous track"
                className="w-7 h-7 flex items-center justify-center text-[#8f8272] hover:text-white transition-colors"
              >
                <SkipBack size={16} strokeWidth={1.75} fill="currentColor" />
              </button>
              <button
                onClick={music.togglePlay}
                aria-label={music.isPlaying ? "Pause" : "Play"}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors"
                style={{ background: "var(--accent)", color: "var(--accent-on)" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {music.isPlaying ? (
                  <Pause size={16} strokeWidth={1.75} fill="currentColor" />
                ) : (
                  <Play size={16} strokeWidth={1.75} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                onClick={music.nextTrack}
                aria-label="Next track"
                className="w-7 h-7 flex items-center justify-center text-[#8f8272] hover:text-white transition-colors"
              >
                <SkipForward size={16} strokeWidth={1.75} fill="currentColor" />
              </button>
              <button
                onClick={music.cycleRepeat}
                aria-label={`Repeat: ${music.repeat === "none" ? "off" : music.repeat === "all" ? "all tracks" : "this track"}`}
                title={`Repeat: ${music.repeat}`}
                className="w-7 h-7 flex items-center justify-center transition-colors"
                style={{
                  color: music.repeat !== "none" ? "var(--accent-text)" : "#4a4038",
                }}
              >
                {music.repeat === "one" ? (
                  <Repeat1 size={16} strokeWidth={1.75} />
                ) : (
                  <Repeat size={16} strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Sticky notes float above everything */}
      <div className="fixed inset-0 pointer-events-none z-110">
        <div className="relative w-full h-full pointer-events-none">
          {stickyNotes.map((note) => (
            <div key={note.id} className="pointer-events-auto">
              <StickyNote
                note={note}
                onUpdate={handleStickyUpdate}
                onDelete={handleStickyDelete}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
