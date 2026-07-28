# Usability Heuristics — the Tyunnie UI usability contract

**Read this first, then build.** Every UI change (dashboard panels, the Tyunnie
chat sheet, the sidebar dock, hubs, games, sticky notes, popups, banners) must
satisfy the heuristics below. When a design choice is unclear, this document
decides. It adapts [Nielsen's 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
to this application and folds in the higher-level goals (satisfaction,
usefulness, ease of use, ease of learning) they serve.

The audience is **anyone who wants a calmer day** — students, hobbyists, first-time
visitors who arrived from a link and tapped "Try the demo." Most have never seen
the app before and will judge it in thirty seconds, on a phone, without reading
anything. That single fact drives most rules here: plain language, safe defaults,
and in-context help win over power-user density.

Related: [CLAUDE.md](../.claude/CLAUDE.md) (non-obvious implementation rules) ·
[CONTRIBUTING.md](../CONTRIBUTING.md) (PR checklist) ·
[DEVNOTES.md](DEVNOTES.md).

---

## 0. Goals the heuristics serve

These are the outcomes we are optimising for. Each heuristic below feeds one or
more of them.

| Goal | We have succeeded when the user can say… |
| --- | --- |
| **Satisfaction** | "It is pleasant to use." / "It feels calm, not nagging." / "It works the way I want it to work." |
| **Usefulness** | "It is useful." / "It helps me be more effective." / "It helps me be more productive." |
| **Flexibility & efficiency** | "It is flexible." / "I can make it mine." |
| **Ease of use** | "It is easy to use." / "It is simple to use." |
| **Ease of learning** | "It is easy to learn." / "I learned to use it quickly." / "I easily remember how to use it." |

---

## 1. Visibility of system status

> Communicate clearly what the system's state is. No action with consequences should be taken without informing the user. Give feedback as quickly as possible (ideally immediately). Build trust through open, continuous communication.

**In this app:**
- **Every panel has a real loading state** — "Loading your drafts…", "Loading your
  finances…" — never a blank card. The dashboard auth guard shows a splash with a
  15s timeout rather than hanging forever.
- **Every mutation is acknowledged** through the shared `onAction(msg)` callback,
  which speaks in Tyunnie's voice ("Draft saved — your words are always worth
  keeping 🧡"). A save that produces no visible response is a bug.
- The **Writing editor** shows live word/char counts and an explicit `unsaved`
  pill the moment the buffer is dirty.
- **Tyunnie chat** streams and shows a typing/thinking state; a reply must never
  look frozen.
- **Async work that changes data announces itself.** The Finance recurring
  catch-up materialises entries on mount and marks each auto-logged row with `↻`,
  so money appearing in the ledger is never unexplained.
- **Nothing destructive happens silently** — deleting a draft, resetting a month,
  or clearing the demo always confirms first (see §3).

## 2. Match between system and the real world

> Users must understand meaning without looking up definitions. Never assume your words match the user's. Use their familiar terminology and mental models.

**In this app:**
- Speak in **plain, warm, non-technical language**. "Repeat monthly" — not
  "recurrence rule." "Days this week" — not "7-day activity aggregate." Never
  expose a database column name, an API route, or a state key in the UI.
- Labels reflect the user's goal as a verb they already think in: "+ New Draft",
  "Add Entry", "Back to Games", "Try the demo", "Reset demo".
- **Money, dates, and time follow the user's locale**, not the server's. Currency
  is `RM` by default and dates render `en-MY`; the writing streak buckets days in
  Malaysia time (UTC+8) because that is the user's day, not UTC's.
- **Tyunnie's persona is part of the interface.** Copy is low-key and kind, never
  hype or guilt ("rest is productive" over "you're falling behind"). A streak that
  breaks must never scold. See `lib/tyunPersona.ts` → `TYUN_CORE`.
- Errors are translated into consequences and next steps, never raw exception text
  (see §9).

## 3. User control and freedom

> Support Undo and Redo. Show a clear, labelled, discoverable way to exit the current interaction (e.g. a Cancel button).

**In this app:**
- **`Esc` closes any overlay** — command palette, shortcut help, Focus Mode, the
  chat sheet, city search. This is universal and must be wired on every new overlay.
- Every modal and popup has a visible, labelled dismiss; overlays also close on
  backdrop click where dismissal is non-destructive.
- **Destructive actions confirm first**, and the confirm text names the specific
  thing and its blast radius: "Delete all entries for July 2026? This can't be
  undone." Deleting a recurring rule explicitly states that already-logged entries
  stay.
- **Unsaved work is protected** — closing the Writing editor while dirty prompts
  before discarding.
- **Leaving is always cheap.** A user can back out of any panel, hub, or game to
  the dock without losing state; guests can "Reset demo" to get a clean slate.
- Long-lived preferences (accent, theme, float position, music position) are
  restored, never re-imposed — restoring a track does **not** auto-play.

## 4. Consistency and standards

> Improve learnability through internal consistency (within this product family) and external consistency (industry conventions).

**In this app:**
- **Internal:** one set of design tokens — accent CSS vars (`--accent`,
  `--accent-dim/mid/soft/rgb`) on `<html>`, never a hardcoded orange; glows use
  `rgba(var(--accent-rgb),…)`. Shared primitives are imported, never redefined:
  `components/ui/Kbd.tsx` for keys, `lib/platform.ts` `isMac()`/`modKey()` for
  platform text. Panel chrome is uniform: `bg-white border border-[#e8e2d8]
  rounded-2xl`, a serif-italic accent section header with a hairline rule, and
  `font-mono` uppercase micro-labels.
- **External:** standard desktop and mobile idioms are honoured — `Cmd/Ctrl+K` for
  a command palette, `?` for shortcut help, `Esc` to dismiss, `Cmd/Ctrl+S` to save,
  red = destructive/error, green = income/success, a bottom sheet that swipes down
  to dismiss on mobile.
- **Platform-correct modifiers.** Never hardcode "Ctrl" — `isMac()` decides, and
  `ShortcutHelp` renders the right glyphs per platform.
- New UI reuses an existing pattern unless there is a stated reason not to. If a
  genuinely new pattern is needed, add it to this document (see *How to use*).

**Implementation note — accent tokens, and the shim behind them:**

`app/globals.css` carries an **"ACCENT COLOR OVERRIDES"** block that remaps the
hardcoded Tailwind literals — `.bg-[#f97316]`, `.text-[#f97316]`,
`.border-[#f97316]`, `.accent-[#f97316]`, the `/10 /15 /20 /25` opacity
variants, and the `#fff0e6` / `#fed7aa` / `#c2500f` family — onto
`var(--accent…)` with `!important`.

**Read that block before reporting a hardcoded orange as a bug.** A v3.23.0
audit flagged 249 literals as "opted out of the accent picker and Auto-Theme";
that was wrong — the shim was already recolouring every one of them. Grepping
components without checking whether the stylesheet compensates produces
confident false positives. The same trap applies to dark mode, which also
works by overriding light utility *classes* rather than per-component `dark:`
pairs.

Preferred form in new code is still the direct token — `bg-(--accent)`,
`text-(--accent)`, `border-(--accent)` (Tailwind v4 custom-property syntax), or
`rgba(var(--accent-rgb), …)` for glows — because it says what it means and
doesn't require extending the shim by hand for each new utility or opacity
step. But a literal is a **cleanliness** issue, not a broken control.

**Three literal uses are correct and must not be "fixed":**
1. The `#f97316` **preset swatch** in Profile — it *is* the orange option.
2. The **default fallback** (`localStorage.getItem("tyunnie_accent") ?? "#f97316"`).
3. A **canvas/SVG fallback** where a CSS var can't be used, so the computed
   value is resolved with a literal backstop — see `Calculator.tsx`. This is
   what §13 prescribes.

## 5. Error prevention

> Prevent high-cost errors first, then little frustrations. Avoid slips with constraints and good defaults. Prevent mistakes by removing memory burdens, supporting undo, and warning users.

**In this app:**
- **High-cost first: never white-screen the dashboard.** A corrupt `localStorage`
  blob in a mount effect trips the error boundary and takes down the whole app —
  so **every `JSON.parse(localStorage…)` must be wrapped in try/catch.** This is
  the single highest-cost, lowest-visibility failure class in this codebase and it
  has bitten us before (Weather, v3.22.0).
- **Guard the irreversible**, not the routine: destructive deletes confirm; ordinary
  saves do not interrupt.
- **Constrain inputs at the source** — amounts are `min=0 step=0.01`, day-of-month
  is a 1–31 picker (not free text) and is clamped to each month's real last day so
  "31" never silently skips February. Empty descriptions and non-positive amounts
  can't be submitted.
- **Safe defaults everywhere**: today's date pre-filled, `Wallet` account, sensible
  category. A first-time user can succeed by pressing the primary button.
- **Idempotency guards** protect data integrity where the user can't see it — the
  recurring engine's `last_generated` high-water mark makes a remount incapable of
  double-charging the ledger.
- **Paid/authenticated actions are disabled with an explanation for guests**, never
  presented and then rejected with a 401.

## 6. Recognition rather than recall

> Let people recognise information in the interface rather than remember it. Offer help in context, not a tutorial to memorise. Reduce what users must remember.

**In this app:**
- **The command palette (`Cmd/Ctrl+K`) is the app's memory**, not the user's — every
  panel and action is findable by typing a few letters instead of recalling where
  it lives.
- **`?` opens the full shortcut sheet** so no accelerator has to be memorised to be
  used. Discoverable shortcuts also appear as inline `Kbd` hints at the point of
  use ("Cmd+S to save").
- Choices are **labelled controls with visible current values** — dropdowns, pills,
  toggles — not free text whose syntax must be recalled. Account and category are
  pickers; filters show which one is active.
- **State is shown, not remembered**: unsaved pills, active-filter highlighting,
  paused recurring rules rendered dimmed and labelled "paused", auto-logged rows
  badged `↻`.
- Tyunnie's memories and the workspace snapshot let the assistant recall context so
  the *user* doesn't have to restate it.

## 7. Flexibility and efficiency of use

> Provide accelerators (keyboard shortcuts, gestures). Provide personalization. Allow customization of how the product works.

**In this app:**
- **A real accelerator layer exists and must be maintained** (canonical list lives in
  `components/ShortcutHelp.tsx` — update it whenever a shortcut is added):
  - `Cmd/Ctrl+1…9` — jump to Home, Tasks, Writing, Projects, Snippets, Finance, Music, Games, Profile
  - `Cmd/Ctrl+⇧+N/D/P/S` — quick-add task, draft, project, snippet
  - `Cmd/Ctrl+K` — command palette · `Cmd/Ctrl+⇧+T` — Tyunnie chat · `Cmd/Ctrl+⇧+F` — Focus Mode · `Cmd/Ctrl+⇧+K` — sticky note
  - `Cmd/Ctrl+S` — save (Writing, Snippets) · `Cmd/Ctrl+M` — play/pause · `?` — shortcuts · `Esc` — dismiss
- **Every accelerator has a pointer-driven equivalent.** Keyboard is a faster path,
  never the only path — mobile users have no keyboard at all.
- **Personalisation is first-class**: accent colour, light/dark theme, greeting
  style, desk layout, currency/locale, briefing on/off, chat floated or docked.
  Preferences persist and are restored on load.
- **Gestures where they're natural**: the chat sheet drags and snaps; MiniPlayer and
  the float window are pointer-drag with `setPointerCapture`; swipe-up from the
  edge opens chat.
- **Layered depth** — smart defaults carry newcomers, while per-row/per-item options
  (tags, categories, refinement of recurring rules) reward the invested user.

## 8. Aesthetic and minimalist design

> Keep content and visual design focused on essentials. Don't let unnecessary elements distract. Prioritize content and features that support primary goals.

**In this app:**
- **One panel, one job.** Hubs (Productivity / Create / Entertainment) group related
  panels so the dock never becomes a wall of icons.
- **Progressive disclosure**: the recurring day-picker only appears once "Repeat
  monthly" is on; the recurring list is hidden entirely when there are no rules;
  analytics live behind a tab, not stacked under the tracker; delete `✕` buttons
  reveal on hover rather than sitting permanently in the layout.
- **Colour means something** — accent for primary/interactive, green income/success,
  red expense/destructive, muted for metadata. Never decorate with a semantic colour.
- **Typography is a hierarchy, not variety**: serif-italic for headline numbers and
  section titles, sans for content, mono for micro-labels and data.
- Chrome recedes: the chat sheet, log-style detail, and MiniPlayer collapse away
  when not in use.

## 9. Help users recognise, diagnose, and recover from errors

> Use traditional error visuals (bold, red text). Say what went wrong in the user's language — no jargon. Offer a solution, e.g. a one-click fix.

**In this app:**
- Errors use the expected visual language — red, bold, high contrast — and are
  placed **next to the thing that failed**, not in a corner toast the user misses.
- **State the cause and the next action.** "Couldn't reach the weather service —
  check your connection, or pick a different city." Never an error code, a stack
  trace, an HTTP status, or a Supabase/Postgres message.
- **Degrade, don't collapse.** A failed widget shows an inline retry and leaves the
  rest of the dashboard usable; a failed AI call falls back (Gemini → Groq) before
  it ever surfaces as an error. Upstream calls carry timeouts so a hang becomes a
  handled failure.
- **Guest limits are explained, not thrown**: an action unavailable in the demo
  shows a "sign up to use this" state, which is a next step rather than a wall.
- Recovery instructions are actionable by the user in the UI they're already in.

## 10. Help and documentation

> Make help easy to search. Present documentation in context at the moment it's needed. List concrete steps to carry out.

**In this app:**
- **Primary help is in context and at the moment of need**: placeholder text that
  teaches by example ("e.g. Lunch at mamak"), inline hints under new controls
  ("Auto-logs RM16.90 on day 1 every month"), `Kbd` hints beside actions.
- **Empty states are the tutorial.** Every empty panel says what the thing is *and*
  what to do next ("No drafts yet. Hit '+ New Draft' and let it flow."), never a
  bare "No data."
- **Tyunnie chat is the searchable help layer** — a user can ask in their own words
  instead of hunting through docs.
- **Change is explained**: `/about` tells the project's story and renders the
  changelog; `UpdateAnnouncement` surfaces the `### Highlights` of a new version
  once, in plain English, with no jargon and no Added/Fixed/Security noise.
- Longer guidance lives in `docs/` and the README with concrete, numbered steps.
  The user should rarely need to leave the app to learn the next action.

---

## 11. Accessibility

> Usable by people with disabilities is usable by everyone. Accessibility is a floor, not a feature.

**In this app:**
- **Keyboard reachability is required.** Every interactive element must be operable
  without a pointer, in a sensible tab order. If a `div` has `onClick`, it needs a
  keyboard path — prefer a real `<button>`.
- **Never remove a focus indicator without replacing it.** `outline-none` alone is a
  defect; pair it with a visible `focus-visible` treatment.
- **Name every icon-only control** with `aria-label` (dock items, `✕` deletes,
  player transport). An icon is not a name.
- **Overlays announce themselves** — `role="dialog"` + `aria-modal`, labelled by
  their heading, with focus moved in on open and returned to the trigger on close.
- **Colour is never the only signal.** Income/expense, active filters, and paused
  rules carry a label, icon, or shape in addition to colour.
- **Respect contrast.** Muted metadata (`#9a8f7e`, `#c5bdb0`) is decorative-adjacent
  and must not carry information at small sizes without meeting contrast on its
  actual background — in dark mode too.
- **Touch targets ≥ 44 px** on mobile. Hover-revealed controls need a persistent or
  long-press equivalent on touch, where hover does not exist.

**Implementation notes:**
- The global `:focus-visible` ring lives in `app/globals.css` and applies to every
  interactive element in the user's accent colour. Because it is `:focus-visible`
  (not `:focus`), mouse clicks stay clean — never re-add a per-component ring.
- **Hover-revealed controls must also reveal on focus.** Any
  `opacity-0 group-hover:opacity-100` needs `focus-visible:opacity-100` beside it,
  or the control is invisible to a keyboard user standing on it.
- Modal focus management is `lib/useFocusTrap.ts` — it traps Tab, focuses the
  dialog on open, and returns focus to the trigger on close. Import it for every
  new overlay; never hand-roll focus logic.
- Glyph-only buttons carry `aria-label` on the button and `aria-hidden="true"` on
  the glyph, so the label is spoken instead of "times" / "multiplication sign".

## 12. Responsive & mobile

> The phone is the first impression, not the fallback.

**In this app:**
- **Design for the narrow case deliberately.** Mobile is not desktop scaled down:
  the chat sheet is fullscreen-only on mobile (`snapPct [0]`, handle hidden), the
  dock becomes a full-width bar, MiniPlayer becomes a compact pill without skip,
  and float mode is disabled entirely.
- **The page body must never scroll horizontally.** Wide content — tables, charts,
  game boards — scrolls inside its own container.
- **Layout adapts, content doesn't get amputated.** Stats strips reflow (`grid-cols-2
  sm:grid-cols-4`), Tetris panels stack under the board, Solitaire card height tracks
  measured width via `ResizeObserver`.
- **Test both widths and both themes before shipping** — this is on the PR checklist
  in [CONTRIBUTING.md](../CONTRIBUTING.md), and it is not optional for UI changes.

## 13. Theming & motion

> The interface belongs to the user's environment, not ours.

**In this app:**
- **Dark mode is a first-class variant, not an inversion.** Every new surface,
  border, and text colour needs its `dark:` pair. Ship a panel only after looking at
  it in both themes.
- **No flash of the wrong theme** — theme and accent are applied to `<html>` by the
  pre-paint script in `layout.tsx`, before first paint. Never move that work into a
  mount effect.
- **Accent is user-owned.** Read it from the CSS vars; for canvas/SVG contexts that
  can't take a CSS var (e.g. Recharts), resolve the computed value and re-resolve on
  the `tyunnie-accent-changed` event.
- **Motion is subtle, short, and interruptible.** Transitions serve feedback
  (hover lift, sheet slide), never spectacle. Animation must not block input.
- **Respect `prefers-reduced-motion`.** Users who ask for less movement must get it —
  disable transforms and non-essential transitions rather than merely shortening them.

**Implementation note:** the global `prefers-reduced-motion: reduce` block in
`app/globals.css` collapses all animation and transition durations to ~0. State
changes still happen and transition events still fire — nothing moves. Don't
re-enable motion with `!important` inside a component; if an animation is load-
bearing, it needs a non-motion equivalent instead.

---

## How to use this document

1. Before designing or changing any UI element, find the heuristic(s) it touches
   above and satisfy the "In this app" rules.
2. If a new pattern isn't covered here, add it — this file is the living contract.
3. When a heuristic conflicts with density or power, favour the heuristic: the
   primary user is a first-time visitor on a phone who must succeed without reading
   anything.
4. **Known gaps are commitments, not excuses.** If you touch code near one, fix it.

---

## Known gaps

Tracked, deliberately deferred. Per rule 4 above these are commitments — if you
are working near one, close it.

| Gap | Section | Why deferred |
| --- | --- | --- |
| Chess promotion has no `Esc` | §3 | **Intentional, not a gap.** A promotion must resolve — there is no valid "cancel" state. Documented in the component. |
| Dark mode works by overriding light *utility classes* (`globals.css`), not by redefining root vars | §13 | Works, but means **any inline `style={{ backgroundColor: … }}` silently bypasses dark mode**. Tetris hit this. Prefer classes over inline colour. A token-based rewrite is a larger change than any single fix warrants. |
| Per-category / per-account colours in Finance are literal hexes | §4, §8 | These are *categorical* colours (Food, Maybank), not accent — semantically correct as literals. Revisit only if a palette system is introduced. |
| Todo completion confetti uses a fixed orange palette | §4 | Cosmetic, one-shot, non-interactive. Low value; would be nice to derive from the accent. |
| Sound effects and haptics | §1, §7 | Considered for v3.23.0 and **rejected**: `navigator.vibrate` is entirely unsupported on iOS Safari, so haptics would split the mobile experience in half. Sound needs an opt-out toggle and a gesture unlock before it can ship. |
| Glassmorphic / spatial UI treatment | §8 | Evaluated and rejected — the app's language is warm paper, not glass. Depth should be expressed as **warm light** (cursor-tracked glow, card elevation), not blur and noise. Recorded so the question isn't reopened without this context. |
