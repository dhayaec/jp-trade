import { describe, expect, it } from 'vitest';
import type { PositionSide } from '@/features/trading/risk';
import {
  calculatePnl,
  calculatePositionSize,
  calculateRewardRisk,
  canOpenTrade,
  clampTrailingStop,
  DEFAULT_RISK_CONFIG,
  isDailyLossLimitHit,
  isStopOnCorrectSide,
  startOfIstDay,
} from '@/features/trading/risk';

// ---------------------------------------------------------------------------
// calculatePositionSize
// ---------------------------------------------------------------------------

describe('calculatePositionSize', () => {
  it('sizes a LONG position at 1% risk', () => {
    const size = calculatePositionSize({
      side: 'LONG',
      accountEquity: 100_000,
      entryPrice: 100,
      stopLoss: 95,
    });

    expect(size.riskAmount).toBe(1_000); // 100_000 × 0.01
    expect(size.riskPerUnit).toBe(5); // |100 − 95|
    expect(size.quantity).toBe(200); // floor(1000 / 5)
    expect(size.notional).toBe(20_000); // 200 × 100
  });

  it('sizes a SHORT position symmetrically', () => {
    const size = calculatePositionSize({
      side: 'SHORT',
      accountEquity: 100_000,
      entryPrice: 100,
      stopLoss: 105,
    });

    expect(size.quantity).toBe(200);
    expect(size.riskPerUnit).toBe(5);
  });

  it('floors the quantity so risk never exceeds the cap', () => {
    const size = calculatePositionSize({
      side: 'LONG',
      accountEquity: 1_000,
      entryPrice: 100,
      stopLoss: 99.3,
    });

    // riskAmount = 10, riskPerUnit = 0.7, floor(10 / 0.7) = 14
    expect(size.quantity).toBe(14);
    expect(size.notional).toBe(14 * 100);
  });

  it('respects a custom riskPerTradePct', () => {
    const size = calculatePositionSize({
      side: 'LONG',
      accountEquity: 100_000,
      entryPrice: 100,
      stopLoss: 95,
      riskPerTradePct: 0.02,
    });

    expect(size.riskAmount).toBe(2_000);
    expect(size.quantity).toBe(400);
  });

  it('throws on an inverted LONG stop (stop above entry)', () => {
    expect(() =>
      calculatePositionSize({
        side: 'LONG',
        accountEquity: 100_000,
        entryPrice: 100,
        stopLoss: 105,
      })
    ).toThrow(RangeError);
  });

  it('throws on an inverted SHORT stop (stop below entry)', () => {
    expect(() =>
      calculatePositionSize({
        side: 'SHORT',
        accountEquity: 100_000,
        entryPrice: 100,
        stopLoss: 95,
      })
    ).toThrow(RangeError);
  });

  it('throws when accountEquity is non-positive', () => {
    expect(() =>
      calculatePositionSize({ side: 'LONG', accountEquity: 0, entryPrice: 100, stopLoss: 95 })
    ).toThrow(RangeError);
    expect(() =>
      calculatePositionSize({ side: 'LONG', accountEquity: -100, entryPrice: 100, stopLoss: 95 })
    ).toThrow(RangeError);
  });

  it('throws when riskPerTradePct is out of range', () => {
    const base = {
      side: 'LONG' as PositionSide,
      accountEquity: 100_000,
      entryPrice: 100,
      stopLoss: 95,
    };
    expect(() => calculatePositionSize({ ...base, riskPerTradePct: 0 })).toThrow(RangeError);
    expect(() => calculatePositionSize({ ...base, riskPerTradePct: 1.1 })).toThrow(RangeError);
  });

  it('throws when a single share exceeds the risk budget', () => {
    // equity 100, 1% → riskAmount 1, stop distance 5 → quantity 0
    expect(() =>
      calculatePositionSize({ side: 'LONG', accountEquity: 100, entryPrice: 100, stopLoss: 95 })
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// canOpenTrade
// ---------------------------------------------------------------------------

describe('canOpenTrade', () => {
  const base = { accountEquity: 100_000 };

  it('allows when under both limits', () => {
    expect(canOpenTrade({ ...base, activeTrades: 0, dailyPnl: 0 })).toEqual({ allowed: true });
  });

  it('blocks when activeTrades reaches the max (default 3)', () => {
    expect(canOpenTrade({ ...base, activeTrades: 3, dailyPnl: 0 })).toEqual({
      allowed: false,
      reason: 'MAX_ACTIVE_TRADES',
    });
    expect(canOpenTrade({ ...base, activeTrades: 2, dailyPnl: 0 }).allowed).toBe(true);
  });

  it('blocks when daily loss hits the halt threshold', () => {
    // 2% of 100_000 = 2 000
    expect(canOpenTrade({ ...base, activeTrades: 0, dailyPnl: -2_000 })).toEqual({
      allowed: false,
      reason: 'DAILY_LOSS_LIMIT',
    });
    expect(canOpenTrade({ ...base, activeTrades: 0, dailyPnl: -1_999 }).allowed).toBe(true);
  });

  it('respects a custom maxDailyLossPct (5%)', () => {
    expect(
      canOpenTrade({ ...base, activeTrades: 0, dailyPnl: -2_000, maxDailyLossPct: 0.05 }).allowed
    ).toBe(true);
    expect(
      canOpenTrade({ ...base, activeTrades: 0, dailyPnl: -5_000, maxDailyLossPct: 0.05 })
    ).toEqual({ allowed: false, reason: 'DAILY_LOSS_LIMIT' });
  });

  it('respects a custom maxActiveTrades (1)', () => {
    expect(canOpenTrade({ ...base, activeTrades: 1, dailyPnl: 0, maxActiveTrades: 1 })).toEqual({
      allowed: false,
      reason: 'MAX_ACTIVE_TRADES',
    });
  });
});

// ---------------------------------------------------------------------------
// isDailyLossLimitHit
// ---------------------------------------------------------------------------

describe('isDailyLossLimitHit', () => {
  it('returns true at the exact threshold', () => {
    expect(isDailyLossLimitHit(-2_000, 100_000, 0.02)).toBe(true);
  });

  it('returns false just above the threshold', () => {
    expect(isDailyLossLimitHit(-1_999, 100_000, 0.02)).toBe(false);
  });

  it('returns false for a positive P&L', () => {
    expect(isDailyLossLimitHit(500, 100_000, 0.02)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clampTrailingStop
// ---------------------------------------------------------------------------

describe('clampTrailingStop', () => {
  describe('LONG', () => {
    it('clamps a sub-entry stop up to breakeven', () => {
      expect(clampTrailingStop('LONG', 100, 95)).toBe(100);
    });

    it('passes through a tightened stop at or above breakeven', () => {
      expect(clampTrailingStop('LONG', 100, 100)).toBe(100);
      expect(clampTrailingStop('LONG', 100, 103)).toBe(103);
    });
  });

  describe('SHORT', () => {
    it('clamps a stop above entry down to breakeven', () => {
      expect(clampTrailingStop('SHORT', 100, 105)).toBe(100);
    });

    it('passes through a tightened stop at or below breakeven', () => {
      expect(clampTrailingStop('SHORT', 100, 100)).toBe(100);
      expect(clampTrailingStop('SHORT', 100, 97)).toBe(97);
    });
  });
});

// ---------------------------------------------------------------------------
// isStopOnCorrectSide
// ---------------------------------------------------------------------------

describe('isStopOnCorrectSide', () => {
  it('LONG: below entry is correct, equal or above is wrong', () => {
    expect(isStopOnCorrectSide('LONG', 100, 95)).toBe(true);
    expect(isStopOnCorrectSide('LONG', 100, 100)).toBe(false);
    expect(isStopOnCorrectSide('LONG', 100, 105)).toBe(false);
  });

  it('SHORT: above entry is correct, equal or below is wrong', () => {
    expect(isStopOnCorrectSide('SHORT', 100, 105)).toBe(true);
    expect(isStopOnCorrectSide('SHORT', 100, 100)).toBe(false);
    expect(isStopOnCorrectSide('SHORT', 100, 95)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculatePnl
// ---------------------------------------------------------------------------

describe('calculatePnl', () => {
  it('LONG profit', () => {
    expect(calculatePnl('LONG', 10, 100, 110)).toBe(100);
  });

  it('LONG loss', () => {
    expect(calculatePnl('LONG', 10, 100, 90)).toBe(-100);
  });

  it('SHORT profit', () => {
    expect(calculatePnl('SHORT', 10, 100, 90)).toBe(100);
  });

  it('SHORT loss', () => {
    expect(calculatePnl('SHORT', 10, 100, 110)).toBe(-100);
  });

  it('zero when exit equals entry', () => {
    expect(calculatePnl('LONG', 10, 100, 100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateRewardRisk
// ---------------------------------------------------------------------------

describe('calculateRewardRisk', () => {
  it('returns the reward:risk ratio for a 2:1 setup', () => {
    expect(calculateRewardRisk(100, 95, 110)).toBe(2);
  });

  it('returns 0 when stop is at breakeven (no risk denominator)', () => {
    expect(calculateRewardRisk(100, 100, 110)).toBe(0);
  });

  it('works for SHORT setups (direction-agnostic)', () => {
    // entry 100, stop 105 (risk 5), target 90 (reward 10)
    expect(calculateRewardRisk(100, 105, 90)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// startOfIstDay
// ---------------------------------------------------------------------------

describe('startOfIstDay', () => {
  it('returns 18:30 UTC the previous day when it is after midnight IST', () => {
    // 2026-08-11T20:00Z → 2026-08-12 01:30 IST → IST date Aug 12
    // dayStart = Date.UTC(2026,7,12) − 5.5h = 2026-08-11T18:30Z
    const now = new Date('2026-08-11T20:00:00Z');
    expect(startOfIstDay(now)).toEqual(new Date('2026-08-11T18:30:00Z'));
  });

  it('returns the previous calendar day UTC when before 18:30 UTC', () => {
    // 2026-08-11T16:00Z → 2026-08-11 21:30 IST → IST date Aug 11
    // dayStart = Date.UTC(2026,7,11) − 5.5h = 2026-08-10T18:30Z
    const now = new Date('2026-08-11T16:00:00Z');
    expect(startOfIstDay(now)).toEqual(new Date('2026-08-10T18:30:00Z'));
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_RISK_CONFIG
// ---------------------------------------------------------------------------

describe('DEFAULT_RISK_CONFIG', () => {
  it('matches the RISK_DEFAULTS constants', () => {
    expect(DEFAULT_RISK_CONFIG.riskPerTradePct).toBe(0.01);
    expect(DEFAULT_RISK_CONFIG.maxActiveTrades).toBe(3);
    expect(DEFAULT_RISK_CONFIG.maxDailyLossPct).toBe(0.02);
  });
});
