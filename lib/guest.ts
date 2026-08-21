// lib/guest.ts
// ──────────────────────────────────────────────────────────────────────────
//  GUEST / DEMO MODE
//  A no-login preview of the whole app, backed by sample data that lives in
//  localStorage (so a guest's edits survive refresh) — never the database.
//
//  Entry point: `enterGuest()` sets the flag and the dashboard treats the
//  sentinel id GUEST_ID as a logged-in user. Every lib/database.ts call routes
//  here when `userId === GUEST_ID` (or `isGuest()` for id-only mutations), so
//  the panels work unchanged.
//
//  The AI chat is intentionally NOT available to guests (see TyunniePanel) —
//  flipping that on later only means giving guests a valid token, not rewiring
//  the data layer.
// ──────────────────────────────────────────────────────────────────────────

import { dayKeyOf } from "./dayKey";
import type {
  Todo,
  Draft,
  Project,
  Snip,
  FinanceEntry,
  RecurringRule,
  StickyNote,
  Memory,
  Profile,
} from "./database";

export const GUEST_ID = "demo-user";

const FLAG_KEY = "tyunnie_guest";
const DATA_KEY = "tyunnie_guest_data";

// ── Flag ───────────────────────────────────────────────────────────────────

export function isGuest(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(FLAG_KEY) === "1";
}

export function enterGuest(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FLAG_KEY, "1");
  // Seed immediately so the first dashboard read finds data.
  getGuestData();
}

export function exitGuest(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FLAG_KEY);
  localStorage.removeItem(DATA_KEY);
}

// ── Store ────────────────────────────────────────────────────────────────────

export type GuestData = {
  todos: Todo[];
  drafts: Draft[];
  projects: Project[];
  snips: Snip[];
  finance: FinanceEntry[];
  recurring: RecurringRule[];
  stickyNotes: StickyNote[];
  memories: Memory[];
  profile: Profile;
};

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "g-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Date helpers — keep the sample data anchored to "now" so charts and due
// dates look alive whenever someone opens the demo.
function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dayKeyOf(d);
}
function monthOffset(months: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  d.setDate(day);
  return dayKeyOf(d);
}
const nowISO = () => new Date().toISOString();
// Full ISO timestamp N days in the past — for seeding draft activity so the
// demo writing streak reads as a real multi-day run.
const daysAgoISO = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString();

