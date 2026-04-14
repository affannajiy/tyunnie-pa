// app/layout.tsx
import type { Metadata } from "next";
import { Instrument_Serif, Nunito } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
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
            }
          } catch(e) {}
        `,
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
