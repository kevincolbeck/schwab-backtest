import Link from "next/link";
import { Callout } from "@/components/docs/DocsBits";

export default function Article({ stats }: { stats?: React.ReactNode }) {
  return (
    <>
      <p>
        Every trader eventually notices the same pattern: strategies look
        brilliant in the backtest and ordinary — or worse — the moment real
        money follows them. The usual explanations are vibes
        (&ldquo;the market changed&rdquo;) or conspiracy (&ldquo;they hunt my
        stops&rdquo;). The real explanation is more boring and more useful:
        <strong> a backtest and a forward test answer different questions</strong>,
        and almost everything published online only ever shows you the first
        one.
      </p>
      {stats}

      <h2>What a backtest actually is</h2>
      <p>
        A backtest asks: <em>if I had traded these rules in the past, what
        would have happened?</em>{" "}Done honestly, it&rsquo;s the most useful
        tool in trading — it kills bad ideas in seconds and shows you a
        strategy&rsquo;s character (how it loses, how long it sits flat, what
        its worst stretch felt like) before you pay tuition for the lesson.
      </p>
      <p>
        But a backtest has a structural weakness no amount of data fixes:{" "}
        <strong>it is graded on an exam whose answers existed before you
        wrote it.</strong>{" "}Four leaks follow from that, and they account for
        most vanishing edges:
      </p>
      <ul>
        <li>
          <strong>Selection.</strong>{" "}You tested twenty ideas and kept the
          best one. The best of twenty random strategies also looks good —
          that&rsquo;s what &ldquo;best of twenty&rdquo; means. The published
          winner carries the invisible luck of its dead siblings.
        </li>
        <li>
          <strong>Overfitting.</strong>{" "}Every parameter you tuned — the 20-day
          lookback, the 8% stop — was tuned against the same history
          you&rsquo;re now citing as evidence. The more knobs, the more the
          &ldquo;edge&rdquo; is just memorized noise.
        </li>
        <li>
          <strong>Look-ahead and survivorship.</strong>{" "}Subtler leaks: rules
          that peek at data the bar hasn&rsquo;t produced yet, universes built
          from stocks you already know survived. (Our engine evaluates entry
          and exit rules only on closed bars, which closes the worst of the
          first — though every simulator&rsquo;s fill-price conventions
          involve judgment calls, ours included. Picking today&rsquo;s
          megacaps as your test universe — which our own templates do — is a
          form of the second, and we label it wherever it applies.)
        </li>
        <li>
          <strong>Costs.</strong>{" "}Slippage, spreads, and missed fills are
          small numbers that compound into the whole edge at higher trade
          frequencies. A backtest that ignores them isn&rsquo;t optimistic —
          it&rsquo;s fictional.
        </li>
      </ul>

      <h2>What a forward test changes</h2>
      <p>
        A forward test asks a harder question: <em>do these exact rules make
        money on data that did not exist when the rules were written?</em>{" "}
        Nothing about it is sophisticated — it&rsquo;s just a backtest with
        the one thing money actually requires: the future.
      </p>
      <p>Three properties make it the referee:</p>
      <ul>
        <li>
          <strong>The rules are frozen first.</strong>{" "}No quiet re-tuning
          after a bad week. The spec is locked before the data arrives, so
          overfitting has nothing left to fit.
        </li>
        <li>
          <strong>Every result counts.</strong>{" "}There is no drawer to hide the
          losers in. Selection bias needs a selection step, and forward
          records don&rsquo;t have one.
        </li>
        <li>
          <strong>Time does the auditing.</strong>{" "}A 20-day live record is
          modest evidence; a 200-day one is a reputation. Either way it
          accumulates in public, one closed candle at a time.
        </li>
      </ul>

      <Callout kind="honest" title="How our ledger enforces this">
        <p>
          When a strategy is deployed on this site, its spec is frozen and
          hashed, it starts trading flat on data from the day the spec was
          frozen onward, and its record becomes append-only — we archive strategies, but we
          don&rsquo;t edit or delete their history, and losers stay on{" "}
          <Link href="/leaderboard">the leaderboard</Link>{" "}
          next to winners.
          Records under 20 trading days are labeled as still warming up rather
          than hidden. We built it this way because &ldquo;trust our
          backtests&rdquo; is not an argument; a public record you could have
          watched accrue is.
        </p>
      </Callout>

      <h2>How to use both without fooling yourself</h2>
      <ol>
        <li>
          <strong>Backtest to reject, not to believe.</strong>{" "}The
          backtest&rsquo;s honest job is falsification: most ideas should die
          there, cheaply.
        </li>
        <li>
          <strong>Stress the survivor.</strong>{" "}Shift the date window, change
          the universe, fatten the costs. An edge that only exists in one
          decade on five stocks isn&rsquo;t an edge — it&rsquo;s an anecdote.
          (We wrote up{" "}
          <Link href="/blog/vwap-strategy-backtest">a strategy of ours that
          failed exactly this kind of scrutiny</Link> — and published it
          anyway.)
        </li>
        <li>
          <strong>Then freeze it and go live on paper.</strong>{" "}Deploy the
          exact spec to a forward test and stop touching it. The waiting is
          the test. Anyone unwilling to wait is telling you which question
          they&rsquo;re afraid of.
        </li>
      </ol>
      <p>
        The uncomfortable summary: backtests are where edges are <em>found</em>,
        and forward tests are where they&rsquo;re <em>proven</em> — and the
        entire strategy-selling industry is built on hoping you never insist
        on the second step. Insist on it. You can{" "}
        <Link href="/playground">build and backtest a strategy free in the
        lab</Link>, and when you believe it, put it on the record.
      </p>
    </>
  );
}
