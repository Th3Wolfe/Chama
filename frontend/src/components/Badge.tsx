import type { Prioridade, StatusChamado } from '../api/types';

const STATUS_LABEL: Record<StatusChamado, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
};

const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const PRIORIDADE_ICONE: Record<Prioridade, string> = {
  baixa: '▾',
  media: '▪',
  alta: '▴',
};

export function StatusBadge({ status }: { status: StatusChamado }) {
  return (
    <span className={`badge badge--status-${status}`}>{STATUS_LABEL[status]}</span>
  );
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  return (
    <span className={`badge badge--prioridade-${prioridade}`}>
      <span className="badge__icone" aria-hidden="true">{PRIORIDADE_ICONE[prioridade]}</span>
      {PRIORIDADE_LABEL[prioridade]}
    </span>
  );
}
