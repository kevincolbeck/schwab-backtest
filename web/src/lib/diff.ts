import type { Spec, SpecChange } from "./types";

const SCALAR_FIELDS: Array<keyof Spec> = [
  "name", "entry_rule", "entry_rule_long", "entry_rule_short", "exit_rule",
  "entry_price_field", "backtest_timeframe", "position_size_mode",
  "position_size_pct", "risk_per_trade_pct", "max_positions",
  "stop_loss_pct", "stop_loss_field", "take_profit_pct", "max_holding_days",
  "ranking_field",
];

const PCT_FIELDS = new Set([
  "position_size_pct", "risk_per_trade_pct", "stop_loss_pct", "take_profit_pct",
]);

function show(field: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (PCT_FIELDS.has(field)) return `${value}%`;
  return String(value);
}

/** Human-readable field-level changes between two specs ("stop_loss 8% → 5%"). */
export function diffSpecs(prev: Spec, next: Spec): SpecChange[] {
  const changes: SpecChange[] = [];
  for (const field of SCALAR_FIELDS) {
    const a = prev[field];
    const b = next[field];
    const aEmpty = a === undefined || a === null || a === "";
    const bEmpty = b === undefined || b === null || b === "";
    if (aEmpty && bEmpty) continue;
    if (String(a) !== String(b)) {
      changes.push({
        field: String(field).replace(/_/g, " "),
        from: show(String(field), a),
        to: show(String(field), b),
      });
    }
  }
  const prevSymbols = (prev.symbols ?? []).join(", ");
  const nextSymbols = (next.symbols ?? []).join(", ");
  if (prevSymbols !== nextSymbols) {
    changes.push({ field: "symbols", from: prevSymbols || "—", to: nextSymbols || "—" });
  }
  const prevInd = JSON.stringify(prev.indicators ?? []);
  const nextInd = JSON.stringify(next.indicators ?? []);
  if (prevInd !== nextInd) {
    changes.push({
      field: "indicators",
      from: `${(prev.indicators ?? []).length} defined`,
      to: `${(next.indicators ?? []).length} defined`,
    });
  }
  return changes;
}
