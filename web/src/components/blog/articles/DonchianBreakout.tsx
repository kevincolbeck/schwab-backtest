import Link from "next/link";
import { Callout } from "@/components/docs/DocsBits";

export default function Article({ stats }: { stats?: React.ReactNode }) {
  return (
    <>
      <p>
        Before it had a name, the Donchian channel breakout was just a
        stubborn idea: buy when price does something it hasn&rsquo;t done in
        weeks — make a new high — and get out when it makes a new low. It is
        the rule set at the heart of the famous Turtle experiment, and it
        remains the cleanest expression of breakout trading there is: no
        indicator math, no interpretation, just recent highs and lows.
      </p>

      <h2>The exact rules we tested</h2>
      <ul>
        <li>
          <strong>Universe:</strong> ten megacaps — AAPL, MSFT, NVDA, AMZN,
          META, GOOGL, TSLA, AMD, AVGO, NFLX — on daily bars.
        </li>
        <li>
          <strong>Entry:</strong> buy when today&rsquo;s close exceeds the
          highest high of the previous 20 trading days.
        </li>
        <li>
          <strong>Exit:</strong> sell when the close drops below the lowest
          low of the previous 10 days — or on an 8% stop-loss, whichever
          comes first.
        </li>
        <li>
          <strong>Sizing:</strong> 20% of equity per position, up to five
          concurrent positions.
        </li>
      </ul>
      <p>
        The asymmetry is deliberate and old: a 20-day lookback to get in, a
        10-day lookback to get out. Slow to believe a breakout, quicker to
        admit it died.
      </p>

      {stats}

      <h2>What the numbers mean</h2>
      <p>
        Breakout systems have a personality, and it&rsquo;s visible in this
        record. They lose small and often: most 20-day highs don&rsquo;t turn
        into runaway trends, and each one that fizzles costs a little. They
        win rarely and large: the whole system is a bet that occasionally a
        new high is the <em>first</em> new high of a very long move, and that
        one position pays for the parade of failed ones. If the win rate above
        looks low to you, that&rsquo;s not a bug in the test — it&rsquo;s the
        shape of the strategy. The honest question is never &ldquo;how often
        does it win?&rdquo; but &ldquo;is the average winner big enough, and
        is the drawdown survivable while you wait?&rdquo;
      </p>
      <p>
        The 8% stop deserves a note. The classic Turtle rules sized positions
        by volatility instead of using a fixed percentage stop; our template
        deliberately uses the simpler fixed stop because it&rsquo;s what most
        retail traders actually do. It changes the character: tight fixed
        stops on volatile single names get hit by ordinary noise, converting
        some would-be winners into small losses.
      </p>

      <Callout kind="honest" title="The universe is doing real work here">
        <p>
          These ten names are the decade&rsquo;s most relentless
          trend-makers — and we knew that when we picked them. A breakout
          system pointed at strong trenders is flattered by construction.
          Point the same rules at a basket of range-bound utilities and the
          record would look very different. That&rsquo;s not a reason to
          dismiss the test; it&rsquo;s a reason to rerun it on{" "}
          <em>your</em> watchlist before believing anything.
        </p>
      </Callout>

      <h2>Edits worth trying</h2>
      <ul>
        <li>
          &ldquo;Use 55-day entry and 20-day exit&rdquo; — the slower classic
          Turtle setting; fewer, bigger trades.
        </li>
        <li>
          &ldquo;Drop the fixed stop&rdquo; — let the 10-day low do all the
          exiting, and watch what happens to both drawdown and winners.
        </li>
        <li>
          &ldquo;Only enter when the market itself is above its 200-day&rdquo;
          — breakouts against a falling tide are the expensive kind.
        </li>
      </ul>
      <p>
        Every edit is a plain-English sentence in{" "}
        <Link href="/playground?template=donchian-breakout">the lab</Link>,
        and every rerun takes seconds. When one survives your best attempts to
        break it, put it where opinions go to be tested:{" "}
        <Link href="/leaderboard">the public forward ledger</Link>.
      </p>
    </>
  );
}
