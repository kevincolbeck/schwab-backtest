import Link from "next/link";
import { Callout, DocsFooterNav } from "@/components/docs/DocsBits";

export const metadata = {
  title: "Markets & timeframes",
  description:
    "What you can test on: US stocks and ETFs, crypto tickers, timeframes from 1-minute to daily, the honest 60-day intraday cap, and why everything runs on settled candles.",
};

export default function DocsMarketsTimeframesPage() {
  return (
    <>
      <h1>Markets &amp; timeframes</h1>
      <p>
        What data the lab can test on, at what granularity, and — because this
        matters more than the brochure version — exactly where the limits are.
      </p>

      <h2>US stocks and ETFs</h2>
      <p>
        Any US-listed stock or ETF works by ticker: <code>AAPL</code>,{" "}
        <code>QQQ</code>, <code>BRK.B</code>. The data cache serves more than
        5,000 listed symbols. Type tickers into the symbol controls or just tell
        the chat — “add NVDA and drop TSLA” is a valid edit. How many symbols a
        single run may include depends on your plan; see{" "}
        <Link href="/docs/credits">Plans &amp; limits</Link>.
      </p>

      <h3>The ALL_US universe</h3>
      <p>
        Setting the symbol list to <code>ALL_US</code> scans a broad universe of
        currently listed US common stocks instead of a hand-picked list. The
        universe is built from public exchange listings and filters out
        warrants, preferred shares, and fund products; each run takes a capped
        slice (200 symbols) so results come back in seconds. This is a Max plan
        feature — a universe scan asks far more of the engine than a
        five-symbol test.
      </p>
      <p>
        One honest reason to care about universe scans: testing on a hand-picked
        list of famous winners is the classic way backtests flatter themselves.
        A broad universe is the antidote.
      </p>

      <h2>Crypto</h2>
      <p>
        Crypto uses Polygon-style tickers with an <code>X:</code> prefix —{" "}
        <code>X:BTCUSD</code>, <code>X:ETHUSD</code>. Crypto strategies test on
        daily bars. These markets trade 24/7, and the engine treats them that
        way: no trading-day filter, candles on weekends, and days bucketed at
        UTC boundaries — so calendar rules like <code>month</code> and{" "}
        <code>day_of_week</code> refer to UTC days.
      </p>
      <Callout kind="honest" title="Crypto is still benchmarked against SPY">
        <p>
          Every run today uses SPY as its benchmark — including crypto runs.
          That is a stock-market index on a five-day week plotted next to an
          asset that trades every day of the year, so read the comparison as
          rough context, not a fair race. A proper crypto benchmark is on the
          roadmap; until it ships, we would rather tell you than pretend.
        </p>
      </Callout>

      <h2>Timeframes</h2>
      <p>
        Six bar sizes are supported. Set them from the timeframe control or by
        asking the chat.
      </p>
      <table>
        <thead>
          <tr>
            <th>Timeframe</th>
            <th>Bars</th>
            <th>History per run</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>1d</code> (default)
            </td>
            <td>Daily</td>
            <td>Whatever range you pick — the default starts January 2016</td>
          </tr>
          <tr>
            <td>
              <code>60m</code> / <code>30m</code> / <code>15m</code>
            </td>
            <td>Intraday</td>
            <td>Up to 60 days</td>
          </tr>
          <tr>
            <td>
              <code>5m</code> / <code>1m</code>
            </td>
            <td>Intraday</td>
            <td>Up to 60 days</td>
          </tr>
        </tbody>
      </table>
      <p>
        Intraday data is the genuinely expensive thing in this product, so
        it&rsquo;s a plan capability rather than a per-run charge: Pro and Max
        unlock every timeframe down to 1m, with no per-run cost once
        you&rsquo;re on them. See{" "}
        <Link href="/docs/credits">Plans &amp; limits</Link>.
      </p>

      <h2>The 60-day intraday cap</h2>
      <p>
        Intraday runs are rejected server-side when the requested date range
        spans more than 60 days — you get a clear validation error telling you
        to tighten the range, and when you switch timeframes in chat, the
        assistant shrinks the range for you and says why.
      </p>
      <Callout kind="honest" title="Why the cap exists">
        <p>
          Our current data plans serve a limited intraday window. We could hide
          that — quietly pad ranges, fail on random symbols, or resample daily
          data and call it intraday. Instead the cap is explicit. Note that 60
          days of 5-minute bars is still thousands of candles per symbol, so
          intraday tests are not starved for bars — but they do cover only a
          short slice of market conditions. Be careful generalizing from one
          good month.
        </p>
      </Callout>

      <h2>The benchmark</h2>
      <p>
        Every run automatically includes SPY as a benchmark, even when it is not
        in your symbol list. Its buy-and-hold curve is plotted next to your
        equity curve so you always see what doing nothing clever would have
        returned over the same window. The benchmark rides along free — it does
        not count as a billable symbol.
      </p>

      <h2>Settled candles only</h2>
      <p>
        Everything in this product runs on completed OHLCV candles — bars that
        have closed and settled. There is no live tick feed, no streaming
        quotes, nothing that changes after you look at it. Fills are simulated
        at bar prices with slippage applied against you; stops are checked
        against each bar&rsquo;s high and low.
      </p>
      <p>
        This is a philosophy, not just a data plumbing detail. Numbers computed
        from closed bars are reproducible: run the same spec on the same range
        twice and you get the same answer. The{" "}
        <Link href="/docs/forward-testing">forward ledger</Link> works the same
        way — deployed strategies are scored on closed bars after the day ends,
        which is what makes its track records auditable rather than vibes.
      </p>

      <DocsFooterNav
        prev={{ href: "/docs/chat", label: "Building by chat" }}
        next={{ href: "/docs/strategy-spec", label: "The strategy spec" }}
      />
    </>
  );
}
