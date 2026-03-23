'use client';

/**
 * BarChart - Lightweight SVG horizontal bar chart.
 * Used for age distribution, looking-for breakdown, etc.
 */

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarItem[];
  maxBars?: number;
}

export default function BarChart({ data, maxBars }: BarChartProps) {
  const items = maxBars ? data.slice(0, maxBars) : data;
  const maxVal = Math.max(...items.map(d => d.value), 1);

  if (items.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty__text">אין נתונים</span>
      </div>
    );
  }

  return (
    <div className="bar-chart" role="img" aria-label="תרשים עמודות">
      {items.map((item, i) => (
        <div key={i} className="bar-chart__row">
          <span className="bar-chart__label">{item.label}</span>
          <div className="bar-chart__track">
            <div
              className="bar-chart__fill"
              style={{
                width: `${(item.value / maxVal) * 100}%`,
                background: item.color || 'var(--admin-accent)',
              }}
            />
          </div>
          <span className="bar-chart__value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
