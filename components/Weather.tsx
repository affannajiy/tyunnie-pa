// components/Weather.tsx
"use client";

import { useState, useEffect } from "react";

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Icy fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy snow", icon: "❄️" },
  80: { label: "Showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Heavy showers", icon: "⛈️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  99: { label: "Thunderstorm", icon: "⛈️" },
};

function getWeather(code: number) {
  return WMO_CODES[code] ?? { label: "Unknown", icon: "🌡️" };
}

type WeatherData = { temp: number; code: number; city: string };

export default function Weather() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  // Load saved city on mount
  useEffect(() => {
    const saved = localStorage.getItem("tyunnie_city");
    if (saved) {
      const parsed = JSON.parse(saved);
      fetchWeather(parsed.lat, parsed.lon, parsed.city);
    }
  }, []);

  async function fetchWeather(lat: number, lon: number, city: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
      );
      const json = await res.json();
      setData({
        temp: Math.round(json.current.temperature_2m),
        code: json.current.weather_code,
        city,
      });
    } catch {
      setError("Failed to fetch weather");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.trim())}&count=1`,
      );
      const json = await res.json();
      if (!json.results?.length) {
        setError("City not found");
        setLoading(false);
        return;
      }
      const { latitude, longitude, name, country } = json.results[0];
      const cityLabel = `${name}, ${country}`;
      localStorage.setItem(
        "tyunnie_city",
        JSON.stringify({ lat: latitude, lon: longitude, city: cityLabel }),
      );
      await fetchWeather(latitude, longitude, cityLabel);
      setEditing(false);
      setInput("");
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  // ── EDITING STATE ──
  if (editing) {
    return (
      <div className="hidden md:flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
            if (e.key === "Escape") {
              setEditing(false);
              setError("");
            }
          }}
          placeholder="City name..."
          className="bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-3 py-1.5 text-xs text-[#111010] outline-none focus:border-[#f97316] transition-colors w-32 placeholder:text-[#c5bdb0]"
        />
        {error && <span className="text-[10px] text-red-400">{error}</span>}
        <button
          onClick={handleSearch}
          className="text-[10px] font-bold text-[#f97316] hover:text-[#c2500f] transition-colors"
        >
          Go
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setError("");
          }}
          className="text-[10px] text-[#c5bdb0] hover:text-[#9a8f7e] transition-colors"
        >
          ✕
        </button>
      </div>
    );
  }

  // ── LOADING ──
  if (loading)
    return (
      <div className="hidden md:flex items-center gap-1.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-3 py-1.5">
        <div className="w-3 h-3 rounded-full bg-[#e8e2d8] animate-pulse" />
        <div className="w-10 h-3 rounded bg-[#e8e2d8] animate-pulse" />
      </div>
    );

  // ── NO CITY SET YET ──
  if (!data)
    return (
      <button
        onClick={() => setEditing(true)}
        className="hidden md:flex items-center gap-1.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-3 py-1.5 text-[10px] text-[#c5bdb0] font-mono hover:border-[#f97316] hover:text-[#f97316] transition-all"
      >
        + Add city
      </button>
    );

  // ── DISPLAY ──
  const { icon, label } = getWeather(data.code);
  return (
    <button
      onClick={() => setEditing(true)}
      className="hidden md:flex items-center gap-1.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl px-3 py-1.5 text-xs text-[#9a8f7e] font-mono hover:border-[#f97316] transition-all"
      title={`${data.city} — click to change`}
    >
      <span className="text-sm">{icon}</span>
      <span className="font-bold text-[#111010]">{data.temp}°C</span>
      <span className="text-[10px] hidden lg:block">{label}</span>
    </button>
  );
}
