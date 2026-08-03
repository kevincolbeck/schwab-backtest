import type { Indicator, Spec } from "./types";

/** Deterministic spec → Pine Script v6 strategy translator (v1).
 *
 *  PineTS-style tools move Pine OUT of TradingView; this goes the other way:
 *  compile a chat-to-backtest spec INTO Pine so the same rules run on
 *  TradingView too. Accuracy beats cleverness — anything the grammar cannot
 *  express in Pine is surfaced as a `// TODO` comment carrying the original
 *  expression (logic is never silently dropped) and mirrored in `warnings`. */

export interface PineExport {
  code: string;
  warnings: string[];
}

/** Pine built-ins / keywords an indicator name must not shadow. */
const PINE_RESERVED = new Set([
  "open", "high", "low", "close", "volume", "hl2", "hlc3", "ohlc4", "hlcc4",
  "time", "time_close", "year", "month", "dayofmonth", "dayofweek",
  "weekofyear", "hour", "minute", "second", "bar_index", "last_bar_index",
  "na", "true", "false", "and", "or", "not", "if", "else", "for", "while",
  "switch", "var", "varip", "import", "export", "method", "type", "enum",
  "int", "float", "bool", "string", "color", "strategy", "ta", "math",
  "request", "input", "syminfo", "timeframe", "array", "matrix", "map",
  "str", "label", "line", "box", "table", "plot",
]);

const PRICE_FIELDS = new Set(["open", "high", "low", "close", "volume"]);

/** Function names the engine's rule grammar allows (rule_based_engine.py). */
const RULE_FUNCS = new Set([
  "crosses_above", "crosses_below", "lag", "pct_change",
  "sma", "ema", "rsi", "zscore", "atr", "abs", "min", "max",
]);

/** name_length indicators the engine auto-declares when a rule references them. */
const AUTO_INDICATOR_RE = /^(sma|ema|rsi|zscore|atr|stddev)_(\d+)$/;
/** Cross-symbol reference columns (spy_close, qqq_volume, …). */
const EXTERNAL_COLUMN_RE = /^[a-z]{1,6}_(open|high|low|close|volume)$/;

interface TranslateCtx {
  /** raw spec identifier (lowercased) -> pine identifier */
  names: Map<string, string>;
  /** auto-declared name_length indicators referenced by rules/formulas */
  auto: Map<string, { kind: string; length: number }>;
  warnings: string[];
  usesZscore: boolean;
  usesDayOfWeek: boolean;
}

function findMatchingParen(s: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

function splitTopLevelArgs(inner: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      args.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current);
  return args;
}

/** Parenthesize unless the operand is a bare identifier or bracket reference. */
function wrapOperand(operand: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*(\[\d+\])?$/.test(operand)
    ? operand
    : `(${operand})`;
}

function registerAuto(name: string, kind: string, length: number, ctx: TranslateCtx) {
  ctx.auto.set(name, { kind, length });
  if (kind === "zscore") ctx.usesZscore = true;
}

/** Pass 1 — map bare identifiers to Pine equivalents (function names untouched). */
function mapIdentifiers(expr: string, ctx: TranslateCtx, todos: string[]): string {
  return expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name, offset: number, whole: string) => {
    // Part of a numeric literal like 1e5 — leave alone.
    const prev = offset > 0 ? whole[offset - 1] : "";
    if (/[0-9.]/.test(prev)) return name;

    // Function call: rewritten in pass 2; unknown functions become TODOs.
    if (/^\s*\(/.test(whole.slice(offset + name.length))) {
      if (!RULE_FUNCS.has(name)) todos.push(`unknown function "${name}(…)"`);
      return name;
    }

    if (PRICE_FIELDS.has(name) || name === "month" || name === "year") return name;
    if (name === "day_of_week") {
      ctx.usesDayOfWeek = true;
      return "dayOfWeekMon0";
    }
    // Engine's built-in session-anchored VWAP of typical price — Pine's
    // ta.vwap variable is the same construction (hlc3, anchored per session).
    if (name === "session_vwap") return "ta.vwap";
    const lower = name.toLowerCase();
    if (lower === "true" || lower === "false") return lower;

    const mapped = ctx.names.get(name);
    if (mapped) return mapped;

    const auto = name.match(AUTO_INDICATOR_RE);
    if (auto) {
      registerAuto(name, auto[1], Number(auto[2]), ctx);
      return name;
    }
    if (EXTERNAL_COLUMN_RE.test(name)) {
      todos.push(`cross-symbol reference "${name}" — needs request.security() on TradingView`);
      return name;
    }
    todos.push(`unknown identifier "${name}"`);
    return name;
  });
}

