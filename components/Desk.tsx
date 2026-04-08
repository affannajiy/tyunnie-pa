"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";
import type { Profile, Todo, Project, FinanceEntry } from "@/lib/database";
import type { Panel } from "@/components/Sidebar";

type Props = {
  profile: Profile | null;
  userName: string;
  todos: Todo[];
  projects: Project[];
  finance: FinanceEntry[];
  financeViewMonth: number;
  financeViewYear: number;
  onNavigate: (panel: Panel) => void;
  onTodoToggle: (id: string, done: boolean) => void;
};

function getGreeting(name: string) {
  const hour = new Date().getHours();
  const time =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : hour < 21
          ? "Good evening"
          : "Hey";
  return `${time}, ${name || "there"}`;
}

function CircularProgress({
  value,
  size = 64,
  stroke = 5,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#F0EAE2"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f97316"
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
}

export default function Desk({
  profile,
  userName,
  todos,
  projects,
  finance,
  financeViewMonth,
  financeViewYear,
  onNavigate,
  onTodoToggle,
}: Props) {
  const music = useMusicContext();
  const [oneliner, setOneliner] = useState<string | null>(null);

  // Pomodoro
  const [pomRunning, setPomRunning] = useState(false);
  const [pomSeconds, setPomSeconds] = useState(25 * 60);
  const [pomMode, setPomMode] = useState<"focus" | "break">("focus");
  const pomRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pomRunning) {
      pomRef.current = setInterval(() => {
        setPomSeconds((s) => {
          if (s <= 1) {
            clearInterval(pomRef.current!);
            setPomRunning(false);
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

  // AI one-liner — sessionStorage cached
  useEffect(() => {
    const cached = sessionStorage.getItem("desk_oneliner");
    if (cached) {
      setOneliner(cached);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const pendingCount = todos.filter((t) => !t.done).length;
    const overdueCount = todos.filter(
      (t) => !t.done && t.due && t.due < today,
    ).length;
    const balance =
      finance
        .filter((f) => f.type === "income")
        .reduce((s, f) => s + f.amount, 0) -
      finance
        .filter((f) => f.type === "expense")
        .reduce((s, f) => s + f.amount, 0);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "desk oneliner" }],
        systemPrompt: `You are Tyunnie, warm AI assistant based on Taehyun from TXT. Write ONE short motivational sentence (max 12 words) for the user's day. Be warm, casual, personal. No emojis at start.
Pending tasks: ${pendingCount}, Overdue: ${overdueCount}, Balance: RM${balance.toFixed(2)}, Name: ${profile?.display_name ?? userName ?? ""}
Just one sentence, no quotes, no action blocks.`,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const text = d.text?.trim() ?? null;
        setOneliner(text);
        if (text) sessionStorage.setItem("desk_oneliner", text);
      })
      .catch(() => {});
  }, []);

  // Derived
  const today = new Date().toISOString().split("T")[0];
  const dueSoonTodos = todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    })
    .slice(0, 3);

  const totalTodos = todos.length;
  const doneTodos = todos.filter((t) => t.done).length;
  const todoCompletionPct =
    totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;
  const avgProjectProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((s, p) => s + p.progress, 0) / projects.length,
        )
      : 0;

  const monthIncome = finance
    .filter(
      (f) =>
        f.type === "income" &&
        new Date(f.date).getMonth() === financeViewMonth &&
        new Date(f.date).getFullYear() === financeViewYear,
    )
    .reduce((s, f) => s + f.amount, 0);
  const monthExpenses = finance
    .filter(
      (f) =>
        f.type === "expense" &&
        new Date(f.date).getMonth() === financeViewMonth &&
        new Date(f.date).getFullYear() === financeViewYear,
    )
    .reduce((s, f) => s + f.amount, 0);
  const monthBalance = monthIncome - monthExpenses;
  const currency = profile?.currency ?? "RM";

  const recentActivity = [
    ...todos
      .filter((t) => t.done)
      .slice(0, 2)
      .map((t) => ({
        icon: "✅",
        label: t.text,
        sub: "Task completed",
        color: "bg-green-50 border-green-200",
      })),
    ...finance.slice(0, 2).map((f) => ({
      icon: f.type === "income" ? "💰" : "💸",
      label: f.description,
      sub: `${f.type === "income" ? "+" : "-"}${currency}${f.amount.toFixed(2)}`,
      color:
        f.type === "income"
          ? "bg-orange-50 border-orange-200"
          : "bg-red-50 border-red-200",
    })),
  ].slice(0, 4);

  return (
    <div className="min-h-screen pb-24">
      {/* ── HERO ── */}
      <div
        className="rounded-3xl px-8 py-0 mb-8 flex items-center justify-between gap-6 overflow-hidden relative"
        style={{
          background:
            "linear-gradient(135deg, #fff8f4 0%, #fef3ec 50%, #fdf0e8 100%)",
          border: "1px solid #fde8d8",
          minHeight: "160px",
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #f97316, transparent)",
          }}
        />
        <div
          className="absolute -bottom-4 right-32 w-24 h-24 rounded-full opacity-5"
          style={{
            background: "radial-gradient(circle, #f97316, transparent)",
          }}
        />

        <div className="flex-1 relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[3px] text-[#f97316] opacity-70">
              {new Date().toLocaleDateString("en-MY", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="font-serif italic text-4xl md:text-5xl text-[#1a1208] mb-3 leading-tight">
            {getGreeting(profile?.display_name ?? userName)} 👋
          </h1>
          {oneliner ? (
            <div className="mt-3 text-center md:text-left">
              <p className="text-lg text-[#8a6f5a] font-serif italic leading-relaxed max-w-lg">
                Welcome home 🧡
              </p>
            </div>
          ) : (
            <div className="flex gap-2 mt-2">
              <div className="h-3 w-48 bg-[#f0e8e0] rounded-full animate-pulse" />
              <div className="h-3 w-24 bg-[#f0e8e0] rounded-full animate-pulse" />
            </div>
          )}
        </div>
        <div className="shrink-0 hidden md:block relative z-10 self-end">
          <Image
            src="/sprites/tyun-hero.png"
            alt="Tyunnie"
            width={200}
            height={240}
            className="object-cover object-top hover:scale-105 transition-transform duration-500"
            style={{
              filter: "drop-shadow(0 -4px 20px rgba(249,115,22,0.3))",
              marginBottom: "-2px",
            }}
          />
        </div>
      </div>

      {/* ── QUICK STATS: 4 CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {/* 1. Today's Focus */}
        <div className="bg-white rounded-3xl p-5 border border-[#f0ece8] shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono">
              Today's Focus
            </p>
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-sm">
              ✅
            </div>
          </div>
          {dueSoonTodos.length === 0 ? (
            <p className="text-xs text-[#c5bdb0] italic flex-1 py-2">
              All clear! No tasks due soon.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5 flex-1">
              {dueSoonTodos.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5">
                  <button
                    onClick={() => onTodoToggle(t.id, !t.done)}
                    className="mt-0.5 w-4 h-4 rounded-full border-2 border-[#e8e2d8] hover:border-[#f97316] hover:bg-orange-50 transition-all shrink-0 flex items-center justify-center"
                  >
                    {t.done && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#2a1f15] leading-tight truncate">
                      {t.text}
                    </p>
                    {t.due && (
                      <p
                        className={`text-[9px] font-mono mt-0.5 ${t.due < today ? "text-red-400 font-bold" : t.due === today ? "text-[#f97316] font-bold" : "text-[#b09880]"}`}
                      >
                        {t.due < today
                          ? "⚠ overdue"
                          : t.due === today
                            ? "due today"
                            : t.due}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => onNavigate("todo")}
            className="text-[10px] font-mono text-[#f97316] hover:underline self-start mt-auto pt-1"
          >
            All tasks →
          </button>
        </div>

        {/* 2. Life Progress */}
        <div className="bg-white rounded-3xl p-5 border border-[#f0ece8] shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono">
              Life Progress
            </p>
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-sm">
              📊
            </div>
          </div>
          <div className="flex items-center justify-around">
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <CircularProgress
                  value={todoCompletionPct}
                  size={60}
                  stroke={5}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-[#f97316]">
                    {todoCompletionPct}%
                  </span>
                </div>
              </div>
              <p className="text-[9px] font-mono text-[#b09880] uppercase tracking-wide">
                Tasks
              </p>
              <p className="text-[9px] text-[#b09880]">
                {doneTodos}/{totalTodos}
              </p>
            </div>
            <div className="w-px h-16 bg-[#f0ece8]" />
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <CircularProgress
                  value={avgProjectProgress}
                  size={60}
                  stroke={5}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-[#f97316]">
                    {avgProjectProgress}%
                  </span>
                </div>
              </div>
              <p className="text-[9px] font-mono text-[#b09880] uppercase tracking-wide">
                Projects
              </p>
              <p className="text-[9px] text-[#b09880]">
                {projects.length} active
              </p>
            </div>
          </div>
          <div className="mt-auto pt-3 border-t border-[#f8f4f0]">
            <p className="text-[9px] text-[#b09880] font-mono mb-0.5">
              This month's balance
            </p>
            <p
              className={`text-lg font-bold font-serif ${monthBalance >= 0 ? "text-[#16a34a]" : "text-red-500"}`}
            >
              {monthBalance >= 0 ? "+" : ""}
              {currency}
              {Math.abs(monthBalance).toFixed(2)}
            </p>
          </div>
        </div>

        {/* 3. Pomodoro */}
        <div className="bg-white rounded-3xl p-5 border border-[#f0ece8] shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono">
              Focus Timer
            </p>
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-sm">
              ⏲️
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 flex-1 justify-center">
            <div className="relative">
              <CircularProgress value={pomPct} size={88} stroke={6} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-[#1a1208] font-mono leading-none">
                  {pomMin}:{pomSec}
                </span>
                <span
                  className={`text-[9px] font-mono uppercase tracking-widest mt-0.5 ${pomMode === "focus" ? "text-[#f97316]" : "text-[#16a34a]"}`}
                >
                  {pomMode}
                </span>
              </div>
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setPomRunning((p) => !p)}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  pomRunning
                    ? "bg-[#f0ece8] text-[#8a6f5a] hover:bg-[#e8e2d8]"
                    : "bg-[#f97316] text-white hover:bg-[#c2500f] shadow-sm"
                }`}
              >
                {pomRunning ? "⏸ Pause" : "▶ Start"}
              </button>
              <button
                onClick={() => {
                  setPomRunning(false);
                  setPomMode("focus");
                  setPomSeconds(25 * 60);
                }}
                className="w-10 h-10 rounded-2xl border border-[#f0ece8] text-[#b09880] text-sm hover:border-[#f97316] hover:text-[#f97316] transition-all flex items-center justify-center"
              >
                ↺
              </button>
            </div>
          </div>
          <button
            onClick={() => onNavigate("pomodoro")}
            className="text-[10px] font-mono text-[#f97316] hover:underline self-start"
          >
            Full Pomodoro →
          </button>
        </div>

        {/* 4. Music */}
        <div className="bg-white rounded-3xl p-5 border border-[#f0ece8] shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono">
              Now Playing
            </p>
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-sm">
              🎵
            </div>
          </div>
          {music.currentTrack ? (
            <>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="w-20 h-20 rounded-2xl overflow-hidden bg-[#1a1410] shadow-md"
                  style={{
                    boxShadow: music.isPlaying
                      ? "0 4px 20px rgba(249,115,22,0.4)"
                      : "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "box-shadow 0.3s ease",
                  }}
                >
                  {music.currentTrack.cover ? (
                    <Image
                      src={music.currentTrack.cover}
                      alt=""
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#4a4038] text-2xl">
                      🎵
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-[#1a1208] truncate max-w-35">
                    {music.currentTrack.title}
                  </p>
                  <p className="text-[10px] text-[#b09880] font-mono">
                    {music.currentTrack.artist}
                  </p>
                </div>
                <div className="w-full h-1 bg-[#f0ece8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#f97316] rounded-full transition-all"
                    style={{
                      width: `${music.duration > 0 ? (music.progress / music.duration) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={music.prevTrack}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#f0ece8] text-[#b09880] hover:text-[#f97316] hover:border-[#f97316] transition-all text-xs"
                >
                  ⏮
                </button>
                <button
                  onClick={music.togglePlay}
                  className="flex-1 py-2 rounded-2xl bg-[#f97316] text-white text-xs font-bold hover:bg-[#c2500f] transition-all shadow-sm"
                >
                  {music.isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>
                <button
                  onClick={music.nextTrack}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#f0ece8] text-[#b09880] hover:text-[#f97316] hover:border-[#f97316] transition-all text-xs"
                >
                  ⏭
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
              <div className="text-3xl opacity-20">🎵</div>
              <p className="text-xs text-[#c5bdb0] italic text-center">
                Nothing playing.
              </p>
              <button
                onClick={() => onNavigate("music")}
                className="px-4 py-2 rounded-xl bg-[#f97316] text-white text-xs font-bold hover:bg-[#c2500f] transition-all mt-1"
              >
                Open Player
              </button>
            </div>
          )}
          {music.currentTrack && (
            <button
              onClick={() => onNavigate("music")}
              className="text-[10px] font-mono text-[#f97316] hover:underline self-start"
            >
              Open player →
            </button>
          )}
        </div>
      </div>

      {/* ── BOTTOM: TWO COLUMNS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 65% — Recent Activity + Quick Capture */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          <div className="bg-white rounded-3xl p-6 border border-[#f0ece8] shadow-sm flex-1">
            <div className="flex items-center gap-3 mb-5">
              <span className="font-serif italic text-[#f97316] text-base">
                Recent Activity
              </span>
              <div className="flex-1 h-px bg-[#f0ece8]" />
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-[#c5bdb0] italic py-4 text-center">
                No recent activity. Go do something amazing! 🧡
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {recentActivity.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 py-3 border-b border-[#f8f4f0] last:border-0"
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 border border-[#fde8d0] flex items-center justify-center text-sm">
                        {item.icon}
                      </div>
                      {i < recentActivity.length - 1 && (
                        <div className="w-px h-4 bg-[#f0ece8] mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1a1208] truncate">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-[#b09880] font-mono">
                        {item.sub}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Capture */}
          <button
            onClick={() => onNavigate("todo")}
            className="w-full py-4 rounded-3xl border-2 border-dashed border-[#f0d8c8] text-[#b09880] text-sm font-medium hover:border-[#f97316] hover:text-[#f97316] hover:bg-orange-50/50 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span>
            Quick add a task
          </button>
        </div>

        {/* Right 35% */}
        {/* Right col */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Tyunnie quote card — flex-1 to fill available space */}
          <div
            className="rounded-3xl overflow-hidden relative flex flex-col flex-1"
            style={{
              background: "linear-gradient(160deg, #1e1510 0%, #111010 100%)",
              border: "1px solid #2a2520",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 60% 100%, rgba(249,115,22,0.18) 0%, transparent 65%)",
              }}
            />
            <div className="flex-1 flex flex-col justify-center items-center p-6 relative z-10 text-center gap-4">
              <p className="text-[9px] font-mono text-[#f97316] uppercase tracking-[3px] opacity-70">
                Tyunnie says
              </p>
              {oneliner ? (
                <p className="text-xl text-[#e8ddd0] leading-relaxed font-serif italic">
                  "{oneliner}"
                </p>
              ) : (
                <div className="space-y-2 w-full">
                  <div className="h-3 bg-[#2a2520] rounded animate-pulse w-full" />
                  <div className="h-3 bg-[#2a2520] rounded animate-pulse w-5/6 mx-auto" />
                  <div className="h-3 bg-[#2a2520] rounded animate-pulse w-3/4 mx-auto" />
                </div>
              )}
            </div>
          </div>

          {/* Quick Nav — fixed height, sits at bottom */}
          <div className="bg-white rounded-3xl p-5 border border-[#f0ece8] shadow-sm shrink-0">
            <p className="text-[9px] font-mono text-[#b09880] uppercase tracking-widest mb-4">
              Quick Navigation
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { panel: "writing" as Panel, icon: "✍️", label: "Write" },
                { panel: "finance" as Panel, icon: "💰", label: "Finance" },
                { panel: "snippets" as Panel, icon: "⌨️", label: "Snips" },
                { panel: "projects" as Panel, icon: "🗂️", label: "Projects" },
                { panel: "games" as Panel, icon: "🎮", label: "Games" },
                { panel: "profile" as Panel, icon: "👤", label: "Profile" },
              ].map(({ panel, icon, label }) => (
                <button
                  key={panel}
                  onClick={() => onNavigate(panel)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-[#f0ece8] hover:border-[#f97316]/50 hover:bg-orange-50 transition-all group"
                >
                  <span className="text-xl">{icon}</span>
                  <span className="text-[9px] font-mono text-[#b09880] uppercase tracking-wide group-hover:text-[#f97316] transition-colors">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
