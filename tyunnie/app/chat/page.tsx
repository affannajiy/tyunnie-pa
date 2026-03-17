// app/chat/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import {
  getEvents,
  getTodos,
  getDrafts,
  getProjects,
  getSnips,
  getFinanceEntries,
  addEvent,
  addTodo,
  type Event,
  type Todo,
  type Draft,
  type Project,
  type Snip,
  type FinanceEntry,
} from '@/lib/database'

type Bubble = {
  id: string
  who: 'tyunnie' | 'user'
  text: string
  time: string
}

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type ConfirmPayload = {
  label: string
  detail: string
  onConfirm: () => void
}

const GREETINGS = [
  "Hey, it's me 🧡 What's on your mind today?",
  "Welcome back. I've been waiting — what do we need to sort out?",
  "Hey you 🧡 Talk to me. What are we working on?",
  "I'm here. What do you need from me today?",
]

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // App data for context
  const [events,   setEvents]   = useState<Event[]>([])
  const [todos,    setTodos]    = useState<Todo[]>([])
  const [drafts,   setDrafts]   = useState<Draft[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [snips,    setSnips]    = useState<Snip[]>([])
  const [finance,  setFinance]  = useState<FinanceEntry[]>([])

  // Chat state
  const [bubbles, setBubbles]   = useState<Bubble[]>(() => [{
    id: Math.random().toString(36).slice(2),
    who: 'tyunnie',
    text: GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    time: new Date().getHours().toString().padStart(2,'0') + ':' + new Date().getMinutes().toString().padStart(2,'0')
  }])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [thinking, setThinking] = useState(false)
  const [confirm, setConfirm]   = useState<ConfirmPayload | null>(null)
  const [spriteGlow, setSpriteGlow] = useState(false)

  const historyRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // ── AUTH + DATA LOAD ──
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/auth'); return }
      setUser(data.user)

      const [ev, td, dr, pr, sn, fi] = await Promise.all([
        getEvents(data.user.id),
        getTodos(data.user.id),
        getDrafts(data.user.id),
        getProjects(data.user.id),
        getSnips(data.user.id),
        getFinanceEntries(data.user.id),
      ])
      setEvents(ev); setTodos(td); setDrafts(dr)
      setProjects(pr); setSnips(sn); setFinance(fi)
      setLoading(false)
    })
  }, [router])

  // Scroll to bottom on new bubbles
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [bubbles, thinking, confirm])

  // ── HELPERS ──
  function timeNow() {
    return new Date().getHours().toString().padStart(2,'0') + ':' + new Date().getMinutes().toString().padStart(2,'0')
  }

  function addBubble(who: 'tyunnie' | 'user', text: string) {
    setBubbles(prev => [...prev, { id: Math.random().toString(36).slice(2), who, text, time: timeNow() }])
    if (who === 'tyunnie') {
      setSpriteGlow(true)
      setTimeout(() => setSpriteGlow(false), 1000)
    }
  }

  // ── SYSTEM PROMPT ──
  function buildSystemPrompt(): string {
    const today = new Date().toISOString().split('T')[0]
    const totalIncome   = finance.filter(f => f.type === 'income').reduce((s,f) => s+f.amount, 0)
    const totalExpenses = finance.filter(f => f.type === 'expense').reduce((s,f) => s+f.amount, 0)

    const upcomingEvents = events
      .filter(e => e.date >= today)
      .sort((a,b) => a.date.localeCompare(b.date))
      .slice(0,10)
      .map(e => `• ${e.date} ${e.time ?? ''}: ${e.title}`)
      .join('\n') || 'None'

    const pendingTodos = todos
      .filter(t => !t.done)
      .map(t => `• [${t.tag}] ${t.text}${t.due ? ` (due ${t.due})` : ''}`)
      .join('\n') || 'None'

    const draftList = drafts
      .map((d,i) => `${i+1}. "${d.title}" — ${(d.body ?? '').trim().split(/\s+/).length} words`)
      .join('\n') || 'None'

    const projectList = projects
      .map(p => `• ${p.name} [${p.status}] ${p.progress}%`)
      .join('\n') || 'None'

    const recentFinance = finance
      .slice(0,5)
      .map(f => `• ${f.type === 'income' ? '+' : '-'}RM${f.amount.toFixed(2)} ${f.description}`)
      .join('\n') || 'None'

    return `You are Tyunnie — a warm, caring AI assistant based on Taehyun from TXT. You speak like a close, supportive friend. The user is a CS student who loves writing and ideas. Keep replies short and personal (1–3 sentences). Be direct, warm, a little cool — like Taehyun.

Today: ${today}

=== APP DATA ===
FINANCE:
  Income:   RM${totalIncome.toFixed(2)}
  Expenses: RM${totalExpenses.toFixed(2)}
  Balance:  RM${(totalIncome - totalExpenses).toFixed(2)}
  Recent: ${recentFinance}

CALENDAR (upcoming): ${upcomingEvents}
TASKS (pending): ${pendingTodos}
DRAFTS: ${draftList}
PROJECTS: ${projectList}

=== ACTIONS ===
Append ONE action block at the very end of your reply when needed:
<action>{"type":"ACTION","data":{...}}</action>

Available actions:
- add_event  → ALWAYS confirm first. data: { "title":"...", "date":"YYYY-MM-DD", "time":"..." }
- add_todo   → data: { "text":"...", "tag":"cs"|"write"|"personal"|"other", "due":"YYYY-MM-DD or empty" }
- navigate   → data: { "panel":"calendar"|"todo"|"writing"|"projects"|"snippets"|"finance" }

Rules:
- For add_event: trigger confirmation, never add silently
- For financial questions: quote the exact balance
- Never mention "action block" or "JSON" to the user
- Put the action block on its own line at the very end`
  }

  // ── ACTION EXECUTOR ──
  function executeAction(raw: string) {
    try {
      const action = JSON.parse(raw)
      switch (action.type) {

        case 'add_event': {
          const d = action.data
          setConfirm({
            label: 'Add to Calendar?',
            detail: `<strong>📅 ${d.title}</strong><br/>Date: <strong>${d.date}</strong><br/>Time: <strong>${d.time || 'Not specified'}</strong>`,
            onConfirm: async () => {
              if (!user) return
              const newEvent = await addEvent(user.id, { title: d.title, date: d.date, time: d.time ?? '' })
              if (newEvent) setEvents(prev => [...prev, newEvent])
              setConfirm(null)
              addBubble('tyunnie', `Done! "${d.title}" is on your calendar 📅`)
            }
          })
          break
        }

        case 'add_todo': {
          const d = action.data
          if (!user) return
          addTodo(user.id, { text: d.text, tag: d.tag ?? 'other', due: d.due || null })
            .then(newTodo => { if (newTodo) setTodos(prev => [newTodo, ...prev]) })
          break
        }

        case 'navigate':
          router.push(`/?panel=${action.data.panel}`)
          break
      }
    } catch {
      // malformed action — ignore
    }
  }

  // ── SEND CHAT ──
  async function sendChat() {
    const msg = input.trim()
    if (!msg || thinking) return

    setInput('')
    addBubble('user', msg)

    const updatedMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(updatedMessages)
    setThinking(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          systemPrompt: buildSystemPrompt()
        })
      })

      const data = await res.json()
      const fullReply: string = data.text ?? "I'm here 🧡"

      const actionMatch  = fullReply.match(/<action>([\s\S]*?)<\/action>/)
      const cleanMessage = fullReply.replace(/<action>[\s\S]*?<\/action>/g, '').trim()

      setThinking(false)
      addBubble('tyunnie', cleanMessage)
      setMessages(prev => [...prev, { role: 'assistant', content: cleanMessage }])

      if (actionMatch) setTimeout(() => executeAction(actionMatch[1]), 300)

    } catch {
      setThinking(false)
      addBubble('tyunnie', "Something went wrong 😔 Try again?")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
  }

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111010] flex items-center justify-center">
        <div className="text-center">
          <div className="font-serif italic text-4xl text-[#f97316] mb-3">Tyunnie</div>
          <div className="text-sm text-[#9a8f7e]">Loading...</div>
        </div>
      </div>
    )
  }

  // ── RENDER ──
  return (
    <div className="min-h-screen bg-[#111010] flex flex-col items-center relative overflow-hidden">

      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(249,115,22,0.08) 0%, transparent 60%)' }}
      />

      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-6 py-4 z-10">
        <div className="font-serif italic text-[#f97316] text-xl tracking-wide">Tyunnie</div>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-bold uppercase tracking-widest font-mono"
        >
          Dashboard →
        </button>
      </div>

      {/* Sprite + name */}
      <div className="flex flex-col items-center pt-4 pb-6 z-10">

        {/* Glowing circle frame */}
        <div
          className="relative rounded-full mb-4"
          style={{
            padding: '3px',
            background: spriteGlow
              ? 'conic-gradient(from 0deg, #f97316, #fed7aa, #f97316, #c2500f, #f97316)'
              : 'conic-gradient(from 0deg, #3a2e28, #f97316, #3a2e28)',
            boxShadow: spriteGlow
              ? '0 0 40px rgba(249,115,22,0.7), 0 0 80px rgba(249,115,22,0.3)'
              : '0 0 20px rgba(249,115,22,0.3)',
            transition: 'all 0.5s ease',
            animation: spriteGlow ? 'glow 1s ease-in-out infinite' : ''
          }}
        >
          {/* Inner circle clip */}
          <div className="w-28 h-28 rounded-full overflow-hidden bg-[#1a1410]">
            <Image
              src="/sprite.png"
              alt="Tyunnie"
              width={112}
              height={112}
              className="w-full h-full object-cover object-top"
              priority
            />
          </div>
        </div>

        {/* Name + status */}
        <div className="font-serif italic text-white text-lg mb-1">Tyunnie</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" style={{ boxShadow: '0 0 4px #16a34a' }} />
          <span className="text-[10px] font-mono text-[#9a8f7e] uppercase tracking-widest">Online</span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-col w-full max-w-2xl flex-1 px-4 z-10 min-h-0">

        {/* Bubble history */}
        <div
          ref={historyRef}
          className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4 min-h-0"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#2a2520 transparent',
            maxHeight: 'calc(100vh - 380px)'
          }}
        >
          {bubbles.map((b, index) => {
            const distanceFromBottom = bubbles.length - 1 - index
            const opacity = distanceFromBottom > 3
              ? Math.max(0.15, 1 - (distanceFromBottom - 3) * 0.18)
              : 1

            return (
              <div
                key={b.id}
                className={`flex ${b.who === 'tyunnie' ? 'justify-start' : 'justify-end'}`}
                style={{ animation: 'bubbleIn 0.3s ease', opacity, transition: 'opacity 0.3s ease' }}
              >
                {/* Tyunnie avatar dot */}
                {b.who === 'tyunnie' && (
                  <div className="w-6 h-6 rounded-full overflow-hidden mr-2 shrink-0 self-end mb-1 border border-[#f97316]/40">
                    <Image src="/sprite.png" alt="" width={24} height={24} className="object-cover object-top w-full h-full"/>
                  </div>
                )}

                <div
                  className={`
                    max-w-[70%] px-4 py-2.5 text-[13px] leading-[1.75] font-medium
                    ${b.who === 'tyunnie'
                      ? 'bg-[#f97316] text-white rounded-[4px_18px_18px_18px]'
                      : 'bg-[#2a2520] text-[#e8ddd0] rounded-[18px_4px_18px_18px] border border-[#3a3028]'
                    }
                  `}
                >
                  <span dangerouslySetInnerHTML={{ __html: b.text }} />
                  <div className="text-[9px] opacity-50 mt-1 text-right font-mono">{b.time}</div>
                </div>
              </div>
            )
          })}

          {/* Thinking dots */}
          {thinking && (
            <div className="flex justify-start items-end gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-[#f97316]/40 shrink-0">
                <Image src="/sprite.png" alt="" width={24} height={24} className="object-cover object-top w-full h-full"/>
              </div>
              <div className="bg-[#f97316] rounded-[4px_18px_18px_18px] px-4 py-3 flex gap-1.5 items-center">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white"
                    style={{ animation: 'thinkPulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Confirmation card */}
          {confirm && (
            <div className="bg-[#1e1b17] border border-[#f97316] rounded-2xl p-4 mx-2"
              style={{ animation: 'bubbleIn 0.3s ease' }}
            >
              <div className="text-[10px] font-bold text-[#f97316] mb-2 tracking-wide uppercase">
                ✦ {confirm.label}
              </div>
              <div
                className="text-[12px] text-[#c8b89a] leading-[1.8] mb-3"
                dangerouslySetInnerHTML={{ __html: confirm.detail }}
              />
              <div className="flex gap-2">
                <button
                  onClick={confirm.onConfirm}
                  className="flex-1 bg-[#16a34a] text-white text-[11px] font-bold rounded-xl py-2.5 hover:opacity-90 transition-opacity"
                >
                  Looks good ✓
                </button>
                <button
                  onClick={() => { setConfirm(null); addBubble('tyunnie', "No worries, I won't add it 🧡") }}
                  className="flex-1 bg-transparent border border-[#3a3028] text-[#9a8f7e] text-[11px] font-bold rounded-xl py-2.5 hover:border-red-800 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="pb-8 pt-2">
          <div className="flex gap-3 bg-[#1a1410] border border-[#2a2520] rounded-2xl px-4 py-3 focus-within:border-[#f97316] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to Tyunnie..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-[#e8ddd0] text-sm placeholder:text-[#4a4038] leading-[1.6] self-center"
              style={{ minHeight: '24px', maxHeight: '120px' }}
            />
            <button
              onClick={sendChat}
              disabled={thinking || !input.trim()}
              className="w-9 h-9 bg-[#f97316] rounded-xl text-white flex items-center justify-center shrink-0 self-end hover:bg-[#c2500f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base"
            >
              ↑
            </button>
          </div>
          <p className="text-center text-[10px] text-[#3a3028] mt-2 font-mono">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes thinkPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}