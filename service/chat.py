"""Chat brain for the backtesting playground.

Ported from the desktop app's gui/chat_controller.py: the tolerant JSON
response parsing survives verbatim (it is pinned by tests), the prompt is
rebuilt for the SaaS contract.

The chat may ONLY: explain historical results, propose/apply strategy-spec
edits, explain trading concepts, and compare runs. It never predicts prices,
never recommends real-money trades, and never claims a strategy "will" make
money. Those rules live in the system prompt below AND are enforced
server-side by spec validation (ai.strategist.validate_spec).

Scratch mode (Phase D): when current_spec is null/empty the prompt switches
to a guided intake (market → timeframe → entry → exits/stops → sizing) that
builds the spec incrementally — every answer yields a full updated_spec draft
(unanswered parts filled with sensible defaults) so the UI can show a live
draft. All guardrails apply identically in both modes.

Response contract (strict JSON):
    {"reply": str, "updated_spec": object | null, "should_rerun": bool}
"""

import json
import logging
import os
import re
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_CHAT_MODEL = "claude-sonnet-4-6"
# Context cap — bounds our worst-case Anthropic cost per call. Only the most
# recent MAX_HISTORY_MESSAGES reach the model, each truncated to
# MAX_MESSAGE_CHARS characters. System prompt/spec are never truncated.
MAX_HISTORY_MESSAGES = 12
MAX_MESSAGE_CHARS = 2000

DISCLAIMER = (
    "Historical simulation for research and education. Not financial advice. "
    "Past performance does not predict future results."
)

# The real spec schema as implemented by backtest/rule_based_engine.py
# (RuleBasedStrategySpec) — a superset of the short form shown in CLAUDE.md.
SPEC_FORMAT_DOC = """## Strategy Spec Format
A strategy is a single JSON object:
- "name": string, "description": string (optional)
- "symbols": list of tickers, or ["ALL_US"] for the full US universe
- "indicators": list of {"name": "sma_20", "type": "sma", "source": "close", "length": 20}
  - types: sma, ema, rsi, zscore, atr, stddev, rolling_max, rolling_min, lag,
    vwap_proxy, custom (with "formula", e.g. "close / sma_100"),
    external (with "symbol" and "field" for cross-symbol references)
  - "source" may be any price/volume column or a reference column like "spy_close"
- "entry_rule_long" / "entry_rule_short": boolean expressions over columns,
  e.g. "close > sma_20 & rsi_14 > 55". Operators: & | ~ () + - * / comparison.
  Allowed functions: abs, min, max, lag, pct_change, sma, ema, rsi, zscore.
  "close[20]" is sugar for lag(close, 20). Cross-symbol columns like "spy_close"
  work when the symbol is loaded.
- "exit_rule": boolean expression; "position_side" is available and equals
  'LONG' or 'SHORT'.
- "entry_price_field": "open" | "high" | "low" | "close"
- "backtest_timeframe": "1d" | "60m" | "30m" | "15m" | "5m" | "1m". Intraday
  timeframes are limited to ~60 days of history — when the user asks for
  intraday, tell them to use a recent, short date range.
- Crypto works too: Polygon-style tickers like "X:BTCUSD", "X:ETHUSD"
  (daily bars; 24/7 markets).
- "position_size_mode": "notional_pct" | "risk_pct"
- "position_size_pct": 1-100 (percent of equity per position, notional mode)
- "risk_per_trade_pct": 0.05-10 (percent of equity risked, risk mode)
- "max_positions": 1-20
- "stop_loss_pct": 0-50 (0 = disabled)
- "take_profit_pct": 0-500 (0 or null = disabled)
- "max_holding_days": 0-365 (0 = disabled)
- "ranking_field": optional indicator name used to rank entry candidates
"""

SCRATCH_INTAKE_DOC = """## Guided Intake — scratch mode (no strategy loaded)
There is no strategy yet. Co-build one through a short guided intake, asking
ONE question per turn, in this order (skip anything already answered):
1. Market — US stocks/ETFs, or crypto (Polygon-style tickers like "X:BTCUSD")?
2. Timeframe — daily bars, or intraday (60m/30m/15m/5m/1m; remind them
   intraday history is capped at ~60 days, so use a recent short range)?
3. Entry idea — what signal gets them into a position?
4. Exits and stops — what gets them out, and where does the stop-loss sit?
5. Sizing — percent of equity per position (or risk % per trade), and how
   many positions at once.
After EVERY user answer, return the FULL draft in "updated_spec" so the UI can
show a live draft: capture what they just said, and fill every still-unanswered
part with a sensible, clearly-provisional default (e.g. symbols ["SPY"],
backtest_timeframe "1d", a simple placeholder entry like "close > sma_50" with
its indicator defined, exit "close < sma_50", notional 10% sizing,
max_positions 5, stop_loss_pct 8) so the draft is always a complete, valid
spec. In "reply", say which parts are placeholder defaults you'll refine as
they answer. Keep "should_rerun" false during the intake; set it true only
once the user confirms the strategy is ready to test (or asks to run it)."""

