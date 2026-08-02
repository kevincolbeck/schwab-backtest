"""Strategy-spec guardrails and analysis prompt helpers.

Formerly the live bot's AIStrategist class (scheduled Claude calls that
auto-applied spec changes to a live trading loop). The live couplings — DB
logging, engine hooks, disk spec writes, auto-apply — are gone. What remains
is the stateless, reusable core the chat service builds on:

- PARAM_BOUNDS / validate_spec / clamp_spec: server-side guardrails for
  Claude-proposed spec edits (bounds target the REAL engine schema in
  backtest/rule_based_engine.py, which is a superset of the short doc form).
- apply_spec_changes / ensure_indicators: safe merge of edits into a spec.
- parse_json_response: tolerant JSON extraction from a model reply.
- build_analysis_prompt: formats ai.analyzer output for analysis prompts.
"""

import copy
import json
import logging
import re
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Numeric guardrails for spec fields (lo, hi). Values outside are clamped.
# 0 means "disabled" for stop_loss_pct / take_profit_pct / max_holding_days.
PARAM_BOUNDS = {
    "position_size_pct": (1.0, 100.0),
    "risk_per_trade_pct": (0.05, 10.0),
    "max_positions": (1, 20),
    "max_holding_days": (0, 365),
    "stop_loss_pct": (0.0, 50.0),
    "take_profit_pct": (0.0, 500.0),
}

# Fields a chat edit may touch. Anything else is dropped with a warning.
TUNABLE_PARAMS = [
    "name", "description", "symbols", "indicators",
    "entry_rule", "entry_rule_long", "entry_rule_short", "exit_rule",
    "entry_price_field", "backtest_timeframe", "ranking_field",
    "position_size_mode", "position_size_pct", "risk_per_trade_pct",
    "max_positions", "max_holding_days", "stop_loss_pct", "take_profit_pct",
]

ALL_US_TOKENS = {"ALL_US", "*", "ALL", "ALL_US_SYMBOLS"}
ALLOWED_TIMEFRAMES = {"1d", "5m", "15m", "30m", "60m"}
ALLOWED_ENTRY_PRICE_FIELDS = {"open", "high", "low", "close"}
ALLOWED_SIZE_MODES = {"notional_pct", "risk_pct"}
ALLOWED_INDICATOR_TYPES = {
    "sma", "ema", "rsi", "zscore", "atr", "stddev",
    "rolling_max", "max", "rolling_min", "min", "lag",
    "vwap", "vwap_proxy", "custom", "external",
}

# Substring denylist for rule expressions (the engine evals them with empty
# builtins and its own token denylist; this is the first line of defense).
DANGEROUS_RULE_TOKENS = ("import", "exec", "eval", "open", "os.", "subprocess", "__")

_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
_AUTO_INDICATOR_RE = re.compile(r"((?:rsi|sma|ema|zscore|atr|stddev)_\d+)")


