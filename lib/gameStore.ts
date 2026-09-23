// lib/gameStore.ts
// Namespaced localStorage for the games: per-game stats and bankroll, plus
// one shared settings blob (sound, speed). Fictional chips only — nothing here
// touches the DB or the Finance panel, for guests and signed-in users alike.
//
// Every read is try/caught and schema-checked against a default: a corrupt
// blob in a mount effect trips the error boundary (CLAUDE.md), and a blob
// from an older version must never crash a newer reader.

"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "tyunnie_games_";

export type GameSpeed = "normal" | "fast";
export type GameSettings = {
  sound: boolean;
  speed: GameSpeed;
};
export const DEFAULT_SETTINGS: GameSettings = { sound: false, speed: "normal" };

export function readStore<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    // Only keys the default knows about, only when the type matches — a
    // renamed field falls back rather than leaking `undefined` into the UI.
    const out = { ...fallback } as Record<string, unknown>;
    for (const k of Object.keys(fallback)) {
      const v = (parsed as Record<string, unknown>)[k];
      if (v !== undefined && typeof v === typeof (fallback as Record<string, unknown>)[k]) out[k] = v;
    }
    return out as T;
  } catch {
    return fallback;
  }
}

export function writeStore<T extends object>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

export function clearStore(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

const SETTINGS_EVENT = "tyunnie-game-settings";

/**
 * Shared game settings. Every mounted game sees the same values: a change in
 * one panel's drawer broadcasts to the others through a window event.
 * Reduced-motion forces `speed: "fast"` at the read site, never in storage,
 * so the stored preference survives the OS setting changing back.
 */
export function useGameSettings(): [GameSettings, (patch: Partial<GameSettings>) => void] {
  const [s, setS] = useState<GameSettings>(() => readStore("settings", DEFAULT_SETTINGS));
  useEffect(() => {
    const on = () => setS(readStore("settings", DEFAULT_SETTINGS));
    window.addEventListener(SETTINGS_EVENT, on);
    return () => window.removeEventListener(SETTINGS_EVENT, on);
  }, []);
  const update = useCallback((patch: Partial<GameSettings>) => {
    const next = { ...readStore("settings", DEFAULT_SETTINGS), ...patch };
    writeStore("settings", next);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);
  return [s, update];
}

/** rAF and timer code must check this explicitly — CSS media queries don't reach a setTimeout. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Effective delay: halves for Fast, and reduced-motion forces Fast. */
export function scaleDelay(ms: number, settings: GameSettings): number {
  const fast = settings.speed === "fast" || prefersReducedMotion();
  return fast ? Math.round(ms / 2) : ms;
}
