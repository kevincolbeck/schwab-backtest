import type { Spec } from "./types";

/** Deterministic spec → plain-English translation (v1).
 *  Accuracy beats prose: grouping parentheses are PRESERVED, function calls
 *  are rewritten before anything else, and identifiers we can't confidently
 *  translate are left exactly as written rather than mangled. */

const INDICATOR_WORDS: Record<string, string> = {
  sma: "day average",
  ema: "day exponential average",
  rsi: "day RSI",
  zscore: "day z-score",
  atr: "day ATR",
  stddev: "day standard deviation",
};

function humanizeExpression(rule: string): string {
  let out = ` ${rule} `;

  // 1. Bracket lookback sugar first: name[N] -> (name N bars ago)
  out = out.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*(\d+)\s*\]/g,
    "($1 from $2 bars ago)",
  );

  // 2. Function calls BEFORE any other rewriting (their commas/parens are load-bearing).
  out = out.replace(
    /\bcrosses_above\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    "($1 crosses above $2)",
  );
  out = out.replace(
    /\bcrosses_below\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    "($1 crosses below $2)",
  );
  out = out.replace(
    /\blag\(\s*([^,()]+?)\s*,\s*(\d+)\s*\)/g,
    "($1 from $2 bars ago)",
  );
  out = out.replace(
    /\bpct_change\(\s*([^,()]+?)\s*,\s*(\d+)\s*\)/g,
    "(the $2-bar change in $1)",
  );

  // 3. Cross-symbol columns: spy_close -> SPY's closing price
  out = out.replace(
    /\b([a-z]{1,6})_(open|close|high|low|volume)\b/g,
    (m, sym, field) => {
      if (sym === "vol") return m; // vol_sma_20 handled below
      const word =
        field === "close" ? "closing price"
        : field === "open" ? "opening price"
        : field === "volume" ? "volume"
        : `daily ${field}`;
      return `${sym.toUpperCase()}'s ${word}`;
    },
  );

  // 4. Base price words BEFORE named compounds — compound identifiers like
  //    high_252 are protected by \b (the underscore blocks the boundary), and
  //    doing this first means later phrases like "the 252-day high" are never
  //    re-mangled by the bare-word pass.
  out = out.replace(/\bclose\b/g, "the closing price");
  out = out.replace(/\bopen\b/g, "the opening price");
  out = out.replace(/\bhigh\b/g, "the daily high");
  out = out.replace(/\blow\b/g, "the daily low");
  out = out.replace(/\bvolume\b/g, "volume");
  out = out.replace(/\bmonth\b/g, "the calendar month");

  // 5. Named compound indicators from our templates (most specific first).
  out = out.replace(/\bvol_sma_(\d+)\b/g, "the $1-day average volume");
  out = out.replace(/\bhigh_(\d+)_prev\b/g, "yesterday's $1-day high");
  out = out.replace(/\blow_(\d+)_prev\b/g, "yesterday's $1-day low");
  out = out.replace(/\bhigh_(\d+)\b/g, "the $1-day high");
  out = out.replace(/\blow_(\d+)\b/g, "the $1-day low");
  out = out.replace(/\bclose_(\d+)\b/g, "the closing price $1 bars ago");

  // 6. Simple indicator names: sma_50 -> the 50-day average. \b keeps
  //    unknown compounds (mom_63, stop_2n) untouched instead of mangled.
  out = out.replace(/\b(sma|ema|rsi|zscore|atr|stddev)_(\d+)\b/g, (m, kind, len) => {
    const word = INDICATOR_WORDS[kind];
    return word ? `the ${len}-${word}` : m;
  });

  // 7. Comparators — compound operators strictly before simple ones.
  out = out.replace(/>=/g, " is at or above ");
  out = out.replace(/<=/g, " is at or below ");
  out = out.replace(/==/g, " equals ");
  out = out.replace(/>/g, " is above ");
  out = out.replace(/</g, " is below ");

  // 8. Boolean operators — parentheses are KEPT so grouping stays unambiguous.
  out = out.replace(/&/g, " AND ");
  out = out.replace(/\|/g, " OR ");
  out = out.replace(/~\s*/g, "NOT ");
  out = out.replace(/\*/g, "×");

  // 9. Grammar: singular bars.
  out = out.replace(/\bfrom 1 bars ago\b/g, "from 1 bar ago");

  return out.replace(/\s+/g, " ").trim();
}

export interface EnglishRules {
  universe: string;
  entry: string[];
  exits: string[];
  sizing: string;
  raw: { entry?: string; exit?: string };
}

export function englishRules(spec: Spec): EnglishRules {
  const symbols = spec.symbols ?? [];
  const isAllUs = symbols.some((s) => ["ALL_US", "*", "ALL"].includes(String(s).toUpperCase()));
  const universe = isAllUs
    ? "Scans the full US stock universe (currently listed symbols)."
    : `Trades ${symbols.length} symbol${symbols.length === 1 ? "" : "s"}: ${symbols.join(", ")}.`;

  const entry: string[] = [];
  const entryRule = spec.entry_rule_long || spec.entry_rule;
  if (entryRule) entry.push(`Go long when ${humanizeExpression(entryRule)}.`);
  if (spec.entry_rule_short) entry.push(`Go short when ${humanizeExpression(spec.entry_rule_short)}.`);
  if (spec.entry_price_field && spec.entry_price_field !== "close") {
    entry.push(`Simulated fills happen at the ${spec.entry_price_field} price of the signal bar.`);
  }

  const exits: string[] = [];
  if (spec.exit_rule) exits.push(`Exit when ${humanizeExpression(spec.exit_rule)}.`);
  const stop = Number(spec.stop_loss_pct ?? 0);
  if (stop > 0) exits.push(`Hard stop-loss ${stop}% below the entry price.`);
  if (spec.stop_loss_field) exits.push(`Stop distance set by the "${spec.stop_loss_field}" indicator (volatility-based).`);
  const tp = Number(spec.take_profit_pct ?? 0);
  if (tp > 0) exits.push(`Take profit at +${tp}%.`);
  const hold = Number(spec.max_holding_days ?? 0);
  if (hold > 0) exits.push(`Time exit: close the position after ${hold} trading days regardless.`);
  if (!exits.length) exits.push("No explicit exit — positions close only at the end of the test.");

  const sizeMode = spec.position_size_mode === "risk_pct" ? "risk-based" : "fixed-percent";
  const sizing =
    sizeMode === "risk-based"
      ? `Risk-based sizing: each trade risks ${spec.risk_per_trade_pct ?? 0.75}% of equity, up to ${spec.max_positions ?? 1} position${(spec.max_positions ?? 1) === 1 ? "" : "s"} at once.`
      : `Each position uses ${spec.position_size_pct ?? 10}% of equity, up to ${spec.max_positions ?? 1} position${(spec.max_positions ?? 1) === 1 ? "" : "s"} at once.`;

  return {
    universe,
    entry,
    exits,
    sizing,
    raw: { entry: entryRule, exit: spec.exit_rule },
  };
}
