import type { NextConfig } from 'next'

// In development only, two extra script sources are needed. Both are dev-time
// tooling that never runs in a deployed build, so production keeps the tight
// policy and the dev console stays free of violations nobody should act on:
//   • 'unsafe-eval'  — React's dev build uses eval() to rebuild callstacks.
//                      React's own message: "React will never use eval() in
//                      production mode." Granting it in dev does not weaken the
//                      shipped policy, and leaving it out only trained us to
//                      ignore a red console.
//   • va.vercel-scripts.com — @vercel/analytics and @vercel/speed-insights load
//                      their debug script from that host in dev. On Vercel they
//                      are served from this origin (/_vercel/…), which 'self'
//                      already covers. Both were being blocked silently, which
//                      is what a control looks like when it breaks a feature
//                      nobody is watching.
const isDevBuild = process.env.NODE_ENV !== 'production'

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDevBuild ? ["'unsafe-eval'", 'https://va.vercel-scripts.com'] : []),
].join(' ')

const securityHeaders = [
  // Content Security Policy — restricts resource origins to known-safe sources.
  //
  // 'unsafe-eval' is GONE from the production policy and must stay gone. It was
  // there for one reason: Calculator's `new Function()` expression evaluator.
  // That evaluator was replaced by a real parser (lib/mathEval.ts), so the
  // shipped app contains no string-to-code path at all. Putting the directive
  // back unconditionally would silently re-open the injection class the parser
  // exists to remove (§2b.4, §2a.7). It is granted in development only, for
  // React's dev build — see isDevBuild above.
  //
  // 'unsafe-inline' on script-src is still required: Next.js emits inline
  // bootstrap scripts, and app/layout.tsx runs an inline theme script before
  // paint to avoid a flash. Removing it needs a per-request nonce from
  // middleware, threaded through both — tracked as the next CSP step, not
  // something to fake with a hash.
  // 'unsafe-inline' on style-src is required by Tailwind's inline styles and by
  // the per-frame inline styles the music/focus animations write.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      // Scoped to the origins actually used: Supabase Storage (avatars, covers,
      // music art), plus data:/blob: for cropped avatars and object URLs.
      // A bare `https:` would let any host serve an image — a tracking-pixel and
      // referrer-leak surface with no feature behind it.
      "img-src 'self' https://*.supabase.co data: blob:",
      "media-src 'self' blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://geocoding-api.open-meteo.com https://vitals.vercel-insights.com https://speed.cloudflare.com",
      "worker-src blob: 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // No plugin/applet content anywhere, and no <base> rewriting.
      "frame-src 'none'",
      // Upgrade any stray http:// subresource rather than letting it be blocked
      // silently or, worse, loaded in the clear (§2j.1).
      'upgrade-insecure-requests',
    ].join('; '),
  },
  // Prevent clickjacking (legacy; frame-ancestors above handles modern browsers)
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  // Strict referrer — don't leak full URL to third parties
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  // Force HTTPS for 2 years (Vercel always serves HTTPS)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Restrict browser feature access — allow microphone for speech input only
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(self), geolocation=()' },
  // Explicitly disable the legacy XSS auditor — it introduced its own
  // vulnerabilities (modern guidance is '0'; CSP is the real defence)
  { key: 'X-XSS-Protection',        value: '0' },
  // DNS prefetch control
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  // Isolate the browsing context: a window this app opens (and any opener) gets
  // no scripting handle back into it, which also closes the tabnabbing path for
  // the vault's saved-website links. 'same-origin-allow-popups' rather than
  // 'same-origin' so Supabase's Google OAuth popup still resolves.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // Only this origin may embed our documents/resources as a subresource.
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Legacy Adobe cross-domain policy files — we serve none; say so.
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['resend'],
  poweredByHeader: false,
  reactStrictMode: true,

  experimental: {
    // Tree-shake large packages to only include what's imported
    optimizePackageImports: ['recharts', 'date-fns', 'lucide-react'],
  },

  // Image optimization — serve AVIF/WebP instead of raw PNGs (the 560×720 hero
  // sprite is the desktop LCP element). imageSizes cover the sprite's rendered
  // widths (hero 200px, mobile 110px) at 1x/2x; long CDN cache for static art.
  images: {
    formats: ['image/avif', 'image/webp'],
    imageSizes: [110, 200, 256, 384],
    minimumCacheTTL: 2678400, // 31 days
  },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // Immutable cache for hashed Next.js static chunks — production only.
      // In dev, Next.js uses non-hashed filenames for HMR; caching them
      // immutably breaks fast refresh.
      ...(isProd ? [{
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      }] : []),
      // Authenticated, per-user API responses must never be stored by a shared
      // cache or written to the browser's disk cache — chat carries the user's
      // own words, vault-notify carries an OTP. Set centrally rather than in
      // each route so a new authenticated route inherits the safe default.
      // Deliberately NOT applied to /api/changelog (public, CDN-cached) or
      // /api/exchange-rates (sets its own `private, max-age=3600`).
      {
        source: '/api/(chat|run|vault-notify)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Pragma',        value: 'no-cache' },
        ],
      },
      // Long-lived cache for public images and fonts
      {
        source: '/(.*\\.(?:png|jpg|jpeg|gif|svg|ico|woff2?))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ]
  },

  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ]
  },
}

export default nextConfig