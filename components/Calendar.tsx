// components/Calendar.tsx
'use client'

import { useState, useEffect } from 'react'
import { getEvents, addEvent, deleteEvent, type Event } from '@/lib/database'

type Props = {
  userId: string
  onAction: (msg: string) => void
}

type ViewMode = '3day' | 'week' | 'month' | 'year'

const DAYS         = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS       = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── SHARED PROPS passed to every view ──
type ViewProps = {
  calDate:   Date
  events:    Event[]
  selected:  string | null
  todayStr:  string
  onDayClick: (dateStr: string) => void
  onDelete:   (id: string, title: string) => void
  onMonthClick?: (year: number, month: number) => void
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

// ── DAY CELL ──
function DayCell({
  dateStr, currentMonth = true, compact = false,
  selected, todayStr, events, onDayClick
}: {
  dateStr: string; currentMonth?: boolean; compact?: boolean
  selected: string | null; todayStr: string
  events: Event[]; onDayClick: (d: string) => void
}) {
  const isToday    = dateStr === todayStr
  const isSelected = dateStr === selected
  const dayEvents  = events.filter(e => e.date === dateStr)
  const dayNum     = parseInt(dateStr.split('-')[2])

  return (
    <button
      onClick={() => currentMonth && onDayClick(dateStr)}
      className={`
        w-full rounded-xl flex flex-col items-center transition-all
        ${compact ? 'py-1.5 gap-0.5 min-h-11' : 'py-2 gap-1 min-h-20'}
        ${!currentMonth ? 'opacity-25 cursor-default' : 'cursor-pointer'}
        ${isSelected
          ? 'bg-[#f97316] text-white'
          : isToday
          ? 'bg-[#fff0e6] border border-[#fed7aa] text-[#c2500f] font-bold'
          : currentMonth ? 'hover:bg-[#f3f0ea]' : ''
        }
      `}
    >
      <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium leading-none`}>
        {dayNum}
      </span>
      {dayEvents.length > 0 && (
        <div className="flex gap-0.5 flex-wrap justify-center px-1">
          {dayEvents.slice(0, compact ? 1 : 3).map((_, i) => (
            <div key={i} className={`rounded-full shrink-0 ${compact ? 'w-1 h-1' : 'w-1.5 h-1.5'} ${isSelected ? 'bg-white' : 'bg-[#f97316]'}`} />
          ))}
          {dayEvents.length > 3 && !compact && (
            <span className={`text-[8px] ${isSelected ? 'text-white' : 'text-[#f97316]'}`}>+{dayEvents.length - 3}</span>
          )}
        </div>
      )}
      {!compact && dayEvents.slice(0, 2).map((ev, i) => (
        <div key={i} className={`w-full text-[9px] truncate text-left rounded px-1 ${isSelected ? 'bg-white/20 text-white' : 'bg-[#f97316]/10 text-[#c2500f]'}`}>
          {ev.time && <span className="opacity-70 mr-0.5">{ev.time}</span>}
          {ev.title}
        </div>
      ))}
    </button>
  )
}

// ── MONTH VIEW ──
function MonthView({ calDate, events, selected, todayStr, onDayClick }: ViewProps) {
  const y = calDate.getFullYear(), m = calDate.getMonth()
  const firstDay    = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const daysInPrev  = new Date(y, m, 0).getDate()

  const cells: { dateStr: string; current: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ dateStr: toDateStr(y, m - 1, daysInPrev - i), current: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ dateStr: toDateStr(y, m, d), current: true })
  const rem = 7 - (cells.length % 7)
  if (rem < 7) for (let d = 1; d <= rem; d++)
    cells.push({ dateStr: toDateStr(y, m + 1, d), current: false })

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] py-2 font-mono">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ dateStr, current }) => (
          <DayCell key={dateStr} dateStr={dateStr} currentMonth={current} compact
            selected={selected} todayStr={todayStr} events={events} onDayClick={onDayClick}
          />
        ))}
      </div>
    </div>
  )
}

// ── WEEK VIEW ──
function WeekView({ calDate, events, selected, todayStr, onDayClick }: ViewProps) {
  const start = new Date(calDate)
  start.setDate(calDate.getDate() - calDate.getDay())

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
  })

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((dateStr, i) => (
        <div key={dateStr} className="flex flex-col gap-1">
          <div className="text-center text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono pb-1">
            {DAYS[i]}
          </div>
          <DayCell dateStr={dateStr} compact={false}
            selected={selected} todayStr={todayStr} events={events} onDayClick={onDayClick}
          />
        </div>
      ))}
    </div>
  )
}

// ── 3 DAY VIEW ──
function ThreeDayView({ calDate, events, selected, todayStr, onDayClick, onDelete }: ViewProps) {
  const yesterday = new Date(calDate); yesterday.setDate(calDate.getDate() - 1)
  const tomorrow  = new Date(calDate); tomorrow.setDate(calDate.getDate() + 1)

  const days   = [yesterday, calDate, tomorrow].map(d => toDateStr(d.getFullYear(), d.getMonth(), d.getDate()))
  const labels = ['Yesterday', 'Today', 'Tomorrow']

  return (
    <div className="grid grid-cols-3 gap-4">
      {days.map((dateStr, i) => {
        const dayEvents = events.filter(e => e.date === dateStr)
        return (
          <div key={dateStr} className="flex flex-col gap-2">
            <div className="text-center">
              <div className={`text-[10px] font-bold uppercase tracking-widest font-mono mb-0.5 ${i === 1 ? 'text-[#f97316]' : 'text-[#9a8f7e]'}`}>
                {labels[i]}
              </div>
              <div className="text-xs text-[#c5bdb0] font-mono">{dateStr}</div>
            </div>
            <div
              onClick={() => onDayClick(dateStr)}
              className={`
                rounded-2xl border p-4 cursor-pointer transition-all min-h-50
                ${selected === dateStr
                  ? 'border-[#f97316] bg-[#fff0e6]'
                  : dateStr === todayStr
                  ? 'border-[#fed7aa] bg-[#fff0e6]/50'
                  : 'border-[#e8e2d8] bg-white hover:border-[#fed7aa]'
                }
              `}
            >
              <div className={`font-serif italic text-4xl mb-3 ${i === 1 ? 'text-[#f97316]' : 'text-[#111010]'}`}>
                {parseInt(dateStr.split('-')[2])}
              </div>
              {dayEvents.length === 0 ? (
                <p className="text-[10px] text-[#c5bdb0] italic">No events</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {dayEvents.map(ev => (
                    <div key={ev.id} className="bg-[#f97316]/10 border border-[#f97316]/20 rounded-lg px-2 py-1.5 group relative">
                      {ev.time && <div className="font-mono text-[9px] text-[#c2500f] mb-0.5">{ev.time}</div>}
                      <div className="text-[11px] font-semibold text-[#111010] pr-4">{ev.title}</div>
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(ev.id, ev.title) }}
                        className="absolute top-1.5 right-1.5 text-[#c5bdb0] hover:text-red-500 text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── YEAR VIEW ──
function YearView({ calDate, events, todayStr, onMonthClick }: ViewProps) {
  const y = calDate.getFullYear()

  return (
    <div className="grid grid-cols-4 gap-4">
      {MONTHS.map((_, m) => {
        const firstDay    = new Date(y, m, 1).getDay()
        const daysInMonth = new Date(y, m + 1, 0).getDate()
        const daysInPrev  = new Date(y, m, 0).getDate()
        const monthHasEvents = events.some(e => e.date.startsWith(`${y}-${String(m+1).padStart(2,'0')}`))

        const cells: { dateStr: string; current: boolean }[] = []
        for (let i = firstDay - 1; i >= 0; i--)
          cells.push({ dateStr: toDateStr(y, m - 1, daysInPrev - i), current: false })
        for (let d = 1; d <= daysInMonth; d++)
          cells.push({ dateStr: toDateStr(y, m, d), current: true })

        return (
          <div
            key={m}
            className={`bg-white border rounded-2xl p-3 cursor-pointer transition-all hover:border-[#fed7aa] hover:shadow-sm ${monthHasEvents ? 'border-[#fed7aa]' : 'border-[#e8e2d8]'}`}
            onClick={() => onMonthClick?.(y, m)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold ${monthHasEvents ? 'text-[#f97316]' : 'text-[#9a8f7e]'}`}>
                {MONTHS_SHORT[m]}
              </span>
              {monthHasEvents && <div className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-[7px] text-[#c5bdb0] font-bold pb-0.5">{d}</div>
              ))}
              {cells.map(({ dateStr, current }) => {
                const isToday  = dateStr === todayStr
                const hasEvent = events.some(e => e.date === dateStr)
                return (
                  <div key={dateStr} className={`
                    aspect-square flex items-center justify-center rounded text-[7px] font-medium
                    ${!current ? 'opacity-20' : ''}
                    ${isToday ? 'bg-[#f97316] text-white' : hasEvent ? 'bg-[#fff0e6] text-[#c2500f] font-bold' : 'text-[#9a8f7e]'}
                  `}>
                    {parseInt(dateStr.split('-')[2])}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════
//  MAIN CALENDAR COMPONENT
// ══════════════════════════════════════
export default function Calendar({ userId, onAction }: Props) {
  const [events,   setEvents]   = useState<Event[]>([])
  const [calDate,  setCalDate]  = useState(new Date())
  const [selected, setSelected] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState<ViewMode>('3day')

  const [title,  setTitle]  = useState('')
  const [date,   setDate]   = useState('')
  const [time,   setTime]   = useState('')
  const [saving, setSaving] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getEvents(userId).then(data => { setEvents(data); setLoading(false) })
  }, [userId])

  function handleDayClick(dateStr: string) {
    setSelected(prev => prev === dateStr ? null : dateStr)
    setDate(dateStr)
  }

  async function handleDelete(id: string, eventTitle: string) {
    await deleteEvent(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    onAction(`Removed "${eventTitle}" from your calendar.`)
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)
    const newEvent = await addEvent(userId, { title: title.trim(), date, time })
    if (newEvent) {
      setEvents(prev => [...prev, newEvent].sort((a,b) => a.date.localeCompare(b.date)))
      onAction(`Got it! "${title}" is on your calendar 📅`)
      setTitle(''); setTime('')
    }
    setSaving(false)
  }

  function handleMonthClick(year: number, month: number) {
    setCalDate(new Date(year, month, 1))
    setView('month')
  }

  function navLabel() {
    const y = calDate.getFullYear(), m = calDate.getMonth()
    if (view === 'month') return `${MONTHS[m]} ${y}`
    if (view === 'year')  return `${y}`
    if (view === 'week') {
      const start = new Date(calDate)
      start.setDate(calDate.getDate() - calDate.getDay())
      const end = new Date(start); end.setDate(start.getDate() + 6)
      return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} — ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${y}`
    }
    return `${calDate.getDate()} ${MONTHS_SHORT[calDate.getMonth()]} ${y}`
  }

  function navPrev() {
    const d = new Date(calDate)
    if (view === 'month') d.setMonth(d.getMonth() - 1)
    if (view === 'week')  d.setDate(d.getDate() - 7)
    if (view === '3day')  d.setDate(d.getDate() - 3)
    if (view === 'year')  d.setFullYear(d.getFullYear() - 1)
    setCalDate(d)
  }

  function navNext() {
    const d = new Date(calDate)
    if (view === 'month') d.setMonth(d.getMonth() + 1)
    if (view === 'week')  d.setDate(d.getDate() + 7)
    if (view === '3day')  d.setDate(d.getDate() + 3)
    if (view === 'year')  d.setFullYear(d.getFullYear() + 1)
    setCalDate(d)
  }

  const viewProps: ViewProps = {
    calDate, events, selected, todayStr,
    onDayClick: handleDayClick,
    onDelete: handleDelete,
    onMonthClick: handleMonthClick,
  }

  const selectedEvents = selected ? events.filter(e => e.date === selected) : []
  const upcomingEvents = events.filter(e => e.date >= todayStr).slice(0, 6)

  return (
    <div>
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={navPrev} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e2d8] bg-[#f3f0ea] hover:border-[#f97316] hover:text-[#f97316] transition-colors text-lg shrink-0">‹</button>
          <h2 className="font-serif italic text-xl text-[#111010] flex-1 text-center">{navLabel()}</h2>
          <button onClick={navNext} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e2d8] bg-[#f3f0ea] hover:border-[#f97316] hover:text-[#f97316] transition-colors text-lg shrink-0">›</button>
          <button onClick={() => setCalDate(new Date())}
            className="px-3 py-1.5 rounded-lg border border-[#e8e2d8] text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-colors font-mono">
            Today
          </button>
        </div>

        {/* View tabs */}
        <div className="flex gap-1.5 mb-5">
          {(['3day','week','month','year'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all font-mono ${
                view === v ? 'bg-[#f97316] text-white' : 'bg-[#f3f0ea] text-[#9a8f7e] hover:text-[#f97316]'
              }`}>
              {v === '3day' ? '3 Days' : v}
            </button>
          ))}
        </div>

        {/* Views */}
        {view === 'month' && <MonthView    {...viewProps} />}
        {view === 'week'  && <WeekView     {...viewProps} />}
        {view === '3day'  && <ThreeDayView {...viewProps} />}
        {view === 'year'  && <YearView     {...viewProps} />}
      </div>

      {/* Selected day detail */}
      {selected && view !== '3day' && view !== 'year' && (
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#f97316] font-mono">{selected}</span>
            <div className="flex-1 h-px bg-[#e8e2d8]" />
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-[#9a8f7e] italic">No events on this day.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 bg-[#fff0e6] border border-[#fed7aa] border-l-4 border-l-[#f97316] rounded-xl px-4 py-3">
                  <span className="font-mono text-[10px] text-[#c2500f] min-w-12.5">{ev.time || 'All day'}</span>
                  <span className="flex-1 text-sm font-semibold">{ev.title}</span>
                  <button onClick={() => handleDelete(ev.id, ev.title)} className="text-[#c5bdb0] hover:text-red-500 text-sm">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add event form */}
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-serif italic text-[#f97316] text-sm">Add Event</span>
          <div className="flex-1 h-px bg-[#e8e2d8]" />
        </div>
        <form onSubmit={handleAddEvent}>
          <div className="flex gap-3 mb-3">
            <div className="flex-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Event name"
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"/>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"/>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">Time</label>
              <input type="text" value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 8:00 PM"
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"/>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !title.trim() || !date}
              className="bg-[#f97316] text-white font-bold rounded-xl px-5 py-2.5 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
              {saving ? 'Adding...' : 'Add Event ✦'}
            </button>
          </div>
        </form>
      </div>

      {/* Upcoming */}
      {!loading && upcomingEvents.length > 0 && view !== 'year' && (
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-serif italic text-[#f97316] text-sm">Upcoming</span>
            <div className="flex-1 h-px bg-[#e8e2d8]" />
          </div>
          <div className="flex flex-col gap-2">
            {upcomingEvents.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 border border-[#e8e2d8] rounded-xl px-4 py-3 hover:border-[#fed7aa] transition-colors">
                <span className="font-mono text-[10px] text-[#9a8f7e] min-w-17.5">{ev.date}</span>
                <span className="font-mono text-[10px] text-[#c2500f] min-w-12.5">{ev.time || 'All day'}</span>
                <span className="flex-1 text-sm font-semibold">{ev.title}</span>
                <button onClick={() => handleDelete(ev.id, ev.title)} className="text-[#c5bdb0] hover:text-red-500 text-sm">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="text-center py-12 text-[#c5bdb0] text-sm">Loading your calendar...</div>}
    </div>
  )
}