// app/chat-demo/page.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Bubble = { id: string; who: 'tyunnie' | 'user'; text: string; time: string }
type Message = { role: 'user' | 'assistant'; content: string }

const GREETINGS = [
  "Hey, it's me 🧡 This is a demo — explore the dashboard to see what I can do!",
  "Welcome to Tyunnie! Hit Dashboard to explore all the features 🧡",
]

export default function ChatDemoPage() {
  const router = useRouter()

  const [bubbles, setBubbles] = useState<Bubble[]>(() => [{
    id: Math.random().toString(36).slice(2),
    who: 'tyunnie',
    text: GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    time: new Date().getHours().toString().padStart(2,'0') + ':' + new Date().getMinutes().toString().padStart(2,'0')
  }])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [thinking, setThinking] = useState(false)
  const [spriteGlow, setSpriteGlow] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  function timeNow() {
    return new Date().getHours().toString().padStart(2,'0') + ':' + new Date().getMinutes().toString().padStart(2,'0')
  }

  function addBubble(who: 'tyunnie' | 'user', text: string) {
    setBubbles(prev => [...prev, { id: Math.random().toString(36).slice(2), who, text, time: timeNow() }])
    if (who === 'tyunnie') { setSpriteGlow(true); setTimeout(() => setSpriteGlow(false), 1000) }
    setTimeout(() => { if (historyRef.current) historyRef.current.scrollTop = 99999 }, 100)
  }

  async function sendChat() {
    const msg = input.trim()
    if (!msg || thinking) return
    setInput('')
    addBubble('user', msg)
    const updated: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(updated)
    setThinking(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          systemPrompt: `You are Tyunnie, a warm AI assistant based on Taehyun from TXT. This is a demo for the user's friends. Be warm, fun, and encourage them to explore the Dashboard. Keep replies to 1-2 sentences. Do not process any actions.`
        })
      })
      const data = await res.json()
      setThinking(false)
      addBubble('tyunnie', data.text ?? "I'm here 🧡")
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }])
    } catch {
      setThinking(false)
      addBubble('tyunnie', "I'm here 🧡 Check out the Dashboard to see everything!")
    }
  }

  return (
    <div className="min-h-screen bg-[#111010] flex flex-col items-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(249,115,22,0.08) 0%, transparent 60%)' }}/>

      <div className="w-full flex items-center justify-between px-4 md:px-6 py-4 z-10">
        <div className="font-serif italic text-[#f97316] text-xl">Tyunnie</div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white bg-[#2a2520] border border-[#3a3028] px-3 py-1.5 rounded-full font-mono">
            Demo Mode
          </span>
          <button onClick={() => router.push('/demo')}
            className="text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-bold uppercase tracking-widest font-mono">
            Dashboard →
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center pt-4 pb-6 z-10">
        <div className="relative rounded-full mb-4" style={{
          padding: '3px',
          background: spriteGlow ? 'conic-gradient(from 0deg, #f97316, #fed7aa, #f97316, #c2500f, #f97316)' : 'conic-gradient(from 0deg, #3a2e28, #f97316, #3a2e28)',
          boxShadow: spriteGlow ? '0 0 40px rgba(249,115,22,0.7)' : '0 0 20px rgba(249,115,22,0.3)',
          transition: 'all 1.0s ease',
        }}>
          <div className="w-28 h-28 rounded-full overflow-hidden bg-[#1a1410]">
            <Image src="/sprite.png" alt="Tyunnie" width={112} height={112}
              className="w-full h-full object-cover object-[80%_5%]" priority/>
          </div>
        </div>
        <div className="font-serif italic text-white text-lg mb-1">Tyunnie</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" style={{ boxShadow: '0 0 4px #16a34a' }}/>
          <span className="text-[10px] font-mono text-[#9a8f7e] uppercase tracking-widest">Demo Mode</span>
        </div>
      </div>

      <div className="flex flex-col w-full max-w-2xl flex-1 px-4 z-10 min-h-0">
        <div ref={historyRef} className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4 min-h-0"
          style={{ maxHeight: 'calc(100vh - 380px)', scrollbarWidth: 'thin', scrollbarColor: '#2a2520 transparent' }}>
          {bubbles.map((b, index) => {
            const distanceFromBottom = bubbles.length - 1 - index
            const opacity = distanceFromBottom > 3 ? Math.max(0.15, 1 - (distanceFromBottom - 3) * 0.18) : 1
            return (
              <div key={b.id} className={`flex ${b.who === 'tyunnie' ? 'justify-start' : 'justify-end'}`}
                style={{ animation: 'bubbleIn 0.3s ease', opacity, transition: 'opacity 0.3s ease' }}>
                {b.who === 'tyunnie' && (
                  <div className="w-6 h-6 rounded-full overflow-hidden mr-2 shrink-0 self-end mb-1 border border-[#f97316]/40">
                    <Image src="/sprite.png" alt="" width={24} height={24} className="object-cover object-top w-full h-full"/>
                  </div>
                )}
                <div className={`max-w-[70%] px-4 py-2.5 text-[13px] leading-[1.75] font-medium ${
                  b.who === 'tyunnie'
                    ? 'bg-[#f97316] text-white rounded-[4px_18px_18px_18px]'
                    : 'bg-[#2a2520] text-[#e8ddd0] rounded-[18px_4px_18px_18px] border border-[#3a3028]'
                }`}>
                  <span dangerouslySetInnerHTML={{ __html: b.text }} />
                  <div className="text-[9px] opacity-50 mt-1 text-right font-mono">{b.time}</div>
                </div>
              </div>
            )
          })}
          {thinking && (
            <div className="flex justify-start items-end gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-[#f97316]/40 shrink-0">
                <Image src="/sprite.png" alt="" width={24} height={24} className="object-cover object-top w-full h-full"/>
              </div>
              <div className="bg-[#f97316] rounded-[4px_18px_18px_18px] px-4 py-3 flex gap-1.5 items-center">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white"
                    style={{ animation: 'thinkPulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }}/>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pb-8 pt-2">
          <div className="flex gap-3 bg-[#1a1410] border border-[#2a2520] rounded-2xl px-4 py-3 focus-within:border-[#f97316] transition-colors">
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
              placeholder="Say hi to Tyunnie..." rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-[#e8ddd0] text-sm placeholder:text-[#4a4038] leading-[1.6] self-center"
              style={{ minHeight: '24px', maxHeight: '120px' }}/>
            <button onClick={sendChat} disabled={thinking || !input.trim()}
              className="w-9 h-9 bg-[#f97316] rounded-xl text-white flex items-center justify-center shrink-0 self-end hover:bg-[#c2500f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base">
              ↑
            </button>
          </div>
          <p className="text-center text-[10px] text-[#3a3028] mt-2 font-mono">
            Demo mode · No account needed · Data resets on refresh
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bubbleIn { from { opacity:0; transform:translateY(8px) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes thinkPulse { 0%,80%,100% { transform:scale(.7); opacity:.4; } 40% { transform:scale(1); opacity:1; } }
      `}</style>
    </div>
  )
}