// app/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#111010] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(249,115,22,0.06) 0%, transparent 60%)",
        }}
      />

      {/* Sprite */}
      <div className="relative mb-8 z-10">
        <Image
          src="/sprite.png"
          alt="Tyunnie"
          width={160}
          height={192}
          className="object-contain object-top opacity-60"
          style={{ filter: "drop-shadow(0 -8px 30px rgba(249,115,22,0.15))" }}
        />
      </div>

      <div className="text-center z-10 px-6">
        <div className="font-mono text-red-400 text-xs uppercase tracking-[4px] mb-3 opacity-70">
          Something went wrong
        </div>
        <h1 className="font-serif italic text-5xl text-white mb-4">
          My bad 😔
        </h1>
        <p className="text-[#9a8f7e] text-sm font-mono leading-relaxed max-w-xs mx-auto mb-3">
          Something broke on my end. Try again — I will do better this time 🧡
        </p>

        {/* Error message — only in dev */}
        {process.env.NODE_ENV === "development" && (
          <div className="bg-[#1a1410] border border-[#3a3028] rounded-xl px-4 py-3 mb-6 max-w-sm mx-auto text-left">
            <p className="text-[10px] font-mono text-red-400 wrap-break-word">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#f97316] text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-[#c2500f] transition-all hover:-translate-y-px"
          >
            Try Again
          </button>
          <Link
            href="/chat"
            className="px-6 py-3 bg-transparent border border-[#2a2520] text-[#9a8f7e] font-bold rounded-xl text-xs uppercase tracking-widest hover:border-[#f97316] hover:text-[#f97316] transition-all hover:-translate-y-px"
          >
            Go Home
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 font-serif italic text-[#2a2520] text-lg z-10">
        Tyunnie
      </div>
    </div>
  );
}
