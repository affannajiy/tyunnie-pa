// app/demo/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { type Panel } from "@/components/Sidebar";
import TyunniePanel from "@/components/TyunniePanel";
import Calendar from "@/components/Calendar";
import Todo from "@/components/Todo";
import Writing from "@/components/Writing";
import Projects from "@/components/Projects";
import Snippets from "@/components/Snippets";
import Finance from "@/components/Finance";
import Music from "@/components/Music";
import { MusicProvider } from "@/lib/MusicContext";
import Pomodoro from "@/components/Pomodoro";
import Games from "@/components/Games";

import type {
  Event,
  Todo as TodoType,
  Draft,
  Project,
  Snip,
  FinanceEntry,
} from "@/lib/database";

// ── DEMO DATA — pre-populated so it looks good ──
const DEMO_EVENTS: Event[] = [
  {
    id: "1",
    user_id: "demo",
    title: "CS Assignment Due",
    date: new Date().toISOString().split("T")[0],
    time: "11:59 PM",
    created_at: "",
  },
  {
    id: "2",
    user_id: "demo",
    title: "Study Group",
    date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    time: "3:00 PM",
    created_at: "",
  },
];

const DEMO_TODOS: TodoType[] = [
  {
    id: "1",
    user_id: "demo",
    text: "Finish data structures assignment",
    tag: "cs",
    due: new Date(Date.now() + 172800000).toISOString().split("T")[0],
    done: false,
    created_at: "",
  },
  {
    id: "2",
    user_id: "demo",
    text: "Draft essay introduction",
    tag: "write",
    due: null,
    done: false,
    created_at: "",
  },
  {
    id: "3",
    user_id: "demo",
    text: "Buy groceries",
    tag: "personal",
    due: null,
    done: true,
    created_at: "",
  },
];

const DEMO_DRAFTS: Draft[] = [
  {
    id: "1",
    user_id: "demo",
    title: "HCI Essay Draft",
    body: "Human-computer interaction is a discipline concerned with the design and use of computer technology...",
    created_at: new Date().toISOString(),
  },
];

const DEMO_PROJECTS: Project[] = [
  {
    id: "1",
    user_id: "demo",
    name: "Final Year Project",
    status: "active" as const,
    start_date: "2026-01-01",
    end_date: "2026-06-30",
    progress: 35,
    description: "AI-based recommendation system",
    created_at: "",
  },
  {
    id: "2",
    user_id: "demo",
    name: "Personal Portfolio",
    status: "planning" as const,
    start_date: "2026-03-01",
    end_date: "2026-04-30",
    progress: 10,
    description: "Personal website",
    created_at: "",
  },
];

const DEMO_FINANCE: FinanceEntry[] = [
  {
    id: "1",
    user_id: "demo",
    type: "income",
    description: "Part-time salary",
    amount: 800,
    category: "Salary",
    account: "Maybank", // ← add this
    date: new Date().toISOString().split("T")[0],
    created_at: "",
  },
  {
    id: "2",
    user_id: "demo",
    type: "expense",
    description: "Lunch",
    amount: 12.5,
    category: "Food",
    account: "MAE", // ← add this
    date: new Date().toISOString().split("T")[0],
    created_at: "",
  },
  {
    id: "3",
    user_id: "demo",
    type: "expense",
    description: "Bus pass",
    amount: 30,
    category: "Transport",
    account: "TnG", // ← add this
    date: new Date().toISOString().split("T")[0],
    created_at: "",
  },
];

const PANEL_LABELS: Record<Panel, string> = {
  calendar: "Calendar",
  todo: "Tasks",
  writing: "Writing",
  projects: "Projects",
  snippets: "Snip Files",
  finance: "Finance",
  music: "Music",
  pomodoro: "Pomodoro",
  games: "Games",
};

