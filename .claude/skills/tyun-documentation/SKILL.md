---
name: tyun-documentation
description: >
  Update, audit, or maintain Tyunnie PA project documentation. Use when bumping a
  version, writing a docs/CHANGELOG.md entry, syncing the README badge, updating
  .claude/CLAUDE.md after code changes, adding a docs/DEVNOTES.md gotcha, or
  editing docs/DATABASE.md / docs/DEPLOYMENT.md. Also for "update the docs",
  "document this", or "what version are we on". Run after shipping a feature or fix.
---

Documentation for Tyunnie PA. Read the current state of a file before touching it —
never guess at what's already there.

**Use the session, not just the diff.** The biggest advantage here over reading
`git diff` cold is that you know *why* a change was made, what was rejected, and what
was accepted as a known limitation. A diff shows a throttle was added; only the
session knows it was accepted as partial and why. Write the why down.

## Files

| File | Purpose |
|---|---|
| `docs/CHANGELOG.md` | Version history, Keep a Changelog format — source of truth for releases |
| `README.md` | Public overview — features, stack, setup, version badge |
| `.claude/CLAUDE.md` | Internal reference for Claude — structure, non-obvious rules, invariants |
| `docs/DEVNOTES.md` | Gotcha log — HMR quirks, build traps, browser bugs |
| `docs/DATABASE.md` | Supabase schema — tables, RLS, indexes, SQL |
| `docs/DEPLOYMENT.md` | Env vars, Vercel, Google OAuth, Supabase auth config |
| `SECURITY.md` | Security posture, audit log, accepted risks (repo root) |
| `docs/UI-UX_Rulebook.md`, `docs/SECURITY_Rulebook.md` | Pure principle references — portable, **no project specifics** |

The rulebooks are deliberately project-agnostic. Never add Tyunnie-specific state to
them; that belongs in `CLAUDE.md` or `SECURITY.md`.

---

## Versioning

| Change | Bump |
|---|---|
| Fixes, types, build, docs-only | Patch `x.x.X` |
| Features, UI panels, API routes | Minor `x.X.0` |
| Architectural overhaul, major removal | Major `X.0.0` |

**Three sync locations — always together:**

1. `package.json` → `"version"`
2. `README.md` → badge `![Version](https://img.shields.io/badge/version-x.x.x-f97316?style=flat-square)`
3. `.claude/CLAUDE.md` → header line `v3.x.x`

`lib/version.ts` re-exports `pkg.version` as `APP_VERSION` — it follows automatically,
never edit it by hand. Never bump Major without explicit instruction.

---

## CHANGELOG format

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Highlights
**New**
- **Headline** — plain-English description

### Added
- Technical entry

### Changed
### Fixed
```

- New block at the **top**, under the `# Changelog` heading. ISO dates.
- Omit empty sections. Plain sentences, no trailing periods.
- `Fixed` bullets say what the symptom was, not just "fixed X".
- Check the existing top entry first — never duplicate a version block.

**`### Highlights` is user-facing and load-bearing.** `/about` and
`lib/changelog.ts parseChangelog()` render *only* this section, never
Added/Fixed/Security. Format is `**New**` / `**Improved**` / `**Fixed**` label lines,
each with `**Headline** — description` bullets. Plain English, no jargon. No
Highlights block means the entry is hidden from `/about` — that's a valid choice for
an internal-only release, not a bug.

---

## Per-file rules

**README** — high-level only. Never duplicate CHANGELOG content or document internals
(crypto algorithms, rate limiter mechanics); those go in `CLAUDE.md` or `SECURITY.md`.
Feature descriptions 1–3 sentences.

**CLAUDE.md** — written for Claude, not humans. Update when a file is added, renamed,
or removed; when a component's responsibility shifts; when a non-obvious rule is
discovered; when the version changes. It should be precise enough to derive correct
code without reading every source file. Prefer adding a rule that prevents a repeat
bug over describing what the code already says plainly.

**DEVNOTES** — add when a bug took over 15 minutes because the cause was non-obvious,
a fix worked around a framework limitation, or a config choice had hidden side effects.

```markdown
## 🔴 Short title

**Symptom:** what the developer sees.
**Root cause:** be specific — file, line, API, config.
**Fix:** what resolved it.
**Date:** YYYY-MM-DD
```

🔴 critical trap · 🟡 medium gotcha · 🟢 minor quirk. Never delete an entry even after
the bug is fixed — it's a historical record.

**DATABASE.md** — update on new table, column change, RLS policy change, new index, or
new bucket constraint. Include purpose, columns with types, RLS policy, and indexes.

**DEPLOYMENT.md** — update on env var changes and auth config changes. Per var: name,
where to get it, server-only vs `NEXT_PUBLIC_`, required vs optional.

**SECURITY.md** — audit log entries and accepted risks. An accepted risk records what
the exposure is, *why it's acceptable now*, and the trigger that would change that.

---

## Procedure

1. **Assess** — `git diff HEAD --stat`, `git status`, plus what you know from the
   session that the diff can't show.
2. **Version bump** — apply the table above.
3. **CHANGELOG** — new block at top, with `### Highlights` if any of it is user-facing.
4. **Sync all three** version locations.
5. **README / CLAUDE.md / DEVNOTES / SECURITY.md** — update whichever the change touched.
6. **Verify** — grep the old version string to catch stragglers:

```bash
grep -rn "3\.23\.0" --include="*.md" --include="*.json" . | grep -v node_modules
```

Hits inside `docs/CHANGELOG.md` history are correct — those are past releases. Only
current-state references need updating.

---

## Out of scope

Don't modify source (`.tsx`, `.ts`, `.css`), don't invent CHANGELOG entries from
imagination (read the diff or ask), don't bump Major unprompted, and don't skip the
version sync — CHANGELOG, `package.json`, README badge, and CLAUDE.md header must agree.
