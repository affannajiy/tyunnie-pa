import { supabase } from "./supabase";
import { guest, isGuest, GUEST_ID } from "./guest";

// ── Guest / demo routing ─────────────────────────────────────────────────────
// When the app is in guest mode every CRUD function below short-circuits to the
// localStorage-backed store in `lib/guest.ts` instead of hitting Supabase:
//   • userId-based reads/writes branch on `userId === GUEST_ID`
//   • id-only mutations (no userId in scope) branch on `isGuest()`
// Auth-only resources (vault, music uploads) return empty/null for guests.
// This keeps every panel working unchanged without a real session. See guest.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════
//  TYPES
//  These describe the shape of each data object.
//  TypeScript uses these to catch mistakes early.
// ══════════════════════════════════════════════

export type Todo = {
  id: string;
  user_id: string;
  text: string;
  tag: "cs" | "write" | "personal" | "other";
  due: string | null; // "YYYY-MM-DD" or null
  done: boolean;
  created_at: string;
};

export type Draft = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string; // touched on every save — drives the writing streak
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  status: "planning" | "active" | "paused" | "done";
  start_date: string | null;
  end_date: string | null;
  progress: number; // 0–100
  description: string;
  created_at: string;
};

export type Snip = {
  id: string;
  user_id: string;
  name: string; // e.g. "sort.py"
  language: string; // e.g. "py", "js", "ts"
  code: string;
  created_at: string;
};

export type FinanceEntry = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  category: string;
  account: string;
  date: string; // "YYYY-MM-DD"
  created_at: string;
  recurring_id?: string | null; // set when auto-logged from a RecurringRule
};

// A monthly income/expense template. The client materialises these into real
// `finance` rows via generateDueRecurring() on Finance mount (catch-up on load).
export type RecurringRule = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  category: string;
  account: string;
  day_of_month: number; // 1–31, clamped to each month's last day
  active: boolean;
  last_generated: string | null; // "YYYY-MM" of the latest materialised month
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  birth_day: number | null;
  birth_month: number | null;
  city: string | null;
  city_lat: number | null;
  city_lon: number | null;
  theme: string;
  locale: string;
  currency: string;
  occupation: string | null;
  workplace: string | null;
  bio: string | null;
  interests: string[];
  greeting_style: string;
  show_briefing: boolean;
  avatar_url?: string | null;
  daily_quote_email?: boolean;
  accent_color?: string | null;
  desk_layout?: unknown | null; // {layouts: WLayout[], hidden: WidgetId[]} stored as JSONB
};

export type VaultEntry = {
  id: string;
  user_id: string;
  name: string;
  encrypted_data: string;
  iv: string;
  salt: string;
  created_at: string;
};

export type VaultMeta = {
  user_id: string;
  pin_verifier: string;
  pin_iv: string;
  pin_salt: string;
  created_at: string;
};

export type StickyNote = {
  id: string;
  user_id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  created_at: string;
};

export type Memory = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

// ══════════════════════════════════════════════
//  PROFILES
// ══════════════════════════════════════════════

export async function getProfile(userId: string): Promise<Profile | null> {
  if (userId === GUEST_ID) return guest.getProfile();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data ?? null;
}

export async function upsertProfile(
  userId: string,
  profile: Partial<Profile>,
): Promise<Profile | null> {
  if (userId === GUEST_ID) return guest.upsertProfile(profile);
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) console.error("upsertProfile error:", error);
  return data ?? null;
}

// ══════════════════════════════════════════════
//  TODOS  (Tasks)
// ══════════════════════════════════════════════

// Get all todos — pending ones first, then done ones
export async function getTodos(userId: string): Promise<Todo[]> {
  if (userId === GUEST_ID) return guest.getTodos();
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", userId)
    .order("done", { ascending: true }) // undone first
    .order("created_at", { ascending: false }); // newest first within each group

  if (error) console.error("getTodos error:", error);
  return data ?? [];
}

