import { NextRequest, NextResponse } from 'next/server';

/**
 * Robust API Proxy Route Handler
 * 
 * Proxies all /api/* requests to the Railway backend, preserving:
 * - HTTP method, query string, body
 * - Headers (Cookie, Content-Type, Authorization, X-Request-Id, etc.)
 * - Set-Cookie headers (multiple cookies preserved correctly)
 * 
 * This ensures cookies are set on app.iphonealcosto.com domain (same-origin).
 */

// Sanitize backend URL (remove newlines, control chars, trailing slashes)
function sanitizeBackendUrl(raw: string): string {
  return raw
    .trim()
    .replace(/[\r\n]+/g, '')
    .replace(/\/+$/, '')
    .replace(/[\x00-\x1F\x7F]/g, '');
}

// Get backend base URL
function getBackendBaseUrl(): string {
  const rawBackendUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://api.iphonealcosto.com/api'
      : 'http://localhost:4000/api');

  return sanitizeBackendUrl(rawBackendUrl);
}

// Headers that should NOT be forwarded (hop-by-hop headers)
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'host', // Don't forward host (backend will set its own)
]);

// Headers that SHOULD be forwarded
const FORWARD_HEADERS = new Set([
  'cookie',
  'content-type',
  'authorization',
  'x-request-id',
  'x-organization-id',
  'x-client',
  'x-client-version',
  'idempotency-key',
  'accept',
  'accept-language',
  'user-agent',
]);

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'DELETE');
}

export async function OPTIONS(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'OPTIONS');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string,
): Promise<NextResponse> {
  try {
    const backendBaseUrl = getBackendBaseUrl();
    const path = pathSegments.join('/');
    
    // Build backend URL: backendBaseUrl already includes /api, so just append path
    // Example: backendBaseUrl = "https://api.iphonealcosto.com/api"
    //          path = "stock/seller-view"
    //          final = "https://api.iphonealcosto.com/api/stock/seller-view"
    const backendUrl = `${backendBaseUrl}/${path}`.replace(/\/+/g, '/');

    // Build query string
    const queryString = request.nextUrl.searchParams.toString();
    const fullBackendUrl = queryString ? `${backendUrl}?${queryString}` : backendUrl;

    // Prepare headers to forward
    const forwardHeaders: Record<string, string> = {};
    
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
        // Forward relevant headers
        if (FORWARD_HEADERS.has(lowerKey) || lowerKey.startsWith('x-')) {
          forwardHeaders[key] = value;
        }
      }
    });

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: forwardHeaders,
      // Forward body for methods that support it
      ...(method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && {
        body: await request.text(),
      }),
    };

    // Make request to backend
    const backendResponse = await fetch(fullBackendUrl, requestOptions);

    // Read response body
    const responseBody = await backendResponse.text();

    // Prepare response headers
    const responseHeaders = new Headers();

    // Forward all response headers except hop-by-hop
    backendResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
        // CRITICAL: Preserve Set-Cookie headers (may be multiple)
        if (lowerKey === 'set-cookie') {
          // Get all Set-Cookie values (there may be multiple)
          const setCookieValues = backendResponse.headers.getSetCookie?.() || 
                                  [backendResponse.headers.get('set-cookie')].filter(Boolean);
          
          // Set each cookie individually in NextResponse
          setCookieValues.forEach((cookie: string) => {
            responseHeaders.append('Set-Cookie', cookie);
          });
        } else {
          responseHeaders.set(key, value);
        }
      }
    });

    // Create NextResponse with status, headers, and body
    const nextResponse = new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });

    return nextResponse;
  } catch (error) {
    console.error('[API_PROXY] Error proxying request:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
