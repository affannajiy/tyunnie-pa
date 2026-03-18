// components/Sidebar.tsx
"use client";

export type Panel =
  | "calendar"
  | "todo"
  | "writing"
  | "projects"
  | "snippets"
  | "finance"
  | "music";

type Props = {
  active: Panel;
  onChange: (panel: Panel) => void;
  onSignOut: () => void;
};

const NAV_ITEMS: { panel: Panel; icon: string; label: string }[] = [
  { panel: "calendar", icon: "📅", label: "Cal" },
  { panel: "todo", icon: "✅", label: "Tasks" },
  { panel: "writing", icon: "✍️", label: "Write" },
  { panel: "projects", icon: "🗂️", label: "Proj" },
  { panel: "snippets", icon: "⌨️", label: "Snips" },
  { panel: "finance", icon: "💰", label: "Money" },
  { panel: 'music',    icon: '🎵', label: 'Music' },
];

export default function Sidebar({ active, onChange, onSignOut }: Props) {
  return (
    <>
      {/* ── DESKTOP: vertical left sidebar ── */}
      <div className="hidden md:flex w-17 bg-[#111010] flex-col items-center py-5 gap-1 shrink-0">
        <div
          className="text-[#f97316] font-serif italic text-[11px] tracking-[3px] mb-6"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          TYUNNIE
        </div>

        {NAV_ITEMS.map(({ panel, icon, label }) => (
          <button
            key={panel}
            onClick={() => onChange(panel)}
            title={panel.charAt(0).toUpperCase() + panel.slice(1)}
            className={`
              w-11.5 h-12.5 rounded-[14px] flex flex-col items-center justify-center gap-0.75
              transition-all duration-200 border-none cursor-pointer
              ${
                active === panel
                  ? "bg-[rgba(249,115,22,0.18)] text-[#f97316]"
                  : "bg-transparent text-[#fff0e6] hover:bg-[rgba(249,115,22,0.12)] hover:text-[#f97316]"
              }
            `}
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="text-[6.5px] font-bold uppercase tracking-[1.2px] font-mono">
              {label}
            </span>
          </button>
        ))}

        <div className="flex-1" />

        {/* Sign out on desktop */}
        <button
          onClick={onSignOut}
          title="Sign out"
          className="w-11.5 h-11.5 rounded-[14px] flex items-center justify-center bg-transparent text-[#4a4038] hover:bg-[rgba(239,68,68,0.12)] hover:text-red-500 transition-all duration-200 text-lg"
        >
          ↩
        </button>
      </div>

      {/* ── MOBILE: bottom tab bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#111010] border-t border-[#2a2520] flex items-center z-50 px-1 pb-safe">
        {NAV_ITEMS.map(({ panel, icon, label }) => (
          <button
            key={panel}
            onClick={() => onChange(panel)}
            className={`
              flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5
              transition-all duration-200
              ${active === panel ? "text-[#f97316]" : "text-[#4a4038]"}
            `}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-[8px] font-bold uppercase tracking-wide font-mono">
              {label}
            </span>
          </button>
        ))}

        {/* Sign out on mobile */}
        <button
          onClick={onSignOut}
          className="shrink-0 flex flex-col items-center justify-center py-2.5 px-3 text-[#4a4038] hover:text-red-500 transition-all"
        >
          <span className="text-xl">↩</span>
          <span className="text-[8px] font-bold uppercase tracking-wide font-mono">
            Out
          </span>
        </button>
      </div>
    </>
  );
}
