# PLAN.md — jp-trade Production Implementation

> **Date:** 2026-08-11 **Repo:** `nextjs-starter` template (Next.js 16 / React
> 19 / Prisma 7 / pnpm) **Source Material:** 6 zip files —
> `TRADING_APP_ACTION_PLAN.md`, `TRADING_APP_COMPLETE_SUMMARY.md`,
> `BACKEND_API_SETUP.md`, `QUICK_START_GUIDE.md`, `CandlestickPatternEngine.ts`,
> `TradingDashboard.tsx`

---

## 1. Executive Summary

The zip files deliver a blueprint for an **NSE intraday trading platform**
combining Japanese Candlestick pattern recognition, Smart Money Concepts, and a
stock screening engine. The code is a prototype scaffold — it uses a **separate
Express backend + React frontend monorepo**, raw SQL, `console.log`-heavy
debugging, and numerous TypeScript `any` types. It does **not** compile against
the repo's strict `tsconfig.json`.

This plan documents how to **migrate the trading app concepts onto the existing
Next.js App Router monolith** (the repo template), achieving production-grade
quality while preserving the trading logic.

### Key Architectural Decisions

| Concern         | Zip Approach                           | Repo Approach (This Plan)                    | Rationale                                                      |
| --------------- | -------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Backend         | Separate Express + Socket.io           | Next.js API routes + Route Handlers          | Monolith; zero extra infra for MVP                             |
| ORM             | Raw SQL via `pg`                       | Prisma 7 (already in template)               | Type-safe queries, migrations                                  |
| Real-time       | Socket.io server                       | Next.js API + Server-Sent Events             | No extra process; works on Vercel                              |
| Caching         | Redis (mandatory)                      | Redis (optional, for tick buffering)         | Redis only needed for live market hours; dev can use in-memory |
| Frontend        | React 18 + Recharts                    | React 19 + lightweight-charts (TradingView)  | Better candlestick charting; React 19 compat                   |
| Data validation | None (raw `req.query`)                 | Zod at every boundary                        | Template convention; prevents bad data                         |
| Type safety     | Multiple `any` types, loose interfaces | Strict TypeScript (template `tsconfig.json`) | Template enforces strict mode                                  |

---

## 2. Source Material Audit

### 2.1 What's Usable (with modification)

| File                              | Content                                       | Status                  | Work Needed                                   |
| --------------------------------- | --------------------------------------------- | ----------------------- | --------------------------------------------- |
| `CandlestickPatternEngine.ts`     | 7 pattern detectors + 2 strategies + screener | ✅ Core logic sound     | Port to strict TS; fix `any` types; add tests |
| `TRADING_APP_ACTION_PLAN.md`      | 11-week roadmap, pattern explanations         | ✅ Reference doc        | Adapt phases to Next.js architecture          |
| `BACKEND_API_SETUP.md`            | API routes, DB schema, Docker                 | ⚠️ Express-specific     | Rewrite as Next.js route handlers + Prisma    |
| `QUICK_START_GUIDE.md`            | Setup guide                                   | ⚠️ Monorepo Express     | Rewrite for this repo's toolchain             |
| `TRADING_APP_COMPLETE_SUMMARY.md` | Overview, discussion points                   | ✅ Conceptual reference | Keep as trading domain knowledge              |

### 2.2 What Must Be Discarded or Rewritten

| File                                   | Problem                                                                                                                                 | Action                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `TradingDashboard.tsx`                 | Uses `@tanstack/react-query` (not in deps), Recharts (poor candlestick support), `'use client'` everywhere, raw `WebSocket` constructor | Rewrite using React 19 Server Components, `lightweight-charts`, and server-first data fetching |
| `BACKEND_API_SETUP.md` Express routes  | `require()` calls, raw `req.query`, no validation, `console.log`                                                                        | Rewrite as typed Next.js Route Handlers with Zod                                               |
| `BACKEND_API_SETUP.md` DB schema       | Raw SQL DDL, no migrations                                                                                                              | Port to Prisma schema with migrations                                                          |
| `QUICK_START_GUIDE.md` broker service  | `any` types everywhere, hardcoded token map                                                                                             | Rewrite with proper types, env-based config                                                    |
| `CandlestickPatternEngine.ts` screener | `static async` method with DB access mixed in                                                                                           | Separate data access from pure logic; use DI pattern                                           |

