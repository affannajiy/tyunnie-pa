// lib/gameAudio.ts
// Tiny tactile sounds for the games, synthesised with Web Audio. No asset
// files, no network, nothing for the CSP to allow. Default off — a notes app
// should not make noise until asked — and gated on the shared game setting.
//
// The AudioContext is created lazily on the first play() after a user gesture
// (autoplay policy) and shared by every game. Keep every cue under ~150ms:
// these are chip clicks and tile clacks, not a soundtrack.

"use client";

export type Cue =
  | "chip"      // chip lands in the bet circle
  | "card"      // card dealt
  | "flip"      // hole card revealed
  | "tile"      // mahjong tile placed / discarded
  | "draw"      // mahjong tile drawn
  | "claim"     // pong / chow / kong called
  | "win"       // hand won
  | "lose"      // bust / hand lost
  | "push"      // push / draw
  | "shuffle"   // shoe reshuffled
  | "place"     // mark / digit / card placed on a board
  | "move"      // chess piece moved
  | "capture"   // chess capture
  | "check"     // king in check
  | "reveal"    // minesweeper cell opened
  | "boom"      // mine hit
  | "drop"      // tetris hard drop
  | "lock"      // tetris piece locks
  | "clear"     // line(s) cleared / puzzle row completed
  | "undo";     // move taken back

let ctx: AudioContext | null = null;
let enabled = false;

/** The game settings hook calls this; play() is a no-op until it is true. */
export function setAudioEnabled(on: boolean) {
  enabled = on;
  if (on && ctx?.state === "suspended") void ctx.resume();
}

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Short filtered noise burst — the "clack" of a chip, card or tile. */
function noise(ac: AudioContext, at: number, dur: number, freq: number, gain: number, q = 1) {
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(at);
  src.stop(at + dur);
}

/** Sine blip with a quick decay — the "ding" of a win or a claim. */
function tone(ac: AudioContext, at: number, dur: number, freq: number, gain: number, type: OscillatorType = "sine") {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + dur);
}

export function play(cue: Cue) {
  if (!enabled) return;
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  switch (cue) {
    case "chip":
      noise(ac, t, 0.05, 2600, 0.25, 2);
      tone(ac, t, 0.06, 1900, 0.08, "triangle");
      break;
    case "card":
      noise(ac, t, 0.07, 900, 0.18, 0.7);
      break;
    case "flip":
      noise(ac, t, 0.05, 1400, 0.15, 0.8);
      noise(ac, t + 0.04, 0.06, 700, 0.12, 0.8);
      break;
    case "tile":
      noise(ac, t, 0.04, 3200, 0.3, 3);
      tone(ac, t, 0.05, 2400, 0.06, "square");
      break;
    case "draw":
      noise(ac, t, 0.05, 1800, 0.12, 1.5);
      break;
    case "claim":
      tone(ac, t, 0.09, 660, 0.12);
      tone(ac, t + 0.07, 0.12, 880, 0.12);
      break;
    case "win":
      tone(ac, t, 0.12, 659, 0.12);
      tone(ac, t + 0.1, 0.12, 830, 0.12);
      tone(ac, t + 0.2, 0.22, 1046, 0.14);
      break;
    case "lose":
      tone(ac, t, 0.16, 330, 0.12, "triangle");
      tone(ac, t + 0.12, 0.22, 247, 0.12, "triangle");
      break;
    case "push":
      tone(ac, t, 0.14, 494, 0.1, "triangle");
      break;
    case "shuffle":
      for (let i = 0; i < 6; i++) noise(ac, t + i * 0.035, 0.05, 1100 + i * 150, 0.09, 0.8);
      break;
    case "place":
      noise(ac, t, 0.04, 2200, 0.2, 2);
      tone(ac, t, 0.05, 1500, 0.05, "triangle");
      break;
    case "move":
      noise(ac, t, 0.05, 1200, 0.2, 1);
      break;
    case "capture":
      noise(ac, t, 0.06, 700, 0.25, 0.8);
      noise(ac, t + 0.03, 0.05, 1600, 0.15, 1.5);
      break;
    case "check":
      tone(ac, t, 0.1, 880, 0.1, "square");
      tone(ac, t + 0.09, 0.1, 880, 0.08, "square");
      break;
    case "reveal":
      noise(ac, t, 0.035, 2800, 0.12, 2);
      break;
    case "boom":
      noise(ac, t, 0.3, 160, 0.5, 0.5);
      tone(ac, t, 0.28, 90, 0.2, "sawtooth");
      break;
    case "drop":
      noise(ac, t, 0.06, 500, 0.25, 0.7);
      break;
    case "lock":
      noise(ac, t, 0.04, 1500, 0.12, 1.5);
      break;
    case "clear":
      tone(ac, t, 0.08, 784, 0.1);
      tone(ac, t + 0.06, 0.12, 1175, 0.1);
      break;
    case "undo":
      tone(ac, t, 0.08, 520, 0.07, "triangle");
      tone(ac, t + 0.06, 0.08, 390, 0.07, "triangle");
      break;
  }
}
