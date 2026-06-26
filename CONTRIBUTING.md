# Contributing to Tyunnie

Thanks for your interest! Tyunnie is a personal CS-student project and a fan-made
tribute to Taehyun of TOMORROW X TOGETHER — it isn't affiliated with TXT or HYBE.
It's primarily maintained by [@affannajiy](https://github.com/affannajiy), but
issues, ideas, and pull requests are welcome.

By participating, you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Getting started

```bash
git clone https://github.com/affannajiy/tyunnie-pa.git
cd tyunnie-pa
npm install
cp .env.example .env.local   # fill in values — see docs/DEPLOYMENT.md
npm run dev
```

You'll need Supabase, Groq, and (optionally) JDoodle/Resend credentials for the
full feature set. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and
[docs/DATABASE.md](docs/DATABASE.md).

## Before you open a PR

- **Build clean.** Run `npm run build` and `npm run lint` — the Vercel build
  fails on unused vars, `any` misuse, and TS errors. There are a few non-obvious
  build gotchas documented in [.claude/CLAUDE.md](.claude/CLAUDE.md) and
  [docs/DEVNOTES.md](docs/DEVNOTES.md) — please skim them.
- **Match the surrounding style.** No new dependencies unless necessary.
- **Bump the version** if it's a user-facing change: edit `package.json`, the
  README version badge, and add a `docs/CHANGELOG.md` entry (patch = fixes/types,
  minor = features/UI, major = architectural). Add a `### Highlights` block for
  anything users should see.
- **Keep secrets out.** Never commit `.env*` files or service-role keys.

## Reporting bugs / ideas

Open an issue using one of the templates. Include steps to reproduce, what you
expected, and your browser/OS for UI bugs.

## Security

Please **do not** open public issues for security vulnerabilities — see
[SECURITY.md](SECURITY.md) for how to report privately.
