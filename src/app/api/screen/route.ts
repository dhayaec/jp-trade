import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { getPrisma } from '@/server/db';
import { screenQuerySchema } from '@/server/validators';
import { serializeCandle } from '@/server/serializers';
import { screenStocks, type ScreeningCandidate } from '@/features/screener/screener';
import type { Candle } from '@/features/candlestick/types';

/**
 * Determine which component drove the score change.
 */
function getChangeReason(
  lastBreakdown: { volume: number; rsi: number; pattern: number; orb: number } | null,
  currentBreakdown: { volume: number; rsi: number; pattern: number; orb: number } | undefined
): string {
  if (!lastBreakdown || !currentBreakdown) return 'NEW';

  const deltas = {
    VOLUME: currentBreakdown.volume - lastBreakdown.volume,
    RSI: currentBreakdown.rsi - lastBreakdown.rsi,
    PATTERN: currentBreakdown.pattern - lastBreakdown.pattern,
    ORB: currentBreakdown.orb - lastBreakdown.orb,
  };

  const maxDelta = Math.max(...Object.values(deltas));
  if (maxDelta <= 0) return 'STABLE';

  const reasons = Object.entries(deltas)
    .filter(([, v]) => v === maxDelta)
    .map(([k]) => k);

  return reasons.length === 1 ? (reasons[0] ?? 'MULTIPLE') : 'MULTIPLE';
}

/**
 * Persist score snapshots for each candidate so the detail page can draw a
 * score-history sparkline. Fire-and-forget (failure is logged, never thrown):
 * a hiccup recording history must not fail the screening response.
 */
async function recordScoreHistory(
  prisma: PrismaClient,
  candidates: readonly ScreeningCandidate[],
  timeframe: string
): Promise<void> {
  try {
    // Deduplicate: only record a snapshot when the score moved at least a few
    // points from the most recent one — avoids noise from sub-threshold jitter.
    const now = new Date();
    for (const candidate of candidates) {
      const last = await prisma.scoreHistory.findFirst({
        where: { symbol: candidate.symbol, timeframe },
        orderBy: { timestamp: 'desc' },
        select: { score: true, breakdown: true },
      });

      if (last && Math.abs(last.score - candidate.score) < 3) {
        continue; // no meaningful change — skip
      }

      const scoreDelta = last ? candidate.score - last.score : null;
      const changeReason = getChangeReason(last?.breakdown as never, candidate.breakdown);

      await prisma.scoreHistory.create({
        data: {
          symbol: candidate.symbol,
          timeframe,
          score: candidate.score,
          confidence: candidate.confidence,
          breakdown: (candidate.breakdown as never) ?? undefined,
          changeReason,
          scoreDelta,
          timestamp: now,
        },
      });
    }
  } catch (error) {
    console.error('Failed to record score history:', error);
  }
}

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

  const {
    timeframe,
    topN,
    minScore,
    orbPeriod,
    volumeLookback,
    universe,
    sector,
    minPrice,
    maxPrice,
    minVolumeRatio,
    minRsi,
    maxRsi,
    patterns,
    strategies,
  } = parsed.data;

  try {
    const prisma = getPrisma();

    // Build symbol filter based on universe
    const where: { isActive: true; sector?: string } = { isActive: true };
    if (universe === 'SECTOR' && sector) {
      where.sector = sector;
    }
    // For NSE500, NIFTY50, NIFTY_NEXT50 - would need additional metadata on StockSymbol
    // For now, ALL covers all active symbols

    const symbols = await prisma.stockSymbol.findMany({
      where,
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
      minVolumeRatio,
      minRsi,
      maxRsi,
      patterns: patterns ? patterns.split(',') : [],
      strategies: strategies ? strategies.split(',') : [],
      minPrice,
      maxPrice,
    });

    // Record score snapshots (deduplicated) so the detail page can draw a
    // sparkline. Fire-and-forget: recording failure must not fail the response.
    void recordScoreHistory(prisma, candidates, timeframe);

    return NextResponse.json({ data: candidates });
  } catch (error) {
    console.error('Failed to screen stocks:', error);
    return NextResponse.json({ error: 'Failed to screen stocks' }, { status: 500 });
  }
}
