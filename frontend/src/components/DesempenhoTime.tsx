import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from 'recharts';

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
  serieSeteDias,
}: {
  taxaResolucaoPct: number | null;
  tempoMedioSegundos: number | null;
  tempoMedioDeltaPct: number | null;
  slaDentroPrazoPct: number | null;
  serieSeteDias: { dia: string; total: number }[];
}) {
  const pct = taxaResolucaoPct ?? 0;

  return (
    <div className="card desempenho-time">
      <div className="card__header" style={{ paddingBottom: 4 }}>
        <h3 className="card__title">Desempenho da equipe</h3>
      </div>

      <div className="desempenho-time__topo">
        <div
          className="desempenho-time__gauge"
          style={{ background: `conic-gradient(var(--color-primary) ${pct * 3.6}deg, var(--color-border) 0deg)` }}
        >
          <div className="desempenho-time__gauge-inner">
            <span className="desempenho-time__gauge-valor">{taxaResolucaoPct ?? '—'}%</span>
          </div>
        </div>

        <div className="desempenho-time__stats">
          <div>
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
          <div>
            <p className="desempenho-time__stat-valor">{slaDentroPrazoPct !== null ? `${slaDentroPrazoPct}%` : 'N/A'}</p>
            <p className="desempenho-time__stat-label">Dentro do prazo de SLA</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 90 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serieSeteDias} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
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
              contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }}
              labelStyle={{ color: '#8891A6' }}
            />
            <Line type="monotone" dataKey="total" name="Chamados" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
