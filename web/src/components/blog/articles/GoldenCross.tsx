import Link from "next/link";
import { Callout } from "@/components/docs/DocsBits";

/* All performance numbers render in the live stats block ({stats}) — the
   prose stays qualitative on purpose, so a data refresh can't strand a stale
   claim here. */
export default function Article({ stats }: { stats?: React.ReactNode }) {
  return (
    <>
      <p>
        The golden cross is probably the most repeated signal in retail
        trading: when the 50-day moving average crosses above the 200-day, the
        chart is said to turn bullish. It has everything a famous signal
        needs — a name, a clean picture, and a century of folklore. What it
        rarely comes with is a full track record: every writeup shows the same
        two or three beautiful crosses and stops there.
      </p>
      <p>
        So we ran it properly. Below are the exact rules we tested, the live
        results from our engine, and — more useful than either — where this
        strategy tends to break.
      </p>

      <h2>The exact rules we tested</h2>
      <p>
        &ldquo;Golden cross&rdquo; means slightly different things in
        different writeups, so here is our template&rsquo;s spec, stated
        precisely. This matters: a backtest you can&rsquo;t restate in exact
        rules is a backtest you can&rsquo;t trust.
      </p>
      <ul>
        <li>
          <strong>Universe:</strong> SPY, QQQ, AAPL, MSFT, NVDA — daily bars.
        </li>
        <li>
          <strong>Entry:</strong> buy on the day the 50-day simple moving
          average closes above the 200-day, having been at or below it the day
          before (the cross day itself, not just &ldquo;50 above 200&rdquo;).
        </li>
        <li>
          <strong>Exit:</strong> sell when the 50-day closes back below the
          200-day — the &ldquo;death cross.&rdquo; No stop-loss, no profit
          target: this is the pure signal, unedited.
        </li>
        <li>
          <strong>Sizing:</strong> 20% of equity per position, up to 5
          positions at once.
        </li>
      </ul>

      {stats}

      <h2>What the numbers mean</h2>
      <p>
        The first thing to notice is how <em>few</em> trades a decade
        produces. Moving averages this slow cross rarely — this is a strategy
        that acts a handful of times per symbol per decade and holds for
        months or years. That has two consequences worth sitting with.
      </p>
      <p>
        First, the sample is small. A strategy with this few round trips can
        look brilliant or broken because of two or three market regimes, not
        because of any deep statistical edge. Judge it as a{" "}
        <em>trend filter with a track record</em>, not a machine with an
        expected value per trade.
      </p>
      <p>
        Second, the golden cross is structurally <em>late twice</em>. The
        50/200 cross confirms an uptrend only after months of rising prices,
        so you buy well off the low; the death cross confirms the downtrend
        the same way, so you sell well off the high. What you get in exchange
        is time <em>in</em> the big moves and time <em>out</em> of the big
        disasters. Whether that trade-off pays is exactly what the drawdown
        and CAGR numbers above are telling you.
      </p>

      <h2>Where it breaks</h2>
      <p>
        The classic failure mode is a sideways market. When price chops in a
        range, the averages braid around each other and the strategy buys the
        cross, sells the re-cross lower, and repeats — a sequence of small,
        demoralizing losses that the folklore never mentions. Long stretches
        of the record are exactly that.
      </p>
      <Callout kind="honest" title="A bias we built into this test">
        <p>
          Our universe is five of the era&rsquo;s biggest winners — three
          megacaps and the two dominant index ETFs — chosen, honestly, because
          they are the tickers people actually ask about. That is survivorship-shaped: the same rules on a basket of
          2016&rsquo;s darlings that <em>didn&rsquo;t</em> keep winning would
          look worse. Treat these results as &ldquo;the golden cross on
          winners,&rdquo; not &ldquo;the golden cross on the market.&rdquo;
          The fix is to rerun it on your own universe — which is one click
          from here.
        </p>
      </Callout>

      <h2>Variations worth testing</h2>
      <p>
        The unedited signal is a baseline, not a finish line. In the lab you
        can change any rule in plain English and rerun in seconds. The edits
        people most often try from here:
      </p>
      <ul>
        <li>&ldquo;Add an 8% stop-loss&rdquo; — caps the worst single-name damage.</li>
        <li>
          &ldquo;Use 20/100 instead of 50/200&rdquo; — faster crosses, more
          trades, more whipsaw; watch the drawdown.
        </li>
        <li>
          &ldquo;Only enter when price is also above the 200-day&rdquo; — a
          second confirmation layer.
        </li>
        <li>
          &ldquo;Test 2006–2013 instead&rdquo; — a window with a very
          different character (our daily data starts in 2006); regime changes
          move slow strategies more than fast ones.
        </li>
      </ul>
      <p>
        And when a variation survives your skepticism, the real test isn&rsquo;t
        another backtest — it&rsquo;s{" "}
        <Link href="/docs/forward-testing">freezing the rules and letting it
        trade forward on data nobody has seen</Link>. That&rsquo;s what our
        public ledger is for.
      </p>
    </>
  );
}
