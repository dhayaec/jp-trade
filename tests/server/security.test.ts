import { describe, expect, it } from 'vitest';
import { buildCspPolicy } from '@/server/security';

describe('buildCspPolicy', () => {
  describe('development mode (default)', () => {
    it('includes the nonce in the script-src directive', () => {
      const policy = buildCspPolicy('abc123');
      expect(policy).toContain("script-src 'self' 'nonce-abc123'");
    });

    it('includes unsafe-eval for React dev tooling', () => {
      const policy = buildCspPolicy('abc123');
      expect(policy).toContain("'unsafe-eval'");
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

  describe('production mode', () => {
    it('excludes unsafe-eval in production', () => {
      const policy = buildCspPolicy('abc123', false);
      expect(policy).not.toContain("'unsafe-eval'");
    });

    it('still includes the nonce in production', () => {
      const policy = buildCspPolicy('abc123', false);
      expect(policy).toContain("script-src 'self' 'nonce-abc123'");
    });

    it('keeps all other directives the same in production', () => {
      const policy = buildCspPolicy('n', false);
      expect(policy).toContain("style-src 'self' 'unsafe-inline'");
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain("base-uri 'self'");
      expect(policy).toContain("form-action 'self'");
      expect(policy).toContain("img-src 'self' data:");
      expect(policy).toContain("connect-src 'self'");
    });
  });
});
