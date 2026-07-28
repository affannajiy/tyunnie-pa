// lib/useFocusTrap.ts
// ──────────────────────────────────────────────────────────────────────────
//  Modal focus management — usability contract §11 (Accessibility).
//
//  An overlay that doesn't manage focus strands keyboard and screen-reader
//  users: focus stays behind the backdrop, Tab walks the page underneath, and
//  on close it lands back at the top of the document instead of where they
//  were. This hook is the single shared implementation — import it, never
//  hand-roll per-overlay focus logic (contract §4, internal consistency).
//
//  Usage:
//    const ref = useFocusTrap<HTMLDivElement>(open)
//    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="…">
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    // Remember where focus came from so we can hand it back on close.
    const previous = document.activeElement as HTMLElement | null;

    // Move focus into the dialog. Prefer its first real control; fall back to
    // the container itself (made programmatically focusable by the caller via
    // tabIndex={-1}) so the screen reader still announces the dialog.
    const first = node.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node).focus?.();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      // Wrap at both ends so Tab can never escape the overlay.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the trigger — but only if it's still in the document.
      if (previous && document.contains(previous)) previous.focus?.();
    };
  }, [active]);

  return ref;
}
