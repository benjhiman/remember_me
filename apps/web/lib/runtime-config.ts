/**
 * Runtime Configuration Validator
 * 
 * Validates critical runtime configuration before app bootstrap.
 * Fails fast with visible error if configuration is invalid.
 * 
 * This prevents silent failures and infinite loading states.
 */

export interface RuntimeConfig {
  apiBaseUrl: string;
  isValid: boolean;
  errors: string[];
}

const MAX_HYDRATION_TIMEOUT = 5000; // 5 seconds max for hydration

/**
 * Validates runtime configuration
 */
export function validateRuntimeConfig(): RuntimeConfig {
  const errors: string[] = [];
  let apiBaseUrl = '';

  // Check if we're in browser
  if (typeof window === 'undefined') {
    // SSR: Use env var directly (will be validated on client)
    apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    return {
      apiBaseUrl,
      isValid: true, // Defer validation to client
      errors: [],
    };
  }

  // Client-side validation
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Detect production environment
  const isProduction =
    window.location.hostname !== 'localhost' &&
    !window.location.hostname.includes('127.0.0.1') &&
    !window.location.hostname.includes('192.168.') &&
    !window.location.hostname.includes('10.0.');

  if (isProduction) {
    // Production: Strict validation
    if (!envUrl || envUrl.trim() === '') {
      errors.push('NEXT_PUBLIC_API_BASE_URL is not set in production');
    } else if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      errors.push(`NEXT_PUBLIC_API_BASE_URL contains localhost/127.0.0.1: ${envUrl}`);
    } else if (!envUrl.startsWith('https://')) {
      errors.push(`NEXT_PUBLIC_API_BASE_URL must use HTTPS in production: ${envUrl}`);
    } else {
      apiBaseUrl = envUrl.replace(/\/+$/, '');
    }
  } else {
    // Development: Allow localhost fallback
    apiBaseUrl = envUrl || 'http://localhost:4000/api';
    apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  }

  const isValid = errors.length === 0;

  if (!isValid && typeof window !== 'undefined') {
    // Log to console for debugging
    console.error('[RUNTIME_CONFIG] ❌ Configuration validation failed:');
    errors.forEach((error) => {
      console.error(`  - ${error}`);
    });
    console.error(`[RUNTIME_CONFIG] Current API URL: ${apiBaseUrl || 'NOT SET'}`);
    console.error(`[RUNTIME_CONFIG] Hostname: ${window.location.hostname}`);
    console.error(`[RUNTIME_CONFIG] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

    // Store error in sessionStorage for OrgProvider to display
    try {
      sessionStorage.setItem('rm.apiConfigError', errors.join('; '));
    } catch (e) {
      // Ignore storage errors
    }
  } else if (isValid && typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Log successful config in production for debugging
    console.log('[RUNTIME_CONFIG] ✅ Configuration validated');
    console.log(`[RUNTIME_CONFIG] API Base URL: ${apiBaseUrl}`);
    console.log(`[RUNTIME_CONFIG] Hostname: ${window.location.hostname}`);
  }

  return {
    apiBaseUrl,
    isValid,
    errors,
  };
}

/**
 * Validates runtime config and throws if invalid
 */
export function assertRuntimeConfig(): void {
  const config = validateRuntimeConfig();
  if (!config.isValid) {
    throw new Error(`Runtime configuration invalid: ${config.errors.join(', ')}`);
  }
}

/**
 * Gets API base URL with validation
 */
export function getValidatedApiBaseUrl(): string {
  const config = validateRuntimeConfig();
  if (!config.isValid) {
    // In production, use safe fallback
    if (typeof window !== 'undefined') {
      const isProduction =
        window.location.hostname !== 'localhost' &&
        !window.location.hostname.includes('127.0.0.1');
      if (isProduction) {
        return 'https://api.iphonealcosto.com/api';
      }
    }
  }
  return config.apiBaseUrl;
}
