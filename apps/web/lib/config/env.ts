import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url('NEXT_PUBLIC_API_BASE_URL must be a valid URL'),
  NEXT_PUBLIC_APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10000)),
  NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 2000)),
  NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 8000)),
});

type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  // In test environment, use defaults
  if (process.env.NODE_ENV === 'test') {
    return envSchema.parse({
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api',
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || 'dev',
      NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS:
        process.env.NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS,
      NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN:
        process.env.NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN,
      NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED:
        process.env.NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED,
    });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  // During build (server-side), allow missing env vars (will fail at runtime)
  if (typeof window === 'undefined' && !apiBaseUrl) {
    // Build time - return defaults, validation will happen at runtime
    return {
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
      NEXT_PUBLIC_APP_ENV: (process.env.NEXT_PUBLIC_APP_ENV as 'dev' | 'staging' | 'prod') || 'dev',
      NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS: 10000,
      NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN: 2000,
      NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED: 8000,
    } as Env;
  }

  // Runtime validation (client-side or server with env vars)
  try {
    return envSchema.parse({
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl || 'http://localhost:4000/api',
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || 'dev',
      NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS:
        process.env.NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS,
      NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN:
        process.env.NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN,
      NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED:
        process.env.NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => e.path.join('.')).join(', ');
      // Only throw in runtime (client-side), not during build
      if (typeof window !== 'undefined') {
        throw new Error(
          `Invalid environment variables: ${missing}. Please check your .env file.`
        );
      }
      // Build time: log warning but don't fail
      console.warn(`Environment validation warning: ${missing}. Using defaults.`);
      // Return defaults for build
      return {
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
        NEXT_PUBLIC_APP_ENV: 'dev',
        NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS: 10000,
        NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN: 2000,
        NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED: 8000,
      } as Env;
    }
    throw error;
  }
}

export const env = getEnv();
