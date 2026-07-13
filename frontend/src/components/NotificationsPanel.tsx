import { CheckCheck } from 'lucide-react';
import type { Notificacao } from '../api/types';

const TIPO_INFO: Record<Notificacao['tipo'], { titulo: string; cor: string }> = {
  novo_chamado: { titulo: 'Novo chamado aberto', cor: '#3B82F6' },
  novo_comentario: { titulo: 'Novo comentário', cor: '#F5A623' },
  mudanca_status: { titulo: 'Status alterado', cor: '#A78BFA' },
  chamado_atribuido: { titulo: 'Chamado atribuído a você', cor: '#22C55E' },
};

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function NotificationsPanel({
  notificacoes,
  onSelecionar,
  onMarcarTodasLidas,
}: {
  notificacoes: Notificacao[];
  onSelecionar?: (n: Notificacao) => void;
  onMarcarTodasLidas?: () => void;
}) {
  const temNaoLidas = notificacoes.some((n) => !n.lida);

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Notificações</h3>
        {temNaoLidas && (
          <button className="notifications-panel__marcar-todas" onClick={onMarcarTodasLidas}>
            <CheckCheck size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Marcar todas como lidas
          </button>
        )}
      </div>
      <div className="side-panel-list">
        {notificacoes.length === 0 && (
          <div className="empty-state" style={{ padding: '20px 0' }}>Nenhuma notificação ainda.</div>
        )}
        {notificacoes.slice(0, 8).map((n) => {
          const info = TIPO_INFO[n.tipo];
          return (
            <div
              key={n.id}
              className="notification-item"
              onClick={() => onSelecionar?.(n)}
              style={{ cursor: onSelecionar ? 'pointer' : 'default', opacity: n.lida ? 0.6 : 1 }}
            >
              <span className="notification-item__dot" style={{ background: info.cor }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="notification-item__title">{info.titulo}</p>
                <p className="notification-item__desc">{n.chamado_titulo ?? `Chamado #${n.chamado_id}`}</p>
              </div>
              <span className="notification-item__time">{tempoRelativo(n.criado_em)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
