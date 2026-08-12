-- CreateTable
CREATE TABLE "candles" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(12,4) NOT NULL,
    "high" DECIMAL(12,4) NOT NULL,
    "low" DECIMAL(12,4) NOT NULL,
    "close" DECIMAL(12,4) NOT NULL,
    "volume" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_signals" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "entry" DECIMAL(12,4),
    "stopLoss" DECIMAL(12,4),
    "takeProfit" DECIMAL(12,4),
    "timeframe" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "entry" DECIMAL(12,4) NOT NULL,
    "stopLoss" DECIMAL(12,4) NOT NULL,
    "takeProfit" DECIMAL(12,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pattern" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "exitPrice" DECIMAL(12,4),
    "pnl" DECIMAL(12,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_symbols" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'NSE',
    "sector" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_symbols_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candles_symbol_timestamp_idx" ON "candles"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "candles_symbol_timeframe_timestamp_key" ON "candles"("symbol", "timeframe", "timestamp");

-- CreateIndex
CREATE INDEX "pattern_signals_symbol_createdAt_idx" ON "pattern_signals"("symbol", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "pattern_signals_pattern_confidence_idx" ON "pattern_signals"("pattern", "confidence" DESC);

-- CreateIndex
CREATE INDEX "trades_status_idx" ON "trades"("status");

-- CreateIndex
CREATE INDEX "trades_symbol_createdAt_idx" ON "trades"("symbol", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "stock_symbols_symbol_key" ON "stock_symbols"("symbol");
