// components/Music.tsx (or panels/Music.tsx)
"use client";

import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";
import { useRef, useEffect, useState } from "react";

export default function Music() {
  const {
    analyser,
    tracks,
    currentIndex,
    isPlaying,
    progress,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    currentTrack,
    togglePlay,
    playTrack,
    nextTrack,
    prevTrack,
    handleSeek,
    setVolume,
    setIsMuted,
    toggleShuffle,
    cycleRepeat,
    formatTime,
  } = useMusicContext();

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  const coverRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying || !analyser?.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (coverRef.current)
        coverRef.current.style.boxShadow = "0 0 20px rgba(249,115,22,0.15)";
      return;
    }

    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);

    function tick() {
      if (!analyser?.current || !coverRef.current) return;
      analyser.current.getByteFrequencyData(dataArray);
      const slice = dataArray.slice(0, 10);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      const g = avg / 255;
      coverRef.current.style.boxShadow = `0 0 ${20 + g * 80}px ${g * 30}px rgba(249,115,22,${0.15 + g * 0.65})`;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, analyser]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] bg-[#111010] rounded-2xl overflow-hidden border border-[#2a2520] relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(249,115,22,0.08) 0%, transparent 60%)",
        }}
      />

      {/* ── LEFT: NOW PLAYING ── */}
      <div className="flex flex-col items-center justify-center p-8 lg:w-95 lg:shrink-0 z-10">
        <div
          ref={coverRef}
          className="w-48 h-48 rounded-2xl mb-6 overflow-hidden"
        >
          {currentTrack?.cover ? (
            <Image
              src={currentTrack.cover}
              alt="cover"
              width={192}
              height={192}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#1a1410] flex items-center justify-center">
              <div className="text-5xl opacity-30">🎵</div>
            </div>
          )}
        </div>

        <div className="text-center mb-5 w-full max-w-xs">
          {tracks.length === 0 ? (
            <div className="text-[#9a8f7e] text-sm">
              <p className="mb-1">No tracks found.</p>
              <p className="text-[10px] font-mono">
                Add MP3s to{" "}
                <code className="text-[#f97316]">public/music/</code>
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-serif italic text-xl text-white mb-1 truncate">
                {currentTrack?.title ?? "Unknown"}
              </h2>
              <p className="text-[#9a8f7e] text-xs font-mono">
                {currentTrack?.artist ?? ""}
              </p>
            </>
          )}
        </div>

        <div className="w-full max-w-xs mb-4">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #f97316 ${progressPct}%, #2a2520 ${progressPct}%)`,
              accentColor: "#f97316",
            }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-[#9a8f7e]">
              {formatTime(progress)}
            </span>
            <span className="text-[10px] font-mono text-[#9a8f7e]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5 mb-5">
          <button
            onClick={toggleShuffle}
            title="Shuffle"
            className={`text-lg transition-all ${shuffle ? "text-[#f97316]" : "text-[#4a4038] hover:text-[#9a8f7e]"}`}
          >
            ⇄
          </button>
          <button
            onClick={prevTrack}
            className="w-10 h-10 flex items-center justify-center text-white hover:text-[#f97316] transition-colors text-xl"
          >
            ⏮
          </button>
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-[#f97316] flex items-center justify-center text-white text-2xl hover:bg-[#c2500f] transition-all hover:scale-105 active:scale-95"
            style={{ boxShadow: "0 4px 20px rgba(249,115,22,0.4)" }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            onClick={nextTrack}
            className="w-10 h-10 flex items-center justify-center text-white hover:text-[#f97316] transition-colors text-xl"
          >
            ⏭
          </button>
          <button
            onClick={cycleRepeat}
            title={`Repeat: ${repeat}`}
            className={`text-lg transition-all ${repeat !== "none" ? "text-[#f97316]" : "text-[#4a4038] hover:text-[#9a8f7e]"}`}
          >
            {repeat === "one" ? "↺¹" : "↺"}
          </button>
        </div>

        <div className="flex items-center gap-3 w-full max-w-xs">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-[#9a8f7e] hover:text-[#f97316] transition-colors text-sm w-5"
          >
            {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              setIsMuted(false);
            }}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #f97316 ${(isMuted ? 0 : volume) * 100}%, #2a2520 ${(isMuted ? 0 : volume) * 100}%)`,
              accentColor: "#f97316",
            }}
          />
          <span className="text-[10px] font-mono text-[#9a8f7e] w-7 text-right">
            {Math.round((isMuted ? 0 : volume) * 100)}
          </span>
        </div>
      </div>

      {/* ── RIGHT: TRACK LIST ── */}
      <div
        className="flex-1 overflow-y-auto p-6 border-t lg:border-t-0 lg:border-l border-[#2a2520] z-10"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#2a2520 transparent",
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <span className="font-serif italic text-[#f97316] text-sm">
            Queue
          </span>
          <div className="flex-1 h-px bg-[#2a2520]" />
          <span className="text-[10px] font-mono text-[#9a8f7e]">
            {tracks.length} tracks
          </span>
        </div>

        {tracks.length === 0 && (
          <div className="text-center py-16 text-[#4a4038]">
            <div className="text-4xl mb-4">🎵</div>
            <p className="text-sm font-mono">No tracks in playlist.</p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {tracks.map((track, i) => (
            <button
              key={i}
              onClick={() => playTrack(i)}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all group ${
                i === currentIndex
                  ? "bg-[#f97316]/15 border border-[#f97316]/30"
                  : "hover:bg-[#1a1410] border border-transparent"
              }`}
            >
              <div className="w-6 text-center shrink-0">
                {i === currentIndex && isPlaying ? (
                  <div className="flex items-end justify-center gap-px h-4">
                    {[0, 1, 2].map((bar) => (
                      <div
                        key={bar}
                        className="w-1 bg-[#f97316] rounded-full"
                        style={{
                          height: `${40 + bar * 20}%`,
                          animation: "barBounce 0.8s ease-in-out infinite",
                          animationDelay: `${bar * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] font-mono text-[#4a4038] group-hover:text-[#9a8f7e]">
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#1a1410] flex items-center justify-center">
                {track.cover ? (
                  <Image
                    src={track.cover}
                    alt=""
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[#3a3028] text-lg">🎵</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-semibold truncate ${i === currentIndex ? "text-[#f97316]" : "text-white"}`}
                >
                  {track.title}
                </div>
                <div className="text-[11px] text-[#9a8f7e] font-mono truncate">
                  {track.artist}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slowSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes barBounce { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; background: #f97316; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
