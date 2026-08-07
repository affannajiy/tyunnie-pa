---
name: tyun-git
description: >
  Commit, push, pull, sync, or inspect the Tyunnie PA git repository. Use when the
  user says "commit", "push", "pull", "sync", "stage", "deploy prep", "what's
  uncommitted", "what changed", or "branch status". Derives a commit title under
  10 words from docs/CHANGELOG.md and handles staging, committing, and remote
  operations safely.
---

Git operations for Tyunnie PA. Commit messages short enough to scan in
`git log --oneline`, meaningful enough to read a month later.

## Standing rule: the user commits their own work

**Never stage, commit, or push unless asked in this session.** The default in this
project is that the user does it themselves — finishing a task is not permission to
commit it. This skill runs when they ask, not when you think the work looks done.

Read-only git (`status`, `diff`, `log`, `branch`) is always fine.

---

## Commit title rule (non-negotiable)

**Ten words or fewer**, derived from the top entry of `docs/CHANGELOG.md`.

1. Read `docs/CHANGELOG.md`
2. Find the top-most version block — e.g. `## [3.24.0] — 2026-08-07`
3. Read its `### Added` / `### Changed` / `### Fixed` bullets
4. Compress to `{version} - {2–5 word essence}`
5. Count words; over 10, cut to the most impactful change

| CHANGELOG top entry | Derived title |
|---|---|
| 3.19.0 — Hub reorganisation + Speed Test + HMR fix | `3.19.0 - Hubs Redesign, Speed Test & HMR Fix` |
| 3.17.1 — Speed optimisation | `3.17.1 - Speed Optimization` |
| 3.14.0 — Scientific Calculator | `3.14.0 - Calculator` |

Title case. No trailing punctuation. No emoji — they corrupt some git clients.

If the work being committed isn't in the CHANGELOG yet, that's the actual problem:
run `tyun-documentation` first rather than inventing a title.

---

## Commit procedure

**1. Assess.** `git status` and `git diff --stat HEAD`. Report staged, unstaged, and
untracked. Never proceed blind.

**2. Derive the title** from `docs/CHANGELOG.md`. Show it and confirm before committing.

**3. Stage specifically.** Never `git add .` or `git add -A`. Use `git add -u` for
tracked modifications and deletions, then name new files explicitly. Flag anything
that looks like it shouldn't ship (`.env*`, keys, large binaries, `node_modules`
leaks) instead of staging it.

**4. Commit.** Heredoc so the body formats correctly (Bash tool, not PowerShell):

```bash
git commit -m "$(cat <<'EOF'
{Derived title, 10 words or fewer}

{Co-Authored-By trailer exactly as the harness specifies this session}
EOF
)"
```

Do not hardcode a model name here — the harness supplies the current trailer, and a
stale one baked into this file is how it goes wrong.

**5. Push.** `git push origin main`. Confirm remote and branch first.

**6. Verify.** `git log --oneline -5` and `git status`; confirm the tree is clean.

---

## Pull / sync

```bash
git fetch origin
git status                            # check divergence first
git pull origin main
```

With local uncommitted changes, `git stash` → pull → `git stash pop`, and walk the
user through any conflict rather than resolving it for them.

Sync status without changing anything:

```bash
git log HEAD..origin/main --oneline   # on remote, not local
git log origin/main..HEAD --oneline   # local, not pushed
```

---

## Safety rules — absolute

- **Never `git push --force`** on `main` unless explicitly asked, and only after
  stating: "This rewrites remote history and cannot be undone."
- **Never `git reset --hard`** without first showing exactly what gets discarded
- **Never `git add .`** — inspect untracked files before staging
- **Never commit** `.env`, `.env.local`, `*.key`, `*.pem`, or anything holding secrets
- **Never `--no-verify`** unless asked; a failing hook is a real signal
- **Never amend a pushed commit** — make a new one
- **Never `git clean -f`** without explicit instruction
- **Always confirm the derived title** before running `git commit`
- **Always `git status` after** anything destructive

If `.env*`, `*.log`, `node_modules/`, or `.next/` show up as untracked, warn — they
belong in `.gitignore`.

---

## Branches

```bash
git branch --show-current
git checkout -b feature/{short-name}
git push -u origin feature/{short-name}
```

Merge back with `--no-ff` to preserve branch history. Never push to a branch other
than `main` unless the user names the target.

Interactive flags (`rebase -i`, `add -i`) don't work in this environment.

---

## Out of scope

Don't modify source code, don't decide what goes in a release (`docs/CHANGELOG.md` is
the source of truth), and don't write vague titles like "update" or "fix".
