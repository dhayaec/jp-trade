#!/usr/bin/env tsx
/**
 * Historical OHLCV importer — bulk-load candle data from CSV or JSON into the
 * `Candle` table (Phase 7.3). Powers the Phase 7 backtest engine with real
 * market history before going live.
 *
 * Usage (run via tsx so `@/` path aliases resolve):
 *   pnpm tsx scripts/import-historical.ts --file data/reliance-1d.csv --symbol RELIANCE --timeframe 1d
 *   pnpm tsx scripts/import-historical.ts --file data/nifty.json --symbol NIFTY --timeframe 1h
 *
 * CSV format (header row required):
 *   timestamp,open,high,low,close,volume
 *   Timestamps may be ISO-8601 strings ("2024-01-02T09:15:00+05:30") or epoch
 *   milliseconds.
 *
 * JSON format: an array of objects, each with
 *   { timestamp, open, high, low, close, volume }.
 *
 * Rows are inserted with `skipDuplicates` — re-running over the same range is
 * safe. Rows that violate OHLC sanity (low above high, etc.) abort the run with
 * a pointer to the offending line; malformed input aborts before any write.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPrisma } from '@/server/db';
import { TIMEFRAMES, type Timeframe } from '@/lib/constants';

interface ParsedRow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** 1-based line number in the source file, for error reporting. */
  line: number;
}

interface ImportArgs {
  file: string;
  symbol: string;
  timeframe: Timeframe;
}

const USAGE = `Usage:
  pnpm tsx scripts/import-historical.ts --file <path> --symbol <SYMBOL> --timeframe <tf>

Options:
  --file       Path to CSV or JSON candle data (required)
  --symbol     NSE symbol, e.g. RELIANCE (required)
  --timeframe  One of ${TIMEFRAMES.join(', ')} (required)`;

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): ImportArgs {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === undefined || !flag.startsWith('--')) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    args.set(flag.slice(2), value);
    i += 1;
  }

  const file = args.get('file');
  const symbol = args.get('symbol');
  const timeframe = args.get('timeframe');

  if (!file || !symbol || !timeframe) {
    throw new Error(`--file, --symbol and --timeframe are all required.\n\n${USAGE}`);
  }
  if (!TIMEFRAMES.includes(timeframe as Timeframe)) {
    throw new Error(`Unknown timeframe "${timeframe}". Expected one of ${TIMEFRAMES.join(', ')}.`);
  }

  return { file, symbol, timeframe: timeframe as Timeframe };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseTimestamp(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') throw new Error('empty timestamp');
  // Bare integers are treated as epoch milliseconds; anything else via Date.
  if (/^\d+$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (!Number.isSafeInteger(asNumber)) throw new Error(`timestamp out of range "${trimmed}"`);
    return asNumber;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) throw new Error(`unparseable timestamp "${trimmed}"`);
  return parsed;
}

/** Parse one record into a row, rejecting non-numeric fields and OHLC drift. */
function toRow(record: Record<string, string | number>, line: number): ParsedRow {
  const numberField = (key: string): number => {
    const raw = record[key];
    if (raw === undefined) throw new Error(`missing "${key}" column`);
    const value = typeof raw === 'string' ? Number(raw) : raw;
    if (!Number.isFinite(value)) throw new Error(`non-numeric "${key}": "${raw}"`);
    return value;
  };

  const timestampRaw = record.timestamp;
  if (timestampRaw === undefined) throw new Error('missing "timestamp" column');
  const timestamp = parseTimestamp(String(timestampRaw));

  const open = numberField('open');
  const high = numberField('high');
  const low = numberField('low');
  const close = numberField('close');
  const volume = numberField('volume');

  if (high < Math.max(open, close) || low > Math.min(open, close)) {
    throw new Error(
      `OHLC out of bounds: high ${high} / low ${low} inconsistent with open ${open} / close ${close}`
    );
  }
  if (timestamp <= 0) throw new Error('timestamp must be a positive epoch-milliseconds value');

  return { timestamp, open, high, low, close, volume, line };
}

function parseCsv(content: string): ParsedRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row');

  const first = lines[0];
  if (first === undefined) throw new Error('CSV needs a header row and at least one data row');
  const headers = first.split(',').map((h) => h.trim().toLowerCase());
  const required = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
  for (const column of required) {
    if (!headers.includes(column)) {
      throw new Error(`CSV is missing the "${column}" column; header is: ${headers.join(', ')}`);
    }
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const cells = line.split(',').map((c) => c.trim());
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? '';
    });
    rows.push(toRow(record, i + 1));
  }
  return rows;
}

function parseJson(content: string): ParsedRow[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('file is not valid JSON');
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('JSON must be a non-empty array of candle objects');
  }

  return data.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`row ${index + 1} is not an object`);
    }
    return toRow(entry as Record<string, string | number>, index + 1);
  });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

async function importCandles(args: ImportArgs): Promise<number> {
  const content = readFileSync(resolve(args.file), 'utf8');
  const isJson = args.file.toLowerCase().endsWith('.json');
  const parsed = isJson ? parseJson(content) : parseCsv(content);

  const rows = parsed.map((row) => ({
    symbol: args.symbol,
    timeframe: args.timeframe,
    timestamp: new Date(row.timestamp),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));

  const prisma = getPrisma();
  const { count } = await prisma.candle.createMany({ data: rows, skipDuplicates: true });
  return count;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const count = await importCandles(args);
    console.log(
      `Imported ${count} candles for ${args.symbol} [${args.timeframe}] from ${args.file}`
    );
  } catch (error) {
    console.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

void main();
