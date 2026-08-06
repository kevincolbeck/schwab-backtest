import Link from "next/link";
import { Callout, DocsFooterNav } from "@/components/docs/DocsBits";

export const metadata = {
  title: "Plans & limits",
  description:
    "What each plan can do, how the quiet fair-use limits work, and why there is no usage counter to watch while you work.",
};

export default function PlansPage() {
  return (
    <>
      <h1>Plans &amp; limits</h1>
      <p>
        Plans here sell <strong>capabilities</strong>, not usage currency.
        There is no counter in the lab, nothing drains while you work, and no
        action has a price attached to it. What changes between tiers is what
        you can <em>do</em>: which timeframes and markets you can test, how
        many symbols per run, how many strategies you can put on the public
        ledger, and whether your exports and share links carry a watermark.
      </p>

      <h2>What each plan can do</h2>
      <table>
        <thead>
          <tr>
            <th>Capability</th>
            <th>Free</th>
            <th>Pro — $39/mo</th>
            <th>Max — $99/mo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Daily-data backtests</td>
            <td>Unlimited</td>
            <td>Unlimited</td>
            <td>Unlimited</td>
          </tr>
          <tr>
            <td>The strategy library</td>
            <td>Daily templates (12 of 14)</td>
            <td>All 14</td>
            <td>All 14</td>
          </tr>
          <tr>
            <td>Intraday timeframes (1m–60m)</td>
            <td>—</td>
            <td>✓</td>
            <td>✓</td>
          </tr>
          <tr>
            <td>Symbols per run</td>
            <td>10</td>
            <td>100</td>
            <td>200</td>
          </tr>
          <tr>
            <td>Full US universe (ALL_US)</td>
            <td>—</td>
            <td>—</td>
            <td>✓</td>
          </tr>
          <tr>
            <td>Crypto markets (X:BTCUSD …)</td>
            <td>—</td>
            <td>—</td>
            <td>✓</td>
          </tr>
          <tr>
            <td>Forward-test deployments</td>
            <td>1 (public)</td>
            <td>10</td>
            <td>Unlimited</td>
          </tr>
          <tr>
            <td>Private deployments</td>
            <td>—</td>
            <td>✓</td>
            <td>✓</td>
          </tr>
          <tr>
            <td>Clean share links (no watermark)</td>
            <td>—</td>
            <td>✓</td>
            <td>✓</td>
          </tr>
          <tr>
            <td>Python + Pine Script export</td>
            <td>✓</td>
            <td>✓</td>
            <td>✓</td>
          </tr>
        </tbody>
      </table>
      <p>
        Annual billing is 10 months&rsquo; price for 12 — two months free —
        and changes nothing about what a plan can do. No account at all still
        gets you daily-bar template runs (10 a day per visitor) and a few AI
        messages, which is enough to feel the whole loop before deciding.
      </p>

      <h2>The quiet fair-use limits</h2>
      <p>
        Two things here genuinely cost us money per use: AI model tokens and
        intraday market data. So every plan carries per-day limits on those
        two in the background. We don&rsquo;t display them as a countdown —
        watching a number fall changes how people use a research tool — but
        we&rsquo;re not going to hide the numbers either. Here they are.
      </p>
      <table>
        <thead>
          <tr>
            <th>Per day</th>
            <th>Free</th>
            <th>Pro</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Backtests</td>
            <td>50</td>
            <td>Uncapped</td>
            <td>Uncapped</td>
          </tr>
          <tr>
            <td>AI chat messages</td>
            <td>5</td>
            <td>15</td>
            <td>40</td>
          </tr>
          <tr>
            <td>New AI explanations</td>
            <td>5</td>
            <td>10</td>
            <td>20</td>
          </tr>
        </tbody>
      </table>
      <p>
        The backtest limit is a genuine anti-script guardrail — 50 runs a day
        is far more than hands-on testing produces. The AI limits are real
        constraints on the free tier and worth knowing before you plan a long
        strategy session: five messages is roughly two or three edits and a
        question. Explanations you&rsquo;ve already generated stay readable
        forever at no cost, since they&rsquo;re cached by strategy behavior —
        only <em>new</em> ones count. If you hit a limit the message says so
        plainly and tells you it resets tomorrow; on a paid plan it&rsquo;s a
        guardrail rather than a quota, so email us and we&rsquo;ll raise it.
      </p>

      <h2>Top-up packs (optional overflow)</h2>
      <p>
        Packs — <strong>500 for $10</strong> or <strong>1,500 for $25</strong>{" "}
        — buy overflow headroom that&rsquo;s used automatically <em>only</em>{" "}
        if you pass a daily fair-use limit, so heavy days keep working instead
        of stopping. They never expire, and most accounts never touch them.
        If you find yourself buying packs regularly, upgrading is cheaper —
        we&rsquo;d rather say that here than let you discover it on a
        statement. Any balance you hold is shown on your{" "}
        <Link href="/account">account page</Link>, and nowhere else.
      </p>

      <Callout kind="honest" title="Why we dropped per-action pricing">
        <p>
          We used to price each run and message in credits. It was accurate to
          our costs and wrong for the product: new users rationed their own
          curiosity, and the first thing they learned about a research tool
          was what it cost to think. Flat capability tiers move the decision
          to one honest question — what do you need to be able to do? —
          and leave the metering where it belongs: invisible, generous, and
          our problem, not yours.
        </p>
      </Callout>

      <DocsFooterNav
        prev={{ href: "/docs/reading-results", label: "Reading the results" }}
        next={{ href: "/docs/chat", label: "Building by chat" }}
      />
    </>
  );
}
