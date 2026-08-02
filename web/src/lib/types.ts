export interface Indicator {
  name?: string;
  type: string;
  source?: string;
  length?: number;
  formula?: string;
  symbol?: string;
  field?: string;
}

export interface Spec {
  name: string;
  description?: string;
  symbols: string[];
  indicators?: Indicator[];
  entry_rule?: string;
  entry_rule_long?: string;
  entry_rule_short?: string;
  exit_rule?: string;
  entry_price_field?: string;
  backtest_timeframe?: string;
  position_size_mode?: string;
  position_size_pct?: number;
  risk_per_trade_pct?: number;
  max_positions?: number;
  stop_loss_pct?: number;
  stop_loss_field?: string;
  take_profit_pct?: number | null;
  max_holding_days?: number;
  ranking_field?: string;
  [key: string]: unknown;
}

export interface Stats {
  starting_capital?: number | null;
  final_equity?: number | null;
  total_return_pct?: number | null;
  cagr?: number | null;
  max_drawdown?: number | null;
  sharpe?: number | null;
  sortino?: number | null;
  calmar?: number | null;
  total_trades?: number | null;
  win_rate?: number | null;
  avg_win_r?: number | null;
  avg_loss_r?: number | null;
  avg_r?: number | null;
  profit_factor?: number | null;
  expectancy_r?: number | null;
  avg_holding_days?: number | null;
  [key: string]: unknown;
}

export interface EquityPoint {
  date: string;
  equity: number | null;
  drawdown_pct: number | null;
}

export interface Trade {
  symbol: string;
  side: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  shares: number;
  pnl_dollars: number;
  pnl_r: number;
  exit_reason: string;
  [key: string]: unknown;
}

export interface RunResult {
  run_id: string | null;
  parent_run_id?: string | null;
  elapsed_seconds?: number;
  spec: Spec;
  params?: Record<string, unknown>;
  stats: Stats;
  equity_curve: EquityPoint[];
  trades: Trade[];
  disclaimer?: string;
}

export interface TemplateMeta {
  display_name: string;
  category: string;
  difficulty: string;
  one_liner: string;
  explainer_md: string;
}

export interface CachedTemplateStats {
  stats: Record<string, number | null>;
  start_date: string;
  end_date: string;
  elapsed_seconds?: number;
}

export interface Template {
  id: string;
  meta: TemplateMeta;
  spec: Spec;
  cached_stats?: CachedTemplateStats | null;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  updated_spec: Spec | null;
  should_rerun: boolean;
  validation_errors: string[];
}

export interface SpecChange {
  field: string;
  from: string;
  to: string;
}
