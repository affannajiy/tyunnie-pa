"use client";

import { useState, useRef, useEffect } from "react";

type Phase = "idle" | "ping" | "download" | "upload" | "done";

interface Results {
  ping: number | null;
  jitter: number | null;
  download: number | null;
  upload: number | null;
}

const CF = "https://speed.cloudflare.com";
const TEST_MS = 10_000; // 10-second window per phase

// Aborts when any of the given signals aborts
function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { ctrl.abort(); return ctrl.signal; }
    sig.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
}

function safeDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

async function runPing(signal: AbortSignal): Promise<{ avg: number; jitter: number }> {
  const times: number[] = [];
  for (let i = 0; i < 10; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const t0 = performance.now();
    try {
      await fetch(`${CF}/__latency?i=${i}&t=${Date.now()}`, { cache: "no-store", signal });
    } catch (err) {
      if ((err as DOMException).name === "AbortError") throw err;
      try {
        await fetch(`/?_p=${Date.now()}`, { method: "HEAD", cache: "no-store", signal });
      } catch (err2) {
        if ((err2 as DOMException).name === "AbortError") throw err2;
        await safeDelay(20 + Math.random() * 60, signal);
      }
    }
    times.push(performance.now() - t0);
  }
  const s = times.slice(2); // drop 2 cold-start samples
  const avg = s.reduce((a, b) => a + b) / s.length;
  const jitter = Math.sqrt(s.map((v) => (v - avg) ** 2).reduce((a, b) => a + b) / s.length);
  return { avg: Math.round(avg), jitter: Math.round(jitter) };
}

