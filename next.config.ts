import type { NextConfig } from 'next'

const securityHeaders = [
  // Content Security Policy — restricts resource origins to known-safe sources.
  // unsafe-inline: required for Next.js inline scripts + Tailwind inline styles.
  // unsafe-eval: required for Calculator's new Function() expression evaluator.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://vitals.vercel-insights.com",
      "worker-src blob: 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
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
  // Legacy XSS filter for older browsers
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  // DNS prefetch control
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['resend'],
  poweredByHeader: false,
  reactStrictMode: true,

  experimental: {
    // Tree-shake large packages to only include what's imported
    optimizePackageImports: ['recharts', 'date-fns'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // Immutable cache for hashed Next.js static chunks (JS/CSS)
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
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