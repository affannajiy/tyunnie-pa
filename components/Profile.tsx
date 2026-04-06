// components/Profile.tsx
"use client";

import { useState, useEffect } from "react";
import { getProfile, upsertProfile, type Profile } from "@/lib/database";
import { useRef } from "react";
import { supabase } from "@/lib/supabase";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const INTEREST_OPTIONS = [
  "Music",
  "Writing",
  "Gaming",
  "Coding",
  "Reading",
  "Fitness",
  "Design",
  "Photography",
  "Travel",
  "Finance",
  "Anime",
  "Movies",
  "Coffee",
  "Art",
  "Science",
];

const LOCALES = [
  { value: "en-MY", label: "English (Malaysia)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
];

const CURRENCIES = [
  { value: "RM", label: "RM — Malaysian Ringgit" },
  { value: "USD", label: "$ — US Dollar" },
  { value: "SGD", label: "S$ — Singapore Dollar" },
  { value: "GBP", label: "£ — British Pound" },
  { value: "EUR", label: "€ — Euro" },
];

type Props = {
  userId: string;
  onClose: () => void;
  onSave: (profile: Profile) => void;
  isDark: boolean;
  toggleTheme: () => void;
};

export default function Profile({
  userId,
  onClose,
  onSave,
  isDark,
  toggleTheme,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [displayName, setDisplayName] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [city, setCity] = useState("");
  const [cityLat, setCityLat] = useState<number | null>(null);
  const [cityLon, setCityLon] = useState<number | null>(null);
  const [citySearch, setCitySearch] = useState("");
  const [citySearching, setCitySearching] = useState(false);
  const [cityError, setCityError] = useState("");
  const [locale, setLocale] = useState("en-MY");
  const [currency, setCurrency] = useState("RM");
  const [occupation, setOccupation] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [greetingStyle, setGreetingStyle] = useState("casual");
  const [showBriefing, setShowBriefing] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    getProfile(userId).then((p) => {
      if (p) {
        setDisplayName(p.display_name ?? "");
        setBirthDay(p.birth_day ? String(p.birth_day) : "");
        setBirthMonth(p.birth_month ? String(p.birth_month) : "");
        setCity(p.city ?? "");
        setCityLat(p.city_lat ?? null);
        setCityLon(p.city_lon ?? null);
        setLocale(p.locale ?? "en-MY");
        setCurrency(p.currency ?? "RM");
        setOccupation(p.occupation ?? "");
        setWorkplace(p.workplace ?? "");
        setBio(p.bio ?? "");
        setInterests(p.interests ?? []);
        setGreetingStyle(p.greeting_style ?? "casual");
        setShowBriefing(p.show_briefing ?? true);
        setAvatarUrl(p.avatar_url ?? null);
      } else {
        // Migrate from localStorage
        const lsName = localStorage.getItem("tyunnie_username");
        if (lsName) setDisplayName(lsName);
        const lsCity = localStorage.getItem("tyunnie_city");
        if (lsCity) {
          try {
            const parsed = JSON.parse(lsCity);
            setCity(parsed.city ?? "");
            setCityLat(parsed.lat ?? null);
            setCityLon(parsed.lon ?? null);
          } catch {}
        }
        const lsTheme = localStorage.getItem("tyunnie_theme");
        if (lsTheme === "dark" && !isDark) toggleTheme();
      }
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    if (showCropModal) drawCrop();
  }, [cropScale, cropOffsetX, cropOffsetY, showCropModal]);

  async function searchCity() {
    if (!citySearch.trim()) return;
    setCitySearching(true);
    setCityError("");
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(citySearch.trim())}&count=1`,
      );
      const json = await res.json();
      if (!json.results?.length) {
        setCityError("City not found");
        setCitySearching(false);
        return;
      }
      const { latitude, longitude, name, country } = json.results[0];
      setCity(`${name}, ${country}`);
      setCityLat(latitude);
      setCityLon(longitude);
      setCitySearch("");
      // Update weather localStorage too
      localStorage.setItem(
        "tyunnie_city",
        JSON.stringify({
          lat: latitude,
          lon: longitude,
          city: `${name}, ${country}`,
        }),
      );
    } catch {
      setCityError("Something went wrong");
    } finally {
      setCitySearching(false);
    }
  }

  function toggleInterest(i: string) {
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropSrc(ev.target?.result as string);
      setCropScale(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  }

  function drawCrop() {
    const canvas = canvasRef.current;
    const img = cropImgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const SIZE = 200;
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.clearRect(0, 0, SIZE, SIZE);
    // clip circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const w = img.naturalWidth * cropScale;
    const h = img.naturalHeight * cropScale;
    const x = SIZE / 2 - w / 2 + cropOffsetX;
    const y = SIZE / 2 - h / 2 + cropOffsetY;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }

  async function handleCropSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCrop();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/png"),
    );
    if (!blob) return;

    const path = `avatars/${userId}.png`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/png" });
    if (error) {
      console.error(error);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(url);
    setShowCropModal(false);
    setCropSrc(null);
    const updatedProfile = await upsertProfile(userId, { avatar_url: url }); // ← capture it
    if (updatedProfile) onSave(updatedProfile); // ← use it
  }

  async function handleDeleteAvatar() {
    await supabase.storage.from("avatars").remove([`avatars/${userId}.png`]);
    setAvatarUrl(null);
    const updatedProfile = await upsertProfile(userId, { avatar_url: null }); // ← same
    if (updatedProfile) onSave(updatedProfile);
  }

  async function handleSave() {
    setSaving(true);
    const profile: Partial<Profile> = {
      display_name: displayName || null,
      birth_day: birthDay ? parseInt(birthDay) : null,
      birth_month: birthMonth ? parseInt(birthMonth) : null,
      city: city || null,
      city_lat: cityLat,
      city_lon: cityLon,
      theme: isDark ? "dark" : "light",
      locale,
      currency,
      occupation: occupation || null,
      workplace: workplace || null,
      bio: bio || null,
      interests,
      greeting_style: greetingStyle,
      show_briefing: showBriefing,
      avatar_url: avatarUrl,
    };
    const saved = await upsertProfile(userId, profile);
    // Sync localStorage keys
    if (displayName) localStorage.setItem("tyunnie_username", displayName);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (saved) onSave(saved);
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-[#9a8f7e] text-sm">
        Loading profile...
      </div>
    );

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="text-[#9a8f7e] hover:text-[#f97316] transition-colors text-xs font-mono font-bold uppercase tracking-widest"
        >
          ← Back
        </button>
        <div className="flex-1 h-px bg-[#e8e2d8]" />
        <span className="font-serif italic text-[#f97316] text-sm">
          Your Profile
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Identity */}
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-4">
            Identity
          </p>

          {/* Avatar preview */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="w-14 h-14 rounded-full object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xl font-bold">
                  {displayName
                    ? displayName
                        .trim()
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "?"}
                </div>
              )}
              {/* Overlay buttons */}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <label
                  className="cursor-pointer p-1 hover:scale-110 transition-transform"
                  title="Upload photo"
                >
                  <span className="text-white text-sm">📷</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                </label>
                {avatarUrl && (
                  <button
                    onClick={handleDeleteAvatar}
                    title="Remove photo"
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <span className="text-red-300 text-sm">🗑</span>
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111010]">
                {displayName || "Your name"}
              </p>
              <p className="text-[10px] text-[#9a8f7e]">
                {avatarUrl
                  ? "Hover avatar to change or remove"
                  : "Hover avatar to upload a photo"}
              </p>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What should Tyunnie call you?"
              className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
            />
          </div>

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Birth Day
              </label>
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Birth Month
              </label>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
              City
            </label>
            {city ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm text-[#111010]">
                  📍 {city}
                </div>
                <button
                  onClick={() => {
                    setCity("");
                    setCityLat(null);
                    setCityLon(null);
                  }}
                  className="text-[#c5bdb0] hover:text-red-400 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchCity()}
                  placeholder="Search city..."
                  className="flex-1 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
                />
                <button
                  onClick={searchCity}
                  disabled={citySearching}
                  className="px-4 py-2.5 rounded-xl bg-[#f97316] text-white text-xs font-bold hover:bg-[#c2500f] transition-all disabled:opacity-40"
                >
                  {citySearching ? "..." : "Find"}
                </button>
              </div>
            )}
            {cityError && (
              <p className="text-[10px] text-red-400 mt-1">{cityError}</p>
            )}
          </div>
        </div>

        {/* About */}
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-4">
            About You
          </p>

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Occupation
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. CS Student"
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                University / Workplace
              </label>
              <input
                type="text"
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
                placeholder="e.g. UTP"
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short description Tyunnie can use to know you better..."
              rows={3}
              className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-2">
              Interests
            </label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((i) => (
                <button
                  key={i}
                  onClick={() => toggleInterest(i)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${
                    interests.includes(i)
                      ? "bg-[#f97316] text-white border-[#f97316]"
                      : "bg-white text-[#9a8f7e] border-[#e8e2d8] hover:border-[#f97316] hover:text-[#f97316]"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-4">
            Preferences
          </p>

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Language / Locale
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              >
                {LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#f97316] transition-colors"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-2">
              Tyunnie Greeting Style
            </label>
            <div className="flex gap-2">
              {["casual", "formal"].map((s) => (
                <button
                  key={s}
                  onClick={() => setGreetingStyle(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
                    greetingStyle === s
                      ? "bg-[#f97316] text-white border-[#f97316]"
                      : "bg-white text-[#9a8f7e] border-[#e8e2d8] hover:border-[#f97316]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="mb-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {[
                { v: "light", label: "☀️ Light" },
                { v: "dark", label: "🌙 Dark" },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => {
                    if ((v === "dark") !== isDark) toggleTheme();
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
                    (v === "dark") === isDark
                      ? "bg-[#f97316] text-white border-[#f97316]"
                      : "bg-white text-[#9a8f7e] border-[#e8e2d8] hover:border-[#f97316]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Show briefing */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#111010]">
                Daily Briefing
              </p>
              <p className="text-[10px] text-[#9a8f7e]">
                Show Tyunnie's morning summary card
              </p>
            </div>
            <button
              onClick={() => setShowBriefing((p) => !p)}
              className={`w-11 h-6 rounded-full transition-all relative ${showBriefing ? "bg-[#f97316]" : "bg-[#e8e2d8]"}`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${showBriefing ? "left-5" : "left-0.5"}`}
              />
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-[#f97316] text-white font-bold text-sm uppercase tracking-widest hover:bg-[#c2500f] transition-all hover:-translate-y-px disabled:opacity-40"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Profile"}
        </button>
      </div>
      {showCropModal && cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl p-6 w-85 shadow-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono mb-4">
              Adjust Photo
            </p>

            {/* Preview canvas */}
            <div className="flex justify-center mb-4">
              <div
                className="relative w-50 h-50 overflow-hidden rounded-full border-2 border-[#f97316] cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => {
                  setIsDragging(true);
                  setDragStart({
                    x: e.clientX - cropOffsetX,
                    y: e.clientY - cropOffsetY,
                  });
                }}
                onMouseMove={(e) => {
                  if (!isDragging) return;
                  setCropOffsetX(e.clientX - dragStart.x);
                  setCropOffsetY(e.clientY - dragStart.y);
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <canvas
                  ref={canvasRef}
                  width={200}
                  height={200}
                  className="w-50 h-50"
                />
                <img
                  src={cropSrc}
                  ref={(el) => {
                    if (el) {
                      cropImgRef.current = el;
                      el.onload = () => drawCrop();
                    }
                  }}
                  className="hidden"
                  alt=""
                />
              </div>
            </div>

            {/* Scale slider */}
            <div className="mb-5">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] mb-2">
                Zoom
              </label>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.01}
                value={cropScale}
                onChange={(e) => {
                  setCropScale(parseFloat(e.target.value));
                }}
                className="w-full accent-[#f97316]"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setCropSrc(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-[#e8e2d8] text-sm text-[#9a8f7e] hover:border-[#f97316] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCropSave}
                className="flex-1 py-2.5 rounded-xl bg-[#f97316] text-white text-sm font-bold hover:bg-[#c2500f] transition-all"
              >
                Save Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
