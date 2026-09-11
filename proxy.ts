import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Lightweight gate (Next 16's Proxy, formerly Middleware): everything under the
 * app requires login. We only check for the presence of the better-auth session
 * cookie here (no DB / no full session validation) so it stays fast; the real
 * validation happens in the API routes and server components via
 * `getCurrentUser()`.
 *
 * Public paths (`/`, `/login`, `/api/auth/*`, static assets) are simply not
 * matched below.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/scenarios",
    "/scenarios/:path*",
    "/chat/:path*",
    "/usage",
    "/usage/:path*",
    "/logs",
    "/logs/:path*",
    "/tts",
    "/tts/:path*",
    "/runs",
    "/runs/:path*",
  ],
};
