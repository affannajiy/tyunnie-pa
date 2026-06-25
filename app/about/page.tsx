"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { APP_VERSION } from "@/lib/version";
import { hasHighlights, type ChangelogEntry } from "@/lib/changelog";

export default function AboutPage() {
  const [accentRgb, setAccentRgb] = useState("249,115,22");
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tyunnie_accent");
    if (saved) setAccentRgb(saved);
  }, []);

  useEffect(() => {
    fetch("/api/changelog", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  const accent = `rgb(${accentRgb})`;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#faf8f5] dark:bg-[#0e0d0b] text-[#111010] dark:text-[#f5f0e8]">
      <div className="max-w-2xl mx-auto px-6 pt-6 pb-14">
        {/* ── Back link ── */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-[#9a8f7e] dark:text-[#6a6050] hover:opacity-70 transition-opacity mb-6"
        >
          ← Back to app
        </Link>

        {/* ── Hero / story ── */}
        <div className="flex items-start gap-4 mb-3">
          <Image
            src="/sprites/tyun-mood-happy.png"
            alt="Tyunnie"
            width={360}
            height={460}
            priority
            style={{ width: "72px", height: "auto" }}
          />
          <div className="pt-1">
            <span className="text-3xl font-bold tracking-tight" style={{ color: accent }}>
              Tyunnie
            </span>
            <p className="text-sm text-[#9a8f7e] dark:text-[#7a7060] mt-0.5">
              A planner, with Taehyun at your side.
            </p>
          </div>
        </div>

        <div className="space-y-4 text-[15px] leading-relaxed text-[#4a4339] dark:text-[#bcb3a4] mt-6">
          <p>
            I started to do this project becuase I was. So, I decided to do a planner app to keep my notes,
            log my finances, and also to add like a personal music player. But I wanted to put Taehyun in 
            my planner too.
          </p>
          <p>
            So I built my own, and I gave it{" "}
            <span className="font-semibold text-[#111010] dark:text-[#f5f0e8]">Taehyun</span> — calm,
            a little dry, quietly in your corner. Now getting things done feels like having a
            friend sat next to you instead of a checklist staring back. That's the whole idea.
          </p>
          <p className="text-sm text-[#9a8f7e] dark:text-[#7a7060]">
            Tyunnie is a fan-made tribute and isn't affiliated with TOMORROW X TOGETHER or HYBE.
          </p>
        </div>

        {/* ── Changelog ── */}
        <div className="mt-14">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-lg font-serif italic">What's changed</h2>
            <span className="text-[11px] font-mono text-[#c5bdb0] dark:text-[#4a4540]">
              v{APP_VERSION}
            </span>
          </div>

          {entries === null && (
            <p className="text-sm text-[#9a8f7e] dark:text-[#6a6050]">Loading history…</p>
          )}
          {entries?.filter(hasHighlights).length === 0 && (
            <p className="text-sm text-[#9a8f7e] dark:text-[#6a6050]">No notes yet.</p>
          )}

          <div className="space-y-9">
            {entries?.filter(hasHighlights).map((e) => (
              <div key={e.version} className="relative pl-5">
                <span
                  className="absolute left-0 top-1.5 w-2 h-2 rounded-full"
                  style={{ background: accent }}
                />
                <div className="flex items-baseline gap-2.5">
                  <span className="font-bold text-sm" style={{ color: accent }}>
                    {e.version}
                  </span>
                  <span className="text-[11px] font-mono text-[#c5bdb0] dark:text-[#4a4540]">
                    {e.date}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {e.highlights
                    .filter((g) => g.items.length > 0)
                    .map((g, gi) => (
                      <div key={gi}>
                        <p className="text-[10px] font-bold uppercase tracking-[2px] text-[#9a8f7e] dark:text-[#6a6050] mb-1.5">
                          {g.label}
                        </p>
                        <ul className="space-y-1.5">
                          {g.items.map((it, ii) => (
                            <li key={ii} className="text-[13px] leading-relaxed flex gap-2">
                              <span style={{ color: accent }}>·</span>
                              <span>
                                <span className="font-semibold text-[#111010] dark:text-[#f5f0e8]">
                                  {it.headline}
                                </span>
                                {it.body && (
                                  <span className="text-[#6b6358] dark:text-[#9a9080]">
                                    {" "}— {it.body}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] font-mono text-[#c5bdb0] dark:text-[#4a4540] mt-16">
          Tyunnie × Taehyun · v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
