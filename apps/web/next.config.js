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
  // Proxy /api/* requests to Railway backend
  async rewrites() {
    // Get backend URL from env or use hardcoded production URL
    // CRITICAL: Sanitize to remove newlines, whitespace, and trailing slashes
    const rawBackendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
                          process.env.API_BASE_URL ||
                          (process.env.NODE_ENV === 'production' 
                            ? 'https://api.iphonealcosto.com/api'
                            : 'http://localhost:4000/api');
    
    // Sanitize: trim whitespace/newlines, remove trailing slashes, remove any control characters
    const sanitizedBackendUrl = rawBackendUrl
      .trim()                                    // Remove leading/trailing whitespace and newlines
      .replace(/[\r\n]+/g, '')                   // Remove any remaining newlines/carriage returns
      .replace(/\/+$/, '')                       // Remove trailing slashes
      .replace(/[\x00-\x1F\x7F]/g, '');         // Remove control characters
    
    // Build destination URL (all in one line to avoid template string newlines)
    // Backend has global prefix 'api', so full URL is: https://api.iphonealcosto.com/api
    // Example: /api/stock/ping -> https://api.iphonealcosto.com/api/stock/ping
    const destination = `${sanitizedBackendUrl}/:path*`;
    
    // Log for debugging (only in build time, not in runtime)
    if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'production') {
      console.log('[rewrites] rawBackendUrl=', JSON.stringify(rawBackendUrl));
      console.log('[rewrites] sanitizedBackendUrl=', JSON.stringify(sanitizedBackendUrl));
      console.log('[rewrites] destination=', JSON.stringify(destination));
    }
    
    return [
      {
        source: '/api/:path*',
        destination: destination,
      },
    ];
  },
};

module.exports = nextConfig;
