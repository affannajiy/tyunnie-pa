// components/CommandPalette.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Panel } from "@/components/Sidebar";
import type { Todo, Draft, Project, Snip } from "@/lib/database";

// ── Types ──────────────────────────────────────────────────────────────────

type ResultKind = "action" | "panel" | "shortcut" | "task" | "draft" | "project" | "snippet";

interface PaletteResult {
  id: string;
  kind: ResultKind;
  icon: string;
  title: string;
  subtitle?: string;
  shortcut?: string[];
  panel?: Panel;
  action?: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  todos: Todo[];
  drafts: Draft[];
  projects: Project[];
  snips: Snip[];
  onNavigate: (panel: Panel) => void;
  onFocusMode: () => void;
  onTyunnieOpen: () => void;
  onMusicToggle: () => void;
}

// ── Static data ────────────────────────────────────────────────────────────

const PANEL_ENTRIES: { panel: Panel; icon: string; title: string; keywords: string[] }[] = [
  { panel: "desk",         icon: "🏠", title: "Home",       keywords: ["home", "desk", "dashboard"] },
  { panel: "todo",         icon: "✅", title: "Tasks",      keywords: ["todo", "tasks", "task", "remind", "checklist"] },
  { panel: "writing",      icon: "✍️", title: "Writing",    keywords: ["writing", "drafts", "draft", "write", "notes"] },
  { panel: "projects",     icon: "🗂️", title: "Projects",   keywords: ["projects", "project", "gantt"] },
  { panel: "snippets",     icon: "⌨️", title: "Snippets",   keywords: ["snippets", "snips", "code", "snippet", "terminal"] },
  { panel: "finance",      icon: "💰", title: "Finance",    keywords: ["finance", "money", "budget", "expenses", "income"] },
  { panel: "music",        icon: "🎵", title: "Music",      keywords: ["music", "songs", "playlist", "player"] },
  { panel: "pomodoro",     icon: "⏲️", title: "Pomodoro",   keywords: ["pomodoro", "focus", "timer", "study"] },
  { panel: "games",        icon: "🎮", title: "Games",      keywords: ["games", "game", "play", "chess", "sudoku", "tetris"] },
  { panel: "productivity", icon: "⚡", title: "Productivity Hub", keywords: ["productivity", "hub", "work"] },
  { panel: "entertainment",icon: "🎭", title: "Entertainment Hub", keywords: ["entertainment", "play"] },
  { panel: "profile",      icon: "👤", title: "Profile",    keywords: ["profile", "settings", "account", "me"] },
];

