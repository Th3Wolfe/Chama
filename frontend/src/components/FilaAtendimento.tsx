import { useNavigate } from 'react-router-dom';
import { ArrowRight, MoreVertical, PartyPopper } from 'lucide-react';
import { PrioridadeBadge } from './Badge';
import { formatarSla } from '../utils/sla';
import type { ChamadoComSla } from '../api/types';

/** Iniciais para o avatar do responsável (mesmo critério usado no Topbar). */
function iniciais(nome: string): string {
  return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/** "há X min/h" a partir de atualizado_em — leitura rápida de recência na fila. */
function tempoDesde(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.floor(horas / 24)}d`;
}

/** Cor semântica do texto de SLA: vermelho vencido, âmbar perto do prazo, verde tranquilo. */
function classeSla(segundos: number | null): string {
  if (segundos === null) return 'text-muted';
  if (segundos < 0) return 'text-danger';
  if (segundos <= 7200) return 'text-warning';
  return 'text-success';
}

export function FilaAtendimento({
  chamados,
  onAbrirChamado,
  totalChamados,
  resolvidosHoje,
}: {
  chamados: ChamadoComSla[];
  onAbrirChamado: (id: number) => void;
  totalChamados: number;
  resolvidosHoje: number;
}) {
  const navigate = useNavigate();
  const urgentes = chamados.filter((c) => c.prioridade_atual === 'alta').length;
  const visiveis = chamados.slice(0, 4);

  // Mensagem contextual do estado vazio: sem isso, "fila zerada" ao lado de um
  // "Total de chamados: 10" no topo passa a impressão de que algo está errado.
  // Explicitar o motivo (resolveu hoje / já estava tudo em dia / zero chamados
  // no sistema) deixa claro que o número bate.
  let vazioTitulo = 'Fila zerada';
  let vazioDesc = 'Nenhum chamado ativo aguardando atendimento agora.';
  if (totalChamados === 0) {
    vazioTitulo = 'Nenhum chamado ainda';
    vazioDesc = 'Assim que um chamado for aberto, ele aparece aqui.';
  } else if (resolvidosHoje > 0) {
    vazioDesc = `Você resolveu ${resolvidosHoje} chamado${resolvidosHoje > 1 ? 's' : ''} hoje e não há nada pendente agora.`;
  } else {
    vazioDesc = 'Todos os chamados já foram atendidos. Nada pendente no momento.';
  }

  return (
    <div className="card fila-atendimento">
      <div className="card__header" style={{ paddingBottom: 12 }}>
        <h3 className="card__title">
          Fila de atendimento
          {urgentes > 0 && <span className="chip chip--alerta fila-atendimento__urgentes">{urgentes} urgente{urgentes > 1 ? 's' : ''}</span>}
        </h3>
        <button className="btn-link" onClick={() => navigate('/chamados')}>
          Ver fila completa <ArrowRight size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginLeft: 2 }} />
        </button>
      </div>

      <div className="fila-atendimento__lista">
        {visiveis.length === 0 && (
          <div className="fila-atendimento__vazio">
            <span className="fila-atendimento__vazio-icon"><PartyPopper size={22} strokeWidth={1.75} /></span>
            <p className="fila-atendimento__vazio-titulo">{vazioTitulo}</p>
            <p className="fila-atendimento__vazio-desc">{vazioDesc}</p>
          </div>
        )}
        {visiveis.map((c) => {
          const sla = formatarSla(c.sla_segundos_restantes);
          return (
            <div
              key={c.id}
              className={`fila-atendimento__item fila-atendimento__item--${c.prioridade_atual}`}
              onClick={() => onAbrirChamado(c.id)}
            >
              <PrioridadeBadge prioridade={c.prioridade_atual} />

              <div className="fila-atendimento__info">
                <p className="fila-atendimento__titulo">#{c.id} · {c.titulo}</p>
                <p className="fila-atendimento__meta">
                  {c.setor_nome} · {c.aberto_por_nome ?? '—'}
                  {sla && (
                    <span className={`fila-atendimento__sla ${classeSla(c.sla_segundos_restantes)}`}>
                      {' '}· {sla.vencido ? `SLA vencido há ${sla.texto}` : `SLA em ${sla.texto}`}
                    </span>
                  )}
                </p>
              </div>

              <div className="fila-atendimento__responsavel">
                {c.responsavel_nome ? (
                  <>
                    <span className="fila-atendimento__avatar">{iniciais(c.responsavel_nome)}</span>
                    <span className="fila-atendimento__responsavel-texto">
                      <span className="fila-atendimento__responsavel-nome">{c.responsavel_nome}</span>
                      <span className="fila-atendimento__tempo">{tempoDesde(c.atualizado_em)}</span>
                    </span>
                  </>
                ) : (
                  <span className="chip">Sem responsável</span>
                )}
              </div>

              <button
                className="fila-atendimento__menu"
                onClick={(e) => { e.stopPropagation(); onAbrirChamado(c.id); }}
                aria-label="Abrir chamado"
              >
                <MoreVertical size={16} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
