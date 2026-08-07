// lib/activePanel.ts
//
// A one-value broadcast of "which dashboard panel is open", readable from
// outside the dashboard tree.
//
// The MiniPlayer used to take `activePanel` as a prop, which worked only
// because the dashboard rendered it. Now that it lives in the root layout (so
// audio survives a route change to /about), it has no parent that knows about
// panels — but it still needs to hide itself when the full Music panel is on
// screen, otherwise you get two players.
//
// Deliberately a module variable + window event rather than a context: a
// context would have to wrap the root layout and re-render every route on a
// panel change, to serve exactly one consumer. Same idiom as the existing
// `tyunnie-music-toggle` / `tyunnie-filter-panel` bridges.

const EVENT = "tyunnie-active-panel";

let current = "";

/** Called by the dashboard whenever the visible panel changes. */
export function publishActivePanel(panel: string) {
  if (panel === current) return;
  current = panel;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: panel }));
}

/** Last published panel. Empty string when no dashboard is mounted. */
export function readActivePanel() {
  return current;
}

/** The dashboard unmounts on a route change — nothing is open any more. */
export function clearActivePanel() {
  publishActivePanel("");
}

export function subscribeActivePanel(fn: (panel: string) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
