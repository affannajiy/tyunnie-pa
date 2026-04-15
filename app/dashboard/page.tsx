// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

import dynamic from "next/dynamic";
import Desk from "@/components/Desk";
import Sidebar, { type Panel } from "@/components/Sidebar";
import { MusicProvider } from "@/lib/MusicContext";
import { getProfile, type Profile as ProfileType } from "@/lib/database";
import {
  getStickyNotes,
  completeTodo,
  updateProjectProgress,
  updateStickyNote,
  getMemories,
  addMemory,
  deleteMemory,
} from "@/lib/database";
import type { Memory } from "@/lib/database";
import type { StickyNote } from "@/lib/database";
import type { TyunniePanelProps } from "@/lib/tyunniePanelTypes";

// Heavy panels — loaded only when first visited
const TyunniePanel  = dynamic<TyunniePanelProps>(() => import("@/components/TyunniePanel"), { ssr: false });
const Todo          = dynamic(() => import("@/components/Todo"),               { ssr: false });
const Writing       = dynamic(() => import("@/components/Writing"),            { ssr: false });
const Projects      = dynamic(() => import("@/components/Projects"),           { ssr: false });
const Snippets      = dynamic(() => import("@/components/Snippets"),           { ssr: false });
const Finance       = dynamic(() => import("@/components/Finance"),            { ssr: false });
const Music         = dynamic(() => import("@/components/Music"),              { ssr: false });
const Pomodoro      = dynamic(() => import("@/components/Pomodoro"),           { ssr: false });
const Games         = dynamic(() => import("@/components/Games"),              { ssr: false });
const Weather       = dynamic(() => import("@/components/Weather"),            { ssr: false });
const Profile       = dynamic(() => import("@/components/Profile"),            { ssr: false });
const ProductivityHub   = dynamic(() => import("@/components/ProductivityHub"),    { ssr: false });
const EntertainmentHub  = dynamic(() => import("@/components/EntertainmentHub"),   { ssr: false });
const StickyLayer   = dynamic(() => import("@/components/StickyLayer"),        { ssr: false });
const FocusMode     = dynamic(() => import("@/components/FocusMode"),          { ssr: false });
const MiniPlayer    = dynamic(() => import("@/components/MiniPlayer"),         { ssr: false });

import {
  getTodos,
  getDrafts,
  getProjects,
  getSnips,
  getFinanceEntries,
  addTodo,
  toggleTodo,
  updateTodo,
  deleteTodo,
  addDraft,
  deleteDraft,
  addProject,
  deleteProject,
  addFinanceEntry,
  deleteFinanceEntry,
  addSnip,
  deleteSnip,
  type Todo as TodoType,
  type Draft,
  type Project,
  type Snip,
  type FinanceEntry,
} from "@/lib/database";

const PANEL_LABELS: Record<Panel, string> = {
  desk: "Home",
  productivity: "Productivity",
  entertainment: "Entertainment",
  profile: "Profile",
  todo: "Tasks",
  writing: "Writing",
  projects: "Projects",
  snippets: "Snip Files",
  finance: "Finance",
  music: "Music",
  pomodoro: "Pomodoro",
  games: "Games",
};

