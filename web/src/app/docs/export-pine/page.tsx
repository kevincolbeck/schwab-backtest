import { Callout, DocsFooterNav, Step, Steps } from "@/components/docs/DocsBits";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Export to Pine Script — Docs — Chat·Backtest",
  description:
    "Turn a strategy spec into a Pine Script v6 strategy for TradingView: the download flow, alerts on your own rules, and why results will differ.",
  path: "/docs/export-pine",
});

export default function ExportPinePage() {
  return (
    <>
      <h1>Export to Pine Script</h1>
      <p>Run the same rules on TradingView — on your chart, in your account.</p>

      <p>
        The Pine export compiles your strategy spec into a complete Pine Script
        v6 <code>strategy()</code> — deterministically, with no model in the
        loop. Indicators, entry and exit rules, stops, targets, time exits, and
        position sizing all translate into their closest Pine equivalents, and
        anything that cannot be expressed faithfully is flagged instead of
        silently dropped. The point is portability: the rules you tested here
        become a file you own and run on tools we do not control.
      </p>

      <h2>From the lab to a TradingView chart</h2>
      <Steps>
        <Step n={1} title="Download the script from the Rules tab">
          In the lab, open the <strong>Rules</strong> tab and click{" "}
          <strong>↓ Pine Script (.pine)</strong>. If parts of your strategy need
          manual attention on TradingView, a note above the rules lists them
          before you download — the same items appear as{" "}
          <code>{"// TODO"}</code> comments inside the file.
        </Step>
        <Step n={2} title="Open a chart of one of your symbols">
          On TradingView, open a chart for a symbol from your spec and set the
          chart timeframe to match the spec’s timeframe (a daily strategy on a
          daily chart, a 15m strategy on a 15m chart).
        </Step>
        <Step n={3} title="Paste into the Pine Editor">
          Open the <strong>Pine Editor</strong> panel, replace its contents with
          the downloaded file, and save.
        </Step>
        <Step n={4} title="Add to chart">
          Click <strong>Add to chart</strong>. Entry and exit markers appear on
          the chart wherever the rules fired on that symbol’s history.
        </Step>
        <Step n={5} title="Open the Strategy Tester">
          The <strong>Strategy Tester</strong> tab shows TradingView’s own
          simulation of the script: trade list, equity curve, and summary
          statistics — computed by TradingView, on TradingView’s data.
        </Step>
      </Steps>

      <p>A daily golden-cross spec, for example, comes out like this (abbreviated):</p>
      <pre>
        <code>{`//@version=6
// Golden Cross — exported from chat-to-backtest
// Historical/paper simulation for research and education. Not financial advice.
// Past performance does not predict future results.
//
// Backtest results on TradingView will differ from chat-to-backtest —
// different fill models and data.
strategy("Golden Cross", overlay = true, initial_capital = 100000,
     default_qty_type = strategy.percent_of_equity, default_qty_value = 20,
     pyramiding = 0, process_orders_on_close = false)

// ── Indicators ──
sma_50 = ta.sma(close, 50)
sma_200 = ta.sma(close, 200)

// ── Rules ──
enterLong = ( sma_50 > sma_200 ) and ( sma_50[1] <= sma_200[1] )
exitSignal = sma_50 < sma_200`}</code>
      </pre>

      <h2>Getting notified when your rules fire</h2>
      <p>
        Once the strategy is on your chart, TradingView can alert you when it
        places a simulated order: create an alert on the strategy (Add alert →
        select the strategy as the condition) and choose how you want to be
        notified — app push, email, or webhook. That alert is created in your
        TradingView account, runs on their servers, and answers to nobody but
        you.
      </p>
      <p>
        This is the intended division of labor: Chat·Backtest never pings you
        about the market. If you want to be told when <em>your own rules</em>{" "}
        fire, you set that up yourself, on your own tools — the export exists so
        that takes minutes instead of an evening of transcription.
      </p>
      <p>
        Some traders go further and route TradingView alert webhooks into
        third-party broker bridges so that alerts place real orders. That is a
        decision entirely between you, TradingView, and the bridge vendor — we
        have no part in the chain and no visibility into it. If you choose that
        route, it is your integration and your responsibility; run it against a
        paper account until you have watched it behave through enough sessions
        to trust it.
      </p>

      <h2>Why the results will differ</h2>
      <Callout kind="honest" title="Two simulators, two answers">
        <p>
          The numbers in TradingView’s Strategy Tester will not match your
          backtest here, and neither one is “the truth.” Different fill models:
          our engine fills at the spec’s entry price field with a fixed slippage
          charge, TradingView applies its own order mechanics (and where the
          spec fills at the open of the bar that fired the entry, the export
          uses TradingView’s closest equivalent — the next bar’s open). Different data: two vendors
          rarely agree on every candle, split, or dividend adjustment. Treat
          agreement in direction as confirmation and disagreement in decimals as
          normal.
        </p>
      </Callout>
      <p>
        There is also a structural difference for multi-symbol strategies. The
        spec runs as a portfolio — a shared pool of capital, a position cap,
        ranking when more setups fire than slots exist. Pine runs on one chart
        symbol at a time. The per-trade rules translate faithfully, but
        portfolio-level selection (<code>max_positions</code>, ranking) does not
        apply on a single chart; the generated header says so, and the practical
        move is to add the script to each symbol’s chart separately.
      </p>

      <h2>What translates, and what becomes a TODO</h2>
      <p>
        The translator covers the engine’s rule grammar: moving averages
        (simple and exponential), RSI, ATR, z-score, standard deviation,
        rolling highs and lows, lags and lookbacks, percent change,
        cross-above/cross-below, day-of-week and month conditions, percent and
        indicator-distance stops, profit targets, and time exits.
      </p>
      <p>
        Anything outside that boundary is surfaced, never dropped. Each case
        becomes a <code>{"// TODO"}</code> comment in the file carrying the
        original expression, and the same list is shown in the Rules tab before
        you download. The common ones:
      </p>
      <ul>
        <li>
          <strong>Cross-symbol references</strong> (a rule that reads SPY’s
          close from another symbol’s chart) need a{" "}
          <code>request.security()</code> call you wire up on TradingView — the
          TODO includes the exact line to use.
        </li>
        <li>
          <strong>Risk-based position sizing</strong> has no direct Pine
          equivalent; the export ships with percent-of-equity sizing and a TODO
          explaining the difference.
        </li>
        <li>
          <strong>Entry at the bar’s high or low</strong> cannot be reproduced
          by TradingView’s order model; the export fills at the next bar’s open
          and says so in the header.
        </li>
        <li>
          <strong>Unrecognized functions or identifiers</strong> are left in
          place with a TODO naming them, so you can translate by hand rather
          than trust a guess.
        </li>
      </ul>
      <Callout kind="note">
        <p>
          Before relying on an exported script, search it for{" "}
          <code>TODO</code>. A clean file means the whole strategy translated;
          each hit is one construct that needs your attention on the
          TradingView side.
        </p>
      </Callout>

      <DocsFooterNav
        prev={{ href: "/docs/forward-testing", label: "Forward testing" }}
        next={{ href: "/docs/export-python", label: "Export to Python" }}
      />
    </>
  );
}
