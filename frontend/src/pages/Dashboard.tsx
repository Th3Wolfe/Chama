import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { AppLayout } from '../components/Layout/AppLayout';
import { StatCard } from '../components/StatCard';
import { QuickActions } from '../components/QuickActions';
import { PrioridadeBadge } from '../components/Badge';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Chamado, DashboardData } from '../api/types';

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

function TabelaChamados({ chamados, vazio, onAbrir }: { chamados: Chamado[]; vazio: string; onAbrir: (id: number) => void }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>ID</th><th>Título</th><th>Setor</th><th>Categoria</th>
          <th>Prioridade</th><th>Responsável</th><th>Criado em</th>
        </tr>
      </thead>
      <tbody>
        {chamados.length === 0 && (
          <tr><td colSpan={7} className="empty-state">{vazio}</td></tr>
        )}
        {chamados.map((c) => (
          <tr key={c.id} className="clickable" onClick={() => onAbrir(c.id)}>
            <td className={`td--prioridade-${c.prioridade_atual}`}>#{c.id}</td>
            <td>{c.titulo}</td>
            <td>{c.setor_nome}</td>
            <td>{c.categoria_nome}</td>
            <td><PrioridadeBadge prioridade={c.prioridade_atual} /></td>
            <td>{c.responsavel_nome ?? '—'}</td>
            <td>{formatarData(c.criado_em)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<'aberto' | 'em_andamento'>('aberto');

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

    // Atualiza sozinho a cada 15s (mesmo intervalo do sino de notificações)
    const intervalo = setInterval(carregar, 15000);

    // E também assim que o admin volta pra essa aba — sem precisar esperar
    // o próximo ciclo do polling nem apertar F5.
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

  async function assumir(chamadoId: number) {
    if (!usuario) return;
    await api.patch(`/chamados/${chamadoId}`, { responsavel_id: usuario.id, status: 'em_andamento' });
    await carregar();
  }

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

  const abertos = dados.por_status.aberto?.total ?? 0;
  const semResponsavel = dados.por_status.aberto?.sem_responsavel ?? 0;
  const emAndamento = dados.por_status.em_andamento?.total ?? 0;
  const aguardandoUsuario = dados.por_status.em_andamento?.sem_responsavel ?? 0;
  const listaAtual = aba === 'aberto' ? dados.chamados_abertos : dados.chamados_em_andamento;

  return (
    <AppLayout titulo="Dashboard" subtitulo="Visão geral dos chamados de TI">
      <div className="dashboard-grid">
        <div>
          <div className="stat-grid">
            <StatCard
              icon="📅" iconBg="var(--accent-blue)" accent="var(--accent-blue)" label="Abertos" value={abertos}
              footer={<p className="stat-card__delta stat-card__delta--neutral">{semResponsavel} sem responsável</p>}
            />
            <StatCard
              icon="🗓️" iconBg="var(--accent-amber)" accent="var(--accent-amber)" label="Em andamento" value={emAndamento}
              footer={<p className="stat-card__delta stat-card__delta--neutral">{aguardandoUsuario} sem responsável</p>}
            />
            <StatCard
              icon="✅" iconBg="var(--accent-green)" accent="var(--accent-green)" label="Resolvidos hoje" value={dados.resolvidos_hoje}
            />
            <StatCard
              icon="🕐" iconBg="var(--accent-purple)" accent="var(--accent-purple)" label="Tempo médio de resolução" value={formatarDuracao(dados.tempo_medio_segundos)}
            />
          </div>

          <div className="charts-row">
            <div className="card" style={{ padding: 20 }}>
              <div className="flex-between" style={{ marginBottom: 12 }}>
                <h3 className="card__title">Chamados por período (últimos 30 dias)</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dados.serie_diaria}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="dia"
                    tickFormatter={(d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    fontSize={12}
                    tick={{ fill: '#8891A6' }}
                    axisLine={{ stroke: '#212A3E' }}
                    tickLine={{ stroke: '#212A3E' }}
                  />
                  <YAxis
                    fontSize={12}
                    allowDecimals={false}
                    tick={{ fill: '#8891A6' }}
                    axisLine={{ stroke: '#212A3E' }}
                    tickLine={{ stroke: '#212A3E' }}
                  />
                  <Tooltip
                    labelFormatter={(d) => new Date(d as string).toLocaleDateString('pt-BR')}
                    contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }}
                    labelStyle={{ color: '#8891A6' }}
                  />
                  <Legend wrapperStyle={{ color: '#8891A6', fontSize: 12 }} />
                  <Line type="monotone" dataKey="abertos" name="Abertos" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="em_andamento" name="Em andamento" stroke="#F5A623" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="resolvidos" name="Resolvidos" stroke="#22C55E" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 20, minWidth: 0 }}>
              <h3 className="card__title" style={{ marginBottom: 12 }}>Chamados por categoria (mês)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={dados.por_categoria}
                    dataKey="total"
                    nameKey="nome"
                    innerRadius={50}
                    outerRadius={75}
                    cy="45%"
                  >
                    {dados.por_categoria.map((_, i) => (
                      <Cell key={i} fill={CORES_CATEGORIA[i % CORES_CATEGORIA.length]} stroke="#10162A" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#10162A', border: '1px solid #212A3E', borderRadius: 10, color: '#EAEDF5' }} />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 12, lineHeight: '18px', color: '#8891A6' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card__header" style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={aba === 'aberto' ? 'btn btn--primary' : 'btn btn--secondary'}
                  onClick={() => setAba('aberto')}
                >
                  Abertos ({dados.chamados_abertos.length})
                </button>
                <button
                  className={aba === 'em_andamento' ? 'btn btn--primary' : 'btn btn--secondary'}
                  onClick={() => setAba('em_andamento')}
                >
                  Em andamento ({dados.chamados_em_andamento.length})
                </button>
              </div>
              <button className="btn btn--secondary" onClick={() => navigate(`/chamados?status=${aba}`)}>Ver todos</button>
            </div>
            <TabelaChamados
              chamados={listaAtual}
              vazio={aba === 'aberto' ? 'Nenhum chamado aberto no momento.' : 'Nenhum chamado em andamento no momento.'}
              onAbrir={(id) => navigate(`/chamados/${id}`)}
            />
          </div>
        </div>

        <div className="right-column">
          <div className="card">
            <div className="card__header" style={{ paddingBottom: 12 }}>
              <h3 className="card__title">Fila sem responsável</h3>
            </div>
            <div className="side-panel-list">
              {dados.fila_sem_responsavel.length === 0 && (
                <div className="empty-state" style={{ padding: '20px 0' }}>Nenhum chamado esperando responsável 🎉</div>
              )}
              {dados.fila_sem_responsavel.slice(0, 6).map((c) => (
                <div key={c.id} className="notification-item">
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/chamados/${c.id}`)}>
                    <p className="notification-item__title">#{c.id} — {c.titulo}</p>
                    <p className="notification-item__desc">{c.setor_nome} · {c.categoria_nome}</p>
                  </div>
                  <button className="btn btn--secondary" style={{ flexShrink: 0 }} onClick={() => assumir(c.id)}>Assumir</button>
                </div>
              ))}
            </div>
          </div>
          <QuickActions />
        </div>
      </div>
    </AppLayout>
  );
}
