import Link from "next/link";
import { Callout } from "@/components/docs/DocsBits";

export default function Article({ stats }: { stats?: React.ReactNode }) {
  return (
    <>
      <p>
        Most strategy content on the internet has a survivor problem: you only
        ever see the setups that worked. This article is the other kind. We
        built a 15-minute VWAP reversion strategy — the sort of thing intraday
        Twitter loves — backtested it in our own engine, and it lost. Then we
        published it in our library anyway, and deployed it to our public
        forward-test ledger, where it is accruing a live record as you read
        this.
      </p>
      <p>Here&rsquo;s the whole thing, including why we&rsquo;d bother.</p>

      <h2>The strategy</h2>
      <p>
        VWAP — the volume-weighted average price of the session — is the
        intraday trader&rsquo;s center of gravity. The reversion thesis says:
        when price stretches too far below VWAP too fast, it tends to snap
        back. Our template makes that testable:
      </p>
      <ul>
        <li>
          <strong>Universe:</strong>{" "}SPY and QQQ on 15-minute bars — the most
          liquid things that trade, on purpose.
        </li>
        <li>
          <strong>Entry:</strong>{" "}buy when a bar closes more than 0.3% below
          the session&rsquo;s VWAP <em>and</em>{" "}a fast 3-period RSI is under
          25 — stretched and washed out, not just drifting lower.
        </li>
        <li>
          <strong>Exit:</strong>{" "}sell when price closes back above VWAP — the
          snap-back this whole idea is named for — or on a 1% stop, or after
          one day in the trade, whichever comes first.
        </li>
        <li>
          <strong>Sizing:</strong>{" "}50% of equity per position, max two
          positions — reversion trades are short and parallel opportunities
          are few.
        </li>
      </ul>

      {stats}

      <h2>Why we published a loser</h2>
      <p>
        Because the alternative is the industry default, and the industry
        default is lying by omission. Strategy vendors run a hundred ideas,
        publish the twelve that backtested well, and let you assume the
        process was selective in your favor. The only way a library of
        strategies is trustworthy is if losing tests stay visible — otherwise
        &ldquo;our strategies backtest well&rdquo; is a tautology, not
        evidence. Our results were negative; the results are on the card;
        the card stays up.
      </p>

      <h2>What went wrong — three honest suspects</h2>
      <p>
        <strong>Costs and friction dominate at this timescale.</strong>{" "}An
        intraday reversion trade tries to capture a fraction of a percent per
        attempt. Our simulation charges a slippage assumption on every fill,
        and at 15-minute frequency those charges are a headwind the strategy
        has to outrun before it earns anything. Many published intraday
        backtests quietly skip this and look great right up until real money
        meets a real spread.
      </p>
      <p>
        <strong>The test window is short.</strong>{" "}Our intraday data plans cap
        history to roughly 60 days, so this backtest covers weeks, not
        decades — which is why the results block above shows the
        window&rsquo;s actual total return instead of a fabricated annualized
        number (a rule this article and every template card on the site
        follow).
        A few weeks is enough to observe behavior; it is nowhere near enough
        to estimate an edge. That cuts both ways: it could be better than this
        record, or worse.
      </p>
      <p>
        <strong>Regime dependence.</strong>{" "}Fading stretch works in ranging
        tape and gets steamrolled in trending tape. A strategy that is
        secretly a bet on &ldquo;the next month looks like a range&rdquo;
        will produce backtests that swing wildly with the window you happen to
        test. Short window + regime-sensitive idea is the classic recipe for
        results that don&rsquo;t travel.
      </p>

      <Callout kind="honest" title="The forward test is the real referee">
        <p>
          Every suspect above is an argument we could be wrong about in either
          direction. So instead of arguing, we froze the exact spec and
          deployed it to{" "}
          <Link href="/leaderboard">the public ledger</Link>, where it now
          trades forward on closed candles, under rules that cannot be edited
          after the fact. Whatever it does there — recovery or
          continued bleed — the record will be public, timestamped, and ours.
          That&rsquo;s the standard we think every strategy claim should meet.
        </p>
      </Callout>

      <h2>If you want to try to fix it</h2>
      <p>
        This is also an invitation. The template is open in the library — fork
        it and attack the weaknesses: &ldquo;require the stretch to happen in
        the first two hours only,&rdquo; &ldquo;add a minimum-volume
        filter,&rdquo; &ldquo;exit at the midpoint instead of VWAP,&rdquo;
        &ldquo;widen the stop to 2%.&rdquo; Each is one plain-English sentence
        in <Link href="/playground?template=vwap-reversion-15m">the lab</Link>.
        If your variant genuinely holds up, deploy it — publicly beating our
        published loser is exactly the kind of receipt this site exists to
        host.
      </p>
    </>
  );
}
