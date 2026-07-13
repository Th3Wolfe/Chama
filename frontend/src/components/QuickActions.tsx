import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Plus, FolderTree, Monitor } from 'lucide-react';

const ACOES: { label: string; icon: LucideIcon; to: string }[] = [
  { label: 'Novo chamado', icon: Plus, to: '/chamados/novo' },
  { label: 'Nova categoria', icon: FolderTree, to: '/categorias' },
  { label: 'Novo equipamento', icon: Monitor, to: '/equipamentos' },
];

export function QuickActions() {
  const navigate = useNavigate();
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h3 className="card__title" style={{ marginBottom: 12 }}>Ações rápidas</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACOES.map((acao) => (
          <button key={acao.to} className="btn btn--secondary btn--block" onClick={() => navigate(acao.to)}>
            <span style={{ display: 'inline-flex', verticalAlign: '-3px', marginRight: 6 }}>
              <acao.icon size={15} strokeWidth={2} />
            </span>
            {acao.label}
          </button>
        ))}
      </div>
    </div>
  );
}
