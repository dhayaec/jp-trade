import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { screenQuerySchema } from '@/server/validators';
import { serializeCandle } from '@/server/serializers';
import { screenStocks } from '@/features/screener/screener';
import type { Candle } from '@/features/candlestick/types';

/**
 * GET /api/screen — rank the active symbol universe by the screener.
 *
 * Query params: `timeframe`, `topN`, `minScore`, `orbPeriod`, `volumeLookback`.
 * Fetches the trailing window per active symbol (enough for ORB + volume
 * baseline + RSI), runs `screenStocks`, and returns the ranked candidates.
 */
export async function GET(request: NextRequest) {
  const parsed = screenQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { timeframe, topN, minScore, orbPeriod, volumeLookback } = parsed.data;

  try {
    const prisma = getPrisma();
    const symbols = await prisma.stockSymbol.findMany({
      where: { isActive: true },
      select: { symbol: true },
    });

    // The screener skips symbols below its own threshold; fetch exactly that
    // many candles so no symbol is starved of context.
    const minCandles = Math.max(orbPeriod + 1, volumeLookback + 1, 15);

    const entries = await Promise.all(
      symbols.map(async ({ symbol }) => {
        const rows = await prisma.candle.findMany({
          where: { symbol, timeframe },
          orderBy: { timestamp: 'asc' },
          take: minCandles,
        });
        return [symbol, rows.map(serializeCandle)] as const;
      })
    );

    const candlesBySymbol: Record<string, readonly Candle[]> = Object.fromEntries(entries);

    const candidates = screenStocks(candlesBySymbol, {
      topN,
      minScore,
      orbPeriod,
      volumeLookback,
    });

    return NextResponse.json({ data: candidates });
  } catch (error) {
    console.error('Failed to screen stocks:', error);
    return NextResponse.json({ error: 'Failed to screen stocks' }, { status: 500 });
  }
}
