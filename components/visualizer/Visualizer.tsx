// components/visualizer/Visualizer.tsx
// The Haze behind an anchor element (album art, timer ring). Owns one canvas
// and one rAF loop; reads the shared analyser through audio.ts. Per-frame
// values live in refs — nothing here sets React state in the loop.
//
// Used by FocusMode (Timer + Listen) and the Music panel. Only the most
// recently mounted instance draws: FocusMode opens over the Music panel, and
// two shader loops for one visible haze is wasted GPU on a phone.
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { extractAccent } from "@/lib/artColor";
import { createReader } from "./audio";
import { createHaze, type HazeParams } from "./haze";

/** Keep drawing this long after pause so the haze settles instead of freezing mid-beat. */
const SETTLE_S = 2.5;
/** Seconds for the colour to ease to a new track's cover colour. */
const COLOR_EASE_S = 0.5;
/** Skip frames faster than ~60 fps — a 120 Hz phone would otherwise double the GPU work for no visible gain. */
const MIN_FRAME_MS = 15;
/** Reduced-motion level. 0.35 matches the old static Focus glow. */
const STILL_BASS = 0.35;

// Instance stack, sorted by mount order — only the top one draws. Ordering by
// mount, not by claim time, so an instance whose effect re-runs underneath
// (context restored, `armed` flip) can't steal the draw from the one on top.
type Slot = { order: number; set: (on: boolean) => void };
const stack: Slot[] = [];
let mounts = 0;
function claim(slot: Slot) {
  const top = stack[stack.length - 1];
  let i = stack.length;
  while (i > 0 && stack[i - 1].order > slot.order) i--;
  stack.splice(i, 0, slot);
  if (i === stack.length - 1) { top?.set(false); slot.set(true); }
  else slot.set(false);
  return () => {
    const j = stack.indexOf(slot);
    if (j < 0) return;
    stack.splice(j, 1);
    if (j === stack.length) stack[stack.length - 1]?.set(true);
  };
}

