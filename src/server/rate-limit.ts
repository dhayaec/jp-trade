/**
 * Fixed-window API rate limiting.
 *
 * A per-key (per-IP) counter that resets once per window. In-memory by design:
 * on serverless, each instance keeps its own counters, so this bounds abuse
 * per instance rather than globally. Swap `checkRateLimit` for a shared store
 * (e.g. Redis) if a global limit is required — the interface is deliberately
 * narrow so the proxy does not care what backs it.
 *
 * This module must stay free of Prisma / `getEnv()` so it can run inside the
 * proxy without a DATABASE_URL (the CI/E2E environment has none).
 */

export interface RateLimitConfig {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum number of allowed requests per window per key. */
  max: number;
}

export interface RateLimitResult {
  /** Whether the request may proceed. */
  allowed: boolean;
  /** Requests remaining in the current window (>= 0). */
  remaining: number;
  /** Seconds to wait before retrying — only meaningful when `allowed` is false. */
  retryAfterSec: number;
  /** The configured `max`, echoed so callers can emit `X-RateLimit-Limit`. */
  limit: number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

/** Drop stale entries once the map grows past this many distinct keys. */
const MAX_KEYS = 5000;

export function createFixedWindowLimiter(config: RateLimitConfig, now: () => number = Date.now) {
  const windows = new Map<string, WindowState>();

  return {
    check(key: string): RateLimitResult {
      const time = now();
      const state = windows.get(key);
      const expired = state !== undefined && time >= state.resetAt;

      const resetAt = state === undefined || expired ? time + config.windowMs : state.resetAt;
      const count = state === undefined || expired ? 1 : state.count + 1;

      windows.set(key, { count, resetAt });

      // Bound memory: purge expired windows once the map is large.
      if (windows.size > MAX_KEYS) {
        for (const [k, s] of windows) {
          if (time >= s.resetAt) windows.delete(k);
        }
      }

      if (count > config.max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.max(1, Math.ceil((resetAt - time) / 1000)),
          limit: config.max,
        };
      }

      return { allowed: true, remaining: config.max - count, retryAfterSec: 0, limit: config.max };
    },
  };
}

/** Parse an env var as a positive integer, falling back when unset or invalid. */
function parseIntOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const RATE_LIMIT_WINDOW_MS = parseIntOr(process.env['RATE_LIMIT_WINDOW_MS'], 60_000);
const DEFAULT_API_MAX = parseIntOr(process.env['RATE_LIMIT_MAX'], 120);
const SCREEN_MAX = parseIntOr(process.env['RATE_LIMIT_SCREEN_MAX'], 30);

const apiLimiter = createFixedWindowLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: DEFAULT_API_MAX,
});
const screenLimiter = createFixedWindowLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, max: SCREEN_MAX });

/**
 * Rate-limit a request by path: the screen endpoint fans out a query per active
 * symbol and gets a tighter budget than the rest of the API.
 */
export function checkRateLimit(pathname: string, key: string): RateLimitResult {
  const limiter = pathname === '/api/screen' ? screenLimiter : apiLimiter;
  return limiter.check(key);
}
