import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { ArrowUp, ArrowDown, ArrowRight, CalendarDays } from 'lucide-react';
import { AppLayout } from '../components/Layout/AppLayout';
import { PrioridadeBadge } from '../components/Badge';
import { ChamadoModal } from '../components/ChamadoModal';
import { HeroPrioridadeAgora } from '../components/HeroPrioridadeAgora';
import { MinhaFilaCard } from '../components/MinhaFilaCard';
import { FeedAtividades } from '../components/FeedAtividades';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { POLLING_MS } from '../config/polling';
import { formatarSla } from '../utils/sla';
import type { ChamadoComSla, DashboardData } from '../api/types';

const CORES_CATEGORIA = ['#3B82F6', '#22C55E', '#F5A623', '#A78BFA', '#EF4444', '#8892A8'];

function formatarDuracao(segundos: number | null): string {
  if (!segundos) return 'N/A';
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);
  return `${horas}h ${minutos}m`;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Texto de variação para o painel "Indicadores de hoje" (verde = melhora, vermelho = piora). */
function MiniDelta({ pct, invertido = false }: { pct: number | null; invertido?: boolean }) {
  if (pct === null) return <p className="mini-stat__delta mini-stat__delta--neutral">Sem dado de ontem</p>;
  if (pct === 0) return <p className="mini-stat__delta mini-stat__delta--neutral">Igual a ontem</p>;
  const melhora = invertido ? pct < 0 : pct > 0;
  const Seta = pct > 0 ? ArrowUp : ArrowDown;
  // Quando o valor de ontem é muito baixo (perto de zero), a variação percentual
  // explode (ex.: 14216%) e quebra o layout do card. Acima de 999% não agrega
  // informação útil, então mostramos um teto em vez do número exato.
  const abs = Math.abs(pct);
  const texto = abs > 999 ? '999%+' : `${abs}%`;
  return (
    <p className={`mini-stat__delta ${melhora ? 'mini-stat__delta--up' : 'mini-stat__delta--down'}`}>
      <Seta size={12} strokeWidth={2.5} style={{ verticalAlign: '-1px' }} /> {texto} vs. ontem
    </p>
  );
}