// Add a new task
export async function addTodo(
  userId: string,
  todo: { text: string; tag: string; due: string | null },
): Promise<Todo | null> {
  if (userId === GUEST_ID) return guest.addTodo(todo);
  const { data, error } = await supabase
    .from("todos")
    .insert({ ...todo, user_id: userId, done: false })
    .select()
    .single();

  if (error) console.error("addTodo error:", error);
  return data ?? null;
}

// Toggle a task between done and not done
export async function toggleTodo(id: string, done: boolean): Promise<void> {
  if (isGuest()) return guest.toggleTodo(id, done);
  const { error } = await supabase.from("todos").update({ done }).eq("id", id);

  if (error) console.error("toggleTodo error:", error);
}

// Update a task's text, tag, or due date
export async function updateTodo(
  id: string,
  updates: { text?: string; tag?: string; due?: string | null },
): Promise<void> {
  if (!id) return;
  if (isGuest()) return guest.updateTodo(id, updates);
  const { error } = await supabase.from("todos").update(updates).eq("id", id);
  if (error) console.error("updateTodo error:", error);
}

// Delete a task
export async function deleteTodo(id: string): Promise<void> {
  if (isGuest()) return guest.deleteTodo(id);
  const { error } = await supabase.from("todos").delete().eq("id", id);

  if (error) console.error("deleteTodo error:", error);
}

// ══════════════════════════════════════════════
//  DRAFTS  (Writing)
// ══════════════════════════════════════════════

// Get all drafts, newest first
export async function getDrafts(userId: string): Promise<Draft[]> {
  if (userId === GUEST_ID) return guest.getDrafts();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) console.error("getDrafts error:", error);
  return data ?? [];
}

// Save a new draft
export async function addDraft(
  userId: string,
  draft: { title: string; body: string },
): Promise<Draft | null> {
  if (userId === GUEST_ID) return guest.addDraft(draft);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("drafts")
    .insert({ ...draft, user_id: userId, updated_at: now })
    .select()
    .single();

  if (error) console.error("addDraft error:", error);
  return data ?? null;
}

// Update an existing draft (when user edits and re-saves)
export async function updateDraft(
  id: string,
  updates: { title?: string; body?: string },
): Promise<void> {
  if (isGuest()) return guest.updateDraft(id, updates);
  const { error } = await supabase
    .from("drafts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) console.error("updateDraft error:", error);
}

// Delete a draft
export async function deleteDraft(id: string): Promise<void> {
  if (isGuest()) return guest.deleteDraft(id);
  const { error } = await supabase.from("drafts").delete().eq("id", id);

  if (error) console.error("deleteDraft error:", error);
}

// ══════════════════════════════════════════════
//  PROJECTS
// ══════════════════════════════════════════════

// Get all projects, newest first
export async function getProjects(userId: string): Promise<Project[]> {
  if (userId === GUEST_ID) return guest.getProjects();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) console.error("getProjects error:", error);
  return data ?? [];
}

// Add a new project
export async function addProject(
  userId: string,
  project: {
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    progress: number;
    description: string;
  },
): Promise<Project | null> {
  if (userId === GUEST_ID) return guest.addProject({ ...project, status: project.status as Project["status"] });
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...project, user_id: userId })
    .select()
    .single();

  if (error) console.error("addProject error:", error);
  return data ?? null;
}

// Update a project — useful for changing progress % or status
export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, "id" | "user_id" | "created_at">>,
): Promise<void> {
  if (isGuest()) return guest.updateProject(id, updates);
  const { error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id);

  if (error) console.error("updateProject error:", error);
}

// Delete a project
export async function deleteProject(id: string): Promise<void> {
  if (isGuest()) return guest.deleteProject(id);
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) console.error("deleteProject error:", error);
}

// ══════════════════════════════════════════════
//  SNIPS  (Code Snippets)
// ══════════════════════════════════════════════

// Get all snips, newest first
export async function getSnips(userId: string): Promise<Snip[]> {
  if (userId === GUEST_ID) return guest.getSnips();
  const { data, error } = await supabase
    .from("snips")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) console.error("getSnips error:", error);
  return data ?? [];
}

