// components/Pomodoro.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getTodos, type Todo } from "@/lib/database";

type Mode = "focus" | "short" | "long";

const MODE_LABELS: Record<Mode, string> = {
  focus: "Focus",
  short: "Short Break",
  long: "Long Break",
};

const MODE_COLORS: Record<Mode, string> = {
  focus: "var(--accent)",
  short: "#16a34a",
  long: "#3b82f6",
};

// ── Settings ──────────────────────────────────────────────────────────────────

const SETTINGS_KEY = "tyunnie_pomodoro_settings";

interface PomSettings {
  focusMins: number;
  shortMins: number;
  longMins: number;
  longAfter: number; // sessions before long break
}

const DEFAULT_SETTINGS: PomSettings = {
  focusMins: 25,
  shortMins: 5,
  longMins: 15,
  longAfter: 4,
};

const PRESETS: { label: string; settings: Omit<PomSettings, "longAfter"> }[] = [
  { label: "Classic",      settings: { focusMins: 25, shortMins: 5,  longMins: 15 } },
  { label: "Extended",     settings: { focusMins: 50, shortMins: 10, longMins: 30 } },
  { label: "Short Sprint", settings: { focusMins: 15, shortMins: 3,  longMins: 10 } },
  { label: "Deep Work",    settings: { focusMins: 90, shortMins: 15, longMins: 30 } },
];

