// components/AppProviders.tsx
"use client";

import dynamic from "next/dynamic";
import { MusicProvider } from "@/lib/MusicContext";

// The MiniPlayer is chrome, never part of the first paint.
const MiniPlayer = dynamic(() => import("@/components/MiniPlayer"), { ssr: false });

/**
 * Everything that has to outlive a route change.
 *
 * `MusicProvider` used to sit inside `app/dashboard/page.tsx`, which meant
 * navigating to `/about` unmounted it — and its cleanup does
 * `audio.pause(); audio.src = ""`. The audio element was being *destroyed*, not
 * paused, so the music stopped and came back rewound to the last saved position.
 * A layout-level provider is the only place that survives a route change; a
 * route-group layout wouldn't help, because the dashboard page still unmounts.
 *
 * The cost is that the playlist fetch and one `supabase.auth.getUser()` now also
 * run on `/auth` and `/about`. Nothing autoplays, so that's the whole cost.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MusicProvider>
      {children}
      <MiniPlayer />
    </MusicProvider>
  );
}
