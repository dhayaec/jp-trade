'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { Candle } from '@/features/candlestick/types';
import { candlesToChartData, candlesToVolumeData } from './format';

/**
 * TradingView `lightweight-charts` candlestick chart with a volume pane.
 *
 * The library is imported lazily inside the mount effect: it is browser-only
 * and must never run during Server-Side Rendering. The chart and series are
 * created once; subsequent candle changes are pushed via `setData`, preserving
 * the user's zoom/pan state.
 */

interface Props {
  candles: readonly Candle[];
  /** Fixed pixel height of the chart container. */
  height?: number;
}

export function CandlestickChart({ candles, height = 400 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Latest candles visible to the async mount effect without a stale closure.
  const candlesRef = useRef(candles);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  /** Push candles into the (stable) series; no-op until the chart is ready. */
  const render = useCallback((data: readonly Candle[]) => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    candleSeries.setData(candlesToChartData(data));
    volumeSeries.setData(candlesToVolumeData(data));
    chart.timeScale().fitContent();
  }, []);

  // Create the chart + series exactly once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    let chart: IChartApi | null = null;

    void (async () => {
      const { createChart, CandlestickSeries, ColorType, CrosshairMode, HistogramSeries } =
        await import('lightweight-charts');
      if (disposed || !el.isConnected) return;

      chart = createChart(el, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.2)' },
        timeScale: {
          borderColor: 'rgba(148, 163, 184, 0.2)',
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: { mode: CrosshairMode.Normal },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      render(candlesRef.current);
    })();

    return () => {
      disposed = true;
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chart?.remove();
    };
  }, [render]);

  // Keep the series in sync when the parent refetches.
  useEffect(() => {
    render(candles);
  }, [candles, render]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
          No candle data for this symbol yet.
        </div>
      )}
    </div>
  );
}