function loadSettings(): PomSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PomSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: PomSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("tyunnie-pomodoro-settings-changed"));
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  userId: string;
  initialTask?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function Pomodoro({ userId, initialTask }: Props) {
  // Settings
  const [settings, setSettings] = useState<PomSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [draftSettings, setDraftSettings] = useState<PomSettings>(DEFAULT_SETTINGS);

  // Timer
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SETTINGS.focusMins * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);

  // Tasks
  const [todos, setTodos] = useState<Todo[]>([]);
  const [linkedTask, setLinkedTask] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive durations from settings
  const durations: Record<Mode, number> = {
    focus: settings.focusMins * 60,
    short: settings.shortMins * 60,
    long: settings.longMins * 60,
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setDraftSettings(s);
    setSecondsLeft(s.focusMins * 60);
  }, []);

  // ── AGENTIC PRESET LISTENER ──
  useEffect(() => {
    const PRESET_KEY: Record<string, number> = { classic: 0, extended: 1, short_sprint: 2, deep_work: 3 };
    const PRESET_LONG_AFTER: Record<string, number> = { classic: 4, extended: 4, short_sprint: 4, deep_work: 3 };
    const handler = (e: Event) => {
      const { preset } = (e as CustomEvent).detail as { preset: string };
      const idx = PRESET_KEY[preset];
      if (idx === undefined) return;
      const p = PRESETS[idx];
      const next: PomSettings = { ...p.settings, longAfter: PRESET_LONG_AFTER[preset] ?? 4 };
      setSettings(next);
      setDraftSettings(next);
      saveSettings(next);
      setRunning(false);
      setMode("focus");
      setSecondsLeft(next.focusMins * 60);
      setShowDone(false);
    };
    window.addEventListener("tyunnie-pomodoro-preset", handler);
    return () => window.removeEventListener("tyunnie-pomodoro-preset", handler);
  }, []);

  // Load pending todos for task linking
  useEffect(() => {
    getTodos(userId).then((data) => {
      const pending = data.filter((t) => !t.done);
      setTodos(pending);
      const shouldStart = sessionStorage.getItem("pomodoro_autostart") === "1";
      if (initialTask) {
        const match = pending.find((t) =>
          t.text.toLowerCase().includes(initialTask.toLowerCase()),
        );
        if (match) setLinkedTask(match.id);
      }
      if (shouldStart) {
        sessionStorage.removeItem("pomodoro_autostart");
        setRunning(true);
      }
    });
  }, [userId]);

  // ── Timer done handler ────────────────────────────────────────────────────────

  const handleDone = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + start + duration,
        );
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playBeep(523, 0, 0.15);
      playBeep(659, 0.18, 0.15);
      playBeep(784, 0.36, 0.3);
    } catch {
      /* ignore if audio context blocked */
    }

    setRunning(false);
    setShowDone(true);
    setTimeout(() => setShowDone(false), 4000);

    if (mode === "focus") {
      const next = sessions + 1;
      setSessions(next);
      const nextMode: Mode = next % settings.longAfter === 0 ? "long" : "short";
      setMode(nextMode);
      setSecondsLeft(
        nextMode === "long"
          ? settings.longMins * 60
          : settings.shortMins * 60,
      );
    } else {
      setMode("focus");
      setSecondsLeft(settings.focusMins * 60);
    }
  }, [mode, sessions, settings]);

  // ── Interval ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleDone();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, handleDone]);

  // ── Mode switching / reset ────────────────────────────────────────────────────

  function switchMode(m: Mode) {
    setRunning(false);
    setMode(m);
    setSecondsLeft(durations[m]);
    setShowDone(false);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(durations[mode]);
    setShowDone(false);
  }

  // ── Settings handlers ─────────────────────────────────────────────────────────

  function openSettings() {
    setDraftSettings(settings);
    setShowSettings(true);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setDraftSettings((d) => ({ ...d, ...preset.settings }));
  }

  function clampMins(val: number, min = 1, max = 180): number {
    return Math.max(min, Math.min(max, Math.round(val)));
  }

  function commitSettings() {
    const next: PomSettings = {
      focusMins: clampMins(draftSettings.focusMins),
      shortMins: clampMins(draftSettings.shortMins),
      longMins: clampMins(draftSettings.longMins),
      longAfter: Math.max(1, Math.min(8, Math.round(draftSettings.longAfter))),
    };
    setSettings(next);
    saveSettings(next);
    setShowSettings(false);
    // Reset timer to new focus duration
    setRunning(false);
    setMode("focus");
    setSecondsLeft(next.focusMins * 60);
    setShowDone(false);
  }

  function cancelSettings() {
    setDraftSettings(settings);
    setShowSettings(false);
  }

  // ── Display values ────────────────────────────────────────────────────────────

  const total = durations[mode];
  const progress = (secondsLeft / total) * 100;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const color = MODE_COLORS[mode];

  const r = 88;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;

  const linkedTodo = todos.find((t) => t.id === linkedTask);

  // ── Stepper helper ────────────────────────────────────────────────────────────

  function Stepper({
    label,
    value,
    onChange,
    min = 1,
    max = 180,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
  }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[#6b5e52] font-medium flex-1">{label}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            className="w-7 h-7 rounded-lg border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all text-sm font-bold flex items-center justify-center"
          >
            −
          </button>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(clampMins(Number(e.target.value), min, max))}
            className="w-12 h-7 rounded-lg border border-[#e8e2d8] text-center text-xs font-mono font-bold text-[#111010] bg-white outline-none focus:border-[#f97316] transition-colors"
          />
          <span className="text-[10px] text-[#9a8f7e] font-mono w-5">min</span>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            className="w-7 h-7 rounded-lg border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all text-sm font-bold flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {(["focus", "short", "long"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              mode === m
                ? "text-white"
                : "bg-white border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]"
            }`}
            style={mode === m ? { background: color } : {}}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative w-56 h-56">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="#e8e2d8"
              strokeWidth="8"
            />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              className="transition-all duration-1000"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl font-bold text-[#111010] tracking-tight">
              {mins}:{secs}
            </span>
            <span
              className="text-xs font-bold uppercase tracking-widest mt-1 font-mono"
              style={{ color }}
            >
              {MODE_LABELS[mode]}
            </span>
          </div>
        </div>

        {/* Session dots */}
        <div className="flex gap-2 mt-4">
          {Array.from({ length: settings.longAfter }).map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full transition-all"
              style={{
                background: i < sessions % settings.longAfter ? color : "#e8e2d8",
              }}
            />
          ))}
        </div>
        <p className="text-[10px] font-mono text-[#9a8f7e] mt-1">
          {sessions} session{sessions !== 1 ? "s" : ""} completed
          {" · "}long break every {settings.longAfter}
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-3 justify-center mb-6">
        <button
          onClick={reset}
          className="w-12 h-12 rounded-2xl border border-[#e8e2d8] bg-white text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all text-lg flex items-center justify-center"
        >
          ↺
        </button>
        <button
          onClick={() => setRunning((r) => !r)}
          className="px-10 h-12 rounded-2xl font-bold text-white text-sm uppercase tracking-widest transition-all hover:opacity-90 hover:-translate-y-px"
          style={{ background: color }}
        >
          {running
            ? "Pause"
            : secondsLeft === durations[mode]
              ? "Start"
              : "Resume"}
        </button>
        <button
          onClick={() => switchMode(mode === "focus" ? "short" : "focus")}
          className="w-12 h-12 rounded-2xl border border-[#e8e2d8] bg-white text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all text-lg flex items-center justify-center"
          title="Skip"
        >
          ⏭
        </button>
      </div>

      {/* Settings toggle */}
      <div className="mb-5">
        <button
          onClick={showSettings ? cancelSettings : openSettings}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-[#e8e2d8] bg-white text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all text-xs font-bold uppercase tracking-widest"
        >
          <span>Timer Settings</span>
          <span
            className="transition-transform duration-200"
            style={{ transform: showSettings ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </button>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-2 bg-white border border-[#e8e2d8] rounded-2xl p-5 space-y-5">
            {/* Presets */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono mb-3">
                Presets
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => {
                  const active =
                    draftSettings.focusMins === p.settings.focusMins &&
                    draftSettings.shortMins === p.settings.shortMins &&
                    draftSettings.longMins === p.settings.longMins;
                  return (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left ${
                        active
                          ? "text-white"
                          : "border border-[#e8e2d8] text-[#6b5e52] hover:border-[#f97316] hover:text-[#f97316]"
                      }`}
                      style={active ? { background: "var(--accent)" } : {}}
                    >
                      <p className="font-bold">{p.label}</p>
                      <p
                        className={`text-[9px] font-mono mt-0.5 ${active ? "opacity-80" : "text-[#9a8f7e]"}`}
                      >
                        {p.settings.focusMins}/{p.settings.shortMins}/{p.settings.longMins}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration steppers */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono mb-3">
                Durations
              </p>
              <div className="space-y-3">
                <Stepper
                  label="Focus"
                  value={draftSettings.focusMins}
                  onChange={(v) => setDraftSettings((d) => ({ ...d, focusMins: v }))}
                />
                <Stepper
                  label="Short Break"
                  value={draftSettings.shortMins}
                  onChange={(v) => setDraftSettings((d) => ({ ...d, shortMins: v }))}
                />
                <Stepper
                  label="Long Break"
                  value={draftSettings.longMins}
                  onChange={(v) => setDraftSettings((d) => ({ ...d, longMins: v }))}
                />
              </div>
            </div>

            {/* Long break interval */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono mb-3">
                Long Break Interval
              </p>
              <Stepper
                label="Sessions before long break"
                value={draftSettings.longAfter}
                onChange={(v) => setDraftSettings((d) => ({ ...d, longAfter: v }))}
                min={1}
                max={8}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={cancelSettings}
                className="flex-1 py-2 rounded-xl border border-[#e8e2d8] text-xs font-bold text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={commitSettings}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                style={{ background: "var(--accent)" }}
              >
                Apply & Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Done banner */}
      {showDone && (
        <div
          className="mb-5 rounded-2xl px-4 py-3 text-center text-sm font-bold text-white"
          style={{ background: color, animation: "fadeIn 0.3s ease" }}
        >
          {mode === "focus"
            ? "Nice work. Take a breath."
            : "Break's over — back to it."}
        </div>
      )}

      {/* Task linking */}
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-serif italic text-[#f97316] text-sm">
            Focusing on
          </span>
          <div className="flex-1 h-px bg-[#e8e2d8]" />
        </div>

        {linkedTodo ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#111010] truncate">
              {linkedTodo.text}
            </div>
            <button
              onClick={() => setLinkedTask(null)}
              className="text-[#c5bdb0] hover:text-red-400 transition-colors text-sm shrink-0"
            >
              ✕
            </button>
          </div>
        ) : (
          <select
            value=""
            onChange={(e) => setLinkedTask(e.target.value)}
            className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm text-[#9a8f7e] outline-none focus:border-[#f97316] transition-colors"
          >
            <option value="" disabled>
              Pick a task to focus on...
            </option>
            {todos.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.tag}] {t.text}
              </option>
            ))}
          </select>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
