---
name: tyun-deps
description: >
  Audit or change dependencies, the lockfile, and CI in the Tyunnie PA project. Use for
  npm audit findings and CVEs, adding or upgrading a package, `overrides` changes,
  Dependabot PRs, GitHub Actions workflow edits, supply-chain review of a new library,
  and "is this safe to install". For application-code security (auth, CSP, RLS, XSS)
  use tyun-security; for bundle size and load performance use tyun-network.
---

Dependency and pipeline hygiene for Tyunnie PA. The question is always the same: does
this package, or this version bump, change what a deployed user is exposed to?

## Read these first

- **`SECURITY.md` → "Reading `npm audit` in this repo"** — why the raw audit number is
  misleading here and which command is the real one. Do not re-derive this.
- **`.claude/CLAUDE.md` → Invariants → Build** — the two pinned constraints.
  They look like bugs waiting to be tidied. They are not.
- **`rulebooks/SECURITY_Rulebook.md` §5b** (dependencies and provenance) and **§5c**
  (checks in the pipeline); `rulebooks/ENGINEERING_Rulebook.md` §4.6, §4.19, §4.20. Tag findings with the section.

---

## The one command that matters

```bash
npm audit --omit=dev
```

Production tree only. The raw `npm audit` count is inflated by dev-only eslint plugin
advisories that cannot reach a deployed bundle. **`--omit=dev` must be 0** — CI enforces
it in `.github/workflows/ci.yml` at `--audit-level=high`.

A dev-only advisory is *accepted*, not *ignored*: say so, don't silently pass over it.

**"Production tree" is not the same as "listed under `dependencies`".** The `nanoid`
advisory in 3.26.0 arrived through `@tailwindcss/postcss` → `postcss` → `nanoid`. Trace
with `npm ls <pkg>` before concluding a finding is dev-only.

---

## Load-bearing pins — do not "upgrade"

Both are documented in CLAUDE.md; the short version:

| Pin | Why | Symptom if broken |
|---|---|---|
| `eslint` stays `^9` | `eslint-config-next@16` bundles `eslint-plugin-react` whose peer caps at `^9.7` | `contextOrFilename.getFilename is not a function` |
| `brace-expansion: ^2.1.4` scoped under **all four** `minimatch@3` consumers (`eslint`, `@eslint/eslintrc`, `eslint-config-next`, `@eslint/config-array`) | v5 exports an object, `minimatch@3` needs a function; v1 has the ReDoS advisory. Covering only some leaves the rest unresolvable | `expand is not a function`, or `npm ci` `Missing: brace-expansion@1.1.18 from lock file` |

**After ANY change to `overrides`, verify with `npm ci --dry-run` — not `npm install`.**
`npm install` repairs a partial tree in place and reports success; `npm ci` refuses a lockfile
that does not fully resolve. CI, Vercel, and every Dependabot PR run `npm ci`, so an
`npm install`-only check ships a lockfile that is red everywhere but green locally. This
is what broke every build between 3.26.0 and 3.26.2.

`.github/dependabot.yml` already suppresses the major bumps for `eslint`,
`eslint-config-next`, `next`, `react`, and `react-dom`. That `ignore` block only stops
*scheduled version* PRs — **security advisories still come through it**, so never argue
"Dependabot is configured to ignore it" about a CVE.

---

## Reviewing a new package (§2.16)

Before it goes in `package.json`:

- [ ] Does something already installed do this? `date-fns`, `lucide-react`, `recharts`
      and the Web Crypto API cover more than they look like they do.
- [ ] Could it be twenty lines in `lib/` instead? Weigh against §2.9 — a dependency is
      permanent attack surface, but a hand-rolled *security* primitive is worse (see
      the `sanitizeHtml` rewrite in 3.26.0: the rule is don't hand-roll the hard part,
      not don't hand-roll anything).
- [ ] Maintained? Last publish, open critical issues, single-maintainer risk.
- [ ] Install scripts? `npm ls --all` and check. This repo surfaces them via
      `npm approve-scripts`; an install script runs on every CI machine.
- [ ] Does it need to reach the client, or is it server-only? Server-only goes in
      `serverExternalPackages` in `next.config.ts` (`resend` already is).
- [ ] Adding a client dependency that makes network calls? It needs a CSP `connect-src`
      entry — that's a `tyun-security` handoff, don't guess at it.

---

## Handling a Dependabot PR

1. Read the changelog for the bumped range, not just the version numbers.
2. Is it in the production tree? `npm ls <pkg>` — a dev-only bump is low-stakes.
3. `npm ci && npm run build` must pass. `npm run lint` is currently advisory in CI
   (42 pre-existing errors on main); a bump that adds *new* lint errors is still a
   finding — compare counts against main rather than reading the absolute number.
4. A major bump to anything in the pinned table above gets closed with a comment
   pointing at CLAUDE.md, not merged.

---

## CI workflows

`.github/workflows/` — `ci.yml` (audit + lint + build/type-check) and `codeql.yml`
(SAST, per-PR and weekly).

- Every workflow declares its own least-privilege `permissions:` block (§1.3). A new
  workflow that omits it inherits the repo default — always add one.
- Actions are pinned by major (`@v5`) and Dependabot tracks them monthly. A stale
  action is itself supply-chain risk.
- CodeQL is **Advanced setup**. Switching the repo to Default setup silently replaces
  the `security-extended` query pack with the smaller default one — if alerts suddenly
  drop, check this first.
- Never add a real secret to a workflow. `ci.yml` builds with placeholder Supabase
  values because the build only needs the vars to exist.

---

## Out of scope

Application-code vulnerabilities → `tyun-security`. Bundle size, tree-shaking,
`optimizePackageImports` → `tyun-network`. Adding a test runner touches the pinned
lockfile guarded here — it is `tyun-engineer`'s debt item, but it lands through this skill. Never resolve an audit finding by deleting
the audit step, loosening `--audit-level`, or adding a blanket `ignore` — fix, upgrade,
or accept it *in writing* in `SECURITY.md`.
