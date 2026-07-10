import { useState } from 'react';
import type { ChamadoComSla, MinhaFila } from '../api/types';

const BUCKETS: { key: keyof MinhaFila; icon: string; titulo: string; desc: string }[] = [
  { key: 'aguardando_meu_atendimento', icon: '💬', titulo: 'Aguardando meu atendimento', desc: 'Atribuídos, ainda não iniciados' },
  { key: 'cliente_respondeu', icon: '↩️', titulo: 'Cliente respondeu', desc: 'Aguardando sua resposta' },
  { key: 'sla_vencendo', icon: '⏱️', titulo: 'Prazo próximo do vencimento', desc: 'SLA vencendo em breve' },
  { key: 'sem_responsavel', icon: '🙋', titulo: 'Sem responsável', desc: 'Aguardando ser assumido' },
];

export function MinhaFilaCard({
  minhaFila,
  onAbrirChamado,
}: {
  minhaFila: MinhaFila;
  onAbrirChamado: (id: number) => void;
}) {
  const [aberto, setAberto] = useState<keyof MinhaFila | null>(null);
  const total = BUCKETS.reduce((soma, b) => soma + minhaFila[b.key].length, 0);

  return (
    <div className="card">
      <div className="card__header" style={{ paddingBottom: 12 }}>
        <h3 className="card__title">Minha fila</h3>
        <span className="badge badge--contagem">{total}</span>
      </div>
      <div className="side-panel-list">
        {BUCKETS.map((bucket) => {
          const itens = minhaFila[bucket.key];
          const expandido = aberto === bucket.key;
          return (
            <div key={bucket.key}>
              <button
                className="minha-fila__linha"
                onClick={() => setAberto(expandido ? null : bucket.key)}
                disabled={itens.length === 0}
              >
                <span className="minha-fila__icon">{bucket.icon}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span className="notification-item__title" style={{ display: 'block' }}>{bucket.titulo}</span>
                  <span className="notification-item__desc" style={{ display: 'block' }}>{bucket.desc}</span>
                </span>
                <span className="minha-fila__contagem">{itens.length}</span>
                {itens.length > 0 && <span className="minha-fila__chevron">{expandido ? '︿' : '﹀'}</span>}
              </button>
              {expandido && (
                <div className="minha-fila__sublista">
                  {itens.map((c: ChamadoComSla) => (
                    <div key={c.id} className="minha-fila__subitem" onClick={() => onAbrirChamado(c.id)}>
                      <span className={`minha-fila__prioridade-dot minha-fila__prioridade-dot--${c.prioridade_atual}`} />
                      <span className="minha-fila__subitem-titulo">#{c.id} — {c.titulo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {total === 0 && (
          <div className="empty-state" style={{ padding: '20px 0' }}>Sua fila está vazia 🎉</div>
        )}
      </div>
    </div>
  );
}