FAILURE_PATTERNS_DOC = """## Known Failure Patterns — flag them proactively
Whenever you create/edit a spec or summarize results, scan for these and add a
short warning to your reply — one or two sentences each, teaching voice
(explain WHY it misleads). Warn and continue; never block or refuse the edit:
- Look-ahead bias: rules that peek at data the trade couldn't have known yet —
  e.g. entering at the open using the SAME bar's close, or an indicator built
  from the current bar's high/low deciding that same bar's entry.
- Overtight stops: a stop far smaller than the timeframe's typical bar-to-bar
  swing (say a 1% stop on a volatile daily-bar ticker) mostly buys noise
  exits, not protection.
- Unrealistic sizing: near-100% notional in one position, a large
  risk_per_trade_pct, or max_positions × position_size_pct far beyond 100% of
  equity (implicit leverage).
- Survivorship bias: hand-picking symbols that are famous winners TODAY bakes
  tomorrow's knowledge into yesterday's universe — historical results on them
  flatter the strategy.
- Too few trades: when a run shows fewer than ~30 total trades (see the
  results above), say so — the stats are anecdotes, not evidence, at that
  sample size."""


def build_system_prompt(
    current_spec: Optional[dict],
    last_run_stats: Optional[dict],
    bt_summary: str,
) -> str:
    """Build the system prompt giving Claude full context on spec + results.

    current_spec None/empty = scratch mode: the prompt swaps in the guided
    intake so the model co-builds a spec incrementally from a blank slate.
    """
    is_scratch = not current_spec or not isinstance(current_spec, dict)
    spec_text = (
        "No strategy loaded yet — scratch mode; run the Guided Intake below."
        if is_scratch
        else json.dumps(current_spec, indent=2, sort_keys=True)
    )
    results_text = format_results_block(last_run_stats)
    intake_block = f"\n{SCRATCH_INTAKE_DOC}\n" if is_scratch else ""

    return f"""You are the strategy assistant inside a historical backtesting playground — a research and education tool. Users describe changes to a trading strategy in plain English; you edit the strategy spec JSON and explain historical simulation results.

{SPEC_FORMAT_DOC}

## Current Strategy Spec
```json
{spec_text}
```
{intake_block}
## Backtest Setup
{bt_summary}
{results_text}

{FAILURE_PATTERNS_DOC}

## Hard Rules — never break these
1. You may ONLY: explain historical results, propose/apply spec edits, explain
   trading concepts in plain English, and compare runs.
2. You may NOT predict future prices, recommend buying/selling any real
   security with real money, or claim a strategy "will" make money. Historical
   performance is simulation, not a forecast. If asked for a prediction or a
   real-money recommendation, refuse briefly and offer a historical test
   instead ("I can't predict prices, but we can test how that idea would have
   performed historically.").
3. Keep every numeric field inside its documented bounds. Symbols must be
   plausible tickers or ["ALL_US"].
4. When the user is vague ("make it better"), propose ONE concrete change with
   reasoning — not a rewrite.
5. Be specific: say "tighten the stop from 8% to 5%" not "tighten the stop".
6. Teach as you work: when you edit the spec, include one plain-English sentence
   on what the change means in trading terms (this is an educational tool;
   explain jargon whenever it appears).
7. When switching to an intraday timeframe, also shrink the date range to at
   most 60 days and say why.

## Response Format — strict JSON, nothing else
Respond with ONE JSON object and no other text:
{{
  "reply": "Your conversational reply to the user (markdown allowed).",
  "updated_spec": <the COMPLETE updated spec JSON if you are changing the strategy, else null>,
  "should_rerun": <true if updated_spec is present and the backtest should re-run>
}}
- "updated_spec" must be the FULL spec (all fields), not a diff.
- If you are only answering a question, use "updated_spec": null and "should_rerun": false.
- Do not wrap the JSON in markdown fences."""


