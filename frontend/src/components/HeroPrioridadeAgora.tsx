import type { LucideIcon } from 'lucide-react';
import {
  TriangleAlert,
  Clock,
  User,
  ArrowRight,
  ChevronRight,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  BarChart3,
  Lightbulb,
  Printer,
  Wifi,
  Server,
  Phone,
  Mail,
  Laptop,
  Wrench,
} from 'lucide-react';
import { PrioridadeBadge } from './Badge';
import { formatarSla } from '../utils/sla';
import type { ChamadoComSla, Prioridade } from '../api/types';

// Ícone decorativo baseado no nome da categoria — mera pista visual, não afeta lógica.
const ICONES_CATEGORIA: { termos: string[]; icone: LucideIcon }[] = [
  { termos: ['impressora', 'toner'], icone: Printer },
  { termos: ['internet', 'rede', 'wi-fi', 'wifi'], icone: Wifi },
  { termos: ['servidor', 'backup'], icone: Server },
  { termos: ['telefonia', 'telefone', 'ramal'], icone: Phone },
  { termos: ['e-mail', 'email', 'outlook'], icone: Mail },
  { termos: ['sistema', 'software', 'erp'], icone: Laptop },
];

function iconePara(categoriaNome: string): LucideIcon {
  const alvo = categoriaNome.toLowerCase();
  const achado = ICONES_CATEGORIA.find((c) => c.termos.some((t) => alvo.includes(t)));
  return achado?.icone ?? Wrench;
}

// Prazos de referência por prioridade, só para desenhar a barra de progresso
// do SLA (não há prazo total armazenado, então isso é uma estimativa visual).
const SLA_TOTAL_HORAS: Record<Prioridade, number> = {
  alta: 4,
  media: 24,
  baixa: 72,
};

function progressoSlaPct(segundosRestantes: number | null | undefined, prioridade: Prioridade): number {
  if (segundosRestantes === null || segundosRestantes === undefined || segundosRestantes < 0) return 100;
  const totalSegundos = SLA_TOTAL_HORAS[prioridade] * 3600;
  const decorrido = totalSegundos - segundosRestantes;
  return Math.min(100, Math.max(0, (decorrido / totalSegundos) * 100));
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
        <div className="hero-card__ok-ilustracao" aria-hidden="true">
          <span className="hero-card__ok-dot" />
          <span className="hero-card__ok-ring" />
          <span className="hero-card__ok-plus">+</span>
          <PackageCheck size={26} strokeWidth={1.75} />
        </div>

        <h3 className="hero-card__ok-title">
          Tudo <span className="hero-card__ok-accent">sob controle</span>!
        </h3>
        <p className="hero-card__ok-desc">
          Não há chamados em aberto com prioridade alta ou média. Ótimo trabalho! 🎉
        </p>

        <div className="hero-card__ok-stats">
          <div className="hero-card__ok-stat">
            <div className="hero-card__ok-stat-icon hero-card__ok-stat-icon--green">
              <ShieldCheck size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="hero-card__ok-stat-title">Fila de prioridade</p>
              <p className="hero-card__ok-stat-desc">Zerada no momento</p>
            </div>
          </div>
          <div className="hero-card__ok-stat">
            <div className="hero-card__ok-stat-icon hero-card__ok-stat-icon--blue">
              <Clock size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="hero-card__ok-stat-title">Tempo de resposta</p>
              <p className="hero-card__ok-stat-desc">Dentro da meta</p>
            </div>
          </div>
          <div className="hero-card__ok-stat">
            <div className="hero-card__ok-stat-icon hero-card__ok-stat-icon--purple">
              <BarChart3 size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="hero-card__ok-stat-title">Equipe eficiente</p>
              <p className="hero-card__ok-stat-desc">Continue assim!</p>
            </div>
          </div>
        </div>

        <div className="hero-card__ok-tip">
          <Lightbulb size={14} strokeWidth={2} />
          <p><strong>Dica:</strong> mantenha o foco na prevenção e na melhoria contínua para manter os indicadores sempre positivos.</p>
        </div>
      </div>
    );
  }

  const sla = formatarSla(chamado.sla_segundos_restantes);
  const critico = sla?.critico ?? false;
  const IconeCategoria = iconePara(chamado.categoria_nome ?? '');
  const progresso = progressoSlaPct(chamado.sla_segundos_restantes, chamado.prioridade_atual);

  return (
    <div className={`card hero-card${critico ? ' hero-card--critico' : ''}`}>
      <div className="hero-card__top">
        <div className="hero-card__main">
          <span className="hero-card__eyebrow">
            <TriangleAlert size={14} strokeWidth={2.5} />
            Prioridade agora
          </span>

          <div className="hero-card__title-row">
            <h3 className="hero-card__ticket-title">{chamado.titulo}</h3>
            <PrioridadeBadge prioridade={chamado.prioridade_atual} />
          </div>

          <p className="hero-card__ticket-meta">#{chamado.id} · {chamado.setor_nome}</p>
        </div>

        <div className="hero-card__ilustracao" aria-hidden="true">
          <IconeCategoria size={38} strokeWidth={1.5} />
        </div>
      </div>

      <div className="hero-card__divider" />

      <div className="hero-card__meta-row">
        <div className="hero-card__meta-col">
          <div className="hero-card__meta-icon hero-card__meta-icon--sla">
            <Clock size={18} strokeWidth={2} />
          </div>
          <div className="hero-card__meta-content">
            <p className="hero-card__meta-label">{sla?.vencido ? 'SLA vencido há' : 'SLA vence em'}</p>
            <p className={`hero-card__meta-value${critico ? ' hero-card__meta-value--critico' : ''}`}>
              {sla?.texto ?? '—'}
            </p>
            {sla && (
              <div className="hero-card__progress">
                <div
                  className={`hero-card__progress-fill${critico ? ' hero-card__progress-fill--critico' : ''}`}
                  style={{ width: `${progresso}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="hero-card__meta-divider" />

        <div className="hero-card__meta-col">
          <div className="hero-card__meta-icon hero-card__meta-icon--responsavel">
            <User size={18} strokeWidth={2} />
          </div>
          <div className="hero-card__meta-content">
            <p className="hero-card__meta-label">Responsável</p>
            <p className="hero-card__meta-value">{chamado.responsavel_nome ?? 'Sem responsável'}</p>
            {!chamado.responsavel_nome && (
              <span className="chip hero-card__meta-tag">Aguardando atribuição</span>
            )}
          </div>
        </div>
      </div>

      <div className="hero-card__actions">
        <button className="btn btn--primary hero-card__cta" onClick={() => onAbrir(chamado.id)}>
          Abrir chamado <ArrowRight size={16} strokeWidth={2.25} />
        </button>
        <button className="btn btn--secondary hero-card__ver-detalhes" onClick={() => onAbrir(chamado.id)}>
          <span className="hero-card__ver-detalhes-label">
            <MessageCircle size={16} strokeWidth={2} />
            Ver detalhes
          </span>
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
