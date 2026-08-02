"""Minimal engine configuration.

The legacy desktop app's Config carried 16 sections; the backtest engine never
read any of them — only the data-source settings survive. Everything is overridable by env vars, and
load_config degrades to pure defaults when the YAML file is absent.
"""

import os
from dataclasses import dataclass, field

import yaml


@dataclass
class DataConfig:
    # Data source for backtesting imports:
    # auto = yfinance for daily/weekly/monthly and polygon for long-range intraday when key exists
    # yfinance = force yfinance only
    # polygon = force polygon for supported timeframes
    backtest_data_source: str = "auto"  # auto | yfinance | polygon
    polygon_api_key: str = ""
    default_history_years: int = 20


@dataclass
class Config:
    data: DataConfig = field(default_factory=DataConfig)


def _merge_dict(target, source):
    """Recursively merge source dict into target dataclass fields."""
    for key, value in source.items():
        if hasattr(target, key):
            attr = getattr(target, key)
            if hasattr(attr, '__dataclass_fields__') and isinstance(value, dict):
                _merge_dict(attr, value)
            else:
                setattr(target, key, value)


def load_config(path: str = "config.yaml") -> Config:
    """Load config from YAML file, falling back to defaults for missing values."""
    config = Config()
    if os.path.exists(path):
        with open(path, 'r') as f:
            raw = yaml.safe_load(f) or {}
        _merge_dict(config, raw)
    if not config.data.polygon_api_key:
        config.data.polygon_api_key = os.environ.get("POLYGON_API_KEY", "")
    return config


def save_config(config: Config, path: str = "config.yaml"):
    """Save current config to YAML."""
    import dataclasses

    with open(path, 'w') as f:
        yaml.dump(dataclasses.asdict(config), f, default_flow_style=False, sort_keys=False)
