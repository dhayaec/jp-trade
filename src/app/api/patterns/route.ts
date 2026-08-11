import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { patternQuerySchema } from '@/server/validators';
import { serializeCandle } from '@/server/serializers';
import { CandlestickPatternEngine } from '@/features/candlestick/engine';

/**
 * GET /api/patterns — candlestick signals for the trailing window.
 *
 * Query params: `symbol` (required), `timeframe`, `limit` (how much history the
 * engine sees). Runs all 7 detectors on the fetched candles and returns signals
 * above the engine's confidence floor.
 */
export async function GET(request: NextRequest) {
  const parsed = patternQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { symbol, timeframe, limit } = parsed.data;

  try {
    const candles = await getPrisma().candle.findMany({
      where: { symbol, timeframe },
      orderBy: { timestamp: 'asc' },
      take: limit,
    });

    const engine = new CandlestickPatternEngine(candles.map(serializeCandle));
    const patterns = engine.analyzeAllPatterns();

    return NextResponse.json({ data: patterns });
  } catch (error) {
    console.error('Failed to analyze patterns:', error);
    return NextResponse.json({ error: 'Failed to analyze patterns' }, { status: 500 });
  }
}