function SlaCell({ segundos }: { segundos: number | null }) {
  const sla = formatarSla(segundos);
  if (!sla) return <span className="text-muted">—</span>;
  return (
    <span className={`chip${sla.critico ? ' chip--alerta' : ''}`} style={{ fontSize: 11 }}>
      {sla.vencido ? `Vencido há ${sla.texto}` : `Vence em ${sla.texto}`}
    </span>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [chamadoAbertoId, setChamadoAbertoId] = useState<number | null>(null);
  const [janelaGrafico, setJanelaGrafico] = useState<7 | 14>(7);

  async function carregar() {
    try {
      const { data } = await api.get<DashboardData>('/dashboard');
      setDados(data);
    } catch {
      setErro('Não foi possível carregar o dashboard. Verifique se você está logado como administrador.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, POLLING_MS);
    function aoFocar() {
      if (document.visibilityState === 'visible') carregar();
    }
    document.addEventListener('visibilitychange', aoFocar);
    window.addEventListener('focus', aoFocar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoFocar);
      window.removeEventListener('focus', aoFocar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const serieGrafico = useMemo(() => {
    if (!dados) return [];
    // A API sempre traz 7 dias; "14 dias" é só um placeholder de UI por ora
    // (o seletor existe para quando o backend passar a trazer uma janela maior).
    return dados.serie_sete_dias;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, janelaGrafico]);

  if (carregando) {
    return (
      <AppLayout titulo="Dashboard" subtitulo="Visão geral dos chamados de TI">
        <p className="text-muted">Carregando...</p>
      </AppLayout>
    );
  }

  if (erro || !dados) {
    return (
      <AppLayout titulo="Dashboard" subtitulo="Visão geral dos chamados de TI">
        <div className="empty-state">{erro}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      titulo={`Bom dia${usuario ? `, ${usuario.nome.split(' ')[0]}` : ''} 👋`}
      subtitulo="Visão geral dos chamados de TI"
    >
      {/*
        1. O que precisa da minha atenção agora, lado a lado com os indicadores
        do dia — ambos são leitura rápida de "como estamos agora" e ganham
        destaque compartilhando a primeira faixa da tela.
      */}
      <div className="dashboard-grid" style={{ marginBottom: 20, alignItems: 'stretch' }}>
        <HeroPrioridadeAgora chamado={dados.prioridade_agora} onAbrir={(id) => setChamadoAbertoId(id)} />

        {/* Indicadores de hoje */}
        <div className="card">
          <div className="card__header" style={{ paddingBottom: 4 }}>
            <h3 className="card__title">Indicadores de hoje</h3>
          </div>
          <div className="mini-stat-grid">
            <div className="mini-stat">
              <p className="mini-stat__label">SLA dentro do prazo</p>
              <p className="mini-stat__value">{dados.sla_dentro_prazo_pct !== null ? `${dados.sla_dentro_prazo_pct}%` : 'N/A'}</p>
              <MiniDelta pct={dados.sla_dentro_prazo_delta_pct} />
            </div>
            <div className="mini-stat">
              <p className="mini-stat__label">Resolvidos hoje</p>
              <p className="mini-stat__value">{dados.resolvidos_hoje}</p>
              <MiniDelta pct={dados.resolvidos_hoje_delta_pct} />
            </div>
            <div className="mini-stat">
              <p className="mini-stat__label">Tempo médio de resolução</p>
              <p className="mini-stat__value">{formatarDuracao(dados.tempo_medio_segundos)}</p>
              <MiniDelta pct={dados.tempo_medio_delta_pct} invertido />
            </div>
            <div className="mini-stat">
              <p className="mini-stat__label">Abertos</p>
              <p className="mini-stat__value">{dados.por_status.aberto?.total ?? 0}</p>
              <p className="mini-stat__delta mini-stat__delta--neutral">
                {dados.por_status.aberto?.sem_responsavel ?? 0} sem responsável
              </p>
            </div>
          </div>
        </div>
      </div>

      {/*
        2ª faixa: Minha fila (o que exige ação minha agora) ao lado de Atividade
        recente (contexto rápido do que está rolando) — ambas leituras curtas,
        ficam bem lado a lado.
      */}
      <div className="dashboard-grid" style={{ marginBottom: 20, alignItems: 'stretch' }}>
        <MinhaFilaCard minhaFila={dados.minha_fila} onAbrirChamado={(id) => setChamadoAbertoId(id)} />
        <FeedAtividades atividades={dados.atividade_recente} />
      </div>

      {/* 3ª faixa: Últimos chamados ativos — visão operacional completa, sozinha na linha */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card__header" style={{ paddingBottom: 12 }}>
          <h3 className="card__title">Últimos chamados ativos</h3>
          <button className="btn btn--secondary" onClick={() => navigate('/chamados')}>
            Ver todos <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginLeft: 2 }} />
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Título</th><th>Cliente</th>
              <th>Prioridade</th><th>SLA</th><th>Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {dados.chamados_ativos.length === 0 && (
              <tr><td colSpan={6} className="empty-state">Nenhum chamado ativo no momento.</td></tr>
            )}
            {dados.chamados_ativos.map((c: ChamadoComSla) => (
              <tr key={c.id} className="clickable" onClick={() => setChamadoAbertoId(c.id)}>
                <td className={`td--prioridade-${c.prioridade_atual}`}>#{c.id}</td>
                <td>{c.titulo}</td>
                <td>{c.aberto_por_nome ?? '—'}</td>
                <td><PrioridadeBadge prioridade={c.prioridade_atual} /></td>
                <td><SlaCell segundos={c.sla_segundos_restantes} /></td>
                <td>{formatarData(c.atualizado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Faixa inferior full-width: tendência, categoria e agenda lado a lado */}
      <div className="dashboard-bottom-row">
        {/* Mini-gráfico "Chamados nos últimos N dias" */}
        <div className="card">
          <div className="mini-chart-header">
            <h3 className="card__title">Chamados recentes</h3>
            <select
              className="mini-chart-select"
              value={janelaGrafico}
              onChange={(e) => setJanelaGrafico(Number(e.target.value) as 7 | 14)}
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={serieGrafico}>
              <XAxis
                dataKey="dia"
                tickFormatter={(d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                fontSize={11}
                tick={{ fill: '#8891A6' }}
                axisLine={{ stroke: '#212A3E' }}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(d) => new Date(d as string).toLocaleDateString('pt-BR')}
                contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }}
                labelStyle={{ color: '#8891A6' }}
              />
              <Line type="monotone" dataKey="total" name="Chamados" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chamados por categoria */}
        <div className="card">
          <div className="card__header" style={{ paddingBottom: 4 }}>
            <h3 className="card__title">Chamados por categoria (mês)</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie data={dados.por_categoria} dataKey="total" nameKey="nome" innerRadius={45} outerRadius={68} cy="42%">
                {dados.por_categoria.map((_, i) => (
                  <Cell key={i} fill={CORES_CATEGORIA[i % CORES_CATEGORIA.length]} stroke="#10162A" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }} />
              <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: 11, lineHeight: '16px', color: '#8891A6' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Agenda de hoje — módulo ainda não implementado */}
        <div className="card">
          <div className="card__header" style={{ paddingBottom: 4 }}>
            <h3 className="card__title">Agenda de hoje</h3>
          </div>
          <div className="agenda-placeholder">
            <div className="agenda-placeholder__icon"><CalendarDays size={26} strokeWidth={1.75} /></div>
            <p className="agenda-placeholder__texto">
              O módulo de Agenda ainda não foi implementado.<br />Em breve: manutenções e eventos de TI aqui.
            </p>
          </div>
        </div>
      </div>

      {chamadoAbertoId !== null && (
        <ChamadoModal
          chamadoId={chamadoAbertoId}
          onFechar={() => setChamadoAbertoId(null)}
          onMudou={carregar}
        />
      )}
    </AppLayout>
  );
}
