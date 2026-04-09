"use client";

import { useEffect, useCallback } from "react";
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
    // Offset each new note slightly so they don't stack perfectly
    const offset = (notes.length % 6) * 24;
    const note = await createStickyNote(userId, 120 + offset, 120 + offset);
    if (note) onNotesChange([...notes, note]);
  }

  // Cmd+Shift+K shortcut
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
    <>
      {/* Floating + button */}
      <button
        onClick={spawnNote}
        title="New sticky note (Ctrl+Shift+K)"
        className="fixed bottom-24 right-79 z-50 w-9 h-9 rounded-xl bg-[#2a2410] border border-[#f97316]/40 text-[#f97316] text-lg flex items-center justify-center hover:bg-[#f97316] hover:text-white hover:border-[#f97316] transition-all shadow-lg"
      >
        +
      </button>

      {/* Sticky notes layer */}
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
    </>
  );
}
