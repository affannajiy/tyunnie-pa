---
name: tyun-documentation
description: >
  Update, audit, or maintain Tyunnie PA project documentation. Use when bumping a
  version, writing a docs/CHANGELOG.md entry, syncing the README badge, updating
  .claude/CLAUDE.md after code changes, adding a docs/DEVNOTES.md gotcha, or
  editing docs/DATABASE.md / docs/DEPLOYMENT.md. Also for "update the docs",
  "document this", or "what version are we on". Run after shipping a feature or fix.
---

Docs for Tyunnie PA. Read a file's current state before touching it — never guess.

**Use the session, not just the diff.** A diff shows a throttle was added; only the
session knows it was accepted as partial and why. Write the why down.

## Files

| File | Purpose |
|---|---|
| `docs/CHANGELOG.md` | Version history, Keep a Changelog format — source of truth for releases |
| `README.md` | Public overview: features, stack, setup, version badge |
| `.claude/CLAUDE.md` | Claude's invariant list — one line per rule, depth lives in the skills |
| `docs/DEVNOTES.md` | Gotcha log: HMR quirks, build traps, browser bugs |
| `docs/DATABASE.md` | Supabase schema, RLS, indexes, SQL |
| `docs/DEPLOYMENT.md` | Env vars, Vercel, Google OAuth, Supabase auth config |
| `SECURITY.md` | Security posture, audit log, accepted risks (repo root) |
| `rulebooks/` | Portable principle refs — **no project specifics, ever**; `README.md` routes a change to the right one |

---

## Versioning

Patch `x.x.X` fixes/types/build/docs · Minor `x.X.0` features/UI/API routes · Major
`X.0.0` architectural. **Never bump Major without explicit instruction.**

**Three sync locations, always together:**
1. `package.json` → `"version"`
2. `README.md` → badge `version-x.x.x-f97316`
3. `.claude/CLAUDE.md` → header line

`lib/version.ts` re-exports `pkg.version` — it follows automatically, never edit by hand.

Catch stragglers: `grep -rn "3\.26\.3" --include="*.md" --include="*.json" . | grep -v node_modules`.
Hits inside `docs/CHANGELOG.md` history are past releases and correct.

---

## CHANGELOG format

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Highlights
**New**
- **Headline** — plain-English description

### Added
### Changed
### Fixed
```

- New block at the **top**, ISO dates, omit empty sections, no trailing periods.
- `Fixed` bullets say what the **symptom** was, not "fixed X".
- Check the existing top entry — never duplicate a version block.
- **`### Highlights` is user-facing and load-bearing.** `/about` and `parseChangelog()`
  render *only* this section. Labels are `**New**` / `**Improved**` / `**Fixed**`, each
  with `**Headline** — description` bullets. Plain English, no jargon. No Highlights
  block = hidden from `/about`, which is a valid choice for an internal release.

---

## Per-file rules

**CLAUDE.md** — written for Claude. It is an **invariant list, not a manual**: one line
per rule, deep explanation pushed into the owning skill. Update when a file is added or
renamed, a component's responsibility shifts, a non-obvious rule is discovered, or the
version changes. Prefer a rule that prevents a repeat bug over describing what the code
already says plainly. If an entry grows past a few lines, that content belongs in a skill.

**README** — high-level only. Never duplicate the CHANGELOG or document internals
(crypto, rate-limiter mechanics). Feature descriptions 1–3 sentences.

**DEVNOTES** — add when a bug took over 15 minutes because the cause was non-obvious, a
fix worked around a framework limitation, or a config choice had hidden side effects.

```markdown
## 🔴 Short title

**Symptom:** what the developer sees.
**Root cause:** file, line, API, config — be specific.
**Fix:** what resolved it.
**Date:** YYYY-MM-DD
```

🔴 critical · 🟡 medium · 🟢 minor. **Never delete an entry** — it is a historical record.

**DATABASE.md** — update on a new table, column, RLS policy, index, or bucket constraint.

**DEPLOYMENT.md** — update on env var or auth config changes. Per var: name, where to get
it, server-only vs `NEXT_PUBLIC_`, required vs optional.

**SECURITY.md** — audit log entries and accepted risks. An accepted risk records the
exposure, *why it's acceptable now*, and the trigger that would change that.

---

## Procedure

1. Assess — `git diff HEAD --stat`, `git status`, plus what the session knows that the diff can't show.
2. Version bump.
3. CHANGELOG block at top, with `### Highlights` if any of it is user-facing.
4. Sync all three version locations.
5. Update whichever of README / CLAUDE.md / DEVNOTES / SECURITY.md the change touched.
6. Verify with the grep above.

---

## Out of scope

Don't modify source (`.tsx`, `.ts`, `.css`), don't invent CHANGELOG entries from
imagination (read the diff or ask), don't bump Major unprompted, don't skip the version
sync, don't put project specifics in `rulebooks/`.
