import Link from "next/link";
import { Callout } from "@/components/docs/DocsBits";

export default function Article({ stats }: { stats?: React.ReactNode }) {
  return (
    <>
      <p>
        You saw a setup online — a moving-average cross, a breakout rule, a
        &ldquo;buy the dip&rdquo; recipe with suspiciously round numbers — and
        the honest voice in your head asked the only question that matters:{" "}
        <em>would this have actually worked?</em> Answering that used to
        require Python, a data subscription, and a weekend. It now requires
        neither code nor money. Here is the whole method, tool-agnostic where
        it can be, specific where it helps.
      </p>
      {stats}

      <h2>Step 1 — Turn the idea into exact rules</h2>
      <p>
        This is the step that kills most ideas, and it&rsquo;s supposed to.
        &ldquo;Buy strong stocks on pullbacks&rdquo; is not a strategy;
        it&rsquo;s a mood. A testable rule answers, with no judgment calls
        left: what exactly triggers an entry? What exits — a reverse signal, a
        stop, a target? How much per position? How many positions at once?
      </p>
      <p>
        In <Link href="/playground">our lab</Link> you do this by describing
        the idea in plain English — &ldquo;buy when the 50-day crosses above
        the 200-day, sell on the reverse cross, 20% per position&rdquo; — and
        the AI writes the exact, machine-readable rules and shows you every
        assumption it made. Whatever tool you use, do not skip the discipline:
        if you can&rsquo;t state the rule precisely, you can&rsquo;t test it,
        and if you can&rsquo;t test it, you&rsquo;re trading a feeling.
      </p>

      <h2>Step 2 — Run it on serious history</h2>
      <p>
        A backtest over six months tells you almost nothing — you&rsquo;re
        seeing one regime, and every strategy looks smart in the regime it was
        born in. Run daily-bar strategies over many years, through at least
        one crash and one boring sideways stretch. (Daily-data backtests are
        free here on every plan — every template, and custom universes up to
        10 symbols — and a full run over two decades takes seconds.)
      </p>

      <h2>Step 3 — Read the results in the right order</h2>
      <p>Most people read a backtest backwards. The order that protects you:</p>
      <ol>
        <li>
          <strong>Max drawdown first.</strong> This is the price of admission
          — the stretch where you&rsquo;d have watched a third of your account
          evaporate while the strategy insisted it was fine. If you
          couldn&rsquo;t have lived through it, the CAGR is irrelevant,
          because you&rsquo;d have quit at the bottom.
        </li>
        <li>
          <strong>Trade count second.</strong> Twelve trades in a decade is an
          anecdote, not a statistic. Be much more skeptical of beautiful
          results built on few trades.
        </li>
        <li>
          <strong>Returns last</strong> — and always against a benchmark.
          &ldquo;Made money&rdquo; is not the bar; &ldquo;beat just buying the
          index, after the extra drawdown and effort&rdquo; is.
        </li>
      </ol>
      <p>
        Our <Link href="/docs/reading-results">reading-results guide</Link>{" "}
        goes deeper on every metric, in plain language.
      </p>

      <h2>Step 4 — Try to kill it</h2>
      <p>
        A good backtest is a hypothesis that survived one attack. Launch more:
        move the date window five years earlier; swap the universe; make the
        stop tighter and looser; add realistic costs if your tool
        doesn&rsquo;t already. If small changes crater the results, you never
        had an edge — you had a coincidence with parameters.
      </p>

      <Callout kind="honest" title="The traps no-code tools should refuse for you">
        <p>
          Two lies show up constantly in retail backtests. <strong>Look-ahead
          bias:</strong> rules that act on information the bar hadn&rsquo;t
          produced yet (our engine only ever evaluates rules on closed bars).{" "}
          <strong>Fabricated annualization:</strong> quoting a &ldquo;CAGR&rdquo;
          from a six-week test (our template cards and these articles refuse
          to annualize any window under a year). A tool that lets you fool
          yourself on either isn&rsquo;t saving you from code — it&rsquo;s
          automating the mistake.
        </p>
      </Callout>

      <h2>Step 5 — Prove it forward</h2>
      <p>
        However well the history reads, a backtest remains an exam with the
        answers printed in the back —{" "}
        <Link href="/blog/backtest-vs-forward-test">we wrote a whole piece
        on why edges evaporate between the backtest and live</Link>. The final
        step costs nothing but patience: freeze the exact rules and paper-run
        them forward on data nobody has seen. On this site that&rsquo;s one
        click — <Link href="/docs/forward-testing">deploy to the public
        ledger</Link> — and the record it accrues is timestamped, append-only,
        and visible to anyone you&rsquo;d ever need to convince, including
        future-you.
      </p>
      <p>
        Total cost of the whole method: an afternoon, zero dollars, no code.
        The setup you saw online either survives it or it doesn&rsquo;t —
        and both answers are worth having <em>before</em> a dollar is at risk.
      </p>
    </>
  );
}
