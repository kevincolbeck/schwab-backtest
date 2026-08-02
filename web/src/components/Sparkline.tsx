/** Tiny server-renderable equity sparkline (pure SVG, no chart lib). */
export default function Sparkline({
  values,
  width = 120,
  height = 28,
  baseline,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** Reference value (starting capital): above = gain color, below = loss. */
  baseline?: number;
}) {
  if (!values || values.length < 2) {
    return <span className="text-[10px] text-muted">—</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1];
  const ref = baseline ?? values[0];
  const stroke = last >= ref ? "#089981" : "#f23645";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Equity trend, ${last >= ref ? "up" : "down"} overall`}
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}
