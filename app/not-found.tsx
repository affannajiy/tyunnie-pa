// app/not-found.tsx
import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#111010] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(var(--accent-rgb),0.08) 0%, transparent 60%)",
        }}
      />

      {/* Sprite */}
      <div className="relative mb-8 z-10">
        <Image
          src="/sprites/tyun-mood-default.png"
          alt="Tyunnie"
          width={160}
          height={192}
          className="object-contain object-top opacity-80"
          style={{ filter: "drop-shadow(0 -8px 30px rgba(var(--accent-rgb),0.25))" }}
        />
      </div>

      {/* Text */}
      <div className="text-center z-10 px-6">
        <div className="font-mono text-[#f97316] text-xs uppercase tracking-[4px] mb-3 opacity-70">
          Error 404
        </div>
        <h1 className="font-serif italic text-5xl text-white mb-4">Lost?</h1>
        <p className="text-[#9a8f7e] text-sm font-mono leading-relaxed max-w-xs mx-auto mb-8">
          This page does not exist. Even I could not find it — and I know
          everything 🧡
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/desk"
            className="px-6 py-3 bg-[#f97316] text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-[#c2500f] transition-all hover:-translate-y-px"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-transparent border border-[#2a2520] text-[#9a8f7e] font-bold rounded-xl text-xs uppercase tracking-widest hover:border-[#f97316] hover:text-[#f97316] transition-all hover:-translate-y-px"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Bottom text */}
      <div className="absolute bottom-8 font-serif italic text-[#2a2520] text-lg z-10">
        Tyunnie
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
