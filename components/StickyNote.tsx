"use client";

import { useRef, useState, useEffect } from "react";
import type { StickyNote as StickyNoteType } from "@/lib/database";

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  yellow: { bg: "color-mix(in srgb, var(--accent) 10%, #0d0800)", border: "var(--accent)", text: "#f5e6c8" },
  blue: { bg: "#0f1a2a", border: "#3b82f6", text: "#bfdbfe" },
  green: { bg: "#0f1f14", border: "#22c55e", text: "#bbf7d0" },
  pink: { bg: "#2a0f1a", border: "#ec4899", text: "#fce7f3" },
  purple: { bg: "#1a0f2a", border: "#a855f7", text: "#e9d5ff" },
};

type Props = {
  note: StickyNoteType;
  onUpdate: (id: string, patch: Partial<StickyNoteType>) => void;
  onDelete: (id: string) => void;
};

export default function StickyNote({ note, onUpdate, onDelete }: Props) {
  const [content, setContent] = useState(note.content);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!isTypingRef.current) {
      setContent(note.content);
    }
  }, [note.content]);
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [size, setSize] = useState({ w: note.width, h: note.height });
  const [color, setColor] = useState(note.color);
  const [showColors, setShowColors] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<HTMLDivElement>(null);

  const c = COLORS[color] ?? COLORS.yellow;

  // Debounced save for content
  function handleContentChange(val: string) {
    isTypingRef.current = true;
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(note.id, { content: val });
      isTypingRef.current = false; // ← release after save
    }, 600);
  }

  function handleColorChange(newColor: string) {
    setColor(newColor);
    setShowColors(false);
    onUpdate(note.id, { color: newColor });
  }

  // ── DRAG ──
  function onDragStart(e: React.MouseEvent) {
    if (
      (e.target as HTMLElement).closest(
        "textarea, button, .resize-handle, .color-picker",
      )
    )
      return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };

    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const nx = Math.max(
        0,
        dragRef.current.origX + e.clientX - dragRef.current.startX,
      );
      const ny = Math.max(
        0,
        dragRef.current.origY + e.clientY - dragRef.current.startY,
      );
      setPos({ x: nx, y: ny });
    }
    function onUp() {
      if (!dragRef.current) return;
      const nx = Math.max(
        0,
        dragRef.current.origX +
          (window.event as MouseEvent).clientX -
          dragRef.current.startX,
      );
      const ny = Math.max(
        0,
        dragRef.current.origY +
          (window.event as MouseEvent).clientY -
          dragRef.current.startY,
      );
      onUpdate(note.id, { x: nx, y: ny });
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── TOUCH DRAG ──
  function onTouchDragStart(e: React.TouchEvent) {
    if (
      (e.target as HTMLElement).closest(
        "textarea, button, .resize-handle, .color-picker",
      )
    )
      return;
    const t = e.touches[0];
    dragRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      origX: pos.x,
      origY: pos.y,
    };

    function onMove(e: TouchEvent) {
      if (!dragRef.current) return;
      const t = e.touches[0];
      const nx = Math.max(
        0,
        dragRef.current.origX + t.clientX - dragRef.current.startX,
      );
      const ny = Math.max(
        0,
        dragRef.current.origY + t.clientY - dragRef.current.startY,
      );
      setPos({ x: nx, y: ny });
    }
    function onEnd(e: TouchEvent) {
      if (!dragRef.current) return;
      const t = e.changedTouches[0];
      const nx = Math.max(
        0,
        dragRef.current.origX + t.clientX - dragRef.current.startX,
      );
      const ny = Math.max(
        0,
        dragRef.current.origY + t.clientY - dragRef.current.startY,
      );
      onUpdate(note.id, { x: nx, y: ny });
      dragRef.current = null;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    }
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  }

  // ── RESIZE ──
  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: size.w,
      origH: size.h,
    };

    function onMove(e: MouseEvent) {
      if (!resizeRef.current) return;
      const nw = Math.max(
        180,
        resizeRef.current.origW + e.clientX - resizeRef.current.startX,
      );
      const nh = Math.max(
        120,
        resizeRef.current.origH + e.clientY - resizeRef.current.startY,
      );
      setSize({ w: nw, h: nh });
    }
    function onUp() {
      if (!resizeRef.current) return;
      const nw = Math.max(
        180,
        resizeRef.current.origW +
          (window.event as MouseEvent).clientX -
          resizeRef.current.startX,
      );
      const nh = Math.max(
        120,
        resizeRef.current.origH +
          (window.event as MouseEvent).clientY -
          resizeRef.current.startY,
      );
      onUpdate(note.id, { width: nw, height: nh });
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      ref={noteRef}
      onMouseDown={onDragStart}
      onTouchStart={onTouchDragStart}
      className="absolute select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 50,
      }}
    >
      <div
        className="w-full h-full rounded-xl flex flex-col overflow-hidden"
        style={{
          background: c.bg,
          border: `1.5px solid ${c.border}`,
          boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 12px ${c.border}22`,
        }}
      >
        {/* Header bar — drag handle */}
        <div
          className="flex items-center justify-between px-2.5 py-1.5 shrink-0 cursor-grab active:cursor-grabbing"
          style={{ borderBottom: `1px solid ${c.border}33` }}
        >
          <div className="flex items-center gap-1.5">
            {/* Color dot */}
            <button
              className="color-picker w-3 h-3 rounded-full transition-transform hover:scale-125"
              style={{ background: c.border }}
              onClick={() => setShowColors((v) => !v)}
              title="Change color"
            />
            {showColors && (
              <div className="color-picker flex gap-1 ml-1">
                {Object.keys(COLORS).map((k) => (
                  <button
                    key={k}
                    className="w-3 h-3 rounded-full hover:scale-125 transition-transform"
                    style={{ background: COLORS[k].border }}
                    onClick={() => handleColorChange(k)}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onDelete(note.id)}
            className="w-4 h-4 flex items-center justify-center text-[10px] opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: c.text }}
          >
            ✕
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Dump anything here..."
          className="flex-1 resize-none bg-transparent outline-none px-2.5 py-2 text-[11px] leading-relaxed placeholder:opacity-30 cursor-text"
          style={{ color: c.text, fontFamily: "var(--font-sans)" }}
        />

        {/* Resize handle */}
        <div
          className="resize-handle absolute bottom-1 right-1 w-4 h-4 cursor-se-resize opacity-30 hover:opacity-70 transition-opacity flex items-end justify-end"
          onMouseDown={onResizeStart}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill={c.border}>
            <path d="M8 0L8 8L0 8Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
