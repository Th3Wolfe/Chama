import { PrioridadeBadge } from './Badge';
import type { ChamadoComSla } from '../api/types';

function formatarSla(segundos: number | null): { texto: string; vencido: boolean } | null {
  if (segundos === null || segundos === undefined) return null;
  const vencido = segundos < 0;
  const abs = Math.abs(segundos);
  const horas = Math.floor(abs / 3600);
  const minutos = Math.round((abs % 3600) / 60);
  const texto = horas > 0 ? `${horas}h ${minutos}min` : `${minutos} min`;
  return { texto, vencido };
}

export function HeroPrioridadeAgora({
  chamado,
  onAbrir,
}: {
  chamado: ChamadoComSla | null;
  onAbrir: (id: number) => void;
}) {
  if (!chamado) {
    return (
      <div className="card hero-card hero-card--ok">
        <div className="hero-card__icon hero-card__icon--ok">🎉</div>
        <div style={{ flex: 1 }}>
          <h3 className="hero-card__title">Tudo em dia</h3>
          <p className="hero-card__desc">Nenhum chamado em aberto precisa de atenção imediata agora.</p>
        </div>
      </div>
    );
  }

  const sla = formatarSla(chamado.sla_segundos_restantes);
  const critico = sla ? (sla.vencido || (!sla.vencido && chamado.sla_segundos_restantes! < 1800)) : false;

  return (
    <div className={`card hero-card${critico ? ' hero-card--critico' : ''}`}>
      <div className="hero-card__header">
        <span className="hero-card__eyebrow">⚠️ Prioridade agora</span>
        <span className={`badge hero-card__status-badge${critico ? ' hero-card__status-badge--critico' : ''}`}>
          {sla?.vencido ? 'SLA VENCIDO' : critico ? 'CRÍTICO' : chamado.prioridade_atual.toUpperCase()}
        </span>
      </div>

      <h3 className="hero-card__ticket-title">{chamado.titulo}</h3>
      <p className="hero-card__ticket-meta">#{chamado.id} · {chamado.setor_nome}</p>

      <div className="hero-card__chips">
        <PrioridadeBadge prioridade={chamado.prioridade_atual} />
        {sla && (
          <span className={`chip${sla.vencido ? ' chip--alerta' : ''}`}>
            🕐 {sla.vencido ? `SLA vencido há ${sla.texto}` : `SLA vence em ${sla.texto}`}
          </span>
        )}
        <span className="chip">{chamado.responsavel_nome ? `👤 ${chamado.responsavel_nome}` : '👤 Sem responsável'}</span>
      </div>

      <button className="btn btn--primary hero-card__cta" onClick={() => onAbrir(chamado.id)}>
        Abrir chamado →
      </button>
    </div>
  );
}
