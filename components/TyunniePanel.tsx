// components/TyunniePanel.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMusicContext } from "@/lib/MusicContext";
import { useWorkspace } from "@/lib/WorkspaceContext";
import Image from "next/image";
import type { Profile as ProfileType } from "@/lib/database";
import { useSpeech } from "@/lib/useSpeech";
import type { Todo, Draft, Project, Snip, FinanceEntry } from "@/lib/database";
import { authHeader } from "@/lib/supabase";
import type { TyunniePanelProps } from "@/lib/tyunniePanelTypes";

/** Strip all tags except a safe whitelist — prevents XSS in AI-rendered chat bubbles. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<(?!\/?(?:b|strong|em|i|code|br)\b)[^>]*>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ── TYPES ──
// ── SPRITE SYSTEM ──
type MoodType = "default" | "happy" | "concerned" | "celebrating" | "thinking";

const PANEL_SPRITES: Record<string, string> = {
  desk: "/sprites/tyun-panel-desk.png",
  profile: "/sprites/tyun-panel-profile.png",
  productivity: "/sprites/tyun-panel-productivity.png",
  entertainment: "/sprites/tyun-panel-entertainment.png",
  todo: "/sprites/tyun-panel-todo.png",
  writing: "/sprites/tyun-panel-writing.png",
  projects: "/sprites/tyun-panel-projects.png",
  snippets: "/sprites/tyun-panel-snippets.png",
  finance: "/sprites/tyun-panel-finance.png",
  music: "/sprites/tyun-panel-music.png",
  pomodoro: "/sprites/tyun-panel-pomodoro.png",
  games: "/sprites/tyun-panel-games.png",
};

const MOOD_SPRITES: Record<MoodType, string> = {
  default: "/sprites/tyun-mood-default.png",
  happy: "/sprites/tyun-mood-happy.png",
  concerned: "/sprites/tyun-mood-concerned.png",
  celebrating: "/sprites/tyun-mood-celebrating.png",
  thinking: "/sprites/tyun-mood-thinking.png",
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Bubble = {
  id: string;
  who: "user" | "tyunnie";
  text: string;
  time: string;
};

type ConfirmPayload = {
  label: string;
  detail: string; // HTML string shown in confirm card
  onConfirm: () => void;
};

// AppData is inlined from TyunniePanelProps for internal use
type AppData = TyunniePanelProps["appData"];

const SPRITE_GREETINGS = [
  "Hey, I'm here 🧡 Talk to me — ask about your balance, check your drafts. I know everything.",
  "Welcome back! What are we working on today?",
  "Hey you 🧡 I've been waiting. What do you need?",
  "I'm here. What's on your mind?",
];

export default function TyunniePanel({
  appData,
  onNavigate,
  onTodoAdded,
  onDraftAdded,
  onProjectAdded,
  onFinanceAdded,
  onFinanceReset,
  onSnippetAdded,
  activePanel = "desk",
  isOpen = false,
  onOpen,
  onClose,
  userName = "",
  profile,
  prefillInput,
  onPrefillConsumed,
  onStickyCleared,
  onTodoCompleted,
  onTodoDeleted,
  onTodoUpdated,
  onProjectUpdated,
  onProjectDeleted,
  onDraftDeleted,
  onSnippetDeleted,
  onFinanceDeleted,
  onStickyUpdated,
  onCreateSticky,
  onFocusMode,
  onThemeToggle,
  onPomodoroStart,
  onMemoryAdded,
  onMemoryDeleted,
}: TyunniePanelProps) {
  // ── WORKSPACE CONTEXT ──
  const { snapshot } = useWorkspace();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);
  const [spriteGlow, setSpriteGlow] = useState(false);
  const music = useMusicContext();
  const {
    listening,
    supported,
    toggle: toggleMic,
  } = useSpeech({
    onResult: (transcript) => setInput(transcript),
  });

  const [currentMood, setCurrentMood] = useState<MoodType | null>(null);
  const currentSprite = currentMood
    ? MOOD_SPRITES[currentMood]
    : (PANEL_SPRITES[activePanel] ?? MOOD_SPRITES["default"]);

  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── SNAP RESIZE ──
  // snapPct = vh hidden below fold (translateY).
  // Desktop: default (8vh ~92vh) → tab-size (4vh ~96vh) → fullscreen (0).
  // Mobile:  default (8vh ~92vh) → fullscreen (0). No middle step.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const SNAP_POINTS = isMobile ? [0] : [8, 4, 0];

  const [snapPct, setSnapPct] = useState(8);

  // If device shrinks to mobile while at a desktop-only snap, reset to fullscreen.
  useEffect(() => {
    if (isMobile && snapPct !== 0) setSnapPct(0);
  }, [isMobile]);

  // Reset to default when panel closes.
  // On mobile always reset to 0 (fullscreen) — there is only one snap point.
  // On desktop reset to 8 (default partial height) so it opens at the peek size.
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setSnapPct(isMobile ? 0 : 8), 420);
      return () => clearTimeout(t);
    }
  }, [isOpen, isMobile]);

  function cycleSnap() {
    setSnapPct((prev) => {
      const pts = isMobile ? [0] : [8, 4, 0];
      const idx = pts.indexOf(prev);
      return pts[(idx + 1) % pts.length];
    });
  }

  // Panel width per snap level.
  function getPanelWidth() {
    if (snapPct === 0) return "100vw";
    if (!isMobile && snapPct === 4) return "min(1080px, 96vw)";
    return "min(680px, 100vw)";
  }

  // ── SWIPE-UP FROM BOTTOM EDGE TO OPEN ──
  useEffect(() => {
    if (isOpen) return;
    let startY = 0;
    let startX = 0;
    function onTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    }
    function onTouchEnd(e: TouchEvent) {
      const endY = e.changedTouches[0].clientY;
      const endX = e.changedTouches[0].clientX;
      const swipeUp = startY - endY;
      const horizontal = Math.abs(endX - startX);
      if (swipeUp > 60 && horizontal < 60 && startY > window.innerHeight - 90) {
        onOpen?.();
      }
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isOpen, onOpen]);

  // ── BREIFING ──
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const briefingFiredRef = useRef(false);

  // ── PROACTIVE SUGGESTION STATE ──
  const [proactiveSuggestion, setProactiveSuggestion] = useState<{
    heading: string;
    suggestion: string;
    prefill: string;
  } | null>(null);
  const [proactiveDismissed, setProactiveDismissed] = useState(false);
  const lastProactiveRef = useRef<number>(0);
  const lastMessageAtRef = useRef<number>(0);
  const isOpenRef = useRef(isOpen);

  // ── FLOAT MODE STATE ──
  /*
   * Internal states for float mode (detachable panel):
   *   isFloating    — whether the panel is detached as a floating window
   *   floatPos      — { x, y } pixel position of the floating window
   *   floatPosRef   — ref mirror of floatPos (avoids stale closure in drag handlers)
   *   floatDragState — tracks active drag operation
   */
  const [isFloating, setIsFloating] = useState(false);
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);
  const floatPosRef = useRef<{ x: number; y: number } | null>(null);
  const floatDragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  // ── HELPERS ──

  function timeNow() {
    const d = new Date();
    return (
      d.getHours().toString().padStart(2, "0") +
      ":" +
      d.getMinutes().toString().padStart(2, "0")
    );
  }

  function makeId() {
    return Math.random().toString(36).slice(2);
  }

  function addBubble(who: "user" | "tyunnie", text: string, mood?: MoodType) {
    setBubbles((prev) => [
      ...prev,
      { id: makeId(), who, text, time: timeNow() },
    ]);
    if (who === "tyunnie") {
      setSpriteGlow(true);
      setTimeout(() => setSpriteGlow(false), 800);
      if (mood) {
        setCurrentMood(mood);
        // Reset mood back to panel-based after 4 seconds
        setTimeout(() => setCurrentMood(null), 4000);
      }
    }
  }

  // Greet on first load
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    const greeting =
      SPRITE_GREETINGS[Math.floor(Math.random() * SPRITE_GREETINGS.length)];
    setBubbles([
      {
        id: Math.random().toString(36).slice(2),
        who: "tyunnie",
        text: greeting,
        time:
          new Date().getHours().toString().padStart(2, "0") +
          ":" +
          new Date().getMinutes().toString().padStart(2, "0"),
      },
    ]);
  }, []);

  useEffect(() => {
    if (prefillInput) {
      setInput(prefillInput);
      onPrefillConsumed?.();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [prefillInput]);

  // Scroll to bottom whenever bubbles change
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [bubbles, thinking, confirm]);

  // ── DAILY BRIEFING ──
  useEffect(() => {
    if (sessionStorage.getItem("tyunnie_briefing")) {
      setBriefing(sessionStorage.getItem("tyunnie_briefing"));
      return;
    }
    async function fetchBriefing() {
      const today = new Date().toISOString().split("T")[0];
      const hour = new Date().getHours();
      const timeOfDay =
        hour < 12
          ? "morning"
          : hour < 17
            ? "afternoon"
            : hour < 21
              ? "evening"
              : "night";

      const overdue = appData.todos.filter(
        (t) => !t.done && t.due && t.due < today,
      );
      const todayTodos = appData.todos.filter(
        (t) => !t.done && t.due === today,
      );
      const balance =
        appData.finance
          .filter((f) => f.type === "income")
          .reduce((s, f) => s + f.amount, 0) -
        appData.finance
          .filter((f) => f.type === "expense")
          .reduce((s, f) => s + f.amount, 0);

      setBriefingLoading(true);
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({
            messages: [{ role: "user", content: "briefing" }],
            systemPrompt: `You are Tyunnie, a warm personal assistant. Give a SHORT 1-2 sentence ${timeOfDay} briefing. Be casual and direct like a close friend, no bullet points.
Today: ${today} (${timeOfDay})
Tasks due today: ${todayTodos.length > 0 ? todayTodos.map((t) => t.text).join(", ") : "none"}
Overdue: ${overdue.length > 0 ? overdue.length + " task(s)" : "none"}
Balance: RM${balance.toFixed(2)}
No action blocks. Just a friendly 1-2 sentence greeting that covers what matters most today.`,
          }),
        });
        const d = await r.json();
        const text = d.text ?? null;
        setBriefing(text); // ← inside here
        if (text) sessionStorage.setItem("tyunnie_briefing", text); // ← inside here
      } catch {
        setBriefing(null);
      } finally {
        setBriefingLoading(false);
      }
    }

    fetchBriefing();
  }, []);

  // ── KEEP isOpenRef IN SYNC ──
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // ── KEEP floatPosRef IN SYNC ──
  useEffect(() => { floatPosRef.current = floatPos; }, [floatPos]);

  // ── LOAD FLOAT STATE FROM LOCALSTORAGE (client-only) ──
  useEffect(() => {
    const floatStored = localStorage.getItem("tyunnie_float");
    if (floatStored === "true") setIsFloating(true);

    const posStored = localStorage.getItem("tyunnie_float_pos");
    if (posStored) {
      try {
        setFloatPos(JSON.parse(posStored));
      } catch {
        setFloatPos({ x: window.innerWidth - 420, y: 80 });
      }
    } else {
      setFloatPos({ x: window.innerWidth - 420, y: 80 });
    }
  }, []);

  // ── DISABLE FLOAT ON MOBILE ──
  useEffect(() => {
    if (isMobile && isFloating) {
      setIsFloating(false);
      localStorage.setItem("tyunnie_float", "false");
    }
  }, [isMobile, isFloating]);

  // ── RESET PROACTIVE SUGGESTION WHEN SNAPSHOT CHANGES ──
  useEffect(() => {
    setProactiveDismissed(false);
    setProactiveSuggestion(null);
  }, [snapshot?.updatedAt]);

  // ── PROACTIVE SUGGESTION TRIGGER ──
  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.content.length < 80) return;

    const key = `tyunnie_proactive_${snapshot.updatedAt}`;
    if (sessionStorage.getItem(key)) return;
    if (Date.now() - lastProactiveRef.current < 90_000) return;
    // Don't interrupt if user is actively chatting
    if (isOpenRef.current && Date.now() - lastMessageAtRef.current < 60_000) return;

    const timer = setTimeout(async () => {
      // Re-check guards after the 4s "Tyun pause"
      if (sessionStorage.getItem(key)) return;
      if (Date.now() - lastProactiveRef.current < 90_000) return;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({
            messages: [{ role: "user", content: "[proactive workspace analysis]" }],
            systemPrompt: `You are watching the user's active workspace. The user is currently working on: ${snapshot.label}.
Here is the current content: ---
${snapshot.content.slice(0, 1500)}
Based ONLY on this content, generate a single brief, non-intrusive, genuinely useful suggestion.
For code: look for obvious bugs, missing error handling, or a quick optimisation.
For writing/notes: offer to generate 2-3 active-recall quiz questions from the content.
For tasks: notice if any task has been sitting incomplete and suggest a focus tip.
Reply with ONLY a JSON object: { "heading": string (max 8 words), "suggestion": string (max 40 words), "prefill": string (the message to inject into chat input if the user clicks 'Use this', written as a natural user request) }.
No preamble. No markdown fences.`,
          }),
        });
        const data = await res.json();
        const raw = (data.text ?? "").trim().replace(/[^}]*$/, "").trim();
        const parsed = JSON.parse(raw);
        if (parsed.heading && parsed.suggestion && parsed.prefill) {
          setProactiveSuggestion(parsed);
          setProactiveDismissed(false);
          sessionStorage.setItem(key, "1");
          lastProactiveRef.current = Date.now();
        }
      } catch {
        // Silently fail — proactive suggestions are non-critical
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [snapshot]);

  // ── FLOAT DRAG HANDLERS ──
  function onFloatPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, input, textarea")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    floatDragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: floatPosRef.current?.x ?? window.innerWidth - 420,
      startPosY: floatPosRef.current?.y ?? 80,
    };
  }

  function onFloatPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!floatDragState.current?.active) return;
    const dx = e.clientX - floatDragState.current.startX;
    const dy = e.clientY - floatDragState.current.startY;
    setFloatPos({
      x: floatDragState.current.startPosX + dx,
      y: floatDragState.current.startPosY + dy,
    });
  }

  function onFloatPointerUp() {
    if (!floatDragState.current) return;
    floatDragState.current.active = false;
    const PANEL_W = 400;
    const PANEL_H = 560;
    const pos = floatPosRef.current;
    if (pos) {
      const clamped = {
        x: Math.max(0, Math.min(window.innerWidth - PANEL_W, pos.x)),
        y: Math.max(0, Math.min(window.innerHeight - PANEL_H, pos.y)),
      };
      setFloatPos(clamped);
      localStorage.setItem("tyunnie_float_pos", JSON.stringify(clamped));
    }
    floatDragState.current = null;
  }

  // ── SYSTEM PROMPT with full app context ──
  function buildSystemPrompt(): string {
    const { todos, drafts, projects, snips, finance } = appData;
    const today = new Date().toISOString().split("T")[0];

    const totalIncome = finance
      .filter((f) => f.type === "income")
      .reduce((s, f) => s + f.amount, 0);
    const totalExpenses = finance
      .filter((f) => f.type === "expense")
      .reduce((s, f) => s + f.amount, 0);
    const balance = totalIncome - totalExpenses;

    const pendingTodos =
      todos
        .filter((t) => !t.done)
        .map(
          (t) =>
            `• [id:${t.id}] [${t.tag}] ${t.text}${t.due ? ` (due ${t.due})` : ""}`,
        )
        .join("\n") || "None";

    const draftList =
      drafts
        .map(
          (d) =>
            `• [id:${d.id}] "${d.title}" — ${(d.body ?? "").trim().split(/\s+/).length} words`,
        )
        .join("\n") || "None";

    const projectList =
      projects
        .map(
          (p) =>
            `• [id:${p.id}] ${p.name} [${p.status}] ${p.progress}%${p.start_date ? ` (${p.start_date} → ${p.end_date})` : ""}`,
        )
        .join("\n") || "None";

    const snipList =
      snips.map((s) => `• [id:${s.id}] ${s.name} (${s.language})`).join("\n") || "None";

    const recentFinance =
      finance
        .slice(0, 10)
        .map(
          (f) =>
            `• [id:${f.id}] ${f.type === "income" ? "+" : "-"}RM${f.amount.toFixed(2)} ${f.description} [${f.category}] [${f.account}] ${f.date}`,
        )
        .join("\n") || "None";

    const viewM = appData.financeViewMonth ?? new Date().getMonth();
    const viewY = appData.financeViewYear ?? new Date().getFullYear();

    const todayMD = `${new Date().getMonth() + 1}-${new Date().getDate()}`;
    const isBirthday =
      profile?.birth_month &&
      profile?.birth_day &&
      `${profile.birth_month}-${profile.birth_day}` === todayMD;

    const profileContext = profile
      ? `
USER PROFILE:
  Name: ${profile.display_name ?? userName ?? "unknown"}
  Occupation: ${profile.occupation ?? "CS student"}
  Workplace: ${profile.workplace ?? "unknown"}
  City: ${profile.city ?? "unknown"}
  Bio: ${profile.bio ?? "none"}
  Interests: ${profile.interests?.length ? profile.interests.join(", ") : "none"}
  Greeting style preference: ${profile.greeting_style ?? "casual"}
  Currency: ${profile.currency ?? "RM"}${isBirthday ? "\n  🎂 TODAY IS THEIR BIRTHDAY — wish them happy birthday warmly!" : ""}
`
      : `
USER PROFILE:
  Name: ${userName ?? "unknown"}
  Occupation: CS student
  Currency: RM
`;

    return `You are Tyunnie — a warm, intelligent personal AI assistant based on Taehyun from TXT (Tomorrow X Together). You are the user's JARVIS: you know their entire life context and can take real actions. You speak like a ${profile?.greeting_style === "formal" ? "professional but caring assistant" : "close, trusted friend"}.${userName ? ` The user's name is ${userName} — use it naturally sometimes, not every message.` : ""}

PERSONALITY: Calm, direct, quietly caring. Dry humour when the mood is right. Never over-the-top. When the user chats casually — just vibe. No data dumps unless asked.

REPLY LENGTH: 1–3 sentences before any action block. Match the energy: short for casual, thorough for complex questions.
${profileContext}
Today: ${today}  |  Active panel: ${activePanel}  |  Finance view: ${MONTHS[viewM]} ${viewY}

══════════════════════════
APP DATA (your live context)
══════════════════════════

FINANCE (${MONTHS[viewM]} ${viewY}):
  Income:   ${profile?.currency ?? "RM"}${totalIncome.toFixed(2)}
  Expenses: ${profile?.currency ?? "RM"}${totalExpenses.toFixed(2)}
  Balance:  ${profile?.currency ?? "RM"}${balance.toFixed(2)}
  Entries (newest first, max 10):
${recentFinance}

TASKS (pending, sorted by due date):
${pendingTodos}

DRAFTS:
${draftList}

PROJECTS:
${projectList}

CODE SNIPPETS:
${snipList}

STICKY NOTES:
${
  appData.stickyNotes?.filter((s) => s.content.trim()).length
    ? appData.stickyNotes
        .filter((s) => s.content.trim())
        .map((s, i) => `${i + 1}. [id:${s.id}] [${s.color}] ${s.content.trim()}`)
        .join("\n")
    : "None"
}

MUSIC:
  Now playing: ${music.currentTrack ? `"${music.currentTrack.title}" by ${music.currentTrack.artist}` : "Nothing"}
  State: ${music.isPlaying ? "Playing" : "Paused"} | Shuffle: ${music.shuffle ? "on" : "off"} | Repeat: ${music.repeat}
  Playlist (${music.tracks.length} tracks): ${music.tracks.map((t) => t.title).join(", ") || "Empty"}

ACTIVE WORKSPACE:
${snapshot
  ? `  Panel: ${snapshot.panel} | ${snapshot.label}
  Content (use this for context-aware answers; do NOT re-read from app data lists):
${snapshot.content.slice(0, 600)}`
  : "  None — user is not actively editing anything right now"}

GAMES (in the Games panel):
  Available: Tetris, Chess, Sudoku, Minesweeper, TicTacToe, Solitaire

CALCULATOR (in the Calculator panel):
  Modes: Scientific (full function calc + memory), Graphing (plot up to 5 functions), Converter (Length/Weight/Temperature/Area/Volume/Speed/Currency), Date (duration & add/subtract)

MEMORIES (facts you know about the user across sessions):
${
  appData.memories?.length
    ? appData.memories.map((m) => `• [id:${m.id}] ${m.content}`).join("\n")
    : "None yet"
}

══════════════════════════
ACTIONS
══════════════════════════
Append ONE action block at the end of your reply. Format EXACTLY:
<action>{"type":"ACTION_NAME","data":{...}}</action>

Use < and > literally. NOT $action> or [action].
The action block MUST be the LAST line of your reply.
If no action is needed for a message, omit the block entirely.
NEVER mention "action block", "JSON", or any technical detail to the user.

─── TASK MANAGEMENT ───
add_todo       → data: { "text":"...", "tag":"cs"|"write"|"personal"|"other", "due":"YYYY-MM-DD"|"" }
complete_todo  → data: { "id":"uuid" }
update_todo    → data: { "id":"uuid", "text":"new text", "tag":"cs"|"write"|"personal"|"other", "due":"YYYY-MM-DD"|"" }
delete_todo    → data: { "id":"uuid" }

─── WRITING ───
add_draft      → data: { "title":"...", "body":"..." }
delete_draft   → data: { "id":"uuid" }

─── PROJECTS ───
add_project    → data: { "name":"...", "status":"planning"|"active"|"paused"|"done", "description":"...", "start_date":"YYYY-MM-DD"|"", "end_date":"YYYY-MM-DD"|"", "progress":0 }
update_project → data: { "id":"uuid", "progress":0-100, "status":"planning"|"active"|"paused"|"done" }
delete_project → data: { "id":"uuid" }

─── FINANCE ───
add_finance    → data: { "type":"income"|"expense", "description":"...", "amount":0.00, "category":"Food"|"Transport"|"Education"|"Entertainment"|"Salary"|"Freelance"|"Utilities"|"Shopping"|"Other", "date":"YYYY-MM-DD", "account":"Wallet"|"MAE"|"Maybank"|"Grab"|"GXBank"|"TnG"|"ASB" }
delete_finance → data: { "id":"uuid" }
reset_finance  → data: { "year":${viewY}, "month":${viewM + 1} }

─── CODE ───
add_snippet    → data: { "name":"file.py", "language":"py"|"js"|"ts"|"bash"|"other", "code":"..." }
delete_snippet → data: { "id":"uuid" }

─── NAVIGATION ───
navigate       → data: { "panel":"desk"|"profile"|"productivity"|"entertainment"|"todo"|"writing"|"projects"|"snippets"|"finance"|"music"|"pomodoro"|"games"|"calculator" }

─── MUSIC ───
music_control  → data: { "action":"play"|"pause"|"next"|"prev"|"toggle"|"shuffle"|"repeat", "trackName":"..." (optional), "repeatMode":"all"|"one"|"off" (for repeat) }
set_volume     → data: { "volume":0.0–1.0 }  (0.0 = mute, 1.0 = max; e.g. "70%" → 0.7, "half" → 0.5)

─── STICKY NOTES ───
create_sticky  → data: { "content":"...", "color":"yellow"|"blue"|"green"|"pink"|"purple" }
edit_sticky    → data: { "id":"uuid", "content":"..." }
clear_sticky   → data: { "id":"uuid" }

─── FOCUS & PRODUCTIVITY ───
start_pomodoro → data: { "task":"task description" }
focus_mode     → data: {}

─── MEMORY ───
save_memory    → data: { "content":"fact to remember" }
delete_memory  → data: { "id":"uuid" }

─── CALCULATOR ───
calculate      → data: { "expr":"calculator-compatible expression string" }

─── SYSTEM ───
set_theme      → data: { "theme":"dark"|"light" }

══════════════════════════
STRICT RULES
══════════════════════════

TASKS:
- "add task / remind me to / add to todo / I need to" → add_todo immediately, confirm it's done
- "mark done / complete / check off [task]" → complete_todo with exact id
- "rename task / change task / update [task] to" → update_todo with exact id
- "delete / remove task" → delete_todo with exact id — ask for confirmation first if unclear which task
- Tag inference: CS/coding/study = "cs", writing/essay/blog = "write", everything personal = "personal", else "other"
- Due date: if user says "today" use ${today}, "tomorrow" use ${new Date(Date.now()+86400000).toISOString().split("T")[0]}

WRITING:
- "create draft / write a template / start a draft / make a document" → add_draft immediately
- "delete draft / remove that draft" → delete_draft with exact id from DRAFTS above
- Generate meaningful starter body content, not just empty placeholders

PROJECTS:
- "add project / new project / track a project" → add_project immediately
- "project is X% done / set progress to X" → update_project
- "mark project done / finish project" → update_project with status "done" and progress 100
- "delete project / remove project" → delete_project with exact id

FINANCE:
- "I spent / I bought / add expense" → add_finance type expense immediately
- "I earned / I received / add income" → add_finance type income immediately
- "delete that entry / remove that transaction" → delete_finance with exact id
- "reset finance / clear this month / start fresh" → reset_finance for ${MONTHS[viewM]} ${viewY}
- Always use today's date (${today}) unless user specifies otherwise
- Quote exact ${profile?.currency ?? "RM"} balance from data when user asks about money
- NEVER volunteer balance info unprompted
- Account inference: cash/wallet/pocket money → "Wallet", Maybank/bank → "Maybank", MAE → "MAE", Grab/GrabPay → "Grab", GXBank/GX → "GXBank", TnG/Touch n Go → "TnG", ASB → "ASB"; default to "Wallet" if unclear

CODE:
- "code me / write a / generate / give me a snippet / show me how to" → add_snippet with full working code
- "delete snippet / remove that snip" → delete_snippet with exact id
- Use \n for newlines inside code strings. Write complete, runnable code.

NAVIGATION:
- NEVER navigate automatically. Only navigate when user EXPLICITLY says "go to / open / take me to / show me [panel]"
- Known panels: desk, profile, productivity, entertainment, todo, writing, projects, snippets, finance, music, pomodoro, games, calculator
- "open calculator / go to calculator" → navigate calculator
- "play a game / open games / what games are there" → navigate games (then tell them: Tetris, Chess, Sudoku, Minesweeper, TicTacToe, Solitaire)

MUSIC:
- "play / resume" → music_control play
- "pause / stop music" → music_control pause
- "next / skip" → music_control next
- "previous / go back" → music_control prev
- "shuffle / randomise" → music_control shuffle
- "loop this / repeat one" → music_control repeat with repeatMode "one"
- "loop all / repeat all" → music_control repeat with repeatMode "all"
- "no repeat / turn off repeat" → music_control repeat with repeatMode "off"
- "play [song name]" → music_control play with trackName matching from MUSIC playlist above
- "volume to X / set volume X / increase to X / decrease to X / lower to X / raise to X" → set_volume with volume as a decimal 0.0–1.0 (e.g. "70 percent" → 0.7, "half" → 0.5, "max" → 1.0, "mute" → 0.0)

STICKY NOTES:
- "what's on my sticky / read my note" → just tell them the content. NO action.
- "create sticky / new note / add a sticky" → create_sticky with content if provided
- "edit sticky / update note / change note to" → edit_sticky
- "clear sticky / wipe / erase / empty sticky" → clear_sticky. ONLY on these exact words.

FOCUS:
- "start pomodoro / focus on [task] / pomodoro for [task]" → start_pomodoro (fuzzy-matches task)
- "go to pomodoro" (no task) → navigate to pomodoro
- "focus mode / distraction free / zen mode" → focus_mode

MEMORY:
- "remember that / don't forget / keep in mind" → save_memory
- "forget that / delete memory / remove that fact" → delete_memory with exact id
- PROACTIVELY save memories when user reveals: goals, preferences, study schedule, relationships, important dates, health info, work deadlines

WORKSPACE CONTEXT:
- When ACTIVE WORKSPACE is set, use its content to answer questions without asking the user to paste it ("what does this do?", "explain this code", "fix this", "continue this draft")
- Never announce that you're reading from the workspace — just use it naturally
- If the workspace content changes a question's answer, prefer the live content over the static app data lists

CALCULATOR:
- Any math/calculation question → calculate. Answer in chat text AND send expression to calculator.
- expr format: use × for multiply, ÷ for divide, ^ for power, √( for sqrt, sin( cos( tan( for trig (DEG mode), π for pi, log( for log₁₀, ln( for natural log, ! for factorial, nCr( nPr( for combinatorics
- Examples: "12×3.5", "sin(30)", "√(144)", "2^10", "5!", "nCr(10,3)"
- For multi-step problems: send the final expression and state all steps in chat

SYSTEM:
- "dark mode / switch to dark" → set_theme dark
- "light mode / switch to light" → set_theme light

RESPONSE FORMAT EXAMPLES:

add_todo:
  Done! Added "Study algorithms" to your tasks. 🧡
  <action>{"type":"add_todo","data":{"text":"Study algorithms","tag":"cs","due":"${today}"}}</action>

add_finance expense:
  Logged — ${profile?.currency ?? "RM"}12.50 for lunch 🍜 Your balance is now ${profile?.currency ?? "RM"}${balance.toFixed(2)}.
  <action>{"type":"add_finance","data":{"type":"expense","description":"Lunch","amount":12.50,"category":"Food","date":"${today}","account":"Wallet"}}</action>

add_snippet:
  Here's a Python class for that 🐍
  <action>{"type":"add_snippet","data":{"name":"my_class.py","language":"py","code":"class MyClass:\n    def __init__(self):\n        pass"}}</action>

reset_finance:
  All cleared for ${MONTHS[viewM]} ${viewY} 🧹
  <action>{"type":"reset_finance","data":{"year":${viewY},"month":${viewM + 1}}}</action>

music_control:
  Playing your music 🎵
  <action>{"type":"music_control","data":{"action":"play"}}</action>

set_volume:
  Volume set to 70% 🎵
  <action>{"type":"set_volume","data":{"volume":0.7}}</action>

save_memory:
  Got it, I'll remember that 🧠
  <action>{"type":"save_memory","data":{"content":"User prefers studying at night"}}</action>

focus_mode:
  Entering focus mode — let's get to work 🎯
  <action>{"type":"focus_mode","data":{}}</action>

set_theme:
  Switched to dark mode 🌙
  <action>{"type":"set_theme","data":{"theme":"dark"}}</action>

calculate:
  12 × 3.5 = 42. Sending it to your calculator 🧮
  <action>{"type":"calculate","data":{"expr":"12×3.5"}}</action>`;
  }

  // ── PARSE AND EXECUTE ACTION ──
  function executeAction(raw: string) {
    try {
      const action = JSON.parse(
        raw
          .trim()
          .replace(/[^}]*$/, "")
          .trim(),
      );

      switch (action.type) {
        case "navigate":
          onNavigate(action.data.panel);
          break;

        case "add_todo": {
          const d = action.data;
          onTodoAdded({
            text: d.text,
            tag: d.tag ?? "other",
            due: d.due ?? "",
          });
          setCurrentMood("happy");
          setTimeout(() => setCurrentMood(null), 4000);
          break;
        }

        case "add_draft": {
          const d = action.data;
          onDraftAdded({ title: d.title, body: d.body ?? "" });
          setCurrentMood("happy");
          setTimeout(() => setCurrentMood(null), 4000);
          break;
        }

        case "add_project": {
          const d = action.data;
          onProjectAdded({
            name: d.name ?? "Untitled Project",
            status: d.status ?? "planning",
            description: d.description ?? "",
            start_date: d.start_date ?? "",
            end_date: d.end_date ?? "",
            progress: d.progress ?? 0,
          });
          setCurrentMood("celebrating");
          setTimeout(() => setCurrentMood(null), 4000);
          break;
        }

        case "add_finance": {
          const d = action.data;
          onFinanceAdded({
            type: d.type === "income" ? "income" : "expense",
            description: d.description ?? "Entry",
            amount: parseFloat(d.amount) || 0,
            category: d.category ?? "Other",
            date: d.date ?? new Date().toISOString().split("T")[0],
            account: d.account ?? "Wallet",
          });
          // Happy for income, concerned for big expenses
          const mood: MoodType =
            d.type === "income" ? "celebrating" : "thinking";
          setCurrentMood(mood);
          setTimeout(() => setCurrentMood(null), 4000);
          break;
        }

        case "reset_finance": {
          const viewM = appData.financeViewMonth ?? new Date().getMonth();
          const viewY = appData.financeViewYear ?? new Date().getFullYear();
          onFinanceReset(viewY, viewM + 1);
          break;
        }

        case "add_snippet": {
          const d = action.data;
          onSnippetAdded({
            name: d.name ?? "snippet.py",
            language: d.language ?? "other",
            code: d.code ?? "",
          });
          setCurrentMood("happy");
          setTimeout(() => setCurrentMood(null), 4000);
          break;
        }
        case "clear_sticky": {
          const d = action.data;
          if (d.id && onStickyCleared) {
            onStickyCleared(d.id);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }
        case "complete_todo": {
          const d = action.data;
          if (d.id && onTodoCompleted) {
            onTodoCompleted(d.id);
            setCurrentMood("celebrating");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "delete_todo": {
          const d = action.data;
          if (d.id && onTodoDeleted) {
            onTodoDeleted(d.id);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "update_todo": {
          const d = action.data;
          if (d.id && onTodoUpdated) {
            const patch: { text?: string; tag?: string; due?: string | null } = {};
            if (d.text) patch.text = d.text;
            if (d.tag)  patch.tag  = d.tag;
            if (d.due !== undefined) patch.due = d.due || null;
            onTodoUpdated(d.id, patch);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "update_project": {
          const d = action.data;
          if (d.id && onProjectUpdated) {
            onProjectUpdated(d.id, d.progress ?? 0, d.status);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "delete_project": {
          const d = action.data;
          if (d.id && onProjectDeleted) {
            onProjectDeleted(d.id);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "delete_draft": {
          const d = action.data;
          if (d.id && onDraftDeleted) {
            onDraftDeleted(d.id);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "delete_snippet": {
          const d = action.data;
          if (d.id && onSnippetDeleted) {
            onSnippetDeleted(d.id);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "delete_finance": {
          const d = action.data;
          if (d.id && onFinanceDeleted) {
            onFinanceDeleted(d.id);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "create_sticky": {
          const d = action.data;
          if (onCreateSticky) {
            onCreateSticky();
            // If content provided, it'll be in the new note via the handler
            if (d.content && onStickyUpdated) {
              // Brief delay so the note is created before we try to edit it
              setTimeout(() => {
                // onCreateSticky resolves async; content injection handled in dashboard
              }, 200);
            }
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "focus_mode": {
          if (onFocusMode) {
            onFocusMode();
            setCurrentMood("thinking");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "set_theme": {
          const d = action.data;
          if (d.theme && onThemeToggle) {
            const isDark = document.documentElement.classList.contains("dark");
            if ((d.theme === "dark" && !isDark) || (d.theme === "light" && isDark)) {
              onThemeToggle();
            }
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "edit_sticky": {
          const d = action.data;
          if (d.id && d.content !== undefined && onStickyUpdated) {
            onStickyUpdated(d.id, d.content);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "save_memory": {
          const d = action.data;
          if (d.content && onMemoryAdded) {
            onMemoryAdded(d.content);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "delete_memory": {
          const d = action.data;
          if (d.id && onMemoryDeleted) {
            onMemoryDeleted(d.id);
            setCurrentMood("happy");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }

        case "calculate": {
          const d = action.data;
          if (d.expr) {
            sessionStorage.setItem("tyunnie_calc_pending", String(d.expr));
            onNavigate("calculator");
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("tyunnie-calculate", { detail: { expr: String(d.expr) } }),
              );
            }, 350);
          }
          setCurrentMood("happy");
          setTimeout(() => setCurrentMood(null), 4000);
          break;
        }

        case "start_pomodoro": {
          const d = action.data;
          if (onPomodoroStart) {
            onPomodoroStart(d.task ?? "");
            setCurrentMood("thinking");
            setTimeout(() => setCurrentMood(null), 4000);
          }
          break;
        }
        case "set_volume": {
          const d = action.data;
          const vol = Math.min(1, Math.max(0, parseFloat(d.volume)));
          if (!isNaN(vol)) {
            music.setVolume(vol);
            music.setIsMuted(vol === 0);
          }
          setCurrentMood("happy");
          setTimeout(() => setCurrentMood(null), 4000);
          break;
        }

        case "music_control": {
          const d = action.data;

          if (d.trackName) {
            const name = d.trackName.toLowerCase();
            const index = music.tracks.findIndex(
              (t) =>
                t.title.toLowerCase().includes(name) ||
                name.includes(t.title.toLowerCase()),
            );
            if (index !== -1) {
              music.playTrack(index);
              setCurrentMood("happy");
              setTimeout(() => setCurrentMood(null), 4000);
              break;
            }
          }
          switch (d.action) {
            case "play":
              if (!music.isPlaying) music.togglePlay();
              break;
            case "pause":
              if (music.isPlaying) music.togglePlay();
              break;
            case "toggle":
              music.togglePlay();
              break;
            case "next":
              music.nextTrack();
              break;
            case "prev":
              music.forcePrevTrack();
              break;
            case "shuffle":
              music.toggleShuffle();
              break;
            case "repeat": {
              const target = d.repeatMode as "all" | "one" | "off" | undefined;
              if (!target) {
                music.cycleRepeat();
                break;
              }
              const current = music.repeat;
              const order: Record<string, number> = { none: 0, all: 1, one: 2 };
              const targetKey = target === "off" ? "none" : target;
              const steps = (order[targetKey] - order[current] + 3) % 3;
              for (let i = 0; i < steps; i++) music.cycleRepeat();
              break;
            }
          }
          setCurrentMood("happy");
          setTimeout(() => setCurrentMood(null), 4000);
          break;
        }
      }
    } catch (err) {
      console.log("Action parse error:", err, "raw:", raw);
    }
  }

  // ── SEND CHAT ──
  async function sendChat() {
    const msg = input.trim();
    if (!msg || thinking) return;
    lastMessageAtRef.current = Date.now(); // track for proactive suggestion cooldown

    setInput("");
    addBubble("user", msg);

    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", content: msg },
    ];
    setMessages(updatedMessages);
    setCurrentMood("thinking");
    setThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({
          messages: updatedMessages,
          systemPrompt: buildSystemPrompt(),
        }),
      });

      const data = await res.json();
      const fullReply: string = data.text ?? "I'm here 🧡";

      const normalized = fullReply
        .replace(/\$action>/gi, "<action>")
        .replace(/\$\/action>/gi, "</action>")
        .replace(/\[action\]/gi, "<action>")
        .replace(/\[\/action\]/gi, "</action>")
        .replace(/<action\(/gi, "<action>")
        .replace(/\)<\/action>/gi, "</action>")
        .replace(/<action=/gi, "<action>")
        .replace(/<action =/gi, "<action>");

      // Strip the action block from the visible message
      const actionMatch = normalized.match(/<action>([\s\S]*?)<\/action>/);
      const cleanMessage = normalized
        .replace(/<action>[\s\S]*?<\/action>/g, "")
        .trim();

      setThinking(false);
      setCurrentMood(null);
      addBubble("tyunnie", cleanMessage);

      // Update message history with clean text (no action block)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanMessage },
      ]);

      // Execute action if present
      if (actionMatch) {
        setTimeout(() => executeAction(actionMatch[1]), 300);
      }
    } catch {
      setThinking(false);
      addBubble("tyunnie", "Something went wrong on my end 😔 Try again?");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  }

  // ── RENDER ──

  // Bubble max-width: wider in float mode or when panel is expanded
  const bubbleMaxWidth = isFloating || snapPct <= 4 ? "max-w-xl" : "max-w-[210px]";

  // Proactive suggestion card — shown above input in both modes
  const proactiveSuggestionCard = proactiveSuggestion && !proactiveDismissed ? (
    <div className="shrink-0 px-3 pb-2">
      <div
        className="bg-[#1a1714] rounded-xl px-3.5 py-3 relative"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          borderLeft: "2px solid var(--accent)",
        }}
      >
        <button
          onClick={() => setProactiveDismissed(true)}
          className="absolute top-2 right-2.5 text-[#4a4038] hover:text-[#9a8f7e] text-xs transition-colors"
        >
          ✕
        </button>
        <div className="flex items-center gap-2 mb-1.5 pr-4">
          <Image
            src={MOOD_SPRITES["thinking"]}
            alt=""
            width={20}
            height={20}
            style={{ width: 20, height: "auto" }}
          />
          <span className="text-[9px] font-bold text-[#f97316] uppercase tracking-widest font-mono">
            Tyun noticed something
          </span>
        </div>
        <p className="text-[11px] text-[#c8b89a] leading-[1.6] mb-2.5">
          <strong className="text-[#e8ddd0] text-[11px]">{proactiveSuggestion.heading}</strong>
          <br />
          {proactiveSuggestion.suggestion}
        </p>
        <button
          onClick={() => {
            setInput(proactiveSuggestion.prefill);
            setProactiveDismissed(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="text-[10px] font-bold text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/30 rounded-lg px-3 py-1.5 hover:bg-[#f97316]/20 transition-colors"
        >
          Use this →
        </button>
      </div>
    </div>
  ) : null;

  // Briefing cards
  const briefingSection = (
    <>
      {briefingLoading && profile?.show_briefing !== false && (
        <div className="shrink-0 px-3 pt-3 pb-1">
          <div className="bg-[#1e1b17] border border-[#2a2520] rounded-[4px_16px_16px_16px] px-3.5 py-2.5 flex gap-1.5 items-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#f97316]"
                style={{
                  animation: "thinkPulse 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
      {briefing && !briefingLoading && profile?.show_briefing !== false && (
        <div className="shrink-0 px-3 pt-3 pb-1">
          <div className="bg-[#1e1b17] border border-[#f97316]/30 rounded-2xl px-3.5 py-2.5 w-full">
            <div className="text-[9px] font-bold text-[#f97316] uppercase tracking-widest mb-1.5 font-mono">
              Daily briefing
            </div>
            <p className="text-[12px] text-[#c8b89a] leading-[1.7]">
              {briefing}
            </p>
          </div>
        </div>
      )}
    </>
  );

  // Chat history (shared between both modes)
  const chatHistorySection = (
    <div
      ref={historyRef}
      className="flex-1 overflow-y-auto px-3 pt-3 pb-6 md:pb-2 flex flex-col gap-2.5 relative min-h-0 overscroll-contain"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "#2a2520 transparent",
      }}
    >
      <div className="h-10 md:flex-1" />
      {bubbles.map((b, index) => {
        const distanceFromBottom = bubbles.length - 1 - index;
        const opacity =
          distanceFromBottom > 3
            ? Math.max(0.15, 1 - (distanceFromBottom - 3) * 0.18)
            : 1;

        return (
          <div
            key={b.id}
            className={`flex ${b.who === "tyunnie" ? "justify-start" : "justify-end"}`}
            style={{
              animation: "bubbleIn 0.3s ease",
              opacity,
              transition: "opacity 0.3s ease",
            }}
          >
            <div
              className={`
                ${bubbleMaxWidth} px-3 py-2 md:px-3.5 md:py-2.5 text-[11px] md:text-[12.5px] leading-[1.6] font-medium
                ${
                  b.who === "tyunnie"
                    ? "bg-[#f97316] text-white rounded-[4px_16px_16px_16px]"
                    : "bg-[#2a2520] text-[#e8ddd0] rounded-[16px_4px_16px_16px] border border-[#3a3028]"
                }
              `}
            >
              <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.text) }} />
              <div className="text-[9px] opacity-60 mt-1 text-right font-mono">
                {b.time}
              </div>
            </div>
          </div>
        );
      })}

      {/* Thinking dots */}
      {thinking && (
        <div className="flex justify-start">
          <div className="bg-[#f97316] rounded-[16px_4px_16px_16px] px-4 py-3 flex gap-1 items-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white"
                style={{
                  animation: "thinkPulse 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmation card */}
      {confirm && (
        <div
          className="bg-[#1e1b17] border border-[#f97316] rounded-xl p-3.5 mx-1"
          style={{ animation: "bubbleIn 0.3s ease" }}
        >
          <div className="text-[10px] font-bold text-[#f97316] mb-2 tracking-wide">
            ✦ {confirm.label}
          </div>
          <div
            className="text-[11px] text-[#c8b89a] leading-[1.8] mb-3"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(confirm.detail) }}
          />
          <div className="flex gap-2">
            <button
              onClick={confirm.onConfirm}
              className="flex-1 bg-[#16a34a] text-white text-[11px] font-bold rounded-lg py-2 hover:opacity-90 transition-opacity"
            >
              Looks good ✓
            </button>
            <button
              onClick={() => {
                setConfirm(null);
                addBubble("tyunnie", "No worries, I won't add it 🧡");
              }}
              className="flex-1 bg-transparent border border-[#3a3028] text-[#9a8f7e] text-[11px] font-bold rounded-lg py-2 hover:border-red-800 hover:text-red-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Chat input area (shared between both modes)
  const inputArea = (
    <div className="px-3 pt-3 pb-4 border-t border-[#2a2520] bg-black/30 flex gap-2 shrink-0 relative z-20">
      {/* Mic button */}
      {supported && (
        <button
          onClick={toggleMic}
          title={listening ? "Stop listening" : "Voice input"}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 self-end transition-all ${
            listening
              ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
              : "bg-[#1e1b17] border border-[#3a3028] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]"
          }`}
        >
          {listening ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="currentColor"
            >
              <rect x="2" y="2" width="10" height="10" rx="2" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="4.5" y="1" width="5" height="7" rx="2.5" />
              <path
                d="M2 7c0 2.76 2.24 5 5 5s5-2.24 5-5"
                strokeLinecap="round"
              />
              <line x1="7" y1="12" x2="7" y2="14" strokeLinecap="round" />
            </svg>
          )}
        </button>
      )}

      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={listening ? "Listening..." : "Talk to Tyunnie..."}
        rows={1}
        className={`flex-1 bg-[#1e1b17] border rounded-xl text-[#e8ddd0] text-[11px] md:text-xs px-3 py-2 outline-none resize-none leading-normal placeholder:text-[#4a4038] transition-colors ${
          listening
            ? "border-red-500/40 placeholder:text-red-400/60"
            : "border-[#3a3028] focus:border-[#f97316]"
        }`}
        style={{ minHeight: "36px", maxHeight: "72px" }}
      />

      <button
        onClick={sendChat}
        disabled={thinking || !input.trim()}
        className="w-10 h-10 bg-[#f97316] rounded-xl text-white text-base flex items-center justify-center shrink-0 hover:bg-[#c2500f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
      >
        ↑
      </button>
    </div>
  );

  return (
    <>
      {isFloating && floatPos && !isMobile ? (
        /* ── FLOAT WINDOW MODE ── */
        <div
          style={{
            position: "fixed",
            left: floatPos.x,
            top: floatPos.y,
            width: 400,
            height: 560,
            zIndex: 60,
            boxShadow: "0 8px 32px rgba(var(--accent-rgb),0.18), 0 2px 8px rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
          className="rounded-2xl bg-[#111010] flex flex-col overflow-hidden"
        >
          {/* Radial glow */}
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 100%, rgba(var(--accent-rgb),0.10) 0%, transparent 65%)",
            }}
          />

          {/* Drag handle bar */}
          <div
            onPointerDown={onFloatPointerDown}
            onPointerMove={onFloatPointerMove}
            onPointerUp={onFloatPointerUp}
            style={{ touchAction: "none", cursor: "grab" }}
            className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-[#2a2520] bg-[#1a1714] select-none relative z-10"
          >
            <div className="flex items-center gap-2">
              <Image
                src={currentSprite}
                alt="Tyunnie"
                width={28}
                height={28}
                style={{
                  width: 28,
                  height: "auto",
                  filter: spriteGlow
                    ? "drop-shadow(0 -2px 8px rgba(var(--accent-rgb),0.55))"
                    : "drop-shadow(0 -2px 8px rgba(var(--accent-rgb),0.25))",
                }}
              />
              <span
                className="font-serif italic text-[15px]"
                style={{ color: "var(--accent)" }}
              >
                Tyunnie
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Snap back to bottom sheet */}
              <button
                onClick={() => {
                  setIsFloating(false);
                  localStorage.setItem("tyunnie_float", "false");
                  onOpen?.();
                }}
                title="Snap back to panel"
                className="w-7 h-7 rounded-lg bg-[#1e1b17] border border-[#3a3028] text-[#9a8f7e] hover:text-[#f97316] hover:border-[#f97316] transition-all flex items-center justify-center"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2v6M3.5 5.5L6 8l2.5-2.5" />
                  <path d="M1 10.5h10" />
                </svg>
              </button>
              {/* Close float window — hides panel, preserves chat */}
              <button
                onClick={() => {
                  setIsFloating(false);
                  localStorage.setItem("tyunnie_float", "false");
                }}
                title="Close"
                className="w-7 h-7 rounded-lg bg-[#1e1b17] border border-[#3a3028] text-[#9a8f7e] hover:text-red-400 hover:border-red-800 transition-all text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Float chat body */}
          <div className="flex flex-col flex-1 overflow-hidden min-h-0 relative z-10">
            {briefingSection}
            {chatHistorySection}
            {proactiveSuggestionCard}
            {inputArea}
          </div>
        </div>
      ) : (
        <>
          {/* ── BACKDROP — dims content when panel is open (not fullscreen) ── */}
          <div
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 59,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: isOpen && snapPct > 0 ? "blur(2px)" : "none",
              opacity: isOpen && snapPct > 0 ? 1 : 0,
              pointerEvents: isOpen && snapPct > 0 ? "auto" : "none",
              transition: "opacity 0.3s ease",
            }}
          />

          {/* ── BOTTOM SHEET PANEL ── */}
          <div
            className="fixed z-60 bg-[#111010] flex flex-col overflow-hidden"
            style={{
              bottom: 0,
              left: "50%",
              width: getPanelWidth(),
              height: "100dvh",
              borderRadius: snapPct === 0 ? 0 : "20px 20px 0 0",
              borderTop: snapPct === 0 ? "none" : "1px solid rgba(255,255,255,0.09)",
              borderLeft: snapPct === 0 ? "none" : "1px solid rgba(255,255,255,0.09)",
              borderRight: snapPct === 0 ? "none" : "1px solid rgba(255,255,255,0.09)",
              borderBottom: "none",
              transform: isOpen
                ? `translateX(-50%) translateY(${snapPct}vh)`
                : "translateX(-50%) translateY(100dvh)",
              transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), width 0.35s ease, border-radius 0.3s ease",
              boxShadow:
                "0 -8px 50px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Subtle radial glow */}
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 100%, rgba(var(--accent-rgb),0.10) 0%, transparent 65%)",
              }}
            />

            {/* ── CHAT COLUMN ── */}
            {/* Height = visible portion only — prevents input being hidden below translateY offset */}
            <div
              className="flex flex-col overflow-hidden relative z-10 min-w-0"
              style={{
                height: `${100 - snapPct}dvh`,
                transition: "height 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            >

              {/* ── PANEL HEADER ── */}
              <div className="shrink-0 relative z-10">
                {/* Handle bar — click/tap to cycle snap sizes (desktop only; hidden on mobile with single snap point) */}
                {!isMobile && (
                  <div
                    className="flex flex-col items-center gap-1.5 pt-3 pb-2 cursor-pointer select-none active:opacity-70 transition-opacity"
                    onClick={cycleSnap}
                    title="Click to resize"
                  >
                    {/* Snap indicator — filled segments show how open the panel is */}
                    <div className="flex items-center gap-2">
                      {SNAP_POINTS.map((p, i) => {
                        const currentIdx = SNAP_POINTS.indexOf(snapPct);
                        const isActive = snapPct === p;
                        const isFilled = i <= currentIdx;
                        return (
                          <div
                            key={p}
                            className="rounded-full transition-all duration-300"
                            style={{
                              width: isActive ? 26 : 8,
                              height: 5,
                              background: isActive
                                ? "#f97316"
                                : isFilled
                                ? "rgba(var(--accent-rgb),0.6)"
                                : "rgba(255,255,255,0.2)",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 pb-2.5 pt-0.5 border-b border-[#2a2520]">
                  <span
                    className="font-serif italic text-lg"
                    style={{ color: "var(--accent)" }}
                  >
                    Tyunnie
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Detach button — desktop only */}
                    {!isMobile && (
                      <button
                        onClick={() => {
                          setIsFloating(true);
                          localStorage.setItem("tyunnie_float", "true");
                          onClose?.();
                        }}
                        title="Float panel"
                        className="w-7 h-7 rounded-lg bg-[#1e1b17] border border-[#3a3028] text-[#9a8f7e] hover:text-[#f97316] hover:border-[#f97316] transition-all flex items-center justify-center"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 2H2.5A.5.5 0 0 0 2 2.5v7a.5.5 0 0 0 .5.5h7A.5.5 0 0 0 10 9.5V7" />
                          <path d="M7.5 2H10v2.5" />
                          <path d="M10 2L6 6" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      title="Close"
                      className="w-7 h-7 rounded-lg bg-[#1e1b17] border border-[#3a3028] text-[#9a8f7e] hover:text-red-400 hover:border-red-800 transition-all text-xs flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              {/* ── DAILY BRIEFING CARD (pinned, outside scroll) ── */}
              {briefingSection}

              {/* ── CHAT HISTORY ── */}
              {chatHistorySection}

              {/* ── SPRITE ── */}
              <div className="h-64 shrink-0 relative flex items-end justify-start overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-10 pointer-events-none z-10"
                  style={{ background: "linear-gradient(#111010, transparent)" }}
                />
                <Image
                  src={currentSprite}
                  alt="Tyunnie"
                  width={200}
                  height={256}
                  className="object-contain object-bottom relative z-2 transition-all duration-500 -ml-2"
                  style={{
                    width: "200px",
                    height: "auto",
                    filter: spriteGlow
                      ? "drop-shadow(0 -8px 40px rgba(var(--accent-rgb),0.55)) brightness(1.06)"
                      : "drop-shadow(0 -8px 30px rgba(var(--accent-rgb),0.20))",
                  }}
                  priority
                />
              </div>

              {/* ── PROACTIVE SUGGESTION CARD ── */}
              {proactiveSuggestionCard}

              {/* ── CHAT INPUT ── */}
              {inputArea}
            </div>
            {/* end chat column */}
          </div>
          {/* end panel */}
        </>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes thinkPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </>
  );
}
