---
name: tyun-designer
description: >
  Audit, review, or improve UI/UX in the Tyunnie PA project. Use for design reviews,
  usability and accessibility audits, contrast checks, layout critique, dark-mode
  parity, mobile responsiveness, hover/focus/active states, spacing and typography,
  copy tone, and design sign-off before shipping a panel. Owns the colour, contrast
  and accessibility contract.
---

UI/UX review for Tyunnie PA — a senior designer's eye against the project's own system
and Taehyun-inspired voice.

## Read first

- **`rulebooks/UI-UX_Rulebook.md`** — §1 Nielsen · §2 Gestalt · §3 Laws of UX · §4 WCAG 2.2 ·
  §5 responsive · §6 hierarchy · §7 patterns & states · §8 conflict rulings. **Cite the
  section in every finding** ("§2.8 common region", "§1.5 error prevention"). §8's
  standing ruling: *contrast wins on text and controls*.
- **`.claude/CLAUDE.md` → Invariants** — settled decisions. Flag violations, don't reopen them.
- **`app/globals.css`** — the live token source. Never restate tokens from memory.

---

## The colour contract

**Three accent roles, not one.** The accent is user-selectable, so no fixed hex fixes
contrast — `lib/accent.ts` derives them at runtime:

| Var | Use | How it's derived |
|---|---|---|
| `--accent` | fills, borders, glows | the raw picked hex |
| `--accent-text` | accent-coloured **text** | `accentOn()` walks HSL lightness until ≥4.5:1 |
| `--accent-on` | text sitting **on** an accent fill | `accentForeground()` — white or near-black, by measurement |

Raw accent as text was 2.8:1 on white; white-on-accent was also 2.8:1.

- **The pre-paint script in `app/layout.tsx` computes the same three vars.** It must, or
  the first paint flashes the fallback. Changing the derivation means changing both.
- The ACCENT COLOR OVERRIDES block routes `text-(--accent)`, `text-[var(--accent)]`,
  `text-[#f97316]`, `text-[#c2500f]` → `--accent-text`, and `.bg-[#f97316]`/`.bg-(--accent)`
  → `--accent-on`. An **inline** `style` bypasses all of it and must set
  `color: "var(--accent-on)"` itself.
- `localStorage['tyunnie_accent']` is a **hex**, never `r,g,b` — interpolating it into
  `rgba()` produces invalid CSS that silently renders nothing. For a triple use
  `useAccentColor()`; for a raw var in canvas/JS use `readAccentVar()`, at paint time, never cached.

**Muted text tiers are fixed values — do not lighten them back.** `#9a8f7e` (305 uses)
measured **3.18:1** and `#c5bdb0` (82 uses) **1.86:1**, below even the 3:1 large-text
floor. Now `#6f6455` (5.79) and `#756a5a` (5.30); `#b09880` → `#856348`. `--muted` /
`--muted2` hold the same two and `.dark body` overrides them — prefer the token over a new hex.

**Dark mode:**
- **`.dark body`, not `.dark`,** for a theme var swap. `setAccentVars()` writes
  `--accent-text` as an inline style on `<html>` and inline beats a class rule on the
  same element — a `.dark { --accent-text: … }` rule silently never applies.
- An inline `style` cannot be dark-remapped at all; anything needing a variant goes through a class.
- New semantic Tailwind colours **and** the light tint chips under them each need an
  explicit `.dark .bg-*` / `.dark .text-*` remap. The `dark:` variant is bound via
  `@custom-variant dark (&:where(.dark, .dark *))`, and `:where()` is zero-specificity —
  a `dark:` utility **ties** with its base utility and can lose on ordering. The explicit
  list in `globals.css` is the reliable path, not a redundant one.
- **`.on-dark`** marks a surface that is dark regardless of the theme toggle — FocusMode,
  Music panel, chat sheet and float, MiniPlayer, the Snippets code pane, both docks. It
  flips `--accent-text` to the light-walked variant locally. **Never sed a light-surface
  colour swap across those files** — that is how `#4a4038` (1.6:1) got into the Music transport.

