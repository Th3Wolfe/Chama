import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';

function formatarDuracao(segundos: number | null): string {
  if (!segundos) return 'N/A';
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);
  return `${horas}h ${minutos}m`;
}

export function DesempenhoTime({
  taxaResolucaoPct,
  tempoMedioSegundos,
  tempoMedioDeltaPct,
  slaDentroPrazoPct,
  serieResolvidosSeteDias,
}: {
  taxaResolucaoPct: number | null;
  tempoMedioSegundos: number | null;
  tempoMedioDeltaPct: number | null;
  slaDentroPrazoPct: number | null;
  serieResolvidosSeteDias: { dia: string; total: number }[];
}) {
  const pct = taxaResolucaoPct ?? 0;

  return (
    <div className="card desempenho-time">
      <div className="card__header" style={{ paddingBottom: 4 }}>
        <h3 className="card__title">Desempenho da equipe</h3>
      </div>

      <div className="desempenho-time__body">
        <div className="desempenho-time__coluna-stats">
          <div
            className="desempenho-time__gauge"
            style={{ background: `conic-gradient(var(--color-primary) ${pct * 3.6}deg, var(--color-border) 0deg)` }}
          >
            <div className="desempenho-time__gauge-inner">
              <span className="desempenho-time__gauge-valor">{taxaResolucaoPct ?? '—'}%</span>
              <span className="desempenho-time__gauge-label">resolução</span>
            </div>
          </div>

          <div className="desempenho-time__stats">
            <div className="desempenho-time__stat">
              <p className="desempenho-time__stat-valor">{formatarDuracao(tempoMedioSegundos)}</p>
              <p className="desempenho-time__stat-label">
                Tempo médio de resolução
                {tempoMedioDeltaPct !== null && (
                  <span className={tempoMedioDeltaPct <= 0 ? 'text-success' : 'text-danger'}>
                    {' '}{tempoMedioDeltaPct <= 0 ? '↓' : '↑'} {Math.abs(tempoMedioDeltaPct)}% vs. ontem
                  </span>
                )}
              </p>
            </div>
            <div className="desempenho-time__stat">
              <p className="desempenho-time__stat-valor">{slaDentroPrazoPct !== null ? `${slaDentroPrazoPct}%` : 'N/A'}</p>
              <p className="desempenho-time__stat-label">Dentro do prazo de SLA</p>
            </div>
          </div>
        </div>

        <div className="desempenho-time__coluna-chart">
          <div className="desempenho-time__chart-legenda">Chamados resolvidos · últimos 7 dias</div>
          <div className="desempenho-time__chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieResolvidosSeteDias} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradResolvidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <filter id="brilhoPontoResolvidos" x="-150%" y="-150%" width="400%" height="400%">
                    <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#3B82F6" floodOpacity={0.9} />
                  </filter>
                </defs>
                <XAxis
                  dataKey="dia"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  fontSize={10}
                  tick={{ fill: '#8891A6' }}
                  axisLine={{ stroke: '#212A3E' }}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(d) => new Date(d as string).toLocaleDateString('pt-BR')}
                  formatter={(v) => [`${v} resolvidos`, '']}
                  contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }}
                  labelStyle={{ color: '#8891A6' }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#gradResolvidos)"
                  dot={{ r: 3, fill: '#FFFFFF', stroke: '#3B82F6', strokeWidth: 1.5, filter: 'url(#brilhoPontoResolvidos)' }}
                  activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#3B82F6', strokeWidth: 2, filter: 'url(#brilhoPontoResolvidos)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
