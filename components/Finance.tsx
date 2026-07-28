"use client";

import { useState, useEffect } from "react";
import {
  getFinanceEntries,
  addFinanceEntry,
  deleteFinanceEntry,
  getRecurringRules,
  addRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  generateDueRecurring,
  type FinanceEntry,
  type RecurringRule,
} from "@/lib/database";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Props = {
  userId: string;
  onAction: (msg: string) => void;
  refreshKey?: number;
  viewMonth?: number;
  viewYear?: number;
  onViewChange?: (month: number, year: number) => void;
};

const CATEGORIES = [
  "Food",
  "Transport",
  "Education",
  "Entertainment",
  "Salary",
  "Freelance",
  "Utilities",
  "Shopping",
  "Other",
];

const ACCOUNTS = ["Maybank", "MAE", "Grab", "GXBank", "TnG", "Wallet", "ASB"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const NEEDS_CATS = ["Food", "Transport", "Utilities", "Education"];
const WANTS_CATS = ["Entertainment", "Shopping"];

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f97316",
  Transport: "#3b82f6",
  Education: "#8b5cf6",
  Entertainment: "#ec4899",
  Salary: "#16a34a",
  Freelance: "#0d9488",
  Utilities: "#f59e0b",
  Shopping: "#ef4444",
  Other: "#9a8f7e",
};

const ACCOUNT_COLORS: Record<string, string> = {
  Maybank: "#f97316",
  MAE: "#3b82f6",
  Grab: "#16a34a",
  GXBank: "#8b5cf6",
  TnG: "#0d9488",
  Wallet: "#9a8f7e",
  ASB: "#f59e0b",
};

type TabMode = "tracker" | "analytics";

