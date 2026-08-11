import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { setupQuerySchema } from '@/server/validators';
import { serializeCandle } from '@/server/serializers';
import type { TradingSetup } from '@/features/candlestick/types';
import { detectLiquiditySweep } from '@/features/strategies/liquidity-sweep';
import { detectFairValueGap } from '@/features/strategies/fair-value-gap';

/**
 * GET /api/setup — smart-money strategy setups for a symbol.
 *
 * Query params: `symbol` (required), `timeframe`. Fetches enough history for both
 * strategies (default lookbacks are ≤ 9 candles), runs each detector, and returns
 * every non-null `TradingSetup`.
 */
export async function GET(request: NextRequest) {
  const parsed = setupQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { symbol, timeframe } = parsed.data;

  try {
    const candles = await getPrisma().candle.findMany({
      where: { symbol, timeframe },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    const featureCandles = candles.map(serializeCandle);
    const setups: TradingSetup[] = [
      detectLiquiditySweep(featureCandles),
      detectFairValueGap(featureCandles),
    ].filter((s): s is TradingSetup => s !== null);

    return NextResponse.json({ data: setups });
  } catch (error) {
    console.error('Failed to detect setups:', error);
    return NextResponse.json({ error: 'Failed to detect setups' }, { status: 500 });
  }
}
