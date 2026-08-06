import Link from "next/link";
import { Callout, DocsFooterNav } from "@/components/docs/DocsBits";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Introduction — Docs — Chat·Backtest",
  description:
    "What Chat·Backtest is, how the docs are organized, and where to start: the lab, the ledger, and how to take your strategies with you.",
  path: "/docs",
});

const SECTION_CARDS = [
  {
    eyebrow: "Start here",
    title: "Your first backtest",
    body: "From a plain-English idea to a finished results report. The fastest way to understand what this product does.",
    href: "/docs/first-backtest",
    cta: "Run one now",
    featured: true,
  },
  {
    eyebrow: "The Lab",
    title: "Building strategies",
    body: "Describe rules in chat, pick markets and timeframes, and understand the spec the engine actually runs.",
    href: "/docs/chat",
    cta: "How the lab works",
    featured: false,
  },
  {
    eyebrow: "The Ledger",
    title: "Forward testing",
    body: "Freeze a strategy and let it accrue a public, append-only track record on data nobody had when it was built.",
    href: "/docs/forward-testing",
    cta: "How the ledger works",
    featured: false,
  },
  {
    eyebrow: "Your arsenal",
    title: "Taking it with you",
    body: "Export to Pine Script or Python, or read the plain-English rules and trade the strategy by hand.",
    href: "/docs/export-pine",
    cta: "Export options",
    featured: false,
  },
];

export default function DocsIntroPage() {
  return (
    <>
      <h1>Introduction</h1>
      <p>The lab, the ledger, and how to take your strategies with you.</p>

      <p>
        Chat·Backtest is a place to find out whether a trading idea would have
        worked before you risk anything on it. You describe the rules in plain
        English, the lab turns them into a precise specification, and the engine
        replays them against years of historical market data in seconds. When a
        strategy is worth defending, you can deploy it to the ledger — a public
        forward test that scores it on data that did not exist when it was built.
      </p>

      <Callout kind="honest" title="What this is — and is not">
        <p>
          This is a research and education tool: a backtesting lab plus a public
          forward-test ledger. It does not connect to a broker, it does not place
          trades, and it does not tell you what to buy or sell. Nothing here is
          financial advice. A good backtest is a hypothesis about the past, not a
          promise about the future — the ledger exists precisely because those two
          things are different.
        </p>
      </Callout>

      <div className="my-8 grid gap-4 sm:grid-cols-2">
        {SECTION_CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`card focus-ring group flex flex-col p-5 transition-colors hover:border-hairline-strong ${
              c.featured ? "gloss-ring-hover" : ""
            }`}
          >
            <span
              className={`font-mono text-caption uppercase tracking-widest ${
                c.featured ? "text-accent" : "text-faint"
              }`}
            >
              {c.eyebrow}
            </span>
            <span className="mt-2 text-base font-semibold text-ink">{c.title}</span>
            <span className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
              {c.body}
            </span>
            <span className="mt-4 text-sm font-medium text-accent group-hover:text-accent-hover">
              {c.cta} →
            </span>
          </Link>
        ))}
      </div>

      <h2>How the docs are organized</h2>
      <ul>
        <li>
          <strong>Getting started</strong> walks through your first backtest, how to
          read the results honestly, and how credits meter usage.
        </li>
        <li>
          <strong>The Lab</strong> covers building by chat, the markets and
          timeframes available to test on, and the strategy spec itself.
        </li>
        <li>
          <strong>The Ledger</strong> explains forward testing: frozen specs,
          append-only records, and why losers stay on the board.
        </li>
        <li>
          <strong>Your arsenal</strong> is about leaving with something useful —
          Pine Script and Python exports, and trading a strategy manually from its
          plain-English rules.
        </li>
      </ul>

      <DocsFooterNav
        next={{ href: "/docs/first-backtest", label: "Your first backtest" }}
      />
    </>
  );
}