def format_results_block(results: Optional[dict]) -> str:
    """Format the last run's stats for the system prompt.

    Tolerant of missing keys AND null values: the serializer scrubs inf/NaN to
    None (e.g. profit_factor on a run with zero losing trades), and
    ``dict.get(key, 0)`` does NOT apply the default when the key exists as None.
    """
    if not results or "error" in results:
        return ""

    def g(key: str, default: float = 0.0) -> float:
        value = results.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
        return default

    pf = results.get("profit_factor")
    pf_text = "inf (no losing trades)" if pf is None and "profit_factor" in results else f"{g('profit_factor'):.2f}"

    text = f"""
## Most Recent Backtest Results
- Total Return: {g('total_return_pct'):.1f}%
- CAGR: {g('cagr'):.2f}%
- Max Drawdown: {g('max_drawdown'):.1f}%
- Sharpe: {g('sharpe'):.2f}
- Sortino: {g('sortino'):.2f}
- Calmar: {g('calmar'):.2f}
- Total Trades: {int(g('total_trades'))}
- Win Rate: {g('win_rate'):.1f}%
- Avg Win (R): {g('avg_win_r'):+.2f}
- Avg Loss (R): {g('avg_loss_r'):+.2f}
- Profit Factor: {pf_text}
- Expectancy (R): {g('expectancy_r'):+.3f}
- Max Consec Losses: {int(g('max_consec_losses'))}
- Avg Holding Days: {g('avg_holding_days'):.1f}
"""
    for reason, stats in (results.get("exit_stats") or {}).items():
        if not isinstance(stats, dict):
            continue

        def s(key: str) -> float:
            value = stats.get(key)
            return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.0

        text += (
            f"\n### Exit: {reason}\n"
            f"  Count: {int(s('count'))}, Total R: {s('total_r'):+.2f}, "
            f"Total PnL: ${s('total_pnl'):,.2f}\n"
        )
    return text


def build_bt_summary(
    start_date: str,
    end_date: str,
    starting_capital: float,
    benchmark: str,
    slippage_pct: float,
    spec: Optional[dict] = None,
    auto_universe_max_symbols: int = 0,
) -> str:
    """Build the backtest-setup summary string (ported from the old GUI)."""
    strategy_name = "rule_based"
    intraday_text = ""
    universe_text = ""
    if isinstance(spec, dict):
        strategy_name = spec.get("name", strategy_name)
        timeframe = (spec.get("backtest_timeframe") or "1d").strip()
        if timeframe and timeframe != "1d":
            intraday_text = f", timeframe={timeframe}"
        symbols = [str(s).strip().upper() for s in spec.get("symbols", [])]
        if any(s in {"ALL_US", "*", "ALL", "ALL_US_SYMBOLS"} for s in symbols):
            limit_text = (
                "all symbols"
                if auto_universe_max_symbols <= 0
                else f"{auto_universe_max_symbols} symbols"
            )
            universe_text = f", universe=auto US ({limit_text})"
    symbols_text = f"Strategy '{strategy_name}'{intraday_text}{universe_text}"
    return (
        f"Date range: {start_date} to {end_date}\n"
        f"Starting capital: ${starting_capital:,.0f}\n"
        f"Universe: {symbols_text}\n"
        f"Benchmark: {benchmark}\n"
        f"Slippage: {slippage_pct}%"
    )


