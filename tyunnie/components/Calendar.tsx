// components/panels/Calendar.tsx
'use client'

import { useState, useEffect } from 'react'
import { getEvents, addEvent, deleteEvent, type Event } from '@/lib/database'

type Props = {
  userId: string
  onAction: (msg: string) => void  // tells Tyunnie what just happened
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function Calendar({ userId, onAction }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [calDate, setCalDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Add event form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)

  // Load events on mount
  useEffect(() => {
    getEvents(userId).then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [userId])

  // ── CALENDAR GRID LOGIC ──
  const year  = calDate.getFullYear()
  const month = calDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()  // 0 = Sun
  const daysInMonth     = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const todayStr = new Date().toISOString().split('T')[0]

  function toDateStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // Build the array of cells to render (prev month filler + current + next filler)
  const cells: { dateStr: string; currentMonth: boolean }[] = []

  // Trailing days from previous month
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({
      dateStr: toDateStr(year, month - 1, daysInPrevMonth - i),
      currentMonth: false
    })
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: toDateStr(year, month, d), currentMonth: true })
  }
  // Fill remaining cells to complete the last row
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        dateStr: toDateStr(year, month + 1, d),
        currentMonth: false
      })
    }
  }

  // ── HANDLERS ──
  function handleDayClick(dateStr: string) {
    setSelectedDate(prev => prev === dateStr ? null : dateStr)
    setDate(dateStr)
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)

    const newEvent = await addEvent(userId, { title: title.trim(), date, time })

    if (newEvent) {
      setEvents(prev => [...prev, newEvent].sort((a, b) => a.date.localeCompare(b.date)))
      onAction(`Got it! "${title}" is now on your calendar 📅`)
      setTitle('')
      setTime('')
    }
    setSaving(false)
  }

  async function handleDelete(id: string, eventTitle: string) {
    await deleteEvent(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    onAction(`Removed "${eventTitle}" from your calendar.`)
  }

  // ── DERIVED DATA ──
  const eventsOnSelected = selectedDate
    ? events.filter(e => e.date === selectedDate)
    : []

  const upcomingEvents = events
    .filter(e => e.date >= todayStr)
    .slice(0, 6)

  const eventDates = new Set(events.map(e => e.date))

  // ── RENDER ──
  return (
    <div>

      {/* Calendar card */}
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-6 mb-5">

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setCalDate(new Date(year, month - 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e2d8] bg-[#f3f0ea] hover:border-[#f97316] hover:text-[#f97316] transition-colors text-lg"
          >
            ‹
          </button>
          <h2 className="font-serif italic text-2xl text-[#111010]">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={() => setCalDate(new Date(year, month + 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e2d8] bg-[#f3f0ea] hover:border-[#f97316] hover:text-[#f97316] transition-colors text-lg"
          >
            ›
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map(({ dateStr, currentMonth }) => {
            const isToday    = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const hasEvent   = eventDates.has(dateStr)
            const dayNum     = parseInt(dateStr.split('-')[2])

            return (
              <button
                key={dateStr}
                onClick={() => currentMonth && handleDayClick(dateStr)}
                className={`
                  aspect-square rounded-xl flex flex-col items-center justify-center
                  text-sm font-medium transition-all gap-0.5 min-h-[40px]
                  ${!currentMonth ? 'opacity-25 cursor-default' : 'cursor-pointer'}
                  ${isSelected
                    ? 'bg-[#f97316] text-white'
                    : isToday
                    ? 'bg-[#fff0e6] border border-[#fed7aa] text-[#c2500f] font-bold'
                    : currentMonth
                    ? 'hover:bg-[#f3f0ea] hover:border hover:border-[#e8e2d8]'
                    : ''
                  }
                `}
              >
                {dayNum}
                {hasEvent && (
                  <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#f97316]'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Events on selected day */}
      {selectedDate && (
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#f97316]">
              {selectedDate}
            </span>
            <div className="flex-1 h-px bg-[#e8e2d8]" />
          </div>

          {eventsOnSelected.length === 0 ? (
            <p className="text-sm text-[#9a8f7e] italic">No events on this day.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {eventsOnSelected.map(ev => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 bg-[#fff0e6] border border-[#fed7aa] border-l-4 border-l-[#f97316] rounded-lg px-4 py-3"
                >
                  <span className="font-mono text-[10px] text-[#c2500f] min-w-[50px]">
                    {ev.time || 'All day'}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[#111010]">
                    {ev.title}
                  </span>
                  <button
                    onClick={() => handleDelete(ev.id, ev.title)}
                    className="text-[#c5bdb0] hover:text-red-500 transition-colors text-sm"
                  >
                    ✕
                  </button>
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
            {/* Title */}
            <div className="flex-[2]">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Event name"
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              />
            </div>

            {/* Date */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              />
            </div>

            {/* Time */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Time
              </label>
              <input
                type="text"
                value={time}
                onChange={e => setTime(e.target.value)}
                placeholder="e.g. 8:00 PM"
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !title.trim() || !date}
              className="bg-[#f97316] text-white font-bold rounded-xl px-5 py-2.5 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {saving ? 'Adding...' : 'Add Event ✦'}
            </button>
          </div>
        </form>
      </div>

      {/* Upcoming events list */}
      {!loading && upcomingEvents.length > 0 && (
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-serif italic text-[#f97316] text-sm">Upcoming</span>
            <div className="flex-1 h-px bg-[#e8e2d8]" />
          </div>

          <div className="flex flex-col gap-2">
            {upcomingEvents.map(ev => (
              <div
                key={ev.id}
                className="flex items-center gap-3 border border-[#e8e2d8] rounded-xl px-4 py-3 hover:border-[#fed7aa] transition-colors"
              >
                <span className="font-mono text-[10px] text-[#9a8f7e] min-w-[70px]">
                  {ev.date}
                </span>
                <span className="font-mono text-[10px] text-[#c2500f] min-w-[50px]">
                  {ev.time || 'All day'}
                </span>
                <span className="flex-1 text-sm font-semibold text-[#111010]">
                  {ev.title}
                </span>
                <button
                  onClick={() => handleDelete(ev.id, ev.title)}
                  className="text-[#c5bdb0] hover:text-red-500 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-[#c5bdb0] text-sm">
          Loading your calendar...
        </div>
      )}

    </div>
  )
}