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


/* ── Contrast-safe accent derivatives ──
   UI/UX Rulebook §8: "a brand colour fails contrast / consistency wants the
   palette everywhere → contrast wins on text and controls." The raw accent is
   the brand; it is fine on a fill, a border, a glow. As *text* it was 2.8:1 on
   white at the default orange — under WCAG 1.4.3's 4.5:1 — and the accent is
   user-selectable, so no single darker hex fixes it. These derive one.

   --accent-text      accent walked darker until it clears 4.5:1 on white
   --accent-text-dark accent walked lighter until it clears 4.5:1 on #111010
   --accent-on        foreground for text sitting ON an accent fill: white or
                      near-black, whichever wins. White-on-orange was 2.8:1. */

function relLum(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Walk the accent's HSL lightness toward `step` until it clears `target`
 * against `bg`. Hue and saturation are untouched, so the result still reads as
 * the user's colour rather than a different one.
 */
export function accentOn(hex: string, bg: string, step: number, target = 4.5): string {
  const { h, s, l } = hexToHsl(hex);
  let out = hex;
  for (let i = 0; i <= 100; i++) {
    const li = Math.max(0, Math.min(100, l + step * i));
    out = hslToHex(h, s, li);
    if (contrast(out, bg) >= target) return out;
    if (li === 0 || li === 100) break;
  }
  return out;
}

/** Black or white, whichever is readable on an accent-filled surface. */
export function accentForeground(hex: string): string {
  return contrast(hex, "#ffffff") >= contrast(hex, "#16120c") ? "#ffffff" : "#16120c";
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
  root.style.setProperty("--accent-text", accentOn(hex, "#ffffff", -2));
  root.style.setProperty("--accent-text-dark", accentOn(hex, "#111010", 2));
  root.style.setProperty("--accent-on", accentForeground(hex));
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
