import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
});

const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // enabled: RealtimeHub is resilient to double-mounts
  // Turbopack config (required for Next.js 16 alongside webpack plugins)
  turbopack: {},
  experimental: {
    optimizePackageImports: ['zustand', 'zod', 'framer-motion'],
  },
  images: {
    qualities: [75, 90, 100],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      ...(isDev
        ? [
            {
              protocol: 'http',
              hostname: '127.0.0.1',
              port: '54321',
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
    ],
  },
  async headers() {
    // Build CSP based on environment
    const supabaseImg = isDev
      ? 'http://127.0.0.1:54321 https://*.supabase.co'
      : 'https://*.supabase.co';
    const supabaseConnect = isDev
      ? 'http://127.0.0.1:54321 ws://127.0.0.1:54321 https://*.supabase.co wss://*.supabase.co'
      : 'https://*.supabase.co wss://*.supabase.co';
    // unsafe-eval only needed for Next.js dev mode
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
      : "script-src 'self' 'unsafe-inline' blob:";

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), fullscreen=(), payment=(), usb=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `img-src 'self' data: blob: ${supabaseImg} https://images.unsplash.com https://*.unsplash.com`,
              `media-src 'self' blob: ${supabaseImg}`,
              `connect-src 'self' ${supabaseConnect}`,
              "worker-src 'self' blob:",
              "frame-src 'self' https://*.creditguard.co.il https://*.cardcom.co.il https://*.cardcom.solutions https://*.yaadsarig.com https://*.meshulam.co.il https://*.upay.co.il https://*.invoice4u.co.il",
              "object-src 'none'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
      // Sensitive API namespaces must never be cached by browsers, the service
      // worker, or any shared/CDN intermediary — responses carry session cookies,
      // auth state, and personal data. (The deliberately-cached venue reads under
      // /api/secure/* are handled by the service worker and intentionally excluded.)
      {
        source: '/api/:path(admin|auth|account|payment)/:rest*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // Permanent redirects from old /dating/* routes
      { source: '/dating', destination: '/', permanent: true },
      { source: '/dating/order', destination: '/order', permanent: true },
      { source: '/dating/event-over', destination: '/event-over', permanent: true },
      { source: '/dating/:eventSlug', destination: '/:eventSlug', permanent: true },
      { source: '/dating/:eventSlug/:path*', destination: '/:eventSlug/:path*', permanent: true },
      // Permanent redirect from old guest-upload route to new portal route
      { source: '/guest-upload/:token', destination: '/portal/:token', permanent: true },
    ];
  },
};

export default withSerwist(nextConfig);
