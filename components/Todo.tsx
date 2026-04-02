// components/panels/Todo.tsx
"use client";

import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  getTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  type Todo,
} from "@/lib/database";

type Props = {
  userId: string;
  onAction: (msg: string) => void;
  refreshKey?: number;
};

const TAGS = [
  {
    value: "cs",
    label: "CS / Code",
    className: "bg-blue-50 text-blue-500 border-blue-200",
  },
  {
    value: "write",
    label: "Writing",
    className: "bg-[#fff0e6] text-[#c2500f] border-[#fed7aa]",
  },
  {
    value: "personal",
    label: "Personal",
    className: "bg-purple-50 text-purple-500 border-purple-200",
  },
  {
    value: "other",
    label: "Other",
    className: "bg-[#f3f0ea] text-[#9a8f7e] border-[#e8e2d8]",
  },
];

function getTagStyle(value: string) {
  return TAGS.find((t) => t.value === value)?.className ?? TAGS[3].className;
}

function getTagLabel(value: string) {
  return TAGS.find((t) => t.value === value)?.label ?? value;
}

export default function Todo({ userId, onAction, refreshKey }: Props) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [text, setText] = useState("");
  const [tag, setTag] = useState<Todo["tag"]>("cs");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");

  useEffect(() => {
    getTodos(userId).then((data) => {
      setTodos(data);
      setLoading(false);
    });
  }, [userId, refreshKey]);

  // ── HANDLERS ──
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);

    const newTodo = await addTodo(userId, {
      text: text.trim(),
      tag,
      due: due || null,
    });

    if (newTodo) {
      setTodos((prev) => [newTodo, ...prev]);
      onAction(`Task added — "${text}". Let's get it done 🧡`);
      setText("");
      setDue("");
    }
    setSaving(false);
  }

  async function handleToggle(id: string, currentDone: boolean) {
    const newDone = !currentDone;
    await toggleTodo(id, newDone);
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: newDone } : t)),
    );
    if (newDone) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#f97316", "#fed7aa", "#c2500f", "#fff0e6"],
      });
      onAction("Yes!! One down — you're unstoppable 🔥");
    }
  }

  async function handleDelete(id: string, todoText: string) {
    await deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    onAction(`Removed "${todoText}" from your tasks.`);
  }

  // ── DERIVED ──
  const filtered = todos.filter((t) => {
    if (filter === "pending") return !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  const pendingCount = todos.filter((t) => !t.done).length;
  const doneCount = todos.filter((t) => t.done).length;

  // Is a due date overdue?
  function isOverdue(due: string | null) {
    if (!due) return false;
    return new Date(due) < new Date(new Date().toDateString());
  }

  // ── RENDER ──
  return (
    <div>
      {/* Summary strip */}
      {!loading && todos.length > 0 && (
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-white border border-[#e8e2d8] rounded-2xl px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-1">
              Pending
            </div>
            <div className="font-serif italic text-3xl text-[#f97316]">
              {pendingCount}
            </div>
          </div>
          <div className="flex-1 bg-white border border-[#e8e2d8] rounded-2xl px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-1">
              Done
            </div>
            <div className="font-serif italic text-3xl text-[#16a34a]">
              {doneCount}
            </div>
          </div>
          <div className="flex-1 bg-white border border-[#e8e2d8] rounded-2xl px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-1">
              Total
            </div>
            <div className="font-serif italic text-3xl text-[#111010]">
              {todos.length}
            </div>
          </div>
        </div>
      )}

      {/* Add task form */}
      <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-serif italic text-[#f97316] text-sm">
            New Task
          </span>
          <div className="flex-1 h-px bg-[#e8e2d8]" />
        </div>

        <form onSubmit={handleAdd}>
          {/* Task text */}
          <div className="mb-3">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd(e);
              }}
              placeholder="What needs to be done?"
              className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          <div className="flex gap-3">
            {/* Tag */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Tag
              </label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value as Todo["tag"])}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              >
                {TAGS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Due Date (optional)
              </label>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              />
            </div>

            {/* Submit */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving || !text.trim()}
                className="bg-[#f97316] text-white font-bold rounded-xl px-5 py-2.5 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {saving ? "Adding..." : "Add ✦"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(["pending", "all", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all border ${
              filter === f
                ? "bg-[#f97316] text-white border-[#f97316]"
                : "bg-white text-[#9a8f7e] border-[#e8e2d8] hover:border-[#f97316] hover:text-[#f97316]"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="flex-1 h-px bg-[#e8e2d8]" />
        <span className="text-[10px] font-mono text-[#9a8f7e]">
          {filtered.length} {filtered.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Task list */}
      {loading && (
        <div className="text-center py-12 text-[#c5bdb0] text-sm">
          Loading your tasks...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-[#c5bdb0]">
          <div className="text-3xl mb-3 opacity-50">✅</div>
          <p className="text-sm">
            {filter === "done"
              ? "Nothing completed yet — get to it!"
              : filter === "pending"
                ? "All caught up! Nothing pending 🎉"
                : "No tasks yet. Add something above!"}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-2">
          {filtered.map((todo) => (
            <div
              key={todo.id}
              className={`
                flex items-center gap-3 bg-white border rounded-xl px-4 py-3
                transition-all group
                ${
                  todo.done
                    ? "border-[#e8e2d8] opacity-60"
                    : isOverdue(todo.due ?? null)
                      ? "border-red-200 bg-red-50/30"
                      : "border-[#e8e2d8] hover:border-[#fed7aa]"
                }
              `}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(todo.id, todo.done)}
                className={`
                  w-5 h-5 rounded-md border-2 flex items-center justify-center
                  shrink-0 transition-all text-[11px] font-bold
                  ${
                    todo.done
                      ? "bg-[#f97316] border-[#f97316] text-white"
                      : "border-[#e8e2d8] text-transparent hover:border-[#f97316]"
                  }
                `}
              >
                ✓
              </button>

              {/* Text */}
              <span
                className={`flex-1 text-sm font-medium ${todo.done ? "line-through text-[#9a8f7e]" : "text-[#111010]"}`}
              >
                {todo.text}
              </span>

              {/* Due date */}
              {todo.due && (
                <span
                  className={`
                  font-mono text-[10px] px-2 py-0.5 rounded-lg shrink-0
                  ${
                    isOverdue(todo.due) && !todo.done
                      ? "bg-red-100 text-red-500 border border-red-200"
                      : "bg-[#f3f0ea] text-[#9a8f7e]"
                  }
                `}
                >
                  {isOverdue(todo.due) && !todo.done ? "⚠ " : ""}
                  {todo.due}
                </span>
              )}

              {/* Tag */}
              <span
                className={`text-[9px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border shrink-0 ${getTagStyle(todo.tag)}`}
              >
                {getTagLabel(todo.tag)}
              </span>

              {/* Delete — visible on hover */}
              <button
                onClick={() => handleDelete(todo.id, todo.text)}
                className="text-[#c5bdb0] hover:text-red-500 transition-colors text-sm opacity-0 group-hover:opacity-100 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
