"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

/* ── Promise-based confirm, drop-in for window.confirm ──
   Call `await confirmDialog({...})` from anywhere; `<ConfirmHost />`
   (mounted once in the dashboard) renders the actual modal.
   Single dialog system app-wide — never mix with window.confirm. */

export type ConfirmOptions = {
  title: string;
  /** Plain-language consequence. Say what is lost, not "are you sure". */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for anything that destroys data. Default true. */
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let listener: ((p: Pending) => void) | null = null;

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  // No host mounted (SSR, or a surface that forgot <ConfirmHost />):
  // fall back rather than silently swallowing the action.
  if (!listener) {
    if (typeof window === "undefined") return Promise.resolve(false);
    return Promise.resolve(window.confirm(opts.message ?? opts.title));
  }
  return new Promise((resolve) => listener!({ ...opts, resolve }));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    listener = (p) => setPending(p);
    return () => {
      listener = null;
    };
  }, []);

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  /* Focus: move it in, keep it in, give it back (UI/UX §7e.6).
     Focus lands on Cancel, never on the destructive button — §7e.4 forbids
     making destruction the default, and a dialog that opens focused on
     "Delete" turns a reflexive Enter into a deleted note. Enter deliberately
     does NOT confirm for the same reason; the user has to reach the button.
     Escape still cancels, because leaving must always be free (§1.3). */
  useEffect(() => {
    if (!pending) return;
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close(false);
        return;
      }
      if (e.key !== "Tab") return;
      // Trap: a modal that leaks focus to the page behind it is invisible to a
      // keyboard user, who then tabs through controls they cannot see.
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Return focus to whatever opened the dialog, so the user resumes where
      // they were instead of at the top of the document.
      opener?.focus?.();
    };
  }, [pending, close]);

  if (!pending) return null;

  const destructive = pending.destructive !== false;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: "rgba(17,16,16,0.45)", backdropFilter: "blur(3px)" }}
      onClick={() => close(false)}
      role="presentation"
    >
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={pending.message ? "confirm-message" : undefined}
        className="bg-white desk-card w-full max-w-sm rounded-3xl border border-[#e8e2d8] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: destructive
                ? "rgba(220,38,38,0.10)"
                : "rgba(var(--accent-rgb),0.12)",
              color: destructive ? "#dc2626" : "var(--accent)",
            }}
          >
            <AlertTriangle size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2
              id="confirm-title"
              className="font-serif italic text-lg text-[#111010] leading-snug"
            >
              {pending.title}
            </h2>
            {pending.message && (
              <p
                id="confirm-message"
                className="text-sm text-[#6f6455] mt-1 leading-relaxed"
              >
                {pending.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button
            ref={cancelRef}
            onClick={() => close(false)}
            className="px-4 py-2 rounded-full text-sm font-medium text-[#6f6455] border border-[#e8e2d8] hover:bg-[#f3f0ea] transition-colors"
          >
            {pending.cancelLabel ?? "Keep it"}
          </button>
          <button
            onClick={() => close(true)}
            className="px-4 py-2 rounded-full text-sm font-medium text-white transition-colors"
            style={{ background: destructive ? "#dc2626" : "var(--accent)" }}
          >
            {pending.confirmLabel ?? "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
