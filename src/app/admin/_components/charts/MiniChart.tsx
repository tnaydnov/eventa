'use client';

/**
 * MiniChart - Lightweight SVG line chart with gradient fill.
 * Used for usage timeline display. No external chart library needed.
 */

interface DataPoint {
  label: string;
  value: number;
}

interface MiniChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showArea?: boolean;
}

export default function MiniChart({
  data,
  height = 120,
  color = 'var(--admin-accent)',
  showArea = true,
}: MiniChartProps) {
  if (data.length < 2) {
    return (
      <div className="chart-empty">
        <span className="chart-empty__text">אין מספיק נתונים לגרף</span>
      </div>
    );
  }

  const W = 600;
  const H = height;
  const PAD_X = 40;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 24;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const stepX = chartW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_TOP + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${points[0].x},${PAD_TOP + chartH} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},${PAD_TOP + chartH} Z`;

  // Y-axis labels (max 4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    y: PAD_TOP + chartH - pct * chartH,
    label: Math.round(pct * maxVal).toString(),
  }));

  // X-axis labels - show every Nth to avoid crowding
  const xStep = Math.max(1, Math.floor(data.length / 6));

  const gradientId = `chart-grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart-svg"
      preserveAspectRatio="none"
      role="img"
      aria-label="גרף נתונים"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_X} y1={t.y} x2={W - PAD_X} y2={t.y}
            stroke="var(--admin-border)" strokeWidth="0.5" strokeDasharray="4,4"
          />
          <text x={PAD_X - 6} y={t.y + 4} textAnchor="end" fill="var(--admin-text-muted)" fontSize="10">
            {t.label}
          </text>
        </g>
      ))}

      {/* Area fill */}
      {showArea && (
        <path d={areaPath} fill={`url(#${gradientId})`} />
      )}

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="chart-line"
      />

      {/* Dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill={color}
          className="chart-dot"
        >
          <title>{p.label}: {p.value}</title>
        </circle>
      ))}

      {/* X-axis labels */}
      {points.filter((_, i) => i % xStep === 0 || i === points.length - 1).map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={H - 4}
          textAnchor="middle"
          fill="var(--admin-text-muted)"
          fontSize="9"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
