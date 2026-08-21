"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAccentColor } from "@/lib/useAccentColor";
import type { Profile, Todo, Project, FinanceEntry } from "@/lib/database";
import type { Panel } from "@/components/Sidebar";
import { authHeader } from "@/lib/supabase";
import { isGuest } from "@/lib/guest";
import { todayKey } from "@/lib/dayKey";
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
}: Props) {
  const accentRgb = useAccentColor();
  const [oneliner, setOneliner] = useState<string | null>(null);

  // AI one-liner — sessionStorage cached.
  //
  // The cache key carries the name AND the date, because the cached value is
  // generated *text* with both baked into it. Keyed on nothing, a rename left
  // the old name showing in the line while the greeting above updated live —
  // and a session left open past midnight showed yesterday's line against
  // yesterday's task counts. Keying makes a rename simply miss and regenerate,
  // with no invalidation plumbing to forget on some future code path.
  //
  // It also fixes a race: if the profile row resolves after this mounts, the
  // name is "" — that line now caches under the empty-name key and is never
  // served to a named user, instead of being frozen in for the whole session.
  const activeName = profile?.display_name ?? userName ?? "";

  useEffect(() => {
    const today = todayKey();
    const cacheKey = `desk_oneliner:${activeName}:${today}`;

    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setOneliner(cached);
      return;
    }

    // Guests don't have AI access — show a warm static line, skip the call.
    if (isGuest()) {
      setOneliner("Make today one worth remembering.");
      return;
    }

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
Pending tasks: ${pendingCount}, Overdue: ${overdueCount}, Balance: RM${balance.toFixed(2)}, Name: ${activeName}
Just one sentence, no quotes, no action blocks.`,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          clearTimeout(timeoutId);
          const text = d.text?.trim() ?? null;
          setOneliner(text ?? "Make today one worth remembering.");
          if (text) sessionStorage.setItem(cacheKey, text);
        })
        .catch(() => {
          setOneliner("Make today one worth remembering.");
        }),
    );
  }, [activeName]);

  return (
    <div className="min-h-dvh pb-24">
      {/* ── HERO ── */}
      <div
        className="desk-hero rounded-3xl px-6 md:px-8 py-0 mb-8 flex items-center justify-between gap-4 md:gap-6 overflow-hidden relative"
        style={{ minHeight: "160px" }}
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
              className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-[2px] md:tracking-[3px]"
              /* Was rgb(accent) at opacity-70 — 2.6:1. --accent-text is the
                 same hue at a readable lightness, and the dimming is gone
                 rather than stacked on top of it (WCAG 1.4.3). */
              style={{ color: "var(--accent-text)" }}
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
            {getGreeting(profile?.display_name ?? userName)}
          </h1>
          <p className="text-sm md:text-lg text-[#7d6350] font-serif italic leading-relaxed max-w-lg pr-20 md:pr-0">
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
        <div className="shrink-0 hidden md:block relative z-10 self-end" style={{ height: 257 }}>
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
        oneliner={oneliner}
        userId={userId}
        savedLayout={profile?.desk_layout}
      />
    </div>
  );
}
