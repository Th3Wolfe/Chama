export function ChamadosPorSetor({ dados }: { dados: { nome: string; total: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.total));

  return (
    <div className="card">
      <div className="card__header" style={{ paddingBottom: 4 }}>
        <h3 className="card__title">Chamados por setor (mês)</h3>
      </div>
      <div className="setor-bars">
        {dados.length === 0 && <div className="empty-state" style={{ padding: '16px 0' }}>Sem dados este mês.</div>}
        {dados.map((d) => (
          <div key={d.nome} className="setor-bars__linha">
            <span className="setor-bars__nome">{d.nome}</span>
            <div className="setor-bars__trilha">
              <div className="setor-bars__preenchimento" style={{ width: `${(d.total / max) * 100}%` }} />
            </div>
            <span className="setor-bars__total">{d.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
