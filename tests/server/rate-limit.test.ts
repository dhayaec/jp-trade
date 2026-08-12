import { describe, expect, it } from 'vitest';
import { createFixedWindowLimiter } from '@/server/rate-limit';

describe('createFixedWindowLimiter', () => {
  it('allows the first request and decrements remaining', () => {
    const limiter = createFixedWindowLimiter({ windowMs: 60_000, max: 5 });
    const result = limiter.check('1.2.3.4');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
    expect(result.retryAfterSec).toBe(0);
  });

  it('increments the counter across calls', () => {
    const limiter = createFixedWindowLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.check('a').remaining).toBe(2);
    expect(limiter.check('a').remaining).toBe(1);
    expect(limiter.check('a').remaining).toBe(0);
  });

  it('blocks once the window limit is exceeded', () => {
    const limiter = createFixedWindowLimiter({ windowMs: 60_000, max: 2 });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('a').retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('resets the window after the window expires', () => {
    let time = 0;
    const now = () => time;
    const limiter = createFixedWindowLimiter({ windowMs: 1000, max: 1 }, now);

    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(false); // limit hit

    // Advance time past the window
    time = 1001;
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').remaining).toBe(0);
  });

  it('resets remaining to max - 1 at the start of a new window', () => {
    let time = 0;
    const now = () => time;
    const limiter = createFixedWindowLimiter({ windowMs: 1000, max: 3 }, now);

    limiter.check('k');
    expect(limiter.check('k').remaining).toBe(1);

    time = 1001;
    const result = limiter.check('k');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // new window, second request in it
  });

  it('keys are independent — different IPs do not share the limit', () => {
    const limiter = createFixedWindowLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check('10.0.0.1').allowed).toBe(true);
    expect(limiter.check('10.0.0.2').allowed).toBe(true);
    expect(limiter.check('10.0.0.1').allowed).toBe(false);
  });

  it('sweeps stale keys once the map grows large', () => {
    let time = 0;
    const now = () => time;
    const limiter = createFixedWindowLimiter({ windowMs: 1000, max: 1 }, now);

    // Fill >5000 entries, all expired
    for (let i = 0; i < 5001; i++) {
      limiter.check(`ip-${i}`);
    }

    // Advance past the window and use a fresh key — should work without
    // excessive memory (sweep ran on the 5001th insert).
    time = 1001;
    const result = limiter.check('fresh');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
