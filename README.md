# Chat-to-Backtest

An AI-powered backtesting playground: pick a template trading strategy, see ~10 years of
historical results in seconds, then modify the strategy in plain English through chat and
instantly re-run. Every run is saved, reproducible, and shareable.

**This is a research and education tool.** No live trading, no order execution, no broker
connections, no signals, no recommendations. Historical simulation for research and
education. Not financial advice. Past performance does not predict future results.

See [CLAUDE.md](CLAUDE.md) for the full product plan and build phases.

## Layout

```
backtest/        Backtest engine: rule-based simulation, portfolio, statistics, data provider
strategy/        Indicator library + computed momentum scanners (template building blocks)
ai/              Spec guardrails (validation/bounds) + trade analysis helpers
data/            US market universe provider
service/         Chat brain + run snapshots (FastAPI service lands here)
tests/           pytest suite
web/             Next.js frontend
strategy_specs/  Example strategy spec JSONs
```

## Quick start

```bash
pip install -r requirements.txt
pytest                                      # run the test suite
python run_backtest_cli.py                  # backtest the default spec
python run_backtest_cli.py strategy_specs/smoke_strategy.json 2016-01-01 2026-01-01
```

OHLCV data comes from yfinance (dev) or Polygon (set `POLYGON_API_KEY`), cached in a local
SQLite database (`backtest_data.db`). Warm the cache with `python import_market_data.py`.

## Strategy spec format

A strategy is a single JSON object; the engine evaluates entry/exit rule expressions over
per-symbol OHLCV frames with computed indicator columns:

```json
{
  "name": "Golden Cross",
  "symbols": ["SPY", "QQQ", "AAPL"],
  "indicators": [
    {"name": "sma_50", "type": "sma", "source": "close", "length": 50},
    {"name": "sma_200", "type": "sma", "source": "close", "length": 200}
  ],
  "entry_rule_long": "sma_50 > sma_200",
  "exit_rule": "sma_50 < sma_200",
  "entry_price_field": "open",
  "backtest_timeframe": "1d",
  "position_size_mode": "notional_pct",
  "position_size_pct": 25,
  "max_positions": 4,
  "stop_loss_pct": 8,
  "take_profit_pct": 0,
  "max_holding_days": 0
}
```

Notes:
- `symbols: ["ALL_US"]` runs across the full US equity universe (currently listed symbols —
  results may be optimistic due to survivorship bias).
- Indicator types: `sma`, `ema`, `rsi`, `zscore`, `atr`, `stddev`, `rolling_max`,
  `rolling_min`, `lag`, `vwap_proxy`, `custom` (arbitrary formula), `external`
  (cross-symbol reference).
- Rules support `& | ~ ()`, comparisons, arithmetic, and the functions `abs`, `min`, `max`,
  `lag`, `pct_change`, `sma`, `ema`, `rsi`, `zscore`. `close[20]` is sugar for
  `lag(close, 20)`. Cross-symbol columns like `spy_close` are available when loaded.
- `0` disables `stop_loss_pct` / `take_profit_pct` / `max_holding_days`.
- `entry_rule` is a legacy alias for `entry_rule_long`; `entry_rule_short` and
  `ranking_field` (entry-candidate ranking) are supported.

## Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Chat brain (Claude) |
| `CHAT_MODEL` | Override chat model (default `claude-sonnet-4-6`) |
| `POLYGON_API_KEY` | Production OHLCV data source |
