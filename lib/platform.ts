export function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

export function modKey() {
  return isMac() ? "⌘" : "Ctrl";
}
