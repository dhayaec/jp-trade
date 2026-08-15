import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';
import { scoreHistoryQuerySchema } from '@/server/validators';

/**
 * GET /api/score-history — return historical score snapshots for a symbol/timeframe.
 *
 * Query params: `symbol`, `timeframe`, `hours` (optional, default 24)
 * Returns array of { timestamp, score, confidence, breakdown? } sorted ascending by time.
 */
export async function GET(request: NextRequest) {
  const parsed = scoreHistoryQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { symbol, timeframe, hours = 24 } = parsed.data;

  try {
    const prisma = getPrisma();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const history = await prisma.scoreHistory.findMany({
      where: {
        symbol,
        timeframe,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        score: true,
        confidence: true,
        breakdown: true,
      },
    });

    return NextResponse.json({ data: history });
  } catch (error) {
    console.error('Failed to fetch score history:', error);
    return NextResponse.json({ error: 'Failed to fetch score history' }, { status: 500 });
  }
}

/**
 * POST /api/score-history — record a score snapshot (called by screening job).
 *
 * Body: { symbol, timeframe, score, confidence, breakdown? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, timeframe, score, confidence, breakdown } = body;

    if (!symbol || !timeframe || typeof score !== 'number' || typeof confidence !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const prisma = getPrisma();
    await prisma.scoreHistory.create({
      data: {
        symbol,
        timeframe,
        score: Math.round(score),
        confidence: Math.round(confidence),
        breakdown: breakdown ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to record score history:', error);
    return NextResponse.json({ error: 'Failed to record score history' }, { status: 500 });
  }
}