function seed(): GuestData {
  return {
    profile: {
      id: GUEST_ID,
      display_name: "Guest",
      birth_day: 21,
      birth_month: 3,
      city: "Seoul",
      city_lat: 37.5665,
      city_lon: 126.978,
      theme: "light",
      locale: "en-MY",
      currency: "RM",
      occupation: "CS Student",
      workplace: "Tyunnie University",
      bio: "Just looking around the demo. 🧡",
      interests: ["coding", "music", "coffee"],
      greeting_style: "casual",
      show_briefing: true,
      avatar_url: null,
      daily_quote_email: false,
      accent_color: null,
      desk_layout: null,
    },
    todos: [
      { id: uid(), user_id: GUEST_ID, text: "Finish data structures assignment", tag: "cs", due: dayOffset(0), done: false, created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, text: "Draft the short story ending", tag: "write", due: dayOffset(1), done: false, created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, text: "Buy a caramel macchiato", tag: "personal", due: dayOffset(0), done: false, created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, text: "Review lecture notes on graphs", tag: "cs", due: dayOffset(3), done: false, created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, text: "Water the plants", tag: "personal", due: dayOffset(-1), done: false, created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, text: "Submit scholarship form", tag: "other", due: null, done: true, created_at: nowISO() },
    ],
    drafts: [
      {
        id: uid(),
        user_id: GUEST_ID,
        title: "On quiet mornings",
        body: "The city is softest before it wakes. I like the hour when the only sound is the kettle and my own thoughts catching up to me.\n\nThere's a kind of math to a good morning — small, exact, repeatable.",
        created_at: nowISO(),
        updated_at: nowISO(), // touched today — keeps the demo streak alive
      },
      {
        id: uid(),
        user_id: GUEST_ID,
        title: "Project pitch — rough",
        body: "A personal assistant that actually feels personal. Not a dashboard you check, but a presence that checks on you.",
        created_at: daysAgoISO(1),
        updated_at: daysAgoISO(1), // yesterday, so the streak reads 2 days
      },
    ],
    projects: [
      { id: uid(), user_id: GUEST_ID, name: "Portfolio Website", status: "active", start_date: monthOffset(-1, 5), end_date: monthOffset(1, 15), progress: 60, description: "Personal site with a blog and project gallery.", created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, name: "Algorithms Course", status: "active", start_date: monthOffset(-2, 1), end_date: monthOffset(2, 1), progress: 45, description: "Working through CLRS, one chapter a week.", created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, name: "Short Story Collection", status: "planning", start_date: dayOffset(0), end_date: monthOffset(3, 1), progress: 10, description: "Seven short stories, one per season's mood.", created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, name: "Spring Cleanup", status: "done", start_date: monthOffset(-3, 1), end_date: monthOffset(-2, 20), progress: 100, description: "Refactor old code, archive dead repos.", created_at: nowISO() },
    ],
    snips: [
      {
        id: uid(),
        user_id: GUEST_ID,
        name: "fizzbuzz.py",
        language: "py",
        code: 'for n in range(1, 21):\n    out = ""\n    if n % 3 == 0: out += "Fizz"\n    if n % 5 == 0: out += "Buzz"\n    print(out or n)\n',
        created_at: nowISO(),
      },
      {
        id: uid(),
        user_id: GUEST_ID,
        name: "greet.js",
        language: "js",
        code: 'const hour = new Date().getHours();\nconst part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";\nconsole.log(`Good ${part} — welcome to the demo.`);\n',
        created_at: nowISO(),
      },
    ],
    finance: [
      // This month
      { id: uid(), user_id: GUEST_ID, type: "income", description: "Part-time tutoring", amount: 800, category: "Salary", account: "Bank", date: monthOffset(0, 2), created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, type: "expense", description: "Groceries", amount: 145.5, category: "Food", account: "Wallet", date: monthOffset(0, 4), created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, type: "expense", description: "Coffee runs", amount: 38, category: "Food", account: "Wallet", date: monthOffset(0, 6), created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, type: "expense", description: "New textbook", amount: 89.9, category: "Education", account: "Bank", date: monthOffset(0, 7), created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, type: "income", description: "Freelance logo", amount: 250, category: "Freelance", account: "Bank", date: monthOffset(0, 9), created_at: nowISO() },
      // Last month
      { id: uid(), user_id: GUEST_ID, type: "income", description: "Part-time tutoring", amount: 800, category: "Salary", account: "Bank", date: monthOffset(-1, 2), created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, type: "expense", description: "Rent share", amount: 400, category: "Housing", account: "Bank", date: monthOffset(-1, 3), created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, type: "expense", description: "Concert ticket", amount: 180, category: "Entertainment", account: "Wallet", date: monthOffset(-1, 14), created_at: nowISO() },
    ],
    recurring: [
      // One sample rule so the demo shows the recurring feature — day 1 so it
      // has always "arrived" and auto-logs the current month on Finance mount.
      { id: uid(), user_id: GUEST_ID, type: "expense", description: "Spotify Premium", amount: 16.9, category: "Entertainment", account: "Bank", day_of_month: 1, active: true, last_generated: null, created_at: nowISO() },
    ],
    stickyNotes: [
      { id: uid(), user_id: GUEST_ID, content: "Don't forget to breathe.\nYou're doing fine.", x: 140, y: 140, width: 220, height: 160, color: "yellow", created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, content: "Idea: visualizer that reacts to the beat", x: 400, y: 220, width: 220, height: 160, color: "pink", created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, content: "Try the demo. Sign up if it sticks.", x: 270, y: 380, width: 220, height: 160, color: "blue", created_at: nowISO() },
    ],
    memories: [
      { id: uid(), user_id: GUEST_ID, content: "A caramel macchiato fixes most afternoons.", created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, content: "Studying computer science; likes clean, logical code.", created_at: nowISO() },
      { id: uid(), user_id: GUEST_ID, content: "Prefers Tyunnie low-key and steady — no over-the-top hype.", created_at: nowISO() },
    ],
  };
}

