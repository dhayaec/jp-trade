import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/server/rate-limit';
import { buildCspPolicy } from '@/server/security';

/**
 * Next.js 16 routing proxy (successor to `middleware.ts`).
 *
 * - Rate-limits `/api/*` per client IP with an in-memory fixed window (see
 *   `src/server/rate-limit.ts` for the per-instance caveat).
 * - Applies a nonce-based Content-Security-Policy to HTML documents: the
 *   `x-nonce` request header tells Next.js to nonce its inline scripts, and
 *   the CSP response header is set on the reply.
 *
 * Static assets are skipped via the matcher; the API branch above handles
 * non-HTML routes.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api')) {
    return rateLimit(request, pathname);
  }

  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV !== 'production';
  const csp = buildCspPolicy(nonce, isDev);

  // Set both the `x-nonce` request header *and* the CSP on the request: Next.js
  // parses the nonce out of the request's CSP header during SSR and applies it
  // to inline scripts. The response header carries the policy to the browser.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

function rateLimit(request: NextRequest, pathname: string) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';

  const result = checkRateLimit(pathname, ip);

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));

  if (!result.allowed) {
    // Build a fresh header set: `response` is a `NextResponse.next()` passthrough
    // whose `x-middleware-next` header would make Next.js treat this 429 as a
    // "continue" and fall through to the route handler instead of short-circuiting.
    const headers = new Headers();
    headers.set('Retry-After', String(result.retryAfterSec));
    headers.set('X-RateLimit-Limit', String(result.limit));
    headers.set('X-RateLimit-Remaining', '0');
    return NextResponse.json(
      { error: 'Too many requests, please slow down.' },
      { status: 429, headers }
    );
  }

  return response;
}

export const config = {
  // Skip build artifacts and any path containing a file extension; run for
  // HTML documents and `/api/*` routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
