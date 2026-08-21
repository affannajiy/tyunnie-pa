// app/auth/page.tsx
"use client";

import { MailCheck } from "lucide-react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { enterGuest } from "@/lib/guest";
import { APP_VERSION } from "@/lib/version";
import { useAccentColor } from "@/lib/useAccentColor";

/* Supabase's raw messages state what broke but never what to do about it.
   Translate the ones users actually hit; anything unknown falls through with
   a next step appended rather than being swallowed. */
function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match. Check the password, or reset it below.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "This email already has an account. Try logging in instead.";
  if (m.includes("email not confirmed"))
    return "Check your inbox — there's a confirmation link waiting for you.";
  if (m.includes("password should be at least"))
    return "Passwords need to be at least 6 characters.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "That email address doesn't look right — check for a typo.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many tries just now. Give it a minute, then go again.";
  if (m.includes("fetch") || m.includes("network"))
    return "Couldn't reach the server. Check your connection and try again.";
  return `${raw} — try again in a moment.`;
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  // Live accent from --accent-rgb (a real "r, g, b" triple).
  // This used to read localStorage["tyunnie_accent"], which stores a HEX —
  // producing rgba(#f97316,0.18), invalid CSS, so every glow below rendered
  // nothing for any user who had ever saved an accent.
  const accentRgb = useAccentColor();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(friendlyAuthError(error.message));
      } else {
        setSignupSuccess(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(friendlyAuthError(error.message));
      } else {
        router.push("/dashboard");
      }
    }

    setLoading(false);
  }

  // Guest preview — set the flag, then let the dashboard treat GUEST_ID as a
  // logged-in user. No Supabase session is created; nothing is saved to an account.
  function handleGuest() {
    enterGuest();
    router.push("/dashboard");
  }

  async function handleGoogleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) setError(friendlyAuthError(error.message));
  }

  const accent = `rgb(${accentRgb})`;
  const accentLight = `rgba(${accentRgb}, 0.12)`;
  const accentMid = `rgba(${accentRgb}, 0.25)`;

  if (signupSuccess) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 bg-[#faf8f5] dark:bg-[#0e0d0b]">
        <div className="bg-white dark:bg-[#1a1815] border border-[#e8e2d8] dark:border-[#2a2620] rounded-2xl p-10 w-full max-w-md text-center shadow-xl">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-5"
            style={{ background: accentLight, border: `1.5px solid ${accentMid}` }}
          >
            <MailCheck size={26} strokeWidth={1.5} style={{ color: accent }} />
          </div>
          <h2 className="font-serif italic text-2xl text-[#111010] dark:text-[#f5f0e8] mb-2">
            Check your email
          </h2>
          <p
            className="text-[10px] font-bold uppercase tracking-[3px] font-mono mb-5"
            style={{ color: accent }}
          >
            Almost there
          </p>
          <div className="bg-[#faf8f5] dark:bg-[#111010] border border-[#e8e2d8] dark:border-[#2a2620] rounded-xl px-5 py-4 mb-6 text-left">
            <p className="text-sm text-[#6f6455] dark:text-[#7a7060] leading-relaxed">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-[#111010] dark:text-[#f5f0e8]">{email}</span>.
              Click it to activate your account, then come back and log in.
            </p>
          </div>
          <p className="text-[10px] font-mono text-[#756a5a] dark:text-[#9c8f80] mb-6 leading-relaxed">
            Didn't receive it? Check your spam folder. The link expires in 24 hours.
          </p>
          <button
            onClick={() => { setMode("login"); setSignupSuccess(false); }}
            className="w-full py-3 rounded-xl text-white font-bold text-sm uppercase tracking-widest transition-all"
            style={{ background: accent }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-dvh flex bg-[#faf8f5] dark:bg-[#0e0d0b]">

      {/* Version badge — links to the About page / changelog */}
      <Link
        href="/about"
        className="fixed top-3 right-4 z-50 text-[10px] font-mono text-[#756a5a] dark:text-[#9c8f80] hover:opacity-70 transition-opacity"
      >
        v{APP_VERSION}
      </Link>

      {/* ── LEFT PANEL — branding ── */}
      <div
        className="hidden lg:flex flex-col justify-start w-[420px] shrink-0 relative overflow-hidden p-10"
        style={{ background: `linear-gradient(160deg, rgba(${accentRgb},0.08) 0%, rgba(${accentRgb},0.18) 100%)` }}
      >
        {/* Background bubbles */}
        <div className="absolute inset-0 pointer-events-none">
          {[
            { w: 320, h: 320, top: "-80px", left: "-80px", delay: "0s" },
            { w: 220, h: 220, top: "38%",   left: "55%",   delay: "1.5s" },
            { w: 160, h: 160, top: "72%",   left: "-30px", delay: "2.8s" },
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

        {/* Top — logo + taglines */}
        <div className="relative z-10">
          <span
            className="text-3xl font-bold tracking-tight"
            style={{ color: accent }}
          >
            Tyunnie
          </span>
          <p className="text-[#6f6455] dark:text-[#7a7060] text-sm mt-1">
            Your personal AI assistant
          </p>
          <div className="mt-4 space-y-1.5">
            {["Tasks, drafts, finances — all in one place.",
              "Your goals. Your pace. Your assistant."].map((line, i) => (
              <p key={i} className="text-sm text-[#6b6358] dark:text-[#7a7060] leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Bottom — sprite pinned to bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-40"
              style={{ background: `radial-gradient(circle, rgba(${accentRgb},0.5) 0%, transparent 70%)` }}
            />
            <Image
              src="/sprites/tyun-mood-happy.png"
              alt="Tyunnie"
              width={360}
              height={460}
              priority
              style={{ width: "260px", height: "auto", position: "relative", zIndex: 1, display: "block" }}
            />
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <span className="text-3xl font-bold" style={{ color: accent }}>Tyunnie</span>
          <p className="text-[#6f6455] text-sm mt-1">Your personal AI assistant</p>
        </div>

        <div className="w-full max-w-sm">

          {/* Heading */}
          <h1 className="text-2xl font-serif italic text-[#111010] dark:text-[#f5f0e8] mb-1">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-sm text-[#6f6455] dark:text-[#6a6050] mb-8">
            {mode === "login"
              ? "Sign in to continue to your dashboard."
              : "Set up your Tyunnie account in seconds."}
          </p>

          {/* Google button — first/prominent */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#1a1815] border border-[#e8e2d8] dark:border-[#2a2620] rounded-xl py-3 text-sm font-semibold text-[#111010] dark:text-[#f5f0e8] hover:bg-[#faf8f5] dark:hover:bg-[#211e1a] transition-all mb-4"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#e8e2d8] dark:bg-[#2a2620]" />
            <span className="text-[10px] font-mono text-[#756a5a] dark:text-[#9c8f80] uppercase tracking-widest">
              or
            </span>
            <div className="flex-1 h-px bg-[#e8e2d8] dark:bg-[#2a2620]" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#6f6455] dark:text-[#6a6050] mb-1.5">
                Email
              </label>
              <input aria-label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-[#faf8f5] dark:bg-[#111010] border border-[#e8e2d8] dark:border-[#2a2620] rounded-xl px-4 py-3 text-sm text-[#111010] dark:text-[#f5f0e8] placeholder:text-[#756a5a] dark:placeholder:text-[#8f8272] outline-none transition-all"
                style={{ boxShadow: "none" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = "")}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#6f6455] dark:text-[#6a6050] mb-1.5">
                Password
              </label>
              <input aria-label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-[#faf8f5] dark:bg-[#111010] border border-[#e8e2d8] dark:border-[#2a2620] rounded-xl px-4 py-3 text-sm text-[#111010] dark:text-[#f5f0e8] placeholder:text-[#756a5a] dark:placeholder:text-[#8f8272] outline-none transition-all"
                onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = "")}
              />
            </div>

            {error && (
              <p className="text-red-600 text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{ background: accent }}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-[#6f6455] dark:text-[#6a6050] mt-6">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              className="font-semibold hover:underline"
              style={{ color: accent }}
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>

          {/* Guest preview — explore without an account */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#e8e2d8] dark:bg-[#2a2620]" />
            <span className="text-[10px] font-mono text-[#756a5a] dark:text-[#9c8f80] uppercase tracking-widest">
              just looking?
            </span>
            <div className="flex-1 h-px bg-[#e8e2d8] dark:bg-[#2a2620]" />
          </div>
          <button
            type="button"
            onClick={handleGuest}
            className="w-full flex items-center justify-center gap-2 bg-transparent border border-dashed rounded-xl py-3 text-sm font-semibold transition-all hover:bg-[#faf8f5] dark:hover:bg-[#1a1815]"
            style={{ borderColor: accentMid, color: accent }}
          >
            <span aria-hidden="true">🧡</span>
            Explore as a guest
          </button>
          <p className="text-center text-[11px] text-[#756a5a] dark:text-[#9c8f80] mt-2">
            Sample data, no sign-up. Nothing is saved to an account.
          </p>

        </div>
      </div>
    </main>
  );
}
