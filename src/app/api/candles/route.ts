import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { candleQuerySchema } from '@/server/validators';
import { serializeCandle } from '@/server/serializers';

/**
 * GET /api/candles — paginated OHLCV history for a symbol/timeframe.
 *
 * Query params: `symbol` (required), `timeframe`, `limit`, `offset`.
 * Returns `{ data: Candle[] }` ordered newest-first.
 */
export async function GET(request: NextRequest) {
  const parsed = candleQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { symbol, timeframe, limit, offset } = parsed.data;

  try {
    // lightweight-charts requires ascending time order (oldest first).
    // Fetch newest-first then reverse so the chart receives the correct order.
    const candles = await getPrisma().candle.findMany({
      where: { symbol, timeframe },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({ data: candles.map(serializeCandle).reverse() });
  } catch (error) {
    console.error('Failed to fetch candles:', error);
    return NextResponse.json({ error: 'Failed to fetch candles' }, { status: 500 });
  }
}
