import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Admin, API and per-event guest surfaces must never be indexed.
      disallow: ['/admin', '/api/', '/guest-upload/', '/portal/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
