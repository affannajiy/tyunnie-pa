"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";
import type { Profile, Todo, Project, FinanceEntry } from "@/lib/database";
import { upsertProfile } from "@/lib/database";
import type { Panel } from "@/components/Sidebar";

// ── Types ──────────────────────────────────────────────────────────────────

type WidgetId =
  | "tasks"
  | "progress"
  | "pomodoro"
  | "music"
  | "activity"
  | "quote"
  | "clock"
  | "weather";

interface WLayout {
  id: WidgetId;
  x: number; // column (0-based)
  y: number; // row (0-based)
  w: number; // column span
  h: number; // row span
}

export interface DeskWidgetsProps {
  profile: Profile | null;
  todos: Todo[];
  projects: Project[];
  finance: FinanceEntry[];
  financeViewMonth: number;
  financeViewYear: number;
  onNavigate: (panel: Panel) => void;
  onTodoToggle: (id: string, done: boolean) => void;
  onFocusMode: () => void;
  oneliner: string | null;
  userId?: string;
  savedLayout?: unknown | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const COLS = 4;
const CELL_H = 100; // px per row unit
const GAP = 12;     // px gap between cells
const LS_KEY = "tyunnie_widgets";

const WIDGET_META: Record<WidgetId, { label: string; icon: string }> = {
  tasks:    { label: "Today's Focus",   icon: "✅" },
  progress: { label: "Life Progress",   icon: "📊" },
  pomodoro: { label: "Focus Timer",     icon: "⏲️" },
  music:    { label: "Now Playing",     icon: "🎵" },
  activity: { label: "Recent Activity", icon: "🗂️" },
  quote:    { label: "Tyunnie Says",    icon: "💬" },
  clock:    { label: "Clock",           icon: "🕐" },
  weather:  { label: "Weather",         icon: "🌤️" },
};

const DEFAULT_LAYOUT: WLayout[] = [
  { id: "tasks",    x: 0, y: 0, w: 1, h: 3 },
  { id: "progress", x: 1, y: 0, w: 1, h: 3 },
  { id: "pomodoro", x: 2, y: 0, w: 1, h: 3 },
  { id: "music",    x: 3, y: 0, w: 1, h: 3 },
  { id: "activity", x: 0, y: 3, w: 2, h: 3 },
  { id: "quote",    x: 2, y: 3, w: 2, h: 3 },
  { id: "clock",    x: 0, y: 6, w: 1, h: 1 },
  { id: "weather",  x: 1, y: 6, w: 1, h: 1 },
];

// ── Collision resolution ───────────────────────────────────────────────────

function resolveCollisions(layouts: WLayout[], movedId: WidgetId): WLayout[] {
  function overlaps(a: WLayout, b: WLayout): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  let result = [...layouts];
  let changed = true;
  let iter = 0;
  while (changed && iter < 20) {
    changed = false;
    iter++;
    const sorted = [...result].sort((a, b) =>
      a.id === movedId ? -1 : b.id === movedId ? 1 : a.y - b.y
    );
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (overlaps(sorted[i], sorted[j])) {
          const newY = sorted[i].y + sorted[i].h;
          if (sorted[j].y < newY) {
            const idx = result.findIndex((w) => w.id === sorted[j].id);
            result[idx] = { ...sorted[j], y: newY };
            sorted[j] = result[idx];
            changed = true;
          }
        }
      }
    }
  }
  return result;
}

// ── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES: { name: string; icon: string; layouts: WLayout[]; hidden: WidgetId[] }[] = [
  {
    name: "Dashboard",
    icon: "🏠",
    layouts: [
      { id: "tasks",    x: 0, y: 0, w: 1, h: 3 },
      { id: "progress", x: 1, y: 0, w: 1, h: 3 },
      { id: "pomodoro", x: 2, y: 0, w: 1, h: 3 },
      { id: "music",    x: 3, y: 0, w: 1, h: 3 },
      { id: "activity", x: 0, y: 3, w: 2, h: 3 },
      { id: "quote",    x: 2, y: 3, w: 2, h: 3 },
      { id: "clock",    x: 0, y: 6, w: 1, h: 1 },
      { id: "weather",  x: 1, y: 6, w: 1, h: 1 },
    ],
    hidden: [],
  },
  {
    name: "Focus",
    icon: "🎯",
    layouts: [
      { id: "tasks",    x: 0, y: 0, w: 2, h: 4 },
      { id: "pomodoro", x: 2, y: 0, w: 2, h: 4 },
      { id: "quote",    x: 0, y: 4, w: 4, h: 2 },
    ],
    hidden: ["progress", "music", "activity", "clock", "weather"],
  },
  {
    name: "Minimal",
    icon: "✨",
    layouts: [
      { id: "tasks",    x: 0, y: 0, w: 2, h: 3 },
      { id: "clock",    x: 2, y: 0, w: 1, h: 2 },
      { id: "weather",  x: 3, y: 0, w: 1, h: 2 },
      { id: "quote",    x: 2, y: 2, w: 2, h: 2 },
    ],
    hidden: ["progress", "pomodoro", "music", "activity"],
  },
  {
    name: "Finance",
    icon: "💰",
    layouts: [
      { id: "progress", x: 0, y: 0, w: 2, h: 4 },
      { id: "activity", x: 2, y: 0, w: 2, h: 4 },
      { id: "music",    x: 0, y: 4, w: 2, h: 3 },
      { id: "quote",    x: 2, y: 4, w: 2, h: 3 },
    ],
    hidden: ["tasks", "pomodoro", "clock", "weather"],
  },
];

