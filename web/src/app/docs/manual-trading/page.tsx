import { Callout, DocsFooterNav, Step, Steps } from "@/components/docs/DocsBits";

export const metadata = {
  title: "Manual trading",
  description:
    "Trading the plain-English rules by hand: an end-of-day routine, a pre-trade checklist, honest sizing, and journaling against the forward ledger.",
};

export default function ManualTradingPage() {
  return (
    <>
      <h1>Manual trading</h1>
      <p>The rules panel was written so you could trade it by hand. Here is how.</p>

      <p>
        Every strategy’s Rules tab renders the spec as plain English — universe,
        entry, exits, sizing — precise enough to act on with nothing but a
        brokerage account and a routine. A daily golden cross reads like this:
      </p>
      <pre>
        <code>{`Universe  Trades 5 symbols: SPY, QQQ, AAPL, MSFT, NVDA.
Entry     Go long when (the 50-day average is above the 200-day
          average) AND ((the 50-day average from 1 bar ago) is at
          or below (the 200-day average from 1 bar ago)).
          Fills happen at the open price of the signal bar.
Exits     Exit when the 50-day average is below the 200-day average.
Sizing    Each position uses 20% of equity, up to 5 positions at once.`}</code>
      </pre>
      <p>
        Nothing here tells you to place a trade. These are rules <em>you</em>{" "}
        built and tested; whether and how to act on them is entirely your call,
        in your account, at your broker. What this page adds is the discipline
        layer — because by hand, the strategy is only half the system. You are
        the other half.
      </p>

      <h2>The end-of-day routine</h2>
      <p>
        The engine and the <a href="/docs/forward-testing">forward ledger</a>{" "}
        evaluate rules on closed candles only. Manual trading should copy that
        discipline exactly: decisions happen once, after the close, on finished
        bars — never mid-session on a bar that is still moving. A rule that
        looks true at 2pm can be false by 4pm; acting early means trading a
        different strategy than the one you tested.
      </p>
      <Steps>
        <Step n={1} title="After the close, check exits first">
          For each open position, work down the exit lines in order: has the
          exit rule fired on today’s closed bar? Has the stop level been
          reached? Has the position hit its maximum holding period? Exits come
          before entries so a full book never blocks you from seeing that
          something should have left it.
        </Step>
        <Step n={2} title="Check the entry rule across the universe">
          Go through every symbol in the universe — not just the ones you like
          — and check the entry condition against today’s closed bar. Skipping
          symbols you feel bearish about is an override, and overrides are a
          different strategy.
        </Step>
        <Step n={3} title="Size from the sizing line, against current equity">
          Compute the position from the spec’s sizing rule and your account’s
          current equity — 20% of equity means 20% of what the account is worth
          tonight, not at the start of the month.
        </Step>
        <Step n={4} title="Place orders for the next session">
          A spec that fills at the open maps to orders for tomorrow’s open. If
          the strategy carries a stop, place the stop order with the entry —
          the simulated version never forgets its stop, so the manual version
          must not either.
        </Step>
        <Step n={5} title="Write the journal entry">
          Record what fired, what you did, your fill versus the rule’s price,
          and — most importantly — anything you did differently and why. Two
          minutes now; the whole feedback loop later.
        </Step>
      </Steps>
      <Callout kind="note" title="Intraday strategies by hand">
        <p>
          The closed-candle discipline works at any timeframe, but a 15-minute
          strategy asks you to run this loop dozens of times a day without
          drift. That is a job description, not a routine. Manual trading suits
          daily strategies; for intraday rules, the{" "}
          <a href="/docs/export-pine">Pine export with TradingView alerts</a> is
          the saner path.
        </p>
      </Callout>

      <h2>The pre-trade checklist</h2>
      <p>Before any order, derived straight from the rules panel:</p>
      <ul>
        <li>The entry condition is true on a <strong>closed</strong> bar — verified against the actual numbers, not eyeballed on a chart.</li>
        <li>The position count after this trade stays within the spec’s maximum.</li>
        <li>The size comes from the sizing line and current equity, not from conviction.</li>
        <li>The stop level is computed and the stop order goes in with the entry.</li>
        <li>The exit conditions are written down where tomorrow’s you will see them.</li>
        <li>The journal entry exists before the order does.</li>
      </ul>
      <p>
        If any line fails, the trade is not the strategy’s trade. It might still
        be a fine trade — but log it as yours, not the system’s.
      </p>

      <h2>Sizing: the simulation is honest, your account must be too</h2>
      <p>
        The backtest and the ledger size positions as a percentage of a paper
        account. Your account is a different number, and the translation has
        sharp corners: percentages of a small account round to odd share
        counts; some brokers do not do fractional shares; a 20%-of-equity
        position in a $5,000 account is $1,000, and no amount of wanting the
        backtest’s dollar P&amp;L makes it more. Scale the strategy to your
        account — never the other way around. If honest sizing makes the
        returns feel too small to bother with, that is real information about
        account size, not a reason to triple the risk.
      </p>

      <h2>Slippage and fills</h2>
      <p>
        The engine charges a slippage penalty on every simulated fill, always
        in the unfavorable direction — but that is a model, not a promise. Live,
        you cross real spreads, opens gap through stop levels, and market
        orders in thin names cost more than the simulation assumed. Expect your
        fills to be a little worse than the ledger’s on average, and record the
        difference in your journal: if the gap is persistently large, the
        strategy’s simulated results are optimistic <em>for you</em>, in your
        size, in those names — which is worth knowing before the position count
        grows.
      </p>

      <h2>The ledger is your accountability mirror</h2>
      <p>
        If the strategy is deployed to the forward ledger, something unusual is
        true: a frozen, append-only record of what the rules did is being
        written every day, by the same engine, with no memory of your feelings.
        Reconcile your journal against it weekly. Every difference between your
        account and the ledger is one of two things — slippage, which you log
        and live with, or an override, which is the thing to fix. Most manual
        traders never get this mirror; if you have it, use it.
      </p>

      <h2>When to stop</h2>
      <p>
        Decide before the first trade, in writing, what makes you stop — because
        the version of you that is down 15% is the least qualified person to
        decide. The backtest’s maximum drawdown is the reference: if the live
        drawdown grows meaningfully past what the simulation ever produced, the
        market may have stopped resembling the data the rules were built on.
        Stopping is not failure; it is the move back to the lab with better
        information than you left with. Stop, too, when the journal shows you
        overriding the rules more weeks than not — at that point the record is
        no longer testing the strategy, and it deserves an honest test or an
        honest burial.
      </p>

      <Callout kind="honest" title="The gap is behavioral, not mathematical">
        <p>
          The arithmetic of a rule set does not change when real money attaches
          to it — you do. Simulations never skip an entry after three losses,
          never widen a stop to avoid taking the loss today, never double a
          winner out of confidence. Every part of this page — the routine, the
          checklist, the journal, the stopping rule — exists to close that gap.
          The strategy was tested without you in the loop; the discipline layer
          is how you add yourself without breaking it.
        </p>
      </Callout>

      <DocsFooterNav
        prev={{ href: "/docs/export-python", label: "Export to Python" }}
      />
    </>
  );
}
