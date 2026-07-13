import type { ReactNode, CSSProperties } from 'react';

export function StatCard({
  icon,
  iconBg,
  accent,
  label,
  value,
  footer,
}: {
  icon: ReactNode;
  iconBg: string;
  accent?: string;
  label: string;
  value: string | number;
  footer?: ReactNode;
}) {
  return (
    <div className="card stat-card" style={accent ? ({ '--stat-accent': accent } as CSSProperties) : undefined}>
      <div className="stat-card__icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div>
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        {footer}
      </div>
    </div>
  );
}
