import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
 * POST /api/trades — log a paper/live trade.
 *
 * Body (JSON): `symbol`, `position`, `entry`, `stopLoss`, `takeProfit`,
 * `quantity`, `pattern`, `strategy`, optional `notes`. Returns the created trade
 * with status 201.
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

  const { symbol, position, entry, stopLoss, takeProfit, quantity, pattern, strategy, notes } =
    parsed.data;

  try {
    const trade = await getPrisma().trade.create({
      data: {
        symbol,
        position,
        entry,
        stopLoss,
        takeProfit,
        quantity,
        pattern,
        strategy,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ data: serializeTrade(trade) }, { status: 201 });
  } catch (error) {
    console.error('Failed to create trade:', error);
    return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
  }
}
