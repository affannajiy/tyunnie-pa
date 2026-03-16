// components/panels/Projects.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  type Project
} from '@/lib/database'

type Props = {
  userId: string
  onAction: (msg: string) => void
}

const STATUS_OPTIONS = ['planning', 'active', 'paused', 'done'] as const

const STATUS_STYLES: Record<string, string> = {
  planning: 'bg-[#fff0e6] text-[#c2500f] border-[#fed7aa]',
  active:   'bg-[#dcfce7] text-[#15803d] border-[#86efac]',
  paused:   'bg-[#f3f0ea] text-[#9a8f7e] border-[#e8e2d8]',
  done:     'bg-[#eff6ff] text-[#3b82f6] border-[#bfdbfe]',
}

export default function Projects({ userId, onAction }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)

  // Form state
  const [name, setName]           = useState('')
  const [status, setStatus]       = useState<Project['status']>('planning')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [progress, setProgress]   = useState('0')
  const [description, setDesc]    = useState('')
  const [saving, setSaving]       = useState(false)
  const [showForm, setShowForm]   = useState(false)

  // Which project is expanded to show detail
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Editing an existing project
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    getProjects(userId).then(data => {
      setProjects(data)
      setLoading(false)
    })
  }, [userId])

  // ── FORM HELPERS ──
  function resetForm() {
    setName(''); setStatus('planning'); setStartDate('')
    setEndDate(''); setProgress('0'); setDesc('')
    setEditingId(null)
  }

  function openEditForm(p: Project) {
    setName(p.name)
    setStatus(p.status)
    setStartDate(p.start_date ?? '')
    setEndDate(p.end_date ?? '')
    setProgress(String(p.progress))
    setDesc(p.description ?? '')
    setEditingId(p.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── HANDLERS ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const prog = Math.min(100, Math.max(0, parseInt(progress) || 0))

    if (editingId) {
      // Update existing
      await updateProject(editingId, {
        name: name.trim(),
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        progress: prog,
        description: description.trim()
      })
      setProjects(prev => prev.map(p =>
        p.id === editingId
          ? { ...p, name: name.trim(), status, start_date: startDate || null,
              end_date: endDate || null, progress: prog, description: description.trim() }
          : p
      ))
      onAction(`Updated "${name}" — looking good 🗂️`)
    } else {
      // Add new
      const newProject = await addProject(userId, {
        name: name.trim(),
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        progress: prog,
        description: description.trim()
      })
      if (newProject) {
        setProjects(prev => [newProject, ...prev])
        onAction(`New project locked in — "${name}". Let's build something great 🗂️`)
      }
    }

    resetForm()
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string, projectName: string) {
    await deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    if (expandedId === id) setExpandedId(null)
    onAction(`Removed "${projectName}" from your projects.`)
  }

  async function handleProgressChange(id: string, newProgress: number) {
    await updateProject(id, { progress: newProgress })
    setProjects(prev => prev.map(p => p.id === id ? { ...p, progress: newProgress } : p))
  }

  // ── GANTT CHART ──
  // Only shows projects that have both a start and end date
  const ganttProjects = projects.filter(p => p.start_date && p.end_date)

  function renderGantt() {
    if (ganttProjects.length === 0) return null

    const allDates = ganttProjects.flatMap(p => [
      new Date(p.start_date!),
      new Date(p.end_date!)
    ])
    const minDate  = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate  = new Date(Math.max(...allDates.map(d => d.getTime())))
    const totalMs  = maxDate.getTime() - minDate.getTime() || 1

    // Build month tick labels
    const ticks: { label: string; pct: number }[] = []
    const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (cursor <= maxDate) {
      const pct = ((cursor.getTime() - minDate.getTime()) / totalMs) * 100
      ticks.push({
        label: cursor.toLocaleString('default', { month: 'short', year: '2-digit' }),
        pct: Math.max(0, Math.min(100, pct))
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    return (
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <span className="font-serif italic text-[#f97316] text-sm">Gantt Chart</span>
          <div className="flex-1 h-px bg-[#e8e2d8]" />
        </div>

        {/* Month tick labels */}
        <div className="relative h-5 mb-2 ml-[140px]">
          {ticks.map((tick, i) => (
            <span
              key={i}
              className="absolute text-[9px] font-mono text-[#9a8f7e] -translate-x-1/2"
              style={{ left: `${tick.pct}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        {/* Gantt rows */}
        <div className="flex flex-col gap-2">
          {ganttProjects.map(p => {
            const start  = new Date(p.start_date!)
            const end    = new Date(p.end_date!)
            const left   = ((start.getTime() - minDate.getTime()) / totalMs) * 100
            const width  = Math.max(
              ((end.getTime() - start.getTime()) / totalMs) * 100,
              2  // minimum visible width
            )

            return (
              <div key={p.id} className="flex items-center gap-3">
                {/* Project name label */}
                <div className="w-[130px] flex-shrink-0 text-xs font-semibold text-[#111010] truncate text-right pr-2">
                  {p.name}
                </div>

                {/* Track */}
                <div className="flex-1 h-7 bg-[#f3f0ea] rounded-lg relative overflow-hidden">
                  <div
                    className="absolute top-0 h-full rounded-lg flex items-center px-2 overflow-hidden"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: 'linear-gradient(90deg, #c2500f, #f97316)'
                    }}
                  >
                    <span className="text-white text-[9px] font-bold whitespace-nowrap">
                      {p.progress}%
                    </span>
                  </div>
                </div>

                {/* End date */}
                <div className="w-[70px] flex-shrink-0 font-mono text-[9px] text-[#9a8f7e] text-right">
                  {p.end_date}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── RENDER ──
  return (
    <div>

      {/* Add / Edit form */}
      {showForm ? (
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-serif italic text-[#f97316] text-sm">
              {editingId ? 'Edit Project' : 'New Project'}
            </span>
            <div className="flex-1 h-px bg-[#e8e2d8]" />
            <button
              onClick={() => { resetForm(); setShowForm(false) }}
              className="text-[#c5bdb0] hover:text-[#9a8f7e] text-sm transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Name + Status */}
            <div className="flex gap-3 mb-3">
              <div className="flex-[2]">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Final Year Project"
                  required
                  className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as Project['status'])}
                  className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates + Progress */}
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                  Progress %
                </label>
                <input
                  type="number"
                  value={progress}
                  onChange={e => setProgress(e.target.value)}
                  min="0"
                  max="100"
                  placeholder="0"
                  className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
                />
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDesc(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false) }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="bg-[#f97316] text-white font-bold rounded-xl px-5 py-2.5 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes ✦' : 'Add Project ✦'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-[#f97316] text-white font-bold rounded-xl px-5 py-2.5 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px"
          >
            + New Project
          </button>
        </div>
      )}

      {/* Gantt chart — only renders if projects have dates */}
      {!loading && renderGantt()}

      {/* Project cards */}
      {loading && (
        <div className="text-center py-12 text-[#c5bdb0] text-sm">
          Loading your projects...
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="text-center py-16 text-[#c5bdb0]">
          <div className="text-3xl mb-3 opacity-50">🗂️</div>
          <p className="text-sm">No projects yet. Hit + New Project to get started.</p>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="flex flex-col gap-4">
          {projects.map(p => (
            <div
              key={p.id}
              className="bg-white border border-[#e8e2d8] rounded-2xl p-5 transition-colors hover:border-[#fed7aa]"
            >
              {/* Card header */}
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-[#111010] text-base flex-1">{p.name}</h3>

                <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${STATUS_STYLES[p.status]}`}>
                  {p.status}
                </span>

                {/* Edit button */}
                <button
                  onClick={() => openEditForm(p)}
                  className="text-[#c5bdb0] hover:text-[#f97316] transition-colors text-xs font-mono"
                  title="Edit project"
                >
                  ✏
                </button>

                {/* Expand / collapse */}
                <button
                  onClick={() => setExpandedId(prev => prev === p.id ? null : p.id)}
                  className="text-[#c5bdb0] hover:text-[#9a8f7e] transition-colors text-sm"
                >
                  {expandedId === p.id ? '▲' : '▼'}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  className="text-[#c5bdb0] hover:text-red-500 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Description */}
              {p.description && (
                <p className="text-xs text-[#9a8f7e] mb-3 leading-relaxed">{p.description}</p>
              )}

              {/* Progress bar */}
              <div className="mb-1">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-[10px] text-[#9a8f7e]">
                    {p.start_date ?? '?'} → {p.end_date ?? '?'}
                  </span>
                  <span className="font-mono text-[10px] text-[#9a8f7e]">
                    {p.progress}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#f3f0ea] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${p.progress}%`,
                      background: 'linear-gradient(90deg, #c2500f, #f97316)'
                    }}
                  />
                </div>
              </div>

              {/* Expanded: inline progress slider */}
              {expandedId === p.id && (
                <div className="mt-4 pt-4 border-t border-[#e8e2d8]">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-2">
                    Update Progress
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={p.progress}
                      onChange={e => handleProgressChange(p.id, parseInt(e.target.value))}
                      className="flex-1 accent-[#f97316]"
                    />
                    <span className="font-mono text-sm font-bold text-[#f97316] w-10 text-right">
                      {p.progress}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}