// 4 parallel streams downloading for TEST_MS; accumulate bytes into bytesRef
async function runTimedDownload(userSignal: AbortSignal, bytesRef: { current: number }): Promise<void> {
  const timeCtrl = new AbortController();
  const timer = setTimeout(() => timeCtrl.abort(), TEST_MS + 2000);
  const signal = anySignal([userSignal, timeCtrl.signal]);
  const start = performance.now();

  async function worker() {
    while (!signal.aborted && performance.now() - start < TEST_MS) {
      try {
        const res = await fetch(`${CF}/__down?bytes=25000000&t=${Date.now()}`, { cache: "no-store", signal });
        const reader = res.body?.getReader();
        if (reader) {
          for (;;) {
            if (signal.aborted || performance.now() - start >= TEST_MS) {
              reader.cancel().catch(() => {});
              return;
            }
            const { done, value } = await reader.read();
            if (done) break;
            bytesRef.current += value.byteLength;
          }
        }
      } catch {
        if (signal.aborted || userSignal.aborted) return;
        await safeDelay(150, signal).catch(() => {});
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()));
  clearTimeout(timer);
}

// 3 parallel upload streams for TEST_MS; 2MB chunks
async function runTimedUpload(userSignal: AbortSignal, bytesRef: { current: number }): Promise<void> {
  const timeCtrl = new AbortController();
  const timer = setTimeout(() => timeCtrl.abort(), TEST_MS + 2000);
  const signal = anySignal([userSignal, timeCtrl.signal]);
  const start = performance.now();
  const CHUNK = 2_000_000;

  async function worker() {
    while (!signal.aborted && performance.now() - start < TEST_MS) {
      const body = new Uint8Array(CHUNK);
      try {
        await fetch(`${CF}/__up`, { method: "POST", body, cache: "no-store", signal });
        bytesRef.current += CHUNK;
      } catch {
        if (signal.aborted || userSignal.aborted) return;
        await safeDelay(150, signal).catch(() => {});
      }
    }
  }

  await Promise.all(Array.from({ length: 3 }, () => worker()));
  clearTimeout(timer);
}

// ── Circular gauge ──
const R = 78;
const CIRC = 2 * Math.PI * R; // ≈ 490

interface DialProps {
  speed: number | null;
  phase: Phase;
  progress: number; // 0–1
}

function SpeedDial({ speed, phase, progress }: DialProps) {
  const active = phase === "download" || phase === "upload";
  const offset = CIRC * (1 - Math.min(progress, 1));
  const color = phase === "upload" ? "#38bdf8" : "var(--accent)";
  const label = phase === "ping" ? "Pinging…" : phase === "download" ? "Download" : phase === "upload" ? "Upload" : "";

  return (
    <div className="flex flex-col items-center my-4">
      <div className="relative w-52 h-52">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle cx="100" cy="100" r={R} fill="none" stroke="#e8e2d8" strokeWidth="10" />
          {/* Progress arc */}
          {(active || phase === "done") && (
            <circle
              cx="100" cy="100" r={R}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.25s linear" }}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          {phase === "ping" ? (
            <div
              className="w-7 h-7 rounded-full border-[3px] animate-spin"
              style={{ borderColor: "rgba(var(--accent-rgb),0.25)", borderTopColor: "var(--accent)" }}
            />
          ) : active && speed != null ? (
            <>
              <span className="text-4xl font-bold tabular-nums leading-none" style={{ color }}>
                {speed}
              </span>
              <span className="text-xs text-[#9a8f7e] font-mono mt-1">Mbps</span>
            </>
          ) : active ? (
            <div
              className="w-7 h-7 rounded-full border-[3px] animate-spin"
              style={{ borderColor: `${color}40`, borderTopColor: color }}
            />
          ) : phase === "done" ? (
            <span className="text-4xl" style={{ color: "var(--accent)" }}>✓</span>
          ) : (
            <span className="text-3xl font-bold text-[#c4b9a8]">—</span>
          )}

          {label !== "" && phase !== "done" && (
            <span className="text-[11px] text-[#9a8f7e] font-mono mt-2">{label}</span>
          )}

          {/* Countdown ring label */}
          {active && (
            <span className="text-[10px] text-[#b0a090] font-mono mt-0.5">
              {Math.max(0, Math.ceil((1 - progress) * 10))}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small result card ──
function ResultCard({ label, value, unit, icon }: { label: string; value: number | null; unit: string; icon: string }) {
  return (
    <div className="flex flex-col items-center p-4 bg-white dark:bg-[#1a1612] border border-[#e8e2d8] dark:border-[#2a2520] rounded-2xl flex-1 min-w-0">
      <span className="text-xl mb-2">{icon}</span>
      <p className="text-[10px] text-[#9a8f7e] font-mono uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: value != null ? "var(--accent)" : "#c4b9a8" }}>
        {value != null ? value : "—"}
      </p>
      <p className="text-[10px] text-[#9a8f7e] mt-0.5">{unit}</p>
    </div>
  );
}

// ── Main component ──
export default function SpeedTest() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<Results>({ ping: null, jitter: null, download: null, upload: null });
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const bytesRef = useRef(0);
  const phaseStartRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function startTick() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const elapsed = (performance.now() - phaseStartRef.current) / 1000;
      setProgress(Math.min(elapsed / (TEST_MS / 1000), 1));
      if (elapsed > 0.1 && bytesRef.current > 0) {
        setLiveSpeed(+((bytesRef.current * 8) / (elapsed * 1e6)).toFixed(1));
      }
    }, 200);
  }

  function stopTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }

  const isRunning = phase !== "idle" && phase !== "done";

  async function startTest() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const sig = ctrl.signal;

    setResults({ ping: null, jitter: null, download: null, upload: null });
    setLiveSpeed(null);
    setProgress(0);

    try {
      // ── Ping ──
      setPhase("ping");
      const { avg, jitter } = await runPing(sig);
      setResults((r) => ({ ...r, ping: avg, jitter }));

      // ── Download ──
      setPhase("download");
      bytesRef.current = 0;
      phaseStartRef.current = performance.now();
      setProgress(0);
      setLiveSpeed(null);
      startTick();
      await runTimedDownload(sig, bytesRef);
      stopTick();
      const dlElapsed = (performance.now() - phaseStartRef.current) / 1000;
      const dl = +((bytesRef.current * 8) / (dlElapsed * 1e6)).toFixed(1);
      setResults((r) => ({ ...r, download: dl }));
      setLiveSpeed(null);
      setProgress(1);

      // ── Upload ──
      setPhase("upload");
      bytesRef.current = 0;
      phaseStartRef.current = performance.now();
      setProgress(0);
      setLiveSpeed(null);
      startTick();
      await runTimedUpload(sig, bytesRef);
      stopTick();
      const ulElapsed = (performance.now() - phaseStartRef.current) / 1000;
      const ul = +((bytesRef.current * 8) / (ulElapsed * 1e6)).toFixed(1);
      setResults((r) => ({ ...r, upload: ul }));
      setLiveSpeed(null);
      setProgress(1);

      setPhase("done");
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") console.error(e);
      stopTick();
      setPhase("idle");
      setLiveSpeed(null);
      setProgress(0);
    }
  }

  function cancelTest() {
    abortRef.current?.abort();
    stopTick();
    setPhase("idle");
    setLiveSpeed(null);
    setProgress(0);
  }

  return (
    <div>
      <div className="mb-2">
        <h1 className="font-serif italic text-2xl text-[#111010] dark:text-[#f0ece4] mb-1">Speed Test</h1>
        <p className="text-sm text-[#9a8f7e]">10 seconds each — ping, download, upload.</p>
      </div>

      {/* Circular gauge */}
      <SpeedDial speed={liveSpeed} phase={phase} progress={progress} />

      {/* Result cards */}
      <div className="flex gap-3 mb-4">
        <ResultCard label="Ping" value={results.ping} unit="ms" icon="📡" />
        <ResultCard label="Download" value={results.download} unit="Mbps" icon="⬇️" />
        <ResultCard label="Upload" value={results.upload} unit="Mbps" icon="⬆️" />
      </div>

      {results.jitter != null && (
        <p className="text-xs text-[#9a8f7e] text-center mb-4 font-mono">
          Jitter <span style={{ color: "var(--accent)" }}>{results.jitter} ms</span>
        </p>
      )}

      <div className="flex justify-center gap-3">
        {!isRunning && (
          <button
            onClick={startTest}
            className="px-8 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {phase === "done" ? "Test Again" : "Start Test"}
          </button>
        )}
        {isRunning && (
          <button
            onClick={cancelTest}
            className="px-8 py-2.5 rounded-xl font-semibold text-sm border border-[#e8e2d8] dark:border-[#2a2520] text-[#9a8f7e] hover:border-red-300 hover:text-red-500 transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
