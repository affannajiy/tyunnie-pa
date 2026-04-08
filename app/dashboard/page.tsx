// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

import Desk from "@/components/Desk";
import Sidebar, { type Panel } from "@/components/Sidebar";
import TyunniePanel from "@/components/TyunniePanel";
import Todo from "@/components/Todo";
import Writing from "@/components/Writing";
import Projects from "@/components/Projects";
import Snippets from "@/components/Snippets";
import Finance from "@/components/Finance";
import Music from "@/components/Music";
import { MusicProvider } from "@/lib/MusicContext";
import Pomodoro from "@/components/Pomodoro";
import Games from "@/components/Games";
import Weather from "@/components/Weather";
import Profile from "@/components/Profile";
import { getProfile, type Profile as ProfileType } from "@/lib/database";

import {
  getTodos,
  getDrafts,
  getProjects,
  getSnips,
  getFinanceEntries,
  addTodo,
  toggleTodo,
  addDraft,
  addProject,
  addFinanceEntry,
  deleteFinanceEntry,
  addSnip,
  type Todo as TodoType,
  type Draft,
  type Project,
  type Snip,
  type FinanceEntry,
} from "@/lib/database";

const PANEL_LABELS: Record<Panel, string> = {
  desk: "Home",
  todo: "Tasks",
  writing: "Writing",
  projects: "Projects",
  snippets: "Snip Files",
  finance: "Finance",
  music: "Music",
  pomodoro: "Pomodoro",
  games: "Games",
  profile: "Profile",
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
    return "desk"; // ← was "calendar"
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
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [tyunnieExpanded, setTyunnieExpanded] = useState(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);
  const [snippetRefreshKey, setSnippetRefreshKey] = useState(0);

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
          "todo",
          "writing",
          "projects",
          "snippets",
          "finance",
          "music",
          "pomodoro",
          "games",
        ];
        const target = panels[parseInt(e.key) - 1];
        if (target) setActivePanel(target);
      }

      // Cmd/Ctrl + P for profile
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setActivePanel("profile");
      }

      // Cmd/Ctrl + / to toggle Tyunnie expand
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setTyunnieExpanded((prev) => !prev);
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

  // ── LOAD ALL DATA once we have a user ──
  useEffect(() => {
    if (!user) return;

    async function loadAll() {
      const [td, dr, pr, sn, fi] = await Promise.all([
        getTodos(user!.id),
        getDrafts(user!.id),
        getProjects(user!.id),
        getSnips(user!.id),
        getFinanceEntries(user!.id),
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
      }
      setTodos(td);
      setDrafts(dr);
      setProjects(pr);
      setSnips(sn);
      setFinance(fi);
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
      setTyunnieExpanded(false);
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
  const onDesk = activePanel === "desk";

  // ── MAIN APP ──
  return (
    <MusicProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#faf8f5]">
        <Sidebar
          active={activePanel}
          onChange={(panel) => {
            setActivePanel(panel);
            setTyunnieExpanded(false);
          }}
          onSignOut={handleSignOut}
          userName={userName}
          avatarUrl={avatarUrl}
        />

        {/* Main content */}
        <div
          className={`flex flex-col overflow-hidden min-w-0 transition-all duration-300 ease-in-out ${
            tyunnieExpanded
              ? "w-0 opacity-0 pointer-events-none flex-none"
              : "opacity-100 flex-1"
          }`}
        >
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
              onClick={() => setShowMobileChat(true)}
              className="md:hidden ml-auto w-9 h-9 bg-[#f97316] rounded-xl flex items-center justify-center text-white text-base"
            >
              🧡
            </button>
          </div>

          {/* Panel content — add bottom padding on mobile for tab bar */}
          <div className="flex-1 overflow-y-auto p-4 md:p-7 pb-24 md:pb-7">
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
                  onNavigate={(panel) => {
                    setActivePanel(panel);
                    setTyunnieExpanded(false);
                  }}
                  onTodoToggle={handleTodoToggle}
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
              {activePanel === "pomodoro" && <Pomodoro userId={user.id} />}
              {activePanel === "games" && <Games />}
              {activePanel === "profile" && (
                <Profile
                  userId={user.id}
                  onClose={() => setActivePanel("todo")}
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

        {/* TyunniePanel — desktop: always visible, mobile: slide-in overlay */}
        <div
          className={`
  fixed inset-0 z-40 transition-transform duration-300
  md:relative md:inset-auto md:z-auto md:translate-x-0 md:flex md:shrink-0
  ${tyunnieExpanded ? "md:flex-1" : ""}
  ${showMobileChat ? "translate-x-0" : "translate-x-full md:translate-x-0"}
`}
        >
          {/* Mobile backdrop */}
          <div
            className="md:hidden absolute inset-0 bg-black/50"
            onClick={() => setShowMobileChat(false)}
          />

          {/* Close button on mobile */}
          <button
            onClick={() => setShowMobileChat(false)}
            className="md:hidden absolute top-4 right-4 z-50 w-9 h-9 bg-[#2a2520] rounded-xl flex items-center justify-center text-[#9a8f7e] text-lg"
          >
            ✕
          </button>

          <TyunniePanel
            appData={{
              todos,
              drafts,
              projects,
              snips,
              finance,
              financeViewMonth,
              financeViewYear,
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
            activePanel={activePanel}
            isExpanded={tyunnieExpanded}
            prefillInput={tyunniePrefill}
            onPrefillConsumed={() => setTyunniePrefill(undefined)}
            onToggleExpand={() => {
              if (onDesk && tyunnieExpanded) {
                setTyunnieExpanded(false);
              } else {
                setTyunnieExpanded((prev) => !prev);
              }
            }}
          />
        </div>
      </div>
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
    </MusicProvider>
  );
}
