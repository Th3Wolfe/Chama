import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';
import { MonitorCog } from 'lucide-react';

const CORES = ['#3B82F6', '#22C55E', '#F5A623', '#A78BFA', '#EF4444', '#8892A8'];

/**
 * "Equipamentos em destaque": ranking dos equipamentos com mais chamados
 * abertos no mês atual. Ocupa o espaço vazio abaixo da fila de atendimento
 * (coluna "fila" da dashboard-row-3col não tinha nada na segunda linha).
 */
export function ChamadosPorEquipamento({
  dados,
}: {
  dados: { nome: string; marca: string | null; total: number }[];
}) {
  const dadosGrafico = dados.map((d) => ({
    ...d,
    rotulo: d.marca ? `${d.nome} (${d.marca})` : d.nome,
  }));

  return (
    <div className="card equipamentos-destaque">
      <div className="card__header" style={{ paddingBottom: 4 }}>
        <h3 className="card__title">
          <MonitorCog size={16} strokeWidth={2} style={{ marginRight: 6, verticalAlign: -3, color: 'var(--color-primary)' }} />
          Equipamentos com mais chamados (mês)
        </h3>
      </div>

      {dadosGrafico.length === 0 ? (
        <div className="empty-state" style={{ padding: '16px 0' }}>Sem chamados vinculados a equipamentos este mês.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={dadosGrafico}
            layout="vertical"
            margin={{ top: 4, right: 28, left: 4, bottom: 0 }}
            barCategoryGap={10}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="rotulo"
              width={132}
              fontSize={11}
              tick={{ fill: '#8891A6' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              formatter={(v) => [`${v} chamado${Number(v) === 1 ? '' : 's'}`, '']}
              contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }}
              labelStyle={{ color: '#EAEDF5' }}
            />
            <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={16}>
              {dadosGrafico.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
              <LabelList dataKey="total" position="right" fill="#EAEDF5" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
