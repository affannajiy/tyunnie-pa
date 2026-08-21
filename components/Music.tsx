// components/Music.tsx
"use client";

import {
  X,
  Music2,
  VolumeX,
  Volume1,
  Volume2,
  Image as ImageIcon,
  Shuffle,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Repeat1,
} from "lucide-react";

import { confirmDialog } from "@/components/ui/ConfirmDialog";
import Image from "next/image";
import { useMusicContext } from "@/lib/MusicContext";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addMusicTrack } from "@/lib/database";
import { isGuest } from "@/lib/guest";
import { useAccentColor } from "@/lib/useAccentColor";

type UploadState = "idle" | "uploading" | "done" | "error";

// Upload limits. Storage buckets carry the authoritative
// `allowed_mime_types`/`file_size_limit` (see docs/DATABASE.md) — keep these in
// step with them so the user gets a readable reason instead of a rejected PUT.
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
]);
const MAX_AUDIO_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_COVER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5 MB

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
    skipBack,
    skipForward,
  } = useMusicContext();

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  const coverRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  // Live accent — re-renders on tyunnie-accent-changed (Auto-Theme, picker).
  const accentRgb = useAccentColor();

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
    // accentRgb comes from useAccentColor() and is in this effect's deps, so an
    // accent change (every track, with Auto-Theme on) tears the loop down and
    // restarts it with the new colour. Reading the CSS var here without that
    // dep captured it once at mount: the rAF loop then repainted the stale
    // colour 60x/sec AND, because it writes an inline style every frame, it
    // permanently clobbered the rgba(var(--accent-rgb),…) fallback in the JSX,
    // so the element could never recover on its own.
    const rgb = accentRgb;

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
  }, [isPlaying, analyser, accentRgb]);

  // ── Upload handler ──
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!audioFile || !title.trim() || !artist.trim()) return;
    if (isGuest()) {
      setUploadError("Uploads need an account — sign up to add your own tracks.");
      setUploadState("error");
      return;
    }

    // The `accept` attribute on the file input is a picker hint, not a control —
    // it constrains the dialog and nothing else. Check type and size here too,
    // matching the avatar upload in Profile.tsx. Bucket-level
    // `allowed_mime_types`/`file_size_limit` remain the authoritative gate; this
    // is the fast, explains-itself layer in front of it.
    if (!ALLOWED_AUDIO_TYPES.has(audioFile.type)) {
      setUploadError("That file isn't audio. Use an MP3, WAV, OGG, or M4A.");
      setUploadState("error");
      return;
    }
    if (audioFile.size > MAX_AUDIO_SIZE) {
      setUploadError("Track must be under 20 MB.");
      setUploadState("error");
      return;
    }
    if (coverFile) {
      if (!ALLOWED_COVER_TYPES.has(coverFile.type)) {
        setUploadError("Cover must be a PNG, JPEG, WebP, or GIF image.");
        setUploadState("error");
        return;
      }
      if (coverFile.size > MAX_COVER_SIZE) {
        setUploadError("Cover image must be under 5 MB.");
        setUploadState("error");
        return;
      }
    }

    setUploadState("uploading");
    setUploadError("");
    setUploadPct(10);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You need to be signed in to upload.");

      const ts = Date.now();
      const safeTitle = title.trim().replace(/[^a-z0-9]/gi, "-").toLowerCase();

      // Upload audio
      const audioExt = audioFile.name.split(".").pop() ?? "mp3";
      const audioPath = `${user.id}/${ts}-${safeTitle}.${audioExt}`;
      const { error: audioErr } = await supabase.storage
        .from("music-audio")
        .upload(audioPath, audioFile, { upsert: false });
      // §9: never surface the raw Supabase Storage message ("new row violates
      // row-level security policy", "The resource already exists"). Log it for
      // us, show the user a consequence and a next step.
      if (audioErr) {
        console.error("[music] audio upload failed", audioErr);
        throw new Error(
          "Couldn't upload that track. Check the file and your connection, then try again.",
        );
      }
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
      setUploadError(
        err instanceof Error ? err.message : "Couldn't upload that track.",
      );
      setUploadPct(0);
    }
  }

  const userTracks = tracks.filter((t) => t.isUserTrack);

  return (
    // `dvh`, not `vh`: on mobile `100vh` is the viewport with the URL bar
    // *hidden*, so the bottom of the panel sits under the browser chrome and the
    // dock. `min-h-` below lg because the two columns stack there — a fixed
    // height would have to fit both, and it can't.
    <div className="on-dark flex flex-col lg:flex-row min-h-[calc(100dvh-120px)] lg:h-[calc(100dvh-120px)] bg-[#111010] rounded-2xl overflow-hidden border border-[#2a2520] relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(var(--accent-rgb),0.08) 0%, transparent 60%)",
        }}
      />

      {/* ── LEFT: NOW PLAYING ── */}
      {/* shrink-0: stacked below lg, this block must keep its natural height or
          the playlist's flex-1 compresses the art and transport into nothing. */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-8 shrink-0 lg:w-95 z-10">
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
              <Music2 size={46} strokeWidth={1.5} className="opacity-30" />
            </div>
          )}
        </div>

        <div className="text-center mb-5 w-full max-w-xs">
          {tracks.length === 0 ? (
            <div className="text-[#b0a090] text-sm">
              <p className="mb-1">No tracks yet.</p>
              <p className="text-[10px] font-mono text-(--accent)">
                Use the + button to add your first song.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-serif italic text-xl text-white mb-1 truncate">
                {currentTrack?.title ?? "Unknown"}
              </h2>
              <p className="text-[#b0a090] text-xs font-mono">
                {currentTrack?.artist ?? ""}
              </p>
            </>
          )}
        </div>

        <div className="w-full max-w-xs mb-4">
          <input aria-label="Seek position"
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--accent) ${progressPct}%, #2a2520 ${progressPct}%)`,
              accentColor: "var(--accent)",
            }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-[#b0a090]">
              {formatTime(progress)}
            </span>
            <span className="text-[10px] font-mono text-[#b0a090]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={toggleShuffle}
            title="Shuffle"
            className={`transition-all ${shuffle ? "text-(--accent)" : "text-[#8f8272] hover:text-[#b0a090]"}`}
          >
            <Shuffle size={16} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => skipBack(10)}
            title="Back 10s"
            className="text-[10px] font-mono text-[#8f8272] hover:text-[#b0a090] transition-colors w-7 text-center leading-none"
          >
            −10
          </button>
          <button
            onClick={prevTrack}
            aria-label="Previous track"
            className="w-9 h-9 flex items-center justify-center text-white hover:text-(--accent) transition-colors"
          >
            <SkipBack size={18} strokeWidth={1.75} fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="w-14 h-14 rounded-full bg-(--accent) flex items-center justify-center text-white hover:bg-[#c2500f] transition-all hover:scale-105 active:scale-95"
            style={{ boxShadow: "0 4px 20px rgba(var(--accent-rgb),0.4)" }}
          >
            {isPlaying ? (
              <Pause size={22} strokeWidth={1.75} fill="currentColor" />
            ) : (
              <Play size={22} strokeWidth={1.75} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <button
            onClick={nextTrack}
            aria-label="Next track"
            className="w-9 h-9 flex items-center justify-center text-white hover:text-(--accent) transition-colors"
          >
            <SkipForward size={18} strokeWidth={1.75} fill="currentColor" />
          </button>
          <button
            onClick={() => skipForward(10)}
            title="Forward 10s"
            className="text-[10px] font-mono text-[#8f8272] hover:text-[#b0a090] transition-colors w-7 text-center leading-none"
          >
            +10
          </button>
          <button
            onClick={cycleRepeat}
            title={`Repeat: ${repeat}`}
            className={`transition-all ${repeat !== "none" ? "text-(--accent)" : "text-[#8f8272] hover:text-[#b0a090]"}`}
          >
            {repeat === "one" ? (
              <Repeat1 size={16} strokeWidth={1.75} />
            ) : (
              <Repeat size={16} strokeWidth={1.75} />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 w-full max-w-xs">
          <button
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="text-[#b0a090] hover:text-(--accent) transition-colors text-sm w-5"
          >
            {isMuted || volume === 0 ? <VolumeX size={16} strokeWidth={1.75} /> : volume < 0.5 ? <Volume1 size={16} strokeWidth={1.75} /> : <Volume2 size={16} strokeWidth={1.75} />}
          </button>
          <input aria-label="Volume"
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
              background: `linear-gradient(to right, var(--accent) ${(isMuted ? 0 : volume) * 100}%, #2a2520 ${(isMuted ? 0 : volume) * 100}%)`,
              accentColor: "var(--accent)",
            }}
          />
          <span className="text-[10px] font-mono text-[#b0a090] w-7 text-right">
            {Math.round((isMuted ? 0 : volume) * 100)}
          </span>
        </div>
      </div>

      {/* ── RIGHT: QUEUE / MANAGE ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 border-t lg:border-t-0 lg:border-l border-[#2a2520] z-10"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#2a2520 transparent" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          {view === "manage" ? (
            <button
              onClick={() => setView("queue")}
              className="text-[#b0a090] hover:text-(--accent) transition-colors text-xs font-mono flex items-center gap-1"
            >
              ← Queue
            </button>
          ) : (
            <span className="font-serif italic text-(--accent) text-sm">
              Queue
            </span>
          )}
          <div className="flex-1 h-px bg-[#2a2520]" />
          {view === "queue" && (
            <span className="text-[10px] font-mono text-[#b0a090]">
              {tracks.length} tracks
            </span>
          )}
          <button
            onClick={() => setView(view === "queue" ? "manage" : "queue")}
            title={view === "queue" ? "Add track" : "Back to queue"}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all ${
              view === "manage"
                ? "bg-(--accent)/20 text-(--accent)"
                : "bg-(--accent)/15 text-(--accent) hover:bg-(--accent)/25"
            }`}
          >
            {view === "manage" ? "close" : "+ add"}
          </button>
        </div>

        {/* ── QUEUE VIEW ── */}
        {view === "queue" && (
          <>
            {tracks.length === 0 && (
              <div className="text-center py-16 text-[#8f8272]">
                <Music2 size={36} strokeWidth={1.5} className="mb-4 mx-auto" />
                <p className="text-sm font-mono">No tracks yet.</p>
                <button
                  onClick={() => setView("manage")}
                  className="mt-3 text-xs text-(--accent) hover:underline font-mono"
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
                      ? "bg-(--accent)/15 border border-(--accent)/30"
                      : "hover:bg-[#1a1410] border border-transparent"
                  }`}
                >
                  <div className="w-6 text-center shrink-0">
                    {i === currentIndex && isPlaying ? (
                      <div className="flex items-end justify-center gap-px h-4">
                        {[0, 1, 2].map((bar) => (
                          <div
                            key={bar}
                            className="w-1 bg-(--accent) rounded-full"
                            style={{
                              height: `${40 + bar * 20}%`,
                              animation: "barBounce 0.8s ease-in-out infinite",
                              animationDelay: `${bar * 0.15}s`,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] font-mono text-[#8f8272] group-hover:text-[#b0a090]">
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
                      <Music2 size={18} strokeWidth={1.5} className="text-[#3a3028]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-semibold truncate ${i === currentIndex ? "text-(--accent)" : "text-white"}`}
                    >
                      {track.title}
                    </div>
                    <div className="text-[11px] text-[#b0a090] font-mono truncate">
                      {track.artist}
                      {track.isUserTrack && (
                        <span className="ml-2 text-(--accent)/50">↑</span>
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
              <p className="font-serif italic text-(--accent) text-sm">
                Add a track
              </p>

              <div className="flex flex-col gap-3">
                <input aria-label="Track title"
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1410] border border-[#2a2520] text-white text-sm placeholder-[#4a4038] focus:outline-none focus:border-(--accent)/50 transition-colors"
                />
                <input aria-label="Artist"
                  type="text"
                  placeholder="Artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1410] border border-[#2a2520] text-white text-sm placeholder-[#4a4038] focus:outline-none focus:border-(--accent)/50 transition-colors"
                />

                {/* Audio file */}
                <label className="flex flex-col gap-1 cursor-pointer group">
                  <span className="text-[10px] font-mono text-[#b0a090]">
                    Audio file <span className="text-(--accent)">*</span>
                  </span>
                  <div
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      audioFile
                        ? "bg-(--accent)/10 border-(--accent)/30"
                        : "bg-[#1a1410] border-[#2a2520] hover:border-(--accent)/30"
                    }`}
                  >
                    <Music2 size={16} strokeWidth={1.75} />
                    <span className="text-xs text-[#b0a090] truncate flex-1">
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
                        aria-label="Clear selected audio file"
                        className="text-[#8f8272] hover:text-[#b0a090] text-xs shrink-0"
                      >
                        <X size={16} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <input aria-label="Audio file"
                    ref={audioInputRef}
                    type="file"
                    accept=".mp3,.m4a,.wav,.flac,audio/*"
                    className="sr-only"
                    onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                {/* Cover image */}
                <label className="flex flex-col gap-1 cursor-pointer group">
                  <span className="text-[10px] font-mono text-[#b0a090]">
                    Cover image{" "}
                    <span className="text-[#8f8272]">(optional)</span>
                  </span>
                  <div
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      coverFile
                        ? "bg-(--accent)/10 border-(--accent)/30"
                        : "bg-[#1a1410] border-[#2a2520] hover:border-(--accent)/30"
                    }`}
                  >
                    <ImageIcon size={16} strokeWidth={1.75} />
                    <span className="text-xs text-[#b0a090] truncate flex-1">
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
                        aria-label="Clear selected cover image"
                        className="text-[#8f8272] hover:text-[#b0a090] text-xs shrink-0"
                      >
                        <X size={16} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <input aria-label="Cover image"
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
                    className="h-full bg-(--accent) rounded-full transition-all duration-300"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              )}

              {uploadState === "error" && (
                <p className="text-xs text-red-600 font-mono">{uploadError}</p>
              )}

              {uploadState === "done" && (
                <p className="text-xs text-green-400 font-mono">
                  Track added successfully ✓
                </p>
              )}

              <button
                type="submit"
                disabled={uploadState === "uploading" || !audioFile || !title.trim() || !artist.trim()}
                className="w-full py-2 rounded-xl bg-(--accent) text-white text-sm font-semibold hover:bg-[#c2500f] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {uploadState === "uploading" ? "Uploading…" : "Upload Track"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#2a2520]" />
              <span className="text-[10px] font-mono text-[#8f8272]">
                your uploads · {userTracks.length}
              </span>
              <div className="flex-1 h-px bg-[#2a2520]" />
            </div>

            {/* User-uploaded track list */}
            {userTracks.length === 0 ? (
              <p className="text-center text-xs font-mono text-[#8f8272] py-4">
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
                        <Music2 size={15} strokeWidth={1.5} className="text-[#3a3028]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-[#b0a090] font-mono truncate">
                        {track.artist}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!track.id) return;
                        // Also removes the uploaded audio + cover from storage.
                        void confirmDialog({
                          title: `Remove "${track.title}"?`,
                          message:
                            "The uploaded file and its cover are deleted for good.",
                          confirmLabel: "Remove",
                        }).then((ok) => {
                          if (ok)
                            deleteUserTrack(
                              track.id!,
                              track.file,
                              track.cover || null,
                            );
                        });
                      }}
                      title="Remove track"
                      aria-label={`Remove track ${track.title ?? ""}`}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-[#8f8272] hover:text-red-600 hover:bg-red-400/10 transition-all text-sm shrink-0"
                    >
                      <X size={16} strokeWidth={2} />
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
          border-radius: 50%; background: var(--accent); cursor: pointer;
        }
      `}</style>
    </div>
  );
}