export default function Home() {
  const router = useRouter();
  const [tyunniePrefill, setTyunniePrefill] = useState<string | undefined>(
    undefined,
  );

  // ── SEARCH ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── AUTH ──
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── PROFILE ──
  const [profile, setProfile] = useState<ProfileType | null>(null);

  // ── PANEL ──
  const [activePanel, setActivePanel] = useState<Panel>(() => {
    if (typeof window === "undefined") return "desk";
    const params = new URLSearchParams(window.location.search);
    const panel = params.get("panel");
    if (panel && Object.keys(PANEL_LABELS).includes(panel)) {
      return panel as Panel;
    }
    return "desk";
  });

  // ── USERNAME ──
  const [userName, setUserName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("tyunnie_username") ?? "";
  });

  // ── THEME ──
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

  // ── AVATAR ──
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // ── SHORTCUTS ──
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── APP DATA ──
  // All data lives here so TyunniePanel always has up-to-date context
  const [todos, setTodos] = useState<TodoType[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [snips, setSnips] = useState<Snip[]>([]);
  const [finance, setFinance] = useState<FinanceEntry[]>([]);
  const [financeViewMonth, setFinanceViewMonth] = useState(
    new Date().getMonth(),
  );
  const [financeViewYear, setFinanceViewYear] = useState(
    new Date().getFullYear(),
  );
  const [todoRefreshKey, setTodoRefreshKey] = useState(0);
  const [draftRefreshKey, setDraftRefreshKey] = useState(0);
  const [tyunnieOpen, setTyunnieOpen] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);
  const [snippetRefreshKey, setSnippetRefreshKey] = useState(0);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [pomodoroTask, setPomodoroTask] = useState<string>("");
  const [pomodoroKey, setPomodoroKey] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);

  // ── CHECK AUTH ON MOUNT ──
  // Handle OAuth error redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      console.error("OAuth error:", params.get("error_description"));
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        supabase.auth.signOut();
        router.push("/auth");
      } else {
        setUser(data.user);
        setAuthLoading(false); // ← this must run
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
        router.push("/auth");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // ──── PAGE REFRESH ───
  useEffect(() => {
    sessionStorage.setItem("visitedDashboard", "true");
  }, []);

  // ── KEYBOARD SHORTCUTS ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable;

      // Existing
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setShowShortcuts(false);
        setTyunnieOpen(false);
      }

      // Skip everything below if user is typing in a field
      if (isTyping) return;

      // ? to toggle shortcuts panel
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      // Cmd/Ctrl + 1-9 for panels
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const panels: Panel[] = [
          "desk",
          "productivity",
          "entertainment",
          "profile",
        ];
        const target = panels[parseInt(e.key) - 1];
        if (target) setActivePanel(target);
      }

      // Cmd/Ctrl + P for profile
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setActivePanel("profile");
      }

      // Cmd/Ctrl + / to toggle Tyunnie chat
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setTyunnieOpen((prev) => !prev);
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const searchResults =
    searchQuery.trim().length < 2
      ? []
      : (() => {
          const q = searchQuery.toLowerCase();
          const results: {
            type: string;
            label: string;
            sub: string;
            panel: Panel;
            icon: string;
          }[] = [];

          // ── Panel shortcuts ──
          const PANEL_SHORTCUTS: {
            keywords: string[];
            label: string;
            sub: string;
            panel: Panel;
            icon: string;
          }[] = [
            {
              keywords: ["todo", "tasks", "task", "remind"],
              label: "Tasks",
              sub: "View your to-do list",
              panel: "todo",
              icon: "✅",
            },
            {
              keywords: ["writing", "drafts", "draft", "write"],
              label: "Writing",
              sub: "View your drafts",
              panel: "writing",
              icon: "✍️",
            },
            {
              keywords: ["projects", "project"],
              label: "Projects",
              sub: "View your projects",
              panel: "projects",
              icon: "🗂️",
            },
            {
              keywords: ["snippets", "snips", "code", "snippet"],
              label: "Snippets",
              sub: "View your code snippets",
              panel: "snippets",
              icon: "⌨️",
            },
            {
              keywords: ["finance", "money", "budget", "expenses", "income"],
              label: "Finance",
              sub: "View your finance tracker",
              panel: "finance",
              icon: "💰",
            },
            {
              keywords: ["music", "songs", "playlist"],
              label: "Music",
              sub: "Open music player",
              panel: "music",
              icon: "🎵",
            },
            {
              keywords: ["pomodoro", "focus", "timer", "study"],
              label: "Pomodoro",
              sub: "Start a focus session",
              panel: "pomodoro",
              icon: "⏲️",
            },
            {
              keywords: [
                "games",
                "game",
                "play",
                "tictactoe",
                "tic tac toe",
                "minesweeper",
                "mines",
                "sudoku",
                "solitaire",
                "cards",
              ],
              label: "Games",
              sub: "Play a minigame",
              panel: "games",
              icon: "🎮",
            },
          ];

          PANEL_SHORTCUTS.forEach(({ keywords, label, sub, panel, icon }) => {
            if (keywords.some((k) => k.includes(q) || q.includes(k))) {
              results.push({ type: "Panel", label, sub, panel, icon });
            }
          });

          // ── Data results ──
          todos
            .filter((t) => t.text.toLowerCase().includes(q))
            .forEach((t) =>
              results.push({
                type: "Task",
                label: t.text,
                sub: `[${t.tag}]${t.due ? " · due " + t.due : ""}`,
                panel: "todo",
                icon: "✅",
              }),
            );
          drafts
            .filter(
              (d) =>
                d.title.toLowerCase().includes(q) ||
                (d.body ?? "").toLowerCase().includes(q),
            )
            .forEach((d) =>
              results.push({
                type: "Draft",
                label: d.title,
                sub: `${(d.body ?? "").trim().split(/\s+/).length} words`,
                panel: "writing",
                icon: "✍️",
              }),
            );
          projects
            .filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.description ?? "").toLowerCase().includes(q),
            )
            .forEach((p) =>
              results.push({
                type: "Project",
                label: p.name,
                sub: `${p.status} · ${p.progress}%`,
                panel: "projects",
                icon: "🗂️",
              }),
            );
          snips
            .filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                (s.code ?? "").toLowerCase().includes(q),
            )
            .forEach((s) =>
              results.push({
                type: "Snippet",
                label: s.name,
                sub: s.language,
                panel: "snippets",
                icon: "⌨️",
              }),
            );
          finance
            .filter(
              (f) =>
                f.description.toLowerCase().includes(q) ||
                f.category.toLowerCase().includes(q),
            )
            .forEach((f) =>
              results.push({
                type: "Finance",
                label: f.description,
                sub: `${f.type === "income" ? "+" : "-"}RM${f.amount.toFixed(2)} · ${f.category}`,
                panel: "finance",
                icon: "💰",
              }),
            );

          return results.slice(0, 12);
        })();

  // ── ACCENT COLOR — apply hex to CSS vars + localStorage ──
  function applyAccentColor(hex: string) {
    const ri = parseInt(hex.slice(1, 3), 16);
    const gi = parseInt(hex.slice(3, 5), 16);
    const bi = parseInt(hex.slice(5, 7), 16);
    const r = ri / 255, g = gi / 255, b = bi / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    const hd = Math.round(h * 360), sp = Math.round(s * 100), lp = Math.round(l * 100);
    function hsl2hex(hh: number, ss: number, ll: number) {
      const sn = ss / 100, ln = ll / 100, a = sn * Math.min(ln, 1 - ln);
      const f = (n: number) => { const k = (n + hh / 30) % 12; return Math.round(255 * (ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, "0"); };
      return `#${f(0)}${f(8)}${f(4)}`;
    }
    const root = document.documentElement;
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-soft", hsl2hex(hd, Math.min(sp + 10, 100), Math.min(lp + 42, 97)));
    root.style.setProperty("--accent-mid", hsl2hex(hd, Math.min(sp + 5, 100), Math.min(lp + 28, 90)));
    root.style.setProperty("--accent-dim", hsl2hex(hd, Math.min(sp + 5, 100), Math.max(lp - 18, 15)));
    root.style.setProperty("--accent-rgb", `${ri}, ${gi}, ${bi}`);
    localStorage.setItem("tyunnie_accent", hex);
  }

  // ── LOAD ALL DATA once we have a user ──
  useEffect(() => {
    if (!user) return;

    async function loadAll() {
      const [td, dr, pr, sn, fi, stickies, mems] = await Promise.all([
        getTodos(user!.id),
        getDrafts(user!.id),
        getProjects(user!.id),
        getSnips(user!.id),
        getFinanceEntries(user!.id),
        getStickyNotes(user!.id),
        getMemories(user!.id),
      ]);
      const prof = await getProfile(user!.id);
      setProfile(prof);
      if (prof?.avatar_url) setAvatarUrl(prof.avatar_url);
      if (prof) {
        if (prof.display_name) setUserName(prof.display_name);
        if (prof.theme === "dark" && !isDark) toggleTheme();
        if (prof.city && prof.city_lat && prof.city_lon) {
          localStorage.setItem(
            "tyunnie_city",
            JSON.stringify({
              lat: prof.city_lat,
              lon: prof.city_lon,
              city: prof.city,
            }),
          );
        }
        if (prof.accent_color) {
          applyAccentColor(prof.accent_color);
        }
      }
      setTodos(td);
      setDrafts(dr);
      setProjects(pr);
      setSnips(sn);
      setFinance(fi);
      setStickyNotes(stickies);
      setMemories(mems);
    }
    loadAll();
  }, [user]);

  // ── SIGN OUT ──
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  // ── TYUNNIE CALLBACKS ──
  // Called when Tyunnie navigates to a panel
  function handleNavigate(panel: string) {
    if (Object.keys(PANEL_LABELS).includes(panel)) {
      setActivePanel(panel as Panel);
    }
  }
  // Called when Tyunnie adds a task
  async function handleTodoAdded(todo: {
    text: string;
    tag: string;
    due: string;
  }) {
    if (!user) return;
    const newTodo = await addTodo(user.id, {
      text: todo.text,
      tag: todo.tag,
      due: todo.due || null,
    });
    if (newTodo) {
      setTodos((prev) => [newTodo, ...prev]);
      setTodoRefreshKey((prev) => prev + 1); // ← bump this
    }
  }

  async function handleTodoToggle(id: string, done: boolean) {
    const { toggleTodo } = await import("@/lib/database");
    await toggleTodo(id, done);
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
  }

  async function handleDraftAdded(draft: { title: string; body: string }) {
    if (!user) return;
    const newDraft = await addDraft(user.id, {
      title: draft.title || "Untitled",
      body: draft.body,
    });
    if (newDraft) {
      setDrafts((prev) => [newDraft, ...prev]);
      setDraftRefreshKey((prev) => prev + 1);
    }
  }

  async function handleProjectAdded(project: {
    name: string;
    status: string;
    description: string;
    start_date: string;
    end_date: string;
    progress: number;
  }) {
    if (!user) return;
    const newProject = await addProject(user.id, {
      name: project.name,
      status: project.status,
      description: project.description,
      start_date: project.start_date || null,
      end_date: project.end_date || null,
      progress: project.progress,
    });
    if (newProject) {
      setProjectRefreshKey((prev) => prev + 1);
    }
  }

  async function handleFinanceAdded(entry: {
    type: "income" | "expense";
    description: string;
    amount: number;
    category: string;
    date: string;
    account?: string;
  }) {
    if (!user) return;
    const newEntry = await addFinanceEntry(user.id, entry);
    if (newEntry) {
      setFinance((prev) => [newEntry, ...prev]);
      setFinanceRefreshKey((prev) => prev + 1);
    }
  }

  async function handleFinanceReset(year: number, month: number) {
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const toDelete = finance.filter((f) => f.date.startsWith(monthPrefix));
    await Promise.all(toDelete.map((f) => deleteFinanceEntry(f.id)));
    setFinance((prev) => prev.filter((f) => !f.date.startsWith(monthPrefix)));
    setFinanceRefreshKey((prev) => prev + 1);
  }

  async function handleSnippetAdded(snip: {
    name: string;
    language: string;
    code: string;
  }) {
    if (!user) return;
    const newSnip = await addSnip(user.id, snip);
    if (newSnip) {
      setSnips((prev) => [newSnip, ...prev]);
      setSnippetRefreshKey((prev) => prev + 1);
      setActivePanel("snippets"); // auto-navigate to snippets panel
    }
  }

  async function handleTodoCompleted(id: string) {
    await completeTodo(id);
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: true } : t)),
    );
    setTodoRefreshKey((prev) => prev + 1);
  }

  async function handleProjectUpdated(
    id: string,
    progress: number,
    status?: string,
  ) {
    await updateProjectProgress(id, progress, status);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              progress,
              ...(status ? { status: status as Project["status"] } : {}),
            }
          : p,
      ),
    );
    setProjectRefreshKey((prev) => prev + 1);
  }

  async function handleStickyUpdated(id: string, content: string) {
    await updateStickyNote(id, { content });
    setStickyNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content } : n)),
    );
  }

  function handlePomodoroStart(task: string) {
    setPomodoroTask(task);
    setPomodoroKey((k) => k + 1);
    sessionStorage.setItem("pomodoro_autostart", "1");
    setActivePanel("pomodoro");
  }

  async function handleTodoDeleted(id: string) {
    await deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    setTodoRefreshKey((k) => k + 1);
  }

  async function handleTodoUpdated(id: string, patch: { text?: string; tag?: string; due?: string | null }) {
    await updateTodo(id, patch);
    setTodos((prev) => prev.map((t) =>
      t.id === id ? { ...t, ...patch, tag: (patch.tag ?? t.tag) as TodoType["tag"] } : t,
    ));
    setTodoRefreshKey((k) => k + 1);
  }

  async function handleDraftDeleted(id: string) {
    await deleteDraft(id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setDraftRefreshKey((k) => k + 1);
  }

  async function handleProjectDeleted(id: string) {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setProjectRefreshKey((k) => k + 1);
  }

  async function handleSnippetDeleted(id: string) {
    await deleteSnip(id);
    setSnips((prev) => prev.filter((s) => s.id !== id));
    setSnippetRefreshKey((k) => k + 1);
  }

  async function handleFinanceDeleted(id: string) {
    await deleteFinanceEntry(id);
    setFinance((prev) => prev.filter((f) => f.id !== id));
    setFinanceRefreshKey((k) => k + 1);
  }

  // ── LOADING SCREEN ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="text-center">
          <div className="font-serif italic text-4xl text-[#f97316] mb-3">
            Tyunnie
          </div>
          <div className="text-sm text-[#9a8f7e]">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ── MAIN APP ──
  return (
    <MusicProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#faf8f5]">
        <Sidebar
          active={activePanel}
          onChange={(panel) => setActivePanel(panel)}
          onSignOut={handleSignOut}
          userName={userName}
          avatarUrl={avatarUrl}
          tyunnieOpen={tyunnieOpen}
          onTyunnieToggle={() => setTyunnieOpen((v) => !v)}
          onNewSticky={async () => {
            const { createStickyNote } = await import("@/lib/database");
            const offset = (stickyNotes.length % 6) * 24;
            const note = await createStickyNote(user.id, 120 + offset, 120 + offset);
            if (note) setStickyNotes((prev) => [...prev, note]);
          }}
        />

        {/* Main content */}
        <div className="flex flex-col overflow-hidden min-w-0 flex-1">
          {/* Topbar */}
          <div className="h-14 bg-white border-b border-[#e8e2d8] flex items-center px-4 md:px-7 shrink-0 relative">
            {/* Left — Tyunnie + panel badge */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.refresh()}
                className="font-serif italic text-xl text-[#111010] hover:text-[#f97316] transition-colors"
              >
                Tyunnie
              </button>
              <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#f97316] bg-[#fff0e6] border border-[#fed7aa] px-3 py-1 rounded-full">
                {PANEL_LABELS[activePanel]}
              </span>
            </div>

            {/* Search — absolutely centered */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-1.5 text-xs text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all font-mono w-48 lg:w-64 xl:w-80"
              >
                <span>🔍</span>
                <span>Search</span>
                <span className="bg-[#e8e2d8] rounded px-1.5 py-0.5 text-[9px] font-bold">
                  ⌘K
                </span>
              </button>
            </div>

            {/* Right side group */}
            <div className="ml-auto hidden md:flex items-center gap-3">
              <button
                onClick={() => setShowShortcuts(true)}
                title="Keyboard shortcuts"
                className="flex items-center justify-center w-8 h-8 rounded-xl border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all font-mono text-xs font-bold"
              >
                ?
              </button>
              <Weather />
              <span className="font-mono text-[11px] text-[#9a8f7e]">
                {new Date().toLocaleDateString("en-MY", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            {/* Mobile chat toggle */}
            <button
              onClick={() => setTyunnieOpen((v) => !v)}
              className="md:hidden ml-auto w-9 h-9 rounded-xl flex items-center justify-center text-white text-base transition-all"
              style={{ background: tyunnieOpen ? "var(--accent-dim)" : "var(--accent)" }}
            >
              🧡
            </button>
          </div>

          {/* Panel content — pb for mobile tab bar and desktop dock */}
          <div className="flex-1 overflow-y-auto p-4 md:p-7 pb-24 md:pb-28">
            <>
              {activePanel === "desk" && (
                <Desk
                  profile={profile}
                  userName={userName}
                  todos={todos}
                  projects={projects}
                  finance={finance}
                  financeViewMonth={financeViewMonth}
                  financeViewYear={financeViewYear}
                  onNavigate={(panel) => setActivePanel(panel)}
                  onTodoToggle={handleTodoToggle}
                  onFocusMode={() => setFocusMode(true)}
                />
              )}
              {activePanel === "productivity" && (
                <ProductivityHub
                  onNavigate={(panel) => setActivePanel(panel as Panel)}
                />
              )}
              {activePanel === "entertainment" && (
                <EntertainmentHub
                  onNavigate={(panel) => setActivePanel(panel as Panel)}
                />
              )}
              {activePanel === "todo" && (
                <Todo
                  userId={user.id}
                  onAction={() => {}}
                  refreshKey={todoRefreshKey}
                />
              )}
              {activePanel === "writing" && (
                <Writing
                  userId={user.id}
                  onAction={() => {}}
                  refreshKey={draftRefreshKey}
                />
              )}
              {activePanel === "projects" && (
                <Projects
                  userId={user.id}
                  onAction={() => {}}
                  refreshKey={projectRefreshKey}
                />
              )}
              {activePanel === "snippets" && (
                <Snippets
                  userId={user.id}
                  onAction={() => {}}
                  refreshKey={snippetRefreshKey}
                />
              )}
              {activePanel === "finance" && (
                <Finance
                  userId={user.id}
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
              {activePanel === "pomodoro" && (
                <Pomodoro
                  key={pomodoroKey}
                  userId={user.id}
                  initialTask={pomodoroTask}
                />
              )}
              {activePanel === "games" && <Games />}
              {activePanel === "profile" && (
                <Profile
                  userId={user.id}
                  onClose={() => setActivePanel("productivity")}
                  onSave={(p) => {
                    setProfile(p);
                    if (p.display_name) setUserName(p.display_name);
                    if (p.avatar_url !== undefined)
                      setAvatarUrl(p.avatar_url ?? null);
                  }}
                  isDark={isDark}
                  toggleTheme={toggleTheme}
                />
              )}
            </>
          </div>
        </div>

      </div>

      {/* TyunniePanel — fixed bottom-center overlay, always mounted for chat history persistence */}
      <TyunniePanel
        appData={{
          todos,
          drafts,
          projects,
          snips,
          finance,
          financeViewMonth,
          financeViewYear,
          stickyNotes,
          memories,
        }}
        profile={profile}
        userName={userName}
        onNavigate={handleNavigate}
        onTodoAdded={handleTodoAdded}
        onDraftAdded={handleDraftAdded}
        onProjectAdded={handleProjectAdded}
        onFinanceAdded={handleFinanceAdded}
        onSnippetAdded={handleSnippetAdded}
        onFinanceReset={handleFinanceReset}
        onStickyCleared={async (id: string) => {
          await import("@/lib/database").then(({ updateStickyNote }) =>
            updateStickyNote(id, { content: "" }),
          );
          setStickyNotes((prev) =>
            prev.map((n) => (n.id === id ? { ...n, content: "" } : n)),
          );
        }}
        activePanel={activePanel}
        isOpen={tyunnieOpen}
        onOpen={() => setTyunnieOpen(true)}
        onClose={() => setTyunnieOpen(false)}
        prefillInput={tyunniePrefill}
        onPrefillConsumed={() => setTyunniePrefill(undefined)}
        onTodoCompleted={handleTodoCompleted}
        onTodoDeleted={handleTodoDeleted}
        onTodoUpdated={handleTodoUpdated}
        onProjectUpdated={handleProjectUpdated}
        onProjectDeleted={handleProjectDeleted}
        onDraftDeleted={handleDraftDeleted}
        onSnippetDeleted={handleSnippetDeleted}
        onFinanceDeleted={handleFinanceDeleted}
        onStickyUpdated={handleStickyUpdated}
        onCreateSticky={async () => {
          const { createStickyNote } = await import("@/lib/database");
          const offset = (stickyNotes.length % 6) * 24;
          const note = await createStickyNote(user.id, 120 + offset, 120 + offset);
          if (note) setStickyNotes((prev) => [...prev, note]);
        }}
        onFocusMode={() => setFocusMode(true)}
        onThemeToggle={toggleTheme}
        onPomodoroStart={handlePomodoroStart}
        onMemoryAdded={async (content: string) => {
          if (!user) return;
          await addMemory(user.id, content);
          setMemories((prev) => [
            {
              id: crypto.randomUUID(),
              user_id: user.id,
              content,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
        }}
        onMemoryDeleted={async (id: string) => {
          await deleteMemory(id);
          setMemories((prev) => prev.filter((m) => m.id !== id));
        }}
      />
      {/* Floating mini player — appears when playing music outside the Music panel */}
      <MiniPlayer activePanel={activePanel} />

      {/* ── SEARCH MODAL ── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          onClick={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#e8e2d8] overflow-hidden z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-[#e8e2d8]">
              <span className="text-[#9a8f7e] text-lg shrink-0">🔍</span>
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, events, drafts, projects..."
                className="flex-1 bg-transparent outline-none text-sm text-[#111010] placeholder:text-[#c5bdb0]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-[#c5bdb0] hover:text-[#9a8f7e] text-sm transition-colors shrink-0"
                >
                  ✕
                </button>
              )}
              <kbd className="text-[9px] font-mono bg-[#f3f0ea] border border-[#e8e2d8] rounded px-1.5 py-0.5 text-[#9a8f7e] shrink-0">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              className="max-h-100 overflow-y-auto"
              style={{ scrollbarWidth: "thin" }}
            >
              {searchQuery.trim().length > 0 &&
                searchQuery.trim().length < 2 && (
                  <div className="px-4 py-8 text-center text-sm text-[#c5bdb0]">
                    Keep typing...
                  </div>
                )}

              {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <div className="text-2xl mb-2">🔍</div>
                  <p className="text-sm text-[#9a8f7e]">
                    No results for <strong>&ldquo;{searchQuery}&rdquo;</strong>
                  </p>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="py-2">
                  {/* Group by type */}
                  {(
                    [
                      "Panel",
                      "Task",
                      "Draft",
                      "Project",
                      "Snippet",
                      "Finance",
                    ] as const
                  ).map((type) => {
                    const group = searchResults.filter((r) => r.type === type);
                    if (group.length === 0) return null;
                    return (
                      <div key={type}>
                        <div className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#c5bdb0] font-mono">
                          {type}s
                        </div>
                        {group.map((result, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setActivePanel(result.panel);
                              setSearchOpen(false);
                              setSearchQuery("");
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#faf8f5] transition-colors text-left group"
                          >
                            <span className="text-lg shrink-0">
                              {result.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#111010] truncate group-hover:text-[#f97316] transition-colors">
                                {/* Highlight matching text */}
                                {result.label
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase()) ? (
                                  <>
                                    {result.label.substring(
                                      0,
                                      result.label
                                        .toLowerCase()
                                        .indexOf(searchQuery.toLowerCase()),
                                    )}
                                    <mark className="bg-[#fff0e6] text-[#c2500f] rounded px-0.5">
                                      {result.label.substring(
                                        result.label
                                          .toLowerCase()
                                          .indexOf(searchQuery.toLowerCase()),
                                        result.label
                                          .toLowerCase()
                                          .indexOf(searchQuery.toLowerCase()) +
                                          searchQuery.length,
                                      )}
                                    </mark>
                                    {result.label.substring(
                                      result.label
                                        .toLowerCase()
                                        .indexOf(searchQuery.toLowerCase()) +
                                        searchQuery.length,
                                    )}
                                  </>
                                ) : (
                                  result.label
                                )}
                              </div>
                              <div className="text-[10px] text-[#9a8f7e] font-mono truncate">
                                {result.sub}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-[#c5bdb0] shrink-0 group-hover:text-[#f97316] transition-colors">
                              → {PANEL_LABELS[result.panel]}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state — no query */}
              {searchQuery.trim().length === 0 && (
                <div className="px-4 py-6 text-center text-[#c5bdb0]">
                  <p className="text-xs font-mono">
                    Search across all your tasks, events, drafts, projects,
                    snippets and finance
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#f3f0ea] px-4 py-2 flex items-center gap-4">
              <span className="text-[9px] font-mono text-[#c5bdb0]">
                ↵ to navigate
              </span>
              <span className="text-[9px] font-mono text-[#c5bdb0]">
                ESC to close
              </span>
              {searchResults.length > 0 && (
                <span className="text-[9px] font-mono text-[#c5bdb0] ml-auto">
                  {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#e8e2d8] overflow-hidden z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e2d8]">
              <span className="font-serif italic text-[#f97316] text-sm">
                Keyboard Shortcuts
              </span>
              <kbd className="text-[9px] font-mono bg-[#f3f0ea] border border-[#e8e2d8] rounded px-1.5 py-0.5 text-[#9a8f7e]">
                ?
              </kbd>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Navigation */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#c5bdb0] font-mono mb-3">
                  Navigation
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    // Navigation section
                    { keys: ["⌘ Ctrl", "1–9"], label: "Switch panels" },
                    { keys: ["⌘ Ctrl", "P"], label: "Profile" },
                    { keys: ["⌘ Ctrl", "/"], label: "Toggle Tyunnie chat" },

                    // Search section
                    { keys: ["⌘ Ctrl", "K"], label: "Global search" },
                    { keys: ["⌘ Ctrl", "⇧", "K"], label: "New sticky note" },
                    { keys: ["⌘ Ctrl", "⇧", "F"], label: "Focus Mode" },
                  ].map(({ keys, label }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-[#111010]">{label}</span>
                      <div className="flex items-center gap-1">
                        {keys.map((k) => (
                          <kbd
                            key={k}
                            className="text-[10px] font-mono bg-[#f3f0ea] border border-[#e8e2d8] rounded px-2 py-0.5 text-[#9a8f7e]"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#c5bdb0] font-mono mb-3">
                  Search
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#111010]">Global search</span>
                  <div className="flex items-center gap-1">
                    <kbd className="text-[10px] font-mono bg-[#f3f0ea] border border-[#e8e2d8] rounded px-2 py-0.5 text-[#9a8f7e]">
                      ⌘
                    </kbd>
                    <kbd className="text-[10px] font-mono bg-[#f3f0ea] border border-[#e8e2d8] rounded px-2 py-0.5 text-[#9a8f7e]">
                      K
                    </kbd>
                  </div>
                </div>
              </div>

              {/* General */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#c5bdb0] font-mono mb-3">
                  General
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { keys: ["?"], label: "Toggle this panel" },
                    { keys: ["Esc"], label: "Close modals" },
                  ].map(({ keys, label }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-[#111010]">{label}</span>
                      <div className="flex items-center gap-1">
                        {keys.map((k) => (
                          <kbd
                            key={k}
                            className="text-[10px] font-mono bg-[#f3f0ea] border border-[#e8e2d8] rounded px-2 py-0.5 text-[#9a8f7e]"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#f3f0ea] px-5 py-2.5">
              <p className="text-[9px] font-mono text-[#c5bdb0]">
                Shortcuts work on both Mac and Windows
              </p>
            </div>
          </div>
        </div>
      )}
      {focusMode && (
        <FocusMode
          todos={todos}
          stickyNotes={stickyNotes}
          onStickyNotesChange={setStickyNotes}
          onExit={() => setFocusMode(false)}
        />
      )}
      <StickyLayer
        userId={user.id}
        notes={stickyNotes}
        onNotesChange={setStickyNotes}
      />
    </MusicProvider>
  );
}