def cap_history(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Apply the chat context cap: last MAX_HISTORY_MESSAGES messages, each
    truncated to MAX_MESSAGE_CHARS. The /chat endpoint estimates tokens (and
    charges credits) over exactly this capped list, so what's billed is what's
    sent."""
    return [
        {**m, "content": str(m.get("content", ""))[:MAX_MESSAGE_CHARS]}
        for m in messages[-MAX_HISTORY_MESSAGES:]
    ]


def call_claude(
    messages: List[Dict[str, str]],
    system_prompt: str,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    max_tokens: int = 2048,
) -> str:
    """Synchronous Anthropic call. Raises on API errors; caller handles them."""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model=model or os.environ.get("CHAT_MODEL", DEFAULT_CHAT_MODEL),
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages[-MAX_HISTORY_MESSAGES:],
    )
    text_parts = [block.text for block in response.content if hasattr(block, "text")]
    if not text_parts:
        raise RuntimeError(f"Empty model response (stop_reason={response.stop_reason})")
    return "".join(text_parts)


def parse_chat_response(response_text: str) -> Dict[str, object]:
    """Parse the strict {reply, updated_spec, should_rerun} contract.

    Falls back through fenced/inline JSON and the legacy proposed_changes /
    strategy_spec shapes so a slightly-off model reply still degrades
    gracefully to plain text instead of an error.
    """
    candidates = []
    stripped = response_text.strip()
    if stripped.startswith("{"):
        try:
            candidates.append(json.loads(stripped))
        except json.JSONDecodeError:
            pass
    candidates.extend(
        obj for obj in _parse_all_fenced(response_text) if isinstance(obj, dict)
    )
    for obj in _iter_json_objects(response_text):
        if isinstance(obj, dict):
            candidates.append(obj)

    for obj in candidates:
        if "reply" in obj:
            spec = obj.get("updated_spec")
            spec = spec if isinstance(spec, dict) else None
            return {
                "reply": str(obj.get("reply", "")),
                "updated_spec": spec,
                "should_rerun": bool(obj.get("should_rerun")) and spec is not None,
            }

    # Legacy shape fallback: {"proposed_changes": ..., "strategy_spec": ...}
    spec = parse_proposed_strategy_spec(response_text)
    return {
        "reply": strip_json_block(response_text) or response_text.strip(),
        "updated_spec": spec,
        "should_rerun": spec is not None,
    }


def _parse_all_fenced(response_text: str):
    for block in _extract_fenced_json_blocks(response_text):
        try:
            yield json.loads(block)
        except json.JSONDecodeError:
            continue


# ── Legacy parsing stack — ported verbatim from gui/chat_controller.py ────────
# Pinned by tests/test_chat_controller_parsing.py. Keep tolerant: fenced JSON
# first, then inline JSON objects scanned out of free text.


def parse_proposed_changes(response_text: str) -> Optional[Dict[str, object]]:
    """Extract the proposed_changes JSON from Claude's response text."""
    payload = _extract_payload(response_text)
    if payload and "proposed_changes" in payload and isinstance(payload["proposed_changes"], dict):
        return payload["proposed_changes"]

    # Backward-compatible fallback
    # Try fenced code block first
    pattern = r"```json\s*(\{.*?\})\s*```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            if "proposed_changes" in data and isinstance(data["proposed_changes"], dict):
                return data["proposed_changes"]
        except json.JSONDecodeError:
            pass

    # Fallback: look for inline JSON
    pattern2 = r'\{"proposed_changes"\s*:\s*\{[^}]+\}\s*\}'
    match2 = re.search(pattern2, response_text)
    if match2:
        try:
            data = json.loads(match2.group())
            if "proposed_changes" in data:
                return data["proposed_changes"]
        except json.JSONDecodeError:
            pass

    return None


def parse_proposed_strategy_spec(response_text: str) -> Optional[Dict[str, object]]:
    """Extract optional strategy_spec JSON from Claude response."""
    payload = _extract_payload(response_text)
    if payload:
        if isinstance(payload.get("strategy_spec"), dict):
            return payload["strategy_spec"]
        if _looks_like_strategy_spec(payload):
            return payload
    for obj in _iter_json_objects(response_text):
        if isinstance(obj, dict) and _looks_like_strategy_spec(obj):
            return obj
    return None


def _extract_payload(response_text: str) -> Optional[Dict[str, object]]:
    """Extract top-level JSON payload from Claude response text."""
    # Prefer fenced JSON blocks when present.
    for block in _extract_fenced_json_blocks(response_text):
        try:
            data = json.loads(block)
            if isinstance(data, dict) and (
                "proposed_changes" in data or "strategy_spec" in data
            ):
                return data
        except json.JSONDecodeError:
            continue
    # Fallback: scan for inline JSON objects in free text.
    for obj in _iter_json_objects(response_text):
        if isinstance(obj, dict) and ("proposed_changes" in obj or "strategy_spec" in obj):
            return obj
    return None


def strip_json_block(response_text: str) -> str:
    """Remove the JSON code block from display text."""
    cleaned = re.sub(r"```json\s*\{.*?\}\s*```", "", response_text, flags=re.DOTALL)
    return cleaned.strip()


def _extract_fenced_json_blocks(response_text: str) -> List[str]:
    pattern = r"```json\s*(\{.*?\})\s*```"
    return [m.group(1) for m in re.finditer(pattern, response_text, re.DOTALL)]


def _iter_json_objects(text: str):
    decoder = json.JSONDecoder()
    index = 0
    while True:
        brace = text.find("{", index)
        if brace < 0:
            break
        try:
            obj, offset = decoder.raw_decode(text[brace:])
            yield obj
            index = brace + max(offset, 1)
        except json.JSONDecodeError:
            index = brace + 1


def _looks_like_strategy_spec(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    if "symbols" not in value:
        return False
    has_entry = any(k in value for k in ("entry_rule", "entry_rule_long", "entry_rule_short"))
    has_exit = "exit_rule" in value
    return has_entry and has_exit
