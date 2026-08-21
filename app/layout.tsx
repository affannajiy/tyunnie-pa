// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Nunito } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
// Music has to keep playing across a route change, so its provider lives here
// rather than under /dashboard. See AppProviders for why.
import AppProviders from "@/components/AppProviders";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  // "optional" over "swap": the above-the-fold 5xl italic serif greeting was a
  // visible CLS source on swap-in. "optional" uses the metric-adjusted fallback
  // when the web font isn't ready in time, eliminating the layout shift.
  display: "optional",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tyunnie",
  description: "Your personal AI assistant",
  icons: {
    icon: [
      { url: "/Tyun-512.png", sizes: "512x512", type: "image/png" },
      { url: "/Tyun-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

// Next's default viewport omits `viewport-fit`, which means every
// `env(safe-area-inset-*)` in the app silently resolves to 0 — the mobile dock's
// bottom padding and the dashboard's scroll padding were both no-ops on any
// notched phone. `cover` is what turns those on.
//
// Deliberately NO `maximumScale` / `userScalable: false`: capping zoom is the
// other common way to stop iOS auto-zooming small inputs, and it takes pinch-zoom
// away from everyone to do it. The 16px input rule in globals.css solves the same
// problem without removing the gesture.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0d0b" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${nunito.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect to Supabase — shaves ~200-400ms off TTFB for auth + DB calls */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
        {/* Preconnect to Open-Meteo for faster weather fetch */}
        <link rel="preconnect" href="https://api.open-meteo.com" />
        {/* Preload above-the-fold sprites: the loading-screen sprite paints
            first on every desktop visit, the hero is the /dashboard LCP. */}
        <link rel="preload" as="image" href="/sprites/tyun-mood-default.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/sprites/tyun-hero.png" fetchPriority="high" />
      </head>
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
          try {
            if (localStorage.getItem('tyunnie_theme') === 'dark') {
              document.documentElement.classList.add('dark');
            }
            var accent = localStorage.getItem('tyunnie_accent');
            if (accent) {
              var ri = parseInt(accent.slice(1,3),16);
              var gi = parseInt(accent.slice(3,5),16);
              var bi = parseInt(accent.slice(5,7),16);
              // Convert to HSL to derive tint/shade variants
              var r = ri/255, g = gi/255, b = bi/255;
              var max = Math.max(r,g,b), min = Math.min(r,g,b);
              var h, s, l = (max+min)/2;
              if (max === min) { h = s = 0; }
              else {
                var d = max - min;
                s = l > 0.5 ? d/(2-max-min) : d/(max+min);
                switch(max) {
                  case r: h = ((g-b)/d + (g<b?6:0))/6; break;
                  case g: h = ((b-r)/d + 2)/6; break;
                  case b: h = ((r-g)/d + 4)/6; break;
                }
              }
              h = Math.round(h*360); s = Math.round(s*100); l = Math.round(l*100);
              function hsl2hex(h,s,l) {
                s /= 100; l /= 100;
                var a = s*Math.min(l,1-l);
                function f(n) {
                  var k=(n+h/30)%12;
                  var c=l-a*Math.max(Math.min(k-3,9-k,1),-1);
                  return Math.round(255*c).toString(16).padStart(2,'0');
                }
                return '#'+f(0)+f(8)+f(4);
              }
              var root = document.documentElement;
              root.style.setProperty('--accent', accent);
              root.style.setProperty('--accent-soft', hsl2hex(h, Math.min(s+10,100), Math.min(l+42, 97)));
              root.style.setProperty('--accent-mid', hsl2hex(h, Math.min(s+5,100), Math.min(l+28, 90)));
              root.style.setProperty('--accent-dim', hsl2hex(h, Math.min(s+5,100), Math.max(l-18, 15)));
              root.style.setProperty('--accent-rgb', ri+','+gi+','+bi);
              // Contrast-safe derivatives — must be computed here too, or the
              // first paint uses the fallbacks in globals.css and the accent
              // text flashes at the wrong lightness. Mirrors lib/accent.ts.
              function lum(hex) {
                var v = [1,3,5].map(function(i){
                  var c = parseInt(hex.slice(i,i+2),16)/255;
                  return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
                });
                return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
              }
              function ratio(a,b) {
                var x = lum(a), y = lum(b);
                return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
              }
              function walk(bg, step) {
                var out = accent;
                for (var i = 0; i <= 100; i++) {
                  var li = Math.max(0, Math.min(100, l + step*i));
                  out = hsl2hex(h, s, li);
                  if (ratio(out, bg) >= 4.5) return out;
                  if (li === 0 || li === 100) break;
                }
                return out;
              }
              root.style.setProperty('--accent-text', walk('#ffffff', -2));
              root.style.setProperty('--accent-text-dark', walk('#111010', 2));
              root.style.setProperty('--accent-on', ratio(accent,'#ffffff') >= ratio(accent,'#16120c') ? '#ffffff' : '#16120c');
            }
          } catch(e) {}
        `,
          }}
        />
        <AppProviders>{children}</AppProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
