// lib/useAccentColor.ts
// Returns the current accent RGB string (e.g. "249, 115, 22") from the CSS
// custom property --accent-rgb, keeping in sync with localStorage changes.
import { useState, useEffect } from "react";

function readAccentRgb(): string {
  if (typeof window === "undefined") return "249, 115, 22";
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent-rgb")
    .trim();
  return val || "249, 115, 22";
}

export function useAccentColor() {
  const [accentRgb, setAccentRgb] = useState<string>(readAccentRgb);

  useEffect(() => {
    // Sync once on mount (CSS var may differ from default if layout script ran)
    setAccentRgb(readAccentRgb());

    // Listen for accent changes dispatched by Profile
    function onAccentChange() {
      setAccentRgb(readAccentRgb());
    }
    window.addEventListener("tyunnie-accent-changed", onAccentChange);
    return () =>
      window.removeEventListener("tyunnie-accent-changed", onAccentChange);
  }, []);

  return accentRgb;
}
