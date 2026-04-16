// components/ShortcutHelp.tsx
"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function Kbd({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="text-[10px] font-mono bg-[#f3f0ea] dark:bg-[#2a2520] border border-[#e8e2d8] dark:border-[#3a3530] rounded px-2 py-0.5 text-[#9a8f7e] dark:text-[#7a6f60]"
        >
          {k}
        </kbd>
      ))}
    </div>
  );
}

function Row({ label, winKeys, macKeys }: { label: string; winKeys: string[]; macKeys: string[] }) {
  const mac = isMac();
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#f3f0ea] dark:border-[#2a2520] last:border-0">
      <span className="text-sm text-[#111010] dark:text-[#d4cfc8]">{label}</span>
      <div className="flex items-center gap-2">
        {!mac && <Kbd keys={winKeys} />}
        {mac && <Kbd keys={macKeys} />}
        {/* On unknown platform show both */}
        {typeof navigator !== "undefined" && !isMac() && winKeys.join() !== macKeys.join() && (
          <span className="text-[9px] text-[#c5bdb0] font-mono hidden md:inline">Ctrl</span>
        )}
      </div>
    </div>
  );
}

interface ShortcutGroup {
  title: string;
  rows: { label: string; win: string[]; mac: string[] }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    rows: [
      { label: "Home",              win: ["Ctrl", "1"], mac: ["⌘", "1"] },
      { label: "Tasks",             win: ["Ctrl", "2"], mac: ["⌘", "2"] },
      { label: "Writing",           win: ["Ctrl", "3"], mac: ["⌘", "3"] },
      { label: "Projects",          win: ["Ctrl", "4"], mac: ["⌘", "4"] },
      { label: "Snippets",          win: ["Ctrl", "5"], mac: ["⌘", "5"] },
      { label: "Finance",           win: ["Ctrl", "6"], mac: ["⌘", "6"] },
      { label: "Music",             win: ["Ctrl", "7"], mac: ["⌘", "7"] },
      { label: "Games",             win: ["Ctrl", "8"], mac: ["⌘", "8"] },
      { label: "Profile",           win: ["Ctrl", "9"], mac: ["⌘", "9"] },
    ],
  },
  {
    title: "Quick Add",
    rows: [
      { label: "New task",          win: ["Ctrl", "⇧", "N"], mac: ["⌘", "⇧", "N"] },
      { label: "New draft",         win: ["Ctrl", "⇧", "D"], mac: ["⌘", "⇧", "D"] },
      { label: "New project",       win: ["Ctrl", "⇧", "P"], mac: ["⌘", "⇧", "P"] },
      { label: "New snippet",       win: ["Ctrl", "⇧", "S"], mac: ["⌘", "⇧", "S"] },
    ],
  },
  {
    title: "Music",
    rows: [
      { label: "Play / pause",      win: ["Ctrl", "M"], mac: ["⌘", "M"] },
    ],
  },
  {
    title: "Panels & Overlays",
    rows: [
      { label: "Command palette",   win: ["Ctrl", "K"], mac: ["⌘", "K"] },
      { label: "Tyunnie chat",      win: ["Ctrl", "⇧", "T"], mac: ["⌘", "⇧", "T"] },
      { label: "Focus Mode",        win: ["Ctrl", "⇧", "F"], mac: ["⌘", "⇧", "F"] },
      { label: "Keyboard shortcuts",win: ["?"],              mac: ["?"] },
      { label: "Close / dismiss",   win: ["Esc"],            mac: ["Esc"] },
    ],
  },
  {
    title: "Within a Panel  (not in an input)",
    rows: [
      { label: "New item (N key)",  win: ["N"], mac: ["N"] },
    ],
  },
];

export default function ShortcutHelp({ open, onClose }: Props) {
  // Close on Escape — this is handled globally in dashboard, but belt-and-suspenders here
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-white dark:bg-[#1a1714] rounded-2xl shadow-2xl border border-[#e8e2d8] dark:border-[#2a2520] overflow-hidden z-10"
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e2d8] dark:border-[#2a2520] shrink-0">
          <span className="font-serif italic text-[var(--accent)] text-sm">
            Keyboard Shortcuts
          </span>
          <div className="flex items-center gap-2">
            <kbd className="text-[9px] font-mono bg-[#f3f0ea] dark:bg-[#2a2520] border border-[#e8e2d8] dark:border-[#3a3530] rounded px-1.5 py-0.5 text-[#9a8f7e]">
              ?
            </kbd>
            <button
              onClick={onClose}
              className="text-[#c5bdb0] hover:text-[#9a8f7e] transition-colors text-sm ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5" style={{ scrollbarWidth: "thin" }}>
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#c5bdb0] font-mono mb-2">
                {group.title}
              </p>
              <div>
                {group.rows.map((row) => (
                  <Row
                    key={row.label}
                    label={row.label}
                    winKeys={row.win}
                    macKeys={row.mac}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[#f3f0ea] dark:border-[#2a2520] px-5 py-2.5 shrink-0">
          <p className="text-[9px] font-mono text-[#c5bdb0]">
            Shortcuts work on both Mac (⌘) and Windows (Ctrl)
          </p>
        </div>
      </div>
    </div>
  );
}
