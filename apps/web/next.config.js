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
    // Backend has global prefix 'api', so full URL is: https://api.iphonealcosto.com/api
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
                       (process.env.NODE_ENV === 'production' 
                         ? 'https://api.iphonealcosto.com/api'
                         : 'http://localhost:4000/api');
    
    // Normalize: remove trailing slash
    const normalizedBackendUrl = backendUrl.replace(/\/+$/, '');
    
    // Rewrite /api/:path* to backend URL
    // Example: /api/stock/ping -> https://api.iphonealcosto.com/api/stock/ping
    return [
      {
        source: '/api/:path*',
        destination: `${normalizedBackendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
