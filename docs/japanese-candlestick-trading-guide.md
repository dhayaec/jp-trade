# Japanese Candlestick Trading Guide — jp-trade

> A comprehensive guide for using **jp-trade** as a financial advisor to select
> stocks for trade using Japanese candlestick patterns and Smart Money Concepts
> (SMC).

---

## 📚 Overview

**jp-trade** is a production-grade NSE intraday trading platform built on
Next.js 16 + React 19 + Prisma 7 that combines:

| Component                      | Purpose                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| **Candlestick Pattern Engine** | Detects 7 classical Japanese patterns                            |
| **Smart Money Strategies**     | 2 institutional-grade SMC strategies                             |
| **Stock Screener**             | Ranks 50 NSE large-caps by composite score                       |
| **Backtesting Engine**         | Validates strategies on historical data                          |
| **Risk Management**            | Enforces 1% risk/trade, max 3 trades/day, 2% daily loss halt     |
| **Dashboard**                  | Real-time charts, pattern cards, strategy setups, screener table |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL + Redis (for live data)
docker-compose up -d

# 3. Apply database migrations
pnpm db:migrate

# 4. Seed NSE universe
pnpm db:seed

# 5. Start dev server
pnpm dev
```

Open **http://localhost:3000** → redirects to `/dashboard`

---

## 🎯 Daily Trading Workflow

### Step 1: Run the Screener — Find Actionable Stocks

- Navigate to the dashboard
- The **Top Screeners** table auto-loads top 10 NSE stocks ranked by composite
  score (0–100):

| Component                  | Weight | Logic                                 |
| -------------------------- | ------ | ------------------------------------- |
| **Volume Ratio**           | 30%    | Unusual volume vs 20-candle baseline  |
| **RSI Sweet Spot**         | 30%    | RSI 50–65 = 100; <30 or >80 = 0       |
| **Pattern Confluence**     | 20%    | # of confident patterns (capped at 3) |
| **Opening Range Breakout** | 20%    | Close pierces first 5-candle range    |

- **Filter**: Only stocks scoring ≥60 appear
- **Action**: Pick the highest-scored symbol — it has volume, momentum, pattern
  confirmation, and breakout

### Step 2: Analyze Patterns on Your Chosen Symbol

- Select symbol from dropdown (defaults to TCS)
- Choose timeframe: **1m, 5m, 15m, 1h, 1d**
- The **Patterns** panel shows all 7 detectors:

| Pattern         | Confidence | Signal           | Description                        |
| --------------- | ---------- | ---------------- | ---------------------------------- |
| **MARUBOZU**    | 75%        | BUY/SELL         | Strong conviction, no wicks        |
| **TONKACHI**    | 80%        | BUY              | Hammer reversal at bottom          |
| **NAGAREBOSHI** | 80%        | SELL             | Shooting star at top               |
| **TSUTSUMI**    | 80%        | BUY/SELL         | Engulfing reversal                 |
| **HARAMI**      | 60%        | NEUTRAL          | Consolidation/continuation         |
| **DOJI**        | 50%        | BUY/SELL/NEUTRAL | Indecision, RSI-contextual         |
| **SAKATA_FIVE** | 85%        | BUY              | Classical 5-candle bottom reversal |

- Each card shows: **Entry, Stop-Loss, Take-Profit, Confidence bar,
  Description**

### Step 3: Validate with Smart Money Strategies

The **Smart Money Setups** panel runs two institutional-grade strategies:

#### 1. Liquidity Sweep (SanSen + Tsutsumi + Sweep)

- **SanSen**: 3 consecutive candles in one direction with advancing closes
- **Liquidity Sweep**: Price spikes through recent swing extreme (stop hunt) and
  closes back beyond it
- **Tsutsumi**: Sweep candle is an engulfing reversal confirming direction
  change
- **Output**: Complete trade setup (entry, stop, target, 2:1 R:R, 80%
  confidence)

#### 2. Fair Value Gap (Sanpei Age + Tonkachi + FVG)

- **Tonkachi/Nagareboshi**: Reversal candle at extreme
- **Sanpei Age/Sage**: 3 parallel advancing/declining lines
- **FVG**: Imbalance between 1st and 3rd candle (gap never traded)
- **Output**: Complete trade setup (entry, stop, target, 2:1 R:R, 80%
  confidence)

### Step 4: Backtest Before Committing

```typescript
import { runBacktest } from '@/features/backtest/engine';
import { detectLiquiditySweep } from '@/features/strategies/liquidity-sweep';

