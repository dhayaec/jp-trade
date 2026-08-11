import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { openTrade, TradeError, TradeLimitError } from '@/features/trading/actions';
import { getPrisma } from '@/server/db';
import { tradeQuerySchema, tradeCreateSchema } from '@/server/validators';
import { serializeTrade } from '@/server/serializers';

/**
 * GET /api/trades — list logged trades, newest first.
 *
 * Query params: `symbol`, `status`, `limit`. Defaults to open trades only.
 */
export async function GET(request: NextRequest) {
  const parsed = tradeQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { symbol, status, limit } = parsed.data;

  try {
    const trades = await getPrisma().trade.findMany({
      where: { ...(symbol ? { symbol } : {}), status },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: trades.map(serializeTrade) });
  } catch (error) {
    console.error('Failed to fetch trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}

/**
 * POST /api/trades — log a paper/live trade with risk enforcement.
 *
 * Body (JSON): `symbol`, `position`, `entry`, `stopLoss`, `takeProfit`,
 * `quantity`, `pattern`, `strategy`, `accountEquity`, optional `notes`.
 * Enforces max active trades, daily-loss halt, and the 1% risk cap.
 * Returns the created trade with status 201.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = tradeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // `notes` is optional; spread it only when present so the draft satisfies
  // `exactOptionalPropertyTypes` (no explicit `undefined` on an optional field).
  const { accountEquity, notes, ...tradeDraft } = parsed.data;

  try {
    const trade = await openTrade(
      { ...tradeDraft, ...(notes !== undefined ? { notes } : {}) },
      { accountEquity }
    );
    return NextResponse.json({ data: serializeTrade(trade) }, { status: 201 });
  } catch (error) {
    if (error instanceof TradeLimitError) {
      return NextResponse.json({ error: error.message, reason: error.reason }, { status: 409 });
    }
    if (error instanceof TradeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to create trade:', error);
    return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
  }
}
