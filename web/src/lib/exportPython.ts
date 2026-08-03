import type { Spec } from "./types";
import { englishRules } from "./englishRules";

/** Generate a runnable, self-documenting Python file for a strategy.
 *  Runs against the open engine in the repo — take your strategy with you. */
export function pythonExport(spec: Spec): string {
  const rules = englishRules(spec);
  const englishBlock = [
    rules.universe,
    ...rules.entry,
    ...rules.exits,
    rules.sizing,
  ]
    .map((line) => `#   ${line}`)
    .join("\n");

  return `"""${spec.name ?? "Strategy"} — exported from chat-backtest.

THE RULES IN PLAIN ENGLISH
${englishBlock.replace(/^#/gm, " ")}

HOW TO RUN THIS BACKTEST YOURSELF
  1. git clone https://github.com/kevincolbeck/schwab-backtest
  2. pip install -r engine/requirements.txt
  3. python engine/run_backtest_cli.py path/to/this_file.py.json

  (Running this file directly also works: it writes the spec JSON next to
   itself and prints the command to run.)

Historical simulation for research and education. Not financial advice.
Past performance does not predict future results.
"""

import json
from pathlib import Path

STRATEGY_SPEC = ${JSON.stringify(spec, null, 2)}

if __name__ == "__main__":
    out = Path(__file__).with_suffix(".json")
    out.write_text(json.dumps(STRATEGY_SPEC, indent=2), encoding="utf-8")
    print(f"spec written to {out}")
    print(f"run it:  python engine/run_backtest_cli.py {out}")
`;
}

export function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugifyName(name: string | undefined): string {
  return (name || "strategy").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}
