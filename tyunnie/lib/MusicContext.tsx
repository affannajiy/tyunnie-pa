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

type Track = {
  title: string;
  artist: string;
  file: string;
  cover: string;
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
};

const MusicContext = createContext<MusicContextType | null>(null);

export function useMusicContext() {
  const ctx = useContext(MusicContext);
  if (!ctx)
    throw new Error("useMusicContext must be used within MusicProvider");
  return ctx;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);

  // Refs to avoid stale closures in event listeners
  const repeatRef = useRef<RepeatMode>("none");
  const shuffleRef = useRef(false);
  const currentIndexRef = useRef(0);
  const shuffledOrderRef = useRef<number[]>([]);
  const tracksRef = useRef<Track[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    shuffledOrderRef.current = shuffledOrder;
  }, [shuffledOrder]);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // ── HELPERS ──
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
  function shuffleArray(arr: number[]) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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

  // handleEnded reads from refs so it always has fresh values
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

  // Create the audio element once on mount
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.8; // ← use hardcoded initial value instead of volume state

    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.ontimeupdate = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration);
    };
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.onended = () => handleEnded();

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Load playlist on mount
  useEffect(() => {
    fetch("/music/playlist.json")
      .then((r) => r.json())
      .then((data: Track[]) => {
        setTracks(data);
        setShuffledOrder(shuffleArray(data.map((_, i) => i)));
      })
      .catch(() => {});
  }, []);

  // Sync volume and mute to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // ── PLAYBACK ──
  function togglePlay() {
    if (!audioRef.current || tracksRef.current.length === 0) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // If no src loaded yet, load the current track first
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
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}
