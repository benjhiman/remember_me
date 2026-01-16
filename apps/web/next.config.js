/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@remember-me/shared'],
  // Enable standalone output for Docker
  output: 'standalone',
};

module.exports = nextConfig;
