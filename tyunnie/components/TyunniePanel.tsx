// components/TyunniePanel.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useMusicContext } from "@/lib/MusicContext";
import Image from "next/image";
import type {
  Event,
  Todo,
  Draft,
  Project,
  Snip,
  FinanceEntry,
} from "@/lib/database";

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
  calendar: "/sprites/tyun-celebrating.png",
  todo: "/sprites/tyun-focused.png",
  writing: "/sprites/tyun-writing.png",
  projects: "/sprites/tyun-serious.png",
  snippets: "/sprites/tyun-coding.png",
  finance: "/sprites/tyun-concerned.png",
  music: "/sprites/tyun-happy.png",
};

const MOOD_SPRITES: Record<MoodType, string> = {
  default: "/sprites/tyun-default.png",
  happy: "/sprites/tyun-happy.png",
  concerned: "/sprites/tyun-concerned.png",
  celebrating: "/sprites/tyun-celebrating.png",
  thinking: "/sprites/tyun-thinking.png",
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

// All app data passed in so Tyunnie knows your context
type AppData = {
  events: Event[];
  todos: Todo[];
  drafts: Draft[];
  projects: Project[];
  snips: Snip[];
  finance: FinanceEntry[];
  financeViewMonth?: number;
  financeViewYear?: number;
};

type Props = {
  appData: AppData;
  // Called when Tyunnie triggers a panel switch
  onNavigate: (panel: string) => void;
  // Called when Tyunnie adds an event (after confirmation)
  onEventAdded: (event: { title: string; date: string; time: string }) => void;
  // Called when Tyunnie adds a task
  onTodoAdded: (todo: { text: string; tag: string; due: string }) => void;
  onDraftAdded: (draft: { title: string; body: string }) => void;
  onProjectAdded: (project: {
    name: string;
    status: string;
    description: string;
    start_date: string;
    end_date: string;
    progress: number;
  }) => void;
  onFinanceAdded: (entry: {
    type: "income" | "expense";
    description: string;
    amount: number;
    category: string;
    date: string;
  }) => void;
  onFinanceReset: (year: number, month: number) => void;
  onSnippetAdded: (snip: {
    name: string;
    language: string;
    code: string;
  }) => void;
  activePanel?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

const SPRITE_GREETINGS = [
  "Hey, I'm here 🧡 Talk to me — ask about your balance, add an event, check your drafts. I know everything.",
  "Welcome back! What are we working on today?",
  "Hey you 🧡 I've been waiting. What do you need?",
  "I'm here. What's on your mind?",
];

export default function TyunniePanel({
  appData,
  onNavigate,
  onEventAdded,
  onTodoAdded,
  onDraftAdded,
  onProjectAdded,
  onFinanceAdded,
  onFinanceReset,
  onSnippetAdded,
  activePanel = "calendar",
  isExpanded = false,
  onToggleExpand,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);
  const [spriteGlow, setSpriteGlow] = useState(false);
  const music = useMusicContext();

  const [currentMood, setCurrentMood] = useState<MoodType | null>(null);
  const currentSprite = currentMood
    ? MOOD_SPRITES[currentMood]
    : (PANEL_SPRITES[activePanel] ?? MOOD_SPRITES["default"]);

  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── BREIFING ──
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const briefingFiredRef = useRef(false);

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

  // Scroll to bottom whenever bubbles change
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [bubbles, thinking, confirm]);

  // ── DAILY BRIEFING ──
  useEffect(() => {
    if (briefingFiredRef.current) return;
    if (
      appData.events.length === 0 &&
      appData.todos.length === 0 &&
      appData.finance.length === 0
    )
      return;
    briefingFiredRef.current = true;

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

    const todayEvents = appData.events.filter((e) => e.date === today);
    const overdue = appData.todos.filter(
      (t) => !t.done && t.due && t.due < today,
    );
    const todayTodos = appData.todos.filter((t) => !t.done && t.due === today);
    const balance =
      appData.finance
        .filter((f) => f.type === "income")
        .reduce((s, f) => s + f.amount, 0) -
      appData.finance
        .filter((f) => f.type === "expense")
        .reduce((s, f) => s + f.amount, 0);

    setBriefingLoading(true);
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "briefing" }],
        systemPrompt: `You are Tyunnie, a warm personal assistant. Give a SHORT 1-2 sentence ${timeOfDay} briefing. Be casual and direct like a close friend, no bullet points.
Today: ${today} (${timeOfDay})
Events today: ${todayEvents.length > 0 ? todayEvents.map((e) => e.title).join(", ") : "none"}
Tasks due today: ${todayTodos.length > 0 ? todayTodos.map((t) => t.text).join(", ") : "none"}
Overdue: ${overdue.length > 0 ? overdue.length + " task(s)" : "none"}
Balance: RM${balance.toFixed(2)}
No action blocks. Just a friendly 1-2 sentence greeting that covers what matters most today.`,
      }),
    })
      .then((r) => r.json())
      .then((d) => setBriefing(d.text ?? null))
      .catch(() => setBriefing(null))
      .finally(() => setBriefingLoading(false));
  }, [appData]);

  // ── SYSTEM PROMPT with full app context ──
  function buildSystemPrompt(): string {
    const { events, todos, drafts, projects, snips, finance } = appData;
    const today = new Date().toISOString().split("T")[0];

    const totalIncome = finance
      .filter((f) => f.type === "income")
      .reduce((s, f) => s + f.amount, 0);
    const totalExpenses = finance
      .filter((f) => f.type === "expense")
      .reduce((s, f) => s + f.amount, 0);
    const balance = totalIncome - totalExpenses;

    const upcomingEvents =
      events
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 10)
        .map((e) => `• ${e.date} ${e.time ?? ""}: ${e.title}`)
        .join("\n") || "None";

    const pendingTodos =
      todos
        .filter((t) => !t.done)
        .map((t) => `• [${t.tag}] ${t.text}${t.due ? ` (due ${t.due})` : ""}`)
        .join("\n") || "None";

    const draftList =
      drafts
        .map(
          (d, i) =>
            `${i + 1}. "${d.title}" — ${(d.body ?? "").trim().split(/\s+/).length} words`,
        )
        .join("\n") || "None";

    const projectList =
      projects
        .map(
          (p) =>
            `• ${p.name} [${p.status}] ${p.progress}%${p.start_date ? ` (${p.start_date} → ${p.end_date})` : ""}`,
        )
        .join("\n") || "None";

    const snipList =
      snips.map((s) => `• ${s.name} (${s.language})`).join("\n") || "None";

    const recentFinance =
      finance
        .slice(0, 5)
        .map(
          (f) =>
            `• ${f.type === "income" ? "+" : "-"}RM${f.amount.toFixed(2)} ${f.description} (${f.category})`,
        )
        .join("\n") || "None";

    const viewM = appData.financeViewMonth ?? new Date().getMonth();
    const viewY = appData.financeViewYear ?? new Date().getFullYear();

    return `You are Tyunnie — a warm, caring personal AI assistant based on Taehyun from TXT. You speak like a close, supportive friend. The user is a CS student who loves writing and ideas. Keep all replies short and personal (1–3 sentences max before any action block).

Today: ${today}

=== APP DATA ===

FINANCE:
  Income:   RM${totalIncome.toFixed(2)}
  Expenses: RM${totalExpenses.toFixed(2)}
  Balance:  RM${balance.toFixed(2)}
  Recent:
${recentFinance}

CALENDAR (upcoming):
${upcomingEvents}

TASKS (pending):
${pendingTodos}

DRAFTS:
${draftList}

PROJECTS:
${projectList}

CODE SNIPS:
${snipList}

=== ACTIONS ===
You MUST append an action block at the end of your reply using EXACTLY this format with no variations:
<action>{"type":"ACTION","data":{...}}</action>

CRITICAL: Use the exact characters < and > around the word "action". 
Do NOT use $, [, {, or any other character instead of <.
The format must be exactly: <action> at the start and </action> at the end.

Available actions:
- add_event → ALWAYS show confirmation first. data: { "title":"...", "date":"YYYY-MM-DD", "time":"..." }
- add_todo  → Add immediately, NO confirmation needed. data: { "text":"...", "tag":"cs"|"write"|"personal"|"other", "due":"YYYY-MM-DD or empty string" }
- add_draft → Create a writing draft immediately. data: { "title":"...", "body":"..." }
- add_project → Create a project immediately. data: { "name":"...", "status":"planning"|"active"|"paused"|"done", "description":"...", "start_date":"YYYY-MM-DD or empty", "end_date":"YYYY-MM-DD or empty", "progress": 0 }
- add_finance → Add an income or expense entry immediately. data: { "type":"income"|"expense", "description":"...", "amount": 0.00, "category":"Food"|"Transport"|"Education"|"Entertainment"|"Salary"|"Freelance"|"Utilities"|"Shopping"|"Other", "date":"YYYY-MM-DD" }
- reset_finance → Reset all entries for a specific month. data: { "year": 2026, "month": 3 }
- add_snippet  → Generate and save a code snippet. data: { "name":"filename.py", "language":"py"|"js"|"ts"|"css"|"html"|"sql"|"bash"|"other", "code":"..." }
- navigate  → data: { "panel":"calendar"|"todo"|"writing"|"projects"|"snippets"|"finance"|"music" }
- music_control → Control music. data: { "action":"play"|"pause"|"next"|"prev"|"toggle", "trackName":"..." (optional, for going to a specific song) }

STRICT RULES:
- When user says "add task", "remind me to", "add to my todo", "create a task" → ALWAYS include add_todo action
- For add_todo: add it silently and immediately, tell the user it's done
- For add_event: always confirm details first before adding
- For financial questions: quote the exact RM balance from the data
- NEVER mention "action block" or "JSON" to the user
- The action block MUST be the very last thing in your response, on its own line
- Example of correct add_todo response:
  Done! I've added "Feed Cats" to your tasks 🧡
  <action>{"type":"add_todo","data":{"text":"Feed Cats","tag":"personal","due":""}}</action>
  When user says "make a draft", "create a draft", "write a template", "start a draft" → ALWAYS include add_draft action
- For add_draft: create it immediately, tell the user it's saved
- Example of correct add_draft response:
  Done! I've created your draft "Meeting Notes" 🧡
  <action>{"type":"add_draft","data":{"title":"Meeting Notes","body":"Title:\n\nWritten by:\n\nBody:\n"}}</action>
- When user says "add project", "create a project", "new project", "track a project" → ALWAYS include add_project action
- For add_project: create it immediately, tell the user it's added
- Example of correct add_project response:
  Done! I've added "Final Year Project" to your projects 🗂️
  <action>{"type":"add_project","data":{"name":"Final Year Project","status":"planning","description":"","start_date":"","end_date":"","progress":0}}</action>
  When user says "add expense", "I spent", "I bought", "add income", "I earned", "I received" → ALWAYS include add_finance action
- For add_finance: add it immediately, tell the user the entry is logged and their new balance
- Example of correct add_finance expense response:
  Logged! RM12.50 for lunch. 🧡
  <action>{"type":"add_finance","data":{"type":"expense","description":"Lunch","amount":12.50,"category":"Food","date":"2026-03-18"}}</action>
- Example of correct add_finance income response:
  Nice, RM500 freelance income added! 💰
  <action>{"type":"add_finance","data":{"type":"income","description":"Freelance payment","amount":500.00,"category":"Freelance","date":"2026-03-18"}}</action>
- When user says "code me", "write a", "generate a", "show me how to", "give me a snippet" → ALWAYS include add_snippet action with the full working code in the "code" field
- For add_snippet: write clean, complete, working code. Use proper newlines (\n) inside the code string.
- Example of correct add_snippet response:
  Here's a simple for loop in Python 🧡
  <action>{"type":"add_snippet","data":{"name":"for_loop.py","language":"py","code":"# Simple for loop\nfor i in range(5):\n    print(f'Number: {i}')"}}</action>
- When user says "reset finance", "clear this month", "reset my expenses", "start fresh" → ALWAYS include reset_finance action
- For reset_finance: use the CURRENTLY VIEWED month (${MONTHS[viewM]} ${viewY})
- Example:
  Done, all entries for ${MONTHS[viewM]} ${viewY} have been cleared 🧡
  <action>{"type":"reset_finance","data":{"year":${viewY},"month":${viewM + 1}}}</action>
- When user says "play music", "play the song", "resume" → music_control with "play"
- When user says "pause", "stop the music", "pause the song" → music_control with "pause"
- When user says "next song", "skip", "next track" → music_control with "next"
- When user says "previous", "go back", "prev song", "last song" → music_control with "prev"
- When user says "toggle music", "play or pause" → music_control with "toggle"
- Example:
  Done, playing your music 🎵
  <action>{"type":"music_control","data":{"action":"play"}}</action>
- When user says "go back to [song]", "play [song name]", "switch to [song]" → music_control with "play" and include "trackName"
- Example:
  Switching to that track for you 🎵
  <action>{"type":"music_control","data":{"action":"play","trackName":"Song Name"}}</action>`;
  }

  // ── PARSE AND EXECUTE ACTION ──
  function executeAction(raw: string) {
    try {
      const action = JSON.parse(raw.trim());

      switch (action.type) {
        case "navigate":
          onNavigate(action.data.panel);
          break;

        case "add_event": {
          setCurrentMood("thinking");
          const d = action.data;
          setConfirm({
            label: "Add to Calendar?",
            detail: `
              <strong>📅 ${d.title}</strong><br/>
              Date: <strong>${d.date}</strong><br/>
              Time: <strong>${d.time || "Not specified"}</strong>
            `,
            onConfirm: () => {
              onEventAdded({
                title: d.title,
                date: d.date,
                time: d.time ?? "",
              });
              setConfirm(null);
              addBubble(
                "tyunnie",
                `Done! "${d.title}" is now on your calendar 📅`,
                "celebrating",
              );
            },
          });
          break;
        }

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          systemPrompt: buildSystemPrompt(),
        }),
      });

      const data = await res.json();
      const fullReply: string = data.text ?? "I'm here 🧡";

      console.log("Full reply from AI:", fullReply); // DEBUG

      const normalized = fullReply
        .replace(/\$action>/gi, "<action>")
        .replace(/\$\/action>/gi, "</action>")
        .replace(/\[action\]/gi, "<action>")
        .replace(/\[\/action\]/gi, "</action>");

      // Strip the action block from the visible message
      const actionMatch = normalized.match(/<action>([\s\S]*?)<\/action>/);
      const cleanMessage = normalized
        .replace(/<action>[\s\S]*?<\/action>/g, "")
        .trim();

      console.log("Clean reply from AI:", cleanMessage); // DEBUG

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
        console.log("Action found:", actionMatch[1]); // keep this for debugging
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
  return (
    <div
      className={`${isExpanded ? "flex-1 flex-row" : "w-75 shrink-0 flex-col"} bg-[#111010] flex overflow-hidden border-l border-[#2a2520] relative`}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(249,115,22,0.10) 0%, transparent 65%)",
        }}
      />

      {/* ── EXPANDED SPRITE COLUMN (left side when expanded) ── */}
      <div
        className={`shrink-0 flex flex-col overflow-hidden border-r border-[#2a2520] relative z-10 transition-all duration-300 ease-in-out ${isExpanded ? "w-72 h-full opacity-100" : "w-0 h-0 opacity-0"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2520] shrink-0">
          <span className="font-serif italic text-[#f97316] text-lg">
            Tyunnie
          </span>
          <button
            onClick={onToggleExpand}
            className="w-8 h-8 rounded-xl bg-[#1e1b17] border border-[#3a3028] text-[#9a8f7e] hover:text-[#f97316] hover:border-[#f97316] transition-all text-sm flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Mini player in expanded view */}
        {music.currentTrack && (
          <div className="shrink-0 px-3 pt-3 pb-2 border-b border-[#2a2520]">
            <div className="bg-[#1a1410] rounded-xl px-3 py-2 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-[#2a2520]">
                {music.currentTrack.cover ? (
                  <Image
                    src={music.currentTrack.cover}
                    alt=""
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#4a4038] text-xs">
                    🎵
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-white truncate leading-tight">
                  {music.currentTrack.title}
                </div>
                <div className="text-[9px] text-[#9a8f7e] font-mono truncate leading-tight">
                  {music.currentTrack.artist}
                </div>
                <div className="h-0.5 bg-[#2a2520] rounded-full mt-1 overflow-hidden">
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
                  className="w-6 h-6 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-xs"
                >
                  ⏮
                </button>
                <button
                  onClick={music.togglePlay}
                  className="w-7 h-7 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs hover:bg-[#c2500f] transition-colors"
                >
                  {music.isPlaying ? "⏸" : "▶"}
                </button>
                <button
                  onClick={music.nextTrack}
                  className="w-6 h-6 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-xs"
                >
                  ⏭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Big sprite — fills remaining space */}
        <div className="flex-1 relative flex items-end justify-start overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 100%, rgba(249,115,22,0.15) 0%, transparent 65%)",
            }}
          />
          <Image
            src={currentSprite}
            alt="Tyunnie"
            width={260}
            height={330}
            className="object-contain object-bottom relative z-2 transition-all duration-500"
            style={{
              filter: spriteGlow
                ? "drop-shadow(0 -8px 40px rgba(249,115,22,0.55)) brightness(1.06)"
                : "drop-shadow(0 -8px 30px rgba(249,115,22,0.20))",
            }}
            priority
          />
        </div>
      </div>

      {/* ── CHAT COLUMN (right side when expanded, full column when collapsed) ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0">
        {/* Mini player — only in collapsed mode */}
        {music.currentTrack && !isExpanded && (
          <div className="shrink-0 px-3 pt-3 pb-2 border-b border-[#2a2520]">
            <div className="bg-[#1a1410] rounded-xl px-3 py-2 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-[#2a2520]">
                {music.currentTrack.cover ? (
                  <Image
                    src={music.currentTrack.cover}
                    alt=""
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#4a4038] text-xs">
                    🎵
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-white truncate leading-tight">
                  {music.currentTrack.title}
                </div>
                <div className="text-[9px] text-[#9a8f7e] font-mono truncate leading-tight">
                  {music.currentTrack.artist}
                </div>
                <div className="h-0.5 bg-[#2a2520] rounded-full mt-1 overflow-hidden">
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
                  className="w-6 h-6 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-xs"
                >
                  ⏮
                </button>
                <button
                  onClick={music.togglePlay}
                  className="w-7 h-7 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs hover:bg-[#c2500f] transition-colors"
                >
                  {music.isPlaying ? "⏸" : "▶"}
                </button>
                <button
                  onClick={music.nextTrack}
                  className="w-6 h-6 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-xs"
                >
                  ⏭
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── DAILY BRIEFING CARD (pinned, outside scroll) ── */}
        {briefingLoading && (
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
        {briefing && !briefingLoading && (
          <div className="shrink-0 px-3 pt-3 pb-1">
            <div
              className={`bg-[#1e1b17] border border-[#f97316]/30 rounded-[4px_16px_16px_16px] px-3.5 py-2.5 ${isExpanded ? "max-w-lg" : "max-w-52.5"}`}
            >
              <div className="text-[9px] font-bold text-[#f97316] uppercase tracking-widest mb-1.5 font-mono">
                Daily briefing
              </div>
              <p className="text-[12px] text-[#c8b89a] leading-[1.7]">
                {briefing}
              </p>
            </div>
          </div>
        )}

        {/* ── CHAT HISTORY ── */}
        <div
          ref={historyRef}
          className="flex-1 overflow-y-auto px-3 pt-3 pb-2 flex flex-col gap-2.5 relative min-h-0"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#2a2520 transparent",
          }}
        >
          <div className="flex-1" />
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
                    ${isExpanded ? "max-w-lg" : "max-w-52.5"} px-3.5 py-2.5 text-[12.5px] leading-[1.7] font-medium
                    ${
                      b.who === "tyunnie"
                        ? "bg-[#f97316] text-white rounded-[4px_16px_16px_16px]"
                        : "bg-[#2a2520] text-[#e8ddd0] rounded-[16px_4px_16px_16px] border border-[#3a3028]"
                    }
                  `}
                >
                  <span dangerouslySetInnerHTML={{ __html: b.text }} />
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
                dangerouslySetInnerHTML={{ __html: confirm.detail }}
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

        {/* ── SPRITE (collapsed only) ── */}
        {!isExpanded && (
          <div className="h-67.5 shrink-0 relative flex items-end justify-start overflow-hidden">
            <button
              onClick={onToggleExpand}
              className="absolute top-3 right-3 z-20 w-7 h-7 rounded-lg bg-[#1e1b17] border border-[#3a3028] text-[#9a8f7e] hover:text-[#f97316] hover:border-[#f97316] transition-all text-xs flex items-center justify-center"
              title="Expand chat"
            >
              ↗
            </button>
            <div
              className="absolute top-0 left-0 right-0 h-14 pointer-events-none z-10"
              style={{ background: "linear-gradient(#111010, transparent)" }}
            />
            <Image
              src={currentSprite}
              alt="Tyunnie"
              width={180}
              height={230}
              className="object-contain object-top relative z-2 transition-all duration-500 -ml-2"
              style={{
                filter: spriteGlow
                  ? "drop-shadow(0 -8px 40px rgba(249,115,22,0.55)) brightness(1.06)"
                  : "drop-shadow(0 -8px 30px rgba(249,115,22,0.20))",
              }}
              priority
            />
          </div>
        )}

        {/* ── CHAT INPUT ── */}
        <div className="px-3 py-3 border-t border-[#2a2520] bg-black/30 flex gap-2 shrink-0">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to Tyunnie..."
            rows={1}
            className="flex-1 bg-[#1e1b17] border border-[#3a3028] rounded-xl text-[#e8ddd0] text-xs px-3 py-2.5 outline-none resize-none leading-normal placeholder:text-[#4a4038] transition-colors focus:border-[#f97316]"
            style={{ minHeight: "40px", maxHeight: "80px" }}
          />
          <button
            onClick={sendChat}
            disabled={thinking || !input.trim()}
            className="w-10 h-10 bg-[#f97316] rounded-xl text-white text-base flex items-center justify-center shrink-0 hover:bg-[#c2500f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            ↑
          </button>
        </div>
      </div>
      {/* end chat column */}

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
    </div>
  );
}
