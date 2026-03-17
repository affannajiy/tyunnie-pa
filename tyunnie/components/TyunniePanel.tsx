// components/TyunniePanel.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import type { Event, Todo, Draft, Project, Snip, FinanceEntry } from '@/lib/database'

// ── TYPES ──
type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Bubble = {
  id: string
  who: 'user' | 'tyunnie'
  text: string
  time: string
}

type ConfirmPayload = {
  label: string
  detail: string        // HTML string shown in confirm card
  onConfirm: () => void
}

// All app data passed in so Tyunnie knows your context
type AppData = {
  events:  Event[]
  todos:   Todo[]
  drafts:  Draft[]
  projects: Project[]
  snips:   Snip[]
  finance: FinanceEntry[]
}

type Props = {
  appData: AppData
  userId: string
  // Called when Tyunnie triggers a panel switch
  onNavigate: (panel: string) => void
  // Called when Tyunnie adds an event (after confirmation)
  onEventAdded: (event: { title: string; date: string; time: string }) => void
  // Called when Tyunnie adds a task
  onTodoAdded: (todo: { text: string; tag: string; due: string }) => void
  onDraftAdded: (draft: { title: string; body: string }) => void
}

const SPRITE_GREETINGS = [
  "Hey, I'm here 🧡 Talk to me — ask about your balance, add an event, check your drafts. I know everything.",
  "Welcome back! What are we working on today?",
  "Hey you 🧡 I've been waiting. What do you need?",
  "I'm here. What's on your mind?",
]

