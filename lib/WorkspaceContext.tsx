"use client";

import { createContext, useContext, useState } from "react";

export type WorkspacePanel =
  | "snippets"
  | "writing"
  | "todo"
  | "projects"
  | "finance"
  | "desk"
  | "profile"
  | "music"
  | "pomodoro"
  | null;

export interface WorkspaceSnapshot {
  panel: WorkspacePanel;
  content: string;
  label: string;
  meta?: Record<string, string>;
  updatedAt: number;
}

export interface WorkspaceContextValue {
  snapshot: WorkspaceSnapshot | null;
  setSnapshot: (s: WorkspaceSnapshot | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  snapshot: null,
  setSnapshot: () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  return (
    <WorkspaceContext.Provider value={{ snapshot, setSnapshot }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