def validate_spec(spec: dict) -> List[str]:
    """Validate a full strategy spec. Returns a list of error strings (empty = valid).

    Errors are written to be fed back to the chat model for self-correction.
    """
    errors: List[str] = []
    if not isinstance(spec, dict):
        return ["spec must be a JSON object"]

    symbols = spec.get("symbols")
    if not isinstance(symbols, list) or not symbols:
        errors.append("symbols must be a non-empty list of tickers or [\"ALL_US\"]")
    else:
        for sym in symbols:
            if not isinstance(sym, str):
                errors.append(f"symbol {sym!r} is not a string")
                continue
            s = sym.strip().upper()
            if s not in ALL_US_TOKENS and not _TICKER_RE.match(s):
                errors.append(f"symbol {sym!r} does not look like a valid ticker")

    has_entry = any(
        isinstance(spec.get(k), str) and spec.get(k).strip()
        for k in ("entry_rule", "entry_rule_long", "entry_rule_short")
    )
    if not has_entry:
        errors.append("spec needs a non-empty entry_rule_long (or entry_rule / entry_rule_short)")

    for rule_field in ("entry_rule", "entry_rule_long", "entry_rule_short", "exit_rule"):
        rule = spec.get(rule_field)
        if rule is None or rule == "":
            continue
        if not isinstance(rule, str):
            errors.append(f"{rule_field} must be a string expression")
            continue
        lowered = rule.lower()
        for token in DANGEROUS_RULE_TOKENS:
            if token in lowered:
                errors.append(f"{rule_field} contains disallowed token {token!r}")
                break

    for param, (lo, hi) in PARAM_BOUNDS.items():
        value = spec.get(param)
        if value is None:
            continue
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            errors.append(f"{param} must be a number")
        elif not (lo <= value <= hi):
            errors.append(f"{param}={value} is outside allowed range [{lo}, {hi}]")

    tf = spec.get("backtest_timeframe")
    if tf is not None and tf not in ALLOWED_TIMEFRAMES:
        errors.append(f"backtest_timeframe must be one of {sorted(ALLOWED_TIMEFRAMES)}")

    epf = spec.get("entry_price_field")
    if epf is not None and epf not in ALLOWED_ENTRY_PRICE_FIELDS:
        errors.append(f"entry_price_field must be one of {sorted(ALLOWED_ENTRY_PRICE_FIELDS)}")

    mode = spec.get("position_size_mode")
    if mode is not None and mode not in ALLOWED_SIZE_MODES:
        errors.append(f"position_size_mode must be one of {sorted(ALLOWED_SIZE_MODES)}")

    indicators = spec.get("indicators")
    if indicators is not None:
        if not isinstance(indicators, list):
            errors.append("indicators must be a list")
        else:
            for ind in indicators:
                if not isinstance(ind, dict):
                    errors.append(f"indicator {ind!r} must be an object")
                    continue
                ind_type = ind.get("type")
                if ind_type not in ALLOWED_INDICATOR_TYPES:
                    errors.append(
                        f"indicator type {ind_type!r} not supported "
                        f"(allowed: {sorted(ALLOWED_INDICATOR_TYPES)})"
                    )
                if ind_type == "custom" and not ind.get("formula"):
                    errors.append(f"custom indicator {ind.get('name')!r} needs a formula")
                if ind_type == "external" and not ind.get("symbol"):
                    errors.append(f"external indicator {ind.get('name')!r} needs a symbol")

    return errors


def clamp_spec(spec: dict) -> dict:
    """Return a copy with numeric fields clamped into PARAM_BOUNDS."""
    clamped = copy.deepcopy(spec)
    for param, (lo, hi) in PARAM_BOUNDS.items():
        value = clamped.get(param)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            clamped[param] = max(lo, min(hi, value))
    return clamped


def apply_spec_changes(spec: dict, changes: Dict[str, object]) -> dict:
    """Apply per-field changes to a deep copy of the spec.

    Unknown fields are dropped with a warning; rule edits auto-register any
    simple indicators they reference.
    """
    new_spec = copy.deepcopy(spec)
    for param, value in changes.items():
        if param not in TUNABLE_PARAMS:
            logger.warning("Ignoring non-tunable spec field: %s", param)
            continue
        new_spec[param] = value
        if param in ("entry_rule", "entry_rule_long", "entry_rule_short", "exit_rule"):
            if isinstance(value, str):
                ensure_indicators(new_spec, value)
    return new_spec


def ensure_indicators(spec: dict, rule: str) -> None:
    """Ensure simple indicators referenced in a rule exist in the spec.

    Handles name_length references (rsi_14, sma_50, ema_20, zscore_10, atr_14,
    stddev_20). Custom/external indicators must be declared explicitly.
    """
    refs = set(_AUTO_INDICATOR_RE.findall(rule))
    spec.setdefault("indicators", [])
    existing_names = {ind.get("name", "") for ind in spec["indicators"] if isinstance(ind, dict)}
    for ref in sorted(refs):
        if ref in existing_names:
            continue
        ind_type, length = ref.rsplit("_", 1)
        spec["indicators"].append({
            "type": ind_type,
            "length": int(length),
            "source": "close",
            "name": ref,
        })
        logger.info("Auto-added indicator %s", ref)


