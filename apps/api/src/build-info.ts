/**
 * Build Information
 * 
 * This file is generated at build time with commit hash and build timestamp.
 * It provides irrefutable proof of which commit is running in production.
 */

// Get commit from environment variables (set by Railway/CI)
export const BUILD_COMMIT =
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.GIT_COMMIT?.slice(0, 7) ||
  'unknown';

// Build time (set at build time, not runtime)
// This will be replaced by build script
export const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString();

// Build info object
export const BUILD_INFO = {
  commit: BUILD_COMMIT,
  buildTime: BUILD_TIME,
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