function mapCall(fn: string, args: string[], ctx: TranslateCtx): string {
  switch (fn) {
    case "crosses_above":
      return `ta.crossover(${args[0]}, ${args[1]})`;
    case "crosses_below":
      return `ta.crossunder(${args[0]}, ${args[1]})`;
    case "lag":
      return `${wrapOperand(args[0])}[${args[1] ?? "1"}]`;
    case "pct_change": {
      const x = wrapOperand(args[0]);
      return `(${x} / ${x}[${args[1] ?? "1"}] - 1)`;
    }
    case "sma":
      return `ta.sma(${args[0]}, ${args[1]})`;
    case "ema":
      return `ta.ema(${args[0]}, ${args[1]})`;
    case "rsi":
      return `ta.rsi(${args[0]}, ${args[1]})`;
    case "zscore":
      ctx.usesZscore = true;
      return `f_zscore(${args[0]}, ${args[1]})`;
    case "atr":
      // Engine's rule-level atr(n) is a simple mean of true range.
      return `ta.sma(ta.tr(true), ${args[0] ?? "14"})`;
    case "abs":
      return `math.abs(${args.join(", ")})`;
    case "min":
      return `math.min(${args.join(", ")})`;
    case "max":
      return `math.max(${args.join(", ")})`;
    default:
      return `${fn}(${args.join(", ")})`;
  }
}

/** Pass 2 — rewrite grammar function calls (recursive, nesting-safe).
 *  The lookbehind keeps already-emitted `ta.sma(...)` from re-matching. */
function rewriteCalls(s: string, ctx: TranslateCtx, todos: string[]): string {
  const re = /(?<!\.)\b(crosses_above|crosses_below|lag|pct_change|sma|ema|rsi|zscore|atr|abs|min|max)\s*\(/;
  for (let guard = 0; guard < 100; guard++) {
    const match = re.exec(s);
    if (!match) break;
    const openIdx = match.index + match[0].length - 1;
    const closeIdx = findMatchingParen(s, openIdx);
    if (closeIdx < 0) {
      todos.push(`unbalanced parentheses near "${match[1]}("`);
      break;
    }
    const args = splitTopLevelArgs(s.slice(openIdx + 1, closeIdx)).map((a) =>
      rewriteCalls(a.trim(), ctx, todos),
    );
    s = s.slice(0, match.index) + mapCall(match[1], args, ctx) + s.slice(closeIdx + 1);
  }
  return s;
}

/** Translate one engine rule/formula expression into a Pine expression. */
function translateExpression(expr: string, ctx: TranslateCtx, todos: string[]): string {
  let out = ` ${expr} `;
  out = mapIdentifiers(out, ctx, todos);
  out = rewriteCalls(out, ctx, todos);
  // Boolean operators — grouping parens in the source are preserved as-is.
  out = out.replace(/&&/g, "&").replace(/\|\|/g, "|");
  out = out.replace(/&/g, " and ").replace(/\|/g, " or ").replace(/~\s*/g, "not ");
  return out.replace(/\s+/g, " ").trim();
}

/** Emit TODO comment lines for a translated expression, mirroring `warnings`. */
function todoLines(label: string, original: string, todos: string[], ctx: TranslateCtx): string[] {
  if (!todos.length) return [];
  const lines: string[] = [];
  for (const todo of todos) {
    lines.push(`// TODO (${label}): ${todo}`);
    ctx.warnings.push(`${label}: ${todo}`);
  }
  lines.push(`//   original: ${original}`);
  return lines;
}

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1");
  return PINE_RESERVED.has(cleaned) ? `ind_${cleaned}` : cleaned;
}

function resolveSource(source: string, ctx: TranslateCtx, todos: string[]): string {
  const src = source.trim().toLowerCase() || "close";
  if (PRICE_FIELDS.has(src)) return src;
  const mapped = ctx.names.get(src);
  if (mapped) return mapped;
  const auto = src.match(AUTO_INDICATOR_RE);
  if (auto) {
    registerAuto(src, auto[1], Number(auto[2]), ctx);
    return src;
  }
  todos.push(`unknown indicator source "${src}"`);
  return src;
}

function fmtNum(value: number): string {
  return String(Number(value.toFixed(6)));
}

