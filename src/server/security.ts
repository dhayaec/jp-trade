/**
 * Content-Security-Policy construction for HTML responses.
 *
 * The proxy generates a fresh nonce per request and forwards it to Next.js via
 * the `x-nonce` request header *plus* the CSP on the request headers; Next.js
 * parses the `'nonce-…'` token out of the request CSP during SSR and applies it
 * to its inline bootstrap scripts. `style-src 'unsafe-inline'` is required
 * because lightweight-charts injects a `<style>` element at runtime.
 *
 * In development (non-production), React requires `'unsafe-eval'` for debugging
 * features like reconstructing call stacks and source maps. Production never uses
 * eval(), so we only add it when NODE_ENV !== 'production'.
 */

export function buildCspPolicy(
  nonce: string,
  isDev = process.env.NODE_ENV !== 'production'
): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    scriptSrc,
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