export default function DemoPage() {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<Panel>("calendar");
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tyunnie_theme") === "dark";
  });

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("tyunnie_theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [tyunnieExpanded, setTyunnieExpanded] = useState(false);

  // Demo data state — starts with pre-populated data
  const [events, setEvents] = useState<Event[]>(DEMO_EVENTS);
  const [todos, setTodos] = useState<TodoType[]>(DEMO_TODOS);
  const [drafts, setDrafts] = useState<Draft[]>(DEMO_DRAFTS);
  const [projects] = useState<Project[]>(DEMO_PROJECTS);
  const [snips, setSnips] = useState<Snip[]>([]);
  const [finance, setFinance] = useState<FinanceEntry[]>(DEMO_FINANCE);

  const [financeViewMonth, setFinanceViewMonth] = useState(
    new Date().getMonth(),
  );
  const [financeViewYear, setFinanceViewYear] = useState(
    new Date().getFullYear(),
  );
  const [todoRefreshKey, setTodoRefreshKey] = useState(0);
  const [draftRefreshKey, setDraftRefreshKey] = useState(0);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);
  const [snippetRefreshKey, setSnippetRefreshKey] = useState(0);

  // Demo user ID — fixed so localStorage keys are consistent per browser
  const DEMO_USER_ID = "demo-user";

  // ── TYUNNIE CALLBACKS ── (same logic, just updates local state)
  function handleNavigate(panel: string) {
    if (Object.keys(PANEL_LABELS).includes(panel)) {
      setActivePanel(panel as Panel);
    }
  }

  async function handleEventAdded(ev: {
    title: string;
    date: string;
    time: string;
  }) {
    const newEvent: Event = {
      id: Date.now().toString(),
      user_id: DEMO_USER_ID,
      ...ev,
      created_at: "",
    };
    setEvents((prev) =>
      [...prev, newEvent].sort((a, b) => a.date.localeCompare(b.date)),
    );
    setActivePanel("calendar");
  }

  async function handleTodoAdded(todo: {
    text: string;
    tag: string;
    due: string;
  }) {
    const newTodo: TodoType = {
      id: Date.now().toString(),
      user_id: DEMO_USER_ID,
      text: todo.text,
      tag: todo.tag as TodoType["tag"],
      due: todo.due || null,
      done: false,
      created_at: "",
    };
    setTodos((prev) => [newTodo, ...prev]);
    setTodoRefreshKey((prev) => prev + 1);
  }

  async function handleDraftAdded(draft: { title: string; body: string }) {
    const newDraft: Draft = {
      id: Date.now().toString(),
      user_id: DEMO_USER_ID,
      title: draft.title || "Untitled",
      body: draft.body,
      created_at: new Date().toISOString(),
    };
    setDrafts((prev) => [newDraft, ...prev]);
    setDraftRefreshKey((prev) => prev + 1);
  }

  async function handleFinanceAdded(entry: {
    type: "income" | "expense";
    description: string;
    amount: number;
    category: string;
    date: string;
    account?: string;
  }) {
    const newEntry: FinanceEntry = {
      id: Date.now().toString(),
      user_id: DEMO_USER_ID,
      ...entry,
      account: entry.account ?? "Wallet",
      created_at: "",
    };
    setFinance((prev) => [newEntry, ...prev]);
    setFinanceRefreshKey((prev) => prev + 1);
  }

  async function handleFinanceReset(year: number, month: number) {
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    setFinance((prev) => prev.filter((f) => !f.date.startsWith(monthPrefix)));
    setFinanceRefreshKey((prev) => prev + 1);
  }

  async function handleSnippetAdded(snip: {
    name: string;
    language: string;
    code: string;
  }) {
    const newSnip: Snip = {
      id: Date.now().toString(),
      user_id: DEMO_USER_ID,
      ...snip,
      created_at: new Date().toISOString(),
    };
    setSnips((prev) => [newSnip, ...prev]);
    setSnippetRefreshKey((prev) => prev + 1);
    setActivePanel("snippets");
  }

  return (
    <MusicProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#faf8f5]">
        <Sidebar
          active={activePanel}
          onChange={setActivePanel}
          onSignOut={() => router.push("/auth")}
        />

        <div
          className={`flex flex-col overflow-hidden min-w-0 transition-all duration-300 ease-in-out ${tyunnieExpanded ? "w-0 opacity-0 pointer-events-none flex-none" : "opacity-100 flex-1"}`}
        >
          {/* Topbar */}
          <div className="h-14 bg-white border-b border-[#e8e2d8] flex items-center px-4 md:px-7 gap-3 shrink-0">
            <button
              onClick={() => setTyunnieExpanded(true)}
              className="text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest mr-1 hidden md:block"
            >
              Chat →
            </button>
            <span className="font-serif italic text-xl text-[#111010]">
              Tyunnie
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#f97316] bg-[#fff0e6] border border-[#fed7aa] px-3 py-1 rounded-full">
              {PANEL_LABELS[activePanel]}
            </span>
            {/* Demo badge */}
            <span className="text-[9px] font-bold uppercase tracking-[2px] text-white bg-[#111010] px-3 py-1 rounded-full">
              Demo Mode
            </span>
            <div className="flex-1" />

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="hidden md:flex w-8 h-8 rounded-xl border border-[#e8e2d8] bg-[#faf8f5] items-center justify-center text-sm text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all"
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? "☀️" : "🌙"}
            </button>

            <span className="font-mono text-[11px] text-[#9a8f7e] hidden md:block">
              {new Date().toLocaleDateString("en-MY", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>

            <button
              onClick={() => setShowMobileChat(true)}
              className="md:hidden w-9 h-9 bg-[#f97316] rounded-xl flex items-center justify-center text-white text-base"
            >
              🧡
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-7 pb-24 md:pb-7">
            {activePanel === "calendar" && (
              <Calendar userId={DEMO_USER_ID} onAction={() => {}} />
            )}
            {activePanel === "todo" && (
              <Todo
                userId={DEMO_USER_ID}
                onAction={() => {}}
                refreshKey={todoRefreshKey}
              />
            )}
            {activePanel === "writing" && (
              <Writing
                userId={DEMO_USER_ID}
                onAction={() => {}}
                refreshKey={draftRefreshKey}
              />
            )}
            {activePanel === "projects" && (
              <Projects
                userId={DEMO_USER_ID}
                onAction={() => {}}
                refreshKey={0}
              />
            )}
            {activePanel === "snippets" && (
              <Snippets
                userId={DEMO_USER_ID}
                onAction={() => {}}
                refreshKey={snippetRefreshKey}
              />
            )}
            {activePanel === "finance" && (
              <Finance
                userId={DEMO_USER_ID}
                onAction={() => {}}
                refreshKey={financeRefreshKey}
                viewMonth={financeViewMonth}
                viewYear={financeViewYear}
                onViewChange={(m, y) => {
                  setFinanceViewMonth(m);
                  setFinanceViewYear(y);
                }}
              />
            )}
            {activePanel === "music" && <Music />}
            {activePanel === "pomodoro" && <Pomodoro userId={DEMO_USER_ID} />}
            {activePanel === "games" && <Games />}
          </div>
        </div>

        {/* TyunniePanel */}
        <div
          className={`
        fixed inset-0 z-40 transition-transform duration-300
        md:relative md:inset-auto md:z-auto md:translate-x-0 md:flex md:shrink-0
        ${tyunnieExpanded ? "md:flex-1" : ""}
        ${showMobileChat ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}
        >
          <div
            className="md:hidden absolute inset-0 bg-black/50"
            onClick={() => setShowMobileChat(false)}
          />
          <button
            onClick={() => setShowMobileChat(false)}
            className="md:hidden absolute top-4 left-4 z-50 w-9 h-9 bg-[#2a2520] rounded-xl flex items-center justify-center text-[#9a8f7e] text-lg"
          >
            ✕
          </button>
          <TyunniePanel
            appData={{
              events,
              todos,
              drafts,
              projects,
              snips,
              finance,
              financeViewMonth,
              financeViewYear,
            }}
            onNavigate={handleNavigate}
            onEventAdded={handleEventAdded}
            onTodoAdded={handleTodoAdded}
            onDraftAdded={handleDraftAdded}
            onProjectAdded={() => {}}
            onFinanceAdded={handleFinanceAdded}
            onFinanceReset={handleFinanceReset}
            onSnippetAdded={handleSnippetAdded}
            isExpanded={tyunnieExpanded}
            onToggleExpand={() => setTyunnieExpanded((prev) => !prev)}
          />
        </div>
      </div>
    </MusicProvider>
  );
}
