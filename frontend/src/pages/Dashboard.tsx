import { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import { Ticket, Clock3, MessageCircleMore, CheckCircle2 } from 'lucide-react';
import { AppLayout } from '../components/Layout/AppLayout';
import { ChamadoModal } from '../components/ChamadoModal';
import { FilaAtendimento } from '../components/FilaAtendimento';
import { AlertasSla } from '../components/AlertasSla';
import { DesempenhoTime } from '../components/DesempenhoTime';
import { ChamadosPorSetor } from '../components/ChamadosPorSetor';
import { ChamadosPorCategoria } from '../components/ChamadosPorCategoria';
import { FeedAtividades } from '../components/FeedAtividades';
import { StatCard } from '../components/StatCard';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { POLLING_MS } from '../config/polling';
import type { DashboardData } from '../api/types';

function delta(pct: number | null, invertido = false): { texto: string; classe: string } {
  if (pct === null) return { texto: 'Sem dado de ontem', classe: 'stat-card__delta--neutral' };
  if (pct === 0) return { texto: 'Igual a ontem', classe: 'stat-card__delta--neutral' };
  const melhora = invertido ? pct < 0 : pct > 0;
  const abs = Math.abs(pct) > 999 ? '999%+' : `${Math.abs(pct)}%`;
  return {
    texto: `${pct > 0 ? '↑' : '↓'} ${abs} vs. ontem`,
    classe: melhora ? 'stat-card__delta--up' : 'stat-card__delta--down',
  };
}

export function Dashboard() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [chamadoAbertoId, setChamadoAbertoId] = useState<number | null>(null);
  const [janelaGrafico, setJanelaGrafico] = useState<7 | 14>(7);

  async function carregar(dias = janelaGrafico) {
    try {
      const { data } = await api.get<DashboardData>('/dashboard', { params: { dias } });
      setDados(data);
    } catch {
      setErro('Não foi possível carregar o dashboard. Verifique se você está logado como administrador.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(janelaGrafico);
    const intervalo = setInterval(() => carregar(janelaGrafico), POLLING_MS);
    function aoFocar() {
      if (document.visibilityState === 'visible') carregar(janelaGrafico);
    }
    document.addEventListener('visibilitychange', aoFocar);
    window.addEventListener('focus', aoFocar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoFocar);
      window.removeEventListener('focus', aoFocar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [janelaGrafico]);

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

  const subtitulo = `Hoje: ${dados.alertas_sla.critico} crítico${dados.alertas_sla.critico === 1 ? '' : 's'} · ` +
    `${dados.aguardando_cliente_total} aguardando resposta · ${dados.resolvidos_hoje} resolvidos`;

  const dTotal = delta(dados.total_chamados_delta_pct);
  const dAndamento = delta(dados.em_andamento_delta_pct);
  const dResolvidos = delta(dados.resolvidos_hoje_delta_pct);
  // "Total de chamados" é o único KPI com sparkline: é o único que representa
  // genuinamente uma tendência de vários dias. "Resolvidos hoje" é um número de
  // um único dia (sparkline de 7 dias ali seria enganosa); "Em andamento" e
  // "Aguardando cliente" são fotografias do estado atual, sem histórico diário.
  const trendCriados = dados.serie_sete_dias.map((d) => d.total);

  return (
    <AppLayout
      titulo={`Bom dia${usuario ? `, ${usuario.nome.split(' ')[0]}` : ''} 👋`}
      subtitulo={subtitulo}
    >
      {/* KPIs: leitura de estado geral em menos de 3 segundos */}
      <div className="stat-grid">
        <StatCard
          icon={<Ticket size={20} strokeWidth={2} />}
          iconBg="linear-gradient(135deg,#3B82F6,#2563EB)"
          label="Total de chamados"
          value={dados.total_chamados}
          footer={<p className={`stat-card__delta ${dTotal.classe}`}>{dTotal.texto}</p>}
          sparkline={trendCriados}
          sparklineColor="#3B82F6"
        />
        <StatCard
          icon={<Clock3 size={20} strokeWidth={2} />}
          iconBg="linear-gradient(135deg,#F5A623,#E08E00)"
          label="Em andamento"
          value={dados.por_status.em_andamento?.total ?? 0}
          footer={<p className={`stat-card__delta ${dAndamento.classe}`}>{dAndamento.texto}</p>}
        />
        <StatCard
          icon={<MessageCircleMore size={20} strokeWidth={2} />}
          iconBg="linear-gradient(135deg,#A78BFA,#7C5CF0)"
          label="Aguardando cliente"
          value={dados.aguardando_cliente_total}
          footer={<p className="stat-card__delta stat-card__delta--neutral">Aguardando resposta do solicitante</p>}
        />
        <StatCard
          icon={<CheckCircle2 size={20} strokeWidth={2} />}
          iconBg="linear-gradient(135deg,#22C55E,#16A34A)"
          label="Resolvidos hoje"
          value={dados.resolvidos_hoje}
          footer={<p className={`stat-card__delta ${dResolvidos.classe}`}>{dResolvidos.texto}</p>}
        />
      </div>

      {/* SITUAÇÃO + TRABALHO: fila operacional à esquerda; à direita, Desempenho
          ocupa a largura toda em cima, com Alertas de SLA e Atividade recente
          lado a lado embaixo. */}
      <div className="dashboard-row-3col">
        <FilaAtendimento
          chamados={dados.chamados_ativos}
          onAbrirChamado={setChamadoAbertoId}
          totalChamados={dados.total_chamados}
          resolvidosHoje={dados.resolvidos_hoje}
        />
        <DesempenhoTime
          taxaResolucaoPct={dados.taxa_resolucao_pct}
          tempoMedioSegundos={dados.tempo_medio_segundos}
          tempoMedioDeltaPct={dados.tempo_medio_delta_pct}
          slaDentroPrazoPct={dados.sla_dentro_prazo_pct}
          serieResolvidosSeteDias={dados.serie_resolvidos_sete_dias}
        />
        <AlertasSla alertas={dados.alertas_sla} />
        <FeedAtividades atividades={dados.atividade_recente} className="feed-atividades--flex" />
      </div>

      {/* ANÁLISE + ESTATÍSTICAS: gráficos, sem competir com as ações prioritárias acima */}
      <div className="dashboard-bottom-row">
        <ChamadosPorCategoria dados={dados.por_categoria} />

        <ChamadosPorSetor dados={dados.por_setor} />

        <div className="card">
          <div className="mini-chart-header">
            <h3 className="card__title">Tendência de chamados</h3>
            <select
              className="mini-chart-select"
              value={janelaGrafico}
              onChange={(e) => setJanelaGrafico(Number(e.target.value) as 7 | 14)}
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dados.serie_sete_dias} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTendencia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                formatter={(v) => [`${v} chamados`, '']}
                contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }}
                labelStyle={{ color: '#8891A6' }}
              />
              <Area type="monotone" dataKey="total" name="Chamados criados" stroke="#3B82F6" strokeWidth={2} fill="url(#gradTendencia)" dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
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
