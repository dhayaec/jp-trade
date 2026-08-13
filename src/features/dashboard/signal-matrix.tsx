'use client';

import type { ScreeningCandidate } from '@/features/screener/screener';

/**
 * Signal agreement matrix (UI-PLAN §6) — which evidence categories line up for
 * each top candidate. Each cell is green (signal firing), amber (neutral), or
 * red (signal against), so a glance at a column explains why one stock outranks
 * another without opening its detail page.
 */
export function SignalMatrix({ candidates }: { candidates: readonly ScreeningCandidate[] }) {
  if (candidates.length === 0) return null;
  const rows = CATEGORIES.map((cat) => catMatrix(candidates, cat));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
      <h2 className="border-b border-slate-800 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Signal Agreement
      </h2>
      <table className="w-full min-w-130 text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2 font-medium">Signal</th>
            {candidates.map((c) => (
              <th key={c.symbol} className="px-4 py-2 text-right font-medium">
                {c.symbol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, cells }) => (
            <tr key={label} className="border-b border-slate-800/60 last:border-0">
              <td className="px-4 py-2 text-slate-300">{label}</td>
              {cells.map((cell, i) => (
                <td key={i} className="px-4 py-2 text-center">
                  <Cell cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category derivation
// ---------------------------------------------------------------------------

type Tone = 'good' | 'neutral' | 'bad';

interface MatrixCell {
  tone: Tone;
  title: string;
}

interface MatrixRow {
  label: string;
  cells: MatrixCell[];
}

const CATEGORIES = [
  {
    label: 'Volume',
    derive: (c: ScreeningCandidate): MatrixCell => {
      const b = c.breakdown?.volume ?? 0;
      return {
        tone: b >= 40 ? 'good' : b >= 20 ? 'neutral' : 'bad',
        title: `${c.volumeRatio.toFixed(1)}× baseline`,
      };
    },
  },
  {
    label: 'RSI',
    derive: (c: ScreeningCandidate): MatrixCell => {
      const b = c.breakdown?.rsi ?? 0;
      return {
        tone: b >= 80 ? 'good' : b >= 40 ? 'neutral' : 'bad',
        title: `RSI ${c.rsi.toFixed(1)}`,
      };
    },
  },
  {
    label: 'Pattern',
    derive: (c: ScreeningCandidate): MatrixCell => {
      const b = c.breakdown?.pattern ?? 0;
      return {
        tone: b >= 40 ? 'good' : b > 0 ? 'neutral' : 'bad',
        title: `${c.patternCount} pattern${c.patternCount === 1 ? '' : 's'}`,
      };
    },
  },
  {
    label: 'ORB',
    derive: (c: ScreeningCandidate): MatrixCell => ({
      tone: c.isORB ? 'good' : 'neutral',
      title: c.isORB ? 'Breakout' : 'Inside range',
    }),
  },
] as const;

function catMatrix(
  candidates: readonly ScreeningCandidate[],
  cat: (typeof CATEGORIES)[number]
): MatrixRow {
  return {
    label: cat.label,
    cells: candidates.map(cat.derive),
  };
}

function Cell({ cell }: { cell: MatrixCell }) {
  const color =
    cell.tone === 'good' ? 'bg-emerald-500' : cell.tone === 'bad' ? 'bg-rose-500' : 'bg-amber-400';
  return (
    <span className="inline-flex items-center gap-1.5" title={cell.title}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="hidden text-xs text-slate-500 md:inline">{cell.title}</span>
    </span>
  );
}