const SHORTCUT_ENTRIES: { title: string; shortcut: string[]; keywords: string[]; action?: string }[] = [
  { title: "Global search",          shortcut: ["⌘", "K"],         keywords: ["search", "find", "palette"] },
  { title: "Focus Mode",             shortcut: ["⌘", "⇧", "F"],    keywords: ["focus", "mode", "fullscreen"] },
  { title: "Toggle Tyunnie chat",    shortcut: ["⌘", "⇧", "T"],    keywords: ["tyunnie", "chat", "ai", "tyun"] },
  { title: "New task",               shortcut: ["⌘", "⇧", "N"],    keywords: ["new", "task", "todo", "add"] },
  { title: "New draft",              shortcut: ["⌘", "⇧", "D"],    keywords: ["new", "draft", "writing", "add"] },
  { title: "New project",            shortcut: ["⌘", "⇧", "P"],    keywords: ["new", "project", "add"] },
  { title: "New snippet",            shortcut: ["⌘", "⇧", "S"],    keywords: ["new", "snippet", "code", "add"] },
  { title: "Play/pause music",       shortcut: ["⌘", "M"],         keywords: ["music", "play", "pause", "mute"] },
  { title: "Keyboard shortcuts",     shortcut: ["?"],               keywords: ["shortcuts", "help", "keyboard"] },
  { title: "Close modal / Escape",   shortcut: ["Esc"],             keywords: ["close", "escape", "dismiss"] },
  { title: "Switch panel",           shortcut: ["⌘", "1–9"],        keywords: ["switch", "panel", "navigate"] },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function modKey() {
  return isMac() ? "⌘" : "Ctrl";
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#fff0e6] text-[var(--accent)] rounded-sm px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CommandPalette({
  open,
  onClose,
  todos,
  drafts,
  projects,
  snips,
  onNavigate,
  onFocusMode,
  onTyunnieOpen,
  onMusicToggle,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Build results list
  const results = useCallback((): PaletteResult[] => {
    const q = query.trim().toLowerCase();
    const out: PaletteResult[] = [];

    // ── Static actions (always shown when no query, or when they match) ──
    const actions: PaletteResult[] = [
      {
        id: "act-new-task",
        kind: "action",
        icon: "✅",
        title: "New task",
        subtitle: `Navigate to Tasks + focus input`,
        shortcut: [modKey(), "⇧", "N"],
        action: () => { onNavigate("todo"); setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-task")), 80); },
      },
      {
        id: "act-new-draft",
        kind: "action",
        icon: "✍️",
        title: "New draft",
        subtitle: "Navigate to Writing + open editor",
        shortcut: [modKey(), "⇧", "D"],
        action: () => { onNavigate("writing"); setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-draft")), 80); },
      },
      {
        id: "act-new-project",
        kind: "action",
        icon: "🗂️",
        title: "New project",
        subtitle: "Navigate to Projects + open form",
        shortcut: [modKey(), "⇧", "P"],
        action: () => { onNavigate("projects"); setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-project")), 80); },
      },
      {
        id: "act-new-snippet",
        kind: "action",
        icon: "⌨️",
        title: "New snippet",
        subtitle: "Navigate to Snippets + focus editor",
        shortcut: [modKey(), "⇧", "S"],
        action: () => { onNavigate("snippets"); setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-snippet")), 80); },
      },
      {
        id: "act-focus-mode",
        kind: "action",
        icon: "🎯",
        title: "Focus Mode",
        subtitle: "Enter fullscreen focus overlay",
        shortcut: [modKey(), "⇧", "F"],
        action: onFocusMode,
      },
      {
        id: "act-music-toggle",
        kind: "action",
        icon: "🎵",
        title: "Play / Pause music",
        subtitle: "Toggle music playback",
        shortcut: [modKey(), "M"],
        action: onMusicToggle,
      },
      {
        id: "act-tyunnie",
        kind: "action",
        icon: "🧡",
        title: "Open Tyunnie chat",
        subtitle: "Talk to your personal AI",
        shortcut: [modKey(), "⇧", "T"],
        action: onTyunnieOpen,
      },
    ];

    if (!q) {
      // Show all actions + all panels when empty
      out.push(...actions);
      PANEL_ENTRIES.forEach((p) => {
        out.push({
          id: `panel-${p.panel}`,
          kind: "panel",
          icon: p.icon,
          title: p.title,
          subtitle: "Navigate to panel",
          panel: p.panel,
        });
      });
      return out;
    }

    // ── Filtered actions ──
    actions.forEach((a) => {
      if (
        a.title.toLowerCase().includes(q) ||
        (a.subtitle ?? "").toLowerCase().includes(q)
      ) {
        out.push(a);
      }
    });

    // ── Panels ──
    PANEL_ENTRIES.forEach((p) => {
      if (p.keywords.some((k) => k.includes(q) || q.includes(k)) || p.title.toLowerCase().includes(q)) {
        out.push({
          id: `panel-${p.panel}`,
          kind: "panel",
          icon: p.icon,
          title: p.title,
          subtitle: "Navigate to panel",
          panel: p.panel,
        });
      }
    });

    // ── Shortcuts ──
    SHORTCUT_ENTRIES.forEach((s) => {
      if (s.keywords.some((k) => k.includes(q) || q.includes(k)) || s.title.toLowerCase().includes(q)) {
        out.push({
          id: `shortcut-${s.title}`,
          kind: "shortcut",
          icon: "⌨️",
          title: s.title,
          shortcut: s.shortcut,
        });
      }
    });

    // ── Todos ──
    todos
      .filter((t) => t.text.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((t) => {
        out.push({
          id: `task-${t.id}`,
          kind: "task",
          icon: t.done ? "✅" : "⬜",
          title: t.text,
          subtitle: `[${t.tag}]${t.due ? " · due " + t.due : ""}${t.done ? " · done" : ""}`,
          panel: "todo",
        });
      });

    // ── Drafts ──
    drafts
      .filter((d) => d.title.toLowerCase().includes(q) || (d.body ?? "").toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((d) => {
        const words = (d.body ?? "").trim().split(/\s+/).filter(Boolean).length;
        out.push({
          id: `draft-${d.id}`,
          kind: "draft",
          icon: "✍️",
          title: d.title,
          subtitle: `${words} word${words !== 1 ? "s" : ""}`,
          panel: "writing",
        });
      });

    // ── Projects ──
    projects
      .filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((p) => {
        out.push({
          id: `project-${p.id}`,
          kind: "project",
          icon: "🗂️",
          title: p.name,
          subtitle: `${p.status} · ${p.progress}%`,
          panel: "projects",
        });
      });

    // ── Snippets ──
    snips
      .filter((s) => s.name.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((s) => {
        out.push({
          id: `snip-${s.id}`,
          kind: "snippet",
          icon: "⌨️",
          title: s.name,
          subtitle: s.language,
          panel: "snippets",
        });
      });

    return out.slice(0, 20);
  }, [query, todos, drafts, projects, snips, onNavigate, onFocusMode, onTyunnieOpen, onMusicToggle]);

  const items = results();

  // Keep selectedIdx in bounds when results change
  useEffect(() => {
    setSelectedIdx((prev) => Math.min(prev, Math.max(items.length - 1, 0)));
  }, [items.length]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  function selectItem(item: PaletteResult) {
    if (item.action) {
      item.action();
    } else if (item.panel) {
      onNavigate(item.panel);
    }
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selectedIdx];
      if (item) selectItem(item);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  // Group results for display
  const kindOrder: ResultKind[] = ["action", "panel", "shortcut", "task", "draft", "project", "snippet"];
  const kindLabels: Record<ResultKind, string> = {
    action: "Quick Actions",
    panel: "Panels",
    shortcut: "Shortcuts",
    task: "Tasks",
    draft: "Drafts",
    project: "Projects",
    snippet: "Snippets",
  };

  const grouped: { kind: ResultKind; items: PaletteResult[] }[] = [];
  kindOrder.forEach((kind) => {
    const group = items.filter((r) => r.kind === kind);
    if (group.length > 0) grouped.push({ kind, items: group });
  });

  // Flat index map for selected tracking
  let flatIdx = 0;
  const indexedGroups: { kind: ResultKind; items: (PaletteResult & { flatIdx: number })[] }[] = grouped.map((g) => ({
    kind: g.kind,
    items: g.items.map((item) => ({ ...item, flatIdx: flatIdx++ })),
  }));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#1a1714] rounded-2xl shadow-2xl border border-[#e8e2d8] dark:border-[#2a2520] overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "72vh", display: "flex", flexDirection: "column" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#e8e2d8] dark:border-[#2a2520] shrink-0">
          <svg
            className="w-4 h-4 text-[#9a8f7e] shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search panels, tasks, drafts, shortcuts..."
            className="flex-1 bg-transparent outline-none text-sm text-[#111010] dark:text-white placeholder:text-[#c5bdb0]"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setSelectedIdx(0); inputRef.current?.focus(); }}
              className="text-[#c5bdb0] hover:text-[#9a8f7e] transition-colors shrink-0 text-sm"
            >
              ✕
            </button>
          )}
          <kbd className="text-[9px] font-mono bg-[#f3f0ea] dark:bg-[#2a2520] border border-[#e8e2d8] dark:border-[#3a3530] rounded px-1.5 py-0.5 text-[#9a8f7e] shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="overflow-y-auto flex-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {items.length === 0 && query.trim().length > 0 && (
            <div className="px-4 py-10 text-center">
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-sm text-[#9a8f7e]">
                No results for <strong>&ldquo;{query}&rdquo;</strong>
              </p>
            </div>
          )}

          {indexedGroups.map(({ kind, items: groupItems }) => (
            <div key={kind}>
              <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-[#c5bdb0] font-mono">
                {kindLabels[kind]}
              </div>
              {groupItems.map((item) => {
                const isSelected = item.flatIdx === selectedIdx;
                return (
                  <button
                    key={item.id}
                    data-idx={item.flatIdx}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setSelectedIdx(item.flatIdx)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      background: isSelected ? "rgba(var(--accent-rgb), 0.08)" : "transparent",
                    }}
                  >
                    <span className="text-base shrink-0 w-5 text-center leading-none">
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-medium truncate"
                        style={{ color: isSelected ? "var(--accent)" : "#111010" }}
                      >
                        {highlightMatch(item.title, query)}
                      </div>
                      {item.subtitle && (
                        <div className="text-[10px] text-[#9a8f7e] font-mono truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    {item.shortcut && (
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        {item.shortcut.map((k, i) => (
                          <kbd
                            key={i}
                            className="text-[9px] font-mono bg-[#f3f0ea] dark:bg-[#2a2520] border border-[#e8e2d8] dark:border-[#3a3530] rounded px-1.5 py-0.5 text-[#9a8f7e]"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    )}
                    {!item.shortcut && item.panel && (
                      <span className="text-[10px] font-mono text-[#c5bdb0] shrink-0 ml-2 hidden sm:block">
                        →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Empty state when query is blank and items are loaded */}
          {items.length === 0 && !query.trim() && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs font-mono text-[#c5bdb0]">
                Type to search across panels, tasks, drafts, projects, snippets and shortcuts
              </p>
            </div>
          )}

          <div className="h-2" />
        </div>

        {/* Footer */}
        <div className="border-t border-[#f3f0ea] dark:border-[#2a2520] px-4 py-2 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#c5bdb0]">
            <kbd className="bg-[#f3f0ea] dark:bg-[#2a2520] border border-[#e8e2d8] dark:border-[#3a3530] rounded px-1 py-0.5">↑↓</kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#c5bdb0]">
            <kbd className="bg-[#f3f0ea] dark:bg-[#2a2520] border border-[#e8e2d8] dark:border-[#3a3530] rounded px-1 py-0.5">↵</kbd>
            <span>select</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#c5bdb0]">
            <kbd className="bg-[#f3f0ea] dark:bg-[#2a2520] border border-[#e8e2d8] dark:border-[#3a3530] rounded px-1 py-0.5">Esc</kbd>
            <span>close</span>
          </div>
          {items.length > 0 && (
            <span className="text-[9px] font-mono text-[#c5bdb0] ml-auto">
              {items.length} result{items.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
