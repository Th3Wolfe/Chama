import type { ReactNode, CSSProperties } from 'react';

/** Sparkline leve em SVG puro — evita o custo de um ResponsiveContainer do recharts para um traço decorativo de 64x24px. */
function Sparkline({ dados, cor }: { dados: number[]; cor: string }) {
  if (dados.length < 2) return null;
  const w = 64;
  const h = 24;
  const min = Math.min(...dados);
  const max = Math.max(...dados);
  const range = max - min || 1;
  const coords = dados.map((v, i) => {
    const x = (i / (dados.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return { x, y };
  });
  const pontos = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // Id do filtro inclui a cor para não colidir caso mais de um sparkline com
  // filtro apareça na mesma página (ids de <filter> são globais no documento).
  const filtroId = `stat-card-sparkline-brilho-${cor.replace('#', '')}`;
  return (
    <svg className="stat-card__sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <filter id={filtroId} x="-150%" y="-150%" width="400%" height="400%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.1" floodColor={cor} floodOpacity={0.9} />
        </filter>
      </defs>
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={1.6}
          fill="#FFFFFF"
          stroke={cor}
          strokeWidth={0.75}
          filter={`url(#${filtroId})`}
        />
      ))}
    </svg>
  );
}

export function StatCard({
  icon,
  iconBg,
  accent,
  label,
  value,
  footer,
  sparkline,
  sparklineColor,
}: {
  icon: ReactNode;
  iconBg: string;
  accent?: string;
  label: string;
  value: string | number;
  footer?: ReactNode;
  sparkline?: number[];
  sparklineColor?: string;
}) {
  return (
    <div className="card stat-card" style={accent ? ({ '--stat-accent': accent } as CSSProperties) : undefined}>
      <div className="stat-card__icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        {footer}
      </div>
      {sparkline && sparkline.length > 1 && (
        <Sparkline dados={sparkline} cor={sparklineColor ?? '#3B82F6'} />
      )}
    </div>
  );
}
