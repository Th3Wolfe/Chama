import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Clock } from 'lucide-react';

const FAIXAS = [
  { key: 'critico', label: 'Crítico', desc: 'SLA vencido — ação imediata', icon: AlertTriangle, tom: 'critico' },
  { key: 'alto', label: 'Alto', desc: 'Vence nas próximas 2 horas', icon: AlertCircle, tom: 'alto' },
  { key: 'medio', label: 'Médio', desc: 'Vence nas próximas 8 horas', icon: Clock, tom: 'medio' },
] as const;

export function AlertasSla({ alertas }: { alertas: { critico: number; alto: number; medio: number } }) {
  const navigate = useNavigate();
  const total = alertas.critico + alertas.alto + alertas.medio;

  return (
    <div className="card alertas-sla">
      <div className="card__header" style={{ paddingBottom: 12 }}>
        <h3 className="card__title">Alertas de SLA</h3>
        <button className="btn-link" onClick={() => navigate('/chamados')}>Ver todos</button>
      </div>
      <div className="alertas-sla__lista">
        {total === 0 && (
          <div className="empty-state" style={{ padding: '16px 0' }}>Nenhum chamado próximo do vencimento. 🎉</div>
        )}
        {FAIXAS.filter((f) => alertas[f.key] > 0).map((f) => (
          <button key={f.key} className={`alertas-sla__item alertas-sla__item--${f.tom}`} onClick={() => navigate('/chamados')}>
            <span className="alertas-sla__icon"><f.icon size={16} strokeWidth={2} /></span>
            <span className="alertas-sla__texto">
              <span className="alertas-sla__label">{f.label} · {alertas[f.key]} chamado{alertas[f.key] > 1 ? 's' : ''}</span>
              <span className="alertas-sla__desc">{f.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
