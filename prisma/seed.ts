#!/usr/bin/env tsx
/**
 * Database seed — idempotent sample data so the app renders without a live feed.
 *
 * Seeds:
 *   - `StockSymbol` universe (NSE_UNIVERSE in src/lib/constants.ts), upserted by
 *     the unique `symbol` column.
 *   - Synthetic OHLCV candles for every universe symbol at 1d (150 business
 *     days), plus intraday 5m bars for the most recent completed UTC session of
 *     the two most liquid names (RELIANCE, TCS). Candle values are a
 *     deterministic random walk (seeded per symbol) — re-running the seed
 *     reproduces identical prices, never random noise.
 *
 * Re-runs are safe: symbols upsert, candles use `skipDuplicates` on the
 * (symbol, timeframe, timestamp) unique key. Run with `pnpm db:seed` (which
 * shells out to `prisma db seed` → the command configured in prisma.config.ts).
 *
 * Trades and PatternSignals are deliberately NOT seeded — they are user/derived
 * artifacts; fake OPEN trades would trip the Phase 6 risk engine's daily limits.
 */

import { existsSync } from 'node:fs';
import { getPrisma } from '@/server/db';
import { NSE_UNIVERSE, type StockDefinition } from '@/lib/constants';

// Mirror prisma.config.ts: Prisma 7 no longer auto-loads `.env`, and this script
// may be invoked directly (`pnpm tsx prisma/seed.ts`) outside the Prisma CLI.
if (existsSync('.env')) process.loadEnvFile?.();

/** Most liquid names get intraday series (1m, 5m, 15m, 1h) as well as 1d. */
const INTRADAY_SYMBOLS = ['RELIANCE', 'TCS'] as const;
/** Business days of 1d candles to generate. */
const DAILY_COUNT = 150;

/** Timeframe configs for intraday generation. */
const INTRADAY_TIMEFRAMES: { tf: string; minutes: number }[] = [
  { tf: '1m', minutes: 1 }, // 09:15–15:30 = 375 minutes
  { tf: '5m', minutes: 5 }, // 75 five-minute bars
  { tf: '15m', minutes: 15 }, // 25 fifteen-minute bars
  { tf: '1h', minutes: 60 }, // 6 hourly bars
];

// ---------------------------------------------------------------------------
// Deterministic PRNG + OHLCV generator (same seed → same candles)
// ---------------------------------------------------------------------------

/** mulberry32 — tiny deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash → deterministic seed + baseline price from a symbol string. */
function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i) as number;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Last `count` business days (Mon–Fri), ascending, ending today (UTC). */
function lastBusinessDays(count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0, 0);
  while (days.length < count) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.unshift(new Date(cursor.getTime()));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days;
}

/** Session slots for a given minute interval of the most recent completed UTC business session (09:15+). */
function lastSessionSlots(minutes: number): Date[] {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - 1);
  day.setUTCHours(0, 0, 0, 0, 0);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) {
    day.setUTCDate(day.getUTCDate() - 1);
  }
  const sessionStart = day.getTime() + (9 * 60 + 15) * 60 * 1000;
  const slotMs = minutes * 60 * 1000;
  const slots = Math.floor(375 / minutes); // 375 minutes in session (09:15-15:30)
  return Array.from({ length: slots }, (_, i) => new Date(sessionStart + i * slotMs));
}

interface SeedCandle {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Deterministic random-walk candles for one (symbol, timeframe, slot list). */
function generateCandles(
  symbol: string,
  timeframe: string,
  slots: Date[],
  baseline: number
): SeedCandle[] {
  const rand = mulberry32(hashSymbol(`${symbol}:${timeframe}`));
  let price = baseline;
  const candles: SeedCandle[] = [];

  for (const timestamp of slots) {
    const open = price;
    // Slight upward drift so the chart isn't a flat line.
    const close = Math.max(5, price * (1 + (rand() - 0.47) * 0.025));
    const high = Math.max(open, close) * (1 + rand() * 0.01);
    const low = Math.min(open, close) * (1 - rand() * 0.01);
    const volume = Math.floor(50_000 + rand() * 950_000);

    candles.push({
      symbol,
      timeframe,
      timestamp,
      open: round4(open),
      high: round4(high),
      low: round4(low),
      close: round4(close),
      volume,
    });
    price = close;
  }
  return candles;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const prisma = getPrisma();

  // 1. Stock universe (idempotent upsert by unique symbol).
  for (const stock of NSE_UNIVERSE) {
    await prisma.stockSymbol.upsert({
      where: { symbol: stock.symbol },
      update: { name: stock.name, sector: stock.sector },
      create: { symbol: stock.symbol, name: stock.name, sector: stock.sector },
    });
  }

  // 2. Candles — 1d for every symbol, intraday (1m, 5m, 15m, 1h) for the liquid pair.
  const dailySlots = lastBusinessDays(DAILY_COUNT);
  const daily = NSE_UNIVERSE.map((stock: StockDefinition) =>
    generateCandles(stock.symbol, '1d', dailySlots, 120 + (hashSymbol(stock.symbol) % 1880))
  ).flat();

  const intraday = INTRADAY_SYMBOLS.flatMap((symbol) =>
    INTRADAY_TIMEFRAMES.flatMap(({ tf, minutes }) =>
      generateCandles(symbol, tf, lastSessionSlots(minutes), 120 + (hashSymbol(symbol) % 1880))
    )
  );

  const { count: insertedCandles } = await prisma.candle.createMany({
    data: [...daily, ...intraday],
    skipDuplicates: true,
  });

  const universe = await prisma.stockSymbol.count();
  const candles = await prisma.candle.count();
  console.log(
    `Seed complete — ${universe} symbols upserted, ${insertedCandles} candles inserted ` +
      `(${candles} total in DB; duplicates skipped).`
  );
}

main().catch((error) => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
