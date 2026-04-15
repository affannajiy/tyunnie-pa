// components/MiniPlayer.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";

type Props = { activePanel: string };

const DESKTOP_W = 288;
const DESKTOP_H = 178; // approx rendered height
const MOBILE_W  = 220;
const MOBILE_H  = 58;

export default function MiniPlayer({ activePanel }: Props) {
  const music = useMusicContext();

  const [dismissed,  setDismissed]  = useState(false);
  const [autoClosed, setAutoClosed] = useState(false);
  const [visible,    setVisible]    = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);
  const [dragging,   setDragging]   = useState(false);

  // null until mounted — avoids SSR mismatch
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

  // ── init position + detect mobile ──
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    const W = mobile ? MOBILE_W  : DESKTOP_W;
    const H = mobile ? MOBILE_H  : DESKTOP_H;
    setPos({
      x: window.innerWidth  - W - 16,
      y: window.innerHeight - H - 96, // above the dock
    });

    function onResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── auto-close timer ──
  useEffect(() => () => { if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current); }, []);

  useEffect(() => {
    if (music.isPlaying) {
      setDismissed(false);
      setAutoClosed(false);
      if (pauseTimerRef.current) { clearTimeout(pauseTimerRef.current); pauseTimerRef.current = null; }
    } else if (music.currentTrack) {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = setTimeout(() => setAutoClosed(true), 30_000);
    }
  }, [music.isPlaying, music.currentTrack]);

  // ── visibility ──
  const shouldShow = !!music.currentTrack && activePanel !== "music" && !dismissed && !autoClosed;

  useEffect(() => {
    if (shouldShow) {
      const id = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(id);
    } else {
      setVisible(false);
    }
  }, [shouldShow]);

  // ── drag handlers (pointer events — works for mouse + touch) ──
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start drag on interactive children
    if ((e.target as HTMLElement).closest("button, input")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos?.x ?? 0,
      baseY: pos?.y ?? 0,
    };
    setDragging(true);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    setPos({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    // Clamp to viewport
    const W = isMobile ? MOBILE_W : DESKTOP_W;
    const H = isMobile ? MOBILE_H : DESKTOP_H;
    setPos((prev) =>
      prev
        ? {
            x: Math.max(0, Math.min(window.innerWidth  - W, prev.x)),
            y: Math.max(0, Math.min(window.innerHeight - H, prev.y)),
          }
        : prev,
    );
  }, [isMobile]);

  if ((!shouldShow && !visible) || pos === null) return null;

  const pct = music.duration > 0 ? (music.progress / music.duration) * 100 : 0;

  function handleClose() {
    setDismissed(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
  }

  const wrapperStyle: React.CSSProperties = {
    position:   "fixed",
    left:       pos.x,
    top:        pos.y,
    zIndex:     40,
    width:      isMobile ? MOBILE_W : DESKTOP_W,
    opacity:    visible ? 1 : 0,
    transform:  visible ? "translateY(0)" : "translateY(20px)",
    transition: dragging ? "opacity 200ms" : "opacity 300ms ease-out, transform 300ms ease-out",
    cursor:     dragging ? "grabbing" : "grab",
    userSelect: "none",
    touchAction:"none",
  };

  // ── MOBILE: compact pill ──
  if (isMobile) {
    return (
      <div
        style={wrapperStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="bg-[#1a1410] border border-[#2a2520] rounded-2xl shadow-2xl overflow-hidden">
          {/* Single row */}
          <div className="flex items-center gap-2 px-2.5 py-2">
            {/* Art */}
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-[#2a2520]">
              {music.currentTrack?.cover ? (
                <Image src={music.currentTrack.cover} alt="" width={32} height={32} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#4a4038] text-xs">🎵</div>
              )}
            </div>
            {/* Title */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-white truncate leading-tight">{music.currentTrack?.title}</div>
              <div className="text-[9px] text-[#9a8f7e] font-mono truncate leading-none mt-0.5">{music.currentTrack?.artist}</div>
            </div>
            {/* Play/pause */}
            <button
              onClick={music.togglePlay}
              className="w-7 h-7 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs hover:bg-[#c2500f] transition-colors shrink-0"
              style={{ boxShadow: "0 2px 10px rgba(var(--accent-rgb),0.4)" }}
            >
              {music.isPlaying ? "⏸" : "▶"}
            </button>
            {/* Close */}
            <button
              onClick={handleClose}
              className="w-6 h-6 flex items-center justify-center text-[#4a4038] hover:text-[#9a8f7e] transition-colors shrink-0 text-[10px]"
            >
              ✕
            </button>
          </div>
          {/* Thin progress bar at bottom */}
          <div className="h-0.5 bg-[#2a2520]">
            <div className="h-full bg-[#f97316] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // ── DESKTOP: full card ──
  return (
    <div
      style={wrapperStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="bg-[#1a1410] border border-[#2a2520] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[#2a2520]">
            {music.currentTrack?.cover ? (
              <Image src={music.currentTrack.cover} alt="" width={40} height={40} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#4a4038] text-sm">🎵</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate leading-tight">{music.currentTrack?.title}</div>
            <div className="text-[10px] text-[#9a8f7e] font-mono truncate leading-tight mt-0.5">{music.currentTrack?.artist}</div>
          </div>
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center text-[#4a4038] hover:text-[#9a8f7e] transition-colors shrink-0 text-xs"
            aria-label="Close player"
          >
            ✕
          </button>
        </div>

        {/* Progress */}
        <div className="px-3 pb-2">
          <input
            type="range"
            min={0}
            max={music.duration || 100}
            step={0.5}
            value={music.progress}
            onChange={(e) => music.handleSeek(parseFloat(e.target.value))}
            className="w-full h-0.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--accent) ${pct}%, #2a2520 ${pct}%)`,
              accentColor: "var(--accent)",
            }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] font-mono text-[#4a4038]">{music.formatTime(music.progress)}</span>
            <span className="text-[9px] font-mono text-[#4a4038]">{music.formatTime(music.duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-1.5 px-3 pb-3">
          <button onClick={() => music.skipBack(10)}    className="w-7 h-7 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-[9px] font-mono">−10</button>
          <button onClick={music.prevTrack}             className="w-7 h-7 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-sm">⏮</button>
          <button
            onClick={music.togglePlay}
            className="w-9 h-9 rounded-full bg-[#f97316] flex items-center justify-center text-white text-sm hover:bg-[#c2500f] transition-all hover:scale-105 active:scale-95"
            style={{ boxShadow: "0 4px 16px rgba(var(--accent-rgb),0.35)" }}
          >
            {music.isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={music.nextTrack}             className="w-7 h-7 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-sm">⏭</button>
          <button onClick={() => music.skipForward(10)} className="w-7 h-7 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-[9px] font-mono">+10</button>
        </div>
      </div>
    </div>
  );
}
