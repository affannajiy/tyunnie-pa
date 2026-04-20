// components/Sidebar.tsx
"use client";

import { useState } from "react";

export type Panel =
  | "desk"
  | "productivity"
  | "entertainment"
  | "profile"
  | "todo"
  | "writing"
  | "projects"
  | "snippets"
  | "finance"
  | "music"
  | "pomodoro"
  | "games"
  | "calculator";

type Props = {
  active: Panel;
  onChange: (panel: Panel) => void;
  onSignOut: () => void;
  tyunnieOpen?: boolean;
  onTyunnieToggle?: () => void;
  onNewSticky?: () => void;
  onFocusMode?: () => void;
};

const NAV_ITEMS: { panel: Panel; icon: string; label: string }[] = [
  { panel: "desk", icon: "🏠", label: "Home" },
  { panel: "productivity", icon: "⚡", label: "Work" },
  { panel: "entertainment", icon: "🎮", label: "Play" },
];

// macOS dock magnification: returns scale based on distance from hovered index
function dockScale(idx: number, hoveredIdx: number | null): number {
  if (hoveredIdx === null) return 1;
  const dist = Math.abs(idx - hoveredIdx);
  if (dist === 0) return 1.55;
  if (dist === 1) return 1.22;
  if (dist === 2) return 1.08;
  return 1;
}

// Dock item indices: 0-2 = NAV_ITEMS, 3 = Tyun, 4 = Sticky, 5 = Focus, 6 = Logout
const TYUN_IDX   = NAV_ITEMS.length;       // 3
const STICKY_IDX = NAV_ITEMS.length + 1;  // 4
const FOCUS_IDX  = NAV_ITEMS.length + 2;  // 5
const LOGOUT_IDX = NAV_ITEMS.length + 3;  // 6

