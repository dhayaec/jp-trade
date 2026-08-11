/**
 * Options shared by the Phase 2 strategy detectors.
 *
 * All fields are optional — each strategy documents its defaults and accepts
 * the config object as the second argument (e.g. `detectLiquiditySweep(candles,
 * { riskReward: 3 })`). Kept minimal: thresholds that are structural to the
 * pattern (wick ratios, gap conditions) are constants inside each module.
 */

export interface StrategyOptions {
  /**
   * Risk-reward multiple used to derive the take-profit from the stop
   * distance. Defaults to `2` (1:2 R:R).
   */
  riskReward?: number;
}

export interface LiquiditySweepOptions extends StrategyOptions {
  /**
   * Number of candles examined *before* the signal candle to establish the
   * recent swing extreme that liquidity sweeps through. Defaults to `8`.
   */
  lookback?: number;
}
