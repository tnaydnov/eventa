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
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
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
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