const result = runBacktest(historicalCandles, {
  strategy: detectLiquiditySweep,
  initialCapital: 1_000_000, // ₹10L
  riskPerTradePct: 0.01,
});
```

**Metrics returned**: Win rate, profit factor, max drawdown, Sharpe ratio

**Minimum thresholds for live trading**:

- Win rate > 55%
- Profit factor > 1.5
- Tested on 1+ year of data

### Step 5: Execute with Risk Management

The risk engine (`src/features/trading/risk.ts`) enforces:

| Rule                  | Value                                    |
| --------------------- | ---------------------------------------- |
| Max risk per trade    | 1% of capital                            |
| Max active trades/day | 3                                        |
| Daily loss halt       | 2% (stops new entries)                   |
| Min risk:reward       | 2:1                                      |
| Stop type             | Hard stops (never trail below breakeven) |

**Position size formula**:

```
Quantity = (Account Equity × 1%) ÷ |Entry − Stop|
```

Log trades via `POST /api/trades` (paper or live)

---

## 📅 Recommended Daily Schedule (IST)

| Time            | Action                                                              |
| --------------- | ------------------------------------------------------------------- |
| **09:00–09:15** | Pre-market: Run screener on 15m/1h; note top 5 candidates           |
| **09:15–09:30** | Opening range forms: Watch for ORB on candidates                    |
| **09:30–11:00** | Monitor patterns + SMC setups on 5m/15m; enter on confirmed signals |
| **11:00–13:00** | Lower volatility — manage existing positions, update stops          |
| **13:00–15:00** | Afternoon momentum — screen again on 15m for late entries           |
| **15:30**       | Close all intraday positions; log trades; review P&L                |

---

## 🔧 API Endpoints for Integration

| Endpoint                                                   | Use Case                  |
| ---------------------------------------------------------- | ------------------------- |
| `GET /api/candles?symbol=RELIANCE&timeframe=5m&limit=100`  | Fetch OHLCV for charting  |
| `GET /api/patterns?symbol=RELIANCE&timeframe=5m&limit=100` | Get all 7 pattern signals |
| `GET /api/setup?symbol=RELIANCE&timeframe=5m&limit=100`    | Get SMC strategy setups   |
| `GET /api/screen?timeframe=15m&topN=10&minScore=60`        | Run universe screener     |
| `POST /api/trades`                                         | Log a trade (paper/live)  |
| `GET /api/trades`                                          | Trade history with P&L    |

---

## ⚠️ Important Caveats (Financial Advisor Disclaimer)

1. **Backtest first** — The engine has unit tests but **you must validate on
   your data** before risking capital
2. **Data quality** — Bad ticks = false patterns; the app validates OHLCV
   invariants but you need clean data feed
3. **Paper trade for 30 days minimum** — Use the trade logging with paper
   positions
4. **NSE market hours only** — 09:15–15:30 IST; patterns outside hours are noise
5. **Liquidity** — Stick to the NSE_UNIVERSE (large-caps); mid/small-caps have
   wider spreads
6. **Risk limits are hard-coded** — 1%/trade, 3/day, 2% daily halt — do not
   override without quantitative justification

---

## 🏗️ Architecture Deep Dive

### Pattern Engine (`src/features/candlestick/engine.ts`)

- `CandlestickPatternEngine` class — pure functions, no side effects
- `analyzeAllPatterns()` → runs all 7 detectors, filters by
  `MIN_SIGNAL_CONFIDENCE = 0.6`
- `getMarketContext()` → trend, momentum, support/resistance, RSI from trailing
  20 candles

### Strategies (`src/features/strategies/`)

- **Pure functions** — no DB, no engine dependency
- `detectLiquiditySweep(candles, options?)` → `TradingSetup | null`
- `detectFairValueGap(candles, options?)` → `TradingSetup | null`
- Compatible with backtest engine via `BacktestStrategy` type

### Screener (`src/features/screener/screener.ts`)

- `screenStocks(candlesBySymbol, options?)` → `ScreeningCandidate[]`
- `scoreCandidate(volumeRatio, rsi, patternCount, isORB)` → 0–100
- **No database access** — callers pass candles in

### Backtest (`src/features/backtest/engine.ts`)

- `runBacktest(candles, { strategy, initialCapital, riskPerTradePct })` →
  `BacktestResult`
- One position at a time, stop resolves first, conservative exit logic

### Risk (`src/features/trading/risk.ts`)

- `calculatePositionSize({ side, accountEquity, entryPrice, stopLoss, riskPerTradePct })`
- `calculatePnl(side, quantity, entry, exit)`
- Daily limits enforced via server actions

---

## 📦 NSE Universe (Default 50 Symbols)

```typescript
// src/lib/constants.ts
NSE_UNIVERSE = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking' },
  // ... 47 more large-cap liquid names
];
```

All symbols seeded via `prisma db:seed` into `StockSymbol` table.

---

## 🔌 Extending the Platform

### Add Custom Pattern

```typescript
// src/features/candlestick/engine.ts
detectMyPattern(): PatternSignal | null {
  // Your logic here
  return { pattern: 'MY_PATTERN', type: 'REVERSAL', signal: 'BUY', ... };
}
```

### Add Broker Integration

Create `src/features/data/broker.ts` implementing:

```typescript
interface BrokerAdapter {
  fetchCandles(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<Candle[]>;
  placeOrder(order: Order): Promise<OrderResult>;
  getPositions(): Promise<Position[]>;
}
```

### Add Alerts

Webhook/email/Telegram when:

- Screener score > 80
- SMC setup fires
- Daily loss limit approached

### Deploy to Vercel

```bash
vercel deploy --prod
```

Uses `vercel.ts` config, Vercel Postgres + Redis.

---

## 🧪 Quality Gates (All Must Pass)

```bash
pnpm lint              # ESLint flat config
pnpm type-check        # tsc --noEmit (strict mode)
pnpm test              # Vitest unit tests
pnpm test:coverage     # Coverage for src/features/**/*
pnpm build             # Next.js production build
pnpm test:e2e          # Playwright E2E tests
```

---

## 📁 Key Files Reference

```
src/
├── features/
│   ├── candlestick/
│   │   ├── engine.ts           # 7 pattern detectors
│   │   ├── indicators.ts       # RSI, ATR (pure)
│   │   ├── types.ts            # Candle, PatternSignal, TradingSetup
│   │   └── utils.ts            # Candle math helpers
│   ├── strategies/
│   │   ├── liquidity-sweep.ts  # SanSen + Tsutsumi + Sweep
│   │   ├── fair-value-gap.ts   # Sanpei Age + Tonkachi + FVG
│   │   └── types.ts            # Strategy options
│   ├── screener/
│   │   └── screener.ts         # Scoring + ranking
│   ├── backtest/
│   │   ├── engine.ts           # Walk-forward simulation
│   │   └── metrics.ts          # Win rate, PF, DD, Sharpe
│   ├── trading/
│   │   ├── risk.ts             # Position sizing, limits
│   │   └── actions.ts          # Server actions for trades
│   └── dashboard/
│       ├── candlestick-chart.tsx  # TradingView lightweight-charts
│       ├── pattern-card.tsx       # Pattern signal display
│       ├── strategy-card.tsx      # SMC setup display
│       └── screening-table.tsx    # Ranked candidates table
├── app/
│   ├── api/
│   │   ├── candles/route.ts
│   │   ├── patterns/route.ts
│   │   ├── setup/route.ts
│   │   ├── screen/route.ts
│   │   └── trades/route.ts
│   └── dashboard/page.tsx
├── server/
│   ├── db.ts              # Prisma singleton
│   ├── validators.ts      # Zod schemas
│   └── serializers.ts     # Decimal/BigInt → number
└── lib/
    ├── constants.ts       # NSE universe, timeframes, thresholds
    └── env.ts             # Runtime env validation (Zod)
```

---

## 📝 Appendix: Pattern Definitions (Quick Reference)

### MARUBOZU

> "Bald/Shaved" — Strong conviction, no hesitation

- **Wicks**: Each < 10% of body
- **Signal**: Bullish → BUY, Bearish → SELL
- **Confidence**: 0.75

### TONKACHI (Hammer)

> Long lower wick, small body, bullish close, after bearish candle

- **Condition**: Lower wick > 2× body, bullish close, prev candle bearish
- **Signal**: BUY
- **Confidence**: 0.80

### NAGAREBOSHI (Shooting Star)

> Long upper wick, small body, bearish close, after bullish candle

- **Condition**: Upper wick > 2× body, bearish close, prev candle bullish
- **Signal**: SELL
- **Confidence**: 0.80

### TSUTSUMI (Engulfing)

> Current body completely engulfs previous

- **Bullish**: Current bullish, engulfs bearish prev
- **Bearish**: Current bearish, engulfs bullish prev
- **Signal**: Direction of engulfing candle
- **Confidence**: 0.80

### HARAMI

> Current body sits inside previous body

- **Signal**: NEUTRAL (continuation/consolidation)
- **Confidence**: 0.60

### DOJI

> Body < 10% of total range (indecision)

- **Signal**: RSI > 70 → SELL, RSI < 30 → BUY, else NEUTRAL
- **Confidence**: 0.50

### SAKATA FIVE METHOD

> Classical 5-candle bottom reversal

- **Candles 1-3**: Rising highs (candle 3 = peak)
- **Candles 3-5**: Declining highs + declining lows
- **Candle 5**: Bullish close (close > open)
- **Signal**: BUY
- **Confidence**: 0.85

---

## 🤝 Contributing

1. Fork → feature branch → PR
2. All quality gates must pass
3. Conventional commits: `type(scope): subject`
4. No `any` types, no `console.log`, Zod validation at boundaries

---

_Generated from jp-trade codebase analysis — for educational and research
purposes. Not financial advice._
