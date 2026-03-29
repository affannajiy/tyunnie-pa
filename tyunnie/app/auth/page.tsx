// app/auth/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setSignupSuccess(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/chat");
      }
    }

    setLoading(false);
  }

  async function handleGoogleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) setError(error.message);
  }

  // Show this after signup — Supabase sends a confirmation email by default
  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-10 w-full max-w-md text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="font-bold text-xl mb-2">Check your email</h2>
          <p className="text-[#9a8f7e] text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account, then come back and log in.
          </p>
          <button
            onClick={() => {
              setMode("login");
              setSignupSuccess(false);
            }}
            className="mt-6 text-[#f97316] text-sm font-semibold hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-10 w-full max-w-md">
        {/* Header */}
        <h1 className="font-bold text-3xl text-[#f97316] mb-1">Tyunnie</h1>
        <p className="text-[#9a8f7e] text-sm mb-8">
          {mode === "login" ? "Welcome back 🧡" : "Create your account"}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#9a8f7e] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#9a8f7e] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
              className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#f97316] text-white font-bold rounded-xl py-3 text-sm hover:bg-[#c2500f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-[#e8e2d8]" />
          <span className="text-[10px] font-mono text-[#c5bdb0] uppercase tracking-widest">
            or
          </span>
          <div className="flex-1 h-px bg-[#e8e2d8]" />
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white border border-[#e8e2d8] rounded-xl py-3 text-sm font-semibold text-[#111010] hover:border-[#f97316] hover:bg-[#fff0e6] transition-all"
        >
          {/* Google SVG icon */}
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
          Continue with Google
        </button>

        {/* Toggle login/signup */}
        <p className="text-center text-sm text-[#9a8f7e] mt-6">
          {mode === "login"
            ? "Don't have an account? "
            : "Already have an account? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="text-[#f97316] font-semibold hover:underline"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
