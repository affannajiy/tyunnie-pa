// components/CommandPalette.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, CheckCircle2, PenLine, FolderKanban, Code2, Wallet, Music2,
  Timer, Gamepad2, Target, Sparkles, User, Heart, Square, Search, X,
  type LucideIcon,
} from "lucide-react";
import type { Panel } from "@/components/Sidebar";
import type { Todo, Draft, Project, Snip } from "@/lib/database";
import { isMac, modKey } from "@/lib/platform";
import { Kbd } from "@/components/ui/Kbd";
import { useFocusTrap } from "@/lib/useFocusTrap";

// ── Types ──────────────────────────────────────────────────────────────────

type ResultKind = "action" | "panel" | "shortcut" | "task" | "draft" | "project" | "snippet";

// Kinds that carry a real record and can therefore render a preview.
// Actions, panels and shortcuts are pure navigation — nothing to show.
type PreviewData =
  | { kind: "task"; record: Todo }
  | { kind: "draft"; record: Draft }
  | { kind: "project"; record: Project }
  | { kind: "snippet"; record: Snip };

interface PaletteResult {
  id: string;
  kind: ResultKind;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  shortcut?: string[];
  panel?: Panel;
  action?: () => void;
  // The source row, kept so the preview pane can render real content instead of
  // re-deriving it from the display strings.
  data?: PreviewData;
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

const PANEL_ENTRIES: { panel: Panel; icon: LucideIcon; title: string; keywords: string[] }[] = [
  { panel: "desk",         icon: Home, title: "Home",       keywords: ["home", "desk", "dashboard"] },
  { panel: "todo",         icon: CheckCircle2, title: "Tasks",      keywords: ["todo", "tasks", "task", "remind", "checklist"] },
  { panel: "writing",      icon: PenLine, title: "Writing",    keywords: ["writing", "drafts", "draft", "write", "notes"] },
  { panel: "projects",     icon: FolderKanban, title: "Projects",   keywords: ["projects", "project", "gantt"] },
  { panel: "snippets",     icon: Code2, title: "Snippets",   keywords: ["snippets", "snips", "code", "snippet", "terminal"] },
  { panel: "finance",      icon: Wallet, title: "Finance",    keywords: ["finance", "money", "budget", "expenses", "income"] },
  { panel: "music",        icon: Music2, title: "Music",      keywords: ["music", "songs", "playlist", "player"] },
  { panel: "pomodoro",     icon: Timer, title: "Pomodoro",   keywords: ["pomodoro", "focus", "timer", "study"] },
  { panel: "games",        icon: Gamepad2, title: "Games",      keywords: ["games", "game", "play", "chess", "sudoku", "tetris"] },
  { panel: "focus",        icon: Target, title: "Focus Hub",         keywords: ["focus", "hub", "tasks", "work", "pomodoro", "projects"] },
  { panel: "create",       icon: Sparkles, title: "Create Hub",        keywords: ["create", "hub", "writing", "snippets", "finance", "calculator"] },
  { panel: "play",         icon: Gamepad2, title: "Play Hub",          keywords: ["play", "hub", "music", "games", "entertainment"] },
  { panel: "profile",      icon: User, title: "Profile",    keywords: ["profile", "settings", "account", "me"] },
];

const SHORTCUT_ENTRIES: { title: string; shortcut: string[]; keywords: string[] }[] = [
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

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        className="bg-[#fff0e6] rounded-sm px-0.5 not-italic"
        style={{ color: "var(--accent-text)" }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Preview pane ───────────────────────────────────────────────────────────
// Spotlight-style detail for the highlighted row. Deliberately plain text —
// no syntax highlighter, since pulling one in for a hover preview would cost
// more bundle than the whole palette.

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[9px] font-mono uppercase tracking-widest text-[#756a5a] shrink-0">
        {label}
      </span>
      <span className="text-[11px] text-[#6f6455] dark:text-[#b0a090] truncate">
        {value}
      </span>
    </div>
  );
}

function PalettePreview({ data }: { data?: PreviewData }) {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center">
        <p className="text-[11px] text-[#756a5a] font-mono leading-relaxed">
          Highlight a task, draft,
          <br />
          project or snippet to preview it
        </p>
      </div>
    );
  }

  if (data.kind === "draft") {
    const d = data.record;
    const body = (d.body ?? "").trim();
    const words = body ? body.split(/\s+/).filter(Boolean).length : 0;
    return (
      <div className="h-full overflow-y-auto p-5" style={{ scrollbarWidth: "thin" }}>
        <h3 className="font-serif text-base text-[#111010] dark:text-white mb-1 leading-snug">
          {d.title || "Untitled"}
        </h3>
        <div className="mb-3 space-y-0.5">
          <PreviewMeta label="Words" value={String(words)} />
          {d.updated_at && (
            <PreviewMeta
              label="Edited"
              value={new Date(d.updated_at).toLocaleDateString()}
            />
          )}
        </div>
        {body ? (
          <p className="font-serif text-[13px] leading-relaxed text-[#2d2416] dark:text-[#d8d0c4] whitespace-pre-wrap line-clamp-[18]">
            {body}
          </p>
        ) : (
          <p className="text-[11px] italic text-[#756a5a]">Empty draft</p>
        )}
      </div>
    );
  }

