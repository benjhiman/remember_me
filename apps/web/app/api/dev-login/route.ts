import { NextRequest, NextResponse } from 'next/server';

/**
 * Dev Quick Login Route Handler
 * Server-side validation and proxy to backend
 * Returns 404 if disabled or key invalid (no hints)
 */
export async function GET(request: NextRequest) {
  // In production, always return 404 (dev login disabled)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check if dev login is enabled (optional, defaults to false)
  const enabled = process.env.DEV_QUICK_LOGIN_ENABLED === 'true';
  if (!enabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Get key from query param
  const searchParams = request.nextUrl.searchParams;
  const providedKey = searchParams.get('k');
  const expectedKey = process.env.DEV_QUICK_LOGIN_KEY;

  // Validate key (optional in build-time, required at runtime if enabled)
  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Get API base URL
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

  try {
    // Call backend dev-login endpoint
    const response = await fetch(`${apiBaseUrl}/auth/dev-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dev-login-key': expectedKey,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data = await response.json();
    
    // Return only necessary fields (no logs)
    return NextResponse.json({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
  } catch (error) {
    // Return 404 on any error (no hints)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