### 2.3 Issues in Provided Code

```
CandlestickPatternEngine.ts:
  - calculateRSI: divides by 0 when avgLoss is 0 (line 91 — /0.0001 is a band-aid)
  - detectLiquiditySweepStrategy: references undefined variable `last5` (line 417-418)
  - StockScreener.screenStocks: static method accesses DB directly (anti-pattern)
  - No error handling for edge cases (empty arrays, single candle)

TradingDashboard.tsx:
  - Uses `@tanstack/react-query` (not in package.json)
  - Uses Recharts `ComposedChart` for candlestick display (wrong tool)
  - WebSocket URL uses `process.env.REACT_APP_WS_URL` (Vite convention, not Next.js)
  - Multiple `useEffect` state-sync anti-patterns
  - No error boundaries or loading states
  - Hardcoded symbol list

BACKEND_API_SETUP.md:
  - Uses `require()` (not ESM)
  - No input validation (Zod required by code conventions)
  - `console.log` in production code
  - Raw SQL instead of Prisma
  - No rate limiting or auth
```

---

## 3. Data Model (Prisma Schema)

Replace the placeholder `User` model with the trading domain:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

/// OHLCV candle data — partitioned by symbol + timeframe
model Candle {
  id        String   @id @default(cuid())
  symbol    String
  timeframe String   // "1m", "5m", "15m", "1h", "1d"
  timestamp DateTime
  open      Decimal  @db.Decimal(12, 4)
  high      Decimal  @db.Decimal(12, 4)
  low       Decimal  @db.Decimal(12, 4)
  close     Decimal  @db.Decimal(12, 4)
  volume    BigInt

  createdAt DateTime @default(now())

  @@unique([symbol, timeframe, timestamp])
  @@index([symbol, timestamp(sort: Desc)])
  @@map("candles")
}

/// Detected candlestick pattern signal
model PatternSignal {
  id         String   @id @default(cuid())
  symbol     String
  pattern    String   // "MARUBOZU", "TONKACHI", etc.
  signal     String   // "BUY", "SELL", "NEUTRAL"
  type       String   // "REVERSAL", "CONTINUATION", "INDECISION"
  confidence Decimal  @db.Decimal(4, 3) // 0.000 - 1.000
  entry      Decimal? @db.Decimal(12, 4)
  stopLoss   Decimal? @db.Decimal(12, 4)
  takeProfit Decimal? @db.Decimal(12, 4)
  timeframe  String
  timestamp  DateTime

  createdAt  DateTime @default(now())

  @@index([symbol, createdAt(sort: Desc)])
  @@index([pattern, confidence(sort: Desc)])
  @@map("pattern_signals")
}

/// Logged trade (paper or live)
model Trade {
  id         String   @id @default(cuid())
  symbol     String
  position   String   // "LONG", "SHORT"
  entry      Decimal  @db.Decimal(12, 4)
  stopLoss   Decimal  @db.Decimal(12, 4)
  takeProfit Decimal  @db.Decimal(12, 4)
  quantity   Int
  pattern    String
  strategy   String
  status     String   @default("OPEN") // "OPEN", "CLOSED", "STOPPED"
  exitPrice  Decimal? @db.Decimal(12, 4)
  pnl        Decimal? @db.Decimal(12, 4)
  notes      String?

  createdAt  DateTime @default(now())
  closedAt   DateTime?

  @@index([status])
  @@index([symbol, createdAt(sort: Desc)])
  @@map("trades")
}