// ── Persistence ────────────────────────────────────────────────────────────

function loadSaved(): { layouts: WLayout[]; hidden: WidgetId[] } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { layouts: DEFAULT_LAYOUT, hidden: [] };
    const p = JSON.parse(raw);
    return {
      layouts: Array.isArray(p.layouts) ? p.layouts : DEFAULT_LAYOUT,
      hidden: Array.isArray(p.hidden) ? p.hidden : [],
    };
  } catch {
    return { layouts: DEFAULT_LAYOUT, hidden: [] };
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CircularProgress({
  value,
  size = 64,
  stroke = 5,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#F0EAE2" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--accent)" strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DeskWidgets({
  profile,
  todos,
  projects,
  finance,
  financeViewMonth,
  financeViewYear,
  onNavigate,
  onTodoToggle,
  onFocusMode,
  oneliner,
  userId,
  savedLayout,
}: DeskWidgetsProps) {
  const music = useMusicContext();
  const currency = profile?.currency ?? "RM";
  const today = new Date().toISOString().split("T")[0];

  // ── Layout state ──────────────────────────────────────────────────────────
  const [layouts, setLayouts] = useState<WLayout[]>(DEFAULT_LAYOUT);
  const [hidden, setHidden] = useState<WidgetId[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [cellW, setCellW] = useState(220);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const persistMounted = useRef(false);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragRef = useRef<{ id: WidgetId; offsetX: number; offsetY: number; w: number } | null>(null);
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // ── Resize state ──────────────────────────────────────────────────────────
  const [resizing, setResizing] = useState<WidgetId | null>(null);

  // ── Pomodoro ──────────────────────────────────────────────────────────────
  const [pomSettings, setPomSettings] = useState({ focusMins: 25, shortMins: 5 });
  const [pomRunning, setPomRunning] = useState(false);
  const [pomSeconds, setPomSeconds] = useState(25 * 60);
  const [pomMode, setPomMode] = useState<"focus" | "break">("focus");
  const pomRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Clock ─────────────────────────────────────────────────────────────────
  const [clock, setClock] = useState(new Date());

  // ── Weather ───────────────────────────────────────────────────────────────
  const [weather, setWeather] = useState<{
    temp: number;
    condition: string;
    icon: string;
  } | null>(null);

  // Load from DB (preferred) or localStorage
  useEffect(() => {
    if (savedLayout) {
      try {
        const p = savedLayout as { layouts?: WLayout[]; hidden?: WidgetId[] };
        setLayouts(Array.isArray(p.layouts) ? p.layouts : DEFAULT_LAYOUT);
        setHidden(Array.isArray(p.hidden) ? p.hidden : []);
        return;
      } catch { /* fall through to localStorage */ }
    }
    const saved = loadSaved();
    setLayouts(saved.layouts);
    setHidden(saved.hidden);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load pomodoro settings + listen for changes from the full Pomodoro panel
  useEffect(() => {
    function readPomSettings() {
      try {
        const raw = localStorage.getItem("tyunnie_pomodoro_settings");
        if (!raw) return;
        const p = JSON.parse(raw) as { focusMins?: number; shortMins?: number };
        setPomSettings({
          focusMins: typeof p.focusMins === "number" ? p.focusMins : 25,
          shortMins: typeof p.shortMins === "number" ? p.shortMins : 5,
        });
      } catch {}
    }
    readPomSettings();
    window.addEventListener("tyunnie-pomodoro-settings-changed", readPomSettings);
    return () => {
      window.removeEventListener("tyunnie-pomodoro-settings-changed", readPomSettings);
    };
  }, []);

  // Persist on change — localStorage immediately, DB debounced
  useEffect(() => {
    if (!persistMounted.current) {
      persistMounted.current = true;
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify({ layouts, hidden }));
    if (userId) {
      if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
      dbSaveTimerRef.current = setTimeout(() => {
        upsertProfile(userId, { desk_layout: { layouts, hidden } }).catch(() => {});
      }, 600);
    }
  }, [layouts, hidden, userId]);

  // Synchronous initial measurement — prevents grid jump on first paint
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.getBoundingClientRect().width;
    if (w > 0) {
      const mobile = w < 580;
      setIsMobile(mobile);
      if (!mobile) setCellW((w - GAP * (COLS - 1)) / COLS);
    }
  }, []);

  // ResizeObserver — handles subsequent resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) {
        const mobile = w < 580;
        setIsMobile(mobile);
        if (!mobile) setCellW((w - GAP * (COLS - 1)) / COLS);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Clock timer
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pomodoro timer
  useEffect(() => {
    if (pomRunning) {
      pomRef.current = setInterval(() => {
        setPomSeconds((s) => {
          if (s <= 1) {
            clearInterval(pomRef.current!);
            setPomRunning(false);
            const next = pomMode === "focus" ? "break" : "focus";
            setPomMode(next);
            return next === "focus"
              ? pomSettings.focusMins * 60
              : pomSettings.shortMins * 60;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (pomRef.current) clearInterval(pomRef.current);
    }
    return () => {
      if (pomRef.current) clearInterval(pomRef.current);
    };
  }, [pomRunning, pomMode, pomSettings]);

  // Reset widget timer when settings change from the full panel (only if not running)
  useEffect(() => {
    if (!pomRunning) {
      setPomMode("focus");
      setPomSeconds(pomSettings.focusMins * 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomSettings]);

  // Weather fetch
  useEffect(() => {
    const stored = localStorage.getItem("tyunnie_city");
    if (!stored) return;
    try {
      const { lat, lon } = JSON.parse(stored);
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      )
        .then((r) => r.json())
        .then((d) => {
          const code = d.current_weather?.weathercode ?? 0;
          const temp = Math.round(d.current_weather?.temperature ?? 0);
          const condition =
            code === 0 ? "Clear" : code <= 3 ? "Cloudy" : code <= 48 ? "Foggy" :
            code <= 67 ? "Rainy" : code <= 77 ? "Snowy" : code <= 82 ? "Showers" : "Stormy";
          const icon =
            code === 0 ? "☀️" : code <= 3 ? "⛅" : code <= 48 ? "🌫️" :
            code <= 67 ? "🌧️" : code <= 77 ? "❄️" : code <= 82 ? "🌦️" : "⛈️";
          setWeather({ temp, condition, icon });
        });
    } catch {}
  }, []);

  // ── Drag ──────────────────────────────────────────────────────────────────

  const startDrag = useCallback(
    (e: React.PointerEvent, id: WidgetId) => {
      if (!containerRef.current) return;
      const layout = layouts.find((l) => l.id === id);
      if (!layout) return;

      const cr = containerRef.current.getBoundingClientRect();
      const widgetLeft = layout.x * (cellW + GAP);
      const widgetTop = layout.y * (CELL_H + GAP);
      const offsetX = e.clientX - cr.left - widgetLeft;
      const offsetY = e.clientY - cr.top - widgetTop;
      const w = layout.w;

      dragRef.current = { id, offsetX, offsetY, w };
      dragPosRef.current = { x: layout.x, y: layout.y };
      setDragging(id);
      setDragPos({ x: layout.x, y: layout.y });

      function onMove(ev: PointerEvent) {
        if (!dragRef.current || !containerRef.current) return;
        const cr2 = containerRef.current.getBoundingClientRect();
        const pxX = ev.clientX - cr2.left - offsetX;
        const pxY = ev.clientY - cr2.top - offsetY;
        const newX = Math.max(0, Math.min(COLS - w, Math.round(pxX / (cellW + GAP))));
        const newY = Math.max(0, Math.round(pxY / (CELL_H + GAP)));
        dragPosRef.current = { x: newX, y: newY };
        setDragPos({ x: newX, y: newY });
      }

      function onUp() {
        const finalPos = dragPosRef.current;
        dragRef.current = null;
        setDragging(null);
        setDragPos(null);
        if (finalPos) {
          setLayouts((prev) => {
            const moved = prev.map((l) => (l.id === id ? { ...l, x: finalPos.x, y: finalPos.y } : l));
            return resolveCollisions(moved, id);
          });
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [layouts, cellW]
  );

  // ── Resize ────────────────────────────────────────────────────────────────

  const startResize = useCallback(
    (e: React.PointerEvent, id: WidgetId) => {
      e.stopPropagation();
      const layout = layouts.find((l) => l.id === id);
      if (!layout) return;

      const startW = layout.w;
      const startH = layout.h;
      const startPtrX = e.clientX;
      const startPtrY = e.clientY;
      const startCol = layout.x;
      const capCellW = cellW;

      setResizing(id);

      function onMove(ev: PointerEvent) {
        const dx = ev.clientX - startPtrX;
        const dy = ev.clientY - startPtrY;
        const newW = Math.max(1, Math.min(COLS - startCol, Math.round(startW + dx / (capCellW + GAP))));
        const newH = Math.max(1, Math.round(startH + dy / (CELL_H + GAP)));
        setLayouts((prev) =>
          prev.map((l) => (l.id === id ? { ...l, w: newW, h: newH } : l))
        );
      }

      function onUp() {
        setResizing(null);
        setLayouts((prev) => resolveCollisions(prev, id));
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [layouts, cellW]
  );

  // ── Derived data ──────────────────────────────────────────────────────────

  const dueSoonTodos = todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    })
    .slice(0, 3);

  const totalTodos = todos.length;
  const doneTodos = todos.filter((t) => t.done).length;
  const todoCompletionPct =
    totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;
  const avgProjectProgress =
    projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
      : 0;

  const monthIncome = finance
    .filter(
      (f) =>
        f.type === "income" &&
        new Date(f.date).getMonth() === financeViewMonth &&
        new Date(f.date).getFullYear() === financeViewYear
    )
    .reduce((s, f) => s + f.amount, 0);
  const monthExpenses = finance
    .filter(
      (f) =>
        f.type === "expense" &&
        new Date(f.date).getMonth() === financeViewMonth &&
        new Date(f.date).getFullYear() === financeViewYear
    )
    .reduce((s, f) => s + f.amount, 0);
  const monthBalance = monthIncome - monthExpenses;

  const pomMin = Math.floor(pomSeconds / 60).toString().padStart(2, "0");
  const pomSec = (pomSeconds % 60).toString().padStart(2, "0");
  const pomFocusTotal = pomSettings.focusMins * 60;
  const pomBreakTotal = pomSettings.shortMins * 60;
  const pomPct =
    pomMode === "focus"
      ? ((pomFocusTotal - pomSeconds) / pomFocusTotal) * 100
      : ((pomBreakTotal - pomSeconds) / pomBreakTotal) * 100;

  const recentActivity = [
    ...todos
      .filter((t) => t.done)
      .slice(0, 2)
      .map((t) => ({ icon: "✅", label: t.text, sub: "Task completed" })),
    ...finance.slice(0, 2).map((f) => ({
      icon: f.type === "income" ? "💰" : "💸",
      label: f.description,
      sub: `${f.type === "income" ? "+" : "-"}${currency}${f.amount.toFixed(2)}`,
    })),
  ].slice(0, 4);

  // ── Widget content renderers ──────────────────────────────────────────────

  function renderContent(id: WidgetId) {
    switch (id) {
      case "tasks":
        return (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono">
                Today's Focus
              </p>
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-sm">
                ✅
              </div>
            </div>
            {dueSoonTodos.length === 0 ? (
              <p className="text-xs text-[#c5bdb0] italic flex-1 py-2">
                All clear! Nothing due soon.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5 flex-1 overflow-auto">
                {dueSoonTodos.map((t) => (
                  <div key={t.id} className="flex items-start gap-2.5">
                    <button
                      onClick={() => onTodoToggle(t.id, !t.done)}
                      className="mt-0.5 w-4 h-4 rounded-full border-2 border-[#e8e2d8] shrink-0 flex items-center justify-center transition-all"
                      style={
                        {
                          "--hover-border": "var(--accent)",
                        } as React.CSSProperties
                      }
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = "var(--accent)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "#e8e2d8")
                      }
                    >
                      {t.done && (
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--accent)" }}
                        />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#2a1f15] leading-tight truncate">
                        {t.text}
                      </p>
                      {t.due && (
                        <p
                          className={`text-[9px] font-mono mt-0.5 ${
                            t.due < today
                              ? "text-red-400 font-bold"
                              : "text-[#b09880]"
                          }`}
                          style={
                            t.due === today ? { color: "var(--accent)", fontWeight: "bold" } : {}
                          }
                        >
                          {t.due < today
                            ? "⚠ overdue"
                            : t.due === today
                            ? "due today"
                            : t.due}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => onNavigate("todo")}
              className="text-[10px] font-mono hover:underline self-start mt-auto pt-1 shrink-0"
              style={{ color: "var(--accent)" }}
            >
              All tasks →
            </button>
          </div>
        );

      case "progress":
        return (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono">
                Life Progress
              </p>
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-sm">
                📊
              </div>
            </div>
            <div className="flex items-center justify-around flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <CircularProgress value={todoCompletionPct} size={54} stroke={5} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
                      {todoCompletionPct}%
                    </span>
                  </div>
                </div>
                <p className="text-[9px] font-mono text-[#b09880] uppercase tracking-wide">
                  Tasks
                </p>
                <p className="text-[9px] text-[#b09880]">
                  {doneTodos}/{totalTodos}
                </p>
              </div>
              <div className="w-px h-14 bg-[#f0ece8]" />
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <CircularProgress value={avgProjectProgress} size={54} stroke={5} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
                      {avgProjectProgress}%
                    </span>
                  </div>
                </div>
                <p className="text-[9px] font-mono text-[#b09880] uppercase tracking-wide">
                  Projects
                </p>
                <p className="text-[9px] text-[#b09880]">{projects.length} active</p>
              </div>
            </div>
            <div className="pt-3 border-t border-[#f8f4f0] shrink-0">
              <p className="text-[9px] text-[#b09880] font-mono mb-0.5">
                This month's balance
              </p>
              <p
                className={`text-base font-bold font-serif ${
                  monthBalance >= 0 ? "text-[#16a34a]" : "text-red-500"
                }`}
              >
                {monthBalance >= 0 ? "+" : ""}
                {currency}
                {Math.abs(monthBalance).toFixed(2)}
              </p>
            </div>
          </div>
        );

      case "pomodoro":
        return (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono">
                Focus Timer
              </p>
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-sm">
                ⏲️
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 flex-1 justify-center">
              <div className="relative">
                <CircularProgress value={pomPct} size={80} stroke={6} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-[#1a1208] font-mono leading-none">
                    {pomMin}:{pomSec}
                  </span>
                  <span
                    className="text-[9px] font-mono uppercase tracking-widest mt-0.5"
                    style={{ color: pomMode === "focus" ? "var(--accent)" : "#16a34a" }}
                  >
                    {pomMode}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setPomRunning((p) => !p)}
                  className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-all ${
                    pomRunning
                      ? "bg-[#f0ece8] text-[#8a6f5a] hover:bg-[#e8e2d8]"
                      : "text-white shadow-sm"
                  }`}
                  style={!pomRunning ? { background: "var(--accent)" } : {}}
                >
                  {pomRunning ? "⏸ Pause" : "▶ Start"}
                </button>
                <button
                  onClick={() => {
                    setPomRunning(false);
                    setPomMode("focus");
                    setPomSeconds(pomSettings.focusMins * 60);
                  }}
                  className="w-9 h-9 rounded-2xl border border-[#f0ece8] text-[#b09880] text-sm hover:text-[#f97316] hover:border-[#f97316] transition-all flex items-center justify-center"
                >
                  ↺
                </button>
              </div>
            </div>
            <div className="shrink-0">
              <button
                onClick={() => onNavigate("pomodoro")}
                className="text-[10px] font-mono hover:underline"
                style={{ color: "var(--accent)" }}
              >
                Full Pomodoro →
              </button>
            </div>
          </div>
        );

      case "music":
        return (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#b09880] font-mono">
                Now Playing
              </p>
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-sm">
                🎵
              </div>
            </div>
            {music.currentTrack ? (
              <>
                <div className="flex flex-col items-center gap-2 flex-1 overflow-hidden">
                  <div
                    className="w-16 h-16 rounded-2xl overflow-hidden bg-[#1a1410] shadow-md shrink-0"
                    style={{
                      boxShadow: music.isPlaying
                        ? "0 4px 20px rgba(var(--accent-rgb),0.4)"
                        : "0 2px 8px rgba(0,0,0,0.1)",
                      transition: "box-shadow 0.3s ease",
                    }}
                  >
                    {music.currentTrack.cover ? (
                      <Image
                        src={music.currentTrack.cover}
                        alt=""
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#4a4038] text-xl">
                        🎵
                      </div>
                    )}
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className="text-xs font-bold text-[#1a1208] truncate">
                      {music.currentTrack.title}
                    </p>
                    <p className="text-[10px] text-[#b09880] font-mono truncate">
                      {music.currentTrack.artist}
                    </p>
                  </div>
                  <div className="w-full h-1 bg-[#f0ece8] rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${
                          music.duration > 0
                            ? (music.progress / music.duration) * 100
                            : 0
                        }%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={music.prevTrack}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#f0ece8] text-[#b09880] hover:text-[#f97316] hover:border-[#f97316] transition-all text-xs"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={music.togglePlay}
                    className="flex-1 py-2 rounded-2xl text-white text-xs font-bold shadow-sm"
                    style={{ background: "var(--accent)" }}
                  >
                    {music.isPlaying ? "⏸ Pause" : "▶ Play"}
                  </button>
                  <button
                    onClick={music.nextTrack}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#f0ece8] text-[#b09880] hover:text-[#f97316] hover:border-[#f97316] transition-all text-xs"
                  >
                    ⏭
                  </button>
                </div>
                <button
                  onClick={() => onNavigate("music")}
                  className="text-[10px] font-mono hover:underline self-start shrink-0"
                  style={{ color: "var(--accent)" }}
                >
                  Open player →
                </button>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
                <div className="text-3xl opacity-20">🎵</div>
                <p className="text-xs text-[#c5bdb0] italic text-center">
                  Nothing playing.
                </p>
                <button
                  onClick={() => onNavigate("music")}
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold transition-all mt-1"
                  style={{ background: "var(--accent)" }}
                >
                  Open Player
                </button>
              </div>
            )}
          </div>
        );

      case "activity":
        return (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="font-serif italic text-base"
                style={{ color: "var(--accent)" }}
              >
                Recent Activity
              </span>
              <div className="flex-1 h-px bg-[#f0ece8]" />
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-[#c5bdb0] italic py-4 text-center">
                No recent activity. Go do something amazing! 🧡
              </p>
            ) : (
              <div className="flex flex-col overflow-auto flex-1">
                {recentActivity.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0 w-8">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 border border-[#fde8d0] flex items-center justify-center text-sm shrink-0">
                        {item.icon}
                      </div>
                      {i < Math.min(recentActivity.length, 3) - 1 && (
                        <div className="w-px flex-1 bg-[#f0ece8] my-1 min-h-3" />
                      )}
                    </div>
                    <div
                      className={`flex-1 min-w-0 ${
                        i < Math.min(recentActivity.length, 3) - 1 ? "pb-3" : ""
                      }`}
                    >
                      <p className="text-xs font-semibold text-[#1a1208] truncate leading-tight">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-[#b09880] font-mono">
                        {item.sub}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-auto pt-3 border-t border-[#f8f4f0] shrink-0">
              <button
                onClick={() => onNavigate("todo")}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-[#f0d8c8] text-[#b09880] text-sm font-medium hover:border-[#f97316] hover:text-[#f97316] hover:bg-orange-50/50 transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">+</span>
                Quick add a task
              </button>
            </div>
          </div>
        );

      case "quote":
        return (
          <div className="flex flex-col justify-center items-center text-center gap-3 h-full">
            <p
              className="text-[9px] font-mono uppercase tracking-[3px] opacity-70"
              style={{ color: "var(--accent)" }}
            >
              Tyunnie says
            </p>
            {oneliner ? (
              <p className="text-base text-[#e8ddd0] leading-relaxed font-serif italic px-2">
                &ldquo;{oneliner}&rdquo;
              </p>
            ) : (
              <div className="space-y-2 w-full px-4">
                <div className="h-3 bg-[#2a2520] rounded animate-pulse w-full" />
                <div className="h-3 bg-[#2a2520] rounded animate-pulse w-5/6 mx-auto" />
                <div className="h-3 bg-[#2a2520] rounded animate-pulse w-3/4 mx-auto" />
              </div>
            )}
          </div>
        );

      case "clock":
        return (
          <div className="flex flex-col items-center justify-center gap-1 h-full">
            <p className="text-[9px] font-mono text-[#b09880] uppercase tracking-widest">
              {clock.toLocaleDateString("en-MY", { weekday: "short" })}
            </p>
            <p className="text-2xl font-bold font-mono text-[#1a1208] leading-none tabular-nums">
              {clock.toLocaleTimeString("en-MY", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </p>
            <p className="text-[9px] font-mono text-[#b09880]">
              {clock.toLocaleDateString("en-MY", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        );

      case "weather":
        return (
          <div className="flex flex-col items-center justify-center gap-1 h-full">
            {weather ? (
              <>
                <p className="text-[9px] font-mono text-[#b09880] uppercase tracking-widest">
                  Weather
                </p>
                <p className="text-3xl leading-none">{weather.icon}</p>
                <p className="text-xl font-bold text-[#1a1208] font-mono leading-none">
                  {weather.temp}°C
                </p>
                <p className="text-[9px] font-mono text-[#b09880]">
                  {weather.condition}
                </p>
              </>
            ) : (
              <>
                <p className="text-[9px] font-mono text-[#b09880] uppercase tracking-widest">
                  Weather
                </p>
                <div className="text-2xl opacity-20">🌤️</div>
                <p className="text-[9px] text-[#c5bdb0] font-mono">No city set</p>
              </>
            )}
          </div>
        );
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const visibleLayouts = layouts.filter((l) => !hidden.includes(l.id));

  const getEffectiveLayout = (l: WLayout): WLayout => {
    if (dragging === l.id && dragPos) return { ...l, x: dragPos.x, y: dragPos.y };
    return l;
  };

  const allEffective = visibleLayouts.map(getEffectiveLayout);
  const totalH =
    allEffective.length > 0
      ? Math.max(...allEffective.map((l) => l.y + l.h)) * (CELL_H + GAP) - GAP
      : 400;

  const mobileLayouts = [...visibleLayouts].sort((a, b) =>
    a.y !== b.y ? a.y - b.y : a.x - b.x
  );

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-mono text-[#b09880] uppercase tracking-widest">
          Dashboard
        </p>
        <div className="flex gap-2">
          {editMode && (
            <>
              <button
                onClick={() => setShowTemplates(true)}
                className="px-3 py-1.5 rounded-xl text-[10px] font-bold border border-[#f0ece8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all"
              >
                Templates
              </button>
              <button
                onClick={() => {
                  setLayouts(DEFAULT_LAYOUT);
                  setHidden([]);
                }}
                className="px-3 py-1.5 rounded-xl text-[10px] font-bold border border-[#f0ece8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all"
              >
                Reset
              </button>
            </>
          )}
          <button
            onClick={() => setEditMode((e) => !e)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
              editMode
                ? "text-white shadow-sm"
                : "border border-[#f0ece8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]"
            }`}
            style={editMode ? { background: "var(--accent)" } : {}}
          >
            {editMode ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {/* Templates modal */}
      {showTemplates && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          onClick={() => setShowTemplates(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
          <div
            className="relative w-full max-w-sm bg-white dark:bg-[#1a1714] rounded-2xl shadow-2xl border border-[#e8e2d8] dark:border-[#2a2520] overflow-hidden z-10 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e2d8] dark:border-[#2a2520]">
              <span className="font-serif italic text-[var(--accent)] text-sm">Layout Templates</span>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-[#c5bdb0] hover:text-[#9a8f7e] transition-colors text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setLayouts(t.layouts);
                    setHidden(t.hidden);
                    setShowTemplates(false);
                  }}
                  className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border border-[#f0ece8] hover:border-[#f97316] hover:bg-orange-50 transition-all group"
                >
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-[#2d2416] group-hover:text-[#f97316] transition-colors">
                      {t.name}
                    </p>
                    <p className="text-[10px] text-[#b09880] font-mono">
                      {t.layouts.length} widget{t.layouts.length !== 1 ? "s" : ""}
                      {t.hidden.length > 0 ? ` · ${t.hidden.length} hidden` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Widget grid */}
      {isMobile ? (
        // Mobile: 2-column CSS grid, no drag/resize
        <div className="grid grid-cols-2 gap-3">
          {mobileLayouts.map((l) => {
            const isQuote = l.id === "quote";
            const isActivity = l.id === "activity";
            return (
              <div
                key={l.id}
                className={`rounded-3xl border border-[#f0ece8] shadow-sm overflow-hidden ${
                  isQuote || isActivity ? "col-span-2" : ""
                }`}
                style={{
                  minHeight: "160px",
                  background: isQuote
                    ? "linear-gradient(160deg, #1e1510 0%, #111010 100%)"
                    : "white",
                }}
              >
                {isQuote && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(ellipse at 60% 100%, rgba(var(--accent-rgb),0.18) 0%, transparent 65%)",
                    }}
                  />
                )}
                <div className="p-4 h-full relative z-10">{renderContent(l.id)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        // Desktop: absolute-positioned grid
        <div
          ref={containerRef}
          className="relative w-full"
          style={{ height: totalH }}
        >
          <style>{`
            @keyframes widgetWiggle {
              0%, 100% { transform: rotate(0deg); }
              25%       { transform: rotate(-0.5deg); }
              75%       { transform: rotate(0.5deg); }
            }
          `}</style>

          {/* Column guide lines in edit mode */}
          {editMode &&
            Array.from({ length: COLS }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 rounded pointer-events-none"
                style={{
                  left: i * (cellW + GAP),
                  width: cellW,
                  background: "rgba(var(--accent-rgb), 0.03)",
                  border: "1px dashed rgba(var(--accent-rgb), 0.10)",
                  zIndex: 0,
                }}
              />
            ))}

          {visibleLayouts.map((l) => {
            const eff = getEffectiveLayout(l);
            const left = eff.x * (cellW + GAP);
            const top = eff.y * (CELL_H + GAP);
            const width = eff.w * cellW + (eff.w - 1) * GAP;
            const height = eff.h * CELL_H + (eff.h - 1) * GAP;
            const isDragging = dragging === l.id;
            const isResizing = resizing === l.id;
            const isQuote = l.id === "quote";
            const active = isDragging || isResizing;

            return (
              <div
                key={l.id}
                className="absolute overflow-hidden rounded-3xl border border-[#f0ece8]"
                style={{
                  left,
                  top,
                  width,
                  height,
                  zIndex: active ? 100 : 1,
                  background: isQuote
                    ? "linear-gradient(160deg, #1e1510 0%, #111010 100%)"
                    : "white",
                  boxShadow: isDragging
                    ? "0 24px 64px rgba(0,0,0,0.20)"
                    : isResizing
                    ? "0 8px 32px rgba(0,0,0,0.10)"
                    : "0 1px 3px rgba(0,0,0,0.06)",
                  transform: isDragging ? "scale(1.03)" : "scale(1)",
                  transition: active
                    ? "none"
                    : "left 0.2s ease, top 0.2s ease, width 0.15s ease, height 0.15s ease, box-shadow 0.2s ease",
                  animation:
                    editMode && !active
                      ? "widgetWiggle 0.4s ease-in-out infinite"
                      : "none",
                }}
              >
                {/* Quote glow overlay */}
                {isQuote && (
                  <div
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                      background:
                        "radial-gradient(ellipse at 60% 100%, rgba(var(--accent-rgb),0.18) 0%, transparent 65%)",
                    }}
                  />
                )}

                {/* Drag handle (edit mode) */}
                {editMode && (
                  <div
                    className="absolute top-0 left-0 right-0 h-8 z-20 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                    style={{
                      background: isQuote
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(var(--accent-rgb),0.06)",
                    }}
                    onPointerDown={(e) => startDrag(e, l.id)}
                  >
                    <div
                      className="w-8 h-1 rounded-full"
                      style={{
                        background: isQuote ? "rgba(255,255,255,0.25)" : "#d0c8c0",
                      }}
                    />
                  </div>
                )}

                {/* Remove button (edit mode) */}
                {editMode && (
                  <button
                    className="absolute top-1.5 right-1.5 z-30 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 leading-none shadow-sm"
                    onClick={() => {
                      setHidden((h) => [...h, l.id]);
                      setLayouts((prev) => prev.filter((w) => w.id !== l.id));
                    }}
                  >
                    ×
                  </button>
                )}

                {/* Widget content */}
                <div
                  className={`h-full overflow-auto relative z-10 ${
                    editMode ? "pt-9 pb-6 px-5" : "p-5"
                  }`}
                >
                  {renderContent(l.id)}
                </div>

                {/* Resize handle (edit mode) */}
                {editMode && (
                  <div
                    className="absolute bottom-0 right-0 w-7 h-7 z-30 flex items-end justify-end p-1.5 cursor-se-resize"
                    onPointerDown={(e) => startResize(e, l.id)}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <line
                        x1="1" y1="10" x2="10" y2="1"
                        stroke={isQuote ? "rgba(255,255,255,0.35)" : "rgba(var(--accent-rgb),0.5)"}
                        strokeWidth="1.5" strokeLinecap="round"
                      />
                      <line
                        x1="5" y1="10" x2="10" y2="5"
                        stroke={isQuote ? "rgba(255,255,255,0.35)" : "rgba(var(--accent-rgb),0.5)"}
                        strokeWidth="1.5" strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add widgets panel */}
      {editMode && hidden.length > 0 && (
        <div className="mt-5 p-4 bg-white rounded-3xl border border-[#f0ece8] shadow-sm">
          <p className="text-[10px] font-bold text-[#b09880] uppercase tracking-widest mb-3 font-mono">
            Add Widget
          </p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((id) => (
              <button
                key={id}
                onClick={() => {
                  const maxY =
                    layouts.length > 0
                      ? Math.max(...layouts.map((l) => l.y + l.h))
                      : 0;
                  setLayouts((prev) => [
                    ...prev,
                    { id, x: 0, y: maxY, w: 1, h: 2 },
                  ]);
                  setHidden((h) => h.filter((i) => i !== id));
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-[#f0ece8] text-xs font-medium text-[#8a6f5a] transition-all"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#f0ece8";
                  e.currentTarget.style.color = "#8a6f5a";
                }}
              >
                <span>{WIDGET_META[id].icon}</span>
                {WIDGET_META[id].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
