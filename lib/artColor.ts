// lib/artColor.ts
// Pulls a usable accent colour out of album artwork for the Auto-Theme feature.
//
// "Usable" is doing a lot of work here. The literal dominant colour of a real
// album cover is almost always near-black, near-white, or mud-grey — which
// would make the entire UI unreadable, since --accent carries button fills and
// link text. So we discard the boring pixels first, pick the dominant *hue*
// rather than the dominant pixel, and then clamp saturation/lightness into a
// band we know the derived soft/mid/dim variants stay legible in.
//
// Returns null (never a bad colour) when the cover is greyscale, missing, or
// unreadable — callers fall back to the user's own accent.
import { hslToHex } from "@/lib/accent";

// Cache per URL so skipping back and forth doesn't re-decode. null is cached
// too: a cover that failed once (CORS taint, 404) will fail every time.
const cache = new Map<string, string | null>();

const SIZE = 32; // downscale target — 1024 samples is plenty and costs <5ms
const HUE_BINS = 12;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required for getImageData on any cross-origin cover (Supabase storage).
    // Same-origin covers in /public ignore this harmlessly.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load failed"));
    img.src = url;
  });
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Extract a clamped, UI-safe accent hex from an image URL.
 * Resolves null if the artwork can't be read or has no colour worth using.
 */
export async function extractAccent(url: string): Promise<string | null> {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url) ?? null;

  let result: string | null = null;
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    // Throws SecurityError on a tainted canvas — caught below, cached as null.
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    // Weighted hue histogram. Each bin accumulates saturation-weighted votes
    // plus running s/l sums so we can average the winning bin.
    const bins = Array.from({ length: HUE_BINS }, () => ({
      weight: 0,
      s: 0,
      l: 0,
      n: 0,
    }));
    let kept = 0;
    const total = SIZE * SIZE;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // transparent
      const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      // Drop the pixels that would produce an unusable accent
      if (l < 15 || l > 88 || s < 20) continue;
      kept++;
      const bin = bins[Math.floor(h / (360 / HUE_BINS)) % HUE_BINS];
      // Weight by saturation so a small vivid area beats a large washed-out one
      bin.weight += s;
      bin.s += s;
      bin.l += l;
      bin.n++;
    }

    // Mostly greyscale / monochrome cover — no honest colour to borrow.
    if (kept / total < 0.15) throw new Error("no colour");

    const winner = bins.reduce((a, b) => (b.weight > a.weight ? b : a));
    if (winner.n === 0) throw new Error("no colour");

    // Recover the winning bin's true average hue from its own pixels would
    // need a second pass; the bin centre is close enough at 30° resolution.
    const idx = bins.indexOf(winner);
    const hue = Math.round((idx + 0.5) * (360 / HUE_BINS));

    // Clamp into the band where the derived soft/mid/dim variants stay legible
    const sat = Math.min(85, Math.max(45, winner.s / winner.n));
    const light = Math.min(62, Math.max(45, winner.l / winner.n));

    result = hslToHex(hue, Math.round(sat), Math.round(light));
  } catch {
    result = null;
  }

  cache.set(url, result);
  return result;
}
