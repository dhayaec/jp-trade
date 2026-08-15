import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { patternQuerySchema } from '@/server/validators';
import { serializeCandle } from '@/server/serializers';
import { CandlestickPatternEngine } from '@/features/candlestick/engine';
import type { TradingSetup } from '@/features/candlestick/types';
import { detectLiquiditySweep } from '@/features/strategies/liquidity-sweep';
import { detectFairValueGap } from '@/features/strategies/fair-value-gap';

/**
 * GET /api/signals — aggregate all current pattern/strategy signals across the
 * active symbol universe for the given timeframe.
 *
 * Query params: `timeframe` (default "5m"), `limit` (default 50 candles per symbol).
 * Returns `{ patterns: PatternSignal[], setups: TradingSetup[] }`.
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
  const limit = limitParam ? Math.min(Number(limitParam) || 50, 200) : 50;

  try {
    const prisma = getPrisma();

    // Get active symbols
    const symbols = await prisma.stockSymbol.findMany({
      where: { isActive: true },
      select: { symbol: true },
    });

    // Fetch candles and analyze for each symbol (parallel)
    const results = await Promise.all(
      symbols.map(async ({ symbol }) => {
        const candles = await prisma.candle.findMany({
          where: { symbol, timeframe },
          orderBy: { timestamp: 'asc' },
          take: limit,
        });

        if (candles.length === 0) return { symbol, patterns: [], setups: [] };

        const featureCandles = candles.map(serializeCandle);

        // Pattern signals
        const engine = new CandlestickPatternEngine(featureCandles);
        const patterns = engine.analyzeAllPatterns();

        // Strategy setups
        const setups: TradingSetup[] = [
          detectLiquiditySweep(featureCandles),
          detectFairValueGap(featureCandles),
        ].filter((s): s is TradingSetup => s !== null);

        return { symbol, patterns, setups };
      })
    );

    // Flatten all signals with symbol attached
    const allPatterns = results.flatMap(({ symbol, patterns }) =>
      patterns.map((p) => ({ ...p, symbol }))
    );
    const allSetups = results.flatMap(({ symbol, setups }) =>
      setups.map((s) => ({ ...s, symbol }))
    );

    return NextResponse.json({ data: { patterns: allPatterns, setups: allSetups } });
  } catch (error) {
    console.error('Failed to fetch signals:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
