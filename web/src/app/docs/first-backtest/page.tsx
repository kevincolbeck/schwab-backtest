import { Callout, DocsFooterNav, Step, Steps } from "@/components/docs/DocsBits";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Your first backtest — Docs — Chat·Backtest",
  description:
    "Your first backtest end to end, no account needed: pick a template or describe an idea, edit it by chat, run it, and read the four result tabs.",
  path: "/docs/first-backtest",
});

export default function FirstBacktestPage() {
  return (
    <>
      <h1>Your first backtest</h1>
      <p>
        The whole loop, once, end to end: open the lab, pick or describe a
        strategy, refine it in chat, run it against history, and read the
        report. Your first backtest needs no account at all.
      </p>

      <Steps>
        <Step n={1} title="Open the lab">
          <p>
            Head to <a href="/playground">the lab</a> — no sign-in needed. It
            has three zones: a left rail with strategy templates and a
            &ldquo;New from scratch&rdquo; button, a center workspace with four
            tabs, and the AI chat docked on the right. The toolbar on top holds
            the date range, the bar-timeframe selector, and the Run button —
            no usage counter anywhere, by design. Daily-bar templates run free
            without an account — up to 10 a day per visitor — with 3 free AI
            messages to edit them.
          </p>
        </Step>

        <Step n={2} title="Pick a starting point">
          <p>Two ways in:</p>
          <ul>
            <li>
              <strong>A template.</strong>{" "}The left rail lists ready-made
              strategies with their category and historical result — CAGR when
              a year-plus window backs it, the window&apos;s total return for
              short intraday tests.
              They are working examples to take apart, not recommendations.
              Click one and its rules load instantly.
            </li>
            <li>
              <strong>New from scratch.</strong>{" "}The chat runs a guided intake
              — market, then timeframe, then entry, then exits and stops, then
              position sizing — and builds a live draft as you answer. It
              fills gaps with placeholder defaults and tells you which parts
              are placeholders, so nothing is hidden. The Rules tab shows the
              draft in plain English at any point.
            </li>
          </ul>
        </Step>

        <Step n={3} title="Edit by chat">
          <p>
            Ask for changes in plain English — the more specific, the better:
            &ldquo;tighten the stop from 8% to 5%&rdquo; beats &ldquo;make it
            safer.&rdquo; Every accepted edit shows change pills listing
            exactly which fields changed and from what to what, and the spec
            is validated server-side before it can run. As you build, the AI
            flags known failure patterns — look-ahead bias, overtight stops,
            unrealistic sizing — as short teaching notes rather than blocks.
            Without an account you get <strong>3 free messages a day</strong> —
            enough to feel an edit-and-rerun loop.
          </p>
        </Step>

        <Step n={4} title="Run it">
          <p>
            Hit <strong>Run backtest</strong>. The default window is January
            2016 to today on daily bars — about ten years of data, usually
            finished in seconds (the elapsed time appears next to the button).
            If you switch to an intraday timeframe, history is capped at
            roughly 60 days and the start date adjusts automatically.
          </p>
        </Step>

        <Step n={5} title="Read the report">
          <p>
            Results land in the four tabs of the center workspace — toured
            below. Rerun after an edit and the tiles show deltas against the
            previous run, with the old equity curve kept on the chart for
            comparison.
          </p>
        </Step>

        <Step n={6} title="Create a free account when you're ready to keep it">
          <p>
            Deploying to the public ledger, exporting the code, chatting past
            the free taste, and running custom or intraday strategies all take
            a free account — continue with Google or Discord, or enter your
            email for a sign-in link, no password to invent. Free accounts run{" "}
            <strong>unlimited backtests on daily data</strong> (a generous
            fair-use cap exists to stop scripts, not people), no card
            required; the <a href="/docs/credits">Plans &amp; limits</a>{" "}page
            explains what each tier unlocks.
          </p>
        </Step>
      </Steps>

      <Callout kind="honest" title="What a first run is for">
        <p>
          Don&rsquo;t hunt for a winner today. First runs are most useful when
          they surprise you: a stop that triggers constantly, an entry rule
          that never fires, ten years of data producing eight trades. Finding
          out what breaks — and understanding why — is the product working,
          not failing. Winners can wait until you trust your own process.
        </p>
      </Callout>

      <h2>The four tabs</h2>

      <h3>Results</h3>
      <p>
        Metric tiles — total return, CAGR, max drawdown, Sharpe, win rate,
        trade count, profit factor, expectancy — each with a plain-English
        tooltip, above the equity curve with drawdown charted beneath it. After
        a second run, each tile shows its change labeled <em>better</em>{" "}or{" "}
        <em>worse</em>, and the previous run&rsquo;s curve stays overlaid in a
        second color. The <a href="/docs/reading-results">next page</a>{" "}covers
        every metric in depth.
      </p>

      <h3>Trades</h3>
      <p>
        Every round trip the strategy took: entry and exit dates and prices,
        profit or loss, and the exit reason. Click any row to open a
        candlestick inspector with the exact entry and exit candles marked —
        the fastest way to see whether a trade made sense or just got lucky.
      </p>

      <h3>Chart</h3>
      <p>
        The full price history for each traded symbol with every entry (▲) and
        exit (▼) overlaid. Switch symbols with the pills above the chart to
        see how the same rules behaved on different names.
      </p>

      <h3>Rules</h3>
      <p>
        The strategy in plain English — universe, entry, exits, sizing —
        written so you could trade it by hand, plus the exact spec JSON the
        engine ran (no black box). Download buttons export a runnable Python
        file, a Pine Script version for TradingView, or the raw spec.
      </p>

      <h2>After the run</h2>
      <p>
        Two buttons appear next to the tabs once a run exists:{" "}
        <strong>Share</strong>{" "}copies a link to this exact result (works
        without an account — anonymous shares carry a watermark), and{" "}
        <strong>Deploy to forward test</strong>{" "}freezes the strategy on the
        public ledger, where it accrues a track record on data nobody had when
        it was built. Deploying needs a free account — it puts a name on a
        public record. That step deserves its own page —{" "}
        <a href="/docs/forward-testing">Forward testing</a>.
      </p>

      <Callout kind="note" title="What this costs">
        <p>
          Nothing, on daily data. Backtests on daily bars are unlimited on
          every plan — including free — and anonymously up to 10 a day
          without an account. Paid plans unlock capabilities rather than
          volume: intraday timeframes and bigger universes on Pro, the full US
          universe and crypto on Max. Generous per-day fair-use limits run
          quietly in the background to stop scripts; you&rsquo;ll never watch
          a counter drain. Details on the{" "}
          <a href="/docs/credits">Plans &amp; limits</a>{" "}page.
        </p>
      </Callout>

      <DocsFooterNav
        prev={{ href: "/docs", label: "Introduction" }}
        next={{ href: "/docs/reading-results", label: "Reading the results" }}
      />
    </>
  );
}
