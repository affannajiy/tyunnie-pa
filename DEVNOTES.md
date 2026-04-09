# 🛠️ Tyunnie — Developer Notes

A running log of gotchas, non-obvious decisions, and things that will waste your time if you don't know about them.

---

## 🔀 Routing

### Root redirect lives in `next.config.ts`, not `app/page.tsx`

The root `/` redirect is defined in `next.config.ts` under `async redirects()`, not in `app/page.tsx`.
This means `app/page.tsx` is effectively ignored for the root route — `next.config.ts` intercepts it first at the server level before React loads.

**If you change the default landing page, update `next.config.ts`:**

```ts
// next.config.ts
async redirects() {
  return [
    {
      source: '/',
      destination: '/dashboard', // ← change this, not app/page.tsx
      permanent: false,
    },
  ]
}
```

This burned us when `/chat` was deleted but the root still redirected there, causing a 404 on every startup. Took a full search of the codebase to find it.

---

## 🔐 Auth

### Supabase session can get into a bad state after failed OAuth attempts

If Google OAuth fails mid-flow (e.g. "Unable to exchange external code"), the Supabase session stored in localStorage/IndexedDB can become corrupt and cause `supabase.auth.getUser()` to hang indefinitely — resulting in an infinite loading screen.

**Fix:** Clear all `sb-*` keys from localStorage and IndexedDB in browser DevTools → Application, then hard refresh.

### Auth timeout guard

A 15-second timeout was added to the auth `useEffect` in `dashboard/page.tsx` to prevent infinite loading. If `setAuthLoading(false)` doesn't fire within 15 seconds, it redirects to `/auth`. Increase the timeout if you're on a slow connection and keep getting kicked out.

### Google OAuth "Unable to exchange external code" error

Root cause: the OAuth callback URL in Google Cloud Console must exactly match the Supabase callback URL. The two URLs must be entered as **separate entries**, not concatenated into one string.

Required entries in Google Cloud Console → Authorized redirect URIs:

```
https://<your-project>.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback  ← for local dev
```

If they're entered as one combined string it silently fails.

---

## 🗣️ Web Speech API (Voice Input)

### Never use explicit Speech API types in TypeScript

`SpeechRecognitionEvent` and `SpeechRecognitionErrorEvent` are browser-only types that TypeScript's production compiler cannot resolve, even with declarations in `global.d.ts`. They compile fine locally but **fail on Vercel**.

**Always use `any` for all Speech API types in `lib/useSpeech.ts`:**

```ts
recognition.onresult = (event: any) => { ... }
recognition.onerror = (e: any) => { ... }
const recognitionRef = useRef<any>(null);
```

This burned us across three consecutive failed Vercel deployments (3.0.0 → 3.0.1 → 3.0.2 → 3.0.3).

---

## ⚡ Performance

### Daily briefing and desk one-liner fire repeatedly without sessionStorage guard

The `useRef` guard (`briefingFiredRef`) resets every time the component remounts — which happens on every panel switch since components unmount when not active.

**Always use `sessionStorage` to gate AI generation calls:**

```ts
// Good
const cached = sessionStorage.getItem("tyunnie_briefing");
if (cached) {
  setBriefing(cached);
  return;
}

// Bad — resets on every panel switch
const firedRef = useRef(false);
if (firedRef.current) return;
```

Keys in use:

- `sessionStorage("tyunnie_briefing")` — TyunniePanel daily briefing
- `sessionStorage("desk_oneliner")` — Desk AI one-liner

Both regenerate on new tab or hard refresh, which is the correct behavior.

---

## 🎵 Audio / Music

### `togglePlay` must be async

`audioCtxRef.current.resume()` returns a Promise. If `togglePlay` is not marked `async`, the `await` causes a syntax error at runtime.

```ts
// Must be async
async function togglePlay() {
  await audioCtxRef.current?.resume();
  ...
}
```

### Audio-reactive glow uses direct DOM manipulation, not React state

The music glow effect in `Music.tsx` drives `boxShadow` directly via `coverRef` (a DOM ref) instead of React state. This is intentional — React state causes re-render overhead that breaks per-frame beat detection. Don't refactor this to `useState`.

---

## 🖼️ Images & Sprites

### Next.js `Image` src must not include `/public/`

```ts
// Wrong
src = "/public/sprites/tyun-mood-happy.png";

// Correct
src = "/sprites/tyun-mood-happy.png";
```

Next.js serves the `public/` directory at the root. Including `/public/` in the path causes a 404.

### Sprite canvas size

All sprites should be **360×460px** transparent PNGs, subject centered, under 200KB. The canvas size must be consistent across all sprites or the layout will shift when moods change.

For the Desk hero upper-torso sprite, recommended size is **560×720px** (displays at `200×240` via Next.js Image).

