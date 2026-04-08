// components/Sidebar.tsx
"use client";

export type Panel =
  | "desk"
  | "todo"
  | "writing"
  | "projects"
  | "snippets"
  | "finance"
  | "music"
  | "pomodoro"
  | "games"
  | "profile";

type Props = {
  active: Panel;
  onChange: (panel: Panel) => void;
  onSignOut: () => void;
  userName?: string;
  avatarUrl?: string | null;
};

const NAV_ITEMS: { panel: Panel; icon: string; label: string }[] = [
  { panel: "desk", icon: "🏠", label: "Home" },
  { panel: "todo", icon: "✅", label: "Tasks" },
  { panel: "writing", icon: "✍️", label: "Write" },
  { panel: "projects", icon: "🗂️", label: "Proj" },
  { panel: "snippets", icon: "⌨️", label: "Snips" },
  { panel: "finance", icon: "💰", label: "Money" },
  { panel: "music", icon: "🎵", label: "Music" },
  { panel: "pomodoro", icon: "⏲️", label: "Focus" },
  { panel: "games", icon: "🎮", label: "Games" },
  { panel: "profile", icon: "👤", label: "Me" },
];

export default function Sidebar({
  active,
  onChange,
  onSignOut,
  userName,
  avatarUrl,
}: Props) {
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
            {panel === "profile" ? (
              avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className={`w-7 h-7 rounded-full object-cover transition-all ring-2 ${
                    active === "profile" ? "ring-[#f97316]" : "ring-transparent"
                  }`}
                />
              ) : (
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    active === "profile"
                      ? "bg-[#f97316] text-white"
                      : "bg-[#2a2520] text-[#c8b89a]"
                  }`}
                >
                  {initials}
                </div>
              )
            ) : (
              <span className="text-lg leading-none">{icon}</span>
            )}
            <span className="text-[6.5px] font-bold uppercase tracking-[1.2px] font-mono">
              {label}
            </span>
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={onSignOut}
          title="Sign out"
          className="w-11.5 h-11.5 rounded-[14px] flex items-center justify-center bg-transparent text-[#4a4038] hover:bg-[rgba(239,68,68,0.12)] hover:text-red-500 transition-all duration-200 text-lg"
        >
          ↩
        </button>
      </div>

      {/* ── MOBILE: scrollable bottom tab bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#111010] border-t border-[#2a2520] z-50">
        <div
          className="flex items-center overflow-x-auto px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {NAV_ITEMS.map(({ panel, icon, label }) => (
            <button
              key={panel}
              onClick={() => onChange(panel)}
              className={`
                shrink-0 w-16 flex flex-col items-center justify-center py-2.5 gap-0.5
                transition-all duration-200
                ${active === panel ? "text-[#f97316]" : "text-[#4a4038]"}
              `}
            >
              {panel === "profile" ? (
                avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className={`w-7 h-7 rounded-full object-cover transition-all ring-2 ${
                      active === "profile"
                        ? "ring-[#f97316]"
                        : "ring-transparent"
                    }`}
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      active === "profile"
                        ? "bg-[#f97316] text-white"
                        : "bg-[#2a2520] text-[#c8b89a]"
                    }`}
                  >
                    {initials}
                  </div>
                )
              ) : (
                <span className="text-lg leading-none">{icon}</span>
              )}
              <span className="text-[8px] font-bold uppercase tracking-wide font-mono">
                {label}
              </span>
            </button>
          ))}

          <button
            onClick={onSignOut}
            className="shrink-0 w-14 flex flex-col items-center justify-center py-2.5 text-[#4a4038] hover:text-red-500 transition-all"
          >
            <span className="text-xl">↩</span>
            <span className="text-[8px] font-bold uppercase tracking-wide font-mono">
              Out
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
