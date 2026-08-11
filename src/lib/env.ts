import { z } from 'zod';

/**
 * Runtime environment validation.
 *
 * Validation is lazy: `process.env` is parsed on first access of `getEnv()`
 * and cached. Nothing reads `process.env` at module load time, so the CI
 * build step (which sets no DATABASE_URL) does not crash during `next build`.
 *
 * See PLAN.md Appendix B for the full variable reference.
 */

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM in 24-hour IST');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** PostgreSQL connection string for the trading database. */
  DATABASE_URL: z.url('DATABASE_URL is required'),
  /** Secret for session/JWT signing — required once auth ships in Phase 6. */
  AUTH_SECRET: z.string().optional(),
  /** Public origin used for absolute links / OAuth callbacks. */
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  /** Optional for development; required for live-market caching (Phase 3). */
  REDIS_URL: z.url().optional(),
  // NSE broker credentials (Shoonya). Empty until live-data wiring in Phase 4.
  BROKER_API_KEY: z.string().optional(),
  BROKER_USER_ID: z.string().optional(),
  BROKER_PASSWORD: z.string().optional(),
  BROKER_ENDPOINT: z.url().default('https://api.shoonya.com'),
  /** Market hours in IST (HH:MM, 24h). Used by screener day-filtering. */
  MARKET_OPEN: timeString.default('09:15'),
  MARKET_CLOSE: timeString.default('15:30'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Lazily parse and cache `process.env`. Throws with a Zod error if required vars are missing. */
export function getEnv(): Env {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}