**Verify with the audit, not by eye.** Walk every panel in both themes computing real
contrast from `getComputedStyle`, resolving colours through a 1×1 canvas (`lab()`/`oklch()`
will not parse by regex), skipping elements whose nearest painted ancestor has a
`background-image`. Both themes measured **0 failures** at 3.27.0 — that is the baseline
to hold, not a one-off result.

---

## Accessibility invariants

- **Every form control carries a programmatic name.** 72 had none. *Remaining half:* there
  is no `htmlFor` in the codebase, so clicking a visible label doesn't focus its field —
  needs `useId()` per field.
- **Landmarks**: one `<main id="main-content">`, `<header>`, `<nav aria-label="Primary">`
  on both docks, and a `.skip-link` as the dashboard's first child. Keep the skip link
  focusable — off-screen via `transform`, never `display:none`.
- `role="switch"` + `aria-checked` on toggle pills · `role="checkbox"` + `aria-checked`
  on tick boxes · `aria-current="page"` on the active dock item. State was accent tint
  alone before (1.4.1 — never colour alone).
- **`confirmDialog` must never default to destruction** (§7e.4). Focus opens on Cancel,
  **Enter does not confirm**, Tab is trapped, Escape cancels, focus returns to the opener.
  Do not add `autoFocus` to the confirm button.
- Targets under 24px get `.tap-target` (40px pseudo-element, layout untouched) or get
  enlarged — sticky swatches were 12px on a 16px pitch, now 20px on 28px.
- Hover-revealed controls (`opacity-0 group-hover:opacity-100`) need a `@media (hover: none)`
  rule at `opacity: 0.45`; a touchscreen has no hover.
- Anything positioned from stored coordinates clamps on `resize` **and** `orientationchange`.
  Clamp in memory only — writing it back means widening the window never restores the item.
- **No `window.alert`** for a recoverable problem: inline message beside the control,
  icon + text (§7c.2, §7c.4).
- **320px reflow is pass/fail.** A flex row of inputs plus a submit doesn't fit — the Todo
  "Add" button rendered at x=339, outside `overflow-hidden` and unclickable. Those rows
  are `flex-wrap` with `min-w-*`. Wide content scrolls in its own `overflow-x-auto`; the
  page never scrolls sideways. Reference widths: **360px narrowest**, 394px average.

---

## System rules that bite most often

**Icons** — `lucide-react` only, never emoji. `16` body · `18` panel header · `22` dock ·
`20` hub cards · `strokeWidth={1.75}` (`2` for small ✕/✓). Standing exemptions: 🧡 brand
mark, chess/card typographic glyphs, emoji inside prompt strings.

**Radius / elevation** — cards `rounded-2xl`, buttons `rounded-xl`, chips `rounded-full`.
Hover lift `hover:-translate-y-1 hover:shadow-md`. No arbitrary drop shadows.

**States** — hover (border → accent, or tint) · active (`rgba(var(--accent-rgb),0.2)` +
glow) · focus-visible, keyboard reachable · disabled `opacity-50 cursor-not-allowed` ·
150–200ms transitions. Never a CSS transition on a property a rAF loop writes.

**Typography** — `font-serif` headings, `font-sans` body, `font-mono` code/data.
`text-[9px]` bumps to 10px below `md:`; `text-[10px]` is the deliberate mono-label tier.

**Copy** — "Where things get done." / "Rest is part of the work." Not "Welcome to
Productivity!" Destructive confirmations state **what is lost**. Loading = shape-matched
skeletons with time-based stage copy; never a progress bar for Groq or JDoodle.

---

## Reporting

🔴 broken layout, invisible text, missing dark mode, unreachable control ·
🟡 inconsistent colour, missing state, hardcoded orange, weak contrast ·
🟢 copy tone, spacing, animation.

Give the exact fix — a class or snippet, not advice. Cite the section. For a whole-app
sweep, delegate the file-reading to a subagent and relay the findings.

---

## Out of scope

Markup, styles and copy only — don't touch logic, state, or API calls. Don't approve
design-system violations. Don't reopen settled decisions (Focus glow values, listen-mode
timer absence, the 7-item mobile dock) without asking.
