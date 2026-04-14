// lib/tyunniePanelTypes.ts
// Standalone type file — no "use client", no Next.js plugin interference.
// Shared between TyunniePanel.tsx and dashboard/page.tsx for dynamic() typing.

import type { Profile as ProfileType } from "@/lib/database";
import type { Todo, Draft, Project, Snip, FinanceEntry } from "@/lib/database";

type AppData = {
  todos: Todo[];
  drafts: Draft[];
  projects: Project[];
  snips: Snip[];
  finance: FinanceEntry[];
  financeViewMonth?: number;
  financeViewYear?: number;
  stickyNotes?: { id: string; content: string; color: string }[];
  memories?: { id: string; content: string }[];
};

export type TyunniePanelProps = {
  appData: AppData;
  onNavigate: (panel: string) => void;
  onTodoAdded: (todo: { text: string; tag: string; due: string }) => void;
  onDraftAdded: (draft: { title: string; body: string }) => void;
  onProjectAdded: (project: {
    name: string;
    status: string;
    description: string;
    start_date: string;
    end_date: string;
    progress: number;
  }) => void;
  onFinanceAdded: (entry: {
    type: "income" | "expense";
    description: string;
    amount: number;
    category: string;
    date: string;
    account?: string;
  }) => void;
  onFinanceReset: (year: number, month: number) => void;
  onSnippetAdded: (snip: { name: string; language: string; code: string }) => void;
  activePanel?: string;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  userName?: string;
  profile?: ProfileType | null;
  prefillInput?: string;
  onPrefillConsumed?: () => void;
  onStickyCleared?: (id: string) => void;
  onTodoCompleted?: (id: string) => void;
  onTodoDeleted?: (id: string) => void;
  onTodoUpdated?: (id: string, patch: { text?: string; tag?: string; due?: string | null }) => void;
  onProjectUpdated?: (id: string, progress: number, status?: string) => void;
  onProjectDeleted?: (id: string) => void;
  onDraftDeleted?: (id: string) => void;
  onSnippetDeleted?: (id: string) => void;
  onFinanceDeleted?: (id: string) => void;
  onStickyUpdated?: (id: string, content: string) => void;
  onCreateSticky?: () => void;
  onFocusMode?: () => void;
  onThemeToggle?: () => void;
  onPomodoroStart?: (task: string) => void;
  onMemoryAdded?: (content: string) => void;
  onMemoryDeleted?: (id: string) => void;
};