/** Declaration line(s) for one auto or standard indicator. */
function standardIndicatorLine(
  name: string,
  kind: string,
  src: string,
  length: number,
  ctx: TranslateCtx,
): string {
  switch (kind) {
    case "sma":
      return `${name} = ta.sma(${src}, ${length})`;
    case "ema":
      return `${name} = ta.ema(${src}, ${length})`;
    case "rsi":
      return `${name} = ta.rsi(${src}, ${length})`;
    case "zscore":
      ctx.usesZscore = true;
      return `${name} = f_zscore(${src}, ${length})`;
    case "atr":
      return `${name} = ta.sma(ta.tr(true), ${length})  // simple-mean ATR (matches the engine)`;
    case "stddev":
      return `${name} = ta.stdev(${src}, ${length})`;
    case "rolling_max":
    case "max":
      return `${name} = ta.highest(${src}, ${length})`;
    case "rolling_min":
    case "min":
      return `${name} = ta.lowest(${src}, ${length})`;
    default:
      return `${name} = na`;
  }
}

/** Generate a complete Pine Script v6 strategy from a spec.
 *  Returns the script plus any constructs that need manual attention. */
export function pineExport(spec: Spec): PineExport {
  const ctx: TranslateCtx = {
    names: new Map(),
    auto: new Map(),
    warnings: [],
    usesZscore: false,
    usesDayOfWeek: false,
  };

  const declared: Indicator[] = (spec.indicators ?? []).filter(
    (ind): ind is Indicator => !!ind && typeof ind === "object" && !!ind.type,
  );

  // Name map first, so rules and indicator sources can reference any of them.
  for (const ind of declared) {
    const raw =
      String(ind.name ?? "").trim().toLowerCase() ||
      `${String(ind.type).trim().toLowerCase()}_${ind.length ?? 20}`;
    ctx.names.set(raw, sanitizeName(raw));
  }

  // ── Translate rules and custom formulas (collects autos, flags, TODOs) ──
  const entryRuleLong = spec.entry_rule_long || spec.entry_rule;
  const entryTodos: string[] = [];
  const entryPine = entryRuleLong
    ? translateExpression(entryRuleLong, ctx, entryTodos)
    : null;

  const shortTodos: string[] = [];
  const shortPine = spec.entry_rule_short
    ? translateExpression(spec.entry_rule_short, ctx, shortTodos)
    : null;

  const exitTodos: string[] = [];
  const exitPine = spec.exit_rule
    ? translateExpression(spec.exit_rule, ctx, exitTodos)
    : null;

  type Emitted = { ind: Indicator; name: string; lines: string[] };
  const externals: Emitted[] = [];
  const standards: Emitted[] = [];
  const customs: Emitted[] = [];

  for (const ind of declared) {
    const raw =
      String(ind.name ?? "").trim().toLowerCase() ||
      `${String(ind.type).trim().toLowerCase()}_${ind.length ?? 20}`;
    const name = ctx.names.get(raw) ?? sanitizeName(raw);
    const kind = String(ind.type).trim().toLowerCase();
    const todos: string[] = [];

    if (kind === "external") {
      const symbol = String(ind.symbol ?? "?").toUpperCase();
      const field = String(ind.field ?? "close").toLowerCase();
      ctx.warnings.push(
        `indicator "${raw}": external reference ${symbol} ${field} — needs request.security() on TradingView`,
      );
      externals.push({
        ind,
        name,
        lines: [
          `// TODO (indicator "${raw}"): external reference — wire it up on TradingView with:`,
          `//   ${name} = request.security("${symbol}", timeframe.period, ${PRICE_FIELDS.has(field) ? field : "close"})`,
          `${name} = na`,
        ],
      });
      continue;
    }

    if (kind === "custom") {
      const formula = String(ind.formula ?? "").trim();
      const pine = formula ? translateExpression(formula, ctx, todos) : "na";
      if (!formula) todos.push("custom indicator has no formula");
      customs.push({
        ind,
        name,
        lines: [...todoLines(`indicator "${raw}"`, formula, todos, ctx), `${name} = ${pine}`],
      });
      continue;
    }

    const length = Math.max(1, Math.round(Number(ind.length ?? 20)) || 20);
    const src = resolveSource(String(ind.source ?? "close"), ctx, todos);
    let line: string;
    if (kind === "lag") {
      const periods = Math.max(
        1,
        Math.round(Number((ind as { periods?: number }).periods ?? length)) || length,
      );
      line = `${name} = ${src}[${periods}]`;
    } else if (kind === "vwap" || kind === "vwap_proxy") {
      line = `${name} = hlc3  // VWAP proxy: (high + low + close) / 3, matching the engine`;
    } else {
      line = standardIndicatorLine(name, kind, src, length, ctx);
      if (line.endsWith("= na")) todos.push(`unsupported indicator type "${kind}"`);
    }
    standards.push({
      ind,
      name,
      lines: [...todoLines(`indicator "${raw}"`, JSON.stringify(ind), todos, ctx), line],
    });
  }

  // ── Sizing / fills / risk parameters ──
  const qtyPct = Math.min(100, Math.max(1, Number(spec.position_size_pct ?? 10)));
  const riskMode = spec.position_size_mode === "risk_pct";
  if (riskMode) {
    ctx.warnings.push(
      `position_size_mode "risk_pct" has no direct Pine equivalent — exported with ${fmtNum(qtyPct)}%-of-equity sizing (see TODO in the script)`,
    );
  }
  const epf = String(spec.entry_price_field ?? "close").toLowerCase();
  if (epf === "high" || epf === "low") {
    ctx.warnings.push(
      `entry_price_field "${epf}" cannot be reproduced on TradingView — the export fills at the next bar's open`,
    );
  }
  const onClose = epf === "close";
  const stopPct = Number(spec.stop_loss_pct ?? 0);
  const tpPct = Number(spec.take_profit_pct ?? 0);
  const holdDays = Number(spec.max_holding_days ?? 0);
  const stopField = String(spec.stop_loss_field ?? "").trim().toLowerCase();
  const stopFieldName = stopField ? ctx.names.get(stopField) : undefined;
  if (stopField && !stopFieldName) {
    ctx.warnings.push(`stop_loss_field "${stopField}" is not a declared indicator`);
  }
  if (!entryPine && !shortPine) {
    ctx.warnings.push("no entry rule in the spec — the script places no orders");
  }

  const title = String(spec.name ?? "Strategy").replace(/\\/g, "/").replace(/"/g, "'");
  const symbols = (spec.symbols ?? []).map(String);
  const symbolNote =
    symbols.length > 1
      ? `${symbols.length} symbols (${symbols.slice(0, 4).join(", ")}${symbols.length > 4 ? ", …" : ""})`
      : symbols[0] ?? "one symbol";

  // ── Assemble ──
  const out: string[] = [];
  out.push("//@version=6");
  out.push(`// ${title} — exported from chat-to-backtest`);
  out.push("// Generated by the chat-to-backtest Pine exporter (deterministic spec → Pine v6).");
  out.push("//");
  out.push("// Historical/paper simulation for research and education. Not financial advice.");
  out.push("// Past performance does not predict future results.");
  out.push("//");
  out.push("// Backtest results on TradingView will differ from chat-to-backtest —");
  out.push("// different fill models and data.");
  if (symbols.length > 1 || spec.ranking_field || Number(spec.max_positions ?? 1) > 1) {
    out.push("//");
    out.push(`// The spec trades ${symbolNote} as a portfolio. Pine runs on ONE chart`);
    out.push("// symbol at a time — add this script to each symbol's chart. Per-trade rules");
    out.push("// below are faithful; portfolio-level selection (max_positions, ranking)");
    out.push("// does not apply on a single chart.");
  }
  if (riskMode) {
    out.push("//");
    out.push("// TODO: the spec sizes positions by risk (risk_pct mode). Pine's built-in");
    out.push("// sizing is % of equity — adjust default_qty_value or compute qty manually.");
  }
  if (epf === "open") {
    out.push("//");
    out.push("// Fill note: the engine fills at the signal bar's open; TradingView enters");
    out.push("// at the next bar's open — the closest built-in equivalent.");
  }
  out.push(
    `strategy("${title}", overlay = true, initial_capital = 100000, ` +
      `default_qty_type = strategy.percent_of_equity, default_qty_value = ${fmtNum(qtyPct)}, ` +
      `pyramiding = 0, process_orders_on_close = ${onClose})`,
  );
  out.push("");

  if (ctx.usesZscore) {
    out.push("// Rolling z-score, matching the engine (rolling mean / stdev).");
    out.push("f_zscore(src, len) =>");
    out.push("    (src - ta.sma(src, len)) / ta.stdev(src, len)");
    out.push("");
  }
  if (ctx.usesDayOfWeek) {
    out.push("// Engine's day_of_week: Monday=0 … Sunday=6.");
    out.push("dayOfWeekMon0 = (dayofweek + 5) % 7");
    out.push("");
  }

  const indicatorLines: string[] = [];
  for (const e of externals) indicatorLines.push(...e.lines);
  for (const [name, { kind, length }] of ctx.auto) {
    indicatorLines.push(standardIndicatorLine(name, kind, "close", length, ctx));
  }
  for (const e of standards) indicatorLines.push(...e.lines);
  for (const e of customs) indicatorLines.push(...e.lines);
  if (indicatorLines.length) {
    out.push("// ── Indicators ──");
    out.push(...indicatorLines);
    out.push("");
  }

  out.push("// ── Rules ──");
  if (entryPine && entryRuleLong) {
    out.push(...todoLines("entry rule", entryRuleLong, entryTodos, ctx));
    out.push(`enterLong = ${entryPine}`);
  }
  if (shortPine && spec.entry_rule_short) {
    out.push(...todoLines("short entry rule", spec.entry_rule_short, shortTodos, ctx));
    out.push(`enterShort = ${shortPine}`);
  }
  if (exitPine && spec.exit_rule) {
    out.push(...todoLines("exit rule", spec.exit_rule, exitTodos, ctx));
    out.push(`exitSignal = ${exitPine}`);
  }
  out.push("");

  const captureStop = !!stopFieldName;
  if (captureStop) {
    out.push("// Stop distance is captured at entry, like the engine does.");
    out.push("var float stopDistance = na");
  }
  out.push("// ── Orders ──");
  if (entryPine) {
    out.push("if enterLong");
    out.push('    strategy.entry("Long", strategy.long)');
    if (captureStop) out.push(`    stopDistance := ${stopFieldName}`);
  }
  if (shortPine) {
    out.push("if enterShort");
    out.push('    strategy.entry("Short", strategy.short)');
    if (captureStop) out.push(`    stopDistance := ${stopFieldName}`);
  }
  if (exitPine) {
    out.push("if exitSignal");
    if (entryPine) out.push('    strategy.close("Long", comment = "Rule exit")');
    if (shortPine) out.push('    strategy.close("Short", comment = "Rule exit")');
  }

  const hasRiskExit = captureStop || stopPct > 0 || tpPct > 0;
  if (hasRiskExit) {
    const longArgs: string[] = [];
    const shortArgs: string[] = [];
    if (captureStop) {
      longArgs.push("stop = strategy.position_avg_price - stopDistance");
      shortArgs.push("stop = strategy.position_avg_price + stopDistance");
    } else if (stopPct > 0) {
      longArgs.push(`stop = strategy.position_avg_price * ${fmtNum(1 - stopPct / 100)}`);
      shortArgs.push(`stop = strategy.position_avg_price * ${fmtNum(1 + stopPct / 100)}`);
    }
    if (tpPct > 0) {
      longArgs.push(`limit = strategy.position_avg_price * ${fmtNum(1 + tpPct / 100)}`);
      shortArgs.push(`limit = strategy.position_avg_price * ${fmtNum(1 - tpPct / 100)}`);
    }
    out.push("");
    const parts: string[] = [];
    if (captureStop) parts.push("indicator-based stop");
    else if (stopPct > 0) parts.push(`${fmtNum(stopPct)}% stop`);
    if (tpPct > 0) parts.push(`${fmtNum(tpPct)}% target`);
    out.push(`// ── Risk exits: ${parts.join(" + ")} ──`);
    if (entryPine) {
      out.push("if strategy.position_size > 0");
      out.push(`    strategy.exit("Long risk", "Long", ${longArgs.join(", ")})`);
    }
    if (shortPine) {
      out.push("if strategy.position_size < 0");
      out.push(`    strategy.exit("Short risk", "Short", ${shortArgs.join(", ")})`);
    }
  }

  if (holdDays > 0) {
    out.push("");
    out.push(
      `// ── Time exit: close after ${holdDays} calendar day${holdDays === 1 ? "" : "s"}, like the engine ──`,
    );
    out.push(
      `if strategy.opentrades > 0 and time - strategy.opentrades.entry_time(strategy.opentrades - 1) >= ${holdDays} * 86400000`,
    );
    out.push('    strategy.close_all(comment = "Time exit")');
  }
  out.push("");

  return { code: out.join("\n"), warnings: ctx.warnings };
}
