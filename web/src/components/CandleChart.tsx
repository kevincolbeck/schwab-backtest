"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  readChartTokens,
  seriesColor,
  useChartTokens,
  type ChartTokens,
} from "@/components/chartTokens";
import type { IndicatorSeries } from "@/lib/types";

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

/** Indicator line data clipped to the visible bar window; null values become
 *  whitespace points so warm-up periods render as gaps, never as zeros. */
function indicatorData(
  ind: IndicatorSeries,
  lo: string,
  hi: string,
): Array<{ time: Time } | { time: Time; value: number }> {
  return ind.series
    .filter((p) => p.time >= lo && p.time <= hi)
    .map((p) =>
      p.value !== null && Number.isFinite(p.value)
        ? { time: p.time as Time, value: p.value }
        : { time: p.time as Time },
    );
}

/** TradingView lightweight-charts candlesticks with entry/exit markers, an
 *  optional stop-price line, and the run's spec-driven indicators: overlays
 *  share the price scale, pane indicators live in ONE sub-pane below. All
 *  colors resolve from the design tokens at runtime and re-skin on
 *  data-theme changes (SYSTEM.md §10); indicator lines take the --chart-N
 *  categorical ramp in fixed order, mirrored by the legend chips above. */
export default function CandleChart({
  bars,
  markers = [],
  stopPrice = null,
  indicators = [],
  height = 340,
}: {
  bars: Bar[];
  markers?: TradeMarker[];
  stopPrice?: number | null;
  indicators?: IndicatorSeries[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // Theme-reactive tokens for the DOM legend (the canvas re-skins itself via
  // the MutationObserver below; the legend re-renders through this hook).
  const legendTokens = useChartTokens();

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
        panes: {
          separatorColor: tokens.hairline,
          separatorHoverColor: tokens.hairline,
        },
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

    // Indicator lines: overlays on the price pane (0), every pane indicator
    // in ONE shared sub-pane (1). Color index = position in the indicators
    // array, so the legend chips and lines always agree, spec-driven only.
    const loTime = bars[0].time;
    const hiTime = bars[bars.length - 1].time;
    const indicatorLines: Array<{ api: ISeriesApi<"Line">; colorIndex: number }> = [];
    let hasPane = false;
    indicators.forEach((ind, i) => {
      const data = indicatorData(ind, loTime, hiTime);
      if (!data.some((d) => "value" in d)) return; // nothing visible to draw
      const pane = ind.kind === "pane" ? 1 : 0;
      const line = chart.addSeries(
        LineSeries,
        {
          color: seriesColor(tokens, i),
          lineWidth: 2,
          title: ind.label,
          priceLineVisible: false,
          crosshairMarkerRadius: 3,
        },
        pane,
      );
      line.setData(data);
      if (pane === 1) {
        hasPane = true;
        line.priceScale().applyOptions({ borderVisible: false });
      }
      indicatorLines.push({ api: line, colorIndex: i });
    });
    if (hasPane) {
      const panes = chart.panes();
      // Price stays the hero: ~3/4 to candles, ~1/4 to the indicator pane.
      panes[0]?.setStretchFactor(3);
      panes[1]?.setStretchFactor(1);
    }

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
          panes: { separatorColor: t.hairline, separatorHoverColor: t.hairline },
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
      indicatorLines.forEach(({ api, colorIndex }) =>
        api.applyOptions({ color: seriesColor(t, colorIndex) }),
      );
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
  }, [bars, markers, stopPrice, indicators, height]);

  if (!bars.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted">
        No price data available.
      </div>
    );
  }
  return (
    <div>
      {indicators.length > 0 && (
        <div
          className="mb-2 flex flex-wrap items-center gap-1.5"
          aria-label="Indicators on this chart"
        >
          {indicators.map((ind, i) => (
            <span
              key={ind.name}
              className="flex items-center gap-1.5 rounded-(--radius-pill) border border-hairline px-2 py-0.5 text-caption text-muted"
            >
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-3 rounded-(--radius-pill)"
                style={{ backgroundColor: seriesColor(legendTokens, i) }}
              />
              <span className="tnum">{ind.label}</span>
            </span>
          ))}
        </div>
      )}
      <div ref={containerRef} style={{ height }} aria-label="Candlestick chart" role="img" />
    </div>
  );
}

// UTCTimestamp import kept for future intraday bars (Phase C).
export type { UTCTimestamp };
