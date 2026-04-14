// components/Music.tsx
"use client";

import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addMusicTrack } from "@/lib/database";

type UploadState = "idle" | "uploading" | "done" | "error";

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
    refreshTracks,
    deleteUserTrack,
  } = useMusicContext();

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  const coverRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // ── View: queue or manage ──
  const [view, setView] = useState<"queue" | "manage">("queue");

  // ── Upload form state ──
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ── Audio glow — DOM ref, not state ──
  useEffect(() => {
    const rgb = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-rgb").trim() || "249,115,22";

    if (!isPlaying || !analyser?.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (coverRef.current)
        coverRef.current.style.boxShadow = `0 0 20px rgba(${rgb},0.15)`;
      return;
    }

    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);

    function tick() {
      if (!analyser?.current || !coverRef.current) return;
      analyser.current.getByteFrequencyData(dataArray);
      const slice = dataArray.slice(0, 10);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      const g = avg / 255;
      coverRef.current.style.boxShadow = `0 0 ${20 + g * 80}px ${g * 30}px rgba(${rgb},${0.15 + g * 0.65})`;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, analyser]);

  // ── Upload handler ──
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!audioFile || !title.trim() || !artist.trim()) return;

    setUploadState("uploading");
    setUploadError("");
    setUploadPct(10);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ts = Date.now();
      const safeTitle = title.trim().replace(/[^a-z0-9]/gi, "-").toLowerCase();

      // Upload audio
      const audioExt = audioFile.name.split(".").pop() ?? "mp3";
      const audioPath = `${user.id}/${ts}-${safeTitle}.${audioExt}`;
      const { error: audioErr } = await supabase.storage
        .from("music-audio")
        .upload(audioPath, audioFile, { upsert: false });
      if (audioErr) throw new Error(`Audio upload failed: ${audioErr.message}`);
      setUploadPct(60);

      const { data: { publicUrl: fileUrl } } = supabase.storage
        .from("music-audio")
        .getPublicUrl(audioPath);

      // Upload cover (optional)
      let coverUrl: string | null = null;
      if (coverFile) {
        const coverExt = coverFile.name.split(".").pop() ?? "jpg";
        const coverPath = `${user.id}/${ts}-${safeTitle}-cover.${coverExt}`;
        const { error: coverErr } = await supabase.storage
          .from("music-covers")
          .upload(coverPath, coverFile, { upsert: false });
        if (!coverErr) {
          const { data: { publicUrl } } = supabase.storage
            .from("music-covers")
            .getPublicUrl(coverPath);
          coverUrl = publicUrl;
        }
      }
      setUploadPct(85);

      // Save to DB
      await addMusicTrack(user.id, {
        title: title.trim(),
        artist: artist.trim(),
        file_url: fileUrl,
        cover_url: coverUrl,
        position: tracks.filter((t) => t.isUserTrack).length,
      });
      setUploadPct(100);
      setUploadState("done");

      // Reset form
      setTitle("");
      setArtist("");
      setAudioFile(null);
      setCoverFile(null);
      if (audioInputRef.current) audioInputRef.current.value = "";
      if (coverInputRef.current) coverInputRef.current.value = "";

      refreshTracks();

      setTimeout(() => {
        setUploadState("idle");
        setUploadPct(0);
      }, 2000);
    } catch (err) {
      setUploadState("error");
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadPct(0);
    }
  }

  const userTracks = tracks.filter((t) => t.isUserTrack);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] bg-[#111010] rounded-2xl overflow-hidden border border-[#2a2520] relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(var(--accent-rgb),0.08) 0%, transparent 60%)",
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
              <p className="mb-1">No tracks yet.</p>
              <p className="text-[10px] font-mono text-[#f97316]">
                Use the + button to add your first song.
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
            style={{ boxShadow: "0 4px 20px rgba(var(--accent-rgb),0.4)" }}
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

      {/* ── RIGHT: QUEUE / MANAGE ── */}
      <div
        className="flex-1 overflow-y-auto p-6 border-t lg:border-t-0 lg:border-l border-[#2a2520] z-10"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2520 transparent" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          {view === "manage" ? (
            <button
              onClick={() => setView("queue")}
              className="text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono flex items-center gap-1"
            >
              ← Queue
            </button>
          ) : (
            <span className="font-serif italic text-[#f97316] text-sm">
              Queue
            </span>
          )}
          <div className="flex-1 h-px bg-[#2a2520]" />
          {view === "queue" && (
            <span className="text-[10px] font-mono text-[#9a8f7e]">
              {tracks.length} tracks
            </span>
          )}
          <button
            onClick={() => setView(view === "queue" ? "manage" : "queue")}
            title={view === "queue" ? "Add track" : "Back to queue"}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
              view === "manage"
                ? "bg-[#f97316]/20 text-[#f97316]"
                : "bg-[#f97316]/15 text-[#f97316] hover:bg-[#f97316]/25"
            }`}
          >
            {view === "manage" ? "✕ close" : "+ add"}
          </button>
        </div>

        {/* ── QUEUE VIEW ── */}
        {view === "queue" && (
          <>
            {tracks.length === 0 && (
              <div className="text-center py-16 text-[#4a4038]">
                <div className="text-4xl mb-4">🎵</div>
                <p className="text-sm font-mono">No tracks yet.</p>
                <button
                  onClick={() => setView("manage")}
                  className="mt-3 text-xs text-[#f97316] hover:underline font-mono"
                >
                  + Add your first track
                </button>
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
                      {track.isUserTrack && (
                        <span className="ml-2 text-[#f97316]/50">↑</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── MANAGE VIEW ── */}
        {view === "manage" && (
          <div className="flex flex-col gap-6">
            {/* Upload form */}
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <p className="font-serif italic text-[#f97316] text-sm">
                Add a track
              </p>

              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1410] border border-[#2a2520] text-white text-sm placeholder-[#4a4038] focus:outline-none focus:border-[#f97316]/50 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1410] border border-[#2a2520] text-white text-sm placeholder-[#4a4038] focus:outline-none focus:border-[#f97316]/50 transition-colors"
                />

                {/* Audio file */}
                <label className="flex flex-col gap-1 cursor-pointer group">
                  <span className="text-[10px] font-mono text-[#9a8f7e]">
                    Audio file <span className="text-[#f97316]">*</span>
                  </span>
                  <div
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      audioFile
                        ? "bg-[#f97316]/10 border-[#f97316]/30"
                        : "bg-[#1a1410] border-[#2a2520] hover:border-[#f97316]/30"
                    }`}
                  >
                    <span className="text-base">🎵</span>
                    <span className="text-xs text-[#9a8f7e] truncate flex-1">
                      {audioFile ? audioFile.name : "Choose MP3 / M4A / WAV / FLAC"}
                    </span>
                    {audioFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setAudioFile(null);
                          if (audioInputRef.current) audioInputRef.current.value = "";
                        }}
                        className="text-[#4a4038] hover:text-[#9a8f7e] text-xs shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept=".mp3,.m4a,.wav,.flac,audio/*"
                    className="sr-only"
                    onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                {/* Cover image */}
                <label className="flex flex-col gap-1 cursor-pointer group">
                  <span className="text-[10px] font-mono text-[#9a8f7e]">
                    Cover image{" "}
                    <span className="text-[#4a4038]">(optional)</span>
                  </span>
                  <div
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      coverFile
                        ? "bg-[#f97316]/10 border-[#f97316]/30"
                        : "bg-[#1a1410] border-[#2a2520] hover:border-[#f97316]/30"
                    }`}
                  >
                    <span className="text-base">🖼</span>
                    <span className="text-xs text-[#9a8f7e] truncate flex-1">
                      {coverFile ? coverFile.name : "Choose JPG / PNG / WebP"}
                    </span>
                    {coverFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setCoverFile(null);
                          if (coverInputRef.current) coverInputRef.current.value = "";
                        }}
                        className="text-[#4a4038] hover:text-[#9a8f7e] text-xs shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                    className="sr-only"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {/* Progress bar */}
              {uploadState === "uploading" && (
                <div className="w-full h-1 bg-[#2a2520] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#f97316] rounded-full transition-all duration-300"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              )}

              {uploadState === "error" && (
                <p className="text-xs text-red-400 font-mono">{uploadError}</p>
              )}

              {uploadState === "done" && (
                <p className="text-xs text-green-400 font-mono">
                  Track added successfully ✓
                </p>
              )}

              <button
                type="submit"
                disabled={uploadState === "uploading" || !audioFile || !title.trim() || !artist.trim()}
                className="w-full py-2 rounded-xl bg-[#f97316] text-white text-sm font-semibold hover:bg-[#c2500f] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {uploadState === "uploading" ? "Uploading…" : "Upload Track"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#2a2520]" />
              <span className="text-[10px] font-mono text-[#4a4038]">
                your uploads · {userTracks.length}
              </span>
              <div className="flex-1 h-px bg-[#2a2520]" />
            </div>

            {/* User-uploaded track list */}
            {userTracks.length === 0 ? (
              <p className="text-center text-xs font-mono text-[#4a4038] py-4">
                No uploads yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {userTracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1410] border border-[#2a2520] group"
                  >
                    <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-[#111010] flex items-center justify-center">
                      {track.cover ? (
                        <Image
                          src={track.cover}
                          alt=""
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[#3a3028] text-sm">🎵</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-[#9a8f7e] font-mono truncate">
                        {track.artist}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        track.id &&
                        deleteUserTrack(track.id, track.file, track.cover || null)
                      }
                      title="Remove track"
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-[#4a4038] hover:text-red-400 hover:bg-red-400/10 transition-all text-sm shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes barBounce { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; background: #f97316; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
