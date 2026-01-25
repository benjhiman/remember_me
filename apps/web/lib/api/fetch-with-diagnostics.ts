/**
 * Fetch wrapper with redirect detection and diagnostics
 * 
 * Detects redirects that might break CORS and provides detailed error information.
 */

export interface FetchDiagnostics {
  redirected: boolean;
  redirectLocation?: string;
  responseType: ResponseType;
  finalUrl?: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export class RedirectError extends Error {
  constructor(
    message: string,
    public location: string | null,
    public diagnostics: FetchDiagnostics
  ) {
    super(message);
    this.name = 'RedirectError';
  }
}

export class OpaqueResponseError extends Error {
  constructor(
    message: string,
    public diagnostics: FetchDiagnostics
  ) {
    super(message);
    this.name = 'OpaqueResponseError';
  }
}

/**
 * Fetch with redirect detection and diagnostics
 * 
 * Throws RedirectError if redirect detected (301, 302, 307, 308, or response.redirected === true)
 * Throws OpaqueResponseError if response.type === 'opaque' (possible CORS issue)
 */
export async function fetchWithDiagnostics(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  // Extract diagnostics
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const diagnostics: FetchDiagnostics = {
    redirected: response.redirected,
    redirectLocation: headers['location'] || undefined,
    responseType: response.type,
    finalUrl: response.url,
    status: response.status,
    statusText: response.statusText,
    headers,
  };

  // Detect redirects
  const isRedirectStatus = [301, 302, 307, 308].includes(response.status);
  
  if (response.redirected || isRedirectStatus) {
    const location = headers['location'] || 'unknown';
    const errorMessage = `REDIRECT_DETECTED: Request was redirected to ${location}`;
    
    // Log in production for debugging
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      console.error('[FETCH_DIAGNOSTICS] ❌ Redirect detected:', {
        originalUrl: typeof input === 'string' ? input : input.toString(),
        finalUrl: response.url,
        location,
        status: response.status,
      });
    }
    
    throw new RedirectError(errorMessage, location, diagnostics);
  }

  // Detect opaque responses (possible CORS issue)
  if (response.type === 'opaque') {
    const errorMessage = 'OPAQUE_RESPONSE: Response is opaque (possible CORS/proxy issue)';
    
    // Log in production for debugging
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      console.error('[FETCH_DIAGNOSTICS] ❌ Opaque response detected:', {
        originalUrl: typeof input === 'string' ? input : input.toString(),
        finalUrl: response.url,
        status: response.status,
      });
    }
    
    throw new OpaqueResponseError(errorMessage, diagnostics);
  }

  return response;
}