// Save a new snip
export async function addSnip(
  userId: string,
  snip: { name: string; language: string; code: string },
): Promise<Snip | null> {
  if (userId === GUEST_ID) return guest.addSnip(snip);
  const { data, error } = await supabase
    .from("snips")
    .insert({ ...snip, user_id: userId })
    .select()
    .single();

  if (error) console.error("addSnip error:", error);
  return data ?? null;
}

// Update an existing snip (when user edits and re-saves)
export async function updateSnip(
  id: string,
  updates: { name?: string; language?: string; code?: string },
): Promise<void> {
  if (isGuest()) return guest.updateSnip(id, updates);
  const { error } = await supabase.from("snips").update(updates).eq("id", id);

  if (error) console.error("updateSnip error:", error);
}

// Delete a snip
export async function deleteSnip(id: string): Promise<void> {
  if (isGuest()) return guest.deleteSnip(id);
  const { error } = await supabase.from("snips").delete().eq("id", id);

  if (error) console.error("deleteSnip error:", error);
}

// ══════════════════════════════════════════════
//  FINANCE
// ══════════════════════════════════════════════

// Get all finance entries, newest first
export async function getFinanceEntries(
  userId: string,
): Promise<FinanceEntry[]> {
  if (userId === GUEST_ID) return guest.getFinance();
  // Only fetch last 12 months — enough for 6-month charts + carry-over
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const { data, error } = await supabase
    .from("finance")
    .select("*")
    .eq("user_id", userId)
    .gte("date", since.toISOString().split("T")[0])
    .order("date", { ascending: false });

  if (error) console.error("getFinanceEntries error:", error);
  return data ?? [];
}

// Add a new income or expense entry
export async function addFinanceEntry(
  userId: string,
  entry: {
    type: "income" | "expense";
    description: string;
    amount: number;
    category: string;
    date: string;
    account?: string;
    recurring_id?: string | null;
  },
): Promise<FinanceEntry | null> {
  if (userId === GUEST_ID) return guest.addFinance(entry);
  const payload = {
    ...entry,
    account: entry.account ?? "Wallet",
    user_id: userId,
  };
  const { data, error } = await supabase
    .from("finance")
    .insert(payload)
    .select()
    .single();

  if (error) console.error("addFinanceEntry error:", error);
  return data ?? null;
}

// Delete a finance entry
export async function deleteFinanceEntry(id: string): Promise<void> {
  if (isGuest()) return guest.deleteFinance(id);
  const { error } = await supabase.from("finance").delete().eq("id", id);

  if (error) console.error("deleteFinanceEntry error:", error);
}

// ── RECURRING FINANCE RULES ──────────────────────────────────────────────────

export async function getRecurringRules(
  userId: string,
): Promise<RecurringRule[]> {
  if (userId === GUEST_ID) return guest.getRecurring();
  const { data, error } = await supabase
    .from("recurring_finance")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) console.error("getRecurringRules error:", error);
  return data ?? [];
}

export async function addRecurringRule(
  userId: string,
  rule: {
    type: "income" | "expense";
    description: string;
    amount: number;
    category: string;
    account?: string;
    day_of_month: number;
  },
): Promise<RecurringRule | null> {
  if (userId === GUEST_ID) return guest.addRecurring(rule);
  const { data, error } = await supabase
    .from("recurring_finance")
    .insert({
      ...rule,
      account: rule.account ?? "Wallet",
      active: true,
      last_generated: null,
      user_id: userId,
    })
    .select()
    .single();

  if (error) console.error("addRecurringRule error:", error);
  return data ?? null;
}

export async function updateRecurringRule(
  id: string,
  updates: Partial<
    Pick<RecurringRule, "active" | "last_generated" | "amount" | "day_of_month">
  >,
): Promise<void> {
  if (isGuest()) return guest.updateRecurring(id, updates);
  const { error } = await supabase
    .from("recurring_finance")
    .update(updates)
    .eq("id", id);

  if (error) console.error("updateRecurringRule error:", error);
}

export async function deleteRecurringRule(id: string): Promise<void> {
  if (isGuest()) return guest.deleteRecurring(id);
  const { error } = await supabase
    .from("recurring_finance")
    .delete()
    .eq("id", id);

  if (error) console.error("deleteRecurringRule error:", error);
}

