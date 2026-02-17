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
};

module.exports = nextConfig;
