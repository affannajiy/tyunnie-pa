import type { NextConfig } from 'next'

const securityHeaders = [
  // Prevent clickjacking
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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
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