import { describe, expect, it } from 'vitest';
import { buildCspPolicy } from '@/server/security';

describe('buildCspPolicy', () => {
  it('includes the nonce in the script-src directive', () => {
    const policy = buildCspPolicy('abc123');
    expect(policy).toContain("script-src 'self' 'nonce-abc123'");
  });

  it('does not reuse nonces between calls', () => {
    const policy1 = buildCspPolicy('aaa');
    const policy2 = buildCspPolicy('bbb');
    expect(policy1).toContain('nonce-aaa');
    expect(policy2).toContain('nonce-bbb');
  });

  it('requires style-src unsafe-inline for lightweight-charts', () => {
    const policy = buildCspPolicy('n');
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('blocks external resources by default (default-src self)', () => {
    const policy = buildCspPolicy('n');
    expect(policy).toContain("default-src 'self'");
  });

  it('disallows iframes, plugins, and open redirects', () => {
    const policy = buildCspPolicy('n');
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
  });

  it('allows data URIs for inline images', () => {
    const policy = buildCspPolicy('n');
    expect(policy).toContain("img-src 'self' data:");
  });

  it('allows same-origin fetch/XHR via connect-src', () => {
    const policy = buildCspPolicy('n');
    expect(policy).toContain("connect-src 'self'");
  });
});
