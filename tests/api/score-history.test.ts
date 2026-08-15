import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * API route-handler tests for /api/score-history.
 * No database: `@/server/db` is mocked so each handler queries an in-memory fake Prisma client.
 * Covers input validation (400), the happy path (200/201), and Prisma call shapes.
 */

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

const mockPrisma = {
  scoreHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('@/server/db', () => ({
  getPrisma: () => mockPrisma,
}));

// Handlers import `getPrisma` lazily inside the request, so they resolve against
// the mocked module above. Imported here, after the mock is registered.
import { GET as scoreHistoryGET, POST as scoreHistoryPOST } from '@/app/api/score-history/route';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface DbScoreHistoryRow {
  timestamp: Date;
  score: number;
  confidence: number;
  breakdown: Record<string, number> | null;
}

function dbScoreHistory(
  timestamp: Date,
  score: number,
  confidence: number,
  breakdown?: Record<string, number>
): DbScoreHistoryRow {
  return { timestamp, score, confidence, breakdown: breakdown ?? null };
}

const SCORE_HISTORY_ROWS = [
  dbScoreHistory(new Date('2026-08-14T10:00:00Z'), 72, 85, {
    rsi: 15,
    volume: 20,
    pattern: 18,
    trend: 19,
  }),
  dbScoreHistory(new Date('2026-08-14T11:00:00Z'), 68, 82, {
    rsi: 14,
    volume: 18,
    pattern: 17,
    trend: 19,
  }),
];

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function jsonResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.scoreHistory.findMany.mockResolvedValue(SCORE_HISTORY_ROWS);
  mockPrisma.scoreHistory.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...data, id: 'score_hist_new' })
  );
});

// ---------------------------------------------------------------------------
// GET /api/score-history
// ---------------------------------------------------------------------------

