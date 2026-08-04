import { Callout, DocsFooterNav, Step, Steps } from "@/components/docs/DocsBits";

export const metadata = {
  title: "Export to Python",
  description:
    "What the Python export contains, how to run it against the open engine, and how the embedded spec keeps your results reproducible.",
};

export default function ExportPythonPage() {
  return (
    <>
      <h1>Export to Python</h1>
      <p>A self-documenting file that carries your strategy — and its receipts.</p>

      <p>
        The <strong>↓ Python</strong> button on the Rules tab downloads a single{" "}
        <code>.py</code> file built for one purpose: letting you reproduce and
        extend your research away from this site, against the same open-source
        engine that ran your backtest. No account required to run it, no calls
        back to us.
      </p>

      <h2>What is in the file</h2>
      <ul>
        <li>
          <strong>The rules in plain English</strong> — the same universe,
          entry, exit, and sizing sentences from the Rules tab, at the top of
          the docstring, so the file explains itself to anyone who opens it.
        </li>
        <li>
          <strong>Run instructions</strong> — the exact commands to reproduce
          the backtest locally, in the docstring.
        </li>
        <li>
          <strong>The complete spec</strong> — <code>STRATEGY_SPEC</code>, a
          Python dict holding the strategy JSON verbatim, exactly as the lab ran
          it. The spec travels with the file; nothing is summarized or lossy.
        </li>
        <li>
          <strong>The standard disclaimer</strong> — historical simulation for
          research and education, not financial advice.
        </li>
      </ul>
      <p>
        Running the file directly does one small thing: it writes the spec out
        as JSON next to itself and prints the command to run it. It contains no
        trading logic of its own — the engine in the repo is the single
        implementation of the rules.
      </p>

      <h2>Running the backtest locally</h2>
      <Steps>
        <Step n={1} title="Clone the engine">
          <code>git clone https://github.com/kevincolbeck/schwab-backtest</code>
          {" "}— the same engine this site runs, in the open.
        </Step>
        <Step n={2} title="Install dependencies">
          <code>pip install -r engine/requirements.txt</code> (a recent Python 3
          and the usual scientific stack).
        </Step>
        <Step n={3} title="Set a data key">
          The engine fetches daily bars from Polygon.io: set{" "}
          <code>POLYGON_API_KEY</code> in your environment. Fetched data is
          cached in a local SQLite file, so the first run does the downloading
          and later runs are fast.
        </Step>
        <Step n={4} title="Emit the spec JSON">
          <code>python golden-cross.py</code> writes{" "}
          <code>golden-cross.json</code> next to the file and prints the run
          command.
        </Step>
        <Step n={5} title="Run it">
          <code>python engine/run_backtest_cli.py golden-cross.json</code> — add
          start and end dates as extra arguments to change the window (the
          default is 2016 to today). The CLI logs progress, prints the summary
          stats (return, CAGR, Sharpe, drawdown, win rate, and so on), and
          saves a JSON results summary under <code>backtest_runs/</code>.
        </Step>
      </Steps>

      <h2>Reproducibility and versioning</h2>
      <p>
        The spec is the strategy. Same spec, same engine, same date window,
        same data — same results. Because the export embeds the spec verbatim,
        the file is a complete snapshot: editing the strategy in the lab later
        does not change the download you already have. If you iterate
        seriously, keep exports under version control like any other source
        file; diffing two exported specs shows you exactly what changed between
        versions of an idea. This is the same property the ledger leans on —
        deployed strategies are identified by a hash of this JSON.
      </p>

      <h2>Who this is for</h2>
      <p>
        Coders, mostly. If you want to run longer histories or custom date
        ranges, sweep parameters by editing the JSON and re-running, step
        through the engine to understand exactly how a trade was filled, or
        adapt the data layer to your own sources — everything is ordinary
        Python in the repo, and nothing about your strategy is locked to this
        site. If you never touch Python, you lose nothing: the same rules are
        available as <a href="/docs/export-pine">Pine Script</a> and as{" "}
        <a href="/docs/manual-trading">plain English</a>.
      </p>

      <Callout kind="honest" title="This is a research tool, not a trading bot">
        <p>
          The exported file and the engine behind it simulate history. They
          connect to no broker, place no orders, and emit no alerts. If you
          eventually automate a strategy with your own infrastructure, that is
          your build and your responsibility — and the honest path runs through
          a long stretch of <a href="/docs/forward-testing">forward testing</a>{" "}
          and paper trading first.
        </p>
      </Callout>

      <DocsFooterNav
        prev={{ href: "/docs/export-pine", label: "Export to Pine Script" }}
        next={{ href: "/docs/manual-trading", label: "Manual trading" }}
      />
    </>
  );
}