export default function TyunniePanel({
  appData,
  userId,
  onNavigate,
  onEventAdded,
  onTodoAdded,
  onDraftAdded,
}: Props) {
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState('')
  const [thinking, setThinking]       = useState(false)
  const [confirm, setConfirm]         = useState<ConfirmPayload | null>(null)
  const [spriteGlow, setSpriteGlow]   = useState(false)

  const historyRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // ── HELPERS ──

  function timeNow() {
    const d = new Date()
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
  }
  
  function makeId() {
    return Math.random().toString(36).slice(2)
  }

  function addBubble(who: 'user' | 'tyunnie', text: string) {
    setBubbles(prev => [...prev, { id: makeId(), who, text, time: timeNow() }])
    if (who === 'tyunnie') {
      setSpriteGlow(true)
      setTimeout(() => setSpriteGlow(false), 800)
    }
  }

  // Greet on first load
  const [bubbles, setBubbles] = useState<Bubble[]>(() => {
  const greeting = SPRITE_GREETINGS[Math.floor(Math.random() * SPRITE_GREETINGS.length)]
  return [{
    id: Math.random().toString(36).slice(2),
    who: 'tyunnie',
    text: greeting,
    time: new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0')
  }]
})

  // Scroll to bottom whenever bubbles change
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [bubbles, thinking, confirm])

  // ── SYSTEM PROMPT with full app context ──
  function buildSystemPrompt(): string {
    const { events, todos, drafts, projects, snips, finance } = appData
    const today = new Date().toISOString().split('T')[0]

    const totalIncome   = finance.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0)
    const totalExpenses = finance.filter(f => f.type === 'expense').reduce((s, f) => s + f.amount, 0)
    const balance       = totalIncome - totalExpenses

    const upcomingEvents = events
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10)
      .map(e => `• ${e.date} ${e.time ?? ''}: ${e.title}`)
      .join('\n') || 'None'

    const pendingTodos = todos
      .filter(t => !t.done)
      .map(t => `• [${t.tag}] ${t.text}${t.due ? ` (due ${t.due})` : ''}`)
      .join('\n') || 'None'

    const draftList = drafts
      .map((d, i) => `${i + 1}. "${d.title}" — ${(d.body ?? '').trim().split(/\s+/).length} words`)
      .join('\n') || 'None'

    const projectList = projects
      .map(p => `• ${p.name} [${p.status}] ${p.progress}%${p.start_date ? ` (${p.start_date} → ${p.end_date})` : ''}`)
      .join('\n') || 'None'

    const snipList = snips
      .map(s => `• ${s.name} (${s.language})`)
      .join('\n') || 'None'

    const recentFinance = finance
      .slice(0, 5)
      .map(f => `• ${f.type === 'income' ? '+' : '-'}RM${f.amount.toFixed(2)} ${f.description} (${f.category})`)
      .join('\n') || 'None'

    return `You are Tyunnie — a warm, caring personal AI assistant based on Taehyun from TXT. You speak like a close, supportive friend. The user is a CS student who loves writing and ideas. Keep all replies short and personal (1–3 sentences max before any action block).

Today: ${today}

=== APP DATA ===

FINANCE:
  Income:   RM${totalIncome.toFixed(2)}
  Expenses: RM${totalExpenses.toFixed(2)}
  Balance:  RM${balance.toFixed(2)}
  Recent:
${recentFinance}

CALENDAR (upcoming):
${upcomingEvents}

TASKS (pending):
${pendingTodos}

DRAFTS:
${draftList}

PROJECTS:
${projectList}

CODE SNIPS:
${snipList}

=== ACTIONS ===
You MUST append an action block at the end of your reply using EXACTLY this format with no variations:
<action>{"type":"ACTION","data":{...}}</action>

CRITICAL: Use the exact characters < and > around the word "action". 
Do NOT use $, [, {, or any other character instead of <.
The format must be exactly: <action> at the start and </action> at the end.

Available actions:
- add_event → ALWAYS show confirmation first. data: { "title":"...", "date":"YYYY-MM-DD", "time":"..." }
- add_todo  → Add immediately, NO confirmation needed. data: { "text":"...", "tag":"cs"|"write"|"personal"|"other", "due":"YYYY-MM-DD or empty string" }
- add_draft → Create a writing draft immediately. data: { "title":"...", "body":"..." }
- navigate  → data: { "panel":"calendar"|"todo"|"writing"|"projects"|"snippets"|"finance" }

STRICT RULES:
- When user says "add task", "remind me to", "add to my todo", "create a task" → ALWAYS include add_todo action
- For add_todo: add it silently and immediately, tell the user it's done
- For add_event: always confirm details first before adding
- For financial questions: quote the exact RM balance from the data
- NEVER mention "action block" or "JSON" to the user
- The action block MUST be the very last thing in your response, on its own line
- Example of correct add_todo response:
  Done! I've added "Feed Cats" to your tasks 🧡
  <action>{"type":"add_todo","data":{"text":"Feed Cats","tag":"personal","due":""}}</action>
  When user says "make a draft", "create a draft", "write a template", "start a draft" → ALWAYS include add_draft action
- For add_draft: create it immediately, tell the user it's saved
- Example of correct add_draft response:
  Done! I've created your draft "Meeting Notes" 🧡
  <action>{"type":"add_draft","data":{"title":"Meeting Notes","body":"Title:\n\nWritten by:\n\nBody:\n"}}</action>`
  }

  // ── PARSE AND EXECUTE ACTION ──
  function executeAction(raw: string) {
    try {
      const action = JSON.parse(raw.trim())

      switch (action.type) {

        case 'navigate':
          onNavigate(action.data.panel)
          break

        case 'add_event': {
          const d = action.data
          setConfirm({
            label: 'Add to Calendar?',
            detail: `
              <strong>📅 ${d.title}</strong><br/>
              Date: <strong>${d.date}</strong><br/>
              Time: <strong>${d.time || 'Not specified'}</strong>
            `,
            onConfirm: () => {
              onEventAdded({ title: d.title, date: d.date, time: d.time ?? '' })
              setConfirm(null)
              addBubble('tyunnie', `Done! "${d.title}" is now on your calendar 📅`)
            }
          })
          break
        }

        case 'add_todo': {
          const d = action.data
          onTodoAdded({ text: d.text, tag: d.tag ?? 'other', due: d.due ?? '' })
          break
        }

        case 'add_draft': {
          const d = action.data
          onDraftAdded({ title: d.title, body: d.body ?? '' })
          break
        }
      }
    } catch (err) {
      console.log('Action parse error:', err, 'raw:', raw)
    }
  }

  // ── SEND CHAT ──
  async function sendChat() {
    const msg = input.trim()
    if (!msg || thinking) return

    setInput('')
    addBubble('user', msg)

    const updatedMessages: Message[] = [
      ...messages,
      { role: 'user', content: msg }
    ]
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
      
      console.log('Full reply from AI:', fullReply) // DEBUG

      const normalized = fullReply
        .replace(/\$action>/gi, '<action>')
        .replace(/\$\/action>/gi, '</action>')
        .replace(/\[action\]/gi, '<action>')
        .replace(/\[\/action\]/gi, '</action>')

      // Strip the action block from the visible message
      const actionMatch  = normalized.match(/<action>([\s\S]*?)<\/action>/)
      const cleanMessage = normalized.replace(/<action>[\s\S]*?<\/action>/g, '').trim()

      console.log('Clean reply from AI:', cleanMessage) // DEBUG

      setThinking(false)
      addBubble('tyunnie', cleanMessage)

      // Update message history with clean text (no action block)
      setMessages(prev => [...prev, { role: 'assistant', content: cleanMessage }])

      // Execute action if present
      if (actionMatch) {
        console.log('Action found:', actionMatch[1])  // keep this for debugging
        setTimeout(() => executeAction(actionMatch[1]), 300)
      }

    } catch {
      setThinking(false)
      addBubble('tyunnie', "Something went wrong on my end 😔 Try again?")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChat()
    }
  }

  // ── RENDER ──
  return (
    <div className="w-75 shrink-0 bg-[#111010] flex flex-col overflow-hidden border-l border-[#2a2520] relative">

      {/* Subtle radial glow at bottom */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(249,115,22,0.10) 0%, transparent 65%)' }}
      />

      {/* ── CHAT HISTORY ── */}
      <div
        ref={historyRef}
        className="flex-1 overflow-y-auto px-3 pt-4 pb-2 flex flex-col justify-end gap-2.5 z-10 relative min-h-0"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2520 transparent' }}
      >
        {bubbles.map((b, index) => {
          // Fade bubbles that are more than 3 from the bottom
          const distanceFromBottom = bubbles.length - 1 - index
          const opacity = distanceFromBottom > 3
            ? Math.max(0.15, 1 - (distanceFromBottom - 3) * 0.18)
            : 1

          return (
            <div
              key={b.id}
              className={`flex ${b.who === 'tyunnie' ? 'justify-start' : 'justify-end'}`}
              style={{
                animation: 'bubbleIn 0.3s ease',
                opacity,
                transition: 'opacity 0.3s ease'
              }}
            >
              <div
              className={`
                max-w-52.5 px-3.5 py-2.5 text-[12.5px] leading-[1.7] font-medium
                ${b.who === 'tyunnie'
                  ? 'bg-[#f97316] text-white rounded-[4px_16px_16px_16px]'
                  : 'bg-[#2a2520] text-[#e8ddd0] rounded-[16px_4px_16px_16px] border border-[#3a3028]'
                }
              `}
              >    
                <span dangerouslySetInnerHTML={{ __html: b.text }} />
                <div className="text-[9px] opacity-60 mt-1 text-right font-mono">
                  {b.time}
                </div>
              </div>
            </div>
          )
        })}

        {/* Thinking dots */}
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-[#f97316] rounded-[16px_4px_16px_16px] px-4 py-3 flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white"
                  style={{
                    animation: 'thinkPulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Confirmation card */}
        {confirm && (
          <div className="bg-[#1e1b17] border border-[#f97316] rounded-xl p-3.5 mx-1"
            style={{ animation: 'bubbleIn 0.3s ease' }}
          >
            <div className="text-[10px] font-bold text-[#f97316] mb-2 tracking-wide">
              ✦ {confirm.label}
            </div>
            <div
              className="text-[11px] text-[#c8b89a] leading-[1.8] mb-3"
              dangerouslySetInnerHTML={{ __html: confirm.detail }}
            />
            <div className="flex gap-2">
              <button
                onClick={confirm.onConfirm}
                className="flex-1 bg-[#16a34a] text-white text-[11px] font-bold rounded-lg py-2 hover:opacity-90 transition-opacity"
              >
                Looks good ✓
              </button>
              <button
                onClick={() => {
                  setConfirm(null)
                  addBubble('tyunnie', "No worries, I won't add it 🧡")
                }}
                className="flex-1 bg-transparent border border-[#3a3028] text-[#9a8f7e] text-[11px] font-bold rounded-lg py-2 hover:border-red-800 hover:text-red-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── SPRITE ── */}
      <div className="h-67.5 shrink-0 relative flex items-end justify-start overflow-hidden z-10">
        {/* Top fade */}
        <div
          className="absolute top-0 left-0 right-0 h-14 pointer-events-none z-10"
          style={{ background: 'linear-gradient(#111010, transparent)' }}
        />
        <Image
          src="/sprite.png"
          alt="Tyunnie"
          width={180}
          height={230}
          className="object-contain object-top relative z-2 transition-all duration-500 -ml-2"
          style={{
            filter: spriteGlow
            ? 'drop-shadow(0 -8px 40px rgba(249,115,22,0.55)) brightness(1.06)'
            : 'drop-shadow(0 -8px 30px rgba(249,115,22,0.20))'
          }}
          priority
        />
      </div>

      {/* ── CHAT INPUT ── */}
      <div className="px-3 py-3 border-t border-[#2a2520] bg-black/30 flex gap-2 z-10 shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Talk to Tyunnie..."
          rows={1}
          className="flex-1 bg-[#1e1b17] border border-[#3a3028] rounded-xl text-[#e8ddd0] text-xs px-3 py-2.5 outline-none resize-none leading-normal placeholder:text-[#4a4038] transition-colors focus:border-[#f97316]"
          style={{ minHeight: '40px', maxHeight: '80px' }}
        />
        <button
          onClick={sendChat}
          disabled={thinking || !input.trim()}
          className="w-10 h-10 bg-[#f97316] rounded-xl text-white text-base flex items-center justify-center shrink-0 hover:bg-[#c2500f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
        >
          ↑
        </button>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes thinkPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  )
}