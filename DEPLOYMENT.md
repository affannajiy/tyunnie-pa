# Deployment

Tyunnie deploys to **Vercel** with zero configuration. No Docker, no server management.

---

## Environment Variables

Set these in Vercel → Project → Settings → Environment Variables (or in `.env.local` for local dev).

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key |
| `GROQ_API_KEY` | Server only | Groq LLM API |
| `JDOODLE_CLIENT_ID` | Server only | JDoodle code execution |
| `JDOODLE_CLIENT_SECRET` | Server only | JDoodle code execution |
| `RESEND_API_KEY` | Server only | Email via Resend |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Server-side Supabase ops |
| `CRON_SECRET` | Server only | Bearer token guard for `/api/daily-quote` |

---

## Vercel Setup

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add all environment variables above
4. Deploy — Vercel auto-detects Next.js, no extra config needed

### Cron Job

The daily quote email runs via Vercel Cron. It's already declared in `vercel.json` (or `next.config.ts`). Make sure `CRON_SECRET` and `RESEND_API_KEY` are set in production.

---

## Google OAuth Setup

When users sign in with Google, the consent screen shows the Supabase project URL by default. To show your app name instead:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → OAuth consent screen**
2. Set **App name** to `Tyunnie` and upload a logo
3. Under **App domain**, set the homepage to your production URL (e.g. `https://tyunnie-pa.vercel.app`)
4. Under **Authorized domains**, add `vercel.app` or your custom domain
5. **Publish the app** — move it out of Testing mode

> The "to continue to [domain]" text on Google's account picker reflects the OAuth consent screen configuration, not code.

---

## Supabase Configuration

### Auth Settings (Supabase Dashboard → Authentication → URL Configuration)

- **Site URL**: your production URL (e.g. `https://tyunnie-pa.vercel.app`)
- **Redirect URLs**: add `https://tyunnie-pa.vercel.app/**` and `http://localhost:3000/**`

### Google Provider

- Enable Google under **Authentication → Providers → Google**
- Paste in the Client ID and Secret from Google Cloud Console
- Add `https://[project-ref].supabase.co/auth/v1/callback` as an authorized redirect URI in Google Cloud Console

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Runs on `http://localhost:3000`. The root `/` redirects to `/dashboard` (configured in `next.config.ts`).

### Useful commands

```bash
npm run dev      # dev server with Turbopack
npm run build    # production build + type check
npm run lint     # ESLint
```
