import { supabase } from "./supabase";

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

// ══════════════════════════════════════════════
//  PROFILES
// ══════════════════════════════════════════════

export async function getProfile(userId: string): Promise<Profile | null> {
  if (userId === "demo-user") return null;
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
  if (userId === "demo-user") return null;
  const { data } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() })
    .select()
    .single();
  return data ?? null;
}

// ══════════════════════════════════════════════
//  TODOS  (Tasks)
// ══════════════════════════════════════════════

// Get all todos — pending ones first, then done ones
export async function getTodos(userId: string): Promise<Todo[]> {
  if (userId === "demo-user") return [];
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
  const { error } = await supabase.from("todos").update({ done }).eq("id", id);

  if (error) console.error("toggleTodo error:", error);
}

// Delete a task
export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from("todos").delete().eq("id", id);

  if (error) console.error("deleteTodo error:", error);
}

// ══════════════════════════════════════════════
//  DRAFTS  (Writing)
// ══════════════════════════════════════════════

// Get all drafts, newest first
export async function getDrafts(userId: string): Promise<Draft[]> {
  if (userId === "demo-user") return [];
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
  const { data, error } = await supabase
    .from("drafts")
    .insert({ ...draft, user_id: userId })
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
  const { error } = await supabase.from("drafts").update(updates).eq("id", id);

  if (error) console.error("updateDraft error:", error);
}

// Delete a draft
export async function deleteDraft(id: string): Promise<void> {
  const { error } = await supabase.from("drafts").delete().eq("id", id);

  if (error) console.error("deleteDraft error:", error);
}

// ══════════════════════════════════════════════
//  PROJECTS
// ══════════════════════════════════════════════

// Get all projects, newest first
export async function getProjects(userId: string): Promise<Project[]> {
  if (userId === "demo-user") return [];
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
  const { error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id);

  if (error) console.error("updateProject error:", error);
}

// Delete a project
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) console.error("deleteProject error:", error);
}

// ══════════════════════════════════════════════
//  SNIPS  (Code Snippets)
// ══════════════════════════════════════════════

// Get all snips, newest first
export async function getSnips(userId: string): Promise<Snip[]> {
  if (userId === "demo-user") return [];
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
  const { error } = await supabase.from("snips").update(updates).eq("id", id);

  if (error) console.error("updateSnip error:", error);
}

// Delete a snip
export async function deleteSnip(id: string): Promise<void> {
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
  if (userId === "demo-user") return [];
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
  },
): Promise<FinanceEntry | null> {
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
  const { error } = await supabase.from("finance").delete().eq("id", id);

  if (error) console.error("deleteFinanceEntry error:", error);
}

export async function deleteFinanceEntriesByMonth(
  userId: string,
  year: number,
  month: number, // 1-12
): Promise<void> {
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
  if (userId === "demo-user") return [];
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
  if (userId === "demo-user") return null;
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
  await supabase.from("vault_meta").upsert({ user_id: userId, ...meta });
}

export async function getStickyNotes(userId: string): Promise<StickyNote[]> {
  if (userId === "demo-user") return [];
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
  if (userId === "demo-user") return null;
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
  await supabase.from("sticky_notes").update(patch).eq("id", id);
}

export async function deleteStickyNote(id: string): Promise<void> {
  await supabase.from("sticky_notes").delete().eq("id", id);
}

export async function completeTodo(id: string): Promise<void> {
  await supabase.from("todos").update({ done: true }).eq("id", id);
}

export async function updateProjectProgress(
  id: string,
  progress: number,
  status?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { progress };
  if (status) patch.status = status;
  await supabase.from("projects").update(patch).eq("id", id);
}
