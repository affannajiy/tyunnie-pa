---
name: tyun-git
description: >
  Commit, push, pull, sync, or inspect the Tyunnie PA git repository. Use when the
  user says "commit", "push", "pull", "sync", "stage", "deploy prep", "what's
  uncommitted", "what changed", or "branch status". Derives a commit title under
  10 words from docs/CHANGELOG.md and handles staging, committing, and remote
  operations safely.
---

Git for Tyunnie PA. Titles short enough to scan in `git log --oneline`, meaningful
enough to read a month later.

## Standing rule

**Never stage, commit, or push unless asked in this session.** The user commits their
own work; finishing a task is not permission to commit it. Read-only git (`status`,
`diff`, `log`, `branch`) is always fine.

---

## Commit title — non-negotiable

**Ten words or fewer**, derived from the top block of `docs/CHANGELOG.md`.

Read the top version block → read its `Added`/`Changed`/`Fixed` bullets → compress to
`{version} - {2–5 word essence}` → count words, cut to the most impactful change.

| CHANGELOG top entry | Title |
|---|---|
| 3.19.0 — Hub reorganisation + Speed Test + HMR fix | `3.19.0 - Hubs Redesign, Speed Test & HMR Fix` |
| 3.17.1 — Speed optimisation | `3.17.1 - Speed Optimization` |
| 3.14.0 — Scientific Calculator | `3.14.0 - Calculator` |

Title case. No trailing punctuation. No emoji — they corrupt some git clients.

If the work isn't in the CHANGELOG yet, that's the actual problem: run
`tyun-documentation` first rather than inventing a title.

---

## Procedure

1. **Assess** — `git status`, `git diff --stat HEAD`. Report staged, unstaged, untracked. Never proceed blind.
2. **Derive the title** from the CHANGELOG. Show it and confirm before committing.
3. **Stage specifically** — `git add -u` for tracked changes and deletions, then name new
   files explicitly. Never `git add .` / `-A`. Flag anything that shouldn't ship
   (`.env*`, keys, large binaries, `node_modules`, `.next/`) instead of staging it.
4. **Commit** with a heredoc (Bash tool, not PowerShell):

```bash
git commit -m "$(cat <<'EOF'
{Derived title, 10 words or fewer}

{Co-Authored-By trailer exactly as the harness specifies this session}
EOF
)"
```

Don't hardcode a model name — the harness supplies the current trailer, and a stale one
baked in here is how it goes wrong.

5. **Push** — `git push origin main`, after confirming remote and branch.
6. **Verify** — `git log --oneline -5`, `git status`, tree clean.

---

## Pull / sync

```bash
git fetch origin
git status                            # check divergence first
git pull origin main
```

With uncommitted changes: `git stash` → pull → `git stash pop`, and walk the user
through any conflict rather than resolving it for them.

```bash
git log HEAD..origin/main --oneline   # on remote, not local
git log origin/main..HEAD --oneline   # local, not pushed
```

---

## Absolute safety rules

- Never `push --force` on `main` unless asked, and only after saying: "This rewrites remote history and cannot be undone."
- Never `reset --hard` without first showing exactly what gets discarded.
- Never `git add .` — inspect untracked files first.
- Never commit `.env`, `.env.local`, `*.key`, `*.pem`, or anything holding secrets.
- Never `--no-verify` unless asked; a failing hook is a real signal.
- Never amend a pushed commit — make a new one.
- Never `git clean -f` without explicit instruction.
- Always confirm the derived title before committing; always `git status` after anything destructive.

---

## Branches

```bash
git branch --show-current
git checkout -b feature/{short-name}
git push -u origin feature/{short-name}
```

Merge back with `--no-ff`. Never push to a branch the user didn't name. Interactive
flags (`rebase -i`, `add -i`) don't work in this environment.

---

## Out of scope

Don't modify source, don't decide what goes in a release (`docs/CHANGELOG.md` is the
source of truth), don't write titles like "update" or "fix".
