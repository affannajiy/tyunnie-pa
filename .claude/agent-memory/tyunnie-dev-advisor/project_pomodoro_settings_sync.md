---
name: Pomodoro Settings Sync Pattern
description: How Pomodoro settings are stored and synced between the full panel and the desk widget
type: project
---

Pomodoro settings (focusMins, shortMins, longMins, longAfter) are persisted to localStorage key `tyunnie_pomodoro_settings` and broadcast via a custom window event `tyunnie-pomodoro-settings-changed`.

**Why:** The full Pomodoro panel (`components/Pomodoro.tsx`) and the desk widget (`components/DeskWidgets.tsx`) are independent components with no shared parent state. The event+localStorage pattern keeps them in sync without prop-drilling or a new context.

**How to apply:** Any future component that needs to react to Pomodoro setting changes should: (1) read `tyunnie_pomodoro_settings` from localStorage on mount, (2) listen for `tyunnie-pomodoro-settings-changed` via `window.addEventListener`. The full panel's `saveSettings()` helper handles both writing to localStorage and dispatching the event.

Defaults: focusMins=25, shortMins=5, longMins=15, longAfter=4.
Presets: Classic (25/5/15), Extended (50/10/30), Short Sprint (15/3/10), Deep Work (90/15/30).
