---
name: Keyboard Shortcuts + Command Palette Architecture
description: How the global shortcut system and command palette are wired together; custom event pattern for cross-component quick-add
type: project
---

The keyboard shortcut system and command palette were overhauled as a single unit.

**Components added:**
- `components/CommandPalette.tsx` — full VS Code-style palette, owns its own query state, receives todos/drafts/projects/snips as props from dashboard, dispatches `window.CustomEvent` for quick-add actions
- `components/ShortcutHelp.tsx` — static shortcut reference grid, grouped by category, shows Mac or Windows keys based on `navigator.platform`

**Keyboard handler lives in a single `useEffect` in `dashboard/page.tsx`:**
- Has `activePanel` in its dep array (needed for the `N` key panel-specific shortcut)
- All `Ctrl/⌘` combos use `e.metaKey || e.ctrlKey`
- `Escape` runs before the `isTyping` guard (so it always works)
- `Ctrl/⌘ + K` also runs before the `isTyping` guard

**Numbered panel mapping (Ctrl/⌘ + 1–9):**
1=desk, 2=todo, 3=writing, 4=projects, 5=snippets, 6=finance, 7=music, 8=games, 9=profile
(Previously was desk/productivity/entertainment/profile — was changed)

**Quick-add custom events pattern:**
- Dashboard fires `window.dispatchEvent(new CustomEvent("tyunnie-new-task"))` etc.
- Each panel component listens in its own `useEffect` and focuses/opens its form
- 80ms `setTimeout` delay used when navigating + dispatching to ensure the panel has mounted
- Event names: `tyunnie-new-task`, `tyunnie-new-draft`, `tyunnie-new-project`, `tyunnie-new-snippet`

**Music toggle bridge:**
- `Ctrl/⌘ + M` dispatches `tyunnie-music-toggle` on `window`
- `MusicKeyboardBridge` component (defined in dashboard/page.tsx, rendered inside `<MusicProvider>`) listens and calls `useMusicContext().togglePlay()`
- Required because `Home` component renders `<MusicProvider>` in its JSX, so it cannot call `useMusicContext()` directly

**Why:** The keyboard handler is outside `MusicProvider`'s tree, so a bridge component that lives inside the provider was the cleanest solution without restructuring the component tree.

**How to apply:** If new cross-provider keyboard shortcuts are needed that touch other contexts, use the same bridge pattern — a small null-rendering component inside the provider that listens for a window event.