---

## 🗄️ Supabase

### Demo user guard in `database.ts`

All database getter functions have an early return for `"demo-user"` to suppress Supabase console errors in demo mode:

```ts
if (userId === "demo-user") return [];
```

If you add a new database function, add this guard or the demo page will spam errors.

### `DEMO_FINANCE` array needs account fields

If the `FinanceEntry` type is updated with new required fields (e.g. `account`), the `DEMO_FINANCE` array in `app/demo/page.tsx` must be updated too or TypeScript will error.

---

## 🔧 CSS / Tailwind

### CSS module declarations go in `global.d.ts`, not `next-env.d.ts`

`next-env.d.ts` is auto-regenerated and gitignored. Any `declare module "*.css"` added there will be lost.

Put it in `global.d.ts` at the repo root instead.

### Collapsible panels use `flex-1` / `flex-none` toggling

Use `flex-1` vs `flex-none` (not `w-0`) for collapsible panel transitions. Using `w-0` causes layout collapse issues with flex children that have `min-width`.

## 🗒️ Sticky Notes

### Jitter fix — `isTypingRef` guard on content sync

`StickyNote.tsx` syncs `note.content` prop to local state via `useEffect`. Without a guard, the debounced save fires → updates `stickyNotes` state in dashboard → prop flows back down → `useEffect` resets textarea mid-type.

Fix: `isTypingRef` set to `true` on keystroke, `false` after the 600ms debounce save. The `useEffect` only applies when `isTypingRef.current === false`.

```ts
useEffect(() => {
  if (!isTypingRef.current) setContent(note.content);
}, [note.content]);
```

### AI clear_sticky used color instead of UUID

The model was reading `[yellow]` and using that as the id. Fixed by prefixing each sticky with `[id:uuid]` in the system prompt and adding an explicit rule: "use the EXACT id value from [id:...], NOT the color."

---

## ⏲️ Pomodoro Autostart

### Use sessionStorage, not props, for autostart flag

Passing `autoStart` as a prop races against the async `getTodos` fetch inside Pomodoro. By the time todos load and `setRunning(true)` would fire, the prop has already been reset by a parent `setTimeout`.

**Always use sessionStorage for cross-component one-shot flags:**

```ts
// In dashboard before navigating:
sessionStorage.setItem("pomodoro_autostart", "1");

// In Pomodoro useEffect after todos load:
const shouldStart = sessionStorage.getItem("pomodoro_autostart") === "1";
if (shouldStart) {
  sessionStorage.removeItem("pomodoro_autostart");
  setRunning(true);
}
```

### Use a counter key, not the task string, to force remount

`key={pomodoroTask}` causes the component to remount when the task resets to `""` — wiping the linked task mid-session. Use an incrementing counter instead:

```ts
// Good
const [pomodoroKey, setPomodoroKey] = useState(0);
setPomodoroKey((k) => k + 1); // increments, never resets

// Bad
key = { pomodoroTask }; // resets to "default" when task clears
```

---

## 🤖 Tyunnie Action System

### Trailing garbage in Groq JSON output

Groq occasionally appends `%`, spaces, or newlines after the closing `}` of the action JSON. Strip before parsing:

```ts
JSON.parse(
  raw
    .trim()
    .replace(/[^}]*$/, "")
    .trim(),
);
```

### AI fires destructive actions on read-only queries

The `clear_sticky` action was triggering on "what's on my sticky" because the "MUST append action" instruction made the model feel compelled to attach something. Two fixes applied:

1. Added `IMPORTANT:` note before STRICT RULES explicitly exempting read-only sticky queries from action appending
2. Added rule: "Reading, summarizing, or asking about content does NOT trigger clear_sticky"

### ID exposure pattern for precise targeting

Tyunnie can only act on the right item if it knows the UUID. Expose IDs in the system prompt with a consistent prefix:

---

## 📦 Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
JDOODLE_CLIENT_ID=
JDOODLE_CLIENT_SECRET=
```

Previously used (now removed):

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=   # Google Calendar integration — removed in 3.0.0
GOOGLE_CLIENT_SECRET=           # Google Calendar integration — removed in 3.0.0
NEXT_PUBLIC_APP_URL=            # Google Calendar integration — removed in 3.0.0
RESEND_API_KEY=                 # Vault email notifications — removed
SUPABASE_SERVICE_ROLE_KEY=      # Vault gcal callback — removed
CRON_SECRET=                    # Daily quote cron — removed
```

---

## 📝 Versioning Convention

- **Patch (x.x.X)** — bug fixes, build failures, type errors
- **Minor (x.X.0)** — new features, UI additions, panel changes
- **Major (X.0.0)** — significant architectural changes, landing page overhaul, major feature removal

Version is tracked in `package.json` and mirrored in the README badge.
