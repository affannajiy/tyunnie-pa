// components/Profile.tsx
"use client";

import { useState, useEffect } from "react";
import { getProfile, upsertProfile, type Profile } from "@/lib/database";
import { useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  getVaultEntries,
  addVaultEntry,
  updateVaultEntry,
  deleteVaultEntry,
  getVaultMeta,
  setVaultMeta as saveVaultMeta,
  type VaultEntry,
  type VaultMeta,
} from "@/lib/database";
import {
  encryptData,
  decryptData,
  createPinVerifier,
  verifyPin,
} from "@/lib/crypto";

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
  // Vault
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [vaultMetaLoading, setVaultMetaLoading] = useState(true);
  const [vaultLocked, setVaultLocked] = useState(true);
  const [vaultPin, setVaultPin] = useState(""); // active session PIN
  const [pinInput, setPinInput] = useState(""); // what user is typing
  const [pinConfirm, setPinConfirm] = useState(""); // confirm on setup
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinError, setPinError] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntryName, setNewEntryName] = useState("");
  const [newEntryUsername, setNewEntryUsername] = useState("");
  const [newEntryPassword, setNewEntryPassword] = useState("");
  const [newEntryNotes, setNewEntryNotes] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [decryptedEntries, setDecryptedEntries] = useState<
    Record<string, { username: string; password: string; notes: string }>
  >({});
  const [savingEntry, setSavingEntry] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [otpStep, setOtpStep] = useState<
    "idle" | "sending" | "verify" | "new_pin"
  >("idle");
  const [changingPin, setChangingPin] = useState(false);
  const [newPinInput, setNewPinInput] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [newPinStep, setNewPinStep] = useState<"enter" | "confirm">("enter");
  const [newPinError, setNewPinError] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [dailyQuoteEmail, setDailyQuoteEmail] = useState(false);

  async function handleAddEntry() {
    if (!newEntryName.trim() || !newEntryPassword.trim()) return;
    setSavingEntry(true);
    const plain = JSON.stringify({
      username: newEntryUsername,
      password: newEntryPassword,
      notes: newEntryNotes,
    });
    const { encrypted, iv, salt } = await encryptData(plain, vaultPin);
    const saved = await addVaultEntry(userId, {
      name: newEntryName,
      encrypted_data: encrypted,
      iv,
      salt,
    });
    if (saved) {
      setVaultEntries((prev) => [saved, ...prev]);
      setDecryptedEntries((prev) => ({
        ...prev,
        [saved.id]: {
          username: newEntryUsername,
          password: newEntryPassword,
          notes: newEntryNotes,
        },
      }));
      setNewEntryName("");
      setNewEntryUsername("");
      setNewEntryPassword("");
      setNewEntryNotes("");
      setShowAddEntry(false);
    }
    setSavingEntry(false);
  }

  async function handleDeleteEntry(id: string) {
    await deleteVaultEntry(id);
    setVaultEntries((prev) => prev.filter((e) => e.id !== id));
    setDecryptedEntries((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleEditEntry(id: string) {
    if (!editName.trim() || !editPassword.trim()) return;
    setSavingEdit(true);
    const plain = JSON.stringify({
      username: editUsername,
      password: editPassword,
      notes: editNotes,
    });
    const { encrypted, iv, salt } = await encryptData(plain, vaultPin);
    // Update in Supabase — add updateVaultEntry to database.ts
    await updateVaultEntry(id, {
      name: editName,
      encrypted_data: encrypted,
      iv,
      salt,
    });
    // Update local state
    setVaultEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, name: editName, encrypted_data: encrypted, iv, salt }
          : e,
      ),
    );
    setDecryptedEntries((prev) => ({
      ...prev,
      [id]: {
        username: editUsername,
        password: editPassword,
        notes: editNotes,
      },
    }));
    setEditingId(null);
    setSavingEdit(false);
  }

  // Pin
  async function handlePinDigit(digit: string) {
    if (pinLocked) return;

    const isSetup = !vaultMeta;

    if (isSetup) {
      if (pinStep === "enter") {
        const next = pinInput + digit;
        setPinInput(next);
        if (next.length === 6) {
          // Move to confirm step
          setPinStep("confirm");
          setPinError("");
        }
      } else {
        // Confirm step
        const next = pinConfirm + digit;
        setPinConfirm(next);
        if (next.length === 6) {
          if (next !== pinInput) {
            setPinError("PINs don't match. Try again.");
            setPinInput("");
            setPinConfirm("");
            setPinStep("enter");
          } else {
            // Set up vault
            const { verifier, iv, salt } = await createPinVerifier(next);
            await saveVaultMeta(userId, {
              // ← use renamed version
              pin_verifier: verifier,
              pin_iv: iv,
              pin_salt: salt,
            });
            const newMeta: VaultMeta = {
              user_id: userId,
              pin_verifier: verifier,
              pin_iv: iv,
              pin_salt: salt,
              created_at: new Date().toISOString(),
            };
            setVaultMeta(newMeta); // ← this is fine, it's the useState setter
            setVaultPin(next);
            setVaultLocked(false);
            setPinInput("");
            setPinConfirm("");
            setPinStep("enter");
            // Send notification email
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user?.email) {
              fetch("/api/vault-notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email, type: "setup" }),
              });
            }
          }
        }
      }
    } else {
      // Unlock flow
      const next = pinInput + digit;
      setPinInput(next);
      if (next.length === 6) {
        setVaultLoading(true);
        const ok = await verifyPin(
          next,
          vaultMeta.pin_verifier,
          vaultMeta.pin_iv,
          vaultMeta.pin_salt,
        );
        if (!ok) {
          const attempts = pinAttempts + 1;
          setPinAttempts(attempts);
          setPinInput("");
          if (attempts >= 3) {
            setPinLocked(true);
            setPinError("Too many attempts. Vault locked for this session.");
          } else {
            setPinError(
              `Wrong PIN. ${3 - attempts} attempt${3 - attempts === 1 ? "" : "s"} remaining.`,
            );
          }
          setVaultLoading(false);
          return;
        }
        // Correct PIN — load and decrypt entries
        const entries = await getVaultEntries(userId);
        const decrypted: Record<
          string,
          { username: string; password: string; notes: string }
        > = {};
        for (const entry of entries) {
          try {
            const plain = await decryptData(
              entry.encrypted_data,
              entry.iv,
              entry.salt,
              next,
            );
            decrypted[entry.id] = JSON.parse(plain);
          } catch {
            decrypted[entry.id] = { username: "?", password: "?", notes: "" };
          }
        }
        setVaultEntries(entries);
        setDecryptedEntries(decrypted);
        setVaultPin(next);
        setVaultLocked(false);
        setPinInput("");
        setPinAttempts(0);
        setPinError("");
        setVaultLoading(false);
      }
    }
  }

  function handlePinBackspace() {
    if (pinStep === "confirm") {
      setPinConfirm((p) => p.slice(0, -1));
    } else {
      setPinInput((p) => p.slice(0, -1));
    }
  }

  async function handleNewPinDigit(digit: string) {
    if (newPinStep === "enter") {
      const next = newPinInput + digit;
      setNewPinInput(next);
      if (next.length === 6) {
        setNewPinStep("confirm");
        setNewPinError("");
      }
    } else {
      const next = newPinConfirm + digit;
      setNewPinConfirm(next);
      if (next.length === 6) {
        if (next !== newPinInput) {
          setNewPinError("PINs don't match. Try again.");
          setNewPinInput("");
          setNewPinConfirm("");
          setNewPinStep("enter");
          return;
        }
        // Re-encrypt all entries with new PIN
        setSavingPin(true);
        try {
          for (const entry of vaultEntries) {
            const dec = decryptedEntries[entry.id];
            if (!dec) continue;
            const plain = JSON.stringify(dec);
            const { encrypted, iv, salt } = await encryptData(plain, next);
            await updateVaultEntry(entry.id, {
              name: entry.name,
              encrypted_data: encrypted,
              iv,
              salt,
            });
          }
          // Update vault meta with new PIN verifier
          const { verifier, iv, salt } = await createPinVerifier(next);
          await saveVaultMeta(userId, {
            pin_verifier: verifier,
            pin_iv: iv,
            pin_salt: salt,
          });
          setVaultMeta((prev) =>
            prev
              ? { ...prev, pin_verifier: verifier, pin_iv: iv, pin_salt: salt }
              : prev,
          );
          setVaultPin(next);
          // Send notification email
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.email) {
            fetch("/api/vault-notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: user.email, type: "change" }),
            });
          }
          // Reset change PIN UI
          setChangingPin(false);
          setNewPinInput("");
          setNewPinConfirm("");
          setNewPinStep("enter");
          setNewPinError("");
        } finally {
          setSavingPin(false);
        }
      }
    }
  }

  function handleNewPinBackspace() {
    if (newPinStep === "confirm") {
      setNewPinConfirm((p) => p.slice(0, -1));
    } else {
      setNewPinInput((p) => p.slice(0, -1));
    }
  }

  async function handleRequestOtp() {
    setOtpSending(true);
    setOtpError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        setOtpError("No email on account.");
        return;
      }
      const res = await fetch("/api/vault-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, type: "pin_change_request" }),
      });
      if (!res.ok) throw new Error();
      setOtpStep("verify");
      setOtpInput("");
    } catch {
      setOtpError("Failed to send code. Try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (otpInput.length !== 6) return;
    setOtpSending(true);
    setOtpError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      const res = await fetch("/api/vault-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          type: "verify",
          otp: otpInput,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOtpError(json.error ?? "Invalid code.");
        return;
      }
      setOtpStep("new_pin");
      setNewPinInput("");
      setNewPinConfirm("");
      setNewPinStep("enter");
      setNewPinError("");
    } catch {
      setOtpError("Verification failed. Try again.");
    } finally {
      setOtpSending(false);
    }
  }

  //Auto Lock
  useEffect(() => {
    if (vaultLocked) return; // only run when vault is open

    let timer: ReturnType<typeof setTimeout>;

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setVaultLocked(true);
        setVaultPin("");
        setDecryptedEntries({});
        setVaultEntries([]);
        setPinInput("");
        setPinStep("enter");
        setPinError("");
      }, 30000); // 30 seconds
    }

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer(); // start the timer immediately on unlock

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [vaultLocked]);

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
        setDailyQuoteEmail(p.daily_quote_email ?? false);
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
      // Load vault meta separately
      getVaultMeta(userId).then((meta) => {
        setVaultMeta(meta);
        setVaultMetaLoading(false);
      });
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
      daily_quote_email: dailyQuoteEmail,
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
          {/* Daily Quote Email */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#e8e2d8]">
            <div>
              <p className="text-sm font-semibold text-[#111010]">
                Daily Quote Email
              </p>
              <p className="text-[10px] text-[#9a8f7e]">
                Receive a daily message from Taehyun every morning
              </p>
            </div>
            <button
              onClick={() => setDailyQuoteEmail((p) => !p)}
              className={`w-11 h-6 rounded-full transition-all relative ${dailyQuoteEmail ? "bg-[#f97316]" : "bg-[#e8e2d8]"}`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${dailyQuoteEmail ? "left-5" : "left-0.5"}`}
              />
            </button>
          </div>
        </div>

        {/* Vault */}
        <div className="bg-white border border-[#e8e2d8] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9a8f7e] font-mono">
              🔐 Password Vault
            </p>
            {!vaultLocked && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setChangingPin((prev) => !prev);
                    setNewPinInput("");
                    setNewPinConfirm("");
                    setNewPinStep("enter");
                    setNewPinError("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#faf8f5] border border-[#e8e2d8] text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all text-[10px] font-bold uppercase tracking-widest font-mono"
                >
                  🔑 Change PIN
                </button>
                <button
                  onClick={() => {
                    setVaultLocked(true);
                    setVaultPin("");
                    setDecryptedEntries({});
                    setVaultEntries([]);
                    setPinInput("");
                    setPinStep("enter");
                    setPinError("");
                    setChangingPin(false);
                    setOtpStep("idle");
                    setOtpInput("");
                    setOtpError("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-400 hover:bg-red-100 hover:border-red-300 hover:text-red-500 transition-all text-[10px] font-bold uppercase tracking-widest font-mono"
                >
                  🔒 Lock
                </button>
              </div>
            )}
          </div>
          {!vaultLocked && changingPin && (
            <div className="mb-4 p-4 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl">
              {/* Step 1 — Request OTP */}
              {otpStep === "idle" && (
                <div>
                  <p className="text-xs text-[#9a8f7e] mb-4 leading-relaxed">
                    To change your vault PIN, we'll send a verification code to
                    your email first.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRequestOtp}
                      disabled={otpSending}
                      className="flex-1 py-2.5 rounded-xl bg-[#f97316] text-white text-xs font-bold hover:bg-[#c2500f] transition-all disabled:opacity-40"
                    >
                      {otpSending ? "Sending..." : "Send verification code"}
                    </button>
                    <button
                      onClick={() => {
                        setChangingPin(false);
                        setOtpStep("idle");
                        setOtpError("");
                      }}
                      className="px-4 py-2.5 rounded-xl border border-[#e8e2d8] text-xs text-[#9a8f7e] hover:border-[#f97316] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                  {otpError && (
                    <p className="text-[10px] text-red-400 mt-2 font-mono">
                      {otpError}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2 — Enter OTP */}
              {otpStep === "verify" && (
                <div>
                  <p className="text-xs text-[#9a8f7e] mb-4 leading-relaxed">
                    Enter the 6-digit code sent to your email. It expires in 10
                    minutes.
                  </p>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) =>
                        setOtpInput(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                      placeholder="000000"
                      className="flex-1 bg-white border border-[#e8e2d8] rounded-xl px-4 py-2.5 text-sm text-center tracking-[6px] font-mono outline-none focus:border-[#f97316] transition-colors"
                    />
                    <button
                      onClick={handleVerifyOtp}
                      disabled={otpSending || otpInput.length !== 6}
                      className="px-4 py-2.5 rounded-xl bg-[#f97316] text-white text-xs font-bold hover:bg-[#c2500f] transition-all disabled:opacity-40"
                    >
                      {otpSending ? "..." : "Verify"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleRequestOtp}
                      disabled={otpSending}
                      className="text-[10px] font-mono text-[#9a8f7e] hover:text-[#f97316] transition-colors"
                    >
                      Resend code
                    </button>
                    <button
                      onClick={() => {
                        setChangingPin(false);
                        setOtpStep("idle");
                        setOtpError("");
                        setOtpInput("");
                      }}
                      className="text-[10px] font-mono text-[#c5bdb0] hover:text-red-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {otpError && (
                    <p className="text-[10px] text-red-400 mt-2 font-mono">
                      {otpError}
                    </p>
                  )}
                </div>
              )}

              {/* Step 3 — Set new PIN */}
              {otpStep === "new_pin" && (
                <div>
                  <p className="text-xs text-[#9a8f7e] mb-4 leading-relaxed">
                    {newPinStep === "enter"
                      ? "Enter your new 6-digit PIN."
                      : "Confirm your new PIN."}
                  </p>
                  {/* PIN dots */}
                  <div className="flex justify-center gap-3 mb-5">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const current =
                        newPinStep === "confirm" ? newPinConfirm : newPinInput;
                      return (
                        <div
                          key={i}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            i < current.length
                              ? "bg-[#f97316] border-[#f97316]"
                              : "bg-transparent border-[#e8e2d8]"
                          }`}
                        />
                      );
                    })}
                  </div>
                  {/* PIN pad */}
                  <div className="grid grid-cols-3 gap-2 max-w-50 mx-auto mb-3">
                    {[
                      "1",
                      "2",
                      "3",
                      "4",
                      "5",
                      "6",
                      "7",
                      "8",
                      "9",
                      "",
                      "0",
                      "⌫",
                    ].map((key, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (key === "⌫") handleNewPinBackspace();
                          else if (key !== "") handleNewPinDigit(key);
                        }}
                        disabled={key === "" || savingPin}
                        className={`h-12 rounded-xl text-sm font-bold transition-all ${
                          key === ""
                            ? "invisible"
                            : key === "⌫"
                              ? "text-[#9a8f7e] hover:bg-white border border-[#e8e2d8]"
                              : "bg-white border border-[#e8e2d8] text-[#111010] hover:border-[#f97316] hover:text-[#f97316] active:scale-95"
                        }`}
                      >
                        {savingPin ? "..." : key}
                      </button>
                    ))}
                  </div>
                  {newPinError && (
                    <p className="text-[10px] text-red-400 text-center font-mono">
                      {newPinError}
                    </p>
                  )}
                  {savingPin && (
                    <p className="text-[10px] text-[#9a8f7e] text-center font-mono mt-2">
                      Re-encrypting entries...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {vaultMetaLoading ? (
            <p className="text-xs text-[#c5bdb0] font-mono text-center py-4">
              Loading...
            </p>
          ) : vaultLocked ? (
            <div>
              {/* Setup vs unlock heading */}
              <p className="text-xs text-[#9a8f7e] mb-4 leading-relaxed">
                {!vaultMeta
                  ? pinStep === "enter"
                    ? "Set a 6-digit PIN to protect your vault. This PIN is never stored — keep it safe."
                    : "Confirm your PIN."
                  : pinLocked
                    ? "Vault locked for this session due to too many attempts."
                    : "Enter your 6-digit PIN to unlock your vault."}
              </p>

              {!pinLocked && (
                <>
                  {/* PIN dots */}
                  <div className="flex justify-center gap-3 mb-5">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const current =
                        pinStep === "confirm" ? pinConfirm : pinInput;
                      return (
                        <div
                          key={i}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            i < current.length
                              ? "bg-[#f97316] border-[#f97316]"
                              : "bg-transparent border-[#e8e2d8]"
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* PIN pad */}
                  <div className="grid grid-cols-3 gap-2 max-w-50 mx-auto mb-3">
                    {[
                      "1",
                      "2",
                      "3",
                      "4",
                      "5",
                      "6",
                      "7",
                      "8",
                      "9",
                      "",
                      "0",
                      "⌫",
                    ].map((key, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (key === "⌫") handlePinBackspace();
                          else if (key !== "") handlePinDigit(key);
                        }}
                        disabled={key === ""}
                        className={`h-12 rounded-xl text-sm font-bold transition-all ${
                          key === ""
                            ? "invisible"
                            : key === "⌫"
                              ? "text-[#9a8f7e] hover:bg-[#faf8f5] border border-[#e8e2d8]"
                              : "bg-[#faf8f5] border border-[#e8e2d8] text-[#111010] hover:border-[#f97316] hover:text-[#f97316] active:scale-95"
                        }`}
                      >
                        {vaultLoading && key === "0" ? "..." : key}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {pinError && (
                <p className="text-[10px] text-red-400 text-center mt-2 font-mono">
                  {pinError}
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Entry list */}
              <div className="flex flex-col gap-2 mb-3">
                {vaultEntries.length === 0 && (
                  <p className="text-xs text-[#c5bdb0] font-mono text-center py-4">
                    No entries yet. Add your first password below.
                  </p>
                )}
                {vaultEntries.map((entry) => {
                  const dec = decryptedEntries[entry.id];
                  const revealed = revealedIds.has(entry.id);
                  const isEditing = editingId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      className="bg-[#faf8f5] border border-[#e8e2d8] rounded-xl p-3"
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Site / App name *"
                            className="w-full bg-white border border-[#e8e2d8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#f97316] transition-colors"
                          />
                          <input
                            type="text"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            placeholder="Username / Email"
                            className="w-full bg-white border border-[#e8e2d8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#f97316] transition-colors"
                          />
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Password *"
                            className="w-full bg-white border border-[#e8e2d8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#f97316] transition-colors"
                          />
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            className="w-full bg-white border border-[#e8e2d8] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#f97316] transition-colors"
                          />
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex-1 py-2 rounded-xl border border-[#e8e2d8] text-xs text-[#9a8f7e] hover:border-[#f97316] transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleEditEntry(entry.id)}
                              disabled={savingEdit}
                              className="flex-1 py-2 rounded-xl bg-[#f97316] text-white text-xs font-bold hover:bg-[#c2500f] transition-all disabled:opacity-40"
                            >
                              {savingEdit ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-[#111010]">
                              {entry.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setRevealedIds((prev) => {
                                    const next = new Set(prev);
                                    next.has(entry.id)
                                      ? next.delete(entry.id)
                                      : next.add(entry.id);
                                    return next;
                                  })
                                }
                                className="text-[10px] font-mono text-[#9a8f7e] hover:text-[#f97316] transition-colors"
                              >
                                {revealed ? "Hide" : "Show"}
                              </button>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    dec?.password ?? "",
                                  )
                                }
                                className="text-[10px] font-mono text-[#9a8f7e] hover:text-[#f97316] transition-colors"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(entry.id);
                                  setEditName(entry.name);
                                  setEditUsername(dec?.username ?? "");
                                  setEditPassword(dec?.password ?? "");
                                  setEditNotes(dec?.notes ?? "");
                                }}
                                className="text-[10px] font-mono text-[#9a8f7e] hover:text-[#f97316] transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="text-[10px] font-mono text-[#c5bdb0] hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          {dec?.username && (
                            <p className="text-[11px] text-[#9a8f7e] font-mono">
                              {dec.username}
                            </p>
                          )}
                          <p className="text-[11px] font-mono text-[#9a8f7e] mt-0.5">
                            {revealed ? dec?.password : "••••••••••••"}
                          </p>
                          {revealed && dec?.notes && (
                            <p className="text-[10px] text-[#c5bdb0] font-mono mt-1">
                              {dec.notes}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add entry */}
              {showAddEntry ? (
                <div className="border border-[#e8e2d8] rounded-xl p-4 flex flex-col gap-2">
                  <input
                    type="text"
                    value={newEntryName}
                    onChange={(e) => setNewEntryName(e.target.value)}
                    placeholder="Site / App name *"
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2 text-sm outline-none focus:border-[#f97316] transition-colors"
                  />
                  <input
                    type="text"
                    value={newEntryUsername}
                    onChange={(e) => setNewEntryUsername(e.target.value)}
                    placeholder="Username / Email"
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2 text-sm outline-none focus:border-[#f97316] transition-colors"
                  />
                  <input
                    type="password"
                    value={newEntryPassword}
                    onChange={(e) => setNewEntryPassword(e.target.value)}
                    placeholder="Password *"
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2 text-sm outline-none focus:border-[#f97316] transition-colors"
                  />
                  <input
                    type="text"
                    value={newEntryNotes}
                    onChange={(e) => setNewEntryNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-4 py-2 text-sm outline-none focus:border-[#f97316] transition-colors"
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setShowAddEntry(false)}
                      className="flex-1 py-2 rounded-xl border border-[#e8e2d8] text-xs text-[#9a8f7e] hover:border-[#f97316] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddEntry}
                      disabled={savingEntry}
                      className="flex-1 py-2 rounded-xl bg-[#f97316] text-white text-xs font-bold hover:bg-[#c2500f] transition-all disabled:opacity-40"
                    >
                      {savingEntry ? "Saving..." : "Save Entry"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddEntry(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[#e8e2d8] text-xs text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all font-mono"
                >
                  + Add entry
                </button>
              )}
            </div>
          )}
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
