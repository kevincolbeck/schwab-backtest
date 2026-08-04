import { Callout, DocsFooterNav } from "@/components/docs/DocsBits";

export const metadata = {
  title: "Reading the results",
  description:
    "Every backtest metric in plain English, how run-to-run comparison works, and — most important — what a backtest can't tell you.",
};

export default function ReadingResultsPage() {
  return (
    <>
      <h1>Reading the results</h1>
      <p>
        What each number means, how run-to-run comparison works, and the list
        of things no backtest can tell you — the part worth reading twice.
      </p>

      <h2>The metrics</h2>
      <p>
        The Results tab shows these as tiles, each with a tooltip. Here they
        are with more room to breathe:
      </p>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Plain English</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total return</td>
            <td>
              How much the starting capital grew (or shrank) over the whole
              test, after the slippage assumption. It ignores how long the
              test ran and how rough the ride was — a raw before/after number.
            </td>
          </tr>
          <tr>
            <td>CAGR</td>
            <td>
              Compound annual growth rate — the smoothed per-year return. This
              is how you compare a 3-year run against a 10-year run fairly.
            </td>
          </tr>
          <tr>
            <td>Max drawdown</td>
            <td>
              The worst peak-to-bottom drop in the equity curve. The pain
              number: a strategy that ends up 80% but spent a year down 35%
              only worked for someone who held on through the hole.
            </td>
          </tr>
          <tr>
            <td>Sharpe</td>
            <td>
              Return per unit of volatility, annualized from daily returns.
              Above 1 is generally considered good. It penalizes all swings —
              a big up month hurts Sharpe the same as a big down month.
            </td>
          </tr>
          <tr>
            <td>Sortino</td>
            <td>
              Sharpe&rsquo;s fairer sibling: only downside volatility counts.
              A strategy with sharp rallies and shallow dips scores better
              here than on Sharpe.
            </td>
          </tr>
          <tr>
            <td>Win rate</td>
            <td>
              The share of trades that closed with a profit. A high win rate
              alone proves nothing: many small wins plus a few huge losses is
              a losing strategy with a comforting win rate.
            </td>
          </tr>
          <tr>
            <td>Profit factor</td>
            <td>
              Gross profits divided by gross losses. Above 1.0 means net
              profitable. A run with no losing trades at all shows no ceiling
              here — treat that as suspicious, not brilliant; it usually
              means too few trades.
            </td>
          </tr>
          <tr>
            <td>Trades</td>
            <td>
              The number of round trips in the test — the sample size behind
              every other number on this page.
            </td>
          </tr>
          <tr>
            <td>Expectancy (R)</td>
            <td>
              The average result per trade measured in units of initial risk,
              where 1R is the distance from entry to your stop. +0.25R means
              the average trade made a quarter of what it risked.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        No single metric is the verdict. A useful habit: check trade count
        first (is there enough evidence to say anything?), then max drawdown
        (could you have lived through it?), and only then the return numbers.
      </p>

      <h2>Comparing runs</h2>
      <p>
        When you rerun after an edit, two things happen. Each tile grows a
        delta — ▲ or ▼ with the change, labeled <em>better</em> or{" "}
        <em>worse</em>, because the arrow alone is ambiguous (▲ on max
        drawdown is a worse result). And the previous run&rsquo;s equity curve
        stays on the chart in a second color, so you see the change in shape,
        not just the change in endpoints: a tweak can raise total return while
        making the whole ride wilder.
      </p>

      <h3>When comparison is suppressed</h3>
      <p>
        If the date range or the bar timeframe changed between two runs, the
        deltas and the overlay curve are hidden and a note says why. That is
        deliberate. A run over 2020 and a run over 2016–2026 are tests of
        different markets — the strategy didn&rsquo;t improve, the exam
        changed. Likewise a 15-minute-bar run and a daily-bar run are
        different games with different trade counts and dynamics. The lab
        refuses to show apples-to-oranges arithmetic rather than let it
        mislead you. Rerun with the same window and timeframe and the
        comparison comes back.
      </p>

      <h2>What a backtest can&rsquo;t tell you</h2>
      <p>
        The AI in the lab watches for these same patterns while you build and
        flags them in chat — the list below and its warnings come from the
        same playbook, so the docs and the assistant agree.
      </p>
      <ul>
        <li>
          <strong>Overfitting.</strong> Every tweak that improves this
          backtest is also a chance you&rsquo;ve fit noise instead of a real
          effect. The more you tune to make the past look good, the more
          you&rsquo;ve learned about the past — not the future. This risk
          compounds quietly across a long chat session of &ldquo;what if we
          just...&rdquo; edits.
        </li>
        <li>
          <strong>Survivorship bias.</strong> Hand-picking symbols that are
          famous winners <em>today</em> bakes tomorrow&rsquo;s knowledge into
          yesterday&rsquo;s universe. Of course a momentum strategy on the
          2026 giants looked great in 2016 — you chose them because they won.
        </li>
        <li>
          <strong>Regime change.</strong> Rules learned in one kind of market
          can stop working when the market changes character. Ten years of
          data is still mostly one regime with interruptions; a strategy
          tuned to it has never met the next one.
        </li>
        <li>
          <strong>Slippage reality.</strong> The simulation assumes a flat
          0.05% slippage per fill. Real fills depend on liquidity, spread,
          order size, and speed — and diverge most exactly where backtests
          look best: fast moves, thin names, intraday timeframes.
        </li>
        <li>
          <strong>Look-ahead bias.</strong> Rules that peek at data the trade
          couldn&rsquo;t have known yet — like entering at the open using the
          same bar&rsquo;s close. The spec validation and the AI both watch
          for this, but creative rule combinations can still smuggle it in.
          If results look too clean, ask the chat to sanity-check the entry
          logic.
        </li>
        <li>
          <strong>Too few trades.</strong> Below roughly 30 trades, the
          statistics are anecdotes, not evidence — the same threshold at
          which the AI warns you. A 90% win rate over 10 trades is a coin
          that came up heads a few times.
        </li>
      </ul>

      <Callout kind="honest" title="The honest summary">
        <p>
          A good backtest is a reason to forward-test, not a reason to trade.
          Every number on this page describes a past that will not repeat
          exactly. That is why{" "}
          <a href="/docs/forward-testing">the ledger</a> exists: freeze the
          strategy, let it meet data nobody had when it was built, and let
          the record speak.
        </p>
      </Callout>

      <DocsFooterNav
        prev={{ href: "/docs/first-backtest", label: "Your first backtest" }}
        next={{ href: "/docs/credits", label: "Credits" }}
      />
    </>
  );
}