export function getGuestData(): GuestData {
  if (typeof window === "undefined") return seed();
  const raw = localStorage.getItem(DATA_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as GuestData;
    } catch {
      // fall through to reseed
    }
  }
  const fresh = seed();
  localStorage.setItem(DATA_KEY, JSON.stringify(fresh));
  return fresh;
}

function save(data: GuestData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function mutate(fn: (d: GuestData) => void): void {
  const data = getGuestData();
  fn(data);
  save(data);
}

export function resetGuestData(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DATA_KEY, JSON.stringify(seed()));
}

// ── CRUD — mirrors lib/database.ts signatures, but synchronous-in-spirit ─────
// (returned as resolved values so database.ts can `return guest.X(...)`.)

export const guest = {
  // profile
  getProfile: (): Profile => getGuestData().profile,
  upsertProfile: (patch: Partial<Profile>): Profile => {
    const data = getGuestData();
    data.profile = { ...data.profile, ...patch, id: GUEST_ID };
    save(data);
    return data.profile;
  },

  // todos
  getTodos: (): Todo[] => {
    const t = [...getGuestData().todos];
    return t.sort((a, b) => Number(a.done) - Number(b.done));
  },
  addTodo: (todo: { text: string; tag: string; due: string | null }): Todo => {
    const row: Todo = {
      id: uid(),
      user_id: GUEST_ID,
      text: todo.text,
      tag: todo.tag as Todo["tag"],
      due: todo.due,
      done: false,
      created_at: nowISO(),
    };
    mutate((d) => d.todos.unshift(row));
    return row;
  },
  toggleTodo: (id: string, done: boolean): void =>
    mutate((d) => {
      const t = d.todos.find((x) => x.id === id);
      if (t) t.done = done;
    }),
  updateTodo: (id: string, patch: { text?: string; tag?: string; due?: string | null }): void =>
    mutate((d) => {
      const t = d.todos.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }),
  deleteTodo: (id: string): void =>
    mutate((d) => {
      d.todos = d.todos.filter((x) => x.id !== id);
    }),

  // drafts
  getDrafts: (): Draft[] => [...getGuestData().drafts],
  addDraft: (draft: { title: string; body: string }): Draft => {
    const row: Draft = { id: uid(), user_id: GUEST_ID, title: draft.title, body: draft.body, created_at: nowISO(), updated_at: nowISO() };
    mutate((d) => d.drafts.unshift(row));
    return row;
  },
  updateDraft: (id: string, patch: { title?: string; body?: string }): void =>
    mutate((d) => {
      const t = d.drafts.find((x) => x.id === id);
      if (t) Object.assign(t, patch, { updated_at: nowISO() });
    }),
  deleteDraft: (id: string): void =>
    mutate((d) => {
      d.drafts = d.drafts.filter((x) => x.id !== id);
    }),

  // projects
  getProjects: (): Project[] => [...getGuestData().projects],
  addProject: (p: Omit<Project, "id" | "user_id" | "created_at">): Project => {
    const row: Project = { ...p, id: uid(), user_id: GUEST_ID, created_at: nowISO() };
    mutate((d) => d.projects.unshift(row));
    return row;
  },
  updateProject: (id: string, patch: Partial<Project>): void =>
    mutate((d) => {
      const t = d.projects.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }),
  deleteProject: (id: string): void =>
    mutate((d) => {
      d.projects = d.projects.filter((x) => x.id !== id);
    }),

  // snips
  getSnips: (): Snip[] => [...getGuestData().snips],
  addSnip: (s: { name: string; language: string; code: string }): Snip => {
    const row: Snip = { id: uid(), user_id: GUEST_ID, ...s, created_at: nowISO() };
    mutate((d) => d.snips.unshift(row));
    return row;
  },
  updateSnip: (id: string, patch: { name?: string; language?: string; code?: string }): void =>
    mutate((d) => {
      const t = d.snips.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }),
  deleteSnip: (id: string): void =>
    mutate((d) => {
      d.snips = d.snips.filter((x) => x.id !== id);
    }),

  // finance
  getFinance: (): FinanceEntry[] => [...getGuestData().finance],
  addFinance: (e: { type: "income" | "expense"; description: string; amount: number; category: string; date: string; account?: string; recurring_id?: string | null }): FinanceEntry => {
    const row: FinanceEntry = {
      id: uid(),
      user_id: GUEST_ID,
      type: e.type,
      description: e.description,
      amount: e.amount,
      category: e.category,
      account: e.account ?? "Wallet",
      date: e.date,
      created_at: nowISO(),
      recurring_id: e.recurring_id ?? null,
    };
    mutate((d) => d.finance.unshift(row));
    return row;
  },
  deleteFinance: (id: string): void =>
    mutate((d) => {
      d.finance = d.finance.filter((x) => x.id !== id);
    }),
  deleteFinanceByMonth: (year: number, month: number): void =>
    mutate((d) => {
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      d.finance = d.finance.filter((x) => !x.date.startsWith(prefix));
    }),

  // recurring finance rules
  getRecurring: (): RecurringRule[] => [...(getGuestData().recurring ?? [])],
  addRecurring: (r: { type: "income" | "expense"; description: string; amount: number; category: string; account?: string; day_of_month: number }): RecurringRule => {
    const row: RecurringRule = {
      id: uid(),
      user_id: GUEST_ID,
      type: r.type,
      description: r.description,
      amount: r.amount,
      category: r.category,
      account: r.account ?? "Wallet",
      day_of_month: r.day_of_month,
      active: true,
      last_generated: null,
      created_at: nowISO(),
    };
    mutate((d) => {
      if (!d.recurring) d.recurring = [];
      d.recurring.unshift(row);
    });
    return row;
  },
  updateRecurring: (id: string, patch: Partial<RecurringRule>): void =>
    mutate((d) => {
      const t = (d.recurring ?? []).find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }),
  deleteRecurring: (id: string): void =>
    mutate((d) => {
      d.recurring = (d.recurring ?? []).filter((x) => x.id !== id);
    }),

  // sticky notes
  getStickyNotes: (): StickyNote[] => [...getGuestData().stickyNotes],
  createStickyNote: (x: number, y: number): StickyNote => {
    const row: StickyNote = { id: uid(), user_id: GUEST_ID, content: "", x, y, width: 220, height: 160, color: "yellow", created_at: nowISO() };
    mutate((d) => d.stickyNotes.push(row));
    return row;
  },
  updateStickyNote: (id: string, patch: Partial<StickyNote>): void =>
    mutate((d) => {
      const t = d.stickyNotes.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }),
  deleteStickyNote: (id: string): void =>
    mutate((d) => {
      d.stickyNotes = d.stickyNotes.filter((x) => x.id !== id);
    }),

  // memories
  getMemories: (): Memory[] => [...getGuestData().memories],
  addMemory: (content: string): void =>
    mutate((d) => d.memories.unshift({ id: uid(), user_id: GUEST_ID, content, created_at: nowISO() })),
  deleteMemory: (id: string): void =>
    mutate((d) => {
      d.memories = d.memories.filter((x) => x.id !== id);
    }),
};