  if (data.kind === "snippet") {
    const s = data.record;
    return (
      <div className="h-full overflow-y-auto p-5" style={{ scrollbarWidth: "thin" }}>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-[#111010] dark:text-white truncate">
            {s.name}
          </h3>
          <span
            className="shrink-0 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(var(--accent-rgb), 0.14)",
              color: "var(--accent-dim)",
            }}
          >
            {s.language}
          </span>
        </div>
        <pre className="text-[11px] font-mono leading-relaxed text-[#2d2416] dark:text-[#d8d0c4] bg-[#faf8f5] dark:bg-[#141110] border border-[#f3f0ea] dark:border-[#2a2520] rounded-lg p-3 overflow-x-auto whitespace-pre">
          {(s.code ?? "").split("\n").slice(0, 40).join("\n") || "// empty"}
        </pre>
      </div>
    );
  }

  if (data.kind === "task") {
    const t = data.record;
    const overdue =
      !t.done && t.due && new Date(t.due) < new Date(new Date().toDateString());
    return (
      <div className="h-full overflow-y-auto p-5" style={{ scrollbarWidth: "thin" }}>
        <div className="flex items-start gap-2 mb-3">
          <span className="text-base leading-none shrink-0" aria-hidden="true">
            {t.done ? <CheckCircle2 size={16} strokeWidth={1.75} /> : <Square size={16} strokeWidth={1.75} />}
          </span>
          <h3
            className={`text-sm leading-snug ${
              t.done
                ? "line-through text-[#6f6455]"
                : "text-[#111010] dark:text-white"
            }`}
          >
            {t.text}
          </h3>
        </div>
        <div className="space-y-0.5">
          <PreviewMeta label="Tag" value={t.tag} />
          <PreviewMeta label="Status" value={t.done ? "Done" : "Open"} />
          {t.due && <PreviewMeta label="Due" value={t.due} />}
        </div>
        {overdue && (
          <p className="mt-3 text-[11px] font-semibold text-[#dc2626]">
            Overdue
          </p>
        )}
      </div>
    );
  }

  const p = data.record;
  return (
    <div className="h-full overflow-y-auto p-5" style={{ scrollbarWidth: "thin" }}>
      <h3 className="text-sm font-semibold text-[#111010] dark:text-white mb-2 leading-snug">
        {p.name}
      </h3>
      <div className="h-1.5 rounded-full bg-[#f3f0ea] dark:bg-[#2a2520] overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${p.progress}%`,
            background: "var(--accent)",
          }}
        />
      </div>
      <div className="space-y-0.5 mb-3">
        <PreviewMeta label="Progress" value={`${p.progress}%`} />
        <PreviewMeta label="Status" value={p.status} />
      </div>
      {p.description && (
        <p className="text-[12px] leading-relaxed text-[#2d2416] dark:text-[#d8d0c4] whitespace-pre-wrap line-clamp-[14]">
          {p.description}
        </p>
      )}
    </div>
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
  // Keep modal in DOM during exit animation
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Contract §11: overlays trap Tab and hand focus back to the trigger on close.
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      const t = setTimeout(() => setVisible(false), 180);
      return () => clearTimeout(t);
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
        icon: CheckCircle2,
        title: "New task",
        subtitle: `Navigate to Tasks + focus input`,
        shortcut: [modKey(), "⇧", "N"],
        action: () => { onNavigate("todo"); setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-task")), 80); },
      },
      {
        id: "act-new-draft",
        kind: "action",
        icon: PenLine,
        title: "New draft",
        subtitle: "Navigate to Writing + open editor",
        shortcut: [modKey(), "⇧", "D"],
        action: () => { onNavigate("writing"); setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-draft")), 80); },
      },
      {
        id: "act-new-project",
        kind: "action",
        icon: FolderKanban,
        title: "New project",
        subtitle: "Navigate to Projects + open form",
        shortcut: [modKey(), "⇧", "P"],
        action: () => { onNavigate("projects"); setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-project")), 80); },
      },
      {
        id: "act-new-snippet",
        kind: "action",
        icon: Code2,
        title: "New snippet",
        subtitle: "Navigate to Snippets + focus editor",
        shortcut: [modKey(), "⇧", "S"],
        action: () => { onNavigate("snippets"); setTimeout(() => window.dispatchEvent(new CustomEvent("tyunnie-new-snippet")), 80); },
      },
      {
        id: "act-focus-mode",
        kind: "action",
        icon: Target,
        title: "Focus Mode",
        subtitle: "Enter fullscreen focus overlay",
        shortcut: [modKey(), "⇧", "F"],
        action: onFocusMode,
      },
      {
        id: "act-music-toggle",
        kind: "action",
        icon: Music2,
        title: "Play / Pause music",
        subtitle: "Toggle music playback",
        shortcut: [modKey(), "M"],
        action: onMusicToggle,
      },
      {
        id: "act-tyunnie",
        kind: "action",
        icon: Heart,
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
          icon: Code2,
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
          icon: t.done ? CheckCircle2 : Square,
          title: t.text,
          subtitle: `[${t.tag}]${t.due ? " · due " + t.due : ""}${t.done ? " · done" : ""}`,
          panel: "todo",
          data: { kind: "task", record: t },
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
          icon: PenLine,
          title: d.title,
          subtitle: `${words} word${words !== 1 ? "s" : ""}`,
          panel: "writing",
          data: { kind: "draft", record: d },
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
          icon: FolderKanban,
          title: p.name,
          subtitle: `${p.status} · ${p.progress}%`,
          panel: "projects",
          data: { kind: "project", record: p },
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
          icon: Code2,
          title: s.name,
          subtitle: s.language,
          panel: "snippets",
          data: { kind: "snippet", record: s },
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

  if (!visible) return null;

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

  const mac = isMac();

  // The modal widens if the list contains ANY previewable result, and then
  // holds that width while you arrow around. Resizing the dialog mid-keyboard-
  // navigation would be exactly the kind of motion the usability contract warns
  // against, so non-previewable rows get a placeholder rather than a reflow.
  const hasPreviewable = items.some((i) => i.data);
  const selectedData = items[selectedIdx]?.data;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${open ? "animate-fade-in" : ""}`} />

      {/* Modal */}
      <div
        ref={trapRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={`relative w-full ${hasPreviewable ? "max-w-3xl" : "max-w-lg"} bg-white dark:bg-[#1a1714] rounded-2xl shadow-2xl border border-[#e8e2d8] dark:border-[#2a2520] overflow-hidden z-10 ${open ? "animate-modal-in" : "animate-modal-out"}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "72dvh", display: "flex", flexDirection: "column" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#e8e2d8] dark:border-[#2a2520] shrink-0">
          <Search size={16} strokeWidth={1.75} className="text-[#6f6455] shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            aria-label="Search commands, panels, tasks"
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search panels, tasks, drafts, shortcuts..."
            className="flex-1 bg-transparent outline-none text-sm text-[#111010] dark:text-white placeholder:text-[#756a5a]"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setSelectedIdx(0); inputRef.current?.focus(); }}
              aria-label="Clear search"
              className="w-8 h-8 flex items-center justify-center text-[#756a5a] hover:text-[#6f6455] transition-colors shrink-0 rounded-lg"
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
          <Kbd>ESC</Kbd>
        </div>

        {/* Results + preview */}
        <div className="flex flex-1 min-h-0">
        <div
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className={`overflow-y-auto ${hasPreviewable ? "sm:w-[22rem] sm:shrink-0 flex-1 sm:flex-none" : "flex-1"}`}
          style={{ scrollbarWidth: "thin" }}
        >
          {items.length === 0 && query.trim().length > 0 && (
            <div className="px-4 py-10 text-center">
              <Search size={24} strokeWidth={1.5} className="mb-2 mx-auto opacity-60" />
              <p className="text-sm text-[#6f6455]">
                No results for <strong>&ldquo;{query}&rdquo;</strong>
              </p>
            </div>
          )}

          {indexedGroups.map(({ kind, items: groupItems }) => (
            <div key={kind}>
              <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-[#6f6455] dark:text-[#7a6f60] font-mono">
                {kindLabels[kind]}
              </div>
              {groupItems.map((item) => {
                const isSelected = item.flatIdx === selectedIdx;
                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    data-idx={item.flatIdx}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setSelectedIdx(item.flatIdx)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      background: isSelected ? "rgba(var(--accent-rgb), 0.14)" : "transparent",
                    }}
                  >
                    <span className="text-base shrink-0 w-5 text-center leading-none">
                      <item.icon size={16} strokeWidth={1.75} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-[#111010]">
                        {highlightMatch(item.title, query)}
                      </div>
                      {item.subtitle && (
                        <div className="text-[10px] text-[#6f6455] dark:text-[#b0a090] font-mono truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    {item.shortcut && (
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        {item.shortcut.map((k, i) => (
                          <Kbd key={i}>{mac && k === "Ctrl" ? "⌘" : k}</Kbd>
                        ))}
                      </div>
                    )}
                    {!item.shortcut && item.panel && (
                      <span className="text-[10px] font-mono text-[#756a5a] shrink-0 ml-2 hidden sm:block">
                        →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="h-2" />
        </div>

        {/* Preview pane — hidden below sm, where there's no room for two columns */}
        {hasPreviewable && (
          <div
            aria-live="polite"
            className="hidden sm:block flex-1 min-w-0 border-l border-[#f3f0ea] dark:border-[#2a2520] bg-[#fdfcfa] dark:bg-[#161311]"
          >
            <PalettePreview data={selectedData} />
          </div>
        )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#f3f0ea] dark:border-[#2a2520] px-4 py-2 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#756a5a]">
            <Kbd>↑↓</Kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#756a5a]">
            <Kbd>↵</Kbd>
            <span>select</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#756a5a]">
            <Kbd>Esc</Kbd>
            <span>close</span>
          </div>
          {items.length > 0 && (
            <span className="text-[9px] font-mono text-[#756a5a] ml-auto">
              {items.length} result{items.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
