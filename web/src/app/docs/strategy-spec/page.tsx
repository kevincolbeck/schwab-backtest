import Link from "next/link";
import { Callout, DocsFooterNav } from "@/components/docs/DocsBits";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "The strategy spec — Docs — Chat·Backtest",
  description:
    "The anatomy of a strategy: indicators, the entry and exit rule grammar with real examples, stops, sizing, and where the raw JSON spec lives.",
  path: "/docs/strategy-spec",
});

const EXAMPLE_SPEC = `{
  "name": "Golden cross with RSI filter",
  "symbols": ["AAPL", "MSFT", "SPY"],
  "indicators": [
    { "name": "sma_50",  "type": "sma", "source": "close", "length": 50 },
    { "name": "sma_200", "type": "sma", "source": "close", "length": 200 },
    { "name": "rsi_14",  "type": "rsi", "source": "close", "length": 14 }
  ],
  "entry_rule_long": "crosses_above(sma_50, sma_200) & rsi_14 > 50",
  "exit_rule": "close < sma_50",
  "backtest_timeframe": "1d",
  "position_size_mode": "notional_pct",
  "position_size_pct": 10,
  "max_positions": 5,
  "stop_loss_pct": 8,
  "take_profit_pct": 0,
  "max_holding_days": 0
}`;