/// Stock universe for screening
model StockSymbol {
  id         String   @id @default(cuid())
  symbol     String   @unique
  name       String
  exchange   String   @default("NSE")
  sector     String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  @@map("stock_symbols")
}
```

---

## 4. Project Structure (Target)

```
src/
├── app/
│   ├── layout.tsx              # Root layout (dark theme, fonts)
│   ├── page.tsx                # Landing / redirect to dashboard
│   ├── globals.css             # Tailwind + chart styles
│   ├── dashboard/
│   │   └── page.tsx            # Main dashboard (Server Component)
│   ├── api/
│   │   ├── candles/route.ts    # GET /api/candles
│   │   ├── patterns/route.ts   # GET /api/patterns
│   │   ├── setup/route.ts      # GET /api/setup
│   │   ├── screen/route.ts     # GET /api/screen
│   │   └── trades/route.ts     # GET/POST /api/trades
│   └── trade-log/
│       └── page.tsx            # Trade history page
├── features/
│   ├── candlestick/
│   │   ├── engine.ts           # Pattern detection engine (ported from zip)
│   │   ├── engine.test.ts      # Unit tests for each pattern
│   │   ├── types.ts            # Candle, PatternSignal, TradingSetup interfaces
│   │   └── indicators.ts       # RSI, ATR calculations (pure functions)
│   ├── screener/
│   │   ├── screener.ts         # Stock scoring + filtering (pure logic)
│   │   ├── screener.test.ts    # Screener tests
│   │   └── types.ts            # StockScanResult interface
│   ├── strategies/
│   │   ├── liquidity-sweep.ts  # San Sen + Tsutsumi + Liquidity Sweep
│   │   ├── fair-value-gap.ts   # Sanpei Age + Tonkachi + FVG
│   │   ├── strategies.test.ts  # Strategy tests
│   │   └── types.ts            # TradingSetup interface
│   ├── trading/
│   │   ├── actions.ts          # Server actions (trade logging)
│   │   ├── risk.ts             # Position sizing, daily limits
│   │   └── risk.test.ts        # Risk management tests
│   └── dashboard/
│       ├── candlestick-chart.tsx  # TradingView lightweight-charts
│       ├── pattern-card.tsx       # Pattern signal card
│       ├── strategy-card.tsx      # Trading setup card
│       ├── screening-table.tsx    # Stock screening results
│       └── controls.tsx           # Symbol/timeframe selectors
├── server/
│   ├── db.ts                   # Prisma client singleton
│   └── validators.ts           # Zod schemas for API inputs
└── lib/
    ├── utils.ts                # cn() helper (existing)
    ├── constants.ts            # NSE symbols, timeframes, thresholds
    └── env.ts                  # Runtime env validation (Zod)
