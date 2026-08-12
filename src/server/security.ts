/**
 * Content-Security-Policy construction for HTML responses.
 *
 * The proxy generates a fresh nonce per request and forwards it to Next.js via
 * the `x-nonce` request header *plus* the CSP on the request headers; Next.js
 * parses the `'nonce-…'` token out of the request CSP during SSR and applies it
 * to its inline bootstrap scripts. `style-src 'unsafe-inline'` is required
 * because lightweight-charts injects a `<style>` element at runtime.
 */

export function buildCspPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