export default function Finance({
  userId,
  onAction,
  refreshKey,
  viewMonth: controlledMonth,
  viewYear: controlledYear,
  onViewChange,
}: Props) {
  const [allEntries, setAllEntries] = useState<FinanceEntry[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [tab, setTab] = useState<TabMode>("tracker");

  const today = new Date();
  const [localMonth, setLocalMonth] = useState(today.getMonth());
  const [localYear, setLocalYear] = useState(today.getFullYear());

  const viewMonth = controlledMonth ?? localMonth;
  const viewYear = controlledYear ?? localYear;

  // Form state
  const [type, setType] = useState<"income" | "expense">("expense");
  const [description, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [account, setAccount] = useState("Wallet");
  const [date, setDate] = useState(today.toISOString().split("T")[0]);
  const [repeat, setRepeat] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState(today.getDate());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  // Track resolved accent hex for Recharts SVG props (which don't support CSS vars)
  const [accentHex, setAccentHex] = useState("#f97316");
  useEffect(() => {
    function syncAccent() {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      if (v) setAccentHex(v);
    }
    syncAccent();
    window.addEventListener("tyunnie-accent-changed", syncAccent);
    return () => window.removeEventListener("tyunnie-accent-changed", syncAccent);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Catch-up on load: materialise any recurring entries now due, THEN read.
      await generateDueRecurring(userId);
      const [entries, recurringRules] = await Promise.all([
        getFinanceEntries(userId),
        getRecurringRules(userId),
      ]);
      if (cancelled) return;
      setAllEntries(entries);
      setRules(recurringRules);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  // ── MONTH HELPERS ──
  function navMonth(dir: number) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m > 11) {
      m = 0;
      y++;
    }
    if (m < 0) {
      m = 11;
      y--;
    }
    if (onViewChange) onViewChange(m, y);
    else {
      setLocalMonth(m);
      setLocalYear(y);
    }
  }

  function jumpToToday() {
    if (onViewChange) onViewChange(today.getMonth(), today.getFullYear());
    else {
      setLocalMonth(today.getMonth());
      setLocalYear(today.getFullYear());
    }
  }

  function isCurrentMonth() {
    return viewMonth === today.getMonth() && viewYear === today.getFullYear();
  }

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthEntries = allEntries.filter((e) => e.date.startsWith(monthPrefix));

  const monthIncome = monthEntries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);
  const monthExpenses = monthEntries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const monthBalance = monthIncome - monthExpenses;
  const carriedBalance = allEntries
    .filter((e) => e.date < monthPrefix)
    .reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0);

  const runningBalance = carriedBalance + monthBalance;

  // Apply both type filter and account filter
  const filtered = monthEntries
    .filter((e) => filter === "all" || e.type === filter)
    .filter((e) => accountFilter === "all" || e.account === accountFilter);

  // ── ANALYTICS DATA ──
  const expenseEntries = monthEntries.filter((e) => e.type === "expense");

  const categoryTotals = CATEGORIES.reduce(
    (acc, cat) => {
      const total = expenseEntries
        .filter((e) => e.category === cat)
        .reduce((s, e) => s + e.amount, 0);
      if (total > 0)
        acc.push({ name: cat, value: total, color: CATEGORY_COLORS[cat] });
      return acc;
    },
    [] as { name: string; value: number; color: string }[],
  );

  // Account breakdown — income and expense per account
  const accountTotals = ACCOUNTS.reduce(
    (acc, acct) => {
      const acctEntries = monthEntries.filter((e) => e.account === acct);
      const income = acctEntries
        .filter((e) => e.type === "income")
        .reduce((s, e) => s + e.amount, 0);
      const expenses = acctEntries
        .filter((e) => e.type === "expense")
        .reduce((s, e) => s + e.amount, 0);
      if (income > 0 || expenses > 0)
        acc.push({
          name: acct,
          income,
          expenses,
          balance: income - expenses,
          color: ACCOUNT_COLORS[acct],
        });
      return acc;
    },
    [] as {
      name: string;
      income: number;
      expenses: number;
      balance: number;
      color: string;
    }[],
  );

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    let m = viewMonth - (5 - i);
    let y = viewYear;
    if (m < 0) {
      m += 12;
      y--;
    }
    const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
    const entries = allEntries.filter((e) => e.date.startsWith(prefix));
    return {
      name: MONTHS[m].slice(0, 3),
      Income: entries
        .filter((e) => e.type === "income")
        .reduce((s, e) => s + e.amount, 0),
      Expenses: entries
        .filter((e) => e.type === "expense")
        .reduce((s, e) => s + e.amount, 0),
    };
  });

  // 50/30/20 rule
  const needsSpent = expenseEntries
    .filter((e) => NEEDS_CATS.includes(e.category))
    .reduce((s, e) => s + e.amount, 0);
  const wantsSpent = expenseEntries
    .filter((e) => WANTS_CATS.includes(e.category))
    .reduce((s, e) => s + e.amount, 0);
  const savingsAmt = monthBalance;
  const needsTarget = monthIncome * 0.5;
  const wantsTarget = monthIncome * 0.3;
  const savingsTarget = monthIncome * 0.2;

  function ruleColor(actual: number, target: number, inverse = false) {
    const ratio = target > 0 ? actual / target : 0;
    if (inverse) return ratio >= 1 ? "#16a34a" : "#f97316";
    return ratio <= 1 ? "#16a34a" : "#ef4444";
  }

  // ── HANDLERS ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!description.trim() || isNaN(parsed) || parsed <= 0) return;
    setSaving(true);

    if (repeat) {
      // Create a monthly rule, then materialise any occurrence already due.
      const rule = await addRecurringRule(userId, {
        type,
        description: description.trim(),
        amount: parsed,
        category,
        account,
        day_of_month: dayOfMonth,
      });
      if (rule) {
        await generateDueRecurring(userId);
        const [entries, recurringRules] = await Promise.all([
          getFinanceEntries(userId),
          getRecurringRules(userId),
        ]);
        setAllEntries(entries);
        setRules(recurringRules);
        onAction(
          `Recurring ${type} set — ${description.trim()} (RM${parsed.toFixed(2)}) on day ${dayOfMonth} each month ↻`,
        );
        setDesc("");
        setAmount("");
        setRepeat(false);
      }
      setSaving(false);
      return;
    }

    const newEntry = await addFinanceEntry(userId, {
      type,
      description: description.trim(),
      amount: parsed,
      category,
      account,
      date,
    });
    if (newEntry) {
      setAllEntries((prev) => [newEntry, ...prev]);
      onAction(
        type === "income"
          ? `Income added! RM${parsed.toFixed(2)} from ${description} to ${account} 💰`
          : `Expense logged — RM${parsed.toFixed(2)} on ${description} from ${account}.`,
      );
      setDesc("");
      setAmount("");
      setDate(today.toISOString().split("T")[0]);
    }
    setSaving(false);
  }

  async function togglePauseRule(rule: RecurringRule) {
    const next = !rule.active;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, active: next } : r)),
    );
    await updateRecurringRule(rule.id, { active: next });
    // Resuming a paused rule may leave a gap to backfill.
    if (next) {
      await generateDueRecurring(userId);
      const [entries, recurringRules] = await Promise.all([
        getFinanceEntries(userId),
        getRecurringRules(userId),
      ]);
      setAllEntries(entries);
      setRules(recurringRules);
    }
  }

  async function handleDeleteRule(rule: RecurringRule) {
    const confirmed = window.confirm(
      `Delete recurring "${rule.description}"? Entries already logged stay; no new ones will be added.`,
    );
    if (!confirmed) return;
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    await deleteRecurringRule(rule.id);
    onAction(`Recurring "${rule.description}" removed.`);
  }

  async function handleDelete(id: string, entry: FinanceEntry) {
    const confirmed = window.confirm(
      `Delete "${entry.description}" (${entry.type === "income" ? "+" : "-"}RM${entry.amount.toFixed(2)})? This can't be undone.`,
    );
    if (!confirmed) return;
    await deleteFinanceEntry(id);
    setAllEntries((prev) => prev.filter((e) => e.id !== id));
    onAction(`Removed "${entry.description}" from your finance tracker.`);
  }

  async function handleReset() {
    const confirmed = window.confirm(
      `Delete all entries for ${MONTHS[viewMonth]} ${viewYear}? This can't be undone.`,
    );
    if (!confirmed) return;
    setResetting(true);
    await Promise.all(monthEntries.map((e) => deleteFinanceEntry(e.id)));
    setAllEntries((prev) =>
      prev.filter((e) => !e.date.startsWith(monthPrefix)),
    );
    onAction(
      `Reset complete — all entries for ${MONTHS[viewMonth]} ${viewYear} cleared.`,
    );
    setResetting(false);
  }

  // ── RENDER ──
  return (
    <div>
      {/* Month navigation */}
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
        {/* Title row — arrows always flank the month name */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navMonth(-1)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e2d8] bg-[#f3f0ea] hover:border-(--accent) hover:text-(--accent) transition-colors text-lg"
          >
            ‹
          </button>
          <h2 className="flex-1 font-serif italic text-xl text-[#111010] text-center truncate">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
          <button
            onClick={() => navMonth(1)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[#e8e2d8] bg-[#f3f0ea] hover:border-(--accent) hover:text-(--accent) transition-colors text-lg"
          >
            ›
          </button>
        </div>
        {/* Actions — wrap to their own row below so they never crowd the title */}
        {(!isCurrentMonth() || monthEntries.length > 0) && (
          <div className="flex items-center justify-center gap-2 mt-3">
            {!isCurrentMonth() && (
              <button
                onClick={jumpToToday}
                className="px-3 py-1.5 rounded-lg border border-[#e8e2d8] text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] hover:border-(--accent) hover:text-(--accent) transition-colors font-mono"
              >
                Today
              </button>
            )}
            {monthEntries.length > 0 && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-3 py-1.5 rounded-lg border border-red-200 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-colors font-mono disabled:opacity-40"
              >
                {resetting ? "Resetting..." : "Reset Month"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5">
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-3 sm:p-5 text-center">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-2">
            Income
          </div>
          <div className="font-serif italic text-lg sm:text-2xl md:text-3xl text-[#16a34a] tabular-nums break-words">
            <span className="text-[0.6em] not-italic opacity-70 mr-0.5">RM</span>
            {monthIncome.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-3 sm:p-5 text-center">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-2">
            Expenses
          </div>
          <div className="font-serif italic text-lg sm:text-2xl md:text-3xl text-red-500 tabular-nums break-words">
            <span className="text-[0.6em] not-italic opacity-70 mr-0.5">RM</span>
            {monthExpenses.toFixed(2)}
          </div>
        </div>
        <div className="bg-(--accent) border border-(--accent) rounded-2xl p-3 sm:p-5 text-center">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/70 font-mono mb-2">
            Balance
          </div>
          <div className="font-serif italic text-lg sm:text-2xl md:text-3xl text-white tabular-nums break-words">
            <span className="text-[0.6em] not-italic opacity-70 mr-0.5">RM</span>
            {runningBalance.toFixed(2)}
          </div>
          {carriedBalance !== 0 && (
            <div className="text-[9px] sm:text-[10px] text-white/60 font-mono mt-1">
              {carriedBalance >= 0 ? "+" : ""}RM {carriedBalance.toFixed(2)}{" "}
              carried · RM {monthBalance.toFixed(2)} this month
            </div>
          )}
        </div>
      </div>

      {/* Account balance pills */}
      {accountTotals.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {accountTotals.map((acct) => (
            <div
              key={acct.name}
              className="flex items-center gap-2 bg-white border border-[#e8e2d8] rounded-xl px-3 py-2"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: acct.color }}
              />
              <span className="text-[11px] font-bold text-[#111010]">
                {acct.name}
              </span>
              <span
                className={`text-[11px] font-mono font-bold ${acct.balance >= 0 ? "text-[#16a34a]" : "text-red-500"}`}
              >
                {acct.balance >= 0 ? "+" : ""}RM {acct.balance.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab("tracker")}
          className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
            tab === "tracker"
              ? "bg-(--accent) text-white"
              : "bg-white border border-[#e8e2d8] text-[#9a8f7e] hover:border-(--accent) hover:text-(--accent)"
          }`}
        >
          Tracker
        </button>
        <button
          onClick={() => setTab("analytics")}
          className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
            tab === "analytics"
              ? "bg-(--accent) text-white"
              : "bg-white border border-[#e8e2d8] text-[#9a8f7e] hover:border-(--accent) hover:text-(--accent)"
          }`}
        >
          Analytics
        </button>
      </div>

      {/* ── TRACKER TAB ── */}
      {tab === "tracker" && (
        <>
          {/* Add entry form */}
          <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-serif italic text-(--accent) text-sm">
                New Entry
              </span>
              <div className="flex-1 h-px bg-[#e8e2d8]" />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                    type === "income"
                      ? "bg-[#16a34a] text-white"
                      : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#16a34a] hover:text-[#16a34a]"
                  }`}
                >
                  + Income
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                    type === "expense"
                      ? "bg-red-500 text-white"
                      : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-red-400 hover:text-red-500"
                  }`}
                >
                  − Expense
                </button>
              </div>
              <div className="flex gap-3 mb-3">
                <div className="flex-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="e.g. Lunch at mamak"
                    required
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-(--accent) transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                    Amount (RM)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-(--accent) transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-(--accent) transition-colors"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                    Account
                  </label>
                  <select
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-(--accent) transition-colors"
                  >
                    {ACCOUNTS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-(--accent) transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Repeat monthly toggle + day picker */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRepeat((v) => !v)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all ${
                      repeat
                        ? "bg-(--accent) text-white"
                        : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-(--accent) hover:text-(--accent)"
                    }`}
                  >
                    <span>↻</span> Repeat monthly
                  </button>
                  {repeat && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-[#9a8f7e]">
                        on day
                      </span>
                      <select
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(Number(e.target.value))}
                        className="bg-[#faf8f5] border border-[#e8e2d8] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-(--accent) transition-colors"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={saving || !description.trim() || !amount}
                  className="bg-(--accent) text-white font-bold rounded-xl px-5 py-2.5 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {saving
                    ? "Saving..."
                    : repeat
                      ? "Save Recurring ↻"
                      : "Add Entry ✦"}
                </button>
              </div>
              {repeat && (
                <p className="text-[10px] text-[#9a8f7e] font-mono mt-2">
                  Auto-logs RM{amount || "0.00"} on day {dayOfMonth} every month
                  (clamped to the last day for short months).
                </p>
              )}
            </form>
          </div>

          {/* Recurring rules list */}
          {rules.length > 0 && (
            <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-serif italic text-(--accent) text-sm">
                  Recurring ↻
                </span>
                <div className="flex-1 h-px bg-[#e8e2d8]" />
                <span className="text-[10px] font-mono text-[#9a8f7e]">
                  {rules.filter((r) => r.active).length} active
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-3 border border-[#e8e2d8] rounded-xl px-4 py-3 transition-colors group ${
                      rule.active ? "" : "opacity-50"
                    }`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${rule.type === "income" ? "bg-[#16a34a]" : "bg-red-500"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#111010] truncate">
                        {rule.description}
                      </div>
                      <div className="text-[10px] text-[#9a8f7e] font-mono mt-0.5">
                        {rule.category} · day {rule.day_of_month} ·{" "}
                        {rule.account}
                        {!rule.active && " · paused"}
                      </div>
                    </div>
                    <div
                      className={`font-serif italic text-base font-semibold shrink-0 ${rule.type === "income" ? "text-[#16a34a]" : "text-red-500"}`}
                    >
                      {rule.type === "income" ? "+" : "−"}RM{" "}
                      {rule.amount.toFixed(2)}
                    </div>
                    <button
                      onClick={() => togglePauseRule(rule)}
                      className="text-[10px] font-bold uppercase tracking-wide text-[#9a8f7e] hover:text-(--accent) transition-colors shrink-0"
                      title={rule.active ? "Pause" : "Resume"}
                    >
                      {rule.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule)}
                      aria-label={`Delete recurring ${rule.description}`}
                      className="text-[#c5bdb0] hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter + entry list */}
          <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
            {/* Type filter */}
            <div className="flex items-center gap-2 mb-3">
              {(["all", "income", "expense"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                    filter === f
                      ? "bg-(--accent) text-white"
                      : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-(--accent) hover:text-(--accent)"
                  }`}
                >
                  {f}
                </button>
              ))}
              <div className="flex-1 h-px bg-[#e8e2d8]" />
              <span className="text-[10px] font-mono text-[#9a8f7e]">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            {/* Account filter */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setAccountFilter("all")}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                  accountFilter === "all"
                    ? "bg-[#111010] text-white"
                    : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#111010] hover:text-[#111010]"
                }`}
              >
                All accounts
              </button>
              {ACCOUNTS.filter((a) =>
                monthEntries.some((e) => e.account === a),
              ).map((a) => (
                <button
                  key={a}
                  onClick={() => setAccountFilter(a)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 ${
                    accountFilter === a
                      ? "text-white"
                      : "bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e]"
                  }`}
                  style={
                    accountFilter === a
                      ? {
                          background: ACCOUNT_COLORS[a],
                          borderColor: ACCOUNT_COLORS[a],
                        }
                      : {}
                  }
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background:
                        accountFilter === a ? "white" : ACCOUNT_COLORS[a],
                    }}
                  />
                  {a}
                </button>
              ))}
            </div>

            {loading && (
              <div className="text-center py-12 text-[#c5bdb0] text-sm">
                Loading your finances...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-12 text-[#c5bdb0]">
                <div className="text-3xl mb-3 opacity-50">💰</div>
                <p className="text-sm">
                  No entries for {MONTHS[viewMonth]} {viewYear}.
                </p>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="flex flex-col gap-2">
                {filtered.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 border border-[#e8e2d8] rounded-xl px-4 py-3 transition-colors group hover:border-[#fed7aa]"
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${entry.type === "income" ? "bg-[#16a34a]" : "bg-red-500"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#111010] truncate flex items-center gap-1.5">
                        {entry.recurring_id && (
                          <span
                            className="text-(--accent) shrink-0"
                            title="Auto-logged from a recurring rule"
                          >
                            ↻
                          </span>
                        )}
                        <span className="truncate">{entry.description}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#9a8f7e] font-mono">
                          {entry.category} · {entry.date}
                        </span>
                        {entry.account && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{
                              background:
                                ACCOUNT_COLORS[entry.account] ?? "#9a8f7e",
                            }}
                          >
                            {entry.account}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`font-serif italic text-base font-semibold shrink-0 ${entry.type === "income" ? "text-[#16a34a]" : "text-red-500"}`}
                    >
                      {entry.type === "income" ? "+" : "−"}RM{" "}
                      {entry.amount.toFixed(2)}
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id, entry)}
                      aria-label={`Delete ${entry.description}`}
                      className="text-[#c5bdb0] hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === "analytics" && (
        <div className="flex flex-col gap-5">
          {monthIncome === 0 && monthExpenses === 0 ? (
            <div className="bg-white border border-[#e8e2d8] rounded-2xl p-10 text-center text-[#c5bdb0]">
              <div className="text-4xl mb-3 opacity-40">📊</div>
              <p className="text-sm">
                No data for {MONTHS[viewMonth]} {viewYear}. Add some entries
                first.
              </p>
            </div>
          ) : (
            <>
              {/* ── 6-Month Bar Chart ── */}
              <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-5">
                  <span className="font-serif italic text-(--accent) text-sm">
                    6-Month Overview
                  </span>
                  <div className="flex-1 h-px bg-[#e8e2d8]" />
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={last6Months} barCategoryGap="30%">
                    <XAxis
                      dataKey="name"
                      tick={{
                        fontSize: 10,
                        fontFamily: "monospace",
                        fill: "#9a8f7e",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 10,
                        fontFamily: "monospace",
                        fill: "#9a8f7e",
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `RM${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1a1a1a",
                        border: "1px solid #2a2520",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      labelStyle={{ color: accentHex, fontWeight: 700 }}
                      itemStyle={{ color: "#e8ddd0" }}
                      formatter={(v) => [`RM ${Number(v ?? 0).toFixed(2)}`, ""]}
                    />
                    <Bar
                      dataKey="Income"
                      fill="#16a34a"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="Expenses"
                      fill={accentHex}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[#16a34a]" />
                    <span className="text-[10px] font-mono text-[#9a8f7e]">
                      Income
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-(--accent)" />
                    <span className="text-[10px] font-mono text-[#9a8f7e]">
                      Expenses
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Account Breakdown ── */}
              {accountTotals.length > 0 && (
                <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-serif italic text-(--accent) text-sm">
                      By Account
                    </span>
                    <div className="flex-1 h-px bg-[#e8e2d8]" />
                  </div>
                  <div className="flex flex-col gap-4">
                    {accountTotals
                      .sort(
                        (a, b) => b.income + b.expenses - a.income - a.expenses,
                      )
                      .map((acct) => (
                        <div key={acct.name}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: acct.color }}
                              />
                              <span className="text-sm font-bold text-[#111010]">
                                {acct.name}
                              </span>
                            </div>
                            <span
                              className={`font-mono text-xs font-bold ${acct.balance >= 0 ? "text-[#16a34a]" : "text-red-500"}`}
                            >
                              {acct.balance >= 0 ? "+" : ""}RM{" "}
                              {acct.balance.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {acct.income > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-[#9a8f7e] w-14 shrink-0">
                                  Income
                                </span>
                                <div className="flex-1 h-1.5 bg-[#f3f0ea] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#16a34a]"
                                    style={{
                                      width: `${monthIncome > 0 ? (acct.income / monthIncome) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-[9px] font-mono text-[#16a34a] w-20 text-right shrink-0">
                                  RM {acct.income.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {acct.expenses > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-[#9a8f7e] w-14 shrink-0">
                                  Expenses
                                </span>
                                <div className="flex-1 h-1.5 bg-[#f3f0ea] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${monthExpenses > 0 ? (acct.expenses / monthExpenses) * 100 : 0}%`,
                                      background: acct.color,
                                    }}
                                  />
                                </div>
                                <span className="text-[9px] font-mono text-[#9a8f7e] w-20 text-right shrink-0">
                                  RM {acct.expenses.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ── Category Breakdown ── */}
              {categoryTotals.length > 0 && (
                <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-serif italic text-(--accent) text-sm">
                      Spending by Category
                    </span>
                    <div className="flex-1 h-px bg-[#e8e2d8]" />
                  </div>
                  <div className="flex gap-6 items-center">
                    <div className="shrink-0">
                      <ResponsiveContainer width={180} height={180}>
                        <PieChart>
                          <Pie
                            data={categoryTotals}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            paddingAngle={2}
                          >
                            {categoryTotals.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "#1a1a1a",
                              border: "1px solid #2a2520",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                            itemStyle={{ color: "#e8ddd0" }}
                            formatter={(v) => [
                              `RM ${Number(v ?? 0).toFixed(2)}`,
                              "",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      {categoryTotals
                        .sort((a, b) => b.value - a.value)
                        .map((cat) => (
                          <div
                            key={cat.name}
                            className="flex items-center gap-3"
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: cat.color }}
                            />
                            <span className="text-xs font-semibold text-[#111010] w-24 shrink-0">
                              {cat.name}
                            </span>
                            <div className="flex-1 h-1.5 bg-[#f3f0ea] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(cat.value / monthExpenses) * 100}%`,
                                  background: cat.color,
                                }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-[#9a8f7e] shrink-0 w-20 text-right">
                              RM {cat.value.toFixed(2)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 50/30/20 Rule ── */}
              <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-serif italic text-(--accent) text-sm">
                    50 / 30 / 20 Rule
                  </span>
                  <div className="flex-1 h-px bg-[#e8e2d8]" />
                </div>
                <p className="text-[10px] text-[#9a8f7e] font-mono mb-5">
                  Based on your income of RM {monthIncome.toFixed(2)} this month
                </p>

                {monthIncome === 0 ? (
                  <p className="text-sm text-[#c5bdb0] text-center py-4">
                    Add income entries to see the breakdown.
                  </p>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* Needs */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <span className="text-sm font-bold text-[#111010]">
                            Needs
                          </span>
                          <span className="text-[10px] text-[#9a8f7e] font-mono ml-2">
                            Food · Transport · Utilities · Education
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{
                              color: ruleColor(needsSpent, needsTarget),
                            }}
                          >
                            RM {needsSpent.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-[#9a8f7e] font-mono">
                            {" "}
                            / RM {needsTarget.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-10 shrink-0">
                            Target
                          </span>
                          <div className="flex-1 h-2 bg-[#f3f0ea] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#e8e2d8]"
                              style={{ width: "50%" }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-8 text-right">
                            50%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-10 shrink-0">
                            Actual
                          </span>
                          <div className="flex-1 h-2 bg-[#f3f0ea] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (needsSpent / monthIncome) * 100)}%`,
                                background: ruleColor(needsSpent, needsTarget),
                              }}
                            />
                          </div>
                          <span
                            className="text-[9px] font-mono w-8 text-right"
                            style={{
                              color: ruleColor(needsSpent, needsTarget),
                            }}
                          >
                            {((needsSpent / monthIncome) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-[#f3f0ea]" />

                    {/* Wants */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <span className="text-sm font-bold text-[#111010]">
                            Wants
                          </span>
                          <span className="text-[10px] text-[#9a8f7e] font-mono ml-2">
                            Entertainment · Shopping
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{
                              color: ruleColor(wantsSpent, wantsTarget),
                            }}
                          >
                            RM {wantsSpent.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-[#9a8f7e] font-mono">
                            {" "}
                            / RM {wantsTarget.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-10 shrink-0">
                            Target
                          </span>
                          <div className="flex-1 h-2 bg-[#f3f0ea] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#e8e2d8]"
                              style={{ width: "30%" }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-8 text-right">
                            30%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-10 shrink-0">
                            Actual
                          </span>
                          <div className="flex-1 h-2 bg-[#f3f0ea] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (wantsSpent / monthIncome) * 100)}%`,
                                background: ruleColor(wantsSpent, wantsTarget),
                              }}
                            />
                          </div>
                          <span
                            className="text-[9px] font-mono w-8 text-right"
                            style={{
                              color: ruleColor(wantsSpent, wantsTarget),
                            }}
                          >
                            {((wantsSpent / monthIncome) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-[#f3f0ea]" />

                    {/* Savings */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <span className="text-sm font-bold text-[#111010]">
                            Savings
                          </span>
                          <span className="text-[10px] text-[#9a8f7e] font-mono ml-2">
                            Income minus all expenses
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{
                              color: ruleColor(savingsAmt, savingsTarget, true),
                            }}
                          >
                            RM {savingsAmt.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-[#9a8f7e] font-mono">
                            {" "}
                            / RM {savingsTarget.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-10 shrink-0">
                            Target
                          </span>
                          <div className="flex-1 h-2 bg-[#f3f0ea] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#e8e2d8]"
                              style={{ width: "20%" }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-8 text-right">
                            20%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-[#9a8f7e] w-10 shrink-0">
                            Actual
                          </span>
                          <div className="flex-1 h-2 bg-[#f3f0ea] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, (savingsAmt / monthIncome) * 100))}%`,
                                background: ruleColor(
                                  savingsAmt,
                                  savingsTarget,
                                  true,
                                ),
                              }}
                            />
                          </div>
                          <span
                            className="text-[9px] font-mono w-8 text-right"
                            style={{
                              color: ruleColor(savingsAmt, savingsTarget, true),
                            }}
                          >
                            {Math.max(
                              0,
                              (savingsAmt / monthIncome) * 100,
                            ).toFixed(0)}
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-3 mt-1">
                      <p className="text-[11px] text-[#9a8f7e] leading-relaxed">
                        {needsSpent > needsTarget
                          ? `⚠️ You've exceeded your needs budget by RM${(needsSpent - needsTarget).toFixed(2)}.`
                          : `✅ Needs spending is within the 50% target.`}{" "}
                        {savingsAmt >= savingsTarget
                          ? `You're on track with savings 🧡`
                          : `You need RM${(savingsTarget - savingsAmt).toFixed(2)} more in savings to hit 20%.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
