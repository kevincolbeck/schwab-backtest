import Link from "next/link";
import { Callout } from "@/components/docs/DocsBits";

export default function Article({ stats }: { stats?: React.ReactNode }) {
  return (
    <>
      <p>
        MACD tutorials are a genre. They all show the same thing: an indicator
        pane, three arrows on a chart that already went up, and the word
        &ldquo;momentum&rdquo; used eleven times. What almost none of them
        show is what happens when you take the crossover rule literally and
        make it trade every signal for years, through the boring parts, with
        no curation.
      </p>
      <p>That&rsquo;s what this backtest is.</p>

      <h2>Which MACD rule, exactly</h2>
      <p>
        &ldquo;MACD crossover&rdquo; hides two different strategies, and
        writeups constantly blur them:
      </p>
      <ul>
        <li>
          <strong>The zero-line cross:</strong> the MACD line (the 12-day EMA
          minus the 26-day EMA) crosses above zero — which is identical to the
          12-day EMA crossing above the 26-day. Slower, fewer signals.
        </li>
        <li>
          <strong>The signal-line cross:</strong> the MACD line crosses its
          own 9-day EMA. Faster, far more signals, far more noise.
        </li>
      </ul>
      <p>
        We test the <strong>zero-line variant</strong>: buy the day the 12-day
        EMA crosses above the 26-day, exit when it closes back below, on daily
        bars of SPY, QQQ, AAPL, MSFT and NVDA — 20% of equity per position,
        up to five at once, no stop, no target. The pure rule, unedited. (If
        you want the signal-line version, it&rsquo;s a one-sentence chat edit
        in the lab — &ldquo;use the MACD signal-line cross instead&rdquo; —
        and comparing the two is genuinely instructive.)
      </p>

      {stats}

      <h2>Reading the record honestly</h2>
      <p>
        A 12/26 EMA cross is a much faster trigger than the golden
        cross&rsquo;s 50/200, and it shows in the trade count: you get many
        times more signals, which makes the statistics more meaningful — and
        the experience more annoying. Faster crosses mean earlier entries into
        real trends <em>and</em> far more false starts. Expect the win rate to
        look unimpressive; trend-following systems routinely lose most of
        their trades and make it back on a few large winners. The number that
        decides whether you could actually live with this strategy is the max
        drawdown, not the win rate.
      </p>
      <p>
        Compare it mentally with{" "}
        <Link href="/blog/does-the-golden-cross-work">the golden cross on the
        same universe</Link>: same idea (own the uptrend), different speed
        setting. Faster isn&rsquo;t better or worse — it&rsquo;s a different
        bill. You pay either in lag (slow crosses give back months of gains at
        turns) or in whipsaw (fast crosses bleed small losses in chop).
        There is no setting that avoids both; anyone selling you one is
        selling you the arrows, not the record.
      </p>

      <Callout kind="honest" title="What this test can't tell you">
        <p>
          Five hand-picked tickers — three megacaps and two index ETFs — one
          decade, one parameter pair. These
          results say &ldquo;here is what this exact rule did on these exact
          names&rdquo; — not &ldquo;MACD works&rdquo; or &ldquo;MACD
          doesn&rsquo;t work.&rdquo; The strategy&rsquo;s character (early,
          busy, whipsaw-prone, occasionally very right) travels to other
          universes; the specific numbers do not. Rerun it on what you
          actually trade before forming an opinion.
        </p>
      </Callout>

      <h2>Edits worth trying</h2>
      <ul>
        <li>
          &ldquo;Only take crosses when price is above the 200-day SMA&rdquo;
          — the classic regime filter; usually cuts the chop dramatically.
        </li>
        <li>&ldquo;Add a 10% stop&rdquo; — bounds the tail on individual names.</li>
        <li>
          &ldquo;Switch to the signal-line cross&rdquo; — see the noise
          trade-off yourself instead of taking anyone&rsquo;s word.
        </li>
        <li>
          &ldquo;Test it on ETFs only&rdquo; — single-stock gaps are where
          crossover systems get hurt worst.
        </li>
      </ul>
      <p>
        Then, if an edit seems to hold up:{" "}
        <Link href="/docs/forward-testing">deploy it to the forward ledger</Link>{" "}
        and let it earn a record on data that didn&rsquo;t exist when you
        designed it. Backtests are the audition; the ledger is the job.
      </p>
    </>
  );
}
