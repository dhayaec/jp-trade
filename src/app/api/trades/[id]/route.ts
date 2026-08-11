import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  closeTrade,
  updateTrade,
  TradeError,
  TradeNotFoundError,
  TradeLimitError,
} from '@/features/trading/actions';
import { tradeCloseSchema, tradeUpdateSchema } from '@/server/validators';
import { serializeTrade } from '@/server/serializers';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/trades/:id — update an open trade's risk fields or close it.
 *
 * With `exitPrice` in the body the trade is closed (P&L is computed
 * automatically). Without it, at least one of `stopLoss`, `takeProfit`, or
 * `notes` must be present. Closing a stop on a long always clamps it so the
 * position can never trail past breakeven.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Close request — `exitPrice` is the discriminator
  const closeParsed = tradeCloseSchema.safeParse(body);
  if (closeParsed.success) {
    try {
      // Spread the optional `status` only when present — exactOptionalPropertyTypes
      // forbids passing an explicit `undefined` to an optional field.
      const trade = await closeTrade(id, {
        exitPrice: closeParsed.data.exitPrice,
        ...(closeParsed.data.status ? { status: closeParsed.data.status } : {}),
      });
      return NextResponse.json({ data: serializeTrade(trade) });
    } catch (error) {
      return tradeErrorResponse(error, 'Failed to close trade');
    }
  }

  // Update request — at least one of stopLoss / takeProfit / notes
  const updateParsed = tradeUpdateSchema.safeParse(body);
  if (updateParsed.success) {
    try {
      const { stopLoss, takeProfit, notes } = updateParsed.data;
      const trade = await updateTrade(id, {
        ...(stopLoss !== undefined ? { stopLoss } : {}),
        ...(takeProfit !== undefined ? { takeProfit } : {}),
        ...(notes !== undefined ? { notes } : {}),
      });
      return NextResponse.json({ data: serializeTrade(trade) });
    } catch (error) {
      return tradeErrorResponse(error, 'Failed to update trade');
    }
  }

  return NextResponse.json(
    { error: `Invalid body: ${closeParsed.error.message}; ${updateParsed.error.message}` },
    { status: 400 }
  );
}

/** Map a `TradeError` to the appropriate HTTP status code. */
function tradeErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof TradeNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof TradeLimitError) {
    return NextResponse.json({ error: error.message, reason: error.reason }, { status: 409 });
  }
  if (error instanceof TradeError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(fallback + ':', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
