"use client";

import { useEffect, useState, useCallback } from "react";
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

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
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
              <p className="text-sm text-[#9a8f7e] mt-1 leading-relaxed">
                {pending.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 rounded-full text-sm font-medium text-[#9a8f7e] border border-[#e8e2d8] hover:bg-[#f3f0ea] transition-colors"
          >
            {pending.cancelLabel ?? "Keep it"}
          </button>
          <button
            autoFocus
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
