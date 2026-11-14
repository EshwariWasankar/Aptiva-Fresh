import type { MetadataRoute } from 'next';

/**
 * PH12-T08 — robots.txt configuration per Section 29 / 35.
 * Allows indexing of public landing, auth, privacy, and public assessment pages;
 * strictly disallows private student flows, plans, sessions, and admin panels.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aptiva.app';
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/register', '/privacy', '/assessments/'],
      disallow: [
        '/api/',
        '/dashboard/',
        '/plan/',
        '/practice/',
        '/reassessment/',
        '/notebook/',
        '/profile/',
        '/settings/',
        '/setup/',
        '/onboarding/',
        '/admin/',
        '/diagnostic/',
        '/result/',
        '/review/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
