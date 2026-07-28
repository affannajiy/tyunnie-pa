// lib/accent.ts
// Single source for applying the accent colour to the document.
//
// Two entry points, deliberately separated:
//   setAccentVars(hex) — CSS custom properties ONLY. Ephemeral, no persistence.
//                        Used by the album-art auto-theme, which changes colour
//                        every track and must never touch storage or the DB.
//   saveAccent(id,hex) — the same vars, plus localStorage + profile row. Used by
//                        the Profile colour picker, where the choice is a real
//                        preference the user expects to survive a reload.
import { upsertProfile } from "@/lib/database";

export const DEFAULT_ACCENT = "#f97316";

/**
 * Read one resolved accent custom property (e.g. "--accent", "--accent-mid").
 *
 * For the contexts CSS vars can't reach: canvas, and libraries like
 * canvas-confetti that take real colour strings. The ACCENT COLOR OVERRIDES
 * block in `globals.css` only remaps Tailwind *classes*, so a literal hex in a
 * JS array or a canvas call is genuinely frozen — this is the escape hatch.
 * Call it at paint time, never cache the result.
 */
export function readAccentVar(name: string): string {
  if (typeof document === "undefined") return DEFAULT_ACCENT;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    DEFAULT_ACCENT
  );
}

/** Read the accent the user actually picked, ignoring any art override in play. */
export function readSavedAccent(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  return localStorage.getItem("tyunnie_accent") ?? DEFAULT_ACCENT;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex(hh: number, ss: number, ll: number): string {
  const sn = ss / 100,
    ln = ll / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + hh / 30) % 12;
    const c = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Paint the accent onto :root. Derives soft/mid/dim variants in HSL so every
 * consumer of --accent-* stays in the same hue family.
 * Does NOT persist — callers that want persistence use saveAccent().
 */
export function setAccentVars(hex: string) {
  if (typeof document === "undefined") return;
  const ri = parseInt(hex.slice(1, 3), 16);
  const gi = parseInt(hex.slice(3, 5), 16);
  const bi = parseInt(hex.slice(5, 7), 16);
  const { h, s, l } = hexToHsl(hex);

  const soft = hslToHex(h, Math.min(s + 10, 100), Math.min(l + 42, 97));
  const mid = hslToHex(h, Math.min(s + 5, 100), Math.min(l + 28, 90));
  const dim = hslToHex(h, Math.min(s + 5, 100), Math.max(l - 18, 15));

  const root = document.documentElement;
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--accent-soft", soft);
  root.style.setProperty("--accent-mid", mid);
  root.style.setProperty("--accent-dim", dim);
  root.style.setProperty("--accent-rgb", `${ri}, ${gi}, ${bi}`);
  // Lets useAccentColor() consumers (music glow, canvases) re-read the vars.
  window.dispatchEvent(new Event("tyunnie-accent-changed"));
}

/** Apply + remember. The user's deliberate colour choice. */
export function saveAccent(userId: string, hex: string) {
  setAccentVars(hex);
  localStorage.setItem("tyunnie_accent", hex);
  // Persist immediately so the choice syncs across devices on next login
  upsertProfile(userId, { accent_color: hex }).catch(() => {});
}
