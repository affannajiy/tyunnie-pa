"use client";

import { useEffect, useCallback, useRef, useState } from "react";
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
  // Floating button position — default bottom right above mobile nav
  const [btnPos, setBtnPos] = useState({ x: -1, y: -1 });
  const [draggingBtn, setDraggingBtn] = useState(false);
  const btnDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const didDragRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Init position after mount so we know window size
  useEffect(() => {
    const btnSize = 36;
    const margin = 16;
    const mobileNavHeight = 64;
    setBtnPos({
      x: window.innerWidth - btnSize - margin - 316, // above Tyunnie panel on desktop
      y: window.innerHeight - btnSize - margin - mobileNavHeight,
    });
  }, []);

  async function spawnNote() {
    const offset = (notes.length % 6) * 24;
    const note = await createStickyNote(userId, 120 + offset, 120 + offset);
    if (note) onNotesChange([...notes, note]);
  }

  // Keyboard shortcut
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

  // ── BUTTON DRAG (mouse) ──
  function onBtnMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    didDragRef.current = false;
    btnDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: btnPos.x,
      origY: btnPos.y,
    };
    setDraggingBtn(true);

    function onMove(e: MouseEvent) {
      if (!btnDragRef.current) return;
      const dx = e.clientX - btnDragRef.current.startX;
      const dy = e.clientY - btnDragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDragRef.current = true;
      const nx = Math.max(
        0,
        Math.min(window.innerWidth - 36, btnDragRef.current.origX + dx),
      );
      const ny = Math.max(
        0,
        Math.min(window.innerHeight - 36, btnDragRef.current.origY + dy),
      );
      setBtnPos({ x: nx, y: ny });
    }
    function onUp() {
      setDraggingBtn(false);
      btnDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── BUTTON DRAG (touch) ──
  function onBtnTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    didDragRef.current = false;
    btnDragRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      origX: btnPos.x,
      origY: btnPos.y,
    };

    function onMove(e: TouchEvent) {
      if (!btnDragRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - btnDragRef.current.startX;
      const dy = t.clientY - btnDragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDragRef.current = true;
      const nx = Math.max(
        0,
        Math.min(window.innerWidth - 36, btnDragRef.current.origX + dx),
      );
      const ny = Math.max(
        0,
        Math.min(window.innerHeight - 36, btnDragRef.current.origY + dy),
      );
      setBtnPos({ x: nx, y: ny });
    }
    function onEnd() {
      btnDragRef.current = null;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    }
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  }

  function handleBtnClick() {
    if (!didDragRef.current) spawnNote();
  }

  async function handleUpdate(id: string, patch: Partial<StickyNoteType>) {
    await updateStickyNote(id, patch);
    onNotesChange(notes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  async function handleDelete(id: string) {
    await deleteStickyNote(id);
    onNotesChange(notes.filter((n) => n.id !== id));
  }

  if (btnPos.x === -1) return null; // wait for mount

  return (
    <>
      {/* Floating draggable + button */}
      <button
        ref={btnRef}
        onMouseDown={onBtnMouseDown}
        onTouchStart={onBtnTouchStart}
        onClick={handleBtnClick}
        title="New sticky note (Ctrl+Shift+K)"
        className={`fixed z-50 w-9 h-9 rounded-xl bg-[#2a2410] border border-[#f97316]/40 text-[#f97316] text-lg flex items-center justify-center hover:bg-[#f97316] hover:text-white hover:border-[#f97316] transition-colors shadow-lg ${draggingBtn ? "cursor-grabbing scale-110" : "cursor-grab"}`}
        style={{ left: btnPos.x, top: btnPos.y, touchAction: "none" }}
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
