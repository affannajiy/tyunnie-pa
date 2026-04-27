"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Image from "next/image";
import { useAccentColor } from "@/lib/useAccentColor";
import type { Profile, Todo, Project, FinanceEntry } from "@/lib/database";
import type { Panel } from "@/components/Sidebar";
import { authHeader } from "@/lib/supabase";
import DeskWidgets from "@/components/DeskWidgets";

type Props = {
  profile: Profile | null;
  userName: string;
  userId: string;
  todos: Todo[];
  projects: Project[];
  finance: FinanceEntry[];
  financeViewMonth: number;
  financeViewYear: number;
  onNavigate: (panel: Panel) => void;
  onTodoToggle: (id: string, done: boolean) => void;
  onFocusMode: () => void;
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

export default function Desk({
  profile,
  userName,
  userId,
  todos,
  projects,
  finance,
  financeViewMonth,
  financeViewYear,
  onNavigate,
  onTodoToggle,
  onFocusMode,
}: Props) {
  const accentRgb = useAccentColor();
  const [oneliner, setOneliner] = useState<string | null>(null);

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    authHeader().then((ah) =>
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ah },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [{ role: "user", content: "desk oneliner" }],
          systemPrompt: `You are Tyunnie, warm AI assistant based on Taehyun from TXT. Write ONE short motivational sentence (max 12 words) for the user's day. Be warm, casual, personal. No emojis at start.
Pending tasks: ${pendingCount}, Overdue: ${overdueCount}, Balance: RM${balance.toFixed(2)}, Name: ${profile?.display_name ?? userName ?? ""}
Just one sentence, no quotes, no action blocks.`,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          clearTimeout(timeoutId);
          const text = d.text?.trim() ?? null;
          setOneliner(text ?? "Make today one worth remembering.");
          if (text) sessionStorage.setItem("desk_oneliner", text);
        })
        .catch(() => {
          setOneliner("Make today one worth remembering.");
        }),
    );
  }, []);

  return (
    <div className="min-h-screen pb-24">
      {/* ── HERO ── */}
      <div
        className="rounded-3xl px-6 md:px-8 py-0 mb-8 flex items-center justify-between gap-4 md:gap-6 overflow-hidden relative"
        style={{
          background:
            "linear-gradient(135deg, #fff8f4 0%, #fef3ec 50%, #fdf0e8 100%)",
          border: "1px solid #fde8d8",
          minHeight: "160px",
        }}
      >
        {/* Animated accent bubbles */}
        <div
          className="absolute -top-10 -right-10 w-52 h-52 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(${accentRgb},0.22), transparent 70%)`,
            animation: "heroPulse 4s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-6 right-28 w-28 h-28 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(${accentRgb},0.14), transparent 70%)`,
            animation: "heroPulse 4s ease-in-out infinite 1.3s",
          }}
        />
        <div
          className="absolute top-6 left-[40%] w-16 h-16 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(${accentRgb},0.10), transparent 70%)`,
            animation: "heroPulse 4s ease-in-out infinite 2.6s",
          }}
        />
        <div
          className="absolute bottom-4 left-8 w-10 h-10 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(${accentRgb},0.12), transparent 70%)`,
            animation: "heroPulse 4s ease-in-out infinite 0.7s",
          }}
        />

        <style>{`
          @keyframes heroPulse {
            0%, 100% { transform: scale(1);    opacity: 1; }
            50%       { transform: scale(1.18); opacity: 0.6; }
          }
        `}</style>

        <div className="flex-1 relative z-10 py-6 md:py-7">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-[2px] md:tracking-[3px] opacity-70"
              style={{ color: `rgb(${accentRgb})` }}
            >
              {new Date().toLocaleDateString("en-MY", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="font-serif italic text-2xl md:text-5xl text-[#1a1208] mb-2 md:mb-3 leading-tight pr-24 md:pr-0">
            {getGreeting(profile?.display_name ?? userName)} 👋
          </h1>
          <p className="text-sm md:text-lg text-[#8a6f5a] font-serif italic leading-relaxed max-w-lg pr-20 md:pr-0">
            Welcome home 🧡
          </p>
        </div>

        {/* Sprite — absolute on mobile, normal flow on desktop */}
        <div className="md:hidden absolute bottom-0 right-0 z-0 pointer-events-none">
          <Image
            src="/sprites/tyun-hero.png"
            alt="Tyunnie"
            width={560}
            height={720}
            priority
            style={{
              width: "110px",
              height: "auto",
              filter: `drop-shadow(0 -4px 16px rgba(${accentRgb},0.30))`,
              marginBottom: "-2px",
            }}
          />
        </div>
        <div className="shrink-0 hidden md:block relative z-10 self-end">
          <Image
            src="/sprites/tyun-hero.png"
            alt="Tyunnie"
            width={560}
            height={720}
            priority
            className="hover:scale-105 transition-transform duration-500"
            style={{
              width: "200px",
              height: "auto",
              filter: `drop-shadow(0 -4px 20px rgba(${accentRgb},0.30))`,
              marginBottom: "-2px",
            }}
          />
        </div>
      </div>

      {/* ── WIDGET GRID ── */}
      <DeskWidgets
        profile={profile}
        todos={todos}
        projects={projects}
        finance={finance}
        financeViewMonth={financeViewMonth}
        financeViewYear={financeViewYear}
        onNavigate={onNavigate}
        onTodoToggle={onTodoToggle}
        onFocusMode={onFocusMode}
        oneliner={oneliner}
        userId={userId}
        savedLayout={profile?.desk_layout}
      />
    </div>
  );
}
