import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/server/db';

/**
 * GET /api/symbols/search?q=RELI — autocomplete for the watchlist add form.
 *
 * Returns up to `limit` active symbols whose ticker or name contains the query
 * (case-insensitive). No query returns the most-recently-added active symbols.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(Number(limitParam) || 10, 50) : 10;

  try {
    const prisma = getPrisma();

    const where = query
      ? {
          isActive: true,
          OR: [
            { symbol: { contains: query.toUpperCase() } },
            { name: { contains: query.toUpperCase() } },
          ],
        }
      : { isActive: true };

    const rows = await prisma.stockSymbol.findMany({
      where,
      orderBy: { symbol: 'asc' },
      take: limit,
      select: { symbol: true, name: true },
    });

    return NextResponse.json({
      data: rows.map((r) => `${r.symbol} · ${r.name}`),
    });
  } catch (error) {
    console.error('Failed to search symbols:', error);
    return NextResponse.json({ error: 'Failed to search symbols' }, { status: 500 });
  }
}