describe('GET /api/score-history', () => {
  it('returns historical score snapshots ascending by time for a symbol/timeframe', async () => {
    const res = await scoreHistoryGET(
      makeRequest('http://localhost:3000/api/score-history?symbol=TCS&timeframe=5m&hours=24')
    );
    expect(res.status).toBe(200);

    const body = await jsonResponse(res);
    expect(body).toHaveProperty('data');
    expect(body.data).toEqual([
      {
        timestamp: '2026-08-14T10:00:00.000Z',
        score: 72,
        confidence: 85,
        breakdown: { rsi: 15, volume: 20, pattern: 18, trend: 19 },
      },
      {
        timestamp: '2026-08-14T11:00:00.000Z',
        score: 68,
        confidence: 82,
        breakdown: { rsi: 14, volume: 18, pattern: 17, trend: 19 },
      },
    ]);

    // Query passes through the validated params (defaults applied).
    expect(mockPrisma.scoreHistory.findMany).toHaveBeenCalledWith({
      where: {
        symbol: 'TCS',
        timeframe: '5m',
        timestamp: { gte: expect.any(Date) },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        score: true,
        confidence: true,
        breakdown: true,
      },
    });
  });

  it('uses default timeframe (5m) and hours (24) when not provided', async () => {
    const res = await scoreHistoryGET(
      makeRequest('http://localhost:3000/api/score-history?symbol=TCS')
    );
    expect(res.status).toBe(200);

    expect(mockPrisma.scoreHistory.findMany).toHaveBeenCalledWith({
      where: {
        symbol: 'TCS',
        timeframe: '5m',
        timestamp: { gte: expect.any(Date) },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        score: true,
        confidence: true,
        breakdown: true,
      },
    });
  });

  it('rejects a request without a symbol', async () => {
    const res = await scoreHistoryGET(makeRequest('http://localhost:3000/api/score-history'));
    expect(res.status).toBe(400);
    expect((await jsonResponse(res)).error).toContain('symbol');

    expect(mockPrisma.scoreHistory.findMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid timeframe', async () => {
    const res = await scoreHistoryGET(
      makeRequest('http://localhost:3000/api/score-history?symbol=TCS&timeframe=3h')
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.scoreHistory.findMany).not.toHaveBeenCalled();
  });

  it('rejects hours outside valid range (1-168)', async () => {
    const res = await scoreHistoryGET(
      makeRequest('http://localhost:3000/api/score-history?symbol=TCS&hours=0')
    );
    expect(res.status).toBe(400);

    const res2 = await scoreHistoryGET(
      makeRequest('http://localhost:3000/api/score-history?symbol=TCS&hours=169')
    );
    expect(res2.status).toBe(400);

    expect(mockPrisma.scoreHistory.findMany).not.toHaveBeenCalled();
  });

  it('returns empty array when no score history exists', async () => {
    mockPrisma.scoreHistory.findMany.mockResolvedValue([]);
    const res = await scoreHistoryGET(
      makeRequest('http://localhost:3000/api/score-history?symbol=TCS')
    );
    expect(res.status).toBe(200);
    expect((await jsonResponse(res)).data).toEqual([]);
  });

  it('returns a 500 when the database query fails', async () => {
    mockPrisma.scoreHistory.findMany.mockRejectedValue(new Error('connection refused'));
    const res = await scoreHistoryGET(
      makeRequest('http://localhost:3000/api/score-history?symbol=TCS')
    );
    expect(res.status).toBe(500);
    expect((await jsonResponse(res)).error).toContain('Failed to fetch score history');
  });
});

// ---------------------------------------------------------------------------
// POST /api/score-history
// ---------------------------------------------------------------------------

describe('POST /api/score-history', () => {
  it('creates a score history entry and returns 201', async () => {
    const res = await scoreHistoryPOST(
      makeRequest('http://localhost:3000/api/score-history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: 'TCS',
          timeframe: '5m',
          score: 72.5,
          confidence: 85.3,
          breakdown: { rsi: 15, volume: 20, pattern: 18, trend: 19 },
        }),
      })
    );
    expect(res.status).toBe(200);

    const body = await jsonResponse(res);
    expect(body).toEqual({ ok: true });

    // Verify Prisma create called with rounded score/confidence
    expect(mockPrisma.scoreHistory.create).toHaveBeenCalledWith({
      data: {
        symbol: 'TCS',
        timeframe: '5m',
        score: 73, // Math.round(72.5)
        confidence: 85, // Math.round(85.3)
        breakdown: { rsi: 15, volume: 20, pattern: 18, trend: 19 },
      },
    });
  });

  it('creates entry without breakdown when omitted', async () => {
    const res = await scoreHistoryPOST(
      makeRequest('http://localhost:3000/api/score-history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: 'TCS',
          timeframe: '1d',
          score: 65,
          confidence: 78,
        }),
      })
    );
    expect(res.status).toBe(200);

    expect(mockPrisma.scoreHistory.create).toHaveBeenCalledWith({
      data: {
        symbol: 'TCS',
        timeframe: '1d',
        score: 65,
        confidence: 78,
        breakdown: undefined,
      },
    });
  });

  it('rejects a body missing required fields', async () => {
    const res = await scoreHistoryPOST(
      makeRequest('http://localhost:3000/api/score-history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol: 'TCS', timeframe: '5m' }),
      })
    );
    expect(res.status).toBe(400);
    expect((await jsonResponse(res)).error).toContain('Invalid payload');
    expect(mockPrisma.scoreHistory.create).not.toHaveBeenCalled();
  });

  it('returns 500 for malformed JSON (caught by outer try/catch)', async () => {
    const res = await scoreHistoryPOST(
      makeRequest('http://localhost:3000/api/score-history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      })
    );
    expect(res.status).toBe(500);
    expect((await jsonResponse(res)).error).toContain('Failed to record score history');
  });

  it('returns a 500 when the database insert fails', async () => {
    mockPrisma.scoreHistory.create.mockRejectedValue(new Error('connection refused'));
    const res = await scoreHistoryPOST(
      makeRequest('http://localhost:3000/api/score-history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: 'TCS',
          timeframe: '5m',
          score: 72,
          confidence: 85,
        }),
      })
    );
    expect(res.status).toBe(500);
    expect((await jsonResponse(res)).error).toContain('Failed to record score history');
  });
});
