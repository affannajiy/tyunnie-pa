// app/dashboard/page.tsx
"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

import dynamic from "next/dynamic";
import Desk from "@/components/Desk";
import Sidebar, { type Panel } from "@/components/Sidebar";
import { MusicProvider, useMusicContext } from "@/lib/MusicContext";
import CommandPalette from "@/components/CommandPalette";
import ShortcutHelp from "@/components/ShortcutHelp";
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

// ── Music keyboard bridge ──
// Lives inside MusicProvider so it can call useMusicContext().
// Listens for the "tyunnie-music-toggle" window event dispatched by the
// keyboard handler (which is outside the Provider).
function MusicKeyboardBridge() {
  const { togglePlay } = useMusicContext();
  useEffect(() => {
    function handler() { togglePlay(); }
    window.addEventListener("tyunnie-music-toggle", handler);
    return () => window.removeEventListener("tyunnie-music-toggle", handler);
  }, [togglePlay]);
  return null;
}

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

  // ── ACCENT — re-apply from localStorage before first paint on every load ──
  useLayoutEffect(() => {
    const accent = localStorage.getItem("tyunnie_accent");
    if (accent) applyAccentColor(accent);
  }, []);

  // ── SEARCH ──
  const [searchOpen, setSearchOpen] = useState(false);

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
    // Panels reachable via Ctrl/⌘ + 1–9
    const NUMBERED_PANELS: Panel[] = [
      "desk",        // 1
      "todo",        // 2
      "writing",     // 3
      "projects",    // 4
      "snippets",    // 5
      "finance",     // 6
      "music",       // 7
      "games",       // 8
      "profile",     // 9
    ];

    // Panels that support N-key quick-add when no input is focused
    const PANEL_NEW_KEY: Partial<Record<Panel, string>> = {
      todo:     "tyunnie-new-task",
      writing:  "tyunnie-new-draft",
      projects: "tyunnie-new-project",
      snippets: "tyunnie-new-snippet",
    };

    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable;

      const mod = e.metaKey || e.ctrlKey;

      // ── Always-active shortcuts (even while typing) ──

      // Cmd/Ctrl + K → open command palette
      if (mod && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
        return;
      }

      // Escape → close any open overlay (priority order)
      if (e.key === "Escape") {
        setSearchOpen(false);
        setShowShortcuts(false);
        setTyunnieOpen(false);
        return;
      }

      // ── Shortcuts blocked while typing ──
      if (isTyping) return;

      // ? → shortcuts help
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + 1–9 → navigate to numbered panel
      if (mod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const target = NUMBERED_PANELS[parseInt(e.key) - 1];
        if (target) setActivePanel(target);
        return;
      }

      // Cmd/Ctrl + Shift + T → toggle Tyunnie chat
      if (mod && e.shiftKey && e.key === "T") {
        e.preventDefault();
        setTyunnieOpen((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + Shift + F → Focus Mode
      if (mod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFocusMode((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + Shift + N → new task
      if (mod && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setActivePanel("todo");
        setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-task")), 80);
        return;
      }

      // Cmd/Ctrl + Shift + D → new draft
      if (mod && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setActivePanel("writing");
        setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-draft")), 80);
        return;
      }

      // Cmd/Ctrl + Shift + P → new project
      if (mod && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setActivePanel("projects");
        setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-project")), 80);
        return;
      }

      // Cmd/Ctrl + Shift + S → new snippet
      if (mod && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setActivePanel("snippets");
        setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-snippet")), 80);
        return;
      }

      // Cmd/Ctrl + M → music play/pause (dispatched into MusicKeyboardBridge)
      if (mod && e.key === "m") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("tyunnie-music-toggle"));
        return;
      }

      // Cmd/Ctrl + / → toggle Tyunnie (legacy shortcut preserved)
      if (mod && e.key === "/") {
        e.preventDefault();
        setTyunnieOpen((prev) => !prev);
        return;
      }

      // N key → quick-add in current panel (when not typing)
      if (e.key === "n" && !mod) {
        const eventName = PANEL_NEW_KEY[activePanel];
        if (eventName) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(eventName));
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel]);


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
          onFocusMode={() => setFocusMode(true)}
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
      <MiniPlayer activePanel={activePanel} onNavigate={(p) => setActivePanel(p as Panel)} />

      {/* Music keyboard bridge — listens for tyunnie-music-toggle inside MusicProvider */}
      <MusicKeyboardBridge />

      {/* ── COMMAND PALETTE ── */}
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        todos={todos}
        drafts={drafts}
        projects={projects}
        snips={snips}
        onNavigate={(panel) => setActivePanel(panel)}
        onFocusMode={() => setFocusMode(true)}
        onTyunnieOpen={() => setTyunnieOpen(true)}
        onMusicToggle={() => window.dispatchEvent(new CustomEvent("tyunnie-music-toggle"))}
      />

      {/* ── SHORTCUT HELP ── */}
      <ShortcutHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />

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
