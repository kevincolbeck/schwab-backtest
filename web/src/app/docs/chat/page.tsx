import Link from "next/link";
import { Callout, DocsFooterNav, Step, Steps } from "@/components/docs/DocsBits";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Building by chat — Docs — Chat·Backtest",
  description:
    "How to talk to the AI strategist: prompts that work, the guided intake for blank strategies, the warnings it raises on purpose, and what it refuses to do.",
  path: "/docs/chat",
});

export default function DocsChatPage() {
  return (
    <>
      <h1>Building by chat</h1>
      <p>
        The chat dock is how you edit a strategy without writing JSON. You
        describe a change in plain English; the assistant rewrites the{" "}
        <Link href="/docs/strategy-spec">strategy spec</Link>, explains what the
        change means in trading terms, and re-runs the backtest when it makes
        sense to.
      </p>

      <h2>What the assistant can do</h2>
      <ul>
        <li>
          <strong>Edit the spec.</strong>{" "}Every edit comes back as a complete
          updated strategy, not a vague suggestion — you see exactly what
          changed, and the run happens on the real, validated spec.
        </li>
        <li>
          <strong>Explain historical results.</strong>{" "}It has your latest run in
          front of it — returns, drawdown, trade counts, exit breakdowns — and
          can tell you what drove them.
        </li>
        <li>
          <strong>Teach concepts.</strong>{" "}Ask what Sharpe means, what an ATR
          stop is, why drawdown matters. Jargon gets explained, not assumed.
        </li>
        <li>
          <strong>Compare runs.</strong>{" "}Ask how the current version stacks up
          against the previous one and why.
        </li>
      </ul>
      <p>
        When a request is vague — “make it better” — it proposes{" "}
        <em>one</em>{" "}concrete change with reasoning, not a rewrite. The more
        specific your ask, the better the edit: “tighten the stop from 8% to
        5%” beats “tighten the stop”.
      </p>

      <h2>Prompts that work well</h2>
      <table>
        <thead>
          <tr>
            <th>You want to…</th>
            <th>Try saying</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Change a parameter</td>
            <td>“Tighten the stop from 8% to 5%.”</td>
          </tr>
          <tr>
            <td>Add an entry filter</td>
            <td>“Only enter when the 14-day RSI is above 55.”</td>
          </tr>
          <tr>
            <td>Rename the strategy</td>
            <td>“Rename this to Monday Reversal.”</td>
          </tr>
          <tr>
            <td>Change the timeframe</td>
            <td>“Switch this to 15-minute bars.”</td>
          </tr>
          <tr>
            <td>Understand a result</td>
            <td>“Why is the max drawdown so high?”</td>
          </tr>
          <tr>
            <td>Test a hunch</td>
            <td>“What if I stayed long all year instead?”</td>
          </tr>
          <tr>
            <td>Learn a concept</td>
            <td>“Explain what Sharpe ratio means here.”</td>
          </tr>
        </tbody>
      </table>
      <p>
        Two conveniences worth knowing. First, simple indicators referenced in a
        rule are registered automatically — mention{" "}
        <code>rsi_14</code>{" "}or <code>sma_50</code>{" "}in an edit and the matching
        indicator definition is added for you. Second, when you switch to an
        intraday timeframe the assistant also shrinks your date range to 60 days
        or less and tells you why — that cap is real and explained in{" "}
        <Link href="/docs/markets-timeframes">Markets &amp; timeframes</Link>.
      </p>

      <h2>Starting from scratch</h2>
      <p>
        With no strategy loaded, the chat switches to a guided intake. It asks
        one question per turn, in a deliberate order:
      </p>
      <Steps>
        <Step n={1} title="Market">
          US stocks and ETFs, or crypto via Polygon-style tickers like{" "}
          <code>X:BTCUSD</code>.
        </Step>
        <Step n={2} title="Timeframe">
          Daily bars, or intraday (60m down to 1m — with the 60-day history cap
          flagged up front).
        </Step>
        <Step n={3} title="Entry idea">
          What gets you into a position — a crossover, a breakout, a seasonal
          window, whatever you have.
        </Step>
        <Step n={4} title="Exits and stops">
          What gets you out, and where the stop-loss sits.
        </Step>
        <Step n={5} title="Sizing">
          Percent of equity per position (or percent risked per trade), and how
          many positions at once.
        </Step>
      </Steps>
      <p>
        After every answer you see a full draft of the spec, live. Parts you
        have not answered yet are filled with clearly-labeled provisional
        defaults — <code>SPY</code>, daily bars, 10% sizing — so the draft is
        always complete and runnable. Nothing runs until you say the strategy is
        ready to test.
      </p>

      <h2>Warnings it raises on purpose</h2>
      <p>
        Whenever it edits a spec or summarizes results, the assistant scans for
        a short list of well-known ways backtests mislead, and warns you — then
        carries on. It never blocks your edit; it makes sure you know the risk
        you are taking with the <em>analysis</em>, not the trade:
      </p>
      <ul>
        <li>
          <strong>Look-ahead bias</strong> — rules that peek at data the trade
          could not have known yet, like entering at the open using the same
          bar&rsquo;s close. The backtest looks brilliant; a real trader could
          never have done it.
        </li>
        <li>
          <strong>Overtight stops</strong> — a stop far smaller than the
          timeframe&rsquo;s typical bar-to-bar swing mostly buys noise exits,
          not protection.
        </li>
        <li>
          <strong>Unrealistic sizing</strong> — near-100% of equity in one
          position, or position size × max positions far beyond 100% (implicit
          leverage).
        </li>
        <li>
          <strong>Survivorship bias</strong> — hand-picking the famous winners
          of today bakes tomorrow&rsquo;s knowledge into yesterday&rsquo;s
          universe, flattering any strategy tested on them.
        </li>
        <li>
          <strong>Too few trades</strong> — below roughly 30 trades, the stats
          are anecdotes, not evidence.
        </li>
      </ul>
      <Callout kind="honest" title="The warnings are the product">
        <p>
          A tool that silently let you build a flattering backtest would be
          worse than one that nags. These warnings are the teaching voice of the
          lab: each one exists because it catches a mistake that makes
          historical results look better than they were.
        </p>
      </Callout>

      <h2>What it refuses — and why that is a feature</h2>
      <p>The assistant will not, under any phrasing:</p>
      <ul>
        <li>predict future prices,</li>
        <li>recommend buying or selling any real security with real money,</li>
        <li>claim a strategy “will” make money.</li>
      </ul>
      <p>
        Ask anyway and you get a polite refusal plus a useful counter-offer:
        “I can&rsquo;t predict prices, but we can test how that idea would have
        performed historically.” There is also nothing behind the chat that
        could act on advice if it gave any — the product has no broker
        connection and places no trades, ever.
      </p>
      <Callout kind="honest" title="Refusing is the point">
        <p>
          A backtest is a hypothesis about the past, not a forecast. An
          assistant that blurred that line — even once, even politely — would
          make everything else on the screen less trustworthy. The refusal
          rules are enforced in the assistant&rsquo;s instructions <em>and</em>{" "}
          server-side, so a clever prompt cannot talk the system out of them.
        </p>
      </Callout>

      <h2>Guardrails, and the one retry</h2>
      <p>
        Every spec the assistant proposes is validated on the server before it
        touches your strategy: numeric fields are clamped to documented bounds,
        tickers are checked, and every rule expression is parsed against the
        engine&rsquo;s grammar. If validation fails, the errors are sent back to
        the model for exactly one self-correction attempt. If the retry fails
        too, the edit is dropped — you see the reply and the validation errors,
        and your current spec stays untouched. A failed edit never half-applies.
      </p>

      <h2>What chat costs</h2>
      <p>
        Nothing per message — AI chat is included on every plan, with no
        counter and no per-message charge. What exists instead is a daily
        limit: <strong>3 messages</strong>{" "}without an account,{" "}
        <strong>5 on Free</strong>, <strong>15 on Pro</strong>,{" "}
        <strong>40 on Max</strong>. Model tokens are one of the two things
        that genuinely cost us money per use, so the free tier&rsquo;s limit
        is a real constraint rather than a formality — worth knowing before a
        long session. Context is capped on every plan too (the last 12
        messages, each trimmed to 2,000 characters), so a long conversation
        can&rsquo;t quietly balloon. Full table in{" "}
        <Link href="/docs/credits">Plans &amp; limits</Link>.
      </p>

      <DocsFooterNav
        prev={{ href: "/docs/credits", label: "Plans & limits" }}
        next={{ href: "/docs/markets-timeframes", label: "Markets & timeframes" }}
      />
    </>
  );
}
