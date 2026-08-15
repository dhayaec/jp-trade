import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { signalHistoryQuerySchema } from '@/server/validators';
import { serializeCandle } from '@/server/serializers';
import { detectLiquiditySweep } from '@/features/strategies/liquidity-sweep';
import { detectFairValueGap } from '@/features/strategies/fair-value-gap';
import type { TradingSetup } from '@/features/candlestick/types';

/**
 * GET /api/signal-history — historical pattern and strategy signals.
 *
 * Query params:
 * - `timeframe` (default "5m")
 * - `hours` (default 24, max 168 = 1 week)
 * - `symbol` (optional, filter by symbol)
 * - `signal` (optional, "BUY" | "SELL" | "NEUTRAL")
 * - `pattern` (optional, pattern name filter)
 * - `strategy` (optional, strategy name filter)
 * - `limit` (default 100, max 500)
 *
 * Returns historical signals from the PatternSignal table plus computed
 * strategy signals over the historical candle window.
 */
export async function GET(request: NextRequest) {
  const parsed = signalHistoryQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { timeframe, hours, symbol, signal, pattern, strategy, limit } = parsed.data;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    const prisma = getPrisma();

    // Fetch historical pattern signals from DB
    const patternWhere: Record<string, unknown> = {
      timeframe,
      createdAt: { gte: since },
    };
    if (symbol) patternWhere['symbol'] = symbol;
    if (signal) patternWhere['signal'] = signal;
    if (pattern) patternWhere['pattern'] = pattern;

    const patternSignals = await prisma.patternSignal.findMany({
      where: patternWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        symbol: true,
        pattern: true,
        type: true,
        signal: true,
        confidence: true,
        entry: true,
        stopLoss: true,
        takeProfit: true,
        timeframe: true,
        timestamp: true,
        createdAt: true,
      },
    });

    // Fetch symbols for strategy signal computation
    const symbols = symbol
      ? [{ symbol }]
      : await prisma.stockSymbol.findMany({
          where: { isActive: true },
          select: { symbol: true },
        });

    // Compute historical strategy signals over the candle window
    const strategySignals: Array<TradingSetup & { symbol: string; computedAt: Date }> = [];

    for (const { symbol: sym } of symbols) {
      const candles = await prisma.candle.findMany({
        where: { symbol: sym, timeframe, timestamp: { gte: since } },
        orderBy: { timestamp: 'asc' },
        take: 200, // enough for strategy detection
      });

      if (candles.length < 5) continue;

      const featureCandles = candles.map(serializeCandle);

      const setups: TradingSetup[] = [
        detectLiquiditySweep(featureCandles),
        detectFairValueGap(featureCandles),
      ].filter((s): s is TradingSetup => s !== null);

      for (const setup of setups) {
        if (strategy && setup.strategy !== strategy) continue;
        if (signal && setup.signal !== signal) continue;
        strategySignals.push({
          ...setup,
          symbol: sym,
          computedAt: new Date(), // when this was computed
        });
      }
    }

    // Sort by computedAt descending (newest first)
    strategySignals.sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime());

    // Apply limit to strategy signals
    const limitedStrategySignals = strategySignals.slice(0, limit);

    return NextResponse.json({
      data: {
        patterns: patternSignals.map((p) => ({
          ...p,
          confidence: Number(p.confidence),
          entry: p.entry ? Number(p.entry) : undefined,
          stopLoss: p.stopLoss ? Number(p.stopLoss) : undefined,
          takeProfit: p.takeProfit ? Number(p.takeProfit) : undefined,
        })),
        strategies: limitedStrategySignals,
      },
    });
  } catch (error) {
    console.error('Failed to fetch signal history:', error);
    return NextResponse.json({ error: 'Failed to fetch signal history' }, { status: 500 });
  }
}
