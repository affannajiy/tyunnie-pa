// components/panels/Writing.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import {
  getDrafts,
  addDraft,
  updateDraft,
  deleteDraft,
  type Draft
} from '@/lib/database'
import { useWorkspace } from '@/lib/WorkspaceContext'

type Props = {
  userId: string
  onAction: (msg: string) => void
  refreshKey?: number
}

export default function Writing({ userId, onAction, refreshKey }: Props) {
  const { setSnapshot } = useWorkspace()
  const [drafts, setDrafts]       = useState<Draft[]>([])
  const [loading, setLoading]     = useState(true)

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [isDirty, setIsDirty]       = useState(false)

  // Search
  const [search, setSearch] = useState('')

  const bodyRef  = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getDrafts(userId).then(data => {
      setDrafts(data)
      setLoading(false)
    })
  }, [userId, refreshKey])

  // Listen for global "tyunnie-new-draft" — open new draft editor
  useEffect(() => {
    function handler() { openNew() }
    window.addEventListener('tyunnie-new-draft', handler)
    return () => window.removeEventListener('tyunnie-new-draft', handler)
  // openNew is stable (no deps change it), safe to run once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── WORKSPACE BROADCAST ──
  useEffect(() => {
    if (!editorOpen || !body || body.length < 80) return
    const timer = setTimeout(() => {
      const wc = body.trim() ? body.trim().split(/\s+/).length : 0
      setSnapshot({
        panel: 'writing',
        content: body,
        label: `draft '${title || 'Untitled'}'`,
        meta: { title: title || 'Untitled', wordCount: String(wc) },
        updatedAt: Date.now(),
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [body, title, editorOpen, setSnapshot])

  useEffect(() => {
    return () => setSnapshot(null)
  }, [setSnapshot])

  // ── DERIVED ──
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0
  const charCount = body.length

  const filtered = drafts.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.body ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // ── HELPERS ──
  function openNew() {
    setEditingId(null)
    setTitle('')
    setBody('')
    setIsDirty(false)
    setEditorOpen(true)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  function openEdit(draft: Draft) {
    setEditingId(draft.id)
    setTitle(draft.title)
    setBody(draft.body ?? '')
    setIsDirty(false)
    setEditorOpen(true)
    setTimeout(() => bodyRef.current?.focus(), 50)
  }

  function closeEditor() {
    // Warn if there are unsaved changes
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Discard them?')
      if (!confirmed) return
    }
    setEditorOpen(false)
    setEditingId(null)
    setIsDirty(false)
  }

  function getPreview(body: string, chars = 120) {
    const clean = (body ?? '').trim()
    return clean.length > chars ? clean.slice(0, chars) + '...' : clean
  }

  function getWordCount(body: string) {
    const clean = (body ?? '').trim()
    return clean ? clean.split(/\s+/).length : 0
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  // ── HANDLERS ──
  async function handleSave() {
    if (!body.trim()) return
    setSaving(true)

    const finalTitle = title.trim() || 'Untitled'

    if (editingId) {
      await updateDraft(editingId, { title: finalTitle, body })
      setDrafts(prev => prev.map(d =>
        d.id === editingId ? { ...d, title: finalTitle, body } : d
      ))
      onAction(`Draft updated — "${finalTitle}" is saved 🧡`)
    } else {
      const newDraft = await addDraft(userId, { title: finalTitle, body })
      if (newDraft) {
        setDrafts(prev => [newDraft, ...prev])
        setEditingId(newDraft.id) // stay in edit mode for the new draft
        onAction(`Draft saved — "${finalTitle}". Your words are always worth keeping 🧡`)
      }
    }

    setIsDirty(false)
    setSaving(false)
  }

  async function handleDelete(id: string, draftTitle: string) {
    const confirmed = window.confirm(`Delete "${draftTitle}"? This can't be undone.`)
    if (!confirmed) return

    await deleteDraft(id)
    setDrafts(prev => prev.filter(d => d.id !== id))

    // If we just deleted what's open, close the editor
    if (editingId === id) {
      setEditorOpen(false)
      setEditingId(null)
    }

    onAction(`Deleted "${draftTitle}".`)
  }

  // Cmd+S / Ctrl+S to save
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  // ── RENDER ──
  return (
    <div onKeyDown={handleKeyDown}>

      {/* ── EDITOR VIEW ── */}
      {editorOpen ? (
        <div className="bg-white border border-[#e8e2d8] rounded-2xl overflow-hidden">

          {/* Editor toolbar */}
          <div className="bg-[#f3f0ea] border-b border-[#e8e2d8] px-5 py-3 flex items-center gap-3">
            <button
              onClick={closeEditor}
              className="text-[#9a8f7e] hover:text-[#111010] transition-colors text-sm"
              title="Back to drafts"
            >
              ← Back
            </button>

            <div className="flex-1 h-px bg-[#e8e2d8]" />

            {/* Stats */}
            <span className="font-mono text-[10px] text-[#9a8f7e] bg-[#e8e2d8] px-2.5 py-1 rounded-full">
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
            <span className="font-mono text-[10px] text-[#9a8f7e] bg-[#e8e2d8] px-2.5 py-1 rounded-full">
              {charCount} chars
            </span>

            {/* Unsaved indicator */}
            {isDirty && (
              <span className="font-mono text-[10px] text-[#c2500f] bg-[#fff0e6] border border-[#fed7aa] px-2.5 py-1 rounded-full">
                unsaved
              </span>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || !body.trim()}
              className="bg-[#f97316] text-white font-bold rounded-lg px-4 py-1.5 text-[11px] tracking-wide hover:bg-[#c2500f] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save ✦'}
            </button>
          </div>

          {/* Title input */}
          <div className="px-8 pt-8 pb-2">
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setIsDirty(true) }}
              placeholder="Untitled"
              className="w-full bg-transparent border-none outline-none font-serif italic text-3xl text-[#111010] placeholder:text-[#c5bdb0]"
            />
          </div>

          {/* Divider */}
          <div className="mx-8 h-px bg-[#e8e2d8]" />

          {/* Body textarea */}
          <div className="px-8 py-6">
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => { setBody(e.target.value); setIsDirty(true) }}
              placeholder="Start writing... let the ideas flow. Nothing is too small to save."
              className="w-full bg-transparent border-none outline-none resize-none text-[14px] leading-[1.9] text-[#2d2416] placeholder:text-[#c5bdb0] font-sans"
              style={{ minHeight: 'calc(100vh - 320px)' }}
            />
          </div>

          {/* Bottom hint */}
          <div className="px-8 pb-4">
            <span className="font-mono text-[9px] text-[#c5bdb0]">
              Cmd+S to save
            </span>
          </div>
        </div>

      ) : (

        /* ── DRAFTS GRID VIEW ── */
        <div>

          {/* Top bar */}
          <div className="flex items-center gap-3 mb-5">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search drafts..."
              className="flex-1 bg-white border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
            />
            <button
              onClick={openNew}
              className="bg-[#f97316] text-white font-bold rounded-xl px-5 py-2.5 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px shrink-0"
            >
              + New Draft
            </button>
          </div>

          {/* Stats strip */}
          {!loading && drafts.length > 0 && (
            <div className="flex gap-3 mb-5">
              <div className="flex-1 bg-white border border-[#e8e2d8] rounded-2xl px-5 py-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-1">
                  Drafts
                </div>
                <div className="font-serif italic text-3xl text-[#f97316]">
                  {drafts.length}
                </div>
              </div>
              <div className="flex-1 bg-white border border-[#e8e2d8] rounded-2xl px-5 py-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-1">
                  Total Words
                </div>
                <div className="font-serif italic text-3xl text-[#111010]">
                  {drafts.reduce((sum, d) => sum + getWordCount(d.body ?? ''), 0).toLocaleString()}
                </div>
              </div>
              <div className="flex-1 bg-white border border-[#e8e2d8] rounded-2xl px-5 py-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-1">
                  Avg Length
                </div>
                <div className="font-serif italic text-3xl text-[#111010]">
                  {drafts.length
                    ? Math.round(drafts.reduce((s, d) => s + getWordCount(d.body ?? ''), 0) / drafts.length)
                    : 0
                  }
                  <span className="text-base text-[#9a8f7e] ml-1">wds</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-16 text-[#c5bdb0] text-sm">
              Loading your drafts...
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-[#c5bdb0]">
              <div className="text-4xl mb-3 opacity-40">✍️</div>
              <p className="text-sm">
                {search ? 'No drafts match that search.' : "No drafts yet. Hit \"+ New Draft\" and let it flow."}
              </p>
            </div>
          )}

          {/* Draft cards grid */}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map(draft => (
                <div
                  key={draft.id}
                  onClick={() => openEdit(draft)}
                  className="bg-white border border-[#e8e2d8] rounded-2xl p-5 cursor-pointer hover:border-[#fed7aa] hover:-translate-y-0.5 transition-all group relative"
                >
                  {/* Delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(draft.id, draft.title) }}
                    className="absolute top-3 right-3 text-[#c5bdb0] hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>

                  {/* Title */}
                  <h3 className="font-bold text-[#111010] text-sm mb-2 pr-6 leading-snug">
                    {draft.title}
                  </h3>

                  {/* Preview */}
                  <p className="text-xs text-[#9a8f7e] leading-relaxed mb-4 line-clamp-3">
                    {getPreview(draft.body ?? '') || '(empty)'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-[#c5bdb0]">
                      {formatDate(draft.created_at)}
                    </span>
                    <span className="font-mono text-[9px] text-[#c5bdb0] bg-[#f3f0ea] px-2 py-0.5 rounded-full">
                      {getWordCount(draft.body ?? '')} words
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}