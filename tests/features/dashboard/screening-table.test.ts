import { describe, expect, it } from 'vitest';
import { compareCandidates } from '@/features/dashboard/screening-table';
import type { ScreeningCandidate } from '@/features/screener/screener';

function candidate(overrides: Partial<ScreeningCandidate> = {}): ScreeningCandidate {
  return {
    symbol: 'TEST',
    score: 50,
    lastClose: 100,
    volumeRatio: 1.5,
    rsi: 55,
    patternCount: 1,
    isORB: false,
    patterns: [],
    ...overrides,
  };
}

describe('compareCandidates', () => {
  const a = candidate({ symbol: 'AA', score: 80, rsi: 60 });
  const b = candidate({ symbol: 'BB', score: 60, rsi: 50 });

  it('sorts symbols alphabetically ascending', () => {
    expect(compareCandidates(a, b, 'symbol', 'asc')).toBeLessThan(0);
    expect(compareCandidates(b, a, 'symbol', 'asc')).toBeGreaterThan(0);
  });

  it('sorts symbols alphabetically descending', () => {
    expect(compareCandidates(a, b, 'symbol', 'desc')).toBeGreaterThan(0);
    expect(compareCandidates(b, a, 'symbol', 'desc')).toBeLessThan(0);
  });

  it('sorts numeric fields ascending and descending', () => {
    expect(compareCandidates(a, b, 'score', 'asc')).toBeGreaterThan(0);
    expect(compareCandidates(a, b, 'score', 'desc')).toBeLessThan(0);

    expect(compareCandidates(a, b, 'rsi', 'asc')).toBeGreaterThan(0);
    expect(compareCandidates(a, b, 'rsi', 'desc')).toBeLessThan(0);
  });

  it('returns 0 for identical candidates', () => {
    const x = candidate({ score: 50 });
    expect(compareCandidates(x, { ...x }, 'score', 'asc')).toBe(0);
  });
});
