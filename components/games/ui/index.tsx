// components/games/ui/index.tsx
// The small shared kit all eight games are built from: a felt table surface,
// a portalled sheet for rules / stats / settings, a switch, a segmented
// control, stat rows, the sound + speed settings body, header buttons and the
// keyboard guard. No layout lives here — each game owns its own.
"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Volume2, VolumeX, Gauge } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useGameSettings, type GameSpeed } from "@/lib/gameStore";
import { setAudioEnabled } from "@/lib/gameAudio";

// ── Keyboard guard ─────────────────────────────────────────────────────────
// Every game listens on window, so its keydown must stand down when the key
// belongs to something else: a text field, any open modal (the confirm dialog,
// a sheet, the promotion picker), or Enter/Space on a focused button — that
// press activates the button, it must not also play a move behind a dialog.
// Board cells (`role="gridcell"`) are exempt: a mouse click leaves one focused,
// and the game's own Enter/Space must still act on the keyboard cursor.
// Tetris passes `buttons: false`: Space is hard drop, and its only buttons
// are ones the player just clicked.
export function ignoreGameKey(e: KeyboardEvent, opts?: { buttons?: boolean }): boolean {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return true;
  if (document.querySelector('[role="alertdialog"], [role="dialog"][aria-modal="true"]')) return true;
  if (opts?.buttons !== false && (e.key === "Enter" || e.key === " ") && t?.closest('button:not([role="gridcell"]), a[href], [role="button"]')) return true;
  return false;
}

// ── Table surface ──────────────────────────────────────────────────────────
// Warm dark felt in both themes (`on-dark`): cards and tiles read against it,
// and the rest of the panel stays app cream so the table is an object on the
// page rather than the page itself. The accent tints the vignette so a
// user-picked colour still shows through.
export const FELT =
  "on-dark relative rounded-3xl bg-[#1f1b17] text-[#e8ddd0] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_2px_24px_rgba(0,0,0,0.5)] overflow-hidden";

export function FeltVignette() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-3xl"
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%, rgba(var(--accent-rgb), 0.10), transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.35), transparent 60%)",
      }}
    />
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────
// Portalled to <body>: the panel wrapper keeps a transform from its entrance
// animation, so a `fixed` child would be positioned against the panel and sit
// under the z-50 dock. z-[70] clears the dock (50) and the chat float (60).
export function GameSheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useFocusTrap<HTMLDivElement>(open);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    // A confirm opened from this sheet owns Escape — closing both left focus on <body>.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector('[role="alertdialog"]')) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation">
      <button aria-label="Close" className="absolute inset-0 bg-black/45 no-tap" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[85dvh] flex flex-col bg-white dark:bg-[#1c1917] rounded-t-3xl sm:rounded-3xl border border-[#e8e2d8] dark:border-[#2a2520] shadow-2xl animate-modal-in`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#e8e2d8] dark:border-[#2a2520]">
          <h2 id={titleId} className="font-serif italic text-xl text-[#111010] dark:text-[#e8ddd0]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="tap-target p-1 rounded-lg text-[#6f6455] hover:text-[#111010] dark:hover:text-[#e8ddd0] transition-colors">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ── Controls ───────────────────────────────────────────────────────────────

export function Switch({
  label,
  hint,
  checked,
  onChange,
  icon,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <label htmlFor={id} className="flex items-center gap-2.5 min-w-0 cursor-pointer">
        {icon && <span className="text-[#6f6455] shrink-0">{icon}</span>}
        <span className="min-w-0">
          <span className="block text-sm text-[#111010] dark:text-[#e8ddd0]">{label}</span>
          {hint && <span className="block text-[11px] text-[#6f6455] leading-snug">{hint}</span>}
        </span>
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors no-tap ${checked ? "bg-(--accent)" : "bg-[#e8e2d8] dark:bg-[#3a3530]"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#6f6455] mb-2">{label}</div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 px-1 sm:px-2 py-1.5 rounded-xl border-2 text-[11px] font-bold uppercase sm:tracking-wider break-words transition-colors ${
              value === o.value
                ? "border-(--accent) bg-(--accent) text-(--accent-on)"
                : "border-[#e8e2d8] dark:border-[#3a3530] text-[#111010] dark:text-[#e8ddd0] hover:border-(--accent)"
            }`}
          >
            <span className="block">{o.label}</span>
            {o.hint && <span className={`block font-mono text-[9px] normal-case tracking-normal font-normal mt-0.5 ${value === o.value ? "opacity-80" : "text-[#6f6455]"}`}>{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatRows({ rows }: { rows: { label: string; value: string | number }[] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-[#6f6455]">{r.label}</dt>
          <dd className="font-mono font-bold text-[#111010] dark:text-[#e8ddd0] text-right tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-widest text-[#6f6455] mt-4 mb-2 first:mt-0">{children}</div>;
}

/** Sound + speed, shared by every game. Game-specific rows go in `children`. */
export function GameSettingsBody({ children }: { children?: ReactNode }) {
  const [s, update] = useGameSettings();
  useEffect(() => setAudioEnabled(s.sound), [s.sound]);
  return (
    <div className="divide-y divide-[#e8e2d8] dark:divide-[#2a2520]">
      <Switch
        label="Sound"
        hint="Chip clicks, card and tile sounds. Off by default."
        checked={s.sound}
        onChange={(v) => update({ sound: v })}
        icon={s.sound ? <Volume2 size={16} strokeWidth={1.75} /> : <VolumeX size={16} strokeWidth={1.75} />}
      />
      <div className="flex items-start gap-2.5 pt-1">
        <span className="text-[#6f6455] shrink-0 pt-3"><Gauge size={16} strokeWidth={1.75} /></span>
        <div className="flex-1 min-w-0">
          <Segmented<GameSpeed>
            label="Speed"
            value={s.speed}
            onChange={(v) => update({ speed: v })}
            options={[
              { value: "normal", label: "Normal", hint: "dealt at table pace" },
              { value: "fast", label: "Fast", hint: "half the delays" },
            ]}
          />
          <p className="text-[11px] text-[#6f6455] -mt-1 pb-2">Reduced-motion in your OS forces Fast.</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Small header button — icon + optional label — for the strip above a table. */
export function HeaderButton({
  onClick,
  label,
  icon,
  active,
  showLabel = true,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
  active?: boolean;
  showLabel?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`tap-target inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-colors ${
        active
          ? "border-(--accent) text-(--accent)"
          : "border-[#e8e2d8] dark:border-[#3a3530] text-[#6f6455] hover:text-[#111010] dark:hover:text-[#e8ddd0] hover:border-(--accent)"
      }`}
    >
      {icon}
      {showLabel && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
