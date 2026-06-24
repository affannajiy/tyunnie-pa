"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";
import { hasHighlights, type ChangelogEntry } from "@/lib/changelog";

const SEEN_KEY = "tyunnie_last_seen_version";

// Returns true when `a` is a strictly newer version than `b` (numeric, dot-wise).
function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * One-time "Site Updated" modal. Fires once per deploy: compares the running
 * APP_VERSION against the last version this browser acknowledged. Brand-new
 * visitors (no stored version) are silently marked as caught-up — we don't greet
 * a first-timer with a changelog. Content = the latest entry's bold lead-ins.
 */
export default function UpdateAnnouncement() {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<ChangelogEntry | null>(null);
  const [accentRgb, setAccentRgb] = useState("249,115,22");

  useEffect(() => {
    const saved = localStorage.getItem("tyunnie_accent");
    if (saved) setAccentRgb(saved);

    const seen = localStorage.getItem(SEEN_KEY);
    // First-ever visit: just record the current version, show nothing.
    if (!seen) {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
      return;
    }
    if (!isNewer(APP_VERSION, seen)) return;

    // There's a newer version than last acknowledged — pull the highlights.
    fetch("/api/changelog", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const entries: ChangelogEntry[] = d.entries ?? [];
        const latest = entries.find((e) => e.version === APP_VERSION) ?? entries[0];
        // No user-facing highlights for this release → nothing worth a popup.
        if (!latest || !hasHighlights(latest)) {
          localStorage.setItem(SEEN_KEY, APP_VERSION);
          return;
        }
        setEntry(latest);
        setOpen(true);
      })
      .catch(() => {
        // If we can't load notes, don't nag — just mark caught-up.
        localStorage.setItem(SEEN_KEY, APP_VERSION);
      });
  }, []);

  function dismiss() {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
    setOpen(false);
  }

  if (!open || !entry) return null;

  const accent = `rgb(${accentRgb})`;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="bg-white dark:bg-[#1a1815] border border-[#e8e2d8] dark:border-[#2a2620] rounded-2xl p-7 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[3px] font-mono mb-2"
          style={{ color: accent }}
        >
          Site updated · v{entry.version}
        </p>
        <h2 className="font-serif italic text-2xl mb-1 text-[#111010] dark:text-[#f5f0e8]">
          What's new
        </h2>
        <p className="text-sm text-[#9a8f7e] dark:text-[#7a7060] mb-5">
          A few things changed since you were last here.
        </p>

        <div className="space-y-4 mb-6">
          {entry.highlights
            .filter((g) => g.items.length > 0)
            .map((g, gi) => (
              <div key={gi}>
                <p
                  className="text-[10px] font-bold uppercase tracking-[2px] mb-1.5"
                  style={{ color: accent }}
                >
                  {g.label}
                </p>
                <ul className="space-y-2">
                  {g.items.map((it, ii) => (
                    <li
                      key={ii}
                      className="flex gap-2.5 text-sm text-[#4a4339] dark:text-[#bcb3a4]"
                    >
                      <span style={{ color: accent }}>·</span>
                      <span>
                        <span className="font-semibold text-[#111010] dark:text-[#f5f0e8]">
                          {it.headline}
                        </span>
                        {it.body && <span> — {it.body}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm tracking-wide transition-all"
            style={{ background: accent }}
          >
            Got it
          </button>
          <Link
            href="/about"
            onClick={dismiss}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#9a8f7e] dark:text-[#7a7060] hover:bg-[#faf8f5] dark:hover:bg-[#211e1a] transition-all whitespace-nowrap"
          >
            See all
          </Link>
        </div>
      </div>
    </div>
  );
}
