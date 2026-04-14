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
  | "games";

type Props = {
  active: Panel;
  onChange: (panel: Panel) => void;
  onSignOut: () => void;
  userName?: string;
  avatarUrl?: string | null;
  tyunnieOpen?: boolean;
  onTyunnieToggle?: () => void;
  onNewSticky?: () => void;
};

const NAV_ITEMS: { panel: Panel; icon: string; label: string }[] = [
  { panel: "desk", icon: "🏠", label: "Home" },
  { panel: "productivity", icon: "⚡", label: "Work" },
  { panel: "entertainment", icon: "🎮", label: "Play" },
  { panel: "profile", icon: "👤", label: "Me" },
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

// Dock item indices: 0-3 = NAV_ITEMS, 4 = Tyun, 5 = Sticky, 6 = Logout
const TYUN_IDX   = NAV_ITEMS.length;       // 4
const STICKY_IDX = NAV_ITEMS.length + 1;  // 5
const LOGOUT_IDX = NAV_ITEMS.length + 2;  // 6

export default function Sidebar({
  active,
  onChange,
  onSignOut,
  userName,
  avatarUrl,
  tyunnieOpen = false,
  onTyunnieToggle,
  onNewSticky,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const initials = userName
    ? userName
        .trim()
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ME";

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
                {panel === "profile" ? (
                  avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-7 h-7 rounded-full object-cover"
                      style={{
                        outline: isActive
                          ? "2px solid var(--accent)"
                          : "2px solid transparent",
                        outlineOffset: "1px",
                      }}
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: isActive ? "var(--accent)" : "#2a2520",
                        color: isActive ? "#fff" : "#c8b89a",
                      }}
                    >
                      {initials}
                    </div>
                  )
                ) : (
                  <span className="text-xl leading-none">{icon}</span>
                )}
              </button>

              {/* Active dot */}
              <div
                className="w-1 h-1 rounded-full mt-1 transition-all duration-200"
                style={{
                  background: isActive ? "var(--accent)" : "transparent",
                  boxShadow: isActive
                    ? `0 0 4px rgba(var(--accent-rgb), 0.7)`
                    : "none",
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
            className="w-1 h-1 rounded-full mt-1 transition-all duration-200"
            style={{
              background: tyunnieOpen ? "var(--accent)" : "transparent",
              boxShadow: tyunnieOpen
                ? `0 0 4px rgba(var(--accent-rgb), 0.7)`
                : "none",
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center px-2 pb-safe"
        style={{
          background: "rgba(15, 14, 13, 0.88)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {NAV_ITEMS.map(({ panel, icon, label }) => {
          const isActive = active === panel;
          return (
            <button
              key={panel}
              onClick={() => onChange(panel)}
              className="shrink-0 w-14 flex flex-col items-center justify-center pt-2.5 pb-1 gap-0.5 transition-all duration-200"
              style={{ color: isActive ? "var(--accent)" : "rgba(255,255,255,0.4)" }}
            >
              {panel === "profile" ? (
                avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="w-6 h-6 rounded-full object-cover"
                    style={{
                      outline: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                      outlineOffset: "1px",
                    }}
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{
                      background: isActive ? "var(--accent)" : "#2a2520",
                      color: isActive ? "#fff" : "#c8b89a",
                    }}
                  >
                    {initials}
                  </div>
                )
              ) : (
                <span className="text-base leading-none">{icon}</span>
              )}
              <span
                className="text-[7px] font-bold uppercase tracking-wide font-mono"
                style={{ opacity: isActive ? 1 : 0.6 }}
              >
                {label}
              </span>
              <div
                className="w-1 h-1 rounded-full transition-all duration-200"
                style={{ background: isActive ? "var(--accent)" : "transparent" }}
              />
            </button>
          );
        })}

        {/* Tyun chat button */}
        <button
          onClick={onTyunnieToggle}
          className="shrink-0 w-14 flex flex-col items-center justify-center pt-2.5 pb-1 gap-0.5 transition-all duration-200"
          style={{ color: tyunnieOpen ? "var(--accent)" : "rgba(255,255,255,0.4)" }}
        >
          <span className="text-base leading-none">🧡</span>
          <span
            className="text-[7px] font-bold uppercase tracking-wide font-mono"
            style={{ opacity: tyunnieOpen ? 1 : 0.6 }}
          >
            Tyun
          </span>
          <div
            className="w-1 h-1 rounded-full transition-all duration-200"
            style={{ background: tyunnieOpen ? "var(--accent)" : "transparent" }}
          />
        </button>

        {/* Sticky note */}
        <button
          onClick={onNewSticky}
          className="shrink-0 w-14 flex flex-col items-center justify-center pt-2.5 pb-1 gap-0.5 transition-all duration-200"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          <span className="text-base leading-none">📌</span>
          <span className="text-[7px] font-bold uppercase tracking-wide font-mono opacity-60">
            Sticky
          </span>
          <div className="w-1 h-1" />
        </button>

        {/* Logout */}
        <button
          onClick={onSignOut}
          className="shrink-0 w-12 flex flex-col items-center justify-center pt-2.5 pb-1 transition-all"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onTouchStart={(e) => (e.currentTarget.style.color = "rgb(239,68,68)")}
          onTouchEnd={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          <span className="text-base">↩</span>
          <span className="text-[7px] font-bold uppercase tracking-wide font-mono opacity-60">
            Out
          </span>
          <div className="w-1 h-1 mt-px" />
        </button>
      </div>
    </>
  );
}
