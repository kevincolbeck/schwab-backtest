import Image from "next/image";
import Link from "next/link";
import SectionShell from "@/components/SectionShell";
import XProfileLink from "@/components/XProfileLink";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DISCLAIMER } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About — who builds Chat·Backtest and why",
  description:
    "Kevin Colbeck built Chat·Backtest after eight years of trading and five of writing his own indicators — because proving a strategy took months and shouldn't.",
  path: "/about",
});

/** Founder portrait. Set to "/kevin.png" once a BACKGROUND-REMOVED PNG (with
 *  real transparency) is saved to web/public/. Left null until then so the
 *  page never ships a broken image.
 *
 *  The Hormozi-style look is done in CSS, not baked into the file: a solid
 *  accent disc behind a transparent cutout. That keeps the asset reusable
 *  (OG cards, press) and lets the colour follow our tokens. */
const PORTRAIT: string | null = "/kevin.png";

function FounderPortrait() {
  if (!PORTRAIT) return null;
  return (
    <figure className="mb-8 flex items-center gap-5">
      <div
        className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full sm:h-32 sm:w-32"
        style={{ backgroundColor: "var(--accent)" }}
      >
        <Image
          src={PORTRAIT}
          alt="Kevin Colbeck, founder of Chat·Backtest"
          fill
          sizes="128px"
          className="object-cover object-top"
          priority
        />
      </div>
      <figcaption className="text-sm text-muted">
        <span className="block font-medium text-ink">Kevin Colbeck</span>{" "}
        Founder · trading 8+ years · building software 5+
      </figcaption>
    </figure>
  );
}

export default function AboutPage() {
  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow="About · Who builds this"
        title="Eight years of jumping between strategies. That's the whole origin story."
        sub={
          <>
            I got tired of not knowing which of my ideas actually worked — and
            I could write the code to find out. So I did, and then I turned it
            into something anyone can use.
          </>
        }
      >
        <div className="max-w-[70ch]">
          <FounderPortrait />
        </div>
        <div className="docs-prose max-w-[70ch]">
          <p>
            I&rsquo;m <strong>Kevin Colbeck</strong>. I&rsquo;m 24, I&rsquo;ve
            been trading for more than eight years, and I&rsquo;ve been writing
            software for most of that time too — five-plus years building my
            own indicators and trading algorithms, long before any of it looked
            like a company.
          </p>
          <p>
            For most of those eight years I was doing what a lot of traders do:
            jumping from strategy to strategy. Read about a setup, try it,
            catch a couple of good weeks, hit a bad stretch, wonder whether the
            edge was ever real or whether I&rsquo;d just been lucky — and move
            on to the next idea without ever really answering the question.
            Every jump felt like progress. Almost none of it was.
          </p>
          <p>
            Eventually I started answering the question with code instead of
            with feelings. That was better, and it was still brutally slow. To
            prove a single strategy honestly you have to state the rules
            exactly, get clean historical data, build a simulator that
            doesn&rsquo;t cheat, account for slippage, resist tuning it until
            the curve looks good, and then — the part almost nobody does — wait
            and watch it perform on data you didn&rsquo;t have when you built
            it. Months of work per idea. I had a hundred ideas.
          </p>

          <h2>So I built the thing I needed</h2>
          <p>
            Chat·Backtest is that whole process compressed into seconds.
            Describe a strategy the way you&rsquo;d explain it to a friend. The
            AI turns it into exact, inspectable rules — no black box, you can
            read every line and export it. A real engine runs it across two
            decades of market data and shows you what actually happened,
            including the parts you were hoping not to see.
          </p>
          <p>
            The thing I care most about is the second half, because it&rsquo;s
            the half the industry skips. Anybody can produce a beautiful
            backtest; with enough attempts, so can random noise. That&rsquo;s
            why every strategy here can be frozen and deployed to a{" "}
            <Link href="/leaderboard">public forward-test ledger</Link> — the
            rules get locked and hashed, and from that day forward the strategy
            scores itself on data nobody had when it was written. The record is
            append-only. We can&rsquo;t edit it, and neither can you. Losers
            stay on the board on purpose.
          </p>
          <p>
            That&rsquo;s the whole philosophy, and it&rsquo;s deliberately the
            opposite of how this industry usually works.{" "}
            <strong>They sell the dream. We sell the proof.</strong>
          </p>

          <h2>What this is not</h2>
          <p>
            I want to be blunt about this, because the space is full of people
            who aren&rsquo;t. Chat·Backtest does not send signals, does not
            tell you what to buy, does not predict prices, and does not touch
            your brokerage account. There is no &ldquo;autopilot.&rdquo; It is
            a research and education tool for testing ideas on historical data
            and keeping an honest record of how they hold up. What you do with
            what you learn is yours, and the risk is yours too.
          </p>
          <p>
            I also don&rsquo;t hide the ugly results. Some of the strategies in
            our own library lost money, and we published them with the numbers
            attached — including{" "}
            <Link href="/blog/vwap-strategy-backtest">
              a strategy of ours that failed
            </Link>
            . A library where everything wins is evidence of curation, not
            skill.
          </p>

          <h2>Where this is going</h2>
          <p>
            The near-term goal is to make proving an idea completely
            frictionless: more markets and timeframes, deeper trade-by-trade
            forensics, and exports that let you run your strategy anywhere you
            like — it&rsquo;s your work, not ours to lock up.
          </p>
          <p>
            The longer-term goal is bigger, and it&rsquo;s the reason the
            ledger exists at all. Right now the only way to judge someone&rsquo;s
            trading is to trust their screenshots. I want a place where a
            track record is a timestamped, independently verifiable, publicly
            auditable object — where &ldquo;I called that&rdquo; can be checked
            by anyone in about four seconds. If that becomes normal, a lot of
            what the retail trading industry currently gets away with stops
            working. That seems like a good outcome.
          </p>

          <h2>Get in touch</h2>
          <p>
            I read everything. If something here is broken, wrong, or
            misleading — especially if you think a number is misleading — I
            want to know. Email{" "}
            <a href="mailto:kevin@chatbacktest.com">kevin@chatbacktest.com</a>.
          </p>
          <p className="not-prose flex items-center gap-2 text-sm text-muted">
            <span>We post new records and write-ups on X:</span>
            <XProfileLink size={16} />
          </p>
        </div>

        <Card className="mt-10 max-w-[70ch] text-caption leading-relaxed text-faint">
          {DISCLAIMER}
        </Card>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/playground">Run a backtest free</ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary">
            See the live records
          </ButtonLink>
        </div>
      </SectionShell>
    </main>
  );
}