function parseRgb(s: string): [number, number, number] {
  const p = s.split(",").map((x) => parseInt(x, 10));
  return p.length === 3 && p.every((n) => Number.isFinite(n)) ? [p[0], p[1], p[2]] : [249, 115, 22];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function Visualizer({
  analyser,
  armed,
  isPlaying,
  accentRgb,
  coverUrl,
  anchorRef,
  layoutKey,
}: {
  analyser: RefObject<AnalyserNode | null>;
  /** True once playback has started — MusicContext creates the analyser lazily. */
  armed: boolean;
  isPlaying: boolean;
  /** "r, g, b" from useAccentColor() — the fallback when the cover has no usable colour. */
  accentRgb: string;
  coverUrl: string;
  /** The element the haze centres on. Read every frame, so it may be swapped. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Change this when the anchor swaps or moves, so an idle haze repaints there. */
  layoutKey?: string | number | boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The colour comes from the cover itself, not the app accent — it follows
  // the art whether or not Auto-Theme is on. `rgbRef` is what the loop draws
  // with; it eases toward `targetRef`.
  const [initialRgb] = useState(() => parseRgb(accentRgb));
  const accentFallback = useRef(initialRgb);
  const coverRgb = useRef<[number, number, number] | null>(null);
  const targetRef = useRef<[number, number, number]>(initialRgb);
  const rgbRef = useRef<[number, number, number]>([...initialRgb]);
  const playingRef = useRef(isPlaying);
  /** Wakes the loop, or redraws the still frame — set by the main effect. */
  const pokeRef = useRef<(() => void) | null>(null);
  // Bumped on webglcontextrestored to rebuild everything.
  const [gen, setGen] = useState(0);
  const [order] = useState(() => ++mounts);

  useEffect(() => {
    accentFallback.current = parseRgb(accentRgb);
    if (!coverRgb.current) targetRef.current = accentFallback.current;
    pokeRef.current?.();
  }, [accentRgb]);

  useEffect(() => {
    let live = true;
    coverRgb.current = null;
    targetRef.current = accentFallback.current;
    if (coverUrl) {
      extractAccent(coverUrl).then((hex) => {
        if (!live || !hex) return;
        coverRgb.current = hexToRgb(hex);
        targetRef.current = coverRgb.current;
        pokeRef.current?.();
      });
    }
    pokeRef.current?.();
    return () => { live = false; };
  }, [coverUrl]);

  useEffect(() => { pokeRef.current?.(); }, [layoutKey]);

  useEffect(() => {
    playingRef.current = isPlaying;
    if (isPlaying) pokeRef.current?.();
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coarse = matchMedia("(pointer: coarse)").matches;
    // rAF loops bypass the global reduced-motion CSS — check it here.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const haze = createHaze(canvas, coarse ? 3 : 4);
    if (!haze) return;
    const an = armed ? analyser.current : null;
    const read = an && !reduce ? createReader(an) : null;

    // Backing-store scale in CSS px. The haze is all soft falloff, so it
    // renders well under native resolution and the bilinear upscale hides it:
    // phones at 0.4 (≈1/5 the pixels of 0.5 × dpr 1.5), desktop at half dpr.
    const scale = coarse ? 0.4 : Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    function resize() {
      const cw = canvas!.clientWidth, ch = canvas!.clientHeight;
      if (!cw || !ch) return;
      canvas!.width = Math.max(1, Math.round(cw * scale));
      canvas!.height = Math.max(1, Math.round(ch * scale));
    }

    const p: HazeParams = {
      ax: 0, ay: 0, aSize: 0, w: 0, h: 0, t: 0,
      bass: reduce ? STILL_BASS : 0, mid: 0, high: 0,
      rgb: rgbRef.current,
    };
    function frame(snapColor: boolean) {
      const cr = canvas!.getBoundingClientRect();
      if (!cr.width || !cr.height) return;
      const sx = canvas!.width / cr.width, sy = canvas!.height / cr.height;
      const ar = anchorRef.current?.getBoundingClientRect();
      p.w = canvas!.width;
      p.h = canvas!.height;
      if (ar && ar.width) {
        p.ax = (ar.left + ar.width / 2 - cr.left) * sx;
        p.ay = (ar.top + ar.height / 2 - cr.top) * sy;
        p.aSize = ar.width * sx;
      } else {
        p.ax = p.w / 2; p.ay = p.h / 2; p.aSize = Math.min(p.w, p.h) * 0.4;
      }
      if (snapColor) rgbRef.current.splice(0, 3, ...targetRef.current);
      haze!.draw(p);
    }

    let active = false;   // top of the instance stack
    let visible = true;   // on screen (IntersectionObserver)
    let running = false;
    let raf = 0, last = 0, lastDraw = 0, pausedFor = 0;

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pausedFor = playingRef.current ? 0 : pausedFor + dt;
      if (now - lastDraw >= MIN_FRAME_MS) {
        const fdt = Math.min(0.1, (now - lastDraw) / 1000);
        lastDraw = now;
        const lv = read!();
        p.t += fdt;
        p.bass = lv.bass; p.mid = lv.mid; p.high = lv.high;
        // Exponential ease toward the target colour, frame-rate independent.
        const k = 1 - Math.exp((-fdt * 4.6) / COLOR_EASE_S); // ~99% in COLOR_EASE_S
        const c = rgbRef.current, tg = targetRef.current;
        for (let i = 0; i < 3; i++) c[i] += (tg[i] - c[i]) * k;
        frame(false);
      }
      if (pausedFor > SETTLE_S || !active || !visible) { running = false; return; }
      raf = requestAnimationFrame(tick);
    }

    // Start the loop if it may run; otherwise just repaint the current frame
    // (still mode, settled after pause, colour change while idle).
    function poke() {
      if (!active || running) return;
      if (!read || !visible || (!playingRef.current && pausedFor > SETTLE_S)) {
        frame(true);
        return;
      }
      running = true;
      last = lastDraw = performance.now();
      raf = requestAnimationFrame(tick);
    }
    pokeRef.current = poke;

    resize();
    const ro = new ResizeObserver(() => { resize(); if (active && !running) frame(false); });
    ro.observe(canvas);
    if (anchorRef.current) ro.observe(anchorRef.current);

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) poke(); });
    io.observe(canvas);

    const release = claim({ order, set: (on) => { active = on; if (on) { pausedFor = 0; poke(); } } });

    // Phones drop GPU contexts under memory pressure. preventDefault asks for
    // it back; on restore, rebuild everything from scratch.
    function onLost(e: Event) { e.preventDefault(); cancelAnimationFrame(raf); running = false; active = false; }
    function onRestored() { setGen((g) => g + 1); }
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      cancelAnimationFrame(raf);
      running = false;
      pokeRef.current = null;
      release();
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      haze.dispose();
    };
    // anchorRef is a stable ref; analyser is read when `armed` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, gen]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