export default function Sidebar({
  active,
  onChange,
  onSignOut,
  tyunnieOpen = false,
  onTyunnieToggle,
  onNewSticky,
  onFocusMode,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <>
      {/* ── DESKTOP: macOS-style bottom dock ── */}
      <div
        className="hidden md:flex fixed bottom-5 left-1/2 -translate-x-1/2 z-50 items-end gap-1 px-3 py-2.5"
        style={{
          background: "rgba(15, 14, 13, 0.72)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: "22px",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Thin divider */}
        <div className="w-px h-5 bg-white/10 mx-1 self-center shrink-0" />

        {/* Nav items */}
        {NAV_ITEMS.map(({ panel, icon, label }, idx) => {
          const isActive = active === panel;
          const scale = dockScale(idx, hoveredIdx);
          return (
            <div
              key={panel}
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              <div
                className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white whitespace-nowrap pointer-events-none select-none transition-all duration-150"
                style={{
                  bottom: "calc(100% + 10px)",
                  background: "rgba(28,25,23,0.92)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  opacity: hoveredIdx === idx ? 1 : 0,
                  transform: `translateX(-50%) translateY(${hoveredIdx === idx ? 0 : 4}px)`,
                }}
              >
                {label}
              </div>

              {/* Icon button */}
              <button
                onClick={() => onChange(panel)}
                title={label}
                className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none transition-colors duration-100"
                style={{
                  width: 44,
                  height: 44,
                  transform: `scale(${scale})`,
                  transformOrigin: "bottom center",
                  transition:
                    "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease",
                  background: isActive
                    ? "rgba(var(--accent-rgb), 0.2)"
                    : "transparent",
                  boxShadow: isActive
                    ? `0 0 18px rgba(var(--accent-rgb), 0.45)`
                    : hoveredIdx === idx
                      ? `0 0 12px rgba(var(--accent-rgb), 0.2)`
                      : "none",
                }}
              >
                <span className="text-xl leading-none">{icon}</span>
              </button>

              {/* Active dot */}
              <div
                className="rounded-full mt-1"
                style={{
                  width: 5,
                  height: 5,
                  background: isActive ? "var(--accent)" : "transparent",
                  transform: isActive ? "scale(1)" : "scale(0)",
                  boxShadow: isActive ? `0 0 5px rgba(var(--accent-rgb), 0.8)` : "none",
                  transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease, box-shadow 0.2s ease",
                }}
              />
            </div>
          );
        })}

        {/* Divider before Tyun */}
        <div className="w-px h-5 bg-white/10 mx-1 self-center shrink-0" />

        {/* Tyun chat button */}
        <div
          className="relative flex flex-col items-center"
          onMouseEnter={() => setHoveredIdx(TYUN_IDX)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Tooltip */}
          <div
            className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white whitespace-nowrap pointer-events-none select-none transition-all duration-150"
            style={{
              bottom: "calc(100% + 10px)",
              background: "rgba(28,25,23,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              opacity: hoveredIdx === TYUN_IDX ? 1 : 0,
              transform: `translateX(-50%) translateY(${hoveredIdx === TYUN_IDX ? 0 : 4}px)`,
            }}
          >
            Tyunnie
          </div>

          <button
            onClick={onTyunnieToggle}
            title="Tyunnie"
            className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none"
            style={{
              width: 44,
              height: 44,
              transform: `scale(${dockScale(TYUN_IDX, hoveredIdx)})`,
              transformOrigin: "bottom center",
              transition:
                "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease",
              background: tyunnieOpen
                ? "rgba(var(--accent-rgb), 0.2)"
                : "transparent",
              boxShadow: tyunnieOpen
                ? `0 0 20px rgba(var(--accent-rgb), 0.5)`
                : hoveredIdx === TYUN_IDX
                  ? `0 0 12px rgba(var(--accent-rgb), 0.25)`
                  : "none",
            }}
          >
            <span className="text-xl leading-none">🧡</span>
          </button>

          {/* Active dot */}
          <div
            className="rounded-full mt-1"
            style={{
              width: 5,
              height: 5,
              background: tyunnieOpen ? "var(--accent)" : "transparent",
              transform: tyunnieOpen ? "scale(1)" : "scale(0)",
              boxShadow: tyunnieOpen ? `0 0 5px rgba(var(--accent-rgb), 0.8)` : "none",
              transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease, box-shadow 0.2s ease",
            }}
          />
        </div>

        {/* Sticky note button */}
        <div
          className="relative flex flex-col items-center"
          onMouseEnter={() => setHoveredIdx(STICKY_IDX)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Tooltip */}
          <div
            className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white whitespace-nowrap pointer-events-none select-none transition-all duration-150"
            style={{
              bottom: "calc(100% + 10px)",
              background: "rgba(28,25,23,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              opacity: hoveredIdx === STICKY_IDX ? 1 : 0,
              transform: `translateX(-50%) translateY(${hoveredIdx === STICKY_IDX ? 0 : 4}px)`,
            }}
          >
            New sticky
          </div>

          <button
            onClick={onNewSticky}
            title="New sticky note"
            className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none transition-colors duration-100"
            style={{
              width: 44,
              height: 44,
              transform: `scale(${dockScale(STICKY_IDX, hoveredIdx)})`,
              transformOrigin: "bottom center",
              transition:
                "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease",
              background: "transparent",
              boxShadow:
                hoveredIdx === STICKY_IDX
                  ? `0 0 12px rgba(var(--accent-rgb), 0.2)`
                  : "none",
            }}
          >
            <span className="text-xl leading-none">📌</span>
          </button>
          <div className="w-1 h-1 mt-1" />
        </div>

        {/* Focus Mode button */}
        <div
          className="relative flex flex-col items-center"
          onMouseEnter={() => setHoveredIdx(FOCUS_IDX)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Tooltip */}
          <div
            className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white whitespace-nowrap pointer-events-none select-none transition-all duration-150"
            style={{
              bottom: "calc(100% + 10px)",
              background: "rgba(28,25,23,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              opacity: hoveredIdx === FOCUS_IDX ? 1 : 0,
              transform: `translateX(-50%) translateY(${hoveredIdx === FOCUS_IDX ? 0 : 4}px)`,
            }}
          >
            Focus Mode
          </div>

          <button
            onClick={onFocusMode}
            title="Focus Mode"
            className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none transition-colors duration-100"
            style={{
              width: 44,
              height: 44,
              transform: `scale(${dockScale(FOCUS_IDX, hoveredIdx)})`,
              transformOrigin: "bottom center",
              transition:
                "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease",
              background: "transparent",
              boxShadow:
                hoveredIdx === FOCUS_IDX
                  ? `0 0 12px rgba(var(--accent-rgb), 0.2)`
                  : "none",
            }}
          >
            <span className="text-xl leading-none">🎯</span>
          </button>
          <div className="w-1 h-1 mt-1" />
        </div>

        {/* Divider before logout */}
        <div className="w-px h-5 bg-white/10 mx-1 self-center shrink-0" />

        {/* Logout */}
        <div
          className="relative flex flex-col items-center"
          onMouseEnter={() => setHoveredIdx(LOGOUT_IDX)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Tooltip */}
          <div
            className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white whitespace-nowrap pointer-events-none select-none transition-all duration-150"
            style={{
              bottom: "calc(100% + 10px)",
              background: "rgba(28,25,23,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              opacity: hoveredIdx === LOGOUT_IDX ? 1 : 0,
              transform: `translateX(-50%) translateY(${hoveredIdx === LOGOUT_IDX ? 0 : 4}px)`,
            }}
          >
            Sign out
          </div>

          <button
            onClick={onSignOut}
            title="Sign out"
            className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none transition-colors duration-100"
            style={{
              width: 44,
              height: 44,
              transform: `scale(${dockScale(LOGOUT_IDX, hoveredIdx)})`,
              transformOrigin: "bottom center",
              transition:
                "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease",
              background: "transparent",
              color:
                hoveredIdx === LOGOUT_IDX
                  ? "rgb(239,68,68)"
                  : "rgba(255,255,255,0.35)",
            }}
          >
            <span className="text-lg">↩</span>
          </button>
          <div className="w-1 h-1 mt-1" />
        </div>
      </div>

      {/* ── MOBILE: compact bottom tab bar ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
        style={{
          background: "rgba(15, 14, 13, 0.92)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV_ITEMS.map(({ panel, icon, label }) => {
          const isActive = active === panel;
          return (
            <button
              key={panel}
              onClick={() => onChange(panel)}
              className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 min-w-0 active:opacity-60"
              style={{
                color: isActive ? "var(--accent)" : "rgba(255,255,255,0.45)",
                transition: "color 0.2s ease",
              }}
            >
              <span
                className="text-[22px] leading-none"
                style={{
                  display: "block",
                  transform: isActive ? "scale(1.18) translateY(-1px)" : "scale(1) translateY(0)",
                  transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                {icon}
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-wide font-mono"
                style={{ opacity: isActive ? 1 : 0.55, transition: "opacity 0.2s ease" }}
              >
                {label}
              </span>
              <div
                className="rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  background: isActive ? "var(--accent)" : "transparent",
                  transform: isActive ? "scale(1)" : "scale(0)",
                  boxShadow: isActive ? `0 0 5px rgba(var(--accent-rgb), 0.8)` : "none",
                  transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease, box-shadow 0.2s ease",
                }}
              />
            </button>
          );
        })}

        {/* Tyun chat button */}
        <button
          onClick={onTyunnieToggle}
          className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 min-w-0 active:opacity-60"
          style={{
            color: tyunnieOpen ? "var(--accent)" : "rgba(255,255,255,0.45)",
            transition: "color 0.2s ease",
          }}
        >
          <span
            className="text-[22px] leading-none"
            style={{
              display: "block",
              transform: tyunnieOpen ? "scale(1.18) translateY(-1px)" : "scale(1) translateY(0)",
              transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            🧡
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-wide font-mono"
            style={{ opacity: tyunnieOpen ? 1 : 0.55, transition: "opacity 0.2s ease" }}
          >
            Tyun
          </span>
          <div
            className="rounded-full"
            style={{
              width: 5,
              height: 5,
              background: tyunnieOpen ? "var(--accent)" : "transparent",
              transform: tyunnieOpen ? "scale(1)" : "scale(0)",
              boxShadow: tyunnieOpen ? `0 0 5px rgba(var(--accent-rgb), 0.8)` : "none",
              transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease, box-shadow 0.2s ease",
            }}
          />
        </button>

        {/* Sticky note */}
        <button
          onClick={onNewSticky}
          className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 min-w-0 active:opacity-60"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          <span className="text-[22px] leading-none" style={{ display: "block", transition: "transform 0.15s ease" }}>📌</span>
          <span className="text-[9px] font-bold uppercase tracking-wide font-mono opacity-55">Sticky</span>
          <div className="w-1.5 h-1.5" />
        </button>

        {/* Focus Mode */}
        <button
          onClick={onFocusMode}
          className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 min-w-0 active:opacity-60"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          <span className="text-[22px] leading-none" style={{ display: "block", transition: "transform 0.15s ease" }}>🎯</span>
          <span className="text-[9px] font-bold uppercase tracking-wide font-mono opacity-55">Focus</span>
          <div className="w-1.5 h-1.5" />
        </button>

        {/* Logout */}
        <button
          onClick={onSignOut}
          className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 min-w-0 active:opacity-60"
          style={{ color: "rgba(255,255,255,0.3)", transition: "color 0.15s ease" }}
          onTouchStart={(e) => (e.currentTarget.style.color = "rgb(239,68,68)")}
          onTouchEnd={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          <span className="text-[22px]" style={{ display: "block" }}>↩</span>
          <span className="text-[9px] font-bold uppercase tracking-wide font-mono opacity-55">Out</span>
          <div className="w-1.5 h-1.5" />
        </button>
      </div>
    </>
  );
}
