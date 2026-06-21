import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'splitsmart_session';

export function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;

  // Define route categories
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/groups');

  if (isProtectedRoute && !token) {
    // Redirect to login if trying to access protected pages without session
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && token) {
    // Redirect to dashboard if logged-in user tries to access auth pages
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Allow all other routes (including APIs, which do their own backend validation)
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/groups/:path*', '/login', '/register'],
};
