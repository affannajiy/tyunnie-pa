// components/Sidebar.tsx
'use client'

export type Panel = 'calendar' | 'todo' | 'writing' | 'projects' | 'snippets' | 'finance'

type Props = {
  active: Panel
  onChange: (panel: Panel) => void
  onSignOut: () => void
}

const NAV_ITEMS: { panel: Panel; icon: string; label: string }[] = [
  { panel: 'calendar', icon: '📅', label: 'Cal'   },
  { panel: 'todo',     icon: '✅', label: 'Tasks' },
  { panel: 'writing',  icon: '✍️', label: 'Write' },
  { panel: 'projects', icon: '🗂️', label: 'Proj'  },
  { panel: 'snippets', icon: '⌨️', label: 'Snips' },
  { panel: 'finance',  icon: '💰', label: 'Money' },
]

export default function Sidebar({ active, onChange, onSignOut }: Props) {
  return (
    <div className="w-[68px] bg-[#111010] flex flex-col items-center py-5 gap-1 flex-shrink-0">

      {/* Logo */}
      <div
        className="text-[#f97316] font-serif italic text-[11px] tracking-[3px] mb-6"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        TYUNNIE
      </div>

      {/* Nav buttons */}
      {NAV_ITEMS.map(({ panel, icon, label }) => (
        <button
          key={panel}
          onClick={() => onChange(panel)}
          title={panel.charAt(0).toUpperCase() + panel.slice(1)}
          className={`
            w-[46px] h-[50px] rounded-[14px] flex flex-col items-center justify-center gap-[3px]
            transition-all duration-200 border-none cursor-pointer
            ${active === panel
              ? 'bg-[rgba(249,115,22,0.18)] text-[#f97316]'
              : 'bg-transparent text-[#4a4038] hover:bg-[rgba(249,115,22,0.12)] hover:text-[#f97316]'
            }
          `}
        >
          <span className="text-lg leading-none">{icon}</span>
          <span className="text-[6.5px] font-bold uppercase tracking-[1.2px] font-mono">
            {label}
          </span>
        </button>
      ))}

      {/* Push sign out to bottom */}
      <div className="flex-1" />

      {/* Sign out */}
      <button
        onClick={onSignOut}
        title="Sign out"
        className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center bg-transparent text-[#4a4038] hover:bg-[rgba(239,68,68,0.12)] hover:text-red-500 transition-all duration-200 text-lg"
      >
        ↩
      </button>

    </div>
  )
}