import { Callout, DocsFooterNav } from "@/components/docs/DocsBits";

export const metadata = {
  title: "Credits",
  description:
    "How usage is metered: what every action costs, how chat pricing works, plans and top-up packs, and automatic refunds when something fails.",
};

export default function CreditsPage() {
  return (
    <>
      <h1>Credits</h1>
      <p>
        Credits are how usage is metered. They exist because two things here
        cost us real money per use — AI model tokens and market data — and
        credits let heavy usage pay its own way while light usage stays cheap.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>
          New accounts get <strong>250 credits</strong> free — no card
          required.
        </li>
        <li>
          Every priced action debits <em>before</em> it runs; if the action
          fails, the credits come back automatically.
        </li>
        <li>
          Subscriptions add a monthly allowance; one-time packs top you up
          between refills.
        </li>
        <li>
          The ◈ meter in the lab toolbar is your live balance. It updates
          with every run and chat reply, and turns red when you drop below
          25.
        </li>
      </ul>

      <h2>What actions cost</h2>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Credits</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Backtest — daily (1d) bars</td>
            <td>10 per block of 10 symbols</td>
          </tr>
          <tr>
            <td>Backtest — 15m / 30m / 60m bars</td>
            <td>25 per block of 10 symbols</td>
          </tr>
          <tr>
            <td>Backtest — 1m / 5m bars</td>
            <td>50 per block of 10 symbols</td>
          </tr>
          <tr>
            <td>Chat message</td>
            <td>12 minimum, scaling with size (explained below)</td>
          </tr>
          <tr>
            <td>AI plain-English explanation (Rules tab)</td>
            <td>5 — repeats for the same strategy are cached and free</td>
          </tr>
          <tr>
            <td>Deploy a daily strategy to the ledger</td>
            <td>No credit fee — uses one of your plan&rsquo;s slots</td>
          </tr>
          <tr>
            <td>Deploy a 15m/30m/60m strategy (Pro/Max)</td>
            <td>100, one-time</td>
          </tr>
          <tr>
            <td>Deploy a 1m/5m strategy (Pro/Max)</td>
            <td>250, one-time</td>
          </tr>
        </tbody>
      </table>

      <h3>Symbol blocks</h3>
      <p>
        Backtests price by the size of the universe they actually resolve: one
        block per 10 symbols, capped at 20 blocks. So 1–10 symbols is the base
        price, 11 symbols doubles it, and the full-US universe hits the cap —
        a daily-bar run over everything is 10 × 20 = 200 credits, no matter
        how large the market grows. The benchmark symbol is added free, and
        running an unmodified template always prices at the base rate.
      </p>

      <h3>How chat pricing works</h3>
      <p>
        A chat message is priced <em>before</em> the model is called, from the
        size of everything we send: your recent messages plus the strategy
        spec and latest results the AI needs for context. The rate works out
        to roughly one credit per 2,000 characters, with a 12-credit minimum
        — and a typical message just costs the minimum. Context is capped
        (only your last 12 messages travel, each trimmed to 2,000
        characters), so a long conversation can&rsquo;t quietly snowball into
        an expensive one.
      </p>

      <h2>Plans and top-ups</h2>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Price</th>
            <th>Credits</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Free</td>
            <td>$0</td>
            <td>250, once at signup</td>
          </tr>
          <tr>
            <td>Pro</td>
            <td>$29 / month</td>
            <td>2,500 per month</td>
          </tr>
          <tr>
            <td>Max</td>
            <td>$79 / month</td>
            <td>10,000 per month</td>
          </tr>
        </tbody>
      </table>
      <p>
        Top-up packs: <strong>500 credits for $10</strong> or{" "}
        <strong>1,500 for $25</strong>. Per credit, packs cost more than a
        subscription — deliberately. If you buy packs regularly, subscribing
        is the better deal, and we&rsquo;d rather tell you that here than let
        you discover it on a statement.
      </p>
      <p>Plans also gate a few features beyond the allowance:</p>
      <ul>
        <li>Symbols per run: 10 on Free, 100 on Pro, 200 on Max.</li>
        <li>Forward-test slots: 1 on Free, 5 on Pro, 25 on Max.</li>
        <li>Private deployments: Pro and above (public is free).</li>
        <li>The full-US universe: Max only.</li>
        <li>Intraday forward deployments: Pro and Max.</li>
      </ul>

      <h2>Refunds and running out</h2>
      <p>
        Credits are spent before an action runs, and refunded automatically if
        it fails: a backtest that hits an engine error, a chat call that
        doesn&rsquo;t reach the model, a deploy that can&rsquo;t complete —
        all come back on their own, no support ticket. If your balance
        can&rsquo;t cover an action, it is blocked before anything runs and
        you see your current balance — nothing is ever half-charged.
      </p>

      <Callout kind="honest" title="What credits actually pay for">
        <p>
          Most of what the lab does is nearly free for us — rerunning a
          strategy over cached historical bars costs close to nothing. The
          real costs are AI tokens and market-data subscriptions, and credit
          prices follow that shape: intraday runs cost more than daily
          because the data does; a huge pasted chat message costs more than a
          one-liner because the tokens do. Prices carry a margin — this is a
          business — but the structure tracks cost, not attention-milking.
        </p>
      </Callout>

      <DocsFooterNav
        prev={{ href: "/docs/reading-results", label: "Reading the results" }}
        next={{ href: "/docs/chat", label: "Building by chat" }}
      />
    </>
  );
}
