/**
 * Helper functions for extracting and normalizing request data
 */

/**
 * Normalize header value that can be string, string[], or null/undefined
 * Returns the first value if it's an array, or the value itself if it's a string
 */
export function firstHeader(value: string | string[] | null | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Extract IP address from request, handling x-forwarded-for and other headers
 * Returns the first IP if x-forwarded-for contains multiple IPs (comma-separated)
 */
export function extractIp(request: {
  ip?: string | string[] | null;
  socket?: { remoteAddress?: string | null };
  headers?: {
    'x-forwarded-for'?: string | string[] | null;
    [key: string]: string | string[] | null | undefined;
  };
}): string | null {
  // Try x-forwarded-for first (most reliable behind proxies)
  const xff = request.headers?.['x-forwarded-for'];
  if (xff) {
    const xffStr = firstHeader(xff);
    if (xffStr) {
      // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
      // We want the first one (original client)
      return xffStr.split(',')[0].trim();
    }
  }

  // Fallback to request.ip
  if (request.ip) {
    return firstHeader(request.ip);
  }

  // Fallback to socket remoteAddress
  if (request.socket?.remoteAddress) {
    return request.socket.remoteAddress;
  }

  return null;
}

/**
 * Extract user agent from request headers
 */
export function extractUserAgent(request: {
  get?: (name: string) => string | string[] | null | undefined;
  headers?: {
    'user-agent'?: string | string[] | null | undefined;
    [key: string]: string | string[] | null | undefined;
  };
}): string | null {
  // Try request.get() first (Express method)
  if (request.get) {
    const ua = request.get('user-agent');
    if (ua) {
      return firstHeader(ua);
    }
  }

  // Fallback to headers directly
  if (request.headers?.['user-agent']) {
    return firstHeader(request.headers['user-agent']);
  }

  return null;
}
