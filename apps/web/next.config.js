/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@remember-me/shared'],
  // Note: output: 'standalone' removed - not compatible with Vercel
  // Vercel handles Next.js deployments automatically
  // If Docker is needed, use a separate config or conditional
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  // Proxy /api/* requests handled by route handler: apps/web/app/api/[...path]/route.ts
  // Rewrites disabled in production to use route handler (better Set-Cookie preservation)
  async rewrites() {
    // In production, disable rewrites - use route handler instead
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    
    // In development, keep rewrites for convenience (route handler also works)
    const rawBackendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
                          process.env.API_BASE_URL ||
                          'http://localhost:4000/api';
    
    const sanitizedBackendUrl = rawBackendUrl
      .trim()
      .replace(/[\r\n]+/g, '')
      .replace(/\/+$/, '')
      .replace(/[\x00-\x1F\x7F]/g, '');
    
    return [
      {
        source: '/api/:path*',
        destination: `${sanitizedBackendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
