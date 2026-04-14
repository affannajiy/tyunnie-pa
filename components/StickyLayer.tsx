"use client";

import { useCallback, useEffect } from "react";
import StickyNote from "@/components/StickyNote";
import type { StickyNote as StickyNoteType } from "@/lib/database";
import {
  createStickyNote,
  updateStickyNote,
  deleteStickyNote,
} from "@/lib/database";

type Props = {
  userId: string;
  notes: StickyNoteType[];
  onNotesChange: (notes: StickyNoteType[]) => void;
};

export default function StickyLayer({ userId, notes, onNotesChange }: Props) {
  async function spawnNote() {
    const offset = (notes.length % 6) * 24;
    const note = await createStickyNote(userId, 120 + offset, 120 + offset);
    if (note) onNotesChange([...notes, note]);
  }

  // Keyboard shortcut Ctrl+Shift+K still works
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "K") {
        e.preventDefault();
        spawnNote();
      }
    },
    [notes],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleUpdate(id: string, patch: Partial<StickyNoteType>) {
    await updateStickyNote(id, patch);
    onNotesChange(notes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  async function handleDelete(id: string) {
    await deleteStickyNote(id);
    onNotesChange(notes.filter((n) => n.id !== id));
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      <div className="relative w-full h-full pointer-events-none">
        {notes.map((note) => (
          <div key={note.id} className="pointer-events-auto">
            <StickyNote
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