```

---

## 5. Implementation Phases

### Phase 0: Foundation (Day 1-2)

**Goal:** Project setup, env validation, database schema, Prisma client.

| Task                      | Details                                                     | Files                  |
| ------------------------- | ----------------------------------------------------------- | ---------------------- |
| 0.1 Update `package.json` | Rename to `jp-trade`; add `lightweight-charts`, `zod`       | `package.json`         |
| 0.2 Env validation        | Zod schema for `DATABASE_URL`, `REDIS_URL`, `BROKER_*` vars | `src/lib/env.ts`       |
| 0.3 Prisma schema         | Full trading domain models (Section 3 above)                | `prisma/schema.prisma` |
| 0.4 Prisma client         | Singleton pattern with connection pooling                   | `src/server/db.ts`     |
| 0.5 Constants             | NSE stock universe, timeframe enums, thresholds             | `src/lib/constants.ts` |
| 0.6 Update `.env.example` | Add trading-specific env vars                               | `.env.example`         |
| 0.7 Update layout         | Dark theme, app title, fonts                                | `src/app/layout.tsx`   |
| 0.8 Dev infrastructure    | `docker-compose.yml` for PostgreSQL + Redis                 | `docker-compose.yml`   |

**Commit:**
`chore(foundation): set up project config, env validation, and Prisma schema`

---

### Phase 1: Pattern Engine (Days 3-5)

**Goal:** Port `CandlestickPatternEngine.ts` to strict TypeScript with full test
coverage.

| Task                | Details                                                                  | Files                                         |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| 1.1 Types           | `Candle`, `PatternSignal`, `TradingSetup` with strict types              | `src/features/candlestick/types.ts`           |
| 1.2 Indicators      | `calculateRSI`, `calculateATR` as pure functions with edge-case handling | `src/features/candlestick/indicators.ts`      |
| 1.3 Pattern engine  | Port all 7 detectors; fix `/0` bug in RSI; fix `last5` scope error       | `src/features/candlestick/engine.ts`          |
| 1.4 Engine tests    | Unit tests for each pattern (happy path + edge cases)                    | `src/features/candlestick/engine.test.ts`     |
| 1.5 Indicator tests | RSI/ATR boundary tests (0 candles, 1 candle, normal)                     | `src/features/candlestick/indicators.test.ts` |

**Bugs fixed from zip:**

- `calculateRSI`: Replace `avgLoss || 0.0001` with proper `avgLoss === 0` →
  `RSI = 100`
- `detectLiquiditySweepStrategy`: Fix `last5` variable scope (should use `last5`
  from candles)
- `detectSakataFive`: Fix pattern logic (current impl doesn't match Sakata rules
  exactly)

**Commit:** `feat(candlestick): port pattern engine with strict types and tests`

---

### Phase 2: Smart Money Strategies (Days 6-7)

**Goal:** Port the two trading strategies as pure logic modules.

| Task                         | Details                                                     | Files                                        |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| 2.1 Liquidity Sweep strategy | `SanSenTsutsumiSweep` — trend + engulfing + sweep detection | `src/features/strategies/liquidity-sweep.ts` |
| 2.2 Fair Value Gap strategy  | `SanpeiAgeTonkachiFVG` — support + hammer + gap detection   | `src/features/strategies/fair-value-gap.ts`  |
| 2.3 Strategy tests           | Backtest-style tests with synthetic candle data             | `src/features/strategies/strategies.test.ts` |

**Commit:**
`feat(strategies): implement liquidity sweep and fair value gap strategies`

---

### Phase 3: Stock Screener (Day 8)

**Goal:** Pure-function screener (no DB access; data passed in).

| Task          | Details                                                         | Files                                    |
| ------------- | --------------------------------------------------------------- | ---------------------------------------- |
| 3.1 Scoring   | `scoreCandidate(volumeRatio, rsi, patternCount, isORB)` → 0-100 | `src/features/screener/screener.ts`      |
| 3.2 Screening | `screenStocks(candlesBySymbol, opts)` → sorted candidates       | `src/features/screener/screener.ts`      |
| 3.3 Tests     | Test scoring formula, filtering, top-N selection                | `src/features/screener/screener.test.ts` |

**Commit:** `feat(screener): implement stock screening with scoring algorithm`

---

### Phase 4: API Layer (Days 9-10)

**Goal:** Next.js Route Handlers with Zod validation, Prisma queries, error
handling.

| Task                    | Details                                         | Files                           |
| ----------------------- | ----------------------------------------------- | ------------------------------- |
| 4.1 Zod validators      | Input schemas for symbol, timeframe, limit      | `src/server/validators.ts`      |
| 4.2 `GET /api/candles`  | Fetch candles from Prisma; validate query       | `src/app/api/candles/route.ts`  |
| 4.3 `GET /api/patterns` | Fetch candles → run engine → return signals     | `src/app/api/patterns/route.ts` |
| 4.4 `GET /api/setup`    | Fetch candles → run strategies → return setup   | `src/app/api/setup/route.ts`    |
| 4.5 `GET /api/screen`   | Fetch all symbols → run screener → return top N | `src/app/api/screen/route.ts`   |
| 4.6 `POST /api/trades`  | Log trade via Prisma; validate body with Zod    | `src/app/api/trades/route.ts`   |
| 4.7 API tests           | Integration tests for each endpoint             | `tests/api/`                    |

**API conventions (per code-conventions.md):**

- All inputs validated with Zod at the boundary
- No `console.log` — use `console.error` for failures
- Return structured `{ error: string }` on failures
- Type-only imports for all Prisma types

**Commit:** `feat(api): implement route handlers with Zod validation and Prisma`

---

### Phase 5: Dashboard UI (Days 11-14)

**Goal:** Real-time trading dashboard using Server Components + TradingView
charts.

| Task                  | Details                                                  | Files                                          |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| 5.1 Root layout       | Dark theme, responsive sidebar, nav                      | `src/app/layout.tsx`                           |
| 5.2 Dashboard page    | Server Component shell; client islands for interactivity | `src/app/dashboard/page.tsx`                   |
| 5.3 Candlestick chart | TradingView `lightweight-charts` integration             | `src/features/dashboard/candlestick-chart.tsx` |
| 5.4 Pattern cards     | Signal display with confidence, entry/SL/TP              | `src/features/dashboard/pattern-card.tsx`      |
| 5.5 Strategy card     | Trading setup with risk/reward visualization             | `src/features/dashboard/strategy-card.tsx`     |
| 5.6 Screening table   | Sortable table with score, patterns, signals             | `src/features/dashboard/screening-table.tsx`   |
| 5.7 Controls          | Symbol selector, timeframe picker                        | `src/features/dashboard/controls.tsx`          |
| 5.8 Trade log page    | Trade history with P&L tracking                          | `src/app/trade-log/page.tsx`                   |
| 5.9 E2E tests         | Playwright tests for dashboard flows                     | `e2e/dashboard.spec.ts`                        |

**Architecture notes:**

- Dashboard shell is a **Server Component** — fetches initial data on the server
- Chart and controls are **Client Components** (`'use client'`) — only what
  needs interactivity
- Use React 19 `use()` for data fetching in client components where appropriate
- No `@tanstack/react-query` — use `fetch` + React caching / Server Components
  instead

**Commit:**
`feat(dashboard): implement trading dashboard with candlestick charts`

---

### Phase 6: Risk Management & Trade Logging (Day 15)

**Goal:** Position sizing, daily limits, trade lifecycle.

| Task               | Details                                               | Files                               |
| ------------------ | ----------------------------------------------------- | ----------------------------------- |
| 6.1 Risk engine    | Position sizing formula, daily loss limit, max trades | `src/features/trading/risk.ts`      |
| 6.2 Server actions | Trade create/update/close actions                     | `src/features/trading/actions.ts`   |
| 6.3 Risk tests     | Test sizing, limits, edge cases                       | `src/features/trading/risk.test.ts` |

**Rules (from zip, enforced in code):**

- Max 1% risk per trade
- Max 3 active trades per day
- Max 2% daily loss → halt trading
- Hard stop losses (never trail below breakeven)

**Commit:** `feat(trading): implement risk management and trade lifecycle`

---

### Phase 7: Backtesting Framework (Days 16-18)

**Goal:** Validate pattern accuracy on historical data before going live.

| Task                  | Details                                             | Files                                  |
| --------------------- | --------------------------------------------------- | -------------------------------------- |
| 7.1 Backtest engine   | Run strategy over historical candles, track trades  | `src/features/backtest/engine.ts`      |
| 7.2 Metrics           | Win rate, profit factor, max drawdown, Sharpe ratio | `src/features/backtest/metrics.ts`     |
| 7.3 Historical import | CLI script to import CSV/JSON candle data           | `scripts/import-historical.ts`         |
| 7.4 Backtest tests    | Test with synthetic data series                     | `src/features/backtest/engine.test.ts` |

**Commit:** `feat(backtest): implement backtesting framework with metrics`

---

### Phase 8: Production Hardening (Days 19-21)

**Goal:** Security, performance, monitoring, deployment.

| Task                 | Details                                              | Files                                              |
| -------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| 8.1 Rate limiting    | API rate limiting for screening endpoints            | `src/middleware.ts`                                |
| 8.2 Error boundaries | React error boundaries for chart/dashboard           | `src/app/error.tsx`, `src/app/dashboard/error.tsx` |
| 8.3 Loading states   | Skeleton loading for all data-dependent components   | `src/app/dashboard/loading.tsx`                    |
| 8.4 CSP headers      | Content Security Policy for chart libraries          | `next.config.ts`                                   |
| 8.5 CI updates       | Add Prisma generate/migrate to CI; add API test job  | `.github/workflows/ci.yml`                         |
| 8.6 Vercel config    | `vercel.json` or `vercel.ts` for deployment settings | `vercel.json`                                      |
| 8.7 Smoke tests      | Update E2E for dashboard routes                      | `e2e/smoke.spec.ts`                                |

**Commit:**
`chore(production): add rate limiting, error boundaries, and CI updates`

---

## 6. Key Technical Decisions

### 6.1 Charting: `lightweight-charts` over Recharts

The zip uses **Recharts** which is a general-purpose charting library. For
candlestick charts, **TradingView's `lightweight-charts`** is the industry
standard:

- Native candlestick support (Open-High-Low-Close rendering)
- Built-in volume histogram
- Time-axis handling for market hours
- Lightweight (~40KB gzipped)
- Used by major trading platforms

```bash
pnpm add lightweight-charts
```

### 6.2 Data Fetching: Server Components over React Query

The zip uses `@tanstack/react-query` for client-side data fetching. This repo
uses **Next.js App Router** with React 19 Server Components:

- **Server Components** fetch data directly (no loading waterfalls)
- **Client Components** use `fetch` + `React.cache()` for deduplication
- **Route Handlers** (`/api/*`) serve as the REST API for external consumers
- No extra client-side library needed for the core flow

For the dashboard's polling behavior (real-time updates during market hours),
use `setInterval` + `fetch` in a thin client hook — lightweight and
framework-native.

### 6.3 Real-Time: Server-Sent Events over Socket.io

The zip requires a persistent Socket.io server. For the Next.js monolith:

- **SSE (Server-Sent Events)** via Route Handlers works on Vercel/Node.js
- No extra WebSocket server process needed
- Clients reconnect automatically (built into `EventSource`)
- Sufficient for 5-minute candle updates (not tick-by-tick)

For **tick-level** real-time (if needed later), use Redis Pub/Sub + an Edge
Function or a separate WebSocket service.

### 6.4 Redis: Optional for MVP

Redis is only critical during **live market hours** for tick buffering. For
development:

- **In-memory candle buffer** (Map<string, Candle[]>) works for testing
- Redis becomes required only when connecting to a live broker feed
- Add Redis as optional (`if (process.env.REDIS_URL)` guard)

### 6.5 Input Validation: Zod Everywhere

Per code conventions, **all user input is validated with Zod at the boundary**:

```typescript
// src/server/validators.ts
import { z } from 'zod';

export const symbolQuerySchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase()),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '1d']).default('5m'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
```

---

## 7. Dependencies to Add

```json
{
  "dependencies": {
    "lightweight-charts": "^5.0.0",
    "zod": "^3.25.0",
    "lucide-react": "^1.28.0 (already installed)"
  },
  "devDependencies": {
    "prisma": "^7.9.1 (already installed)",
    "@prisma/client": "^7.9.1",
    "docker-compose": "via docker-compose.yml"
  }
}
```

**Removed from zip requirements:**

- ❌ `express`, `socket.io`, `bull`, `pg`, `redis` (backend)
- ❌ `@tanstack/react-query` (client data fetching)
- ❌ `recharts` (charting)
- ❌ `concurrently` (monorepo dev)

---

## 8. Quality Gates (Must Pass Before Each Phase Merge)

Per the repo's CI pipeline (`.github/workflows/ci.yml`):

```bash
pnpm lint              # ESLint flat config — no any, no unused vars
pnpm type-check        # tsc --noEmit — strict mode
pnpm test              # Vitest — all unit tests pass
pnpm test:coverage     # Coverage for src/features/**/*
pnpm build             # Next.js production build
pnpm test:e2e          # Playwright — dashboard loads, API responds
```

Additionally:

- All new code follows `.claude/guidelines/code-conventions.md`
- All commits follow conventional format: `type(scope): subject`
- No `console.log` in application code
- No `any` types — use `unknown` and narrow
- Zod validation at every API boundary

---

## 9. Testing Strategy

### Unit Tests (Vitest)

| Module                      | Test Focus                                | Coverage Target |
| --------------------------- | ----------------------------------------- | --------------- |
| `candlestick/engine.ts`     | Each pattern detector with synthetic data | 100% branches   |
| `candlestick/indicators.ts` | RSI/ATR edge cases (0, 1, N candles)      | 100%            |
| `strategies/*.ts`           | Strategy entry/exit conditions            | 100%            |
| `screener/screener.ts`      | Scoring formula, filtering logic          | 100%            |
| `trading/risk.ts`           | Position sizing, daily limits             | 100%            |

### Integration Tests (Vitest)

| Module     | Test Focus                                          |
| ---------- | --------------------------------------------------- |
| API routes | Request validation, Prisma queries, error responses |

### E2E Tests (Playwright)

| Flow              | Steps                                           |
| ----------------- | ----------------------------------------------- |
| Dashboard load    | Navigate → chart renders → symbols load         |
| Pattern detection | Select symbol → patterns appear → cards display |
| Stock screening   | Navigate → table loads → results sortable       |
| Trade logging     | Submit trade → verify in trade log              |

---

## 10. Risk Register

| Risk                            | Impact                  | Mitigation                                                      |
| ------------------------------- | ----------------------- | --------------------------------------------------------------- |
| NSE broker API rate limits      | Can't fetch live data   | Implement backoff + local cache; use paper trading mode         |
| Candle data quality (bad ticks) | Wrong pattern detection | Validate OHLCV invariants (high ≥ open,close; low ≤ open,close) |
| Pattern false positives         | Bad trade signals       | Require volume confirmation; backtest before enabling           |
| Redis dependency for dev        | Slows local setup       | Make Redis optional; in-memory fallback for dev                 |
| Prisma migration conflicts      | Schema drift            | Run `prisma migrate dev` in CI check; lock migration order      |

---

## 11. Timeline Summary

| Phase                 | Days  | Deliverable                                | Dependencies |
| --------------------- | ----- | ------------------------------------------ | ------------ |
| **0: Foundation**     | 1-2   | Schema, env, Prisma client, docker-compose | None         |
| **1: Pattern Engine** | 3-5   | 7 pattern detectors + tests                | Phase 0      |
| **2: Strategies**     | 6-7   | 2 smart money strategies + tests           | Phase 1      |
| **3: Screener**       | 8     | Stock scoring + filtering + tests          | Phase 1      |
| **4: API Layer**      | 9-10  | 5 route handlers + Zod validation          | Phase 0-3    |
| **5: Dashboard**      | 11-14 | Full trading dashboard UI                  | Phase 4      |
| **6: Risk & Trades**  | 15    | Position sizing, trade lifecycle           | Phase 0, 4   |
| **7: Backtesting**    | 16-18 | Backtest engine + historical import        | Phase 1-3    |
| **8: Production**     | 19-21 | Security, CI, deployment config            | All phases   |

**Total: ~21 working days (~4 weeks)**

---

## 12. Success Criteria

- [ ] All 7 candlestick patterns detected correctly (unit tested)
- [ ] Both smart money strategies produce valid setups
- [ ] Screener ranks stocks by volume, RSI, patterns, and ORB
- [ ] API endpoints validated with Zod, typed with Prisma
- [ ] Dashboard renders candlestick chart, pattern cards, screening table
- [x] Trade logging with P&L tracking
- [x] Risk management enforced (1% per trade, 3 max/day, 2% daily halt)
- [x] Backtesting framework validates pattern accuracy on historical data
- [ ] All quality gates pass: lint, type-check, test, build, E2E
- [ ] No `any` types, no `console.log`, no unvalidated inputs

---

## Appendix A: Original Zip File Index

| File                              | Purpose                               | Disposition                                           |
| --------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| `TRADING_APP_ACTION_PLAN.md`      | 11-week roadmap, pattern explanations | ✅ Reference — concepts ported                        |
| `TRADING_APP_COMPLETE_SUMMARY.md` | Overview, discussion points           | ✅ Reference — domain knowledge                       |
| `CandlestickPatternEngine.ts`     | Pattern detection + strategies        | 🔄 Ported (strict TS, bugs fixed)                     |
| `TradingDashboard.tsx`            | React dashboard component             | 🔄 Rewritten (Server Components + lightweight-charts) |
| `BACKEND_API_SETUP.md`            | Express routes + DB schema            | 🔄 Rewritten (Next.js Route Handlers + Prisma)        |
| `QUICK_START_GUIDE.md`            | Setup instructions                    | 🔄 Rewritten (this repo's toolchain)                  |

---

## Appendix B: Environment Variables

```bash
# .env.example (updated)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/jp_trade?sslmode=require"
AUTH_SECRET="replace-me"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Redis (optional for development; required for live market hours)
REDIS_URL="redis://localhost:6379"

# NSE Broker API (for live data)
BROKER_API_KEY=""
BROKER_USER_ID=""
BROKER_PASSWORD=""
BROKER_ENDPOINT="https://api.shoonya.com"

# Market hours (IST)
MARKET_OPEN="09:15"
MARKET_CLOSE="15:30"
```
