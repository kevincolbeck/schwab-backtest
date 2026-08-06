import { Callout, DocsFooterNav } from "@/components/docs/DocsBits";

export const metadata = {
  title: "Forward testing",
  description:
    "How the ledger works: frozen specs, the same engine replaying closed candles, append-only records, and the 20-day verification window.",
};

export default function ForwardTestingPage() {
  return (
    <>
      <h1>Forward testing</h1>
      <p>Frozen rules, scored on data nobody had when they were written.</p>

      <h2>Why the ledger exists</h2>
      <p>
        A backtest is a hypothesis fitted to the past. With enough tries, anyone
        can produce a beautiful historical curve — that is exactly why beautiful
        historical curves are cheap. The ledger is the expensive part: deploy a
        strategy and it starts accruing a public track record on market data
        that did not exist on the day it was frozen. No re-runs, no edits, no
        quiet deletions. They sell the dream; we sell the proof.
      </p>
      <p>
        Everything on the ledger is paper simulation for research and education.
        It is a scoreboard for rules, not a trade feed — nothing on it is a
        recommendation to buy or sell anything.
      </p>

      <h2>What deploying freezes</h2>
      <p>
        When you deploy a strategy, its spec — the exact JSON the engine runs —
        is frozen and hashed. From that moment the deployed spec is immutable at
        the database level: the storage layer rejects any update to it. If you
        improve the strategy later, that is a <em>new</em> deployment with a
        fresh record starting from zero. The old record stands.
      </p>
      <p>
        Each strategy page shows the frozen spec, its hash, the original
        backtest, and the forward record side by side. The two curves are never
        merged — the separation is the point. You can always see what was
        promised and what actually happened afterward.
      </p>

      <h3>Same engine, no drift</h3>
      <p>
        Forward results are produced by replaying the frozen spec through the
        exact same engine that ran your backtest. There is no second
        implementation of the rules that could quietly diverge from the one you
        tested — the daily worker replays the spec up to today and appends
        whatever the ledger does not have yet. What you backtested is,
        mechanically, what gets scored.
      </p>

      <h2>Closed candles only</h2>
      <p>
        The worker evaluates rules on <strong>closed</strong> bars, after the
        fact — end-of-day bars for daily strategies, closed intraday candles
        (down to one-minute) for intraday deployments. Nothing is evaluated
        live or streaming.
      </p>
      <p>
        That is discipline, not a limitation. A rule checked mid-bar can be true
        at 2:14pm and false by the close — a strategy scored on unfinished bars
        gets credit for entries that would have evaporated. This is the
        repainting problem, and it is how a lot of impressive-looking track
        records are manufactured. A closed candle cannot repaint: every row on
        the ledger reflects information that was fully knowable at the time it
        was written.
      </p>

      <h2>Warm-up: ready on day one, out-of-sample from day one</h2>
      <p>
        Indicators need history before they mean anything — a 200-day average
        needs 200 days of closes. So each replay includes a warm-up window of
        pre-deployment data (roughly two years of daily bars; about a month of
        bars for intraday deployments) purely to get the indicators primed.
      </p>
      <p>
        Warm-up never leaks into the record. The replay starts flat on the
        deployment date, and any trade the rules would have entered before that
        date is discarded. Only out-of-sample trades — entered on or after the
        day the spec was frozen — ever reach the ledger.
      </p>

      <h2>One equity point per day</h2>
      <p>
        Each deployment tracks a paper account (by default $100,000) and records
        one equity snapshot per calendar day. Intraday strategies trade on their
        own candles, but their equity curve still collapses to the last bar of
        each day — the ledger measures days, not ticks. Fills use the spec’s
        entry price field and the same slippage assumption as backtests.
      </p>

      <h2>Append-only: losers stay</h2>
      <p>
        The ledger tables physically reject updates and deletions — database
        triggers abort them, and the production mirror revokes the permissions
        outright. Re-running a day appends nothing new; nothing existing can be
        touched. When a deployed strategy loses money, its record keeps
        accruing in public. There is no mechanism for making a bad forward test
        disappear, including for us.
      </p>
      <Callout kind="honest" title="A leaderboard you can trust has losers on it">
        <p>
          Most performance marketing survives by deleting its failures. An
          append-only ledger cannot do that, which is precisely what makes the
          winners on it worth looking at. If every strategy on our board were
          green, that would be evidence of curation, not skill.
        </p>
      </Callout>

      <h2>The 20-day verification window</h2>
      <p>
        Every deployment appears on the public leaderboard from day one, its
        original backtest shown beside its forward record and clearly marked
        hypothetical. The forward record earns its verified mark only after 20
        trading days of forward equity history — until then the row shows its
        progress (&ldquo;day 4 of 20&rdquo;) and never claims a shareable rank.
        Twenty days is still a small sample — the threshold exists to keep
        two-day wonders from claiming a verified record, not to certify
        anything.
      </p>

      <h2>Intraday deployments</h2>
      <p>
        Granularity parity: a strategy built on 15-minute candles forward-tests
        on 15-minute closed candles — same engine, same bars it was tested on.
        Multiple trades in one day stay distinct rows in the ledger, and the
        daily equity snapshot still takes the day’s last bar.
      </p>

      <h2>What deploying costs</h2>
      <p>
        Nothing beyond your plan. Deployments are slots, not purchases: Free
        carries 1 public slot, Pro 10 (and unlocks intraday and private
        records), Max unlimited. There is no per-deploy fee at any tier — if
        you have a free slot, you can deploy. Slots and capabilities are on the{" "}
        <a href="/docs/credits">Plans &amp; limits</a> page.
      </p>

      <h2>What the ledger is not</h2>
      <p>
        The ledger records what a frozen rule set would have done, after the
        candles closed. It does not notify you, it does not place orders, and it
        is not a source of trade instructions — for your own strategies or
        anyone else’s. If you want to act on rules you built here, the{" "}
        <a href="/docs/export-pine">exports</a> and the{" "}
        <a href="/docs/manual-trading">manual trading guide</a> cover how to run
        them on your own tools, in your own accounts, on your own judgment.
      </p>

      <DocsFooterNav
        prev={{ href: "/docs/strategy-spec", label: "The strategy spec" }}
        next={{ href: "/docs/export-pine", label: "Export to Pine Script" }}
      />
    </>
  );
}