export default function DocsStrategySpecPage() {
  return (
    <>
      <h1>The strategy spec</h1>
      <p>
        Everything the chat builds and the engine runs is one JSON object: the
        spec. The chat edits it, validation guards it, the ledger freezes it,
        and exports carry it. Once you can read a spec, nothing in this product
        is a black box.
      </p>

      <h2>The shape of a spec</h2>
      <pre>
        <code>{EXAMPLE_SPEC}</code>
      </pre>
      <p>
        Reading top to bottom: trade three symbols on daily bars; go long when
        the 50-day average crosses above the 200-day and the 14-day RSI is above
        50; exit when price loses the 50-day average; put 10% of equity in each
        position, hold up to five at once, with a hard 8% stop. Zero means
        “disabled” for the stop, take-profit, and holding-period fields. Two
        fields not shown: <code>entry_price_field</code>{" "}picks which price of
        the triggering bar fills the entry (<code>open</code>,{" "}
        <code>high</code>, <code>low</code>, or the default <code>close</code>),
        and <code>entry_rule_short</code>{" "}defines a short side with the same
        grammar.
      </p>

      <h2>Indicators</h2>
      <p>
        Indicators are named columns computed before the rules run. The{" "}
        <code>name_length</code>{" "}convention (<code>sma_50</code>,{" "}
        <code>rsi_14</code>) is what your rules reference — and when a chat edit
        mentions a simple indicator that does not exist yet, it is added
        automatically.
      </p>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>What it computes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>sma</code>
            </td>
            <td>Simple moving average of the source over N bars</td>
          </tr>
          <tr>
            <td>
              <code>ema</code>
            </td>
            <td>Exponential moving average — recent bars weigh more</td>
          </tr>
          <tr>
            <td>
              <code>rsi</code>
            </td>
            <td>
              Relative strength index, 0–100 — how one-sided recent gains versus
              losses have been
            </td>
          </tr>
          <tr>
            <td>
              <code>zscore</code>
            </td>
            <td>
              How many standard deviations the current value sits from its
              rolling mean
            </td>
          </tr>
          <tr>
            <td>
              <code>atr</code>
            </td>
            <td>
              Average true range — the typical bar-to-bar movement, a volatility
              yardstick
            </td>
          </tr>
          <tr>
            <td>
              <code>stddev</code>
            </td>
            <td>Rolling standard deviation of the source</td>
          </tr>
          <tr>
            <td>
              <code>rolling_max</code> / <code>rolling_min</code>
            </td>
            <td>Highest / lowest value over the window (e.g. the 252-day high)</td>
          </tr>
          <tr>
            <td>
              <code>lag</code>
            </td>
            <td>The value of a column N bars ago</td>
          </tr>
          <tr>
            <td>
              <code>vwap_proxy</code>
            </td>
            <td>A volume-weighted average price approximation</td>
          </tr>
          <tr>
            <td>
              <code>custom</code>
            </td>
            <td>
              Your own formula over existing columns, e.g.{" "}
              <code>{"close / sma_100"}</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>external</code>
            </td>
            <td>
              A column borrowed from another symbol — SPY&rsquo;s close as{" "}
              <code>spy_close</code>, for market-regime filters
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Entry and exit rules</h2>
      <p>
        Rules are boolean expressions over the data columns: prices (
        <code>open</code>, <code>high</code>, <code>low</code>,{" "}
        <code>close</code>, <code>volume</code>), your indicators, and calendar
        columns (<code>month</code>{" "}1–12, <code>day_of_week</code>{" "}where 0 is
        Monday, <code>year</code>). Combine comparisons with{" "}
        <code>&amp;</code> (and), <code>|</code> (or), <code>~</code> (not), and
        parentheses — the words <code>and</code> / <code>or</code>{" "}work too.
        The allowed functions are <code>abs</code>, <code>min</code>,{" "}
        <code>max</code>, <code>sma</code>, <code>ema</code>, <code>rsi</code>,{" "}
        <code>zscore</code>, <code>atr</code>, <code>lag</code>,{" "}
        <code>pct_change</code>, <code>crosses_above</code>, and{" "}
        <code>crosses_below</code>. <code>close[N]</code>{" "}is shorthand for{" "}
        <code>{"lag(close, N)"}</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Expression</th>
            <th>Reads as</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>{"crosses_above(sma_50, sma_200)"}</code>
            </td>
            <td>
              The 50-day average crosses above the 200-day — the classic golden
              cross
            </td>
          </tr>
          <tr>
            <td>
              <code>{"close > sma_20 & rsi_14 > 55"}</code>
            </td>
            <td>Price above its 20-day average and RSI above 55</td>
          </tr>
          <tr>
            <td>
              <code>{"pct_change(close, 5) > 0.03"}</code>
            </td>
            <td>Price rose more than 3% over the last 5 bars</td>
          </tr>
          <tr>
            <td>
              <code>{"close > close[20] * 1.10"}</code>
            </td>
            <td>Price at least 10% above where it was 20 bars ago</td>
          </tr>
          <tr>
            <td>
              <code>{"month == 5"}</code>
            </td>
            <td>Only bars in May — seasonal rules are just calendar columns</td>
          </tr>
          <tr>
            <td>
              <code>{"day_of_week == 0"}</code>
            </td>
            <td>Mondays only</td>
          </tr>
          <tr>
            <td>
              <code>{"close < entry_price * 0.95"}</code>
            </td>
            <td>Exit rule: price is 5% below what the position paid</td>
          </tr>
          <tr>
            <td>
              <code>{"days_held >= 10 & close < sma_20"}</code>
            </td>
            <td>
              Exit rule: held at least 10 days and price lost its 20-day
              average
            </td>
          </tr>
        </tbody>
      </table>

      <h3>Position context in exit rules</h3>
      <p>
        Exit rules see the open position as extra variables:{" "}
        <code>entry_price</code>, <code>days_held</code>,{" "}
        <code>current_stop</code>, <code>initial_stop</code>,{" "}
        <code>r_value</code> (the dollar distance from entry to the initial
        stop), <code>shares</code>, and <code>position_side</code>{" "}with the{" "}
        <code>is_long</code> / <code>is_short</code>{" "}shorthands. Entry rules
        cannot see any of these — there is no position yet.
      </p>

      <h2>Stops, take-profit, and time exits</h2>
      <ul>
        <li>
          <code>stop_loss_pct</code> (0–50, 0 disables) — a hard stop below the
          entry price (above it, for shorts). Checked against each bar&rsquo;s
          low or high, so it can trigger mid-bar; the fill is simulated at the
          stop price plus slippage.
        </li>
        <li>
          <code>take_profit_pct</code> (0–500, 0 disables) — the mirror image on
          the profit side.
        </li>
        <li>
          <code>max_holding_days</code> (0–365, 0 disables) — closes the
          position at that bar&rsquo;s close regardless of anything else.
        </li>
      </ul>
      <p>
        For an open position the engine checks in a fixed order: stop-loss
        first, then take-profit, then the time exit, then your{" "}
        <code>exit_rule</code> — which is evaluated at the close of the bar.
        Each closed trade records which exit fired, and the results report
        breaks performance down by exit reason.
      </p>

      <h2>Position sizing</h2>
      <ul>
        <li>
          <code>notional_pct</code> — each position uses{" "}
          <code>position_size_pct</code>{" "}percent of current equity (1–100).
          Simple and predictable.
        </li>
        <li>
          <code>risk_pct</code> — each trade risks{" "}
          <code>risk_per_trade_pct</code>{" "}percent of equity (0.05–10), and the
          share count is derived from the distance between entry and stop. A
          wider stop means a smaller position; every trade risks roughly the
          same dollars.
        </li>
      </ul>
      <p>
        <code>max_positions</code> (1–20) caps how many positions are open at
        once, and the optional <code>ranking_field</code>{" "}names an indicator
        used to rank candidates when more entries qualify than there are open
        slots. One sizing smell worth knowing: if position size × max positions
        goes far past 100% of equity, the backtest is quietly assuming leverage
        — the chat will warn you when it sees this.
      </p>

      <h2>Where you see it in the lab</h2>
      <p>
        The <strong>Rules</strong>{" "}tab of the workspace shows the same strategy
        three ways: a plain-English translation of the rules (with an AI-polished
        version when available), the raw JSON of the spec as it was actually
        run, and a download button that saves it as <code>strategy.json</code>.
        The English version is meant to be complete enough to{" "}
        <Link href="/docs/manual-trading">trade by hand</Link>, and the JSON is
        exactly what <Link href="/docs/export-python">exports</Link>{" "}embed —
        there is no hidden version of your strategy anywhere.
      </p>

      <Callout kind="warn" title="Rules are validated and sandboxed">
        <p>
          Every rule and formula is parsed and checked before it runs: numeric
          fields are clamped to their documented bounds, tickers must match a
          strict format, and expressions are validated against an allowlist of
          the functions and operators above. Anything code-like — imports,
          attribute access, method calls, double underscores — is rejected by
          design, no matter who or what wrote the spec. If an idea cannot be
          said in this grammar, the engine will not run it.
        </p>
      </Callout>

      <DocsFooterNav
        prev={{ href: "/docs/markets-timeframes", label: "Markets & timeframes" }}
        next={{ href: "/docs/forward-testing", label: "Forward testing" }}
      />
    </>
  );
}
