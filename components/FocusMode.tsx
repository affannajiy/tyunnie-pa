"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";
import type { Todo, StickyNote as StickyNoteType } from "@/lib/database";
import StickyNote from "@/components/StickyNote";
import { updateStickyNote, deleteStickyNote } from "@/lib/database";

type Props = {
  todos: Todo[];
  stickyNotes: StickyNoteType[];
  onStickyNotesChange: (notes: StickyNoteType[]) => void;
  onExit: () => void;
};

export default function FocusMode({
  todos,
  stickyNotes,
  onStickyNotesChange,
  onExit,
}: Props) {
  const music = useMusicContext();
  const [linkedTask, setLinkedTask] = useState<string | null>(null);
  const [pomRunning, setPomRunning] = useState(false);
  const [pomSeconds, setPomSeconds] = useState(25 * 60);
  const [pomMode, setPomMode] = useState<"focus" | "break">("focus");
  const pomRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingTodos = todos.filter((t) => !t.done);
  const linkedTodo = pendingTodos.find((t) => t.id === linkedTask);

  // Esc to exit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // Pomodoro
  useEffect(() => {
    if (pomRunning) {
      pomRef.current = setInterval(() => {
        setPomSeconds((s) => {
          if (s <= 1) {
            clearInterval(pomRef.current!);
            setPomRunning(false);
            // Alert sound
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
                gain.gain.exponentialRampToValueAtTime(
                  0.001,
                  ctx.currentTime + start + dur,
                );
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + dur);
              };
              playBeep(523, 0, 0.15);
              playBeep(659, 0.18, 0.15);
              playBeep(784, 0.36, 0.3);
            } catch {}
            const next = pomMode === "focus" ? "break" : "focus";
            setPomMode(next);
            setPomSeconds(next === "focus" ? 25 * 60 : 5 * 60);
            return next === "focus" ? 25 * 60 : 5 * 60;
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
  }, [pomRunning, pomMode]);

  const pomMin = Math.floor(pomSeconds / 60)
    .toString()
    .padStart(2, "0");
  const pomSec = (pomSeconds % 60).toString().padStart(2, "0");
  const pomPct =
    pomMode === "focus"
      ? ((25 * 60 - pomSeconds) / (25 * 60)) * 100
      : ((5 * 60 - pomSeconds) / (5 * 60)) * 100;

  const r = 88;
  const circ = 2 * Math.PI * r;
  const dash = (pomPct / 100) * circ;
  const color = pomMode === "focus" ? "#f97316" : "#16a34a";

  async function handleStickyUpdate(
    id: string,
    patch: Partial<StickyNoteType>,
  ) {
    await updateStickyNote(id, patch);
    onStickyNotesChange(
      stickyNotes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
  }

  async function handleStickyDelete(id: string) {
    await deleteStickyNote(id);
    onStickyNotesChange(stickyNotes.filter((n) => n.id !== id));
  }

  return (
    <div
      className="fixed inset-0 z-100 flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #0e0b08 0%, #111010 100%)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 80%, rgba(249,115,22,0.12) 0%, transparent 60%)",
        }}
      />

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[3px] text-[#f97316] opacity-70">
            Focus Mode
          </span>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2a2520] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all text-xs font-mono"
        >
          ✕ Exit <span className="opacity-50">Esc</span>
        </button>
      </div>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 relative z-10 px-6">
        {/* Task selector */}
        <div className="w-full max-w-md">
          {linkedTodo ? (
            <div className="flex items-center gap-3 bg-[#1a1410] border border-[#f97316]/30 rounded-2xl px-5 py-3">
              <div className="w-2 h-2 rounded-full bg-[#f97316] shrink-0" />
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
              className="w-full bg-[#1a1410] border border-[#2a2520] rounded-2xl px-5 py-3 text-sm text-[#4a4038] outline-none focus:border-[#f97316] transition-colors appearance-none cursor-pointer"
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
          <svg
            className="-rotate-90"
            width="220"
            height="220"
            viewBox="0 0 200 200"
          >
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="#1e1b17"
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
            <span className="font-mono text-6xl font-bold text-white tracking-tight leading-none">
              {pomMin}:{pomSec}
            </span>
            <span
              className="text-xs font-mono uppercase tracking-[3px] mt-2"
              style={{ color }}
            >
              {pomMode === "focus" ? "Focus" : "Break"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setPomRunning(false);
              setPomMode("focus");
              setPomSeconds(25 * 60);
            }}
            className="w-12 h-12 rounded-2xl border border-[#2a2520] text-[#4a4038] hover:border-[#f97316] hover:text-[#f97316] transition-all text-lg flex items-center justify-center"
          >
            ↺
          </button>
          <button
            onClick={() => setPomRunning((r) => !r)}
            className="px-12 h-12 rounded-2xl font-bold text-white text-sm uppercase tracking-widest transition-all hover:opacity-90"
            style={{ background: color }}
          >
            {pomRunning
              ? "Pause"
              : pomSeconds === (pomMode === "focus" ? 25 * 60 : 5 * 60)
                ? "Start"
                : "Resume"}
          </button>
          <button
            onClick={() => {
              setPomRunning(false);
              const next = pomMode === "focus" ? "break" : "focus";
              setPomMode(next);
              setPomSeconds(next === "focus" ? 25 * 60 : 5 * 60);
            }}
            className="w-12 h-12 rounded-2xl border border-[#2a2520] text-[#4a4038] hover:border-[#f97316] hover:text-[#f97316] transition-all text-lg flex items-center justify-center"
            title="Skip"
          >
            ⏭
          </button>
        </div>

        {/* Mini music player */}
        {music.currentTrack && (
          <div className="w-full max-w-md bg-[#1a1410] border border-[#2a2520] rounded-2xl px-4 py-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[#2a2520]"
              style={{
                boxShadow: music.isPlaying
                  ? "0 0 12px rgba(249,115,22,0.4)"
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
                  className="h-full bg-[#f97316] rounded-full transition-all"
                  style={{
                    width: `${music.duration > 0 ? (music.progress / music.duration) * 100 : 0}%`,
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
                className="w-8 h-8 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs hover:bg-[#c2500f] transition-colors"
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
