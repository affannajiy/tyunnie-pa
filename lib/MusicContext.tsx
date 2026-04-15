// lib/MusicContext.tsx
"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { getMusicTracks, deleteMusicTrack } from "@/lib/database";

export type Track = {
  id?: string;          // present for user-uploaded tracks only
  title: string;
  artist: string;
  file: string;
  cover: string;
  isUserTrack?: boolean;
};

type RepeatMode = "none" | "all" | "one";

type MusicContextType = {
  tracks: Track[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  currentTrack: Track | undefined;
  analyser: React.RefObject<AnalyserNode | null>;
  togglePlay: () => void;
  playTrack: (index: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  handleSeek: (val: number) => void;
  setVolume: (v: number) => void;
  setIsMuted: (v: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  formatTime: (s: number) => string;
  forcePrevTrack: () => void;
  refreshTracks: () => void;
  deleteUserTrack: (id: string, fileUrl: string, coverUrl: string | null) => Promise<void>;
  skipBack: (seconds: number) => void;
  skipForward: (seconds: number) => void;
};

const MusicContext = createContext<MusicContextType | null>(null);

export function useMusicContext() {
  const ctx = useContext(MusicContext);
  if (!ctx)
    throw new Error("useMusicContext must be used within MusicProvider");
  return ctx;
}

function shuffleArray(arr: number[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.substring(idx + marker.length));
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 0.5;
    const saved = parseFloat(localStorage.getItem("tyunnie_music_volume") ?? "");
    return isNaN(saved) ? 0.5 : Math.min(1, Math.max(0, saved));
  });
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  // bump this to trigger a playlist reload
  const [tracksVersion, setTracksVersion] = useState(0);

  // Refs to avoid stale closures in event listeners
  const repeatRef = useRef<RepeatMode>("none");
  const shuffleRef = useRef(false);
  const currentIndexRef = useRef(0);
  const shuffledOrderRef = useRef<number[]>([]);
  const tracksRef = useRef<Track[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  // Deferred restore — applied after first track load, then cleared
  const pendingRestoreRef = useRef<{ track: number; position: number } | null>(
    typeof window !== "undefined"
      ? (() => {
          const t = parseInt(localStorage.getItem("tyunnie_music_track") ?? "", 10);
          const p = parseFloat(localStorage.getItem("tyunnie_music_position") ?? "");
          return { track: isNaN(t) ? 0 : t, position: isNaN(p) ? 0 : p };
        })()
      : null,
  );

  // Keep refs in sync with state
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { shuffledOrderRef.current = shuffledOrder; }, [shuffledOrder]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  // ── HELPERS ──
  function initAnalyser(audio: HTMLAudioElement) {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    sourceRef.current = source;
    analyserRef.current = analyser;
  }

  function forcePrevTrack() {
    const tr = tracksRef.current;
    const so = shuffledOrderRef.current;
    const ci = currentIndexRef.current;
    if (tr.length === 0) return;
    if (shuffleRef.current && so.length > 0) {
      const pos = so.indexOf(ci);
      playTrack(so[(pos - 1 + so.length) % so.length]);
    } else {
      playTrack((ci - 1 + tr.length) % tr.length);
    }
  }

  function formatTime(seconds: number) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function playTrack(index: number) {
    if (!audioRef.current || tracksRef.current.length === 0) return;
    const track = tracksRef.current[index];
    if (!track) return;
    setCurrentIndex(index);
    setProgress(0);
    audioRef.current.src = track.file;
    audioRef.current.load();
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
  }

  function handleEnded() {
    const r = repeatRef.current;
    const sh = shuffleRef.current;
    const ci = currentIndexRef.current;
    const so = shuffledOrderRef.current;
    const tr = tracksRef.current;

    if (r === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    if (sh && so.length > 0) {
      const pos = so.indexOf(ci);
      const next = so[(pos + 1) % so.length];
      playTrack(next);
    } else if (r === "all") {
      playTrack((ci + 1) % tr.length);
    } else if (ci < tr.length - 1) {
      playTrack(ci + 1);
    } else {
      setIsPlaying(false);
    }
  }

  // Persist volume whenever it changes
  useEffect(() => {
    localStorage.setItem("tyunnie_music_volume", String(volume));
  }, [volume]);

  // Persist track index whenever it changes
  useEffect(() => {
    localStorage.setItem("tyunnie_music_track", String(currentIndex));
  }, [currentIndex]);

  // Create the audio element once on mount
  useEffect(() => {
    const audio = new Audio();
    // Restore saved volume (state already initialised from localStorage)
    const savedVol = parseFloat(localStorage.getItem("tyunnie_music_volume") ?? "");
    audio.volume = isNaN(savedVol) ? 0.5 : Math.min(1, Math.max(0, savedVol));

    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.ontimeupdate = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration);
      // Persist position every ~5 s to avoid hammering localStorage
      if (Math.floor(audio.currentTime) % 5 === 0 && audio.currentTime > 0) {
        localStorage.setItem("tyunnie_music_position", String(audio.currentTime));
      }
    };
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.onended = () => handleEnded();

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Load playlist — re-runs whenever tracksVersion is bumped
  useEffect(() => {
    async function load() {
      // 1. Default built-in tracks from playlist.json
      let defaults: Track[] = [];
      try {
        const r = await fetch("/music/playlist.json");
        defaults = await r.json();
      } catch {}

      // 2. User-uploaded tracks from Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const dbTracks = await getMusicTracks(user.id);
          const userTracks: Track[] = dbTracks.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            file: t.file_url,
            cover: t.cover_url ?? "",
            isUserTrack: true,
          }));
          const merged = [...defaults, ...userTracks];
          setTracks(merged);
          setShuffledOrder(shuffleArray(merged.map((_, i) => i)));
          applyPendingRestore(merged);
          return;
        }
      } catch {}

      setTracks(defaults);
      setShuffledOrder(shuffleArray(defaults.map((_, i) => i)));
      applyPendingRestore(defaults);
    }

    load();
  }, [tracksVersion]);

  // Sync volume and mute to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  function refreshTracks() {
    setTracksVersion((v) => v + 1);
  }

  async function deleteUserTrack(id: string, fileUrl: string, coverUrl: string | null) {
    // Stop playback if this track is currently playing
    const ci = currentIndexRef.current;
    const tr = tracksRef.current;
    const deletingCurrent = tr[ci]?.id === id;
    if (deletingCurrent && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      setIsPlaying(false);
    }

    // Remove files from Supabase Storage
    const audioPath = extractStoragePath(fileUrl, "music-audio");
    if (audioPath) {
      await supabase.storage.from("music-audio").remove([audioPath]);
    }
    if (coverUrl) {
      const coverPath = extractStoragePath(coverUrl, "music-covers");
      if (coverPath) await supabase.storage.from("music-covers").remove([coverPath]);
    }

    // Remove from database and reload
    await deleteMusicTrack(id);
    refreshTracks();
  }

  // Restore last track + position on initial load only
  function applyPendingRestore(loadedTracks: Track[]) {
    const restore = pendingRestoreRef.current;
    if (!restore || !audioRef.current || loadedTracks.length === 0) return;
    pendingRestoreRef.current = null; // consume — only runs once
    const safeIdx = Math.min(restore.track, loadedTracks.length - 1);
    setCurrentIndex(safeIdx);
    currentIndexRef.current = safeIdx;
    audioRef.current.src = loadedTracks[safeIdx].file;
    audioRef.current.load();
    // Restore position once metadata is available, do NOT auto-play
    audioRef.current.onloadedmetadata = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = restore.position;
        setDuration(audioRef.current.duration);
      }
    };
  }

  function skipBack(seconds: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - seconds);
    setProgress(audioRef.current.currentTime);
  }

  function skipForward(seconds: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(
      audioRef.current.duration || 0,
      audioRef.current.currentTime + seconds,
    );
    setProgress(audioRef.current.currentTime);
  }

  // ── PLAYBACK ──
  async function togglePlay() {
    if (!audioRef.current || tracksRef.current.length === 0) return;
    initAnalyser(audioRef.current);
    if (audioCtxRef.current?.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (
        !audioRef.current.src ||
        audioRef.current.src === window.location.href
      ) {
        const track = tracksRef.current[currentIndexRef.current];
        if (track) {
          audioRef.current.src = track.file;
          audioRef.current.load();
        }
      }
      audioRef.current.play().catch(() => {});
    }
  }

  function nextTrack() {
    const tr = tracksRef.current;
    const so = shuffledOrderRef.current;
    const ci = currentIndexRef.current;
    if (tr.length === 0) return;
    if (shuffleRef.current && so.length > 0) {
      const pos = so.indexOf(ci);
      playTrack(so[(pos + 1) % so.length]);
    } else {
      playTrack((ci + 1) % tr.length);
    }
  }

  function prevTrack() {
    const tr = tracksRef.current;
    const so = shuffledOrderRef.current;
    const ci = currentIndexRef.current;
    if (tr.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (shuffleRef.current && so.length > 0) {
      const pos = so.indexOf(ci);
      playTrack(so[(pos - 1 + so.length) % so.length]);
    } else {
      playTrack((ci - 1 + tr.length) % tr.length);
    }
  }

  function handleSeek(val: number) {
    setProgress(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  }

  function toggleShuffle() {
    setShuffle((prev) => {
      if (!prev)
        setShuffledOrder(shuffleArray(tracksRef.current.map((_, i) => i)));
      return !prev;
    });
  }

  function cycleRepeat() {
    setRepeat((prev) =>
      prev === "none" ? "all" : prev === "all" ? "one" : "none",
    );
  }

  return (
    <MusicContext.Provider
      value={{
        tracks,
        currentIndex,
        isPlaying,
        progress,
        duration,
        volume,
        isMuted,
        shuffle,
        repeat,
        forcePrevTrack,
        currentTrack: tracks[currentIndex],
        analyser: analyserRef,
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
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}
