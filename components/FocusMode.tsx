"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";
import type { Todo, StickyNote as StickyNoteType } from "@/lib/database";
import StickyNote from "@/components/StickyNote";
import { updateStickyNote, deleteStickyNote } from "@/lib/database";

type PomSettings = { focusMins: number; shortMins: number };

type Preset = { label: string; focusMins: number; shortMins: number };

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
    const rgb = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-rgb").trim() || "249,115,22";

    if (!music.isPlaying || !music.analyser?.current) {
      if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current);
      glowRafRef.current = null;
      if (bgGlowRef.current) {
        bgGlowRef.current.style.background =
          "radial-gradient(ellipse at 50% 80%, rgba(" + rgb + ",0.12) 0%, transparent 60%)";
      }
      return;
    }

    const dataArray = new Uint8Array(music.analyser.current.frequencyBinCount);

    function tick() {
      if (!music.analyser?.current || !bgGlowRef.current) return;
      music.analyser.current.getByteFrequencyData(dataArray);
      // Sample low-frequency bins (bass) for beat detection
      const bassSlice = dataArray.slice(0, 12);
      const avg = bassSlice.reduce((a, b) => a + b, 0) / bassSlice.length;
      const g = avg / 255; // 0–1 normalised
      // Glow grows from ~30% to ~90% radius, opacity from 0.08 to 0.55
      const radius = Math.round(30 + g * 60);
      const opacity = (0.08 + g * 0.47).toFixed(3);
      bgGlowRef.current.style.background =
        `radial-gradient(ellipse at 50% 80%, rgba(${rgb},${opacity}) 0%, transparent ${radius}%)`;
      glowRafRef.current = requestAnimationFrame(tick);
    }

    glowRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current);
      glowRafRef.current = null;
    };
  }, [music.isPlaying, music.analyser]);

  // ── Timer display ──
  const pomMin = Math.floor(pomSeconds / 60).toString().padStart(2, "0");
  const pomSec = (pomSeconds % 60).toString().padStart(2, "0");
  const pomTotal = pomMode === "focus" ? pomSettings.focusMins * 60 : pomSettings.shortMins * 60;
  const pomPct = ((pomTotal - pomSeconds) / pomTotal) * 100;

  const r = 88;
  const circ = 2 * Math.PI * r;
  const dash = (pomPct / 100) * circ;
  const timerColor = pomMode === "focus" ? "var(--accent)" : "#16a34a";

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
      className="fixed inset-0 z-100 flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0e0b08 0%, #111010 100%)" }}
    >
      {/* Music-reactive ambient glow — written directly via bgGlowRef */}
      <div
        ref={bgGlowRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 80%, rgba(var(--accent-rgb),0.12) 0%, transparent 60%)",
          transition: "background 0.08s linear",
        }}
      />

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "var(--accent)" }}
          />
          <span
            className="text-[10px] font-mono font-bold uppercase tracking-[3px] opacity-70"
            style={{ color: "var(--accent)" }}
          >
            Focus Mode
          </span>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2520] text-[#9a8f7e] transition-all text-xs font-mono"
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
          ✕ Exit <span className="opacity-50">Esc</span>
        </button>
      </div>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 relative z-10 px-6 overflow-y-auto">
        {/* Task selector */}
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
                style={{ background: "var(--accent)" }}
              />
              <p className="flex-1 text-[#e8ddd0] text-sm font-medium truncate">
                {linkedTodo.text}
              </p>
              <button
                onClick={() => setLinkedTask(null)}
                className="text-[#4a4038] hover:text-[#9a8f7e] text-xs transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
          ) : (
            <select
              value=""
              onChange={(e) => setLinkedTask(e.target.value)}
              className="w-full bg-[#1a1410] border border-[#2a2520] rounded-2xl px-5 py-3 text-sm text-[#4a4038] outline-none transition-colors appearance-none cursor-pointer"
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

        {/* Timer circle */}
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
            <span className="text-[10px] font-mono text-[#4a4038] mt-1">
              {pomSettings.focusMins}m focus · {pomSettings.shortMins}m break
            </span>
          </div>
        </div>

        {/* Timer controls */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setPomRunning(false);
              setPomMode("focus");
              setPomSeconds(pomSettings.focusMins * 60);
            }}
            className="w-12 h-12 rounded-2xl border border-[#2a2520] text-[#4a4038] transition-all text-lg flex items-center justify-center"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2520";
              e.currentTarget.style.color = "#4a4038";
            }}
          >
            ↺
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
            className="w-12 h-12 rounded-2xl border border-[#2a2520] text-[#4a4038] transition-all text-lg flex items-center justify-center"
            title="Skip"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2520";
              e.currentTarget.style.color = "#4a4038";
            }}
          >
            ⏭
          </button>
        </div>

        {/* Pomodoro presets — compact pills */}
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
                  color: isActive ? "var(--accent)" : "#9a8f7e",
                }}
              >
                {preset.label}
                <span className="ml-1.5 opacity-60">{preset.focusMins}m</span>
              </button>
            );
          })}
        </div>

        {/* Mini music player */}
        {music.currentTrack && (
          <div className="w-full max-w-md bg-[#1a1410] border border-[#2a2520] rounded-2xl px-4 py-3 flex items-center gap-3">
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
                <div className="w-full h-full flex items-center justify-center text-[#4a4038]">
                  🎵
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#e8ddd0] truncate leading-tight">
                {music.currentTrack.title}
              </p>
              <p className="text-[10px] text-[#4a4038] font-mono truncate">
                {music.currentTrack.artist}
              </p>
              <div className="h-0.5 bg-[#2a2520] rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${music.duration > 0 ? (music.progress / music.duration) * 100 : 0}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={music.prevTrack}
                className="w-7 h-7 flex items-center justify-center text-[#4a4038] hover:text-white transition-colors text-xs"
              >
                ⏮
              </button>
              <button
                onClick={music.togglePlay}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs transition-colors"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {music.isPlaying ? "⏸" : "▶"}
              </button>
              <button
                onClick={music.nextTrack}
                className="w-7 h-7 flex items-center justify-center text-[#4a4038] hover:text-white transition-colors text-xs"
              >
                ⏭
              </button>
            </div>
          </div>
        )}
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
