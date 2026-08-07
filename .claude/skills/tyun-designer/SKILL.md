---
name: tyun-designer
description: >
  Audit, review, or improve UI/UX in the Tyunnie PA project. Use for design reviews,
  usability checks, accessibility audits, layout critique, visual consistency, dark
  mode parity, mobile responsiveness, hover/focus/active states, spacing and
  typography issues, and user-flow analysis. Also for a design sign-off before
  shipping a new panel or component.
---

UI/UX review for Tyunnie PA — senior product designer's eye, applied against the
project's own design system and Taehyun-inspired voice.

## Read these first

- **`docs/UI-UX_Rulebook.md`** — the principles: §1 Nielsen, §2 Gestalt, §3 Laws of UX,
  §4 conflict rulings. Cite the specific section in every finding (e.g. "§2.8 common
  region", "§1.5 error prevention"). This is the standard; the rest of this skill is
  how it applies here.
- **`.claude/CLAUDE.md`** — the enforceable project invariants: icon size/stroke
  contract, accent-variable rules, dark-mode class requirement, tap-target rules,
  Focus Mode's rejected retunes. Those are settled decisions — flag violations, don't
  reopen them.

Don't restate design tokens from memory. `app/globals.css` is the live source for
colours and `.dark` remaps.

---

## What to check

1. **Visual consistency** — matches the established language
2. **Usability** — interaction model clear and predictable
3. **Accessibility** — keyboard nav, contrast, focus-visible rings, ARIA where needed
4. **Responsiveness** — mobile (`<768px`) and desktop parity, nothing overflows
5. **Dark mode parity** — every light colour needs a dark counterpart
6. **Micro-interactions** — hover, focus, active, disabled on every interactive element
7. **Spacing & rhythm** — consistent Tailwind scale use
8. **Typography** — `font-serif` headings, `font-sans` body, `font-mono` code/data
9. **Personality** — copy calm, dry, occasionally poetic; never loud or generic

---

## System rules that bite most often

**Accent** — never hardcode `#f97316`. Use `var(--accent)` or
`rgba(var(--accent-rgb), …)`. `localStorage['tyunnie_accent']` holds a **hex**, never
an `r,g,b` triple — interpolating it into `rgba()` produces invalid CSS that silently
renders nothing. Any rAF/canvas loop using the accent must take it as a dependency or
re-read per frame; Auto-Theme changes it every track.

**Icons** — `lucide-react` only, no emoji as UI icons ever (they ignore `color` and the
accent). Sizes: `16` inline · `18` panel header · `22` dock · `20` hub cards ·
`strokeWidth={1.75}` (`2` for small ✕/✓). Three standing exemptions: 🧡 brand mark,
chess/card typographic glyphs, and emoji inside AI prompt strings (never rendered).

**Dark mode** — an inline `style` cannot be dark-remapped; `.dark .bg-white` is a class
selector and inline wins. Anything needing a dark variant goes through a class. New
semantic Tailwind colours need an explicit `.dark` remap; nothing enforces this.

**Touch** — hover-revealed controls (`opacity-0 group-hover:opacity-100`) need a
`@media (hover: none)` rule making them visible at `opacity: 0.45`; a touchscreen has
no hover. Small controls use `.tap-target` for a 40px hit area without changing layout.

**Radius / elevation** — cards `rounded-2xl`, buttons `rounded-xl`, chips
`rounded-full`. Hover lift `hover:-translate-y-1 hover:shadow-md`. No arbitrary drop
shadows — accent glow or Tailwind `shadow-md/lg`.

**Interactive states** — hover (border → accent, or tint), active
(`rgba(var(--accent-rgb),0.2)` + glow), focus-visible (must be keyboard reachable),
disabled (`opacity-50 cursor-not-allowed`), transition 150–200ms.

**Copy** — "Where things get done." / "Rest is part of the work." Not "Welcome to
Productivity!" Destructive confirmations state **what is lost**, never "are you sure".
Loading states are shape-matched skeletons with time-based stage copy — never a
progress bar for Groq or JDoodle, since the duration is unknown.

---

## Reporting

- 🔴 **Critical** — broken layout, invisible text, missing dark mode, non-functional control
- 🟡 **Warning** — inconsistent colour, missing hover state, hardcoded orange, weak contrast
- 🟢 **Suggestion** — copy tone, spacing, animation, accessibility improvement

Give the exact fix — a class change or snippet, not vague advice. Cite the Rulebook
section. Re-read with mobile breakpoints in mind (`md:` usage, touch targets ≥44px).

For a whole-app sweep rather than one component, spawn a subagent for the file-reading
phase and have it report findings — a full pass reads far more than it returns.

---

## Out of scope

Audit and advise; don't implement features. Don't touch logic, state, or API calls —
markup, styles, and copy only. Don't approve design-system violations. Don't reopen
decisions CLAUDE.md marks as settled (Focus Mode glow values, listen-mode timer
absence) without asking.
