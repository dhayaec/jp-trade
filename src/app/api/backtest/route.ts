import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { patternQuerySchema } from '@/server/validators';
import { serializeCandle } from '@/server/serializers';
import { runBacktest, type BacktestStrategy, type BacktestTrade } from '@/features/backtest/engine';
import { calculateMetrics } from '@/features/backtest/metrics';
import { detectLiquiditySweep } from '@/features/strategies/liquidity-sweep';
import { detectFairValueGap } from '@/features/strategies/fair-value-gap';
import type { Candle } from '@/features/candlestick/types';

/**
 * GET /api/backtest — run historical backtest across the symbol universe.
 *
 * Query params:
 * - `timeframe` (default "5m")
 * - `limit` (default 2000 candles per symbol, max 5000)
 *
 * Returns backtest metrics per strategy, aggregated over all symbols.
 */
export async function GET(request: NextRequest) {
  const parsed = patternQuerySchema.shape.timeframe.safeParse(
    request.nextUrl.searchParams.get('timeframe') ?? '5m'
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
  }
  const timeframe = parsed.data;

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(Number(limitParam) || 2000, 5000) : 2000;

  try {
    const prisma = getPrisma();

    // Get active symbols
    const symbols = await prisma.stockSymbol.findMany({
      where: { isActive: true },
      select: { symbol: true },
    });

    // Fetch candles for all symbols (parallel)
    const candlesBySymbol: Record<string, readonly Candle[]> = {};

    await Promise.all(
      symbols.map(async ({ symbol }) => {
        const candles = await prisma.candle.findMany({
          where: { symbol, timeframe },
          orderBy: { timestamp: 'asc' },
          take: limit,
        });

        if (candles.length > 0) {
          candlesBySymbol[symbol] = candles.map(serializeCandle);
        }
      })
    );

    // Strategies to backtest
    const strategies: Array<{ name: string; detector: BacktestStrategy }> = [
      { name: 'LIQUIDITY_SWEEP', detector: detectLiquiditySweep },
      { name: 'FAIR_VALUE_GAP', detector: detectFairValueGap },
    ];

    const initialCapital = 100_000;

    // Run backtest per strategy, aggregating trades across all symbols.
    // Trades are merged chronologically so equity-curve figures (drawdown,
    // total P&L) reflect the whole universe, not per-symbol runs.
    const results = strategies.map(({ name, detector }) => {
      const allTrades: BacktestTrade[] = [];

      for (const candles of Object.values(candlesBySymbol)) {
        if (candles.length === 0) continue;

        const { trades } = runBacktest(candles, {
          strategy: detector,
          initialCapital,
        });
        allTrades.push(...trades);
      }

      allTrades.sort((a, b) => a.entryTimestamp - b.entryTimestamp);

      const metrics = calculateMetrics(allTrades, initialCapital);

      return {
        strategy: name,
        metrics,
        tradeCount: allTrades.length,
        trades: allTrades,
      };
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Failed to run backtest:', error);
    return NextResponse.json({ error: 'Failed to run backtest' }, { status: 500 });
  }
}
