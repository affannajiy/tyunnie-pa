// components/Pomodoro.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getTodos, type Todo } from "@/lib/database";

type Mode = "focus" | "short" | "long";

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const MODE_LABELS: Record<Mode, string> = {
  focus: "Focus",
  short: "Short Break",
  long: "Long Break",
};

const MODE_COLORS: Record<Mode, string> = {
  focus: "#f97316",
  short: "#16a34a",
  long: "#3b82f6",
};

type Props = {
  userId: string;
  initialTask?: string;
};

export default function Pomodoro({ userId, initialTask }: Props) {
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [linkedTask, setLinkedTask] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleDone = useCallback(() => {
    // ── ALERT SOUND ──
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
      // Three ascending tones — classic Pomodoro done sound
      playBeep(523, 0, 0.15); // C5
      playBeep(659, 0.18, 0.15); // E5
      playBeep(784, 0.36, 0.3); // G5
    } catch {
      /* ignore if audio context blocked */
    }

    setRunning(false);
    setShowDone(true);
    setTimeout(() => setShowDone(false), 4000);

    if (mode === "focus") {
      const next = sessions + 1;
      setSessions(next);
      // Every 4 sessions → long break, else short break
      const nextMode: Mode = next % 4 === 0 ? "long" : "short";
      setMode(nextMode);
      setSecondsLeft(DURATIONS[nextMode]);
    } else {
      setMode("focus");
      setSecondsLeft(DURATIONS.focus);
    }
  }, [mode, sessions]);

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

  function switchMode(m: Mode) {
    setRunning(false);
    setMode(m);
    setSecondsLeft(DURATIONS[m]);
    setShowDone(false);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(DURATIONS[mode]);
    setShowDone(false);
  }

  const total = DURATIONS[mode];
  const progress = (secondsLeft / total) * 100;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const color = MODE_COLORS[mode];

  // SVG circle
  const r = 88;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;

  const linkedTodo = todos.find((t) => t.id === linkedTask);

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
            {/* Track */}
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="#e8e2d8"
              strokeWidth="8"
            />
            {/* Progress */}
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

          {/* Time display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-5xl font-bold text-[#111010] tracking-tight">
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
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full transition-all"
              style={{
                background: i < sessions % 4 ? color : "#e8e2d8",
              }}
            />
          ))}
        </div>
        <p className="text-[10px] font-mono text-[#9a8f7e] mt-1">
          {sessions} session{sessions !== 1 ? "s" : ""} completed
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
            : secondsLeft === DURATIONS[mode]
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

      {/* Done banner */}
      {showDone && (
        <div
          className="mb-5 rounded-2xl px-4 py-3 text-center text-sm font-bold text-white"
          style={{ background: color, animation: "fadeIn 0.3s ease" }}
        >
          {mode === "focus"
            ? "🧡 Nice work! Take a break."
            : "💪 Break's over — back to it!"}
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
