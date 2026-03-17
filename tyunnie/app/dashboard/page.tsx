// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

import Sidebar, { type Panel } from '@/components/Sidebar'
import TyunniePanel from '@/components/TyunniePanel'
import Calendar from '@/components/Calendar'
import Todo     from '@/components/Todo'
import Writing  from '@/components/Writing'
import Projects from '@/components/Projects'
import Snippets from '@/components/Snippets'
import Finance  from '@/components/Finance'

import {
  getEvents,
  getTodos,
  getDrafts,
  getProjects,
  getSnips,
  getFinanceEntries,
  addEvent,
  addTodo,
  addDraft,
  type Event,
  type Todo as TodoType,
  type Draft,
  type Project,
  type Snip,
  type FinanceEntry,
} from '@/lib/database'

const PANEL_LABELS: Record<Panel, string> = {
  calendar: 'Calendar',
  todo:     'Tasks',
  writing:  'Writing',
  projects: 'Projects',
  snippets: 'Snip Files',
  finance:  'Finance',
}

export default function Home() {
  const router = useRouter()

  // ── AUTH ──
  const [user, setUser]       = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ── PANEL ──
  const [activePanel, setActivePanel] = useState<Panel>('calendar')

  // ── APP DATA ──
  // All data lives here so TyunniePanel always has up-to-date context
  const [events,   setEvents]   = useState<Event[]>([])
  const [todos,    setTodos]    = useState<TodoType[]>([])
  const [drafts,   setDrafts]   = useState<Draft[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [snips,    setSnips]    = useState<Snip[]>([])
  const [finance,  setFinance]  = useState<FinanceEntry[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [todoRefreshKey, setTodoRefreshKey] = useState(0)
  const [draftRefreshKey, setDraftRefreshKey] = useState(0)

  // ── CHECK AUTH ON MOUNT ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/auth')
      } else {
        setUser(data.user)
        setAuthLoading(false)
      }
    })
  }, [router])

  // ── LOAD ALL DATA once we have a user ──
  useEffect(() => {
    if (!user) return

    async function loadAll() {
      const [ev, td, dr, pr, sn, fi] = await Promise.all([
        getEvents(user!.id),
        getTodos(user!.id),
        getDrafts(user!.id),
        getProjects(user!.id),
        getSnips(user!.id),
        getFinanceEntries(user!.id),
      ])
      setEvents(ev)
      setTodos(td)
      setDrafts(dr)
      setProjects(pr)
      setSnips(sn)
      setFinance(fi)
      setDataLoading(false)
    }

    loadAll()
  }, [user])

  // ── SIGN OUT ──
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  // ── TYUNNIE CALLBACKS ──
  // Called when Tyunnie navigates to a panel
  function handleNavigate(panel: string) {
    if (Object.keys(PANEL_LABELS).includes(panel)) {
      setActivePanel(panel as Panel)
    }
  }

  // Called when Tyunnie confirms adding an event
  async function handleEventAdded(ev: { title: string; date: string; time: string }) {
    if (!user) return
    const newEvent = await addEvent(user.id, ev)
    if (newEvent) {
      setEvents(prev => [...prev, newEvent].sort((a, b) => a.date.localeCompare(b.date)))
      setActivePanel('calendar')
    }
  }

  // Called when Tyunnie adds a task
  async function handleTodoAdded(todo: { text: string; tag: string; due: string }) {
    if (!user) return
    const newTodo = await addTodo(user.id, {
      text: todo.text,
      tag:  todo.tag,
      due:  todo.due || null,
    })
    if (newTodo) {
      setTodos(prev => [newTodo, ...prev])
      setTodoRefreshKey(prev => prev + 1)  // ← bump this
    }
  }

  async function handleDraftAdded(draft: { title: string; body: string }) {
  if (!user) return
  const newDraft = await addDraft(user.id, {
    title: draft.title || 'Untitled',
    body:  draft.body
  })
  if (newDraft) {
    setDrafts(prev => [newDraft, ...prev])
    setDraftRefreshKey(prev => prev + 1)
  }
}

  // ── LOADING SCREEN ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="text-center">
          <div className="font-serif italic text-4xl text-[#f97316] mb-3">Tyunnie</div>
          <div className="text-sm text-[#9a8f7e]">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) return null

  // ── MAIN APP ──
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#faf8f5]">

      {/* Sidebar */}
      <Sidebar
        active={activePanel}
        onChange={setActivePanel}
        onSignOut={handleSignOut}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Topbar */}
        <div className="h-14 bg-white border-b border-[#e8e2d8] flex items-center px-7 gap-3 shrink-0">
          <button onClick={() => router.push('/chat')}
          className="text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest mr-1"
            >
              ← Chat
          </button>
          
          <span className="font-serif italic text-xl text-[#111010]">Tyunnie</span>
          <span className="text-[9px] font-bold uppercase tracking-[2px] text-[#f97316] bg-[#fff0e6] border border-[#fed7aa] px-3 py-1 rounded-full">
            {PANEL_LABELS[activePanel]}
          </span>
          <div className="flex-1" />
          <span className="font-mono text-[11px] text-[#9a8f7e]">
            {new Date().toLocaleDateString('en-MY', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </span>
        </div>

        {/* Scrollable panel area */}
        <div className="flex-1 overflow-y-auto p-7">
          {dataLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-[#c5bdb0]">
                <div className="text-3xl mb-3 opacity-40">🧡</div>
                <p className="text-sm">Loading your data...</p>
              </div>
            </div>
          ) : (
            <>
              {activePanel === 'calendar' && (
                <Calendar
                  userId={user.id}
                  onAction={() => {}}
                />
              )}
              {activePanel === 'todo' && (
                <Todo
                  userId={user.id}
                  onAction={() => {}}
                  refreshKey={todoRefreshKey}
                />
              )}
              {activePanel === 'writing' && (
                <Writing
                  userId={user.id}
                  onAction={() => {}}
                  refreshKey={draftRefreshKey}
                />
              )}
              {activePanel === 'projects' && (
                <Projects
                  userId={user.id}
                  onAction={() => {}}
                />
              )}
              {activePanel === 'snippets' && (
                <Snippets
                  userId={user.id}
                  onAction={() => {}}
                />
              )}
              {activePanel === 'finance' && (
                <Finance
                  userId={user.id}
                  onAction={() => {}}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Tyunnie panel — always visible on the right */}
      <TyunniePanel
        appData={{ events, todos, drafts, projects, snips, finance }}
        userId={user.id}
        onNavigate={handleNavigate}
        onEventAdded={handleEventAdded}
        onTodoAdded={handleTodoAdded}
        onDraftAdded={handleDraftAdded}
      />

    </div>
  )
}