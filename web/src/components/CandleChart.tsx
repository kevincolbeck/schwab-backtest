"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { readChartTokens, type ChartTokens } from "@/components/chartTokens";

export interface Bar {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TradeMarker {
  time: string;
  kind: "entry" | "exit";
  label: string;
}

function buildMarkers(markers: TradeMarker[], t: ChartTokens): SeriesMarker<Time>[] {
  return markers.map((m) => ({
    time: m.time as Time,
    position: m.kind === "entry" ? "belowBar" : "aboveBar",
    color: m.kind === "entry" ? t.accent : t.loss,
    shape: m.kind === "entry" ? "arrowUp" : "arrowDown",
    text: m.label,
  }));
}

/** TradingView lightweight-charts candlesticks with entry/exit markers and an
 *  optional stop-price line. All colors resolve from the design tokens at
 *  runtime and re-skin on data-theme changes (SYSTEM.md §10). */
export default function CandleChart({
  bars,
  markers = [],
  stopPrice = null,
  height = 340,
}: {
  bars: Bar[];
  markers?: TradeMarker[];
  stopPrice?: number | null;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || bars.length === 0) return;

    const tokens = readChartTokens();
    const chart = createChart(el, {
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: tokens.muted,
        fontFamily: tokens.mono,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: tokens.hairline },
        horzLines: { color: tokens.hairline },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 3 },
      crosshair: {
        vertLine: { color: tokens.muted, width: 1, style: 3 },
        horzLine: { color: tokens.muted, width: 1, style: 3 },
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: tokens.gain,
      downColor: tokens.loss,
      borderUpColor: tokens.gain,
      borderDownColor: tokens.loss,
      wickUpColor: tokens.gain,
      wickDownColor: tokens.loss,
    });
    series.setData(
      bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );

    const markersApi = markers.length
      ? createSeriesMarkers(series, buildMarkers(markers, tokens))
      : null;

    const priceLine =
      stopPrice !== null && Number.isFinite(stopPrice)
        ? series.createPriceLine({
            price: stopPrice,
            color: tokens.loss,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "stop",
          })
        : null;

    chart.timeScale().fitContent();

    // Re-skin every color when the theme toggles (light AA variants matter).
    const observer = new MutationObserver(() => {
      const t = readChartTokens();
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: t.muted,
        },
        grid: { vertLines: { color: t.hairline }, horzLines: { color: t.hairline } },
        crosshair: {
          vertLine: { color: t.muted, width: 1, style: 3 },
          horzLine: { color: t.muted, width: 1, style: 3 },
        },
      });
      series.applyOptions({
        upColor: t.gain,
        downColor: t.loss,
        borderUpColor: t.gain,
        borderDownColor: t.loss,
        wickUpColor: t.gain,
        wickDownColor: t.loss,
      });
      markersApi?.setMarkers(buildMarkers(markers, t));
      priceLine?.applyOptions({ color: t.loss });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, markers, stopPrice, height]);

  if (!bars.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted">
        No price data available.
      </div>
    );
  }
  return <div ref={containerRef} style={{ height }} aria-label="Candlestick chart" role="img" />;
}

// UTCTimestamp import kept for future intraday bars (Phase C).
export type { UTCTimestamp };
