import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for staging environment password protection
 *
 * Only activates when STAGING_PASSWORD env var is set.
 * Protects all routes except the staging login page and API routes.
 */

const STAGING_COOKIE_NAME = 'staging_auth';
const STAGING_COOKIE_VALUE = 'authenticated';

export function middleware(request: NextRequest) {
  const stagingPassword = process.env.STAGING_PASSWORD;

  // If no staging password is set, skip protection (production)
  if (!stagingPassword) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow access to staging login page and its API
  if (pathname === '/staging-login' || pathname === '/api/staging-auth') {
    return NextResponse.next();
  }

  // Allow access to static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for staging auth cookie
  const stagingCookie = request.cookies.get(STAGING_COOKIE_NAME);

  if (stagingCookie?.value === STAGING_COOKIE_VALUE) {
    return NextResponse.next();
  }

  // Redirect to staging login
  const loginUrl = new URL('/staging-login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
