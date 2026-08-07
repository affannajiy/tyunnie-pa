// components/MiniPlayer.tsx
"use client";

import { X, Music2, SkipBack, SkipForward, Play, Pause } from "lucide-react";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMusicContext } from "@/lib/MusicContext";
import { readActivePanel, subscribeActivePanel } from "@/lib/activePanel";

const DESKTOP_W = 288;
const DESKTOP_H = 178; // approx rendered height
const MOBILE_W  = 220;
const MOBILE_H  = 58;

const POS_KEY = "tyunnie_miniplayer_pos";

type Pos = { x: number; y: number };

function clampPos(p: Pos, mobile: boolean): Pos {
  const W = mobile ? MOBILE_W : DESKTOP_W;
  const H = mobile ? MOBILE_H : DESKTOP_H;
  return {
    x: Math.max(0, Math.min(window.innerWidth  - W, p.x)),
    y: Math.max(0, Math.min(window.innerHeight - H, p.y)),
  };
}

function defaultPos(mobile: boolean): Pos {
  const W = mobile ? MOBILE_W : DESKTOP_W;
  const H = mobile ? MOBILE_H : DESKTOP_H;
  return {
    x: window.innerWidth  - W - 16,
    y: window.innerHeight - H - 96, // above the dock
  };
}

