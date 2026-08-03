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

const GAIN = "#089981";
const LOSS = "#f23645";
const ACCENT = "#8b7cf6";

function readTokens() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue("--muted").trim() || "#8a94a6",
    grid: styles.getPropertyValue("--hairline").trim() || "rgba(148,163,184,0.1)",
  };
}

/** TradingView lightweight-charts candlesticks with entry/exit markers and an
 *  optional stop-price line. Theme-aware (re-skins on data-theme changes). */
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

    const tokens = readTokens();
    const chart = createChart(el, {
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: tokens.text,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: tokens.grid },
        horzLines: { color: tokens.grid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 3 },
      crosshair: {
        vertLine: { color: tokens.text, width: 1, style: 3 },
        horzLine: { color: tokens.text, width: 1, style: 3 },
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: GAIN,
      downColor: LOSS,
      borderUpColor: GAIN,
      borderDownColor: LOSS,
      wickUpColor: GAIN,
      wickDownColor: LOSS,
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

    if (markers.length) {
      const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
        time: m.time as Time,
        position: m.kind === "entry" ? "belowBar" : "aboveBar",
        color: m.kind === "entry" ? ACCENT : LOSS,
        shape: m.kind === "entry" ? "arrowUp" : "arrowDown",
        text: m.label,
      }));
      createSeriesMarkers(series, seriesMarkers);
    }

    if (stopPrice !== null && Number.isFinite(stopPrice)) {
      series.createPriceLine({
        price: stopPrice,
        color: LOSS,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "stop",
      });
    }

    chart.timeScale().fitContent();

    // Re-skin when the theme toggles.
    const observer = new MutationObserver(() => {
      const t = readTokens();
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: t.text,
        },
        grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      });
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
