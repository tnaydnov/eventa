'use client';

interface StatCardProps {
  icon: string;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  color?: 'green' | 'red' | 'blue' | 'orange' | 'purple';
}

const colorMap: Record<string, string> = {
  green: 'var(--admin-green)',
  red: 'var(--admin-red)',
  blue: 'var(--admin-blue)',
  orange: 'var(--admin-orange)',
  purple: 'var(--admin-purple)',
};

export default function StatCard({ icon, label, value, sub, accent, color }: StatCardProps) {
  const valueColor = color ? colorMap[color] : accent ? 'var(--admin-accent)' : undefined;

  return (
    <div className="stat-card">
      <div className="stat-card__top">
        <span className="stat-card__icon" aria-hidden="true">{icon}</span>
        <span className="stat-card__value" style={valueColor ? { color: valueColor } : undefined}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>
      <span className="stat-card__label">{label}</span>
      {sub && <span className="stat-card__sub">{sub}</span>}
    </div>
  );
}