// ── Catch-up engine ──────────────────────────────────────────────────────────
// Runs on Finance mount. For each active rule, materialise a real `finance` row
// for every month between its last generated month and now whose scheduled day
// has already arrived. `last_generated` (a "YYYY-MM" high-water mark) is the
// idempotency guard, so re-mounts never double-insert. Works for guests too:
// every call below routes through the GUEST_ID/isGuest() branches.
function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate(); // m is 0-based; day 0 of next month
}
function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export async function generateDueRecurring(userId: string): Promise<number> {
  const rules = (await getRecurringRules(userId)).filter((r) => r.active);
  if (rules.length === 0) return 0;

  const today = new Date();
  const curY = today.getFullYear();
  const curM = today.getMonth();
  let generated = 0;

  for (const rule of rules) {
    // First month to consider: the month AFTER last_generated, or the rule's
    // creation month if it has never generated.
    let y: number;
    let m: number;
    if (rule.last_generated) {
      const [ly, lm] = rule.last_generated.split("-").map(Number);
      y = ly;
      m = lm; // lm is 1-based, so it's already the 0-based index of the next month
      if (m > 11) {
        m = 0;
        y++;
      }
    } else {
      const created = new Date(rule.created_at);
      y = created.getFullYear();
      m = created.getMonth();
    }

    let latest = rule.last_generated;

    while (y < curY || (y === curY && m <= curM)) {
      const day = Math.min(rule.day_of_month, lastDayOfMonth(y, m));
      const occurrence = new Date(y, m, day);
      // Only log once the scheduled day has actually arrived (no future-dating
      // the current month before its day).
      if (occurrence.getTime() <= today.getTime()) {
        const entry = await addFinanceEntry(userId, {
          type: rule.type,
          description: rule.description,
          amount: rule.amount,
          category: rule.category,
          account: rule.account,
          date: `${monthKey(y, m)}-${String(day).padStart(2, "0")}`,
          recurring_id: rule.id,
        });
        if (entry) {
          generated++;
          latest = monthKey(y, m);
        }
      }
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }

    if (latest && latest !== rule.last_generated) {
      await updateRecurringRule(rule.id, { last_generated: latest });
    }
  }

  return generated;
}

export async function deleteFinanceEntriesByMonth(
  userId: string,
  year: number,
  month: number, // 1-12
): Promise<void> {
  if (userId === GUEST_ID) return guest.deleteFinanceByMonth(year, month);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;

  const { error } = await supabase
    .from("finance")
    .delete()
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);

  if (error) console.error("deleteFinanceEntriesByMonth error:", error);
}

// Calculate balance summary — called by Tyunnie when you ask about your money
// Returns: { income, expenses, balance }
export async function getFinanceSummary(
  userId: string,
): Promise<{ income: number; expenses: number; balance: number }> {
  const entries = await getFinanceEntries(userId);

  const income = entries
    .filter((e) => e.type === "income")
    .reduce((sum, e) => sum + e.amount, 0);
  const expenses = entries
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    income,
    expenses,
    balance: income - expenses,
  };
}

// ══════════════════════════════════════════════
//  VAULT
// ══════════════════════════════════════════════

export async function getVaultEntries(userId: string): Promise<VaultEntry[]> {
  if (userId === GUEST_ID) return [];
  const { data, error } = await supabase
    .from("vault")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) console.error("getVaultEntries error:", error);
  return data ?? [];
}

export async function addVaultEntry(
  userId: string,
  entry: { name: string; encrypted_data: string; iv: string; salt: string },
): Promise<VaultEntry | null> {
  if (userId === GUEST_ID) return null;
  const { data, error } = await supabase
    .from("vault")
    .insert({ ...entry, user_id: userId })
    .select()
    .single();
  if (error) console.error("addVaultEntry error:", error);
  return data ?? null;
}

export async function deleteVaultEntry(id: string): Promise<void> {
  const { error } = await supabase.from("vault").delete().eq("id", id);
  if (error) console.error("deleteVaultEntry error:", error);
}

export async function updateVaultEntry(
  id: string,
  updates: { name: string; encrypted_data: string; iv: string; salt: string },
): Promise<void> {
  const { error } = await supabase.from("vault").update(updates).eq("id", id);
  if (error) console.error("updateVaultEntry error:", error);
}

