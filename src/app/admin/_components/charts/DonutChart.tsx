'use client';

/**
 * DonutChart - Lightweight SVG donut chart.
 * Used for gender/attraction breakdown.
 */

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export default function DonutChart({
  segments,
  size = 140,
  strokeWidth = 18,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty__text">אין נתונים</span>
      </div>
    );
  }

  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Calculate segments as stroke-dasharray + dashoffset
  let offset = 0;
  const arcs = segments
    .filter(s => s.value > 0)
    .map(s => {
      const pct = s.value / total;
      const dashArray = `${pct * circumference} ${(1 - pct) * circumference}`;
      const dashOffset = -offset;
      offset += pct * circumference;
      return { ...s, dashArray, dashOffset, pct };
    });

  return (
    <div className="donut-chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-chart__svg">
        {/* Background ring */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--admin-border)"
          strokeWidth={strokeWidth}
        />

        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            className="donut-chart__segment"
          >
            <title>{arc.label}: {arc.value} ({Math.round(arc.pct * 100)}%)</title>
          </circle>
        ))}

        {/* Center text */}
        {centerValue !== undefined && (
          <>
            <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--admin-text)" fontSize="22" fontWeight="700">
              {centerValue}
            </text>
            {centerLabel && (
              <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--admin-text-muted)" fontSize="10">
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="donut-chart__legend">
        {arcs.map((arc, i) => (
          <div key={i} className="donut-chart__legend-item">
            <span className="donut-chart__legend-dot" style={{ background: arc.color }} />
            <span className="donut-chart__legend-label">{arc.label}</span>
            <span className="donut-chart__legend-value">{arc.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
