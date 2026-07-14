import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const CORES = ['#3B82F6', '#22C55E', '#F5A623', '#A78BFA', '#EF4444', '#8892A8'];

export function ChamadosPorCategoria({ dados }: { dados: { nome: string; total: number }[] }) {
  const total = dados.reduce((soma, d) => soma + d.total, 0);

  return (
    <div className="card">
      <div className="card__header" style={{ paddingBottom: 4 }}>
        <h3 className="card__title">Chamados por categoria (mês)</h3>
      </div>
      <div className="categoria-doughnut">
        <div className="categoria-doughnut__chart">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie data={dados} dataKey="total" nameKey="nome" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                {dados.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="categoria-doughnut__center">
            <span className="categoria-doughnut__total">{total}</span>
            <span className="categoria-doughnut__total-label">Total</span>
          </div>
        </div>

        <div className="categoria-doughnut__legend">
          {dados.length === 0 && <p className="text-muted" style={{ fontSize: 12 }}>Sem dados este mês.</p>}
          {dados.map((d, i) => {
            const pct = total > 0 ? Math.round((d.total / total) * 100) : 0;
            return (
              <div key={d.nome} className="categoria-doughnut__item">
                <span className="categoria-doughnut__dot" style={{ background: CORES[i % CORES.length] }} />
                <span className="categoria-doughnut__nome">{d.nome}</span>
                <span className="categoria-doughnut__valor">{d.total} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
