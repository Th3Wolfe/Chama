import { useNavigate } from 'react-router-dom';

const ACOES = [
  { label: 'Novo chamado', icon: '➕', to: '/chamados/novo' },
  { label: 'Nova categoria', icon: '🗂️', to: '/categorias' },
  { label: 'Novo equipamento', icon: '🖥️', to: '/equipamentos' },
];

export function QuickActions() {
  const navigate = useNavigate();
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h3 className="card__title" style={{ marginBottom: 12 }}>Ações rápidas</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACOES.map((acao) => (
          <button key={acao.to} className="btn btn--secondary btn--block" onClick={() => navigate(acao.to)}>
            <span>{acao.icon}</span> {acao.label}
          </button>
        ))}
      </div>
    </div>
  );
}