export default function MiniPlayer() {
  const music    = useMusicContext();
  const pathname = usePathname();
  const router   = useRouter();

  // Which track the user hid the player on. Stored as an index rather than a
  // boolean so "un-hide on the next track" falls out of a comparison instead of
  // an effect that resets state.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [visible,   setVisible]   = useState(false);
  const [isMobile,  setIsMobile]  = useState(false);
  const [dragging,  setDragging]  = useState(false);

  // Empty when no dashboard is mounted (e.g. we're on /about).
  const [activePanel, setActivePanel] = useState(readActivePanel);

  // null until mounted — avoids SSR mismatch
  const [pos, setPos] = useState<Pos | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const posRef  = useRef<Pos | null>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  // Detaches the current gesture's document listeners. Held in a ref so the
  // unmount effect can call it — unmounting mid-drag (route change, track end)
  // otherwise leaves them attached forever.
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // ── init position + detect mobile ──
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);

    // Restore where the user last left it. Corrupt blob → fall back, never throw.
    let start: Pos | null = null;
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          start = parsed;
        }
      }
    } catch {}

    const next = clampPos(start ?? defaultPos(mobile), mobile);
    setPos(next);
    posRef.current = next;
  }, []);

  // ── re-clamp on resize / rotate / breakpoint cross ──
  // Without this the player can end up permanently off-screen: the old code
  // only clamped on drag release, so shrinking the window stranded it.
  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setPos((prev) => {
        if (!prev) return prev;
        const next = clampPos(prev, mobile);
        posRef.current = next;
        return next;
      });
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // ── which dashboard panel is open (empty off-dashboard) ──
  useEffect(() => subscribeActivePanel(setActivePanel), []);

  // A new track un-dismisses: the widget was hidden, not switched off.
  const dismissed = dismissedAt === music.currentIndex;

  // ── visibility ──
  // Never on the auth screen — a floating player over a login form is noise.
  const shouldShow =
    music.hasEverPlayed &&
    !!music.currentTrack &&
    !pathname.startsWith("/auth") &&
    activePanel !== "music" &&
    !dismissed;

  useEffect(() => {
    if (shouldShow) {
      const id = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(id);
    } else {
      setVisible(false);
    }
  }, [shouldShow]);

  // ── drag ──
  // Position is written straight to the node during the gesture; committing to
  // React state on every pointermove re-rendered the whole card each frame.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    const base = posRef.current;
    if (!base) return;

    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: base.x,
      baseY: base.y,
    };
    setDragging(true);

    function onMove(ev: PointerEvent) {
      if (!dragRef.current.active || !cardRef.current) return;
      const next = {
        x: dragRef.current.baseX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.baseY + (ev.clientY - dragRef.current.startY),
      };
      posRef.current = next;
      cardRef.current.style.left = `${next.x}px`;
      cardRef.current.style.top  = `${next.y}px`;
    }

    function finish() {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      setDragging(false);
      const mobile = window.innerWidth < 768;
      const settled = clampPos(posRef.current ?? { x: 0, y: 0 }, mobile);
      posRef.current = settled;
      setPos(settled);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(settled));
      } catch {}
      detach();
    }

    function detach() {
      document.removeEventListener("pointermove",   onMove);
      document.removeEventListener("pointerup",     finish);
      document.removeEventListener("pointercancel", finish);
    }

    document.addEventListener("pointermove",   onMove);
    document.addEventListener("pointerup",     finish);
    // Touch gestures can be taken over by the system mid-drag. Without this the
    // listeners stayed attached and `active` stayed true, wedging the drag.
    document.addEventListener("pointercancel", finish);

    dragCleanupRef.current = detach;
  }, []);

  useEffect(() => () => dragCleanupRef.current?.(), []);

  if ((!shouldShow && !visible) || pos === null) return null;

  const pct = music.duration > 0 ? (music.progress / music.duration) * 100 : 0;

  // Hide the widget only. Closing used to pause the track, which reads as
  // "stop the music" on a control whose whole job is to stay out of the way.
  function handleClose() {
    setDismissedAt(music.currentIndex);
  }

  function goToMusic() {
    if (pathname === "/dashboard") {
      window.dispatchEvent(new CustomEvent("tyunnie-open-panel", { detail: "music" }));
    } else {
      router.push("/dashboard");
      // The dashboard mounts its listener after navigation settles.
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("tyunnie-open-panel", { detail: "music" })),
        400,
      );
    }
  }

  const wrapperStyle: React.CSSProperties = {
    position:   "fixed",
    left:       pos.x,
    top:        pos.y,
    // Above StickyLayer (z-40). A transient player the user just grabbed should
    // not end up underneath a note.
    zIndex:     45,
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
      <div ref={cardRef} style={wrapperStyle} onPointerDown={onPointerDown}>
        <div className="bg-[#1a1410] border border-[#2a2520] rounded-2xl shadow-2xl overflow-hidden">
          {/* Single row */}
          <div className="flex items-center gap-2 px-2.5 py-2">
            {/* Art + Title — tap to go to Music panel */}
            <button
              onClick={goToMusic}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-[#2a2520]">
                {music.currentTrack?.cover ? (
                  <Image src={music.currentTrack.cover} alt="" width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#4a4038] text-xs"><Music2 size={13} strokeWidth={1.5} /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-white truncate leading-tight">{music.currentTrack?.title}</div>
                <div className="text-[9px] text-[#9a8f7e] font-mono truncate leading-none mt-0.5">{music.currentTrack?.artist}</div>
              </div>
            </button>
            {/* Play/pause */}
            <button
              onClick={music.togglePlay}
              aria-label={music.isPlaying ? "Pause" : "Play"}
              className="w-7 h-7 rounded-full bg-(--accent) flex items-center justify-center text-white hover:bg-[#c2500f] transition-colors shrink-0"
              style={{ boxShadow: "0 2px 10px rgba(var(--accent-rgb),0.4)" }}
            >
              {music.isPlaying ? (
                <Pause size={14} strokeWidth={1.75} fill="currentColor" />
              ) : (
                <Play size={14} strokeWidth={1.75} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            {/* Hide */}
            <button
              onClick={handleClose}
              aria-label="Hide player"
              title="Hide player — the music keeps going"
              className="w-6 h-6 flex items-center justify-center text-[#4a4038] hover:text-[#9a8f7e] transition-colors shrink-0 text-[10px]"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          {/* Thin progress bar at bottom */}
          <div className="h-0.5 bg-[#2a2520]">
            <div className="h-full bg-(--accent) transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // ── DESKTOP: full card ──
  return (
    <div ref={cardRef} style={wrapperStyle} onPointerDown={onPointerDown}>
      <div className="bg-[#1a1410] border border-[#2a2520] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
          {/* Art + Title — click to go to Music panel */}
          <button
            onClick={goToMusic}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left group"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[#2a2520] group-hover:opacity-80 transition-opacity">
              {music.currentTrack?.cover ? (
                <Image src={music.currentTrack.cover} alt="" width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#4a4038] text-sm"><Music2 size={15} strokeWidth={1.5} /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate leading-tight group-hover:text-(--accent) transition-colors">{music.currentTrack?.title}</div>
              <div className="text-[10px] text-[#9a8f7e] font-mono truncate leading-tight mt-0.5">{music.currentTrack?.artist}</div>
            </div>
          </button>
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center text-[#4a4038] hover:text-[#9a8f7e] transition-colors shrink-0 text-xs"
            aria-label="Hide player"
            title="Hide player — the music keeps going"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Progress. The 2px line is the visual; the padded row around it is the
            hit area — a 2px target is unhittable, and this is the only scrub
            control the widget has. */}
        <div className="px-3 pb-2">
          <div className="relative -my-1.5 flex items-center">
            {/* The 2px line the user sees. Padding around the input can't widen
                the target — the pointer still has to land on the input itself —
                so the line is painted here and the input above is a transparent
                16px strip. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 rounded-full"
              style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, #2a2520 ${pct}%)` }}
            />
            <input
              type="range"
              min={0}
              max={music.duration || 100}
              step={0.5}
              value={music.progress}
              onChange={(e) => music.handleSeek(parseFloat(e.target.value))}
              aria-label="Seek"
              className="relative w-full h-4 appearance-none cursor-pointer bg-transparent"
              style={{ accentColor: "var(--accent)" }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] font-mono text-[#4a4038]">{music.formatTime(music.progress)}</span>
            <span className="text-[9px] font-mono text-[#4a4038]">{music.formatTime(music.duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-1.5 px-3 pb-3">
          <button onClick={() => music.skipBack(10)}    aria-label="Back 10 seconds" className="w-7 h-7 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-[9px] font-mono"><span aria-hidden="true">−10</span></button>
          <button onClick={music.prevTrack}             aria-label="Previous track" className="w-7 h-7 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors"><SkipBack size={16} strokeWidth={1.75} fill="currentColor" /></button>
          <button
            onClick={music.togglePlay}
            aria-label={music.isPlaying ? "Pause" : "Play"}
            className="w-9 h-9 rounded-full bg-(--accent) flex items-center justify-center text-white hover:bg-[#c2500f] transition-all hover:scale-105 active:scale-95"
            style={{ boxShadow: "0 4px 16px rgba(var(--accent-rgb),0.35)" }}
          >
            {music.isPlaying ? (
              <Pause size={16} strokeWidth={1.75} fill="currentColor" />
            ) : (
              <Play size={16} strokeWidth={1.75} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <button onClick={music.nextTrack}             aria-label="Next track" className="w-7 h-7 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors"><SkipForward size={16} strokeWidth={1.75} fill="currentColor" /></button>
          <button onClick={() => music.skipForward(10)} aria-label="Forward 10 seconds" className="w-7 h-7 flex items-center justify-center text-[#9a8f7e] hover:text-white transition-colors text-[9px] font-mono"><span aria-hidden="true">+10</span></button>
        </div>
      </div>
    </div>
  );
}