export async function getVaultMeta(userId: string): Promise<VaultMeta | null> {
  if (userId === GUEST_ID) return null;
  const { data } = await supabase
    .from("vault_meta")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data ?? null;
}

export async function setVaultMeta(
  userId: string,
  meta: { pin_verifier: string; pin_iv: string; pin_salt: string },
): Promise<void> {
  if (userId === GUEST_ID) return;
  await supabase.from("vault_meta").upsert({ user_id: userId, ...meta });
}

export async function getStickyNotes(userId: string): Promise<StickyNote[]> {
  if (userId === GUEST_ID) return guest.getStickyNotes();
  const { data } = await supabase
    .from("sticky_notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function createStickyNote(
  userId: string,
  x: number,
  y: number,
): Promise<StickyNote | null> {
  if (userId === GUEST_ID) return guest.createStickyNote(x, y);
  const { data } = await supabase
    .from("sticky_notes")
    .insert({
      user_id: userId,
      content: "",
      x,
      y,
      width: 220,
      height: 160,
      color: "yellow",
    })
    .select()
    .single();
  return data ?? null;
}

export async function updateStickyNote(
  id: string,
  patch: Partial<
    Pick<StickyNote, "content" | "x" | "y" | "width" | "height" | "color">
  >,
): Promise<void> {
  if (isGuest()) return guest.updateStickyNote(id, patch);
  await supabase.from("sticky_notes").update(patch).eq("id", id);
}

export async function deleteStickyNote(id: string): Promise<void> {
  if (isGuest()) return guest.deleteStickyNote(id);
  await supabase.from("sticky_notes").delete().eq("id", id);
}

export async function completeTodo(id: string): Promise<void> {
  if (isGuest()) return guest.toggleTodo(id, true);
  await supabase.from("todos").update({ done: true }).eq("id", id);
}

export async function updateProjectProgress(
  id: string,
  progress: number,
  status?: string,
): Promise<void> {
  if (isGuest()) return guest.updateProject(id, status ? { progress, status: status as Project["status"] } : { progress });
  const patch: Record<string, unknown> = { progress };
  if (status) patch.status = status;
  await supabase.from("projects").update(patch).eq("id", id);
}

// ══════════════════════════════════════════════
//  MEMORY
// ══════════════════════════════════════════════
export async function getMemories(userId: string): Promise<Memory[]> {
  if (userId === GUEST_ID) return guest.getMemories();
  const { data } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  return data ?? [];
}

export async function addMemory(
  userId: string,
  content: string,
): Promise<void> {
  if (userId === GUEST_ID) return guest.addMemory(content);
  await supabase.from("memories").insert({ user_id: userId, content });
}

export async function deleteMemory(id: string): Promise<void> {
  if (isGuest()) return guest.deleteMemory(id);
  await supabase.from("memories").delete().eq("id", id);
}

// ══════════════════════════════════════════════
//  MUSIC TRACKS
// ══════════════════════════════════════════════

export type MusicTrack = {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  file_url: string;
  cover_url: string | null;
  position: number;
  created_at: string;
};

export async function getMusicTracks(userId: string): Promise<MusicTrack[]> {
  if (userId === GUEST_ID) return [];
  const { data, error } = await supabase
    .from("music_tracks")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) console.error("getMusicTracks error:", error);
  return data ?? [];
}

export async function addMusicTrack(
  userId: string,
  track: {
    title: string;
    artist: string;
    file_url: string;
    cover_url: string | null;
    position?: number;
  },
): Promise<MusicTrack | null> {
  if (userId === GUEST_ID) return null;
  const { data, error } = await supabase
    .from("music_tracks")
    .insert({ ...track, user_id: userId, position: track.position ?? 0 })
    .select()
    .single();
  if (error) console.error("addMusicTrack error:", error);
  return data ?? null;
}

export async function deleteMusicTrack(id: string): Promise<void> {
  const { error } = await supabase.from("music_tracks").delete().eq("id", id);
  if (error) console.error("deleteMusicTrack error:", error);
}
