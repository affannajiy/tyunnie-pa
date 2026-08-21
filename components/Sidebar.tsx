// components/Sidebar.tsx
"use client";

import { useState } from "react";
import {
  Home,
  Target,
  Sparkles,
  Gamepad2,
  Pin,
  Maximize2,
  type LucideIcon,
} from "lucide-react";

export type Panel =
  | "desk"
  | "focus"
  | "create"
  | "play"
  | "profile"
  | "todo"
  | "writing"
  | "projects"
  | "snippets"
  | "finance"
  | "music"
  | "pomodoro"
  | "games"
  | "calculator"
  | "speedtest";

type Props = {
  active: Panel;
  onChange: (panel: Panel) => void;
  tyunnieOpen?: boolean;
  onTyunnieToggle?: () => void;
  onNewSticky?: () => void;
  onFocusMode?: () => void;
  hiddenPanels?: Set<string>;
};

const NAV_ITEMS: { panel: Panel; icon: LucideIcon; label: string }[] = [
  { panel: "desk",   icon: Home,     label: "Home" },
  // "Focus" here is the Productivity hub. Focus *Mode* (the fullscreen timer)
  // is a separate button below and MUST NOT share this icon or label — they
  // used to both be 🎯 "Focus", which read as one control with two behaviours.
  { panel: "focus",  icon: Target,   label: "Focus" },
  { panel: "create", icon: Sparkles, label: "Create" },
  { panel: "play",   icon: Gamepad2, label: "Play" },
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

// Dock item indices: 0-3 = NAV_ITEMS, 4 = Tyun, 5 = Sticky, 6 = FocusMode
// (Logout now lives in the header avatar menu, not the dock.)
const TYUN_IDX   = NAV_ITEMS.length;      // 4
const STICKY_IDX = NAV_ITEMS.length + 1; // 5
const FOCUS_IDX  = NAV_ITEMS.length + 2; // 6

export default function Sidebar({
  active,
  onChange,
  tyunnieOpen = false,
  onTyunnieToggle,
  onNewSticky,
  onFocusMode,
  hiddenPanels,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  // Tap feedback. The dock icons already carry an inline `transform` from
  // dockScale(), and inline styles beat Tailwind's active:scale-* utility — so
  // the press has to be composed into that same transform rather than added as
  // a class. Keyed by dock slot (see NAV_ITEMS indices in CLAUDE.md).
  const [pressedIdx, setPressedIdx] = useState<number | null>(null);
  const pressProps = (idx: number) => ({
    onPointerDown: () => setPressedIdx(idx),
    onPointerUp: () => setPressedIdx(null),
    onPointerLeave: () => setPressedIdx(null),
    onPointerCancel: () => setPressedIdx(null),
  });
  const visibleNavItems = NAV_ITEMS.filter((item) => !hiddenPanels?.has(item.panel));

  return (
    <>
      {/* ── DESKTOP: macOS-style bottom dock ── */}
      <nav
        aria-label="Primary"
        className="on-dark hidden md:flex fixed bottom-5 left-1/2 -translate-x-1/2 z-50 items-end gap-1 px-3 py-2.5"
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
        {visibleNavItems.map(({ panel, icon: Icon, label }, idx) => {
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
                aria-label={label}
                /* The active item is otherwise signalled by an accent tint
                   alone — colour is never the only carrier of meaning
                   (WCAG 1.4.1), and a screen reader has no tint to read. */
                aria-current={isActive ? "page" : undefined}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
                {...pressProps(idx)}
                className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none transition-colors duration-100"
                style={{
                  width: 44,
                  height: 44,
                  transform: `scale(${scale * (pressedIdx === idx ? 0.9 : 1)})`,
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
                {/* Stroke icons carry no colour of their own, so the accent
                    does the hierarchy the old emoji couldn't. */}
                <Icon
                  size={22}
                  strokeWidth={1.75}
                  color={isActive ? "var(--accent-text)" : "rgba(255,255,255,0.62)"}
                />
              </button>

              {/* Active dot */}
              <div
                className="rounded-full mt-1"
                style={{
                  width: 5,
                  height: 5,
                  background: isActive ? "var(--accent-text)" : "transparent",
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
            {...pressProps(TYUN_IDX)}
            title="Tyunnie"
            className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none"
            style={{
              width: 44,
              height: 44,
              transform: `scale(${dockScale(TYUN_IDX, hoveredIdx) * (pressedIdx === TYUN_IDX ? 0.9 : 1)})`,
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
              background: tyunnieOpen ? "var(--accent-text)" : "transparent",
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
            {...pressProps(STICKY_IDX)}
            title="New sticky note"
            className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none transition-colors duration-100"
            style={{
              width: 44,
              height: 44,
              transform: `scale(${dockScale(STICKY_IDX, hoveredIdx) * (pressedIdx === STICKY_IDX ? 0.9 : 1)})`,
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
            <Pin size={22} strokeWidth={1.75} color="rgba(255,255,255,0.62)" />
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
            {...pressProps(FOCUS_IDX)}
            title="Focus Mode"
            className="flex items-center justify-center rounded-[13px] cursor-pointer border-none outline-none transition-colors duration-100"
            style={{
              width: 44,
              height: 44,
              transform: `scale(${dockScale(FOCUS_IDX, hoveredIdx) * (pressedIdx === FOCUS_IDX ? 0.9 : 1)})`,
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
            {/* Deliberately NOT Target — that belongs to the Productivity hub. */}
            <Maximize2 size={22} strokeWidth={1.75} color="rgba(255,255,255,0.62)" />
          </button>
          <div className="w-1 h-1 mt-1" />
        </div>

        {/* Logout moved to the header avatar menu (Profile ▸ Log out) */}
      </nav>

      {/* ── MOBILE: compact bottom tab bar ── */}
      <nav
        aria-label="Primary"
        className="on-dark md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
        style={{
          background: "rgba(15, 14, 13, 0.92)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {visibleNavItems.map(({ panel, icon: Icon, label }) => {
          const isActive = active === panel;
          return (
            <button
              key={panel}
              onClick={() => onChange(panel)}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 min-w-0 active:opacity-60"
              style={{
                /* 0.45 white composited over the bar reads 4.53:1, but the
                   label below dimmed it again to 0.55 — 2.17:1 in effect,
                   under the 4.5:1 floor (WCAG 1.4.3). Both raised so the
                   product still clears it. */
                color: isActive ? "var(--accent-text)" : "rgba(255,255,255,0.72)",
                transition: "color 0.2s ease",
              }}
            >
              <span
                className="leading-none"
                style={{
                  display: "block",
                  transform: isActive ? "scale(1.18) translateY(-1px)" : "scale(1) translateY(0)",
                  transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-wide font-mono"
                style={{ opacity: isActive ? 1 : 0.85, transition: "opacity 0.2s ease" }}
              >
                {label}
              </span>
              <div
                className="rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  background: isActive ? "var(--accent-text)" : "transparent",
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
            color: tyunnieOpen ? "var(--accent-text)" : "rgba(255,255,255,0.45)",
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
              background: tyunnieOpen ? "var(--accent-text)" : "transparent",
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
          <span className="leading-none" style={{ display: "block", transition: "transform 0.15s ease" }}>
            <Pin size={22} strokeWidth={1.75} />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wide font-mono opacity-55">Sticky</span>
          <div className="w-1.5 h-1.5" />
        </button>

        {/* Focus Mode */}
        <button
          onClick={onFocusMode}
          className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-1 min-w-0 active:opacity-60"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {/* Distinct icon AND distinct label from the "Focus" hub tab above —
              on mobile they sit in the same bar with nothing else to tell them apart. */}
          <span className="leading-none" style={{ display: "block", transition: "transform 0.15s ease" }}>
            <Maximize2 size={22} strokeWidth={1.75} />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wide font-mono opacity-55">Zen</span>
          <div className="w-1.5 h-1.5" />
        </button>

        {/* Logout moved to the header avatar menu (Profile ▸ Log out) */}
      </nav>
    </>
  );
}
