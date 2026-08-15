-- CreateTable
CREATE TABLE "score_history" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "breakdown" JSONB,
    "changeReason" TEXT,
    "scoreDelta" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "score_history_symbol_timeframe_timestamp_idx" ON "score_history"("symbol", "timeframe", "timestamp" DESC);
