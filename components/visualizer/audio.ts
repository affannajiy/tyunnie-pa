// components/visualizer/audio.ts
// Reads the shared AnalyserNode once per frame and turns it into the three
// envelopes the Haze draws from. Pure per-frame maths — no DOM, no React.

export type Levels = {
  /** Fast-attack / smooth-decay envelopes, 0–1. */
  bass: number;
  mid: number;
  high: number;
};

const DECAY = 0.86; // same envelope feel as the old Focus glow
// Our own dB window. The node's byte output uses its default −100…−30 dB,
// which pins a modern master's bass at 0.9+ permanently (measured 0.83–0.99
// on the bundled tracks) — no dynamics left to draw. Reading floats and
// mapping a hotter window leaves the shared node's settings alone.
const DB_MIN = -75;
const DB_MAX = -12;

export function createReader(analyser: AnalyserNode) {
  const freq = new Float32Array(analyser.frequencyBinCount);
  const levels: Levels = { bass: 0, mid: 0, high: 0 };

  const hz = analyser.context.sampleRate / analyser.fftSize;
  const bin = (f: number) => Math.max(1, Math.round(f / hz));
  const ranges = {
    bass: [bin(30), bin(250)],
    mid: [bin(250), bin(2000)],
    high: [bin(2000), bin(9000)],
  } as const;
  const avg = ([a, b]: readonly [number, number]) => {
    let s = 0;
    for (let i = a; i < b; i++) {
      const v = (freq[i] - DB_MIN) / (DB_MAX - DB_MIN);
      s += v < 0 ? 0 : v > 1 ? 1 : v;
    }
    return s / Math.max(1, b - a);
  };
  const env = (prev: number, next: number) => (next > prev ? next : prev * DECAY + next * (1 - DECAY));

  return function read(): Levels {
    analyser.getFloatFrequencyData(freq);
    levels.bass = env(levels.bass, avg(ranges.bass));
    levels.mid = env(levels.mid, avg(ranges.mid));
    // Masters roll the highs off — lift them so the shimmer shows.
    levels.high = env(levels.high, Math.min(1, avg(ranges.high) * 1.8));
    return levels;
  };
}
