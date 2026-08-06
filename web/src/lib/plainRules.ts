import type { Spec } from "@/lib/types";

/** Spec → plain-English rules (Section 4 §3, and the "Rules in plain English"
 *  panel Phase B calls for).
 *
 *  DETERMINISTIC ON PURPOSE. This is a pure function of the spec, with no LLM
 *  in the path, because the failure mode of a generated description is that it
 *  quietly stops matching the rules it describes — and this text is the whole
 *  basis on which a manual trader would place the trade. A translator that can
 *  drift is worse than no translator.
 *
 *  Where a rule expression is too complex to phrase safely, we render the
 *  expression itself rather than guessing at its meaning. Being visibly
 *  literal beats being confidently wrong.
 */

const INDICATOR_WORDS: Record<string, string> = {
  sma: "the {len}-day average",
  ema: "the {len}-day exponential average",
  rsi: "the {len}-period RSI",
  atr: "the {len}-period ATR",
  macd: "MACD",
  bbands: "the {len}-day Bollinger bands",
  stoch: "the {len}-period stochastic",
  adx: "the {len}-period ADX",
  vwap: "VWAP",
  obv: "on-balance volume",
  highest: "the highest high of the last {len} bars",
  lowest: "the lowest low of the last {len} bars",
};

/** Human phrase for one indicator, e.g. sma_50 → "the 50-day average". */
export function describeIndicator(ind: {
  name?: string;
  type?: string;
  length?: number;
  source?: string;
}): string {
  const tpl = INDICATOR_WORDS[String(ind.type ?? "").toLowerCase()];
  if (!tpl) return ind.name ?? ind.type ?? "an indicator";
  return tpl.replace("{len}", String(ind.length ?? ""));
}

const TIMEFRAME_WORDS: Record<string, string> = {
  "1d": "daily bars",
  "60m": "60-minute bars",
  "30m": "30-minute bars",
  "15m": "15-minute bars",
  "5m": "5-minute bars",
  "1m": "1-minute bars",
};

/** Rewrite a rule expression into something readable, without pretending to
 *  fully parse it. Indicator names become their phrases; the operators become
 *  words; everything else is left exactly as written. */
export function humanizeExpression(expr: string, spec: Spec): string {
  if (!expr || !expr.trim()) return "";
  let out = expr;
  // Longest name first so sma_200 isn't clobbered by a shorter prefix.
  const inds = [...(spec.indicators ?? [])].sort(
    (a, b) => String(b.name ?? "").length - String(a.name ?? "").length,
  );
  for (const ind of inds) {
    if (!ind.name) continue;
    out = out.split(ind.name).join(describeIndicator(ind));
  }
  return out
    .replace(/\blag\(([^,]+),\s*(\d+)\)/g, "$1 $2 bar(s) ago")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*\|\s*/g, " or ")
    .replace(/>=/g, "is at or above")
    .replace(/<=/g, "is at or below")
    .replace(/(?<![<>=!])>(?!=)/g, "is above")
    .replace(/(?<![<>=!])<(?!=)/g, "is below")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface PlainRule {
  label: string;
  text: string;
}

/** The full rule set, in the order a trader would need it. */
export function plainRules(spec: Spec): PlainRule[] {
  const rules: PlainRule[] = [];
  const symbols = spec.symbols ?? [];
  const tf = TIMEFRAME_WORDS[String(spec.backtest_timeframe ?? "1d")] ?? "daily bars";

  rules.push({
    label: "Universe",
    text: `${symbols.length} symbol${symbols.length === 1 ? "" : "s"} — ${symbols.join(", ")} — on ${tf}.`,
  });

  const entry = humanizeExpression(String(spec.entry_rule_long ?? ""), spec);
  if (entry) {
    const at = spec.entry_price_field === "open" ? "next open" : "the close";
    rules.push({ label: "Entry", text: `Buy at ${at} when ${entry}.` });
  }

  const exit = humanizeExpression(String(spec.exit_rule ?? ""), spec);
  const stop = Number(spec.stop_loss_pct ?? 0);
  const target = Number(spec.take_profit_pct ?? 0);
  const maxDays = Number(spec.max_holding_days ?? 0);
  const exits: string[] = [];
  if (exit) exits.push(`when ${exit}`);
  if (stop > 0) exits.push(`on a ${stop}% stop-loss`);
  if (target > 0) exits.push(`on a ${target}% profit target`);
  if (maxDays > 0) exits.push(`after ${maxDays} bars in the trade`);
  rules.push({
    label: "Exit",
    text: exits.length
      ? `Sell ${exits.join(", or ")}${exits.length > 1 ? " — whichever comes first." : "."}`
      : // Worth stating out loud: a strategy with no exit condition at all is
        // a fact a reader needs, not an omission to paper over.
        "No exit condition is defined — positions are held for the whole test.",
  });

  const pct = Number(spec.position_size_pct ?? 0);
  const maxPos = Number(spec.max_positions ?? 0);
  if (pct > 0) {
    rules.push({
      label: "Sizing",
      text: `${pct}% of equity per position${maxPos > 0 ? `, up to ${maxPos} at once` : ""}.`,
    });
  }

  if (stop === 0 && target === 0 && maxDays === 0 && exit) {
    rules.push({
      label: "No stop",
      text: "There is no stop-loss, profit target or holding limit — the exit rule is the only thing that closes a position.",
    });
  }

  return rules;
}