def parse_json_response(text: str) -> Optional[dict]:
    """Tolerant JSON extraction: strip fences, then whole-text, then substring."""
    text = text.strip()
    if text.startswith("```"):
        lines = [l for l in text.split("\n") if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
        logger.warning("Could not parse JSON from model response")
        return None


def build_analysis_prompt(data: dict, analysis_type: str = "RUN_REVIEW") -> str:
    """Format ai.analyzer.build_ai_prompt_data output into an analysis prompt."""
    parts = [f"ANALYSIS TYPE: {analysis_type}\n"]

    m = data.get("performance_metrics", {})
    if m:
        parts.append("CURRENT PERFORMANCE METRICS:")
        parts.append(f"  Total Trades: {m.get('total_trades', 0)}")
        parts.append(f"  Win Rate: {m.get('win_rate', 0):.1%}")
        parts.append(f"  Total P&L: ${m.get('total_pnl', 0):,.2f}")
        parts.append(f"  Sharpe Ratio: {m.get('sharpe', 0):.2f}")
        parts.append(f"  Sortino Ratio: {m.get('sortino', 0):.2f}")
        parts.append(f"  Profit Factor: {m.get('profit_factor', 0):.2f}")
        parts.append(f"  Max Drawdown: ${m.get('max_drawdown', 0):,.2f}")
        parts.append(f"  Avg Win: ${m.get('avg_win', 0):,.2f}")
        parts.append(f"  Avg Loss: ${m.get('avg_loss', 0):,.2f}")
        parts.append(f"  Avg R-Multiple: {m.get('avg_r', 0):+.2f}")
        parts.append("")

    ta = data.get("trade_analysis", {})
    if ta.get("observations"):
        parts.append("KEY OBSERVATIONS:")
        for obs in ta["observations"]:
            parts.append(f"  - {obs}")
        parts.append("")

    if ta.get("by_symbol"):
        parts.append("PERFORMANCE BY SYMBOL:")
        for sym, info in ta["by_symbol"].items():
            parts.append(
                f"  {sym}: {info['trades']} trades, "
                f"WR={info['win_rate']:.0%}, P&L=${info['pnl']:+,.2f}"
            )
        parts.append("")

    if ta.get("by_exit_reason"):
        parts.append("PERFORMANCE BY EXIT REASON:")
        for reason, info in ta["by_exit_reason"].items():
            parts.append(f"  {reason}: {info['trades']} trades, P&L=${info['pnl']:+,.2f}")
        parts.append("")

    if ta.get("hold_time"):
        ht = ta["hold_time"]
        parts.append(
            f"HOLD TIME: Winners avg {ht['avg_winner_hours']:.1f}h, "
            f"Losers avg {ht['avg_loser_hours']:.1f}h"
        )
        parts.append("")

    strat = data.get("current_strategy", {})
    if strat:
        parts.append("CURRENT STRATEGY SPEC:")
        parts.append(f"  Entry Rule: {strat.get('entry_rule_long', '')}")
        parts.append(f"  Exit Rule: {strat.get('exit_rule', '')}")
        parts.append(f"  Position Size: {strat.get('position_size_pct', 0)}%")
        parts.append(f"  Max Positions: {strat.get('max_positions', 0)}")
        parts.append(f"  Max Hold Days: {strat.get('max_holding_days', 0)}")
        parts.append(f"  Stop Loss: {strat.get('stop_loss_pct', 0)}%")
        parts.append(
            f"  Symbols ({len(strat.get('symbols', []))}): {', '.join(strat.get('symbols', []))}"
        )
        parts.append("")

    parts.append(
        "Analyze this historical simulation and explain what drove the results. "
        "This is research over past data — do not predict future performance."
    )
    return "\n".join(parts)
