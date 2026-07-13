import type { LucideIcon } from 'lucide-react';
import { Plus, MessageSquare, RefreshCw } from 'lucide-react';
import type { AtividadeRecente } from '../api/types';

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
};

const ICONE_POR_TIPO: Record<AtividadeRecente['tipo'], LucideIcon> = {
  novo_chamado: Plus,
  comentario: MessageSquare,
  mudanca_status: RefreshCw,
};

function formatarRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

function textoAtividade(a: AtividadeRecente): string {
  switch (a.tipo) {
    case 'novo_chamado':
      return `abriu o chamado "${a.chamado_titulo}"`;
    case 'comentario':
      return `comentou em "${a.chamado_titulo}": "${a.detalhe}"`;
    case 'mudanca_status':
      return `alterou "${a.chamado_titulo}" para ${STATUS_LABEL[a.detalhe ?? ''] ?? a.detalhe}`;
    default:
      return '';
  }
}

export function FeedAtividades({ atividades }: { atividades: AtividadeRecente[] }) {
  return (
    <div className="card">
      <div className="card__header" style={{ paddingBottom: 12 }}>
        <h3 className="card__title">Atividade recente</h3>
      </div>
      <div className="feed-atividades">
        {atividades.length === 0 && (
          <div className="empty-state" style={{ padding: '20px 0' }}>Nenhuma atividade recente.</div>
        )}
        {atividades.map((a, i) => {
          const Icone = ICONE_POR_TIPO[a.tipo];
          return (
            <div key={`${a.tipo}-${a.chamado_id}-${a.quando}-${i}`} className="feed-atividades__item">
              <span className="feed-atividades__icon"><Icone size={15} strokeWidth={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="feed-atividades__texto">
                  <strong>{a.autor_nome}</strong> {textoAtividade(a)}
                </p>
                <p className="feed-atividades__tempo">{formatarRelativo(a.quando)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
