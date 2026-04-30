// app/error.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [accentRgb, setAccentRgb] = useState("249,115,22");

  useEffect(() => {
    const saved = localStorage.getItem("tyunnie_accent");
    if (saved) setAccentRgb(saved);
  }, []);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const accent = `rgb(${accentRgb})`;

  return (
    <div className="min-h-screen flex bg-[#faf8f5] dark:bg-[#0e0d0b]">

      {/* Left panel — branding + sprite */}
      <div
        className="hidden lg:flex flex-col w-100 shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, rgba(${accentRgb},0.06) 0%, rgba(${accentRgb},0.16) 100%)` }}
      >
        <div className="absolute inset-0 pointer-events-none">
          {[
            { w: 300, h: 300, top: "-60px", left: "-60px", delay: "0s" },
            { w: 200, h: 200, top: "40%",   left: "50%",   delay: "1.8s" },
            { w: 140, h: 140, top: "70%",   left: "-20px", delay: "3s" },
          ].map((b, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                width: b.w,
                height: b.h,
                top: b.top,
                left: b.left,
                background: `radial-gradient(circle, rgba(${accentRgb},0.18) 0%, transparent 70%)`,
                animationDelay: b.delay,
                animationDuration: "4s",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 p-10">
          <span className="text-2xl font-bold tracking-tight" style={{ color: accent }}>
            Tyunnie
          </span>
          <p className="text-[#9a8f7e] dark:text-[#7a7060] text-sm mt-1">
            Your personal AI assistant
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-30"
              style={{ background: `radial-gradient(circle, rgba(${accentRgb},0.5) 0%, transparent 70%)` }}
            />
            <Image
              src="/sprites/tyun-mood-default.png"
              alt="Tyunnie"
              width={360}
              height={460}
              style={{ width: "240px", height: "auto", position: "relative", zIndex: 1, display: "block", opacity: 0.85 }}
            />
          </div>
        </div>
      </div>

      {/* Right panel — error card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        <div className="lg:hidden mb-8 text-center">
          <span className="text-3xl font-bold" style={{ color: accent }}>Tyunnie</span>
          <p className="text-[#9a8f7e] text-sm mt-1">Your personal AI assistant</p>
        </div>

        <div className="w-full max-w-sm">

          {/* Mobile sprite */}
          <div className="lg:hidden flex justify-center mb-6">
            <Image
              src="/sprites/tyun-mood-default.png"
              alt="Tyunnie"
              width={360}
              height={460}
              style={{ width: "110px", height: "auto", opacity: 0.7 }}
            />
          </div>

          <div className="bg-white dark:bg-[#1a1815] border border-[#e8e2d8] dark:border-[#2a2620] rounded-2xl p-8 shadow-xl">
            <p
              className="text-[10px] font-bold uppercase tracking-[3px] font-mono mb-2"
              style={{ color: accent }}
            >
              Something went wrong
            </p>
            <h1 className="font-serif italic text-3xl text-[#111010] dark:text-[#f5f0e8] mb-3">
              My bad.
            </h1>
            <p className="text-sm text-[#9a8f7e] dark:text-[#6a6050] leading-relaxed mb-6">
              Something broke on my end. Try again — I will do better this time.
            </p>

            {process.env.NODE_ENV === "development" && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl px-4 py-3 mb-5">
                <p className="text-[10px] font-mono text-red-500 dark:text-red-400 wrap-break-word">
                  {error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-widest transition-all hover:opacity-90 hover:-translate-y-px"
                style={{ background: accent }}
              >
                Try Again
              </button>
              <Link
                href="/dashboard"
                className="flex-1 py-3 text-center bg-transparent border border-[#e8e2d8] dark:border-[#2a2620] text-[#9a8f7e] dark:text-[#6a6050] font-bold rounded-xl text-xs uppercase tracking-widest hover:border-[#9a8f7e] dark:hover:border-[#6a6050] transition-all hover:-translate-y-px"
              >
                Go Home
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
