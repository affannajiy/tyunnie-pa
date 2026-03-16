// app/auth/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSignupSuccess(true)
      }

    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
      }
    }

    setLoading(false)
  }

  // Show this after signup — Supabase sends a confirmation email by default
  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-10 w-full max-w-md text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="font-bold text-xl mb-2">Check your email</h2>
          <p className="text-[#9a8f7e] text-sm">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then come back and log in.
          </p>
          <button
            onClick={() => { setMode('login'); setSignupSuccess(false) }}
            className="mt-6 text-[#f97316] text-sm font-semibold hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-10 w-full max-w-md">

        {/* Header */}
        <h1 className="font-bold text-3xl text-[#f97316] mb-1">Tyunnie</h1>
        <p className="text-[#9a8f7e] text-sm mb-8">
          {mode === 'login' ? 'Welcome back 🧡' : 'Create your account'}
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
              onChange={e => setEmail(e.target.value)}
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
              onChange={e => setPassword(e.target.value)}
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
              ? 'Please wait...'
              : mode === 'login' ? 'Log in' : 'Create account'
            }
          </button>
        </form>

        {/* Toggle login/signup */}
        <p className="text-center text-sm text-[#9a8f7e] mt-6">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
            className="text-[#f97316] font-semibold hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>

      </div>
    </div>
  )
}