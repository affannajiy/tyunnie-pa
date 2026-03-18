// components/panels/Finance.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  getFinanceEntries,
  addFinanceEntry,
  deleteFinanceEntry,
  getFinanceSummary,
  type FinanceEntry
} from '@/lib/database'

type Props = {
  userId: string
  onAction: (msg: string) => void
  refreshKey?: number
}

const CATEGORIES = [
  'Food', 'Transport', 'Education', 'Entertainment',
  'Salary', 'Freelance', 'Utilities', 'Shopping', 'Other'
]

export default function Finance({ userId, onAction, refreshKey }: Props) {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [summary, setSummary] = useState({ income: 0, expenses: 0, balance: 0 })
  const [loading, setLoading] = useState(true)

  // Form state
  const [type, setType]         = useState<'income' | 'expense'>('expense')
  const [description, setDesc]  = useState('')
  const [amount, setAmount]     = useState('')
  const [category, setCategory] = useState('Food')
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving]     = useState(false)

  // Filter state
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')

  useEffect(() => {
    async function load() {
      const [data, sum] = await Promise.all([
        getFinanceEntries(userId),
        getFinanceSummary(userId)
      ])
      setEntries(data)
      setSummary(sum)
      setLoading(false)
    }
    load()
  }, [userId, refreshKey])

  // ── HANDLERS ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!description.trim() || isNaN(parsed) || parsed <= 0) return
    setSaving(true)

    const newEntry = await addFinanceEntry(userId, {
      type,
      description: description.trim(),
      amount: parsed,
      category,
      date
    })

    if (newEntry) {
      const updated = [newEntry, ...entries]
      setEntries(updated)

      // Recalculate summary locally — no need for another DB call
      const income   = updated.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
      const expenses = updated.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
      setSummary({ income, expenses, balance: income - expenses })

      onAction(
        type === 'income'
          ? `Income added! RM${parsed.toFixed(2)} from ${description}. Your balance is now RM${(summary.balance + parsed).toFixed(2)} 💰`
          : `Expense logged — RM${parsed.toFixed(2)} on ${description}.`
      )

      setDesc('')
      setAmount('')
      setDate(new Date().toISOString().split('T')[0])
    }
    setSaving(false)
  }

  async function handleDelete(id: string, entry: FinanceEntry) {
    await deleteFinanceEntry(id)
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)

    const income   = updated.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
    const expenses = updated.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
    setSummary({ income, expenses, balance: income - expenses })

    onAction(`Removed "${entry.description}" from your finance tracker.`)
  }

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter)

  // ── RENDER ──
  return (
    <div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-2">
            Income
          </div>
          <div className="font-serif italic text-3xl text-[#16a34a]">
            RM {summary.income.toFixed(2)}
          </div>
        </div>

        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-2">
            Expenses
          </div>
          <div className="font-serif italic text-3xl text-red-500">
            RM {summary.expenses.toFixed(2)}
          </div>
        </div>

        {/* Balance — orange highlight */}
        <div className="bg-[#f97316] border border-[#f97316] rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/70 font-mono mb-2">
            Balance
          </div>
          <div className="font-serif italic text-3xl text-white">
            RM {summary.balance.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Add entry form */}
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-serif italic text-[#f97316] text-sm">New Entry</span>
          <div className="flex-1 h-px bg-[#e8e2d8]" />
        </div>

        <form onSubmit={handleSubmit}>
          {/* Income / Expense toggle */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                type === 'income'
                  ? 'bg-[#16a34a] text-white'
                  : 'bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#16a34a] hover:text-[#16a34a]'
              }`}
            >
              + Income
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                type === 'expense'
                  ? 'bg-red-500 text-white'
                  : 'bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-red-400 hover:text-red-500'
              }`}
            >
              − Expense
            </button>
          </div>

          <div className="flex gap-3 mb-3">
            {/* Description */}
            <div className="flex-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDesc(e.target.value)}
                placeholder="e.g. Lunch at mamak"
                required
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              />
            </div>

            {/* Amount */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Amount (RM)
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            {/* Category */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !description.trim() || !amount}
              className="bg-[#f97316] text-white font-bold rounded-xl px-5 py-2.5 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {saving ? 'Saving...' : 'Add Entry ✦'}
            </button>
          </div>
        </form>
      </div>

      {/* Filter tabs + entry list */}
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                filter === f
                  ? 'bg-[#f97316] text-white'
                  : 'bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316]'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="flex-1 h-px bg-[#e8e2d8]" />
          <span className="text-[10px] font-mono text-[#9a8f7e]">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {loading && (
          <div className="text-center py-12 text-[#c5bdb0] text-sm">
            Loading your finances...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-[#c5bdb0]">
            <div className="text-3xl mb-3 opacity-50">💰</div>
            <p className="text-sm">No entries yet. Add your first one above!</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-2">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border border-[#e8e2d8] rounded-xl px-4 py-3 hover:border-[#e8e2d8] transition-colors group"
              >
                {/* Income / expense dot */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  entry.type === 'income' ? 'bg-[#16a34a]' : 'bg-red-500'
                }`} />

                {/* Description + category */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#111010] truncate">
                    {entry.description}
                  </div>
                  <div className="text-[10px] text-[#9a8f7e] font-mono">
                    {entry.category} · {entry.date}
                  </div>
                </div>

                {/* Amount */}
                <div className={`font-serif italic text-base font-semibold shrink-0 ${
                  entry.type === 'income' ? 'text-[#16a34a]' : 'text-red-500'
                }`}>
                  {entry.type === 'income' ? '+' : '−'}RM {entry.amount.toFixed(2)}
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(entry.id, entry)}
                  className="text-[#c5bdb0] hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